-- Al guardar el modo de reparto, se borran avisos futuros del hogar (quedaban
-- snapshots viejos de sueldos, p. ej. 75/25, aunque el modo vigente sea even).
create or replace function public.save_household_split_setting(
  p_mode text,
  p_my_percent integer default null,
  p_effective_from date default null
)
returns public.household_split_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  partner uuid;
  apply_from date;
  settled boolean;
  percents jsonb := '{}'::jsonb;
  row public.household_split_settings;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select p.household_id into hid from public.profiles as p where p.id = uid;
  if hid is null then
    raise exception 'No pertenecés a este hogar';
  end if;

  if p_mode not in ('proportional', 'even', 'manual') then
    raise exception 'Elegí cómo se reparte';
  end if;

  apply_from := coalesce(p_effective_from, date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date);
  if extract(day from apply_from) <> 1 then
    raise exception 'Elegí el mes';
  end if;

  select exists (
    select 1 from public.settlements as s
    where s.household_id = hid and s.month = apply_from
  ) into settled;

  if settled then
    apply_from := (apply_from + interval '1 month')::date;
  end if;

  select p.id into partner
  from public.profiles as p
  where p.household_id = hid and p.id <> uid
  order by p.id
  limit 1;

  if p_mode = 'manual' then
    if partner is null then
      raise exception 'Cuando se sume tu compañera, calculamos el porcentaje.';
    end if;
    if p_my_percent is null or p_my_percent < 1 or p_my_percent > 99 then
      raise exception 'Tu parte tiene que ser un entero entre 1 y 99';
    end if;
    percents := jsonb_build_object(uid::text, p_my_percent, partner::text, 100 - p_my_percent);
  elsif p_mode = 'even' and partner is not null then
    percents := jsonb_build_object(uid::text, 50, partner::text, 50);
  end if;

  insert into public.household_split_settings (
    household_id, mode, percent_by_user, effective_from, created_by
  ) values (
    hid, p_mode, percents, apply_from, uid
  )
  on conflict (household_id, effective_from) do update
  set mode = excluded.mode,
      percent_by_user = excluded.percent_by_user,
      created_by = excluded.created_by,
      created_at = statement_timestamp()
  returning * into row;

  -- Avisos futuros del hogar quedan obsoletos al cambiar el modo.
  delete from public.split_notices as n
  using public.profiles as p
  where n.recipient_id = p.id
    and p.household_id = hid
    and n.effective_from >= apply_from;

  perform private.write_split_notice(hid, uid, apply_from);

  return row;
end;
$$;

revoke all on function public.save_household_split_setting(text, integer, date) from public, anon;
grant execute on function public.save_household_split_setting(text, integer, date) to authenticated;
