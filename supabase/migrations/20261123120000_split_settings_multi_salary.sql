-- Reparto configurable + varios sueldos por mes + sin arrastre desde 2026-12-01.
-- Meses anteriores al corte siguen con la regla vieja (última revisión <= mes).

create table public.household_split_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  mode text not null,
  percent_by_user jsonb not null default '{}'::jsonb,
  effective_from date not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint household_split_settings_mode check (mode in ('proportional', 'even', 'manual')),
  constraint household_split_settings_month_start check (extract(day from effective_from) = 1),
  constraint household_split_settings_household_month unique (household_id, effective_from)
);

create index household_split_settings_household_idx
  on public.household_split_settings (household_id, effective_from desc);

alter table public.base_salaries
  add column if not exists label text;

alter table public.base_salaries
  drop constraint if exists base_salaries_user_month;

create index if not exists base_salaries_user_month_idx
  on public.base_salaries (user_id, effective_from);

-- Corte: desde diciembre 2026 el sueldo no se arrastra.
create or replace function private.salary_cutover()
returns date
language sql
immutable
as $$
  select date '2026-12-01'
$$;

create or replace function private.split_setting_at(
  target_household uuid,
  target_month date
)
returns public.household_split_settings
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.household_split_settings as s
  where s.household_id = target_household
    and s.effective_from <= target_month
  order by s.effective_from desc
  limit 1
$$;

create or replace function private.bases_at(
  target_household uuid,
  target_month date,
  override_user uuid,
  override_amount numeric,
  override_from date,
  replacing boolean
)
returns table (user_id uuid, amount numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  member uuid;
  chosen numeric;
  chosen_from date;
  row_from date;
  row_amount numeric;
  cutover date := private.salary_cutover();
  month_sum numeric;
begin
  for member in
    select p.id
    from public.profiles as p
    where p.household_id = target_household
    order by p.id
  loop
    if target_month >= cutover then
      select coalesce(sum(s.amount), 0)
      into month_sum
      from public.base_salaries as s
      where s.user_id = member
        and s.effective_from = target_month;

      -- override: sumar un sueldo más (replacing=false) o reemplazar el total del mes (true).
      if override_user is not null
        and member = override_user
        and override_from = target_month
        and override_amount is not null
      then
        if replacing then
          chosen := override_amount;
        else
          chosen := month_sum + override_amount;
        end if;
      else
        chosen := month_sum;
      end if;
    else
      chosen := null;
      chosen_from := null;

      for row_from, row_amount in
        select s.effective_from, s.amount
        from public.base_salaries as s
        where s.user_id = member
          and s.effective_from <= target_month
          and not (
            replacing
            and override_user is not null
            and member = override_user
            and s.effective_from = (
              select max(latest.effective_from)
              from public.base_salaries as latest
              where latest.user_id = member
            )
          )
        order by s.effective_from desc
      loop
        chosen := row_amount;
        chosen_from := row_from;
        exit;
      end loop;

      if override_user is not null
        and member = override_user
        and override_from is not null
        and override_amount is not null
        and override_from <= target_month
        and (chosen_from is null or override_from >= chosen_from)
      then
        chosen := override_amount;
      end if;

      chosen := coalesce(chosen, 0);
    end if;

    user_id := member;
    amount := coalesce(chosen, 0);
    return next;
  end loop;
end;
$$;

-- NULL si no hay sueldo del mes (Mi año muestra vacío; bases_at usa 0 para el 50/50).
create or replace function private.salary_at(target uuid, target_month date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_month >= private.salary_cutover() then
      (
        select sum(s.amount)
        from public.base_salaries as s
        where s.user_id = target
          and s.effective_from = target_month
      )
    else
      (
        select s.amount
        from public.base_salaries as s
        where s.user_id = target
          and s.effective_from <= target_month
        order by s.effective_from desc
        limit 1
      )
  end
$$;

create or replace function private.percents_for(
  target_household uuid,
  target_month date,
  override_user uuid,
  override_amount numeric,
  override_from date,
  replacing boolean
)
returns table (user_id uuid, percent integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ids uuid[];
  bases numeric[];
  percents integer[];
  i integer;
  setting public.household_split_settings;
  n integer;
  manual_total integer := 0;
  first_id uuid;
  stored integer;
begin
  select
    coalesce(array_agg(b.user_id order by b.user_id), array[]::uuid[]),
    coalesce(array_agg(b.amount order by b.user_id), array[]::numeric[])
  into ids, bases
  from private.bases_at(target_household, target_month, override_user, override_amount, override_from, replacing) as b;

  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then
    return;
  end if;

  setting := private.split_setting_at(target_household, target_month);

  if setting.id is not null and setting.mode = 'even' then
    percents := private.split_percents(array_fill(1::numeric, array[n]));
  elsif setting.id is not null and setting.mode = 'manual' then
    percents := array[]::integer[];
    for i in 1..n loop
      stored := coalesce((setting.percent_by_user ->> ids[i]::text)::integer, 0);
      percents := percents || stored;
      manual_total := manual_total + stored;
    end loop;
    if manual_total <> 100 then
      -- respaldo: partes iguales si el JSON está mal
      percents := private.split_percents(array_fill(1::numeric, array[n]));
    end if;
  else
    -- proportional (default) o sin preferencia: 50/50 si falta algún sueldo (RS2)
    percents := private.split_percents(bases);
  end if;

  for i in 1..n loop
    user_id := ids[i];
    percent := percents[i];
    return next;
  end loop;
end;
$$;

create or replace function private.split_is_even(target_household uuid, target_month date)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  setting public.household_split_settings;
  missing boolean;
begin
  if target_household is null or not private.is_member(target_household) then
    return false;
  end if;

  setting := private.split_setting_at(target_household, target_month);
  if setting.id is not null and setting.mode = 'even' then
    return true;
  end if;
  if setting.id is not null and setting.mode = 'manual' then
    return false;
  end if;

  select coalesce(bool_or(b.amount <= 0), false)
  into missing
  from private.bases_at(target_household, target_month, null, null, null, false) as b;

  return missing;
end;
$$;

-- Guardia nueva: varios sueldos por mes; solo dueña; monto > 0; día 1.
create or replace function private.guard_salary_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'El sueldo no cambia de persona';
  end if;

  if extract(day from new.effective_from) <> 1 then
    raise exception 'Elegí el mes';
  end if;

  if new.amount is null or round(new.amount, 2) <= 0 then
    raise exception 'El sueldo tiene que ser mayor a cero';
  end if;

  if new.label is not null then
    new.label := nullif(btrim(new.label), '');
  end if;

  return new;
end;
$$;

-- Preferencia de reparto: guardar desde el mes actual (o el próximo si está saldado).
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

  perform private.write_split_notice(hid, uid, apply_from);

  return row;
end;
$$;

create or replace function public.household_split_setting(target_month date)
returns table (
  mode text,
  percent_by_user jsonb,
  effective_from date,
  created_by uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  hid uuid := private.my_household_id();
  setting public.household_split_settings;
begin
  if hid is null then
    return;
  end if;
  if target_month is null or extract(day from target_month) <> 1 then
    raise exception 'El mes tiene que empezar el día 1';
  end if;
  setting := private.split_setting_at(hid, target_month);
  if setting.id is null then
    mode := 'proportional';
    percent_by_user := '{}'::jsonb;
    effective_from := null;
    created_by := null;
    return next;
    return;
  end if;
  mode := setting.mode;
  percent_by_user := setting.percent_by_user;
  effective_from := setting.effective_from;
  created_by := setting.created_by;
  return next;
end;
$$;

revoke all on function public.save_household_split_setting(text, integer, date) from public, anon;
grant execute on function public.save_household_split_setting(text, integer, date) to authenticated;
revoke all on function public.household_split_setting(date) from public, anon;
grant execute on function public.household_split_setting(date) to authenticated;

alter table public.household_split_settings enable row level security;

create policy household_split_settings_select on public.household_split_settings
for select to authenticated
using (private.is_member(household_id));

create policy household_split_settings_insert on public.household_split_settings
for insert to authenticated
with check (
  private.is_member(household_id)
  and created_by = (select auth.uid())
);

create policy household_split_settings_update on public.household_split_settings
for update to authenticated
using (private.is_member(household_id))
with check (
  private.is_member(household_id)
  and created_by = (select auth.uid())
);

revoke all on table public.household_split_settings from public, anon;
grant select, insert, update on public.household_split_settings to authenticated;

-- Las dos ven los sueldos del hogar (montos del panel de reparto).
drop policy if exists base_salaries_select on public.base_salaries;
create policy base_salaries_select on public.base_salaries
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles as mine
    join public.profiles as theirs on theirs.household_id = mine.household_id
    where mine.id = (select auth.uid())
      and theirs.id = base_salaries.user_id
      and mine.household_id is not null
  )
);

revoke all on function private.salary_cutover() from public, anon, authenticated;
revoke all on function private.split_setting_at(uuid, date) from public, anon, authenticated;
