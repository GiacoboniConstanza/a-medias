begin;
select plan(4);

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

insert into public.meals (id, owner_id, eaten_on, meal_type, name, protein_g)
values (
  'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
  'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
  '2026-10-28',
  'almuerzo',
  'Pollo',
  38
);

insert into public.nutrition_goals (owner_id, protein_g)
values ('c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7', 100);

insert into public.saved_foods (id, owner_id, name, protein_g)
values (
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
  'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
  'Yogur',
  18
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
  (select count(*) from public.meals where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'),
  0::bigint,
  'la comida no la ve la otra'
);

select is(
  (select count(*) from public.nutrition_goals where owner_id = 'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7'),
  0::bigint,
  'los objetivos no los ve la otra'
);

select is(
  (select count(*) from public.saved_foods where id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2'),
  0::bigint,
  'las frecuentes no las ve la otra'
);

select throws_ok(
  $$insert into public.meals (owner_id, eaten_on, meal_type, name, protein_g)
    values ('c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7', '2026-10-28', 'cena', 'Ajena', 1)$$,
  '42501',
  'new row violates row-level security policy for table "meals"',
  'no puede anotar una comida a nombre de la otra'
);

select * from finish();
rollback;
