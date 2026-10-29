-- Comidas privadas. No se comparten con el hogar.
-- La proteína es obligatoria en cada comida; el resto de los macros y los objetivos pueden faltar.
-- Si kcal queda vacío, la app lo calcula como 4P + 4C + 9G.

create table public.nutrition_goals (
  owner_id uuid primary key references public.profiles (id) on delete cascade,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  kcal numeric,
  updated_at timestamptz not null default now(),
  constraint nutrition_goals_protein check (protein_g is null or protein_g >= 0),
  constraint nutrition_goals_carbs check (carbs_g is null or carbs_g >= 0),
  constraint nutrition_goals_fat check (fat_g is null or fat_g >= 0),
  constraint nutrition_goals_kcal check (kcal is null or kcal >= 0)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  eaten_on date not null,
  meal_type text not null,
  name text not null,
  protein_g numeric not null,
  carbs_g numeric,
  fat_g numeric,
  kcal numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meals_type check (meal_type in ('desayuno', 'almuerzo', 'merienda', 'cena', 'snack')),
  constraint meals_name_len check (char_length(name) between 1 and 80),
  constraint meals_name_trim check (name = btrim(name)),
  constraint meals_protein check (protein_g >= 0),
  constraint meals_carbs check (carbs_g is null or carbs_g >= 0),
  constraint meals_fat check (fat_g is null or fat_g >= 0),
  constraint meals_kcal check (kcal is null or kcal >= 0)
);

create table public.saved_foods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  protein_g numeric not null,
  carbs_g numeric,
  fat_g numeric,
  kcal numeric,
  constraint saved_foods_name_len check (char_length(name) between 1 and 80),
  constraint saved_foods_name_trim check (name = btrim(name)),
  constraint saved_foods_protein check (protein_g >= 0),
  constraint saved_foods_carbs check (carbs_g is null or carbs_g >= 0),
  constraint saved_foods_fat check (fat_g is null or fat_g >= 0),
  constraint saved_foods_kcal check (kcal is null or kcal >= 0)
);

create index meals_owner_day_idx on public.meals (owner_id, eaten_on);
create index saved_foods_owner_idx on public.saved_foods (owner_id);

create function private.guard_owned_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'No se puede cambiar de quién es';
  end if;
  if tg_table_name = 'saved_foods' then
    return new;
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_owned_row() from public, anon, authenticated;

create trigger nutrition_goals_guard
  before update on public.nutrition_goals
  for each row
  execute function private.guard_owned_row();

create trigger meals_guard
  before update on public.meals
  for each row
  execute function private.guard_owned_row();

create trigger saved_foods_guard
  before update on public.saved_foods
  for each row
  execute function private.guard_owned_row();

alter table public.nutrition_goals enable row level security;
alter table public.meals enable row level security;
alter table public.saved_foods enable row level security;

create policy nutrition_goals_select on public.nutrition_goals
for select to authenticated
using (owner_id = (select auth.uid()));

create policy nutrition_goals_insert on public.nutrition_goals
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy nutrition_goals_update on public.nutrition_goals
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy meals_select on public.meals
for select to authenticated
using (owner_id = (select auth.uid()));

create policy meals_insert on public.meals
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy meals_update on public.meals
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy meals_delete on public.meals
for delete to authenticated
using (owner_id = (select auth.uid()));

create policy saved_foods_select on public.saved_foods
for select to authenticated
using (owner_id = (select auth.uid()));

create policy saved_foods_insert on public.saved_foods
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy saved_foods_update on public.saved_foods
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy saved_foods_delete on public.saved_foods
for delete to authenticated
using (owner_id = (select auth.uid()));

revoke all on table public.nutrition_goals from public, anon;
revoke all on table public.meals from public, anon;
revoke all on table public.saved_foods from public, anon;
grant select, insert, update on public.nutrition_goals to authenticated;
grant select, insert, update, delete on public.meals to authenticated;
grant select, insert, update, delete on public.saved_foods to authenticated;
