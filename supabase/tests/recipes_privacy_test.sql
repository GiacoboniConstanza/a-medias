begin;
select plan(14);

-- UUIDs propios del test (no los de seed.sql: 11111111… / 22222222…).
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7',
    'recetas-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'e8e8e8e8-e8e8-48e8-88e8-e8e8e8e8e8e8',
    'recetas-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  ),
  (
    'e9e9e9e9-e9e9-49e9-89e9-e9e9e9e9e9e9',
    'recetas-otra@example.test',
    '{"display_name":"Otra"}'::jsonb
  );

create temp table recipe_home (hid uuid, code text, other_hid uuid);
grant all on table recipe_home to authenticated;

select set_config('request.jwt.claim.sub', 'e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7","role":"authenticated"}',
  true
);
set local role authenticated;

insert into recipe_home (hid)
select public.create_household();

update recipe_home
set code = (
  select h.invite_code
  from public.households as h
  where h.id = recipe_home.hid
);

insert into public.recipes (id, household_id, name, servings)
values (
  'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7',
  (select hid from recipe_home),
  'Guiso de Coty',
  2
);

insert into public.recipe_ingredients (
  id, recipe_id, name, grams, protein_g, carbs_g, fat_g, kcal, food_source
) values (
  'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7',
  'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7',
  'Lentejas',
  200,
  18,
  40,
  1,
  240,
  'common'
);

insert into public.meals (
  id, owner_id, eaten_on, meal_type, name, protein_g, carbs_g, fat_g, kcal,
  portion_label, portion_qty, food_source, food_ref
) values (
  'c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9',
  'e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7',
  '2026-11-19',
  'almuerzo',
  'Guiso de Coty',
  9,
  20,
  1,
  120,
  'porción',
  0.5,
  'recipe',
  'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7'
);

select throws_ok(
  $$insert into public.recipes (household_id, name, servings)
    values ((select hid from recipe_home), 'guiso de coty', 1)$$,
  'P0001',
  'Ya hay una receta «guiso de coty»',
  'nombre repetido sin distinguir mayúsculas'
);

select throws_ok(
  $$insert into public.recipes (household_id, name, servings)
    values ((select hid from recipe_home), 'Demasiadas', 51)$$,
  'P0001',
  'La receta tiene que rendir entre 1 y 50 porciones',
  'servings fuera de 1–50'
);

select throws_ok(
  $$insert into public.recipe_ingredients (
      recipe_id, name, grams, food_source
    ) values (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7',
      'Cero gramos',
      0,
      'common'
    )$$,
  'P0001',
  'Los gramos tienen que ser al menos 1',
  'gramos del ingrediente mínimo 1'
);

reset role;

select set_config('request.jwt.claim.sub', 'e8e8e8e8-e8e8-48e8-88e8-e8e8e8e8e8e8', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e8e8e8e8-e8e8-48e8-88e8-e8e8e8e8e8e8","role":"authenticated"}',
  true
);
set local role authenticated;

select public.join_household((select code from recipe_home));

select is(
  (select count(*) from public.recipes),
  1::bigint,
  'las dos ven la receta del hogar'
);

select is(
  (select count(*) from public.recipe_ingredients),
  1::bigint,
  'las dos ven los ingredientes del hogar'
);

select lives_ok(
  $$update public.recipes
    set name = 'Guiso de Maru'
    where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7'$$,
  'Maru puede editar la receta de Coty'
);

select is(
  (select name from public.recipes where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7'),
  'Guiso de Maru',
  'el cambio de Maru quedó guardado'
);

select is(
  (select count(*) from public.meals where id = 'c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9'),
  0::bigint,
  'Maru no ve las meals privadas de Coty'
);

select lives_ok(
  $$delete from public.recipes where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7'$$,
  'Maru puede borrar la receta de Coty'
);

select is(
  (select count(*) from public.recipes where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7'),
  0::bigint,
  'la receta ya no está'
);

select is(
  (select count(*) from public.recipe_ingredients where recipe_id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7'),
  0::bigint,
  'al borrar la receta se van los ingredientes'
);

reset role;

select set_config('request.jwt.claim.sub', 'e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.meals
    where id = 'c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9'
      and food_source = 'recipe'
      and name = 'Guiso de Coty'
      and protein_g = 9
  ),
  1::bigint,
  'borrar la receta no toca la meal anotada (copia)'
);

-- Recreamos una receta en el hogar de Coty/Maru (rol postgres) para el aislamiento de otro hogar.
reset role;
insert into public.recipes (id, household_id, created_by, name, servings)
values (
  'd7d7d7d7-d7d7-47d7-87d7-d7d7d7d7d7d7',
  (select hid from recipe_home),
  'e7e7e7e7-e7e7-47e7-87e7-e7e7e7e7e7e7',
  'Tarta',
  1
);

select set_config('request.jwt.claim.sub', 'e9e9e9e9-e9e9-49e9-89e9-e9e9e9e9e9e9', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e9e9e9e9-e9e9-49e9-89e9-e9e9e9e9e9e9","role":"authenticated"}',
  true
);
set local role authenticated;

update recipe_home
set other_hid = public.create_household();

select is(
  (select count(*) from public.recipes where id = 'd7d7d7d7-d7d7-47d7-87d7-d7d7d7d7d7d7'),
  0::bigint,
  'otro hogar no ve las recetas'
);

select throws_ok(
  $$insert into public.recipes (household_id, name, servings)
    values ((select hid from recipe_home), 'Hack', 1)$$,
  'P0001',
  'La receta tiene que ser de tu hogar',
  'otro hogar no puede insertar en el hogar ajeno'
);

select * from finish();
rollback;
