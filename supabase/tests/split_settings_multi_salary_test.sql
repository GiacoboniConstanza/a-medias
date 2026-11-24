begin;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1000001-0001-4001-8001-000000000001', 'split-coty@example.test', '{"display_name":"Coty"}'::jsonb),
  ('a1000002-0002-4002-8002-000000000002', 'split-maru@example.test', '{"display_name":"Maru"}'::jsonb);

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

-- Antes del corte: arrastre (noviembre 2026)
insert into public.base_salaries (user_id, amount, effective_from, label)
values
  ('a1000001-0001-4001-8001-000000000001', 500000, '2026-10-01', 'Oficina'),
  ('a1000002-0002-4002-8002-000000000002', 400000, '2026-10-01', 'Oficina');

select is(
  private.salary_at('a1000001-0001-4001-8001-000000000001', '2026-11-01'),
  500000::numeric,
  'antes del corte el sueldo se arrastra a noviembre'
);

-- Después del corte: sin arrastre
select is(
  private.salary_at('a1000001-0001-4001-8001-000000000001', '2026-12-01'),
  null::numeric,
  'desde diciembre no hay arrastre (null = sin sueldo del mes)'
);

-- Varios sueldos en diciembre suman (sin RLS: dueña de cada fila)
reset role;
insert into public.base_salaries (user_id, amount, effective_from, label)
values
  ('a1000001-0001-4001-8001-000000000001', 480000, '2026-12-01', 'Oficina'),
  ('a1000001-0001-4001-8001-000000000001', 120000, '2026-12-01', 'Clases'),
  ('a1000002-0002-4002-8002-000000000002', 400000, '2026-12-01', 'Oficina');

select is(
  private.salary_at('a1000001-0001-4001-8001-000000000001', '2026-12-01'),
  600000::numeric,
  'varios sueldos del mes se suman'
);

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select percent from public.household_split_percents('2026-12-01') where user_id = 'a1000001-0001-4001-8001-000000000001'),
  60,
  'proporcional 600/400 = 60'
);

-- Falta Maru en enero → 50/50 en modo proportional
reset role;
insert into public.base_salaries (user_id, amount, effective_from)
values ('a1000001-0001-4001-8001-000000000001', 600000, '2027-01-01');

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select percent from public.household_split_percents('2027-01-01') where user_id = 'a1000001-0001-4001-8001-000000000001'),
  50,
  'RS2: sin sueldo de Maru queda 50/50'
);
select ok(public.household_split_is_even('2027-01-01'), 'RS2: is_even true si falta sueldo');

-- Modo even fijo aunque ambas tengan sueldo
select lives_ok(
  $$select public.save_household_split_setting('even', null, '2027-02-01')$$,
  'guarda modo even'
);
reset role;
insert into public.base_salaries (user_id, amount, effective_from)
values
  ('a1000001-0001-4001-8001-000000000001', 900000, '2027-02-01'),
  ('a1000002-0002-4002-8002-000000000002', 100000, '2027-02-01');

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select percent from public.household_split_percents('2027-02-01') where user_id = 'a1000001-0001-4001-8001-000000000001'),
  50,
  'modo even ignora sueldos'
);

-- Modo manual 70/30
select lives_ok(
  $$select public.save_household_split_setting('manual', 70, '2027-03-01')$$,
  'guarda modo manual'
);
reset role;
insert into public.base_salaries (user_id, amount, effective_from)
values
  ('a1000001-0001-4001-8001-000000000001', 100000, '2027-03-01'),
  ('a1000002-0002-4002-8002-000000000002', 900000, '2027-03-01');

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select percent from public.household_split_percents('2027-03-01') where user_id = 'a1000001-0001-4001-8001-000000000001'),
  70,
  'manual 70 aunque sueldo sea menor'
);
select is(
  (select percent from public.household_split_percents('2027-03-01') where user_id = 'a1000002-0002-4002-8002-000000000002'),
  30,
  'manual resto 30'
);

-- Preferencia sigue al mes siguiente
select is(
  (select mode from public.household_split_setting('2027-04-01')),
  'manual',
  'la preferencia sigue hasta que la cambien'
);

-- Mes saldado: el cambio corre al mes siguiente
insert into public.settlements (
  household_id, month, amount, expected_amount, debtor_id, creditor_id, settled_by, settled_at
)
select p.household_id, '2027-05-01', 0, 0,
  'a1000001-0001-4001-8001-000000000001',
  'a1000002-0002-4002-8002-000000000002',
  'a1000001-0001-4001-8001-000000000001',
  now()
from public.profiles as p
where p.id = 'a1000001-0001-4001-8001-000000000001';

select is(
  (select effective_from from public.save_household_split_setting('proportional', null, '2027-05-01')),
  '2027-06-01'::date,
  'si el mes está saldado aplica al siguiente'
);

select is(
  (select mode from public.household_split_setting('2027-05-01')),
  'manual',
  'mayo saldado conserva el modo anterior'
);

select is(
  (select mode from public.household_split_setting('2027-06-01')),
  'proportional',
  'junio ya tiene el modo nuevo'
);

-- label opcional
select lives_ok(
  $$insert into public.base_salaries (user_id, amount, effective_from, label)
    values ('a1000001-0001-4001-8001-000000000001', 50000, '2027-06-01', '  ')$$,
  'label vacío se guarda como null'
);
select is(
  (
    select label from public.base_salaries
    where user_id = 'a1000001-0001-4001-8001-000000000001'
      and effective_from = '2027-06-01'
      and amount = 50000
  ),
  null,
  'label en blanco queda null'
);

select finish();
rollback;
