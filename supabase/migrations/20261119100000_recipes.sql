-- Recetas / platos armados del hogar (RC18, RC25).
-- Amplía meals.food_source con 'recipe' (RC15).
-- Sin datos de ejemplo: el seed local, si hace falta, va aparte.

alter table public.meals
  drop constraint if exists meals_food_source;

alter table public.meals
  add constraint meals_food_source check (
    food_source is null
    or food_source in ('common', 'off', 'manual', 'saved', 'recipe')
  );

alter table public.saved_foods
  drop constraint if exists saved_foods_food_source;

alter table public.saved_foods
  add constraint saved_foods_food_source check (
    food_source is null
    or food_source in ('common', 'off', 'manual', 'saved', 'recipe')
  );

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid references public.profiles (id) on delete set null,
  name text not null,
  servings integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_name_len check (char_length(name) between 1 and 80),
  constraint recipes_name_trim check (name = btrim(name)),
  constraint recipes_servings check (servings between 1 and 50),
  constraint recipes_notes_len check (notes is null or char_length(notes) <= 400)
);

create unique index recipes_household_name_ci
  on public.recipes (household_id, lower(name));

create index recipes_household_updated_idx
  on public.recipes (household_id, updated_at desc);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  grams numeric not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  kcal numeric,
  food_source text,
  food_ref text,
  brand text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint recipe_ingredients_name_len check (char_length(name) between 1 and 120),
  constraint recipe_ingredients_name_trim check (name = btrim(name)),
  constraint recipe_ingredients_grams check (grams >= 1),
  constraint recipe_ingredients_protein check (protein_g is null or protein_g >= 0),
  constraint recipe_ingredients_carbs check (carbs_g is null or carbs_g >= 0),
  constraint recipe_ingredients_fat check (fat_g is null or fat_g >= 0),
  constraint recipe_ingredients_kcal check (kcal is null or kcal >= 0),
  constraint recipe_ingredients_food_source check (
    food_source is null
    or food_source in ('common', 'off', 'manual')
  ),
  constraint recipe_ingredients_brand_len check (
    brand is null or char_length(brand) between 1 and 80
  ),
  constraint recipe_ingredients_position check (position >= 0)
);

create index recipe_ingredients_recipe_idx
  on public.recipe_ingredients (recipe_id, position, created_at);

create function private.guard_recipe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  new.name := btrim(new.name);

  if char_length(new.name) < 1 or char_length(new.name) > 80 then
    raise exception 'El nombre de la receta tiene que tener entre 1 y 80 caracteres';
  end if;

  if new.servings is null or new.servings < 1 or new.servings > 50 then
    raise exception 'La receta tiene que rendir entre 1 y 50 porciones';
  end if;

  if new.notes is not null then
    new.notes := nullif(btrim(new.notes), '');
    if new.notes is not null and char_length(new.notes) > 400 then
      raise exception 'La nota es demasiado larga';
    end if;
  end if;

  if actor is not null
    and new.household_id is distinct from (select private.my_household_id()) then
    raise exception 'La receta tiene que ser de tu hogar';
  end if;

  if tg_op = 'INSERT' then
    if actor is not null then
      new.created_by := actor;
      new.updated_by := actor;
    end if;
    new.updated_at := coalesce(new.updated_at, statement_timestamp());
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.household_id is distinct from old.household_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'No se puede cambiar de qué hogar es la receta';
    end if;
    if actor is not null then
      new.updated_by := actor;
    end if;
    new.updated_at := statement_timestamp();
  end if;

  if exists (
    select 1
    from public.recipes as r
    where r.household_id = new.household_id
      and lower(r.name) = lower(new.name)
      and (tg_op = 'INSERT' or r.id is distinct from new.id)
  ) then
    raise exception 'Ya hay una receta «%»', new.name;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_recipe() from public, anon, authenticated;

create trigger recipes_guard
  before insert or update or delete on public.recipes
  for each row
  execute function private.guard_recipe();

create function private.guard_recipe_ingredient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipe_home uuid;
begin
  if tg_op = 'DELETE' then
    update public.recipes
    set updated_at = statement_timestamp()
    where id = old.recipe_id;
    return old;
  end if;

  new.name := btrim(new.name);

  if char_length(new.name) < 1 or char_length(new.name) > 120 then
    raise exception 'El nombre del ingrediente tiene que tener entre 1 y 120 caracteres';
  end if;

  if new.grams is null or new.grams < 1 then
    raise exception 'Los gramos tienen que ser al menos 1';
  end if;

  if new.brand is not null then
    new.brand := nullif(btrim(new.brand), '');
  end if;

  select r.household_id into recipe_home
  from public.recipes as r
  where r.id = new.recipe_id;

  if recipe_home is null then
    raise exception 'Esa receta no existe';
  end if;

  if recipe_home is distinct from (select private.my_household_id()) then
    raise exception 'El ingrediente tiene que ser de una receta de tu hogar';
  end if;

  if tg_op = 'UPDATE' and new.recipe_id is distinct from old.recipe_id then
    raise exception 'No se puede mover el ingrediente a otra receta';
  end if;

  update public.recipes
  set updated_at = statement_timestamp()
  where id = new.recipe_id;

  return new;
end;
$$;

revoke all on function private.guard_recipe_ingredient() from public, anon, authenticated;

create trigger recipe_ingredients_guard
  before insert or update or delete on public.recipe_ingredients
  for each row
  execute function private.guard_recipe_ingredient();

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy recipes_select on public.recipes
for select to authenticated
using (household_id = (select private.my_household_id()));

create policy recipes_insert on public.recipes
for insert to authenticated
with check (household_id = (select private.my_household_id()));

create policy recipes_update on public.recipes
for update to authenticated
using (household_id = (select private.my_household_id()))
with check (household_id = (select private.my_household_id()));

create policy recipes_delete on public.recipes
for delete to authenticated
using (household_id = (select private.my_household_id()));

create policy recipe_ingredients_select on public.recipe_ingredients
for select to authenticated
using (
  exists (
    select 1
    from public.recipes as r
    where r.id = recipe_id
      and r.household_id = (select private.my_household_id())
  )
);

create policy recipe_ingredients_insert on public.recipe_ingredients
for insert to authenticated
with check (
  exists (
    select 1
    from public.recipes as r
    where r.id = recipe_id
      and r.household_id = (select private.my_household_id())
  )
);

create policy recipe_ingredients_update on public.recipe_ingredients
for update to authenticated
using (
  exists (
    select 1
    from public.recipes as r
    where r.id = recipe_id
      and r.household_id = (select private.my_household_id())
  )
)
with check (
  exists (
    select 1
    from public.recipes as r
    where r.id = recipe_id
      and r.household_id = (select private.my_household_id())
  )
);

create policy recipe_ingredients_delete on public.recipe_ingredients
for delete to authenticated
using (
  exists (
    select 1
    from public.recipes as r
    where r.id = recipe_id
      and r.household_id = (select private.my_household_id())
  )
);

revoke all on table public.recipes from public, anon;
revoke all on table public.recipe_ingredients from public, anon;
grant select, insert, update, delete on table public.recipes to authenticated;
grant select, insert, update, delete on table public.recipe_ingredients to authenticated;
