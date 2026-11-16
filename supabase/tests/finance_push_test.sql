begin;
select plan(36);

-- Coty + Maru
insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'f1000001-0001-4001-8001-000000000001',
    'fin-push-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'f1000002-0002-4002-8002-000000000002',
    'fin-push-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  ),
  (
    'f1000003-0003-4003-8003-000000000003',
    'fin-push-sola@example.test',
    '{"display_name":"Sola"}'::jsonb
  );

-- Hogar Coty
select set_config('request.jwt.claim.sub', 'f1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.create_household() is not null, 'Coty crea hogar');

insert into public.reminder_preferences (
  user_id, enabled, first_time, second_time, ask_times, due_lead_days,
  notify_shared, sunday_summary, silence_enabled, push_enabled
) values (
  'f1000001-0001-4001-8001-000000000001',
  true, '14:00', '21:30', array['14:00','21:30']::time[],
  2, true, false, true, true
);

insert into public.module_notification_prefs (user_id, module, enabled)
values ('f1000001-0001-4001-8001-000000000001', 'finanzas', true);

-- Fijos: Luz compartida due 15; Osde privado Coty due 10; Gas compartida due 5 (cambio de mes)
insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'f2000001-0001-4001-8001-000000000001',
  p.household_id, null, null, 'Luz', 'bolt', 'bolt', 10000, 15, true, true
from public.profiles as p where p.id = 'f1000001-0001-4001-8001-000000000001';

insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'f2000002-0002-4002-8002-000000000002',
  p.household_id, p.id, null, 'Osde', 'heart', 'heart', 45000, 10, false, true
from public.profiles as p where p.id = 'f1000001-0001-4001-8001-000000000001';

insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'f2000003-0003-4003-8003-000000000003',
  p.household_id, null, null, 'Gas', 'flame', 'flame', 8000, 5, true, true
from public.profiles as p where p.id = 'f1000001-0001-4001-8001-000000000001';

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values
  ('f2000001-0001-4001-8001-000000000001', 10000, '2026-10-01', 'f1000001-0001-4001-8001-000000000001'),
  ('f2000002-0002-4002-8002-000000000002', 45000, '2026-10-01', 'f1000001-0001-4001-8001-000000000001'),
  ('f2000003-0003-4003-8003-000000000003', 8000, '2026-10-01', 'f1000001-0001-4001-8001-000000000001');

reset role;

-- Maru entra
select set_config(
  'test.invite',
  (
    select h.invite_code from public.households as h
    join public.profiles as p on p.household_id = h.id
    where p.id = 'f1000001-0001-4001-8001-000000000001'
  ),
  true
);
select set_config('request.jwt.claim.sub', 'f1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok($$select public.join_household(current_setting('test.invite'))$$, 'Maru entra');

insert into public.reminder_preferences (
  user_id, enabled, first_time, second_time, ask_times, due_lead_days,
  silence_enabled, push_enabled
) values (
  'f1000002-0002-4002-8002-000000000002',
  true, '14:00', '21:30', array['14:00','21:30']::time[],
  2, true, true
);
insert into public.module_notification_prefs (user_id, module, enabled)
values ('f1000002-0002-4002-8002-000000000002', 'finanzas', true);
reset role;

-- Sola: push_enabled para probar carga inicial (simula migración) y sin finanzas aún
select set_config('request.jwt.claim.sub', 'f1000003-0003-4003-8003-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f1000003-0003-4003-8003-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.create_household() is not null, 'Sola crea hogar');
insert into public.reminder_preferences (
  user_id, enabled, first_time, second_time, ask_times, push_enabled, silence_enabled
) values (
  'f1000003-0003-4003-8003-000000000003',
  true, '14:00', '21:30', array['14:00']::time[], true, true
);
reset role;

-- Carga inicial: solo push_enabled sin fila finanzas → la migración ya corrió;
-- replicamos la regla insertando como haría el seed para Sola
insert into public.module_notification_prefs (user_id, module, enabled)
select rp.user_id, 'finanzas', true
from public.reminder_preferences as rp
where rp.user_id = 'f1000003-0003-4003-8003-000000000003'
  and rp.push_enabled
on conflict do nothing;

select is(
  (
    select enabled from public.module_notification_prefs
    where user_id = 'f1000003-0003-4003-8003-000000000003' and module = 'finanzas'
  ),
  true,
  'carga inicial: push_enabled crea finanzas enabled'
);

-- ========== Diario ==========
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  1::bigint,
  'diario dispara a las 14:00 AR'
);

select is(
  (
    select p.title from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  '¿Gastaste algo hoy?',
  'diario título correcto'
);

-- claim y no duplica
select is(
  (
    select count(*) from public.claim_finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  1::bigint,
  'claim diario una vez'
);

select is(
  (
    select count(*) from public.claim_finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  0::bigint,
  'diario no duplica'
);

-- El claim anterior también marcó dues/otros; limpiamos para las pruebas siguientes
delete from public.finance_push_sends
where user_id in (
  'f1000001-0001-4001-8001-000000000001',
  'f1000002-0002-4002-8002-000000000002'
);

-- logged → no diario
insert into public.daily_statuses (user_id, day, kind)
values ('f1000001-0001-4001-8001-000000000001', '2026-11-13', 'logged');
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  0::bigint,
  'no diario si día logged'
);
delete from public.daily_statuses
where user_id = 'f1000001-0001-4001-8001-000000000001' and day = '2026-11-13';

insert into public.daily_statuses (user_id, day, kind)
values ('f1000001-0001-4001-8001-000000000001', '2026-11-13', 'clear');
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  0::bigint,
  'no diario si día clear'
);
delete from public.daily_statuses
where user_id = 'f1000001-0001-4001-8001-000000000001' and day = '2026-11-13';

update public.reminder_preferences
set reviewed_on = '2026-11-13'
where user_id = 'f1000001-0001-4001-8001-000000000001';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  0::bigint,
  'no diario si reviewed_on es hoy'
);
update public.reminder_preferences
set reviewed_on = null
where user_id = 'f1000001-0001-4001-8001-000000000001';

update public.reminder_preferences
set hidden_until = timestamp '2026-11-13 18:00:00' at time zone 'America/Argentina/Buenos_Aires'
where user_id = 'f1000001-0001-4001-8001-000000000001';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  0::bigint,
  'no diario si hidden_until es posterior al slot'
);
update public.reminder_preferences
set hidden_until = null
where user_id = 'f1000001-0001-4001-8001-000000000001';

update public.reminder_preferences
set enabled = false
where user_id = 'f1000001-0001-4001-8001-000000000001';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
  ),
  0::bigint,
  'nada si enabled=false'
);
update public.reminder_preferences
set enabled = true
where user_id = 'f1000001-0001-4001-8001-000000000001';

update public.module_notification_prefs
set enabled = false
where user_id = 'f1000001-0001-4001-8001-000000000001' and module = 'finanzas';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
  ),
  0::bigint,
  'nada si Finanzas apagado'
);
update public.module_notification_prefs
set enabled = true
where user_id = 'f1000001-0001-4001-8001-000000000001' and module = 'finanzas';

-- Sin fila = igual que apagado (opt-in)
delete from public.module_notification_prefs
where user_id = 'f1000001-0001-4001-8001-000000000001' and module = 'finanzas';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
  ),
  0::bigint,
  'nada si no hay fila de Finanzas'
);
insert into public.module_notification_prefs (user_id, module, enabled)
values ('f1000001-0001-4001-8001-000000000001', 'finanzas', true);

-- ========== Vencimientos ==========
-- Luz due 15, lead 2 → avisa el 13. Osde due 10 privado → no el 13.
-- Gas due 5, lead 2 → avisa el 3 (mes actual o el aviso cae en mes anterior respecto al due).
select is(
  (
    select p.title from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'dues'
  ),
  'Vence Luz',
  'vencimiento respeta due_lead_days (15−2=13)'
);

select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000002-0002-4002-8002-000000000002' and p.kind = 'dues'
  ),
  1::bigint,
  'vencimiento compartido también a Maru'
);

select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-08 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
      and p.kind = 'dues'
      and p.title like '%Osde%'
  ),
  1::bigint,
  'fijo privado solo a su dueña (Osde 10−2=8)'
);

select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-08 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000002-0002-4002-8002-000000000002'
      and p.kind = 'dues'
      and p.title like '%Osde%'
  ),
  0::bigint,
  'Maru no recibe Osde privado'
);

-- Cambio de mes: Gas due 5 dic, lead 2 → avisa 3 dic; lead 7 desde 28 nov → due 5 dic
-- Con lead 2 el 3/11 avisa Gas de noviembre (due 5). Para mes anterior:
-- el 28/11 con lead 7 → due_date = 5/12. Actualizamos lead temporalmente.
update public.reminder_preferences
set due_lead_days = 7
where user_id = 'f1000001-0001-4001-8001-000000000001';
select is(
  (
    select p.title from public.finance_due_pushes(
      timestamp '2026-11-28 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'dues'
  ),
  'Vence Gas',
  'vencimiento que cae en mes siguiente se resuelve (28+7=5 dic)'
);
update public.reminder_preferences
set due_lead_days = 2
where user_id = 'f1000001-0001-4001-8001-000000000001';

-- pagado / pausado / remind=false / sin monto
insert into public.fixed_payments (fixed_expense_id, month, paid_on, payer_id, amount)
values (
  'f2000001-0001-4001-8001-000000000001', '2026-11-01', '2026-11-10',
  'f1000001-0001-4001-8001-000000000001', 10000
);
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
      and p.kind = 'dues' and p.title like '%Luz%'
  ),
  0::bigint,
  'no avisa fijo ya pagado ese mes'
);
delete from public.fixed_payments where fixed_expense_id = 'f2000001-0001-4001-8001-000000000001';

update public.fixed_expenses set paused_at = now()
where id = 'f2000001-0001-4001-8001-000000000001';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
      and p.kind = 'dues' and p.title like '%Luz%'
  ),
  0::bigint,
  'no avisa fijo pausado'
);
update public.fixed_expenses set paused_at = null
where id = 'f2000001-0001-4001-8001-000000000001';

update public.fixed_expenses set remind = false
where id = 'f2000001-0001-4001-8001-000000000001';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
      and p.kind = 'dues' and p.title like '%Luz%'
  ),
  0::bigint,
  'no avisa si remind=false'
);
update public.fixed_expenses set remind = true
where id = 'f2000001-0001-4001-8001-000000000001';

delete from public.fixed_expense_amounts
where fixed_expense_id = 'f2000001-0001-4001-8001-000000000001';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
      and p.kind = 'dues' and p.title like '%Luz%'
  ),
  0::bigint,
  'no avisa sin monto vigente'
);
insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values ('f2000001-0001-4001-8001-000000000001', 10000, '2026-10-01', 'f1000001-0001-4001-8001-000000000001');

-- Agrupa textos: Luz due 15 + agregar Agua due 15
insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared, remind
)
select
  'f2000004-0004-4004-8004-000000000004',
  p.household_id, null, null, 'Agua', 'droplet', 'droplet', 5000, 15, true, true
from public.profiles as p where p.id = 'f1000001-0001-4001-8001-000000000001';
insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values ('f2000004-0004-4004-8004-000000000004', 5000, '2026-10-01', 'f1000001-0001-4001-8001-000000000001');

select is(
  (
    select p.title from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'dues'
  ),
  'Vencen Agua y Luz',
  'agrupa dos vencimientos'
);

-- Sin aviso el día del vencimiento (lead>0 y due day ≠ lead day)
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-15 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
      and p.kind = 'dues' and p.title like '%Luz%'
  ),
  0::bigint,
  'sin aviso el mismo día del vencimiento'
);

-- ========== Silencio ==========
-- Actividad el 10; silencio 11, 12, 13 → avisa el 13 (send_key=11); reemplaza diario
delete from public.finance_push_sends where user_id = 'f1000001-0001-4001-8001-000000000001';
delete from public.daily_statuses where user_id = 'f1000001-0001-4001-8001-000000000001';
insert into public.daily_statuses (user_id, day, kind)
values ('f1000001-0001-4001-8001-000000000001', '2026-11-10', 'logged');

select is(
  (
    select count(*) filter (where kind = 'silence')
      + count(*) filter (where kind = 'daily')
    from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001'
  ),
  1::bigint,
  'silencio al día 3 (y cuenta como un solo kind silence o daily)'
);

select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'silence'
  ),
  1::bigint,
  'silencio dispara'
);

select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'daily'
  ),
  0::bigint,
  'silencio reemplaza al diario'
);

select is(
  (
    select count(*) from public.claim_finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'silence'
  ),
  1::bigint,
  'claim silencio'
);

select is(
  (
    select count(*) from public.claim_finance_due_pushes(
      timestamp '2026-11-14 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'silence'
  ),
  0::bigint,
  'silencio una vez por racha (mismo inicio 11/11)'
);

update public.reminder_preferences
set silence_enabled = false
where user_id = 'f1000001-0001-4001-8001-000000000001';
delete from public.finance_push_sends
where user_id = 'f1000001-0001-4001-8001-000000000001' and kind = 'silence';
select is(
  (
    select count(*) from public.finance_due_pushes(
      timestamp '2026-11-13 14:00:20' at time zone 'America/Argentina/Buenos_Aires',
      interval '5 minutes'
    ) as p
    where p.user_id = 'f1000001-0001-4001-8001-000000000001' and p.kind = 'silence'
  ),
  0::bigint,
  'respeta silence_enabled=false'
);
update public.reminder_preferences
set silence_enabled = true
where user_id = 'f1000001-0001-4001-8001-000000000001';

-- ========== RLS / permisos ==========
select set_config('request.jwt.claim.sub', 'f1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select * from public.finance_due_pushes(now(), interval '5 minutes')$$,
  '42501',
  null,
  'authenticated no ejecuta finance_due_pushes'
);

select throws_ok(
  $$insert into public.finance_push_sends (user_id, kind, send_key)
    values ('f1000001-0001-4001-8001-000000000001', 'daily', 'x')$$,
  '42501',
  null,
  'authenticated no escribe finance_push_sends'
);

reset role;

delete from public.finance_push_sends;
insert into public.finance_push_sends (user_id, kind, send_key)
values ('f1000001-0001-4001-8001-000000000001', 'daily', '2026-11-01|14:00');

select set_config('request.jwt.claim.sub', 'f1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.finance_push_sends),
  1::bigint,
  'dueña lee sus finance_push_sends'
);
reset role;

select set_config('request.jwt.claim.sub', 'f1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (
    select count(*) from public.finance_push_sends
    where user_id = 'f1000001-0001-4001-8001-000000000001'
  ),
  0::bigint,
  'otra no ve finance_push_sends ajenos'
);
reset role;

select * from finish();
rollback;
