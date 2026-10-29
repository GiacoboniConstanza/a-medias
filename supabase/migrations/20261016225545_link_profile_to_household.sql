-- Crea el perfil si falta (usuarios anteriores al trigger) y vincula household_id
-- en la misma transacción. security definer + search_path vacío: el dueño
-- postgres saltea RLS, porque profiles_update no deja cambiar household_id
-- desde el cliente.

create or replace function private.ensure_profile()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  person_name text;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''),
    'Sin nombre'
  )
  into person_name
  from auth.users as u
  where u.id = uid;

  if person_name is null then
    raise exception 'No existe el usuario';
  end if;

  insert into public.profiles (id, display_name)
  values (uid, person_name)
  on conflict (id) do nothing;

  return uid;
end;
$$;

create or replace function private.create_household()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  hid uuid;
  code text;
  linked integer;
begin
  uid := private.ensure_profile();

  select p.household_id
  into hid
  from public.profiles as p
  where p.id = uid
  for update;

  if hid is not null then
    return hid;
  end if;

  select h.id
  into hid
  from public.households as h
  where h.created_by = uid
  order by h.created_at, h.id
  limit 1
  for update;

  if hid is null then
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    insert into public.households (invite_code, created_by)
    values (code, uid)
    returning id into hid;
  end if;

  if not exists (
    select 1
    from public.categories as c
    where c.household_id = hid
      and c.owner_id is null
  ) then
    insert into public.categories (household_id, owner_id, name, emoji)
    values
      (hid, null, 'Súper', '🛒'),
      (hid, null, 'Comida', '🍕'),
      (hid, null, 'Viajes', '🚌'),
      (hid, null, 'Servicios', '💡'),
      (hid, null, 'Salidas', '🎉'),
      (hid, null, 'Hogar', '🏠');
  end if;

  update public.profiles
  set household_id = hid
  where id = uid
    and household_id is null;

  get diagnostics linked = row_count;

  if linked <> 1 then
    raise exception 'No se pudo vincular el hogar al perfil';
  end if;

  return hid;
end;
$$;

create or replace function private.join_household(invite text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  hid uuid;
  members integer;
  existing uuid;
  linked integer;
begin
  uid := private.ensure_profile();

  select p.household_id
  into existing
  from public.profiles as p
  where p.id = uid
  for update;

  if existing is not null then
    raise exception 'Ya estás en un hogar';
  end if;

  select h.id
  into hid
  from public.households as h
  where h.invite_code = upper(btrim(invite));

  if hid is null then
    raise exception 'Ese código no existe';
  end if;

  select count(*)
  into members
  from public.profiles as p
  where p.household_id = hid;

  if members >= 2 then
    raise exception 'Este hogar ya tiene dos personas';
  end if;

  update public.profiles
  set household_id = hid
  where id = uid
    and household_id is null;

  get diagnostics linked = row_count;

  if linked <> 1 then
    raise exception 'No se pudo vincular el hogar al perfil';
  end if;

  return hid;
end;
$$;

revoke all on function private.ensure_profile() from public, anon, authenticated;
revoke all on function private.create_household() from public, anon;
revoke all on function private.join_household(text) from public, anon;

grant execute on function private.create_household() to authenticated;
grant execute on function private.join_household(text) to authenticated;

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''),
    'Sin nombre'
  )
from auth.users as u
where not exists (
  select 1
  from public.profiles as p
  where p.id = u.id
);

with chosen as (
  select distinct on (h.created_by)
    h.created_by,
    h.id as household_id
  from public.households as h
  join public.profiles as p on p.id = h.created_by
  where p.household_id is null
  order by h.created_by, h.created_at, h.id
)
update public.profiles as p
set household_id = chosen.household_id
from chosen
where p.id = chosen.created_by
  and p.household_id is null;

delete from public.households as h
where not exists (
  select 1
  from public.profiles as p
  where p.household_id = h.id
);
