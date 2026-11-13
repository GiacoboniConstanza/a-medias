-- Bootstrap LOCAL para pgTAP de memos editar/eliminar (no es Production).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end$$;

grant usage on schema public to anon, authenticated, service_role;
grant authenticated to postgres;

create schema if not exists auth;
create schema if not exists private;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Alguien')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

create or replace function private.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.household_id
  from public.profiles as p
  where p.id = (select auth.uid())
$$;

create or replace function private.create_household()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  existing uuid;
  code text;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select p.household_id into existing
  from public.profiles as p
  where p.id = uid;

  if existing is not null then
    raise exception 'Ya estás en un hogar';
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.households (invite_code, created_by)
  values (code, uid)
  returning id into hid;

  update public.profiles
  set household_id = hid
  where id = uid;

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
  uid uuid := (select auth.uid());
  hid uuid;
  members integer;
  existing uuid;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select p.household_id into existing
  from public.profiles as p
  where p.id = uid;

  if existing is not null then
    raise exception 'Ya estás en un hogar';
  end if;

  select h.id into hid
  from public.households as h
  where h.invite_code = upper(btrim(invite));

  if hid is null then
    raise exception 'Ese código no existe';
  end if;

  select count(*) into members
  from public.profiles as p
  where p.household_id = hid;

  if members >= 2 then
    raise exception 'Este hogar ya tiene dos personas';
  end if;

  update public.profiles
  set household_id = hid
  where id = uid;

  return hid;
end;
$$;

create or replace function public.create_household()
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_household()
$$;

create or replace function public.join_household(invite text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.join_household(invite)
$$;

grant usage on schema private to authenticated;
grant execute on function private.my_household_id() to authenticated;
grant execute on function private.create_household() to authenticated;
grant execute on function private.join_household(text) to authenticated;
grant execute on function public.create_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;

alter table public.households enable row level security;
alter table public.profiles enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
for select to authenticated
using (id = (select private.my_household_id()));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or household_id = (select private.my_household_id())
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

grant select on public.households to authenticated;
grant select, update on public.profiles to authenticated;
