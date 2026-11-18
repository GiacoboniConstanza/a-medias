begin;
select plan(21);

-- Coty + Maru
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'b1000001-0001-4001-8001-000000000001',
    'budget-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'b1000002-0002-4002-8002-000000000002',
    'budget-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  );

select set_config('request.jwt.claim.sub', 'b1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.create_household() is not null, 'Coty crea hogar');

insert into public.reminder_preferences (
  user_id, enabled, first_time, second_time, ask_times, due_lead_days,
  silence_enabled, budget_enabled, push_enabled
) values (
  'b1000001-0001-4001-8001-000000000001',
  false, '14:00', '21:30', array['14:00']::time[],
  2, true, true, true
);
insert into public.module_notification_prefs (user_id, module, enabled)
values ('b1000001-0001-4001-8001-000000000001', 'finanzas', true);

-- Categoría Súper (del hogar) + sueldos 60/40
select set_config(
  'test.cat_super',
  (
    select c.id::text
    from public.categories as c
    join public.profiles as p on p.household_id = c.household_id
    where p.id = 'b1000001-0001-4001-8001-000000000001'
      and c.name = 'Súper'
    limit 1
  ),
  true
);

insert into public.base_salaries (user_id, amount, effective_from)
values
  ('b1000001-0001-4001-8001-000000000001', 900000, '2026-10-01');

-- Tope de Coty
insert into public.category_budgets (user_id, category_id, amount, effective_from)
values (
  'b1000001-0001-4001-8001-000000000001',
  current_setting('test.cat_super')::uuid,
  20000,
  '2026-11-01'
);
reset role;

-- Maru entra
select set_config(
  'test.invite',
  (
    select h.invite_code from public.households as h
    join public.profiles as p on p.household_id = h.id
    where p.id = 'b1000001-0001-4001-8001-000000000001'
  ),
  true
);
select set_config('request.jwt.claim.sub', 'b1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok($$select public.join_household(current_setting('test.invite'))$$, 'Maru entra');

insert into public.reminder_preferences (
  user_id, enabled, first_time, second_time, ask_times, budget_enabled, push_enabled
) values (
  'b1000002-0002-4002-8002-000000000002',
  true, '14:00', '21:30', array['14:00']::time[], true, true
);
insert into public.module_notification_prefs (user_id, module, enabled)
values ('b1000002-0002-4002-8002-000000000002', 'finanzas', true);

insert into public.base_salaries (user_id, amount, effective_from)
values ('b1000002-0002-4002-8002-000000000002', 600000, '2026-10-01');

-- Maru no ve topes de Coty
select is(
  (select count(*) from public.category_budgets),
  0::bigint,
  'RLS: Maru no ve topes de Coty'
);

select throws_ok(
  format(
    $sql$insert into public.category_budgets (user_id, category_id, amount, effective_from)
      values (
        'b1000001-0001-4001-8001-000000000001',
        %L::uuid,
        1000,
        '2026-12-01'
      )$sql$,
    current_setting('test.cat_super')
  ),
  '42501',
  null,
  'RLS: Maru no escribe topes de Coty'
);
reset role;

-- Coty lee el suyo
select set_config('request.jwt.claim.sub', 'b1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.category_budgets),
  1::bigint,
  'RLS: Coty lee sus topes'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

-- Gasto compartido 30000 pagado por Maru → parte Coty 60% = 18000
insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount,
  spent_on, period, is_shared
)
select
  'b4000001-0001-4001-8001-000000000001',
  p.household_id,
  'b1000002-0002-4002-8002-000000000002',
  'b1000002-0002-4002-8002-000000000002',
  current_setting('test.cat_super')::uuid,
  'Súper',
  30000,
  '2026-11-10',
  '2026-11-01',
  true
from public.profiles as p where p.id = 'b1000001-0001-4001-8001-000000000001';

select is(
  private.budget_spent_for(
    'b1000001-0001-4001-8001-000000000001',
    (select household_id from public.profiles where id = 'b1000001-0001-4001-8001-000000000001'),
    current_setting('test.cat_super')::uuid,
    '2026-11-01'
  ),
  18000::numeric,
  'cálculo: parte compartida = monto × % (no sharedPaid)'
);

-- effective_from: tope octubre distinto; noviembre conserva el suyo al subir
insert into public.category_budgets (user_id, category_id, amount, effective_from)
values (
  'b1000001-0001-4001-8001-000000000001',
  current_setting('test.cat_super')::uuid,
  15000,
  '2026-10-01'
);
select is(
  private.budget_cap_for(
    'b1000001-0001-4001-8001-000000000001',
    current_setting('test.cat_super')::uuid,
    '2026-10-01'
  ),
  15000::numeric,
  'effective_from: octubre usa tope de octubre'
);
select is(
  private.budget_cap_for(
    'b1000001-0001-4001-8001-000000000001',
    current_setting('test.cat_super')::uuid,
    '2026-11-01'
  ),
  20000::numeric,
  'effective_from: noviembre conserva tope de noviembre'
);

-- Borrar = amount null desde diciembre
insert into public.category_budgets (user_id, category_id, amount, effective_from)
values (
  'b1000001-0001-4001-8001-000000000001',
  current_setting('test.cat_super')::uuid,
  null,
  '2026-12-01'
);
select is(
  private.budget_cap_for(
    'b1000001-0001-4001-8001-000000000001',
    current_setting('test.cat_super')::uuid,
    '2026-12-01'
  ) is null,
  true,
  'borrar: amount null quita el tope desde ese mes'
);
select is(
  private.budget_cap_for(
    'b1000001-0001-4001-8001-000000000001',
    current_setting('test.cat_super')::uuid,
    '2026-11-01'
  ),
  20000::numeric,
  'borrar: meses pasados conservan el tope'
);

-- Push: subir gasto a cruzar 100 % (tope 20000, ya 18000 → + privado 5000 = 23000)
insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount,
  spent_on, period, is_shared
)
select
  'b4000002-0002-4002-8002-000000000002',
  p.household_id,
  'b1000001-0001-4001-8001-000000000001',
  'b1000001-0001-4001-8001-000000000001',
  current_setting('test.cat_super')::uuid,
  'Nafta súper',
  5000,
  '2026-11-12',
  '2026-11-01',
  false
from public.profiles as p where p.id = 'b1000001-0001-4001-8001-000000000001';

-- Fuera de ventana (22:00) → no push
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-18 22:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001'
      and p.kind in ('budget_80', 'budget_100')
  ),
  0::bigint,
  'ventana: fuera de 9–21 no manda presupuesto'
);

-- Dentro de ventana → solo budget_100 (cruzó 80 y 100 a la vez)
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-18 10:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001' and p.kind = 'budget_100'
  ),
  1::bigint,
  'push 100 % cuando se pasa del tope'
);

select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-18 10:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001' and p.kind = 'budget_80'
  ),
  0::bigint,
  'si cruza 80 y 100 a la vez, solo emite el de 100'
);

-- No depende de enabled=false (Coty lo tiene apagado)
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-18 10:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001' and p.kind = 'budget_100'
  ),
  1::bigint,
  'presupuesto no depende del switch ¿Gastaste algo hoy?'
);

-- claim: registra 100 y también 80; no reenvía
select is(
  (
    select count(*) from public.claim_finance_due_pushes(
      timestamp '2026-11-18 10:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001' and p.kind = 'budget_100'
  ),
  1::bigint,
  'claim budget_100'
);

select is(
  (
    select count(*) from public.finance_push_sends
    where user_id = 'b1000001-0001-4001-8001-000000000001'
      and kind = 'budget_80'
      and send_key = ('2026-11|' || current_setting('test.cat_super'))
  ),
  1::bigint,
  'claim 100 también registra el 80'
);

select is(
  (
    select count(*) from public.claim_finance_due_pushes(
      timestamp '2026-11-18 11:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001'
      and p.kind in ('budget_80', 'budget_100')
  ),
  0::bigint,
  'dedupe: no reenvía presupuesto el mismo mes'
);

-- Solo 80 %
delete from public.finance_push_sends
where user_id = 'b1000001-0001-4001-8001-000000000001'
  and kind in ('budget_80', 'budget_100');
delete from public.expenses where id = 'b4000002-0002-4002-8002-000000000002';
-- spent = 18000 / 20000 = 90 %
select is(
  (
    select p.kind from public.finance_due_pushes(
      timestamp '2026-11-18 10:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001'
      and p.kind in ('budget_80', 'budget_100')
  ),
  'budget_80',
  'push 80 % cuando está cerca sin pasarse'
);

update public.reminder_preferences
set budget_enabled = false
where user_id = 'b1000001-0001-4001-8001-000000000001';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-18 10:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001'
      and p.kind in ('budget_80', 'budget_100')
  ),
  0::bigint,
  'respeta budget_enabled=false'
);
update public.reminder_preferences
set budget_enabled = true
where user_id = 'b1000001-0001-4001-8001-000000000001';

-- authenticated no ejecuta finance_due_pushes
select set_config('request.jwt.claim.sub', 'b1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.finance_due_pushes(now(), interval '5 minutes')$$,
  '42501',
  null,
  'authenticated no ejecuta finance_due_pushes'
);
reset role;

-- Mes pasado no dispara (gasto en octubre con tope octubre; evaluamos en noviembre)
insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount,
  spent_on, period, is_shared
)
select
  'b4000003-0003-4003-8003-000000000003',
  p.household_id,
  'b1000001-0001-4001-8001-000000000001',
  'b1000001-0001-4001-8001-000000000001',
  current_setting('test.cat_super')::uuid,
  'Viejo',
  999999,
  '2026-10-05',
  '2026-10-01',
  false
from public.profiles as p where p.id = 'b1000001-0001-4001-8001-000000000001';

delete from public.finance_push_sends
where user_id = 'b1000001-0001-4001-8001-000000000001' and kind in ('budget_80', 'budget_100');

-- En noviembre el gasto viejo no cuenta; spent noviembre sigue en 18000 → 80%
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-18 10:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'b1000001-0001-4001-8001-000000000001' and p.kind = 'budget_100'
  ),
  0::bigint,
  'solo cuenta el mes actual: gasto de octubre no manda 100 % en noviembre'
);

select * from finish();
rollback;
