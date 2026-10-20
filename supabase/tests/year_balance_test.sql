begin;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'anio-a@example.com', '{"display_name":"Ana"}'::jsonb),
  ('b2222222-2222-4222-8222-222222222222', 'anio-b@example.com', '{"display_name":"Bel"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('c3333333-3333-4333-8333-333333333333', 'ANIO2026', 'a1111111-1111-4111-8111-111111111111');

update public.profiles
set household_id = 'c3333333-3333-4333-8333-333333333333'
where id in (
  'a1111111-1111-4111-8111-111111111111',
  'b2222222-2222-4222-8222-222222222222'
);

insert into public.categories (id, household_id, owner_id, name, emoji, icon) values
  ('d4444444-4444-4444-8444-444444444444', 'c3333333-3333-4333-8333-333333333333', null, 'Súper', '🛒', 'cart-shopping'),
  ('d5555555-5555-4555-8555-555555555555', 'c3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'Café', '☕', 'mug-hot'),
  ('d6666666-6666-4666-8666-666666666666', 'c3333333-3333-4333-8333-333333333333', 'b2222222-2222-4222-8222-222222222222', 'Secreto', '🔒', 'lock');

insert into public.base_salaries (user_id, amount, effective_from) values
  ('a1111111-1111-4111-8111-111111111111', 100000, '2024-06-01'),
  ('a1111111-1111-4111-8111-111111111111', 1500000, '2026-01-01'),
  ('a1111111-1111-4111-8111-111111111111', 1800000, '2026-07-01'),
  ('a1111111-1111-4111-8111-111111111111', 1021622, '2028-01-01'),
  ('b2222222-2222-4222-8222-222222222222', 1000000, '2026-01-01'),
  ('b2222222-2222-4222-8222-222222222222', 600000, '2028-01-01');

insert into public.savings_funds (id, user_id, name, emoji, icon, target_amount) values
  ('e7777777-7777-4777-8777-777777777777', 'a1111111-1111-4111-8111-111111111111', 'Lollapalooza', '🎵', 'music', 1200000),
  ('e7777777-7777-4777-8777-777777777778', 'b2222222-2222-4222-8222-222222222222', 'Curso ajeno', '📚', 'book', 200000);

insert into public.income_extras (id, user_id, household_id, amount, label, received_on) values
  ('e1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'c3333333-3333-4333-8333-333333333333', 450000, 'Incentivo', '2026-04-10'),
  ('e2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'c3333333-3333-4333-8333-333333333333', 80000, 'Guardia ajena', '2026-04-03');

insert into public.extra_allocations (extra_id, user_id, fund_id, amount) values
  ('e1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'e7777777-7777-4777-8777-777777777777', 300000),
  ('e1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', null, 150000),
  ('e2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'e7777777-7777-4777-8777-777777777778', 80000);

insert into public.expenses (
  household_id, owner_id, payer_id, category_id, title, amount, spent_on, is_shared, paid_from_bag
) values
  ('c3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'd4444444-4444-4444-8444-444444444444', 'Súper marzo', 100000, '2026-03-04', true, false),
  ('c3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'd5555555-5555-4555-8555-555555555555', 'Café', 20000, '2026-03-11', false, false),
  ('c3333333-3333-4333-8333-333333333333', 'b2222222-2222-4222-8222-222222222222', 'b2222222-2222-4222-8222-222222222222', 'd6666666-6666-4666-8666-666666666666', 'Farmacia ajena', 50000, '2026-03-13', false, false),
  ('c3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'd4444444-4444-4444-8444-444444444444', 'Súper julio', 100000, '2026-07-02', true, false),
  ('c3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'd4444444-4444-4444-8444-444444444444', 'Reparto parejo', 100, '2025-03-02', true, false),
  ('c3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'd4444444-4444-4444-8444-444444444444', 'Noviembre largo', 352000, '2028-03-02', true, false);

select set_config('app.bag_write', 'on', true);
insert into public.expenses (
  household_id, owner_id, payer_id, category_id, title, amount, spent_on, is_shared, paid_from_bag
) values (
  'c3333333-3333-4333-8333-333333333333',
  'a1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'd5555555-5555-4555-8555-555555555555',
  'Un gusto',
  40000,
  '2026-04-18',
  false,
  true
);
select set_config('app.bag_write', '', true);

insert into public.shared_goals (id, household_id, name, emoji, icon, target_amount)
values (
  'f9999999-9999-4999-8999-999999999999',
  'c3333333-3333-4333-8333-333333333333',
  'Vacaciones juntas',
  '🏖️',
  'umbrella-beach',
  1200000
);

insert into public.goal_contributions (goal_id, user_id, amount, mode) values
  ('f9999999-9999-4999-8999-999999999999', 'a1111111-1111-4111-8111-111111111111', 330000, 'free'),
  ('f9999999-9999-4999-8999-999999999999', 'b2222222-2222-4222-8222-222222222222', 210000, 'free');

insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, created_at
) values
  (
    'f8888888-8888-4888-8888-888888888888',
    'c3333333-3333-4333-8333-333333333333',
    null,
    'd4444444-4444-4444-8444-444444444444',
    'Alquiler',
    '🏠',
    'house',
    250000,
    5,
    true,
    timestamptz '2026-01-15 15:00:00+00'
  ),
  (
    'f8888888-8888-4888-8888-888888888889',
    'c3333333-3333-4333-8333-333333333333',
    'b2222222-2222-4222-8222-222222222222',
    'd6666666-6666-4666-8666-666666666666',
    'Osde ajena',
    '🩺',
    'stethoscope',
    45000,
    10,
    false,
    timestamptz '2026-01-15 15:00:00+00'
  );

insert into public.fixed_payments (fixed_expense_id, month, paid_on, payer_id, amount) values
  ('f8888888-8888-4888-8888-888888888888', '2026-01-01', '2026-01-05', 'a1111111-1111-4111-8111-111111111111', 250000),
  ('f8888888-8888-4888-8888-888888888888', '2026-02-01', '2026-02-04', 'a1111111-1111-4111-8111-111111111111', 250000),
  ('f8888888-8888-4888-8888-888888888888', '2026-03-01', '2026-03-05', 'a1111111-1111-4111-8111-111111111111', 250000),
  ('f8888888-8888-4888-8888-888888888888', '2026-04-01', '2026-04-20', 'a1111111-1111-4111-8111-111111111111', 250000),
  ('f8888888-8888-4888-8888-888888888889', '2026-01-01', '2026-01-02', 'b2222222-2222-4222-8222-222222222222', 45000);

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  'select public.year_balance(2026)',
  'P0001',
  'Tenés que iniciar sesión',
  'sin sesión no hay balance'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

create temp table balance_a (payload jsonb);
insert into balance_a
select private.year_balance(2026, date '2026-10-20');

create or replace function pg_temp.month_field(m integer, field text)
returns jsonb
language sql
as $$
  select item -> field
  from jsonb_array_elements((select payload from balance_a) -> 'months') as item
  where (item ->> 'month')::integer = m
$$;

select is(pg_temp.month_field(6, 'base')::text, '1500000', 'junio conserva el sueldo de enero');
select is(pg_temp.month_field(7, 'base')::text, '1800000', 'julio toma el aumento de mitad de año');
select is(pg_temp.month_field(12, 'base')::text, '1800000', 'diciembre sigue con el sueldo vigente');
select is(pg_temp.month_field(12, 'saved')::text, 'null', 'un mes que no llegó no finge ahorro');
select is(pg_temp.month_field(2, 'extras')::text, 'null', 'febrero sin extras queda vacío, no en cero');
select is(pg_temp.month_field(2, 'expenses')::text, 'null', 'febrero sin gastos queda vacío, no en cero');
select is(pg_temp.month_field(2, 'saved')::text, '1500000', 'febrero ahorra el sueldo vigente');
select is(pg_temp.month_field(3, 'expenses')::text, '80000', 'marzo suma privados y mi parte, no el gasto de la otra');
select is(pg_temp.month_field(7, 'expenses')::text, '64000', 'julio reparte con el porcentaje nuevo, igual que Inicio');
select is(pg_temp.month_field(4, 'expenses')::text, 'null', 'lo gastado desde la bolsa no entra en los gastos');

select is(
  (
    select (cat -> 'months' -> 2)::text
    from jsonb_array_elements((select payload from balance_a) -> 'categories') as cat
    where cat ->> 'name' = 'Súper'
  ),
  '60000',
  'la categoría compartida guarda solo mi parte de marzo'
);

select is(
  (
    select (cat -> 'months' -> 1)::text
    from jsonb_array_elements((select payload from balance_a) -> 'categories') as cat
    where cat ->> 'name' = 'Súper'
  ),
  'null',
  'un mes sin esa categoría no queda en cero'
);

select is(
  (
    select count(*)
    from jsonb_array_elements((select payload from balance_a) -> 'categories') as cat
    where cat ->> 'name' = 'Secreto'
  ),
  0::bigint,
  'no aparece la categoría privada de la otra'
);

select is(position('Guardia ajena' in (select payload::text from balance_a)), 0, 'no aparece el extra de la otra');
select is(position('1000000' in (select payload::text from balance_a)), 0, 'no aparece el sueldo de la otra');
select is(((select payload from balance_a) ->> 'gustos_spent'), '40000', 'los gustos salen de la bolsa');
select is(((select payload from balance_a) ->> 'extras_total'), '450000', 'suma solo mis extras');
select is(((select payload from balance_a) ->> 'extras_saved'), '300000', 'al ahorro fue lo que aparté a un fondo');
select is(((select payload from balance_a) -> 'goal' ->> 'mine'), '330000', 'la meta muestra solo mi aporte');
select is(((select payload from balance_a) -> 'goal' ->> 'total'), '540000', 'la meta muestra el progreso total');
select is(
  position('b2222222-2222-4222-8222-222222222222' in ((select payload from balance_a) -> 'goal')::text),
  0,
  'la meta no identifica el aporte de la otra'
);
select is(((select payload from balance_a) -> 'highlight' ->> 'fund_name'), 'Lollapalooza', 'el extra más grande fue al fondo propio');
select is(((select payload from balance_a) -> 'dues' ->> 'on_time'), '3', 'cuenta los vencimientos pagados a tiempo');
select is(((select payload from balance_a) -> 'dues' ->> 'expected'), '10', 'no cuenta el vencimiento privado de la otra');

select is(
  (
    select bool_and(
      item -> 'base' = 'null'::jsonb
      and item -> 'extras' = 'null'::jsonb
      and item -> 'expenses' = 'null'::jsonb
      and item -> 'saved' = 'null'::jsonb
    )
    from jsonb_array_elements(private.year_balance(2020, date '2026-10-20') -> 'months') as item
  ),
  true,
  'un año anterior a cualquier dato queda vacío'
);

select is(
  (
    select item ->> 'expenses'
    from jsonb_array_elements(private.year_balance(2025, date '2026-10-20') -> 'months') as item
    where (item ->> 'month')::integer = 3
  ),
  '50',
  'si a la otra le falta sueldo, el compartido se parte 50/50'
);

select is(
  (
    select item ->> 'expenses'
    from jsonb_array_elements(private.year_balance(2028, date '2026-10-20') -> 'months') as item
    where (item ->> 'month')::integer = 3
  ),
  '221760',
  'el aumento de sueldo cambia mi parte igual que en Inicio'
);

select set_config('request.jwt.claim.sub', 'b2222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);

select is(
  (
    select item ->> 'expenses'
    from jsonb_array_elements(private.year_balance(2026, date '2026-10-20') -> 'months') as item
    where (item ->> 'month')::integer = 3
  ),
  '90000',
  'la otra ve su parte y su privado, no el café ajeno'
);

select is(
  position('Café' in private.year_balance(2026, date '2026-10-20')::text),
  0,
  'la otra no ve mi categoría privada'
);

select ok(
  not has_function_privilege('anon', 'public.year_balance(integer)', 'execute'),
  'anon no puede pedir el balance'
);

select * from finish();
rollback;
