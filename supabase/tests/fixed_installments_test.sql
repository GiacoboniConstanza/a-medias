begin;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1100001-0001-4001-8001-000000000001', 'cuotas-coty@example.test', '{"display_name":"Coty"}'::jsonb),
  ('a1100002-0002-4002-8002-000000000002', 'cuotas-maru@example.test', '{"display_name":"Maru"}'::jsonb);

select set_config('request.jwt.claim.sub', 'a1100001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1100001-0001-4001-8001-000000000001","role":"authenticated"}',
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
    where p.id = 'a1100001-0001-4001-8001-000000000001'
  ),
  true
);
select set_config('request.jwt.claim.sub', 'a1100002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1100002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok($$select public.join_household(current_setting('test.invite'))$$, 'Maru entra');
reset role;

-- Plan: 18 cuotas desde julio, cuota 212265.83, va por la 5 en noviembre
insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day,
  is_shared, remind, installment_count, first_month, total_amount
)
select
  'a2200001-0001-4001-8001-000000000001',
  p.household_id, p.id, null,
  'Cama', 'couch', 'couch', 212265.83, 20, false, true,
  18, '2026-07-01', 3820784.98
from public.profiles as p where p.id = 'a1100001-0001-4001-8001-000000000001';

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values (
  'a2200001-0001-4001-8001-000000000001',
  212265.83,
  '2026-07-01',
  'a1100001-0001-4001-8001-000000000001'
);

-- Fijo sin cuotas (no cambia)
insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'a2200002-0002-4002-8002-000000000002',
  p.household_id, null, null,
  'Luz', 'bolt', 'bolt', 10000, 15, true, true
from public.profiles as p where p.id = 'a1100001-0001-4001-8001-000000000001';

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values (
  'a2200002-0002-4002-8002-000000000002',
  10000,
  '2026-01-01',
  'a1100001-0001-4001-8001-000000000001'
);

-- Plazo / corte
select is(
  private.fixed_amount_for_month('a2200001-0001-4001-8001-000000000001', '2026-11-01'),
  212265.83::numeric,
  'cuota n/N: noviembre dentro de la ventana (5/18)'
);
select is(
  private.fixed_amount_for_month('a2200001-0001-4001-8001-000000000001', '2026-06-01'),
  null::numeric,
  'plazo: antes de la primera no hay monto'
);
select is(
  private.fixed_amount_for_month('a2200001-0001-4001-8001-000000000001', '2028-01-01'),
  null::numeric,
  'corte: después de la última no hay monto'
);
select is(
  private.fixed_amount_for_month('a2200002-0002-4002-8002-000000000002', '2026-11-01'),
  10000::numeric,
  'fijo sin cuotas sigue arrastrando'
);

-- Pagué el resto (impago): cierra en noviembre, monto = 14 × cuota
update public.fixed_expenses
set installment_closed_from = 18,
    installment_count = 5
where id = 'a2200001-0001-4001-8001-000000000001';

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values (
  'a2200001-0001-4001-8001-000000000001',
  2971721.62,
  '2026-11-01',
  'a1100001-0001-4001-8001-000000000001'
);

select is(
  private.fixed_amount_for_month('a2200001-0001-4001-8001-000000000001', '2026-11-01'),
  2971721.62::numeric,
  'Pagué el resto: monto del mes = restante'
);
select is(
  private.fixed_amount_for_month('a2200001-0001-4001-8001-000000000001', '2026-12-01'),
  null::numeric,
  'Pagué el resto: el plan no aparece el mes siguiente'
);

-- Deshacer el cierre: restaurar plazo
update public.fixed_expenses
set installment_count = installment_closed_from,
    installment_closed_from = null
where id = 'a2200001-0001-4001-8001-000000000001';

delete from public.fixed_expense_amounts
where fixed_expense_id = 'a2200001-0001-4001-8001-000000000001'
  and effective_from = '2026-11-01';

select is(
  private.fixed_amount_for_month('a2200001-0001-4001-8001-000000000001', '2026-12-01'),
  212265.83::numeric,
  'deshacer resto: vuelve el plazo y diciembre tiene cuota'
);

-- Privado: Maru no lo ve (RLS)
select set_config('request.jwt.claim.sub', 'a1100002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1100002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*)::integer from public.fixed_expenses where id = 'a2200001-0001-4001-8001-000000000001'),
  0,
  'privado: Maru no ve las cuotas de Coty'
);
reset role;

-- Compartido: entra al reparto al anotar el gasto
insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day,
  is_shared, remind, installment_count, first_month, total_amount
)
select
  'a2200003-0003-4003-8003-000000000003',
  p.household_id, null, null,
  'TV', 'tv', 'tv', 10000, 10, true, true,
  3, '2026-11-01', 30000
from public.profiles as p where p.id = 'a1100001-0001-4001-8001-000000000001';

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values (
  'a2200003-0003-4003-8003-000000000003',
  10000,
  '2026-11-01',
  'a1100001-0001-4001-8001-000000000001'
);

insert into public.base_salaries (user_id, amount, effective_from)
values
  ('a1100001-0001-4001-8001-000000000001', 600000, '2026-11-01'),
  ('a1100002-0002-4002-8002-000000000002', 400000, '2026-11-01');

select set_config('request.jwt.claim.sub', 'a1100001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1100001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared, notes
)
select
  'a3300001-0001-4001-8001-000000000001',
  p.household_id, p.id, p.id, null,
  'TV', 10000, '2026-11-10', '2026-11-01', true, null
from public.profiles as p where p.id = 'a1100001-0001-4001-8001-000000000001';

insert into public.fixed_payments (
  fixed_expense_id, month, paid_on, payer_id, amount, expense_id
)
values (
  'a2200003-0003-4003-8003-000000000003',
  '2026-11-01',
  '2026-11-10',
  'a1100001-0001-4001-8001-000000000001',
  10000,
  'a3300001-0001-4001-8001-000000000001'
);

select is(
  (select percent from public.household_split_percents('2026-11-01') where user_id = 'a1100001-0001-4001-8001-000000000001'),
  60,
  'compartido: el reparto del mes (60/40) rige la cuota'
);

-- Mes saldado: no se puede cargar un compartido
insert into public.settlements (
  household_id, month, amount, expected_amount, debtor_id, creditor_id, settled_by, settled_at
)
select p.household_id, '2026-11-01', 0, 0,
  'a1100001-0001-4001-8001-000000000001',
  'a1100002-0002-4002-8002-000000000002',
  'a1100001-0001-4001-8001-000000000001',
  now()
from public.profiles as p
where p.id = 'a1100001-0001-4001-8001-000000000001';

select throws_ok(
  $$insert into public.expenses (
      household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
    )
    select p.household_id, p.id, p.id, null, 'TV resto', 20000, '2026-11-15', '2026-11-01', true
    from public.profiles as p where p.id = 'a1100001-0001-4001-8001-000000000001'$$,
  'P0001',
  'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este gasto.',
  'mes saldado: cuota compartida no se anota'
);

-- Privado sí se puede en mes saldado
select lives_ok(
  $$insert into public.expenses (
      household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
    )
    select p.household_id, p.id, p.id, null, 'Cama', 212265.83, '2026-11-20', '2026-11-01', false
    from public.profiles as p where p.id = 'a1100001-0001-4001-8001-000000000001'$$,
  'mes saldado: cuota privada sí se anota'
);

select finish();
rollback;
