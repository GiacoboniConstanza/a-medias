begin;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'del-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2', 'del-maru@example.com', '{"display_name":"Maru"}'::jsonb);

select set_config('request.jwt.claim.sub', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(public.create_household() is not null, 'coty crea el hogar');

reset role;
select set_config(
  'test.invite',
  (
    select h.invite_code
    from public.households as h
    join public.profiles as p on p.household_id = h.id
    where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'
  ),
  true
);
select set_config('request.jwt.claim.sub', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.join_household(current_setting('test.invite')) is not null, 'maru entra al hogar');

reset role;
select set_config('request.jwt.claim.sub', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
select
  'd4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4',
  p.household_id,
  p.id,
  p.id,
  c.id,
  'Verdura',
  1000,
  '2026-11-05',
  '2026-11-01',
  true
from public.profiles as p
join public.categories as c on c.household_id = p.household_id
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'
order by c.name
limit 1;

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
select
  'd5d5d5d5-d5d5-45d5-85d5-d5d5d5d5d5d5',
  p.household_id,
  p.id,
  p.id,
  e.category_id,
  'Café',
  500,
  '2026-11-06',
  '2026-11-01',
  false
from public.profiles as p
join public.expenses as e on e.id = 'd4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4'
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

insert into public.income_extras (id, user_id, household_id, amount, label, received_on)
select
  'd6d6d6d6-d6d6-46d6-86d6-d6d6d6d6d6d6',
  p.id,
  p.household_id,
  2000,
  'Estudio',
  '2026-11-04'
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

insert into public.transfers (id, from_id, to_id, amount, transferred_on, period)
values (
  'd7d7d7d7-d7d7-47d7-87d7-d7d7d7d7d7d7',
  'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
  3000,
  '2026-11-03',
  '2026-11-01'
);

-- Transferencia que cargó Maru (como recibida anotada por ella).
reset role;
select set_config('request.jwt.claim.sub', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.transfers (id, from_id, to_id, amount, transferred_on, period)
values (
  'd8d8d8d8-d8d8-48d8-88d8-d8d8d8d8d8d8',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
  'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
  1500,
  '2026-11-07',
  '2026-11-01'
);

reset role;
select set_config('request.jwt.claim.sub', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.savings (id, household_id, name, emoji, icon, target_amount, is_shared, owner_id)
select
  'd9d9d9d9-d9d9-49d9-89d9-d9d9d9d9d9d9',
  p.household_id,
  'Vacaciones',
  'umbrella-beach',
  'umbrella-beach',
  100000,
  true,
  null
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

insert into public.saving_moves (
  id, saving_id, household_id, user_id, kind, amount, spent_on, period
)
select
  'dada0001-dada-4ada-8ada-dada00000001',
  'd9d9d9d9-d9d9-49d9-89d9-d9d9d9d9d9d9',
  p.household_id,
  p.id,
  'aporte',
  20000,
  '2026-11-10',
  '2026-11-01'
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

insert into public.saving_moves (
  id, saving_id, household_id, user_id, kind, amount, spent_on, period
)
select
  'dada0002-dada-4ada-8ada-dada00000002',
  'd9d9d9d9-d9d9-49d9-89d9-d9d9d9d9d9d9',
  p.household_id,
  p.id,
  'retiro',
  15000,
  '2026-11-11',
  '2026-11-01'
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

-- Ahorro archivado (saldo 0) con un movimiento previo ya no: crear, vaciar y archivar aparte.
insert into public.savings (id, household_id, name, emoji, icon, target_amount, is_shared, owner_id)
select
  'dada0003-dada-4ada-8ada-dada00000003',
  p.household_id,
  'Archivado',
  'box-archive',
  'box-archive',
  null,
  false,
  p.id
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

insert into public.saving_moves (
  id, saving_id, household_id, user_id, kind, amount, spent_on, period
)
select
  'dada0004-dada-4ada-8ada-dada00000004',
  'dada0003-dada-4ada-8ada-dada00000003',
  p.household_id,
  p.id,
  'aporte',
  10,
  '2026-10-01',
  '2026-10-01'
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

insert into public.saving_moves (
  id, saving_id, household_id, user_id, kind, amount, spent_on, period
)
select
  'dada0005-dada-4ada-8ada-dada00000005',
  'dada0003-dada-4ada-8ada-dada00000003',
  p.household_id,
  p.id,
  'retiro',
  10,
  '2026-10-02',
  '2026-10-01'
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

-- Saldo 0: se puede archivar. El aporte queda en el historial.
update public.savings
set archived_at = now()
where id = 'dada0003-dada-4ada-8ada-dada00000003';

-- Pago de gasto fijo + expense.
insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared
)
select
  'dada0006-dada-4ada-8ada-dada00000006',
  p.household_id,
  null,
  e.category_id,
  'Internet',
  'wifi',
  'wifi',
  8000,
  10,
  true
from public.profiles as p
join public.expenses as e on e.id = 'd4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4'
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
select
  'dada0007-dada-4ada-8ada-dada00000007',
  p.household_id,
  p.id,
  p.id,
  e.category_id,
  'Internet',
  8000,
  '2026-11-10',
  '2026-11-01',
  true
from public.profiles as p
join public.expenses as e on e.id = 'd4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4'
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

insert into public.fixed_payments (
  id, fixed_expense_id, month, paid_on, payer_id, amount, expense_id
)
values (
  'dada0008-dada-4ada-8ada-dada00000008',
  'dada0006-dada-4ada-8ada-dada00000006',
  '2026-11-01',
  '2026-11-10',
  'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
  8000,
  'dada0007-dada-4ada-8ada-dada00000007'
);

-- 1) Todo o nada: mezcla con transferencia de Maru → no borra nada.
select throws_ok(
  $$select public.delete_movements(
    '2026-11-01',
    array['d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4']::uuid[],
    '{}'::uuid[],
    array['d8d8d8d8-d8d8-48d8-88d8-d8d8d8d8d8d8']::uuid[],
    '{}'::uuid[]
  )$$,
  'P0001',
  'Solo quien la cargó puede borrar la transferencia',
  'rechaza transferencia de Maru y no borra el lote'
);

select is(
  (select count(*)::integer from public.expenses where id = 'd4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4'),
  1,
  'todo o nada: el gasto sigue ahí'
);

-- 2) Borrado feliz de gasto propio + ingreso + transferencia propia.
select is(
  (
    select (public.delete_movements(
      '2026-11-01',
      array['d5d5d5d5-d5d5-45d5-85d5-d5d5d5d5d5d5']::uuid[],
      array['d6d6d6d6-d6d6-46d6-86d6-d6d6d6d6d6d6']::uuid[],
      array['d7d7d7d7-d7d7-47d7-87d7-d7d7d7d7d7d7']::uuid[],
      '{}'::uuid[]
    ) ->> 'deleted')::integer
  ),
  3,
  'borra gasto, ingreso y transferencia propios'
);

select is(
  (
    select count(*)::integer
    from public.expenses
    where id = 'd5d5d5d5-d5d5-45d5-85d5-d5d5d5d5d5d5'
  ),
  0,
  'el gasto propio ya no está'
);

-- 3) Coty puede borrar un compartido que cargó Maru.
reset role;
select set_config('request.jwt.claim.sub', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
select
  'dada0009-dada-4ada-8ada-dada00000009',
  p.household_id,
  p.id,
  p.id,
  c.id,
  'Delivery Maru',
  4200,
  '2026-11-08',
  '2026-11-01',
  true
from public.profiles as p
join public.categories as c on c.household_id = p.household_id
where p.id = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2'
order by c.name
limit 1;

reset role;
select set_config('request.jwt.claim.sub', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select (public.delete_movements(
      '2026-11-01',
      array['dada0009-dada-4ada-8ada-dada00000009']::uuid[],
      '{}'::uuid[],
      '{}'::uuid[],
      '{}'::uuid[]
    ) ->> 'deleted')::integer
  ),
  1,
  'coty borra un compartido que cargó maru'
);

-- 4) Mes saldado rechaza el lote.
insert into public.settlements (household_id, month, debtor_id, creditor_id, amount, settled_by)
select
  p.household_id,
  '2026-11-01',
  'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
  'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
  10,
  p.id
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

select throws_ok(
  $$select public.delete_movements(
    '2026-11-01',
    array['d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4']::uuid[],
    '{}'::uuid[],
    '{}'::uuid[],
    '{}'::uuid[]
  )$$,
  'P0001',
  'Ese mes está saldado. Deshacé el saldo en Resumen para eliminar varios.',
  'mes saldado rechaza el lote'
);

delete from public.settlements
where month = '2026-11-01'
  and household_id = (
    select household_id from public.profiles where id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1'
  );

-- 5) Aporte solo (deja negativo) rechazado; aporte+retiro ok.
select throws_ok(
  $$select public.delete_movements(
    '2026-11-01',
    '{}'::uuid[],
    '{}'::uuid[],
    '{}'::uuid[],
    array['dada0001-dada-4ada-8ada-dada00000001']::uuid[]
  )$$,
  'P0001',
  'Ese movimiento deja el saldo en negativo',
  'aporte solo que deja negativo se rechaza'
);

select is(
  (
    select (public.delete_movements(
      '2026-11-01',
      '{}'::uuid[],
      '{}'::uuid[],
      '{}'::uuid[],
      array[
        'dada0002-dada-4ada-8ada-dada00000002',
        'dada0001-dada-4ada-8ada-dada00000001'
      ]::uuid[]
    ) ->> 'deleted')::integer
  ),
  2,
  'borra retiro y aporte juntos sin dejar negativo'
);

-- 6) Archivado rechazado.
select throws_ok(
  $$select public.delete_movements(
    '2026-10-01',
    '{}'::uuid[],
    '{}'::uuid[],
    '{}'::uuid[],
    array['dada0004-dada-4ada-8ada-dada00000004']::uuid[]
  )$$,
  'P0001',
  'El ahorro está archivado.',
  'no borra movimientos de ahorro archivado'
);

-- 7) Pago de gasto fijo rechazado.
select throws_ok(
  $$select public.delete_movements(
    '2026-11-01',
    array['dada0007-dada-4ada-8ada-dada00000007']::uuid[],
    '{}'::uuid[],
    '{}'::uuid[],
    '{}'::uuid[]
  )$$,
  'P0001',
  'Es el pago de un gasto fijo: se deshace en Avisos.',
  'rechaza pago de gasto fijo'
);

select is(
  (select count(*)::integer from public.expenses where id = 'dada0007-dada-4ada-8ada-dada00000007'),
  1,
  'el gasto del fijo sigue'
);

-- 8) RLS: Maru no borra el ingreso de Coty.
reset role;
select set_config('request.jwt.claim.sub', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.income_extras (id, user_id, household_id, amount, label, received_on)
select
  'dada0010-dada-4ada-8ada-dada00000010',
  p.id,
  p.household_id,
  900,
  'Ajeno',
  '2026-11-09'
from public.profiles as p
where p.id = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

reset role;
select set_config('request.jwt.claim.sub', 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.delete_movements(
    '2026-11-01',
    '{}'::uuid[],
    array['dada0010-dada-4ada-8ada-dada00000010']::uuid[],
    '{}'::uuid[],
    '{}'::uuid[]
  )$$,
  'P0001',
  'No pude eliminar un ingreso',
  'maru no borra el ingreso de coty (RLS)'
);

select * from finish();
rollback;
