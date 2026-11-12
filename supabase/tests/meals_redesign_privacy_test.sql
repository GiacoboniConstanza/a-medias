begin;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
    'comidas-coty@example.com',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c8c8',
    'comidas-maru@example.com',
    '{"display_name":"Maru"}'::jsonb
  );

select set_config('request.jwt.claim.sub', 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.meals (
  id, owner_id, eaten_on, meal_type, name, protein_g, carbs_g, fat_g, kcal,
  portion_label, portion_qty, portion_grams, food_source, food_ref
) values (
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
  '2026-11-12',
  'almuerzo',
  'Milanesa',
  30,
  15,
  10,
  270,
  'Mediana',
  1,
  150,
  'common',
  'a1000000-0000-4000-8000-000000000004'
);

insert into public.saved_foods (
  id, owner_id, name, protein_g, portion_label, portion_qty, portion_grams, food_source
) values (
  'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
  'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
  'Licuado',
  10,
  'vaso',
  1,
  300,
  'manual'
);

-- common_foods arranca vacía en la migración; autenticada puede leerla
select is(
  (select count(*) from public.common_foods),
  0::bigint,
  'common_foods queda vacía tras la migración y se puede leer'
);

reset role;
insert into public.common_foods (id, name, search_name, source)
values (
  'a1000000-0000-4000-8000-000000000099',
  'Alimento de prueba',
  'alimento de prueba',
  'example'
);
select set_config('request.jwt.claim.sub', 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.common_foods where id = 'a1000000-0000-4000-8000-000000000099'),
  1::bigint,
  'la lista de todos los días la puede leer cualquier autenticada'
);

reset role;

select set_config('request.jwt.claim.sub', 'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c8c8', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c8c8","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.meals where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'),
  0::bigint,
  'la comida con porción no la ve la otra'
);

select is(
  (select count(*) from public.saved_foods where id = 'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2'),
  0::bigint,
  'mis alimentos no los ve la otra'
);

select throws_ok(
  $$insert into public.common_foods (name, search_name, source)
    values ('Hack', 'hack', 'example')$$,
  '42501',
  null,
  'nadie autenticado puede escribir en common_foods'
);

select is(
  (select count(*) from public.meals where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1' and protein_g = 1),
  0::bigint,
  'no puede editar la comida de la otra'
);

update public.meals
set protein_g = 1
where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1';

reset role;
select set_config('request.jwt.claim.sub', 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select protein_g from public.meals where id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'),
  30::numeric,
  'la comida de Coty sigue en 30 g después del intento ajeno'
);

select * from finish();
rollback;
