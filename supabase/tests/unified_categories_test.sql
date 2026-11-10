begin;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-aaaa-4111-8111-111111111111', 'cat-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('22222222-bbbb-4222-8222-222222222222', 'cat-maru@example.com', '{"display_name":"Maru"}'::jsonb),
  ('33333333-cccc-4333-8333-333333333333', 'cat-otra@example.com', '{"display_name":"Otra"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'CATHOUSE', '11111111-aaaa-4111-8111-111111111111'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'OTRAHOME', '33333333-cccc-4333-8333-333333333333');

update public.profiles
set household_id = 'aaaaaaaa-0000-4000-8000-000000000001'
where id in (
  '11111111-aaaa-4111-8111-111111111111',
  '22222222-bbbb-4222-8222-222222222222'
);

update public.profiles
set household_id = 'bbbbbbbb-0000-4000-8000-000000000002'
where id = '33333333-cccc-4333-8333-333333333333';

insert into public.categories (id, household_id, name, emoji, icon, created_at) values
  ('c1111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'Comida', '🍕', 'pizza-slice', timestamptz '2026-01-01'),
  ('c2222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-000000000001', 'Súper', '🛒', 'cart-shopping', timestamptz '2026-01-01'),
  ('c5555555-5555-4555-8555-555555555555', 'aaaaaaaa-0000-4000-8000-000000000001', 'Gatos', '🐱', 'cat', timestamptz '2026-01-01'),
  ('c3333333-3333-4333-8333-333333333333', 'bbbbbbbb-0000-4000-8000-000000000002', 'Comida', '🍕', 'pizza-slice', timestamptz '2026-01-01');

-- Duplicados artificiales (como las privadas de Production) para probar la fusión.
-- El repunte dispara expenses_validate / fixed_expenses_validate.
drop index public.categories_household_name_idx;
insert into public.categories (id, household_id, name, emoji, icon, created_at) values
  ('c4444444-4444-4444-8444-444444444444', 'aaaaaaaa-0000-4000-8000-000000000001', 'comida', '🍕', 'pizza-slice', timestamptz '2026-02-01'),
  ('c6666666-6666-4666-8666-666666666666', 'aaaaaaaa-0000-4000-8000-000000000001', 'gatos', '🐱', 'cat', timestamptz '2026-02-01');

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
) values
  (
    'e1111111-1111-4111-8111-111111111111',
    'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-aaaa-4111-8111-111111111111',
    '11111111-aaaa-4111-8111-111111111111',
    'c4444444-4444-4444-8444-444444444444',
    'Almuerzo',
    1000,
    '2026-11-02',
    '2026-11-01',
    false
  ),
  (
    'e2222222-2222-4222-8222-222222222222',
    'aaaaaaaa-0000-4000-8000-000000000001',
    '22222222-bbbb-4222-8222-222222222222',
    '22222222-bbbb-4222-8222-222222222222',
    'c6666666-6666-4666-8666-666666666666',
    'Comida gatos',
    2500,
    '2026-11-03',
    '2026-11-01',
    false
  ),
  (
    'e3333333-3333-4333-8333-333333333333',
    'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-aaaa-4111-8111-111111111111',
    '11111111-aaaa-4111-8111-111111111111',
    'c1111111-1111-4111-8111-111111111111',
    'Delivery compartido',
    8000,
    '2026-11-04',
    '2026-11-01',
    true
  );

insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared
) values (
  'f1111111-1111-4111-8111-111111111111',
  'aaaaaaaa-0000-4000-8000-000000000001',
  null,
  'c4444444-4444-4444-8444-444444444444',
  'Delivery fijo',
  '🍕',
  'pizza-slice',
  5000,
  5,
  true
);

select lives_ok(
  $$select private.merge_duplicate_categories()$$,
  'la fusión repunta gastos y fijos sin que el trigger validador la rechace'
);

create unique index categories_household_name_idx
  on public.categories (household_id, lower(btrim(name)));

select is(
  (select category_id from public.expenses where id = 'e1111111-1111-4111-8111-111111111111'),
  'c1111111-1111-4111-8111-111111111111'::uuid,
  'el gasto privado de Coty pasa a la Comida conservada'
);

select is(
  (select category_id from public.expenses where id = 'e2222222-2222-4222-8222-222222222222'),
  'c5555555-5555-4555-8555-555555555555'::uuid,
  'el gasto privado de Maru pasa a los Gatos conservados'
);

select is(
  (select category_id from public.expenses where id = 'e3333333-3333-4333-8333-333333333333'),
  'c1111111-1111-4111-8111-111111111111'::uuid,
  'el compartido que ya apuntaba a la conservada no se mueve'
);

select is(
  (select category_id from public.fixed_expenses where id = 'f1111111-1111-4111-8111-111111111111'),
  'c1111111-1111-4111-8111-111111111111'::uuid,
  'la fusión repunta el fijo a la categoría conservada'
);

select is(
  (select count(*) from public.categories where household_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  3::bigint,
  'no quedan categorías duplicadas en el hogar'
);

select is(
  (select count(*) from public.categories where id in (
    'c4444444-4444-4444-8444-444444444444',
    'c6666666-6666-4666-8666-666666666666'
  )),
  0::bigint,
  'las categorías duplicadas se borraron'
);

select set_config('request.jwt.claim.sub', '11111111-aaaa-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-aaaa-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.categories),
  3::bigint,
  'Coty ve todas las categorías del hogar'
);

select set_config('request.jwt.claim.sub', '22222222-bbbb-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-bbbb-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.categories),
  3::bigint,
  'Maru ve las mismas categorías del hogar'
);

select throws_ok(
  $$insert into public.categories (household_id, name, emoji, icon)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'COMIDA', '🍕', 'pizza-slice')$$,
  '23505',
  null,
  'el índice único rechaza duplicados sin importar mayúsculas'
);

select throws_ok(
  $$insert into public.categories (household_id, name, emoji, icon)
    values ('aaaaaaaa-0000-4000-8000-000000000001', '  Comida  ', '🍕', 'pizza-slice')$$,
  '23505',
  null,
  'el índice único también recorta espacios'
);

select lives_ok(
  $$insert into public.categories (household_id, name, emoji, icon)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'Salidas', '🎉', 'champagne-glasses')$$,
  'se puede crear una categoría nueva del hogar'
);

select set_config('request.jwt.claim.sub', '33333333-cccc-4333-8333-333333333333', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-cccc-4333-8333-333333333333","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.categories),
  1::bigint,
  'otro hogar no ve las categorías ajenas'
);

select is(
  (select name from public.categories),
  'Comida',
  'otro hogar solo ve la propia'
);

reset role;

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'categories_household_name_idx'
  ),
  'existe el índice único por hogar y nombre'
);

select hasnt_column('public', 'categories', 'owner_id', 'owner_id quedó fuera de categories');

select * from finish();
rollback;
