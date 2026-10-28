-- Hábitos privados. 0 es lunes y 6 es domingo.
-- Quien los escribe es la única persona que los ve y los edita.
-- Un tilde solo se puede poner en un hábito propio.

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  icon_name text not null default 'seedling',
  days_of_week integer[] not null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habits_name_len check (char_length(name) between 1 and 80),
  constraint habits_name_trim check (name = btrim(name)),
  constraint habits_icon_len check (char_length(icon_name) between 1 and 40),
  constraint habits_icon_trim check (icon_name = btrim(icon_name)),
  constraint habits_days_count check (cardinality(days_of_week) between 1 and 7)
);

create table public.habit_checks (
  habit_id uuid not null references public.habits (id) on delete cascade,
  day date not null,
  done_at timestamptz not null default now(),
  primary key (habit_id, day)
);

create index habits_owner_idx on public.habits (owner_id) where not archived;

create function private.guard_habit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day integer;
  distinct_days integer;
begin
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'No se puede cambiar de quién es el hábito';
  end if;

  if new.days_of_week is null or cardinality(new.days_of_week) < 1 or cardinality(new.days_of_week) > 7 then
    raise exception 'Elegí entre 1 y 7 días';
  end if;

  foreach day in array new.days_of_week loop
    if day < 0 or day > 6 then
      raise exception 'El día tiene que estar entre 0 y 6';
    end if;
  end loop;

  select count(distinct value)
  into distinct_days
  from unnest(new.days_of_week) as value;

  if distinct_days <> cardinality(new.days_of_week) then
    raise exception 'Los días no se repiten';
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_habit() from public, anon, authenticated;

create trigger habits_guard
  before insert or update on public.habits
  for each row
  execute function private.guard_habit();

create function private.guard_habit_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  habit_owner uuid;
  actor uuid := (select auth.uid());
  target uuid := case when tg_op = 'DELETE' then old.habit_id else new.habit_id end;
begin
  select h.owner_id
  into habit_owner
  from public.habits as h
  where h.id = target;

  if habit_owner is null then
    raise exception 'Ese hábito no existe';
  end if;

  if actor is not null and habit_owner is distinct from actor then
    raise exception 'Ese hábito no es tuyo';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_habit_check() from public, anon, authenticated;

create trigger habit_checks_guard
  before insert or delete on public.habit_checks
  for each row
  execute function private.guard_habit_check();

alter table public.habits enable row level security;
alter table public.habit_checks enable row level security;

create policy habits_select on public.habits
for select to authenticated
using (owner_id = (select auth.uid()));

create policy habits_insert on public.habits
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy habits_update on public.habits
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy habit_checks_select on public.habit_checks
for select to authenticated
using (
  exists (
    select 1
    from public.habits as h
    where h.id = habit_id
      and h.owner_id = (select auth.uid())
  )
);

create policy habit_checks_insert on public.habit_checks
for insert to authenticated
with check (
  exists (
    select 1
    from public.habits as h
    where h.id = habit_id
      and h.owner_id = (select auth.uid())
  )
);

create policy habit_checks_delete on public.habit_checks
for delete to authenticated
using (
  exists (
    select 1
    from public.habits as h
    where h.id = habit_id
      and h.owner_id = (select auth.uid())
  )
);

revoke all on table public.habits from public, anon;
revoke all on table public.habit_checks from public, anon;
grant select, insert, update on public.habits to authenticated;
grant select, insert, delete on public.habit_checks to authenticated;
