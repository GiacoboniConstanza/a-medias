-- Rediseño del registro de comidas (R8, R10, R14, R26, R29).
-- Las filas viejas quedan válidas sin porción ni origen (R16).
-- protein_g pasa a ser opcional (R14, R15).
-- common_foods: lista de solo lectura «De todos los días» (ARGENFOODS se carga fuera del repo).

alter table public.meals
  alter column protein_g drop not null;

alter table public.meals
  drop constraint if exists meals_protein;

alter table public.meals
  add constraint meals_protein check (protein_g is null or protein_g >= 0);

alter table public.meals
  add column if not exists portion_label text,
  add column if not exists portion_qty numeric,
  add column if not exists portion_grams numeric,
  add column if not exists food_source text,
  add column if not exists food_ref text,
  add column if not exists brand text;

alter table public.meals
  drop constraint if exists meals_portion_qty,
  drop constraint if exists meals_portion_grams,
  drop constraint if exists meals_food_source,
  drop constraint if exists meals_portion_label_len,
  drop constraint if exists meals_brand_len;

alter table public.meals
  add constraint meals_portion_qty check (portion_qty is null or portion_qty > 0),
  add constraint meals_portion_grams check (portion_grams is null or portion_grams > 0),
  add constraint meals_food_source check (
    food_source is null or food_source in ('common', 'off', 'manual', 'saved')
  ),
  add constraint meals_portion_label_len check (
    portion_label is null or char_length(portion_label) between 1 and 80
  ),
  add constraint meals_brand_len check (brand is null or char_length(brand) between 1 and 80);

alter table public.saved_foods
  alter column protein_g drop not null;

alter table public.saved_foods
  drop constraint if exists saved_foods_protein;

alter table public.saved_foods
  add constraint saved_foods_protein check (protein_g is null or protein_g >= 0);

alter table public.saved_foods
  add column if not exists portion_label text,
  add column if not exists portion_qty numeric,
  add column if not exists portion_grams numeric,
  add column if not exists food_source text,
  add column if not exists food_ref text,
  add column if not exists brand text,
  add column if not exists protein_per_100g numeric,
  add column if not exists carbs_per_100g numeric,
  add column if not exists fat_per_100g numeric,
  add column if not exists kcal_per_100g numeric,
  add column if not exists portions jsonb not null default '[]'::jsonb;

alter table public.saved_foods
  drop constraint if exists saved_foods_portion_qty,
  drop constraint if exists saved_foods_portion_grams,
  drop constraint if exists saved_foods_food_source,
  drop constraint if exists saved_foods_portion_label_len,
  drop constraint if exists saved_foods_brand_len;

alter table public.saved_foods
  add constraint saved_foods_portion_qty check (portion_qty is null or portion_qty > 0),
  add constraint saved_foods_portion_grams check (portion_grams is null or portion_grams > 0),
  add constraint saved_foods_food_source check (
    food_source is null or food_source in ('common', 'off', 'manual', 'saved')
  ),
  add constraint saved_foods_portion_label_len check (
    portion_label is null or char_length(portion_label) between 1 and 80
  ),
  add constraint saved_foods_brand_len check (brand is null or char_length(brand) between 1 and 80);

create index if not exists meals_owner_created_idx
  on public.meals (owner_id, created_at desc);

create table if not exists public.common_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  search_name text not null,
  protein_per_100g numeric,
  carbs_per_100g numeric,
  fat_per_100g numeric,
  kcal_per_100g numeric,
  portions jsonb not null default '[]'::jsonb,
  source text not null default 'argenfoods',
  created_at timestamptz not null default now(),
  constraint common_foods_name_len check (char_length(name) between 1 and 120),
  constraint common_foods_name_trim check (name = btrim(name)),
  constraint common_foods_search_len check (char_length(search_name) between 1 and 120),
  constraint common_foods_protein check (protein_per_100g is null or protein_per_100g >= 0),
  constraint common_foods_carbs check (carbs_per_100g is null or carbs_per_100g >= 0),
  constraint common_foods_fat check (fat_per_100g is null or fat_per_100g >= 0),
  constraint common_foods_kcal check (kcal_per_100g is null or kcal_per_100g >= 0),
  constraint common_foods_source check (source in ('argenfoods', 'example', 'usda'))
);

create index if not exists common_foods_search_idx
  on public.common_foods (search_name);

create index if not exists common_foods_name_trgm_idx
  on public.common_foods (lower(name) text_pattern_ops);

alter table public.common_foods enable row level security;

drop policy if exists common_foods_select on public.common_foods;
create policy common_foods_select on public.common_foods
for select to authenticated
using (true);

revoke all on table public.common_foods from public, anon;
grant select on table public.common_foods to authenticated;

-- common_foods queda vacía acá a propósito.
-- Los alimentos de ejemplo van en supabase/seed.sql (solo `db reset` local).
-- ARGENFOODS se carga fuera del repo: ver scripts/load-common-foods.mjs.
