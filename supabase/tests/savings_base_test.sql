begin;
select plan(21);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('cafe0001-cafe-41ca-81fe-000000000001', 'sav-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('cafe0002-cafe-42ca-82fe-000000000002', 'sav-maru@example.com', '{"display_name":"Maru"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('cafe0000-cafe-40ca-80fe-000000000001', 'SAVINGS1', 'cafe0001-cafe-41ca-81fe-000000000001');

update public.profiles
set household_id = 'cafe0000-cafe-40ca-80fe-000000000001'
where id in (
  'cafe0001-cafe-41ca-81fe-000000000001',
  'cafe0002-cafe-42ca-82fe-000000000002'
);

-- Datos de prueba ya en el modelo unificado (sin tablas viejas).
insert into public.savings (
  id, household_id, name, emoji, icon, target_amount, target_date, is_shared, owner_id
) values
  (
    'cafe1001-cafe-41ca-81fe-000000000001',
    'cafe0000-cafe-40ca-80fe-000000000001',
    'Colchón',
    'couch',
    'couch',
    500000,
    null,
    false,
    'cafe0001-cafe-41ca-81fe-000000000001'
  ),
  (
    'cafe3001-cafe-41ca-81fe-000000000001',
    'cafe0000-cafe-40ca-80fe-000000000001',
    'Vacaciones',
    'umbrella-beach',
    'umbrella-beach',
    1200000,
    '2027-01-15',
    true,
    null
  ),
  (
    'cafe3002-cafe-42ca-82fe-000000000002',
    'cafe0000-cafe-40ca-80fe-000000000001',
    'Gustos',
    'bag-shopping',
    'bag-shopping',
    null,
    null,
    false,
    'cafe0001-cafe-41ca-81fe-000000000001'
  );

insert into public.saving_opening_balances (saving_id, user_id, amount) values
  ('cafe1001-cafe-41ca-81fe-000000000001', 'cafe0001-cafe-41ca-81fe-000000000001', 100),
  ('cafe3001-cafe-41ca-81fe-000000000001', 'cafe0001-cafe-41ca-81fe-000000000001', 200),
  ('cafe3001-cafe-41ca-81fe-000000000001', 'cafe0002-cafe-42ca-82fe-000000000002', 150),
  ('cafe3002-cafe-42ca-82fe-000000000002', 'cafe0001-cafe-41ca-81fe-000000000001', 50);

select is(
  (select amount from public.saving_opening_balances
    where saving_id = 'cafe1001-cafe-41ca-81fe-000000000001'
      and user_id = 'cafe0001-cafe-41ca-81fe-000000000001'),
  100::numeric,
  'saldo inicial del fondo'
);

select is(
  (select amount from public.saving_opening_balances
    where saving_id = 'cafe3001-cafe-41ca-81fe-000000000001'
      and user_id = 'cafe0001-cafe-41ca-81fe-000000000001'),
  200::numeric,
  'saldo inicial compartido Coty = suma de aportes'
);

select is(
  (select amount from public.saving_opening_balances
    where saving_id = 'cafe3001-cafe-41ca-81fe-000000000001'
      and user_id = 'cafe0002-cafe-42ca-82fe-000000000002'),
  150::numeric,
  'saldo inicial compartido Maru = suma de aportes'
);

select is(
  (select amount from public.saving_opening_balances
    where saving_id = 'cafe3002-cafe-42ca-82fe-000000000002'),
  50::numeric,
  'Gustos arranca con saldo libre'
);

select set_config('request.jwt.claim.sub', 'cafe0002-cafe-42ca-82fe-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cafe0002-cafe-42ca-82fe-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.savings where id = 'cafe1001-cafe-41ca-81fe-000000000001'),
  0::bigint,
  'Maru no ve el ahorro propio de Coty'
);

select is(
  (select count(*) from public.savings where id = 'cafe3001-cafe-41ca-81fe-000000000001'),
  1::bigint,
  'Maru sí ve el compartido'
);

select throws_ok(
  $$insert into public.saving_moves (
      saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'cafe3001-cafe-41ca-81fe-000000000001',
      'cafe0000-cafe-40ca-80fe-000000000001',
      'cafe0001-cafe-41ca-81fe-000000000001',
      'aporte',
      10,
      '2026-11-10',
      '2026-11-01'
    )$$,
  'P0001',
  'Solo podés anotar movimientos de ahorro a tu nombre',
  'no se puede cargar un movimiento a nombre de la otra'
);

select set_config('request.jwt.claim.sub', 'cafe0001-cafe-41ca-81fe-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cafe0001-cafe-41ca-81fe-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into public.saving_moves (
      saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'cafe1001-cafe-41ca-81fe-000000000001',
      'cafe0000-cafe-40ca-80fe-000000000001',
      'cafe0001-cafe-41ca-81fe-000000000001',
      'retiro',
      101,
      '2026-11-10',
      '2026-11-01'
    )$$,
  'P0001',
  'No te alcanza lo ahorrado',
  'no se puede retirar más que el saldo total'
);

select throws_ok(
  $$insert into public.saving_moves (
      saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'cafe3001-cafe-41ca-81fe-000000000001',
      'cafe0000-cafe-40ca-80fe-000000000001',
      'cafe0001-cafe-41ca-81fe-000000000001',
      'retiro',
      201,
      '2026-11-10',
      '2026-11-01'
    )$$,
  'P0001',
  'No te alcanza lo ahorrado',
  'en un compartido Coty no retira más que lo suyo'
);

select lives_ok(
  $$insert into public.saving_moves (
      id, saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'cafe4001-cafe-41ca-81fe-000000000001',
      'cafe3001-cafe-41ca-81fe-000000000001',
      'cafe0000-cafe-40ca-80fe-000000000001',
      'cafe0001-cafe-41ca-81fe-000000000001',
      'retiro',
      50,
      '2026-11-10',
      '2026-11-01'
    )$$,
  'Coty retira hasta lo suyo del compartido'
);

select lives_ok(
  $$insert into public.savings (
      id, household_id, name, emoji, icon, target_amount, is_shared, owner_id
    ) values (
      'cafe3003-cafe-43ca-83fe-000000000003',
      'cafe0000-cafe-40ca-80fe-000000000001',
      'Auto',
      'car',
      'car',
      null,
      true,
      null
    )$$,
  'se pueden tener varios compartidos activos'
);

select throws_ok(
  $$update public.savings
    set is_shared = false,
        owner_id = 'cafe0001-cafe-41ca-81fe-000000000001'
    where id = 'cafe3001-cafe-41ca-81fe-000000000001'$$,
  'P0001',
  'El alcance del ahorro no se puede cambiar. Creá otro.',
  'el alcance es inmutable'
);

select throws_ok(
  $$update public.savings
    set archived_at = now()
    where id = 'cafe1001-cafe-41ca-81fe-000000000001'$$,
  'P0001',
  'Solo se archiva un ahorro con saldo 0.',
  'no se archiva con saldo'
);

select lives_ok(
  $$insert into public.savings (
      id, household_id, name, emoji, icon, is_shared, owner_id
    ) values (
      'cafe5000-cafe-40ca-80fe-000000000000',
      'cafe0000-cafe-40ca-80fe-000000000001',
      'Vacío',
      'box',
      'box',
      false,
      'cafe0001-cafe-41ca-81fe-000000000001'
    )$$,
  'se crea un ahorro propio sin meta ni saldo'
);

select lives_ok(
  $$update public.savings
    set archived_at = now()
    where id = 'cafe5000-cafe-40ca-80fe-000000000000'$$,
  'se archiva con saldo 0'
);

select throws_ok(
  $$delete from public.savings where id = 'cafe5000-cafe-40ca-80fe-000000000000'$$,
  'P0001',
  'No se puede borrar un ahorro. Archiválo.',
  'no se puede borrar un ahorro'
);

-- Aporte + retiro: borrar el aporte dejaría el saldo en negativo.
select lives_ok(
  $$insert into public.saving_moves (
      id, saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'cafe4002-cafe-41ca-81fe-000000000001',
      'cafe1001-cafe-41ca-81fe-000000000001',
      'cafe0000-cafe-40ca-80fe-000000000001',
      'cafe0001-cafe-41ca-81fe-000000000001',
      'aporte',
      40,
      '2026-11-12',
      '2026-11-01'
    )$$,
  'Coty aporta al propio'
);

select lives_ok(
  $$insert into public.saving_moves (
      id, saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'cafe4003-cafe-41ca-81fe-000000000001',
      'cafe1001-cafe-41ca-81fe-000000000001',
      'cafe0000-cafe-40ca-80fe-000000000001',
      'cafe0001-cafe-41ca-81fe-000000000001',
      'retiro',
      120,
      '2026-11-13',
      '2026-11-01'
    )$$,
  'Coty retira usando el aporte'
);

select throws_ok(
  $$delete from public.saving_moves where id = 'cafe4002-cafe-41ca-81fe-000000000001'$$,
  'P0001',
  'Ese movimiento deja el saldo en negativo',
  'no se borra un aporte si el saldo quedaría negativo'
);

select set_config('request.jwt.claim.sub', 'cafe0002-cafe-42ca-82fe-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cafe0002-cafe-42ca-82fe-000000000002","role":"authenticated"}',
  true
);

update public.saving_moves
set amount = 10
where id = 'cafe4001-cafe-41ca-81fe-000000000001';

select is(
  (select amount from public.saving_moves where id = 'cafe4001-cafe-41ca-81fe-000000000001'),
  50::numeric,
  'Maru no edita el movimiento de Coty (RLS)'
);

delete from public.saving_moves where id = 'cafe4001-cafe-41ca-81fe-000000000001';

select is(
  (select count(*) from public.saving_moves where id = 'cafe4001-cafe-41ca-81fe-000000000001'),
  1::bigint,
  'Maru no borra el movimiento de Coty (RLS)'
);

select * from finish();
rollback;
