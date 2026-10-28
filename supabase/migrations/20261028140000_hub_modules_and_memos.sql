-- Hub: cada persona elige sus módulos. Finanzas queda prendido para quienes
-- ya usan la app, así no ven un cambio. Siempre tiene que quedar uno prendido.
-- Un memo lo ve y lo edita quien lo escribió. Si está compartido, la otra
-- persona del hogar puede verlo y marcarlo hecho, nada más.

create table public.user_modules (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, module),
  constraint user_modules_module check (module in ('finanzas', 'habitos', 'comidas', 'memos'))
);

create table public.memos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memos_text_len check (char_length(text) between 1 and 400),
  constraint memos_text_trim check (text = btrim(text))
);

create index memos_owner_idx on public.memos (owner_id, created_at desc);
create index memos_shared_household_idx on public.memos (household_id, created_at desc) where shared;

create function private.guard_user_modules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  others integer;
begin
  if tg_op = 'DELETE' then
    -- El cascade al borrar el perfil entra anidado, o con el perfil ya borrado.
    -- Un delete directo de la fila, no.
    if pg_trigger_depth() > 1
      or not exists (select 1 from public.profiles where id = old.user_id) then
      return old;
    end if;

    if old.enabled then
      perform pg_advisory_xact_lock(hashtext(old.user_id::text)::bigint);
      select count(*)
      into others
      from public.user_modules
      where user_id = old.user_id
        and enabled
        and module is distinct from old.module;

      if others = 0 then
        raise exception 'Tiene que quedar al menos un módulo activo';
      end if;
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.module is distinct from old.module then
      raise exception 'No se puede reasignar el módulo';
    end if;
  end if;

  if not new.enabled then
    uid := new.user_id;
    perform pg_advisory_xact_lock(hashtext(uid::text)::bigint);
    select count(*)
    into others
    from public.user_modules
    where user_id = uid
      and enabled
      and module is distinct from new.module;

    if others = 0 then
      raise exception 'Tiene que quedar al menos un módulo activo';
    end if;
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_user_modules() from public, anon, authenticated;

create trigger user_modules_guard
  before insert or update or delete on public.user_modules
  for each row
  execute function private.guard_user_modules();

create function private.seed_user_modules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_modules (user_id, module, enabled)
  values (new.id, 'finanzas', true)
  on conflict (user_id, module) do nothing;
  return new;
end;
$$;

revoke all on function private.seed_user_modules() from public, anon, authenticated;

create trigger profiles_seed_modules
  after insert on public.profiles
  for each row
  execute function private.seed_user_modules();

insert into public.user_modules (user_id, module, enabled)
select p.id, 'finanzas', true
from public.profiles as p
on conflict (user_id, module) do nothing;

create function private.guard_memo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    if actor is not null and old.owner_id is distinct from actor then
      raise exception 'Solo quien lo escribió puede borrarlo';
    end if;
    return old;
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = new.owner_id
      and p.household_id = new.household_id
  ) then
    raise exception 'El memo tiene que ser del hogar de quien lo escribe';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.owner_id is distinct from old.owner_id
      or new.household_id is distinct from old.household_id
      or new.created_at is distinct from old.created_at then
      raise exception 'No se puede cambiar de quién es el memo';
    end if;

    if actor is not null and actor is distinct from old.owner_id then
      if not old.shared or old.household_id is distinct from (select private.my_household_id()) then
        raise exception 'No podés editar este memo';
      end if;
      if new.text is distinct from old.text or new.shared is distinct from old.shared then
        raise exception 'Solo podés marcarlo hecho';
      end if;
    end if;
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_memo() from public, anon, authenticated;

create trigger memos_guard
  before insert or update or delete on public.memos
  for each row
  execute function private.guard_memo();

alter table public.user_modules enable row level security;
alter table public.memos enable row level security;

create policy user_modules_select on public.user_modules
for select to authenticated
using (user_id = (select auth.uid()));

create policy user_modules_insert on public.user_modules
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy user_modules_update on public.user_modules
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy memos_select on public.memos
for select to authenticated
using (
  owner_id = (select auth.uid())
  or (
    shared
    and household_id = (select private.my_household_id())
  )
);

create policy memos_insert on public.memos
for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and household_id = (select private.my_household_id())
);

create policy memos_update on public.memos
for update to authenticated
using (
  owner_id = (select auth.uid())
  or (
    shared
    and household_id = (select private.my_household_id())
  )
)
with check (
  owner_id = (select auth.uid())
  or (
    shared
    and household_id = (select private.my_household_id())
  )
);

create policy memos_delete on public.memos
for delete to authenticated
using (owner_id = (select auth.uid()));

revoke all on table public.user_modules from public, anon;
revoke all on table public.memos from public, anon;
grant select, insert, update on public.user_modules to authenticated;
grant select, insert, update, delete on public.memos to authenticated;
