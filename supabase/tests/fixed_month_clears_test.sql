begin;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('c1000001-0001-4001-8001-000000000001', 'clear-coty@example.test', '{"display_name":"Coty"}'::jsonb),
  ('c1000002-0002-4002-8002-000000000002', 'clear-maru@example.test', '{"display_name":"Maru"}'::jsonb);

select set_config('request.jwt.claim.sub', 'c1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000001-0001-4001-8001-000000000001","role":"authenticated"}',
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
    where p.id = 'c1000001-0001-4001-8001-000000000001'
  ),
  true
);
select set_config('request.jwt.claim.sub', 'c1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok($$select public.join_household(current_setting('test.invite'))$$, 'Maru entra');
reset role;

-- Fijos: Luz compartida, Seguro privado Coty, Netflix privado Maru
insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'c2000001-0001-4001-8001-000000000001',
  p.household_id, null, null,
  'Luz', 'bolt', 'bolt', 10000, 15, true, true
from public.profiles as p where p.id = 'c1000001-0001-4001-8001-000000000001';

insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'c2000002-0002-4002-8002-000000000002',
  p.household_id, p.id, null,
  'Seguro', 'shield', 'shield', 20000, 10, false, true
from public.profiles as p where p.id = 'c1000001-0001-4001-8001-000000000001';

insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'c2000003-0003-4003-8003-000000000003',
  p.household_id, p.id, null,
  'Netflix', 'tv', 'tv', 8000, 5, false, true
from public.profiles as p where p.id = 'c1000002-0002-4002-8002-000000000002';

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values
  ('c2000001-0001-4001-8001-000000000001', 10000, '2026-10-01', 'c1000001-0001-4001-8001-000000000001'),
  ('c2000002-0002-4002-8002-000000000002', 20000, '2026-10-01', 'c1000001-0001-4001-8001-000000000001'),
  ('c2000003-0003-4003-8003-000000000003', 8000, '2026-10-01', 'c1000002-0002-4002-8002-000000000002');

-- Alquiler compartido ya pagado en noviembre
insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'c2000004-0004-4004-8004-000000000004',
  p.household_id, null, null,
  'Alquiler', 'house', 'house', 180000, 1, true, true
from public.profiles as p where p.id = 'c1000001-0001-4001-8001-000000000001';

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values ('c2000004-0004-4004-8004-000000000004', 180000, '2026-10-01', 'c1000001-0001-4001-8001-000000000001');

insert into public.fixed_payments (
  id, fixed_expense_id, month, paid_on, payer_id, amount, expense_id
)
values (
  'c4000001-0001-4001-8001-000000000001',
  'c2000004-0004-4004-8004-000000000004',
  '2026-11-01', '2026-11-01',
  'c1000001-0001-4001-8001-000000000001',
  180000, null
);

select is(
  private.fixed_amount_for_month('c2000001-0001-4001-8001-000000000001', '2026-11-01'),
  10000::numeric,
  'antes de vaciar hay monto arrastrado'
);

select set_config('request.jwt.claim.sub', 'c1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  public.clear_fixed_amounts_for_month('2026-11-01'),
  2,
  'vacía Luz y Seguro (no Netflix ajeno ni Alquiler pagado)'
);
reset role;

select is(
  private.fixed_amount_for_month('c2000001-0001-4001-8001-000000000001', '2026-11-01'),
  null,
  'noviembre sin monto para Luz'
);

select is(
  private.fixed_amount_for_month('c2000001-0001-4001-8001-000000000001', '2026-12-01'),
  10000::numeric,
  'diciembre sigue arrastrando el monto'
);

select is(
  private.fixed_amount_for_month('c2000003-0003-4003-8003-000000000003', '2026-11-01'),
  8000::numeric,
  'privado de Maru no se tocó'
);

select is(
  private.fixed_amount_for_month('c2000004-0004-4004-8004-000000000004', '2026-11-01'),
  180000::numeric,
  'pagado conserva monto'
);

-- Cargar monto quita la marca
reset role;
insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values ('c2000001-0001-4001-8001-000000000001', 12000, '2026-11-01', 'c1000001-0001-4001-8001-000000000001')
on conflict (fixed_expense_id, effective_from) do update set amount = excluded.amount;

select is(
  private.fixed_amount_for_month('c2000001-0001-4001-8001-000000000001', '2026-11-01'),
  12000::numeric,
  'cargar monto quita la marca del mes'
);

select is(
  (
    select count(*) from public.fixed_expense_month_clears
    where fixed_expense_id = 'c2000001-0001-4001-8001-000000000001'
      and month = '2026-11-01'
  ),
  0::bigint,
  'ya no queda clear de Luz en noviembre'
);

select finish();
rollback;
