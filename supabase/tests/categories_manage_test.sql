begin;
select plan(18);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1000001-0001-4001-8001-000000000001', 'cat-coty@example.test', '{"display_name":"Coty"}'::jsonb),
  ('a1000002-0002-4002-8002-000000000002', 'cat-maru@example.test', '{"display_name":"Maru"}'::jsonb),
  ('a1000003-0003-4003-8003-000000000003', 'cat-otra@example.test', '{"display_name":"Otra"}'::jsonb);

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.create_household() is not null, 'Coty crea hogar');
reset role;

select set_config(
  'test.invite',
  (
    select h.invite_code from public.households as h
    join public.profiles as p on p.household_id = h.id
    where p.id = 'a1000001-0001-4001-8001-000000000001'
  ),
  true
);
select set_config('request.jwt.claim.sub', 'a1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok($$select public.join_household(current_setting('test.invite'))$$, 'Maru entra');
reset role;

select set_config('request.jwt.claim.sub', 'a1000003-0003-4003-8003-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000003-0003-4003-8003-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.create_household() is not null, 'Otra crea su hogar');
reset role;

select set_config(
  'test.hid',
  (
    select p.household_id::text from public.profiles as p
    where p.id = 'a1000001-0001-4001-8001-000000000001'
  ),
  true
);
select set_config(
  'test.super',
  (
    select c.id::text from public.categories as c
    where c.household_id = current_setting('test.hid')::uuid
      and c.name = 'Súper'
  ),
  true
);
select set_config(
  'test.comida',
  (
    select c.id::text from public.categories as c
    where c.household_id = current_setting('test.hid')::uuid
      and c.name = 'Comida'
  ),
  true
);

-- Otra casa no edita
select set_config('request.jwt.claim.sub', 'a1000003-0003-4003-8003-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000003-0003-4003-8003-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (
    select count(*) from public.categories
    where id = current_setting('test.super')::uuid
  ),
  0::bigint,
  'otra casa no ve categorías ajenas'
);
update public.categories
set name = 'Hack'
where id = current_setting('test.super')::uuid;
select is(
  (select name from public.categories where id = current_setting('test.super')::uuid),
  null,
  'otra casa no actualiza (0 filas)'
);
select throws_ok(
  $$select public.delete_category(current_setting('test.super')::uuid, null)$$,
  null,
  null,
  'otra casa no borra'
);
reset role;

-- Coty renombra
select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
update public.categories
set name = 'Mercado', icon = 'cart-shopping', emoji = 'cart-shopping'
where id = current_setting('test.super')::uuid;
select is(
  (select name from public.categories where id = current_setting('test.super')::uuid),
  'Mercado',
  'miembro renombra categoría'
);

select throws_ok(
  $$update public.categories set name = 'Comida' where id = current_setting('test.super')::uuid$$,
  null,
  null,
  'nombre duplicado (case-insensitive) se rechaza'
);
reset role;

-- Gasto privado de Coty + compartido
insert into public.expenses (
  household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
values
  (
    current_setting('test.hid')::uuid,
    'a1000001-0001-4001-8001-000000000001',
    'a1000001-0001-4001-8001-000000000001',
    current_setting('test.super')::uuid,
    'Privado Coty',
    1000,
    current_date,
    date_trunc('month', current_date)::date,
    false
  ),
  (
    current_setting('test.hid')::uuid,
    'a1000001-0001-4001-8001-000000000001',
    'a1000001-0001-4001-8001-000000000001',
    current_setting('test.super')::uuid,
    'Compartido',
    2000,
    current_date,
    date_trunc('month', current_date)::date,
    true
  );

-- Maru no ve el conteo del privado de Coty
select set_config('request.jwt.claim.sub', 'a1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (
    select uses from public.category_usage()
    where category_id = current_setting('test.super')::uuid
  ),
  1::bigint,
  'Maru solo cuenta el compartido, no el privado de Coty'
);
select ok(
  (
    select has_links from public.category_usage()
    where category_id = current_setting('test.super')::uuid
  ),
  'has_links true si hay gastos'
);
reset role;

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (
    select uses from public.category_usage()
    where category_id = current_setting('test.super')::uuid
  ),
  2::bigint,
  'Coty ve compartido + su privado'
);

-- Fijo con categoría (E9 / E14)
insert into public.fixed_expenses (
  household_id, owner_id, category_id, title, icon, emoji, expected_amount, due_day, is_shared
)
values (
  current_setting('test.hid')::uuid,
  null,
  current_setting('test.super')::uuid,
  'Alquiler',
  'house',
  'house',
  100000,
  5,
  true
);

-- Mover y borrar
select lives_ok(
  $$select public.delete_category(current_setting('test.super')::uuid, current_setting('test.comida')::uuid)$$,
  'borra moviendo gastos a Comida'
);
select is(
  (
    select count(*) from public.expenses
    where category_id = current_setting('test.comida')::uuid
  ),
  2::bigint,
  'los gastos pasaron a Comida'
);
select is(
  (
    select count(*) from public.fixed_expenses
    where category_id = current_setting('test.comida')::uuid
      and title = 'Alquiler'
  ),
  1::bigint,
  'el fijo pasó a Comida'
);
select is(
  (
    select count(*) from public.categories
    where id = current_setting('test.super')::uuid
  ),
  0::bigint,
  'Mercado quedó borrada'
);
reset role;

-- Última categoría
reset role;
delete from public.expenses where household_id = current_setting('test.hid')::uuid;
delete from public.fixed_expenses where household_id = current_setting('test.hid')::uuid;
delete from public.categories
where household_id = current_setting('test.hid')::uuid
  and name <> 'Hogar';

select set_config(
  'test.hogar',
  (
    select c.id::text from public.categories as c
    where c.household_id = current_setting('test.hid')::uuid
      and c.name = 'Hogar'
  ),
  true
);

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.delete_category(current_setting('test.hogar')::uuid, null)$$,
  null,
  null,
  'no se borra la última categoría'
);
reset role;

-- Guard: mes saldado permite solo category_id
reset role;
insert into public.categories (household_id, name, emoji, icon)
values
  (current_setting('test.hid')::uuid, 'Extra', 'tag', 'tag'),
  (current_setting('test.hid')::uuid, 'Destino', 'house', 'house');

select set_config(
  'test.extra',
  (select c.id::text from public.categories as c where c.household_id = current_setting('test.hid')::uuid and c.name = 'Extra'),
  true
);
select set_config(
  'test.destino',
  (select c.id::text from public.categories as c where c.household_id = current_setting('test.hid')::uuid and c.name = 'Destino'),
  true
);

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
values (
  'a3000001-0001-4001-8001-000000000001',
  current_setting('test.hid')::uuid,
  'a1000001-0001-4001-8001-000000000001',
  'a1000001-0001-4001-8001-000000000001',
  current_setting('test.extra')::uuid,
  'Saldado',
  5000,
  '2026-10-05',
  '2026-10-01',
  true
);

insert into public.settlements (household_id, month, amount, debtor_id, creditor_id, settled_by)
values (
  current_setting('test.hid')::uuid,
  '2026-10-01',
  2500,
  'a1000001-0001-4001-8001-000000000001',
  'a1000002-0002-4002-8002-000000000002',
  'a1000001-0001-4001-8001-000000000001'
);

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.expenses
    set category_id = current_setting('test.destino')::uuid
    where id = 'a3000001-0001-4001-8001-000000000001'$$,
  'mes saldado permite cambiar solo categoría'
);

select throws_ok(
  $$update public.expenses
    set amount = 1
    where id = 'a3000001-0001-4001-8001-000000000001'$$,
  null,
  null,
  'mes saldado bloquea cambiar monto'
);
reset role;

select finish();
rollback;
