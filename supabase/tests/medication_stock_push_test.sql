begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'e1111111-1111-4111-8111-111111111111',
  'stock-push@example.test',
  '{"display_name":"Coty"}'::jsonb
);

-- Preferencia prendida
insert into public.module_notification_prefs (user_id, module, enabled)
values ('e1111111-1111-4111-8111-111111111111', 'medicamentos', true);

insert into public.medications (id, user_id, name, stock_qty, units_per_dose)
values (
  'e2222222-2222-4222-8222-222222222222',
  'e1111111-1111-4111-8111-111111111111',
  'Losartán',
  5,
  1
);

insert into public.medication_periods (
  medication_id, user_id, starts_on, ends_on, started_at
)
values (
  'e2222222-2222-4222-8222-222222222222',
  'e1111111-1111-4111-8111-111111111111',
  '2026-11-01',
  null,
  timestamptz '2026-11-01 03:00:00+00'
);

insert into public.medication_schedules (medication_id, user_id, local_time)
values
  ('e2222222-2222-4222-8222-222222222222', 'e1111111-1111-4111-8111-111111111111', '08:00'),
  ('e2222222-2222-4222-8222-222222222222', 'e1111111-1111-4111-8111-111111111111', '20:00');

-- 9:00 AR del 18/11/2026 = 12:00 UTC
select is(
  (
    select count(*)
    from public.claim_medication_stock_pushes(
      timestamptz '2026-11-18 12:00:00+00',
      interval '5 minutes'
    )
  ),
  1::bigint,
  'reclama poco stock a las 9:00 AR'
);

select is(
  (
    select count(*)
    from public.claim_medication_stock_pushes(
      timestamptz '2026-11-18 12:00:00+00',
      interval '5 minutes'
    )
  ),
  0::bigint,
  'no duplica el aviso de poco stock'
);

-- Reponer limpia el envío y permite re-avisar
select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.add_medication_stock('e2222222-2222-4222-8222-222222222222', 30)$$,
  'sumar limpia avisos'
);

reset role;

-- Vuelve a bajar el stock a 5 (bajo)
select set_config('request.jwt.claim.sub', 'e1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.adjust_medication_stock('e2222222-2222-4222-8222-222222222222', 5)$$,
  'ajustar a stock bajo'
);
reset role;

select is(
  (
    select count(*)
    from public.claim_medication_stock_pushes(
      timestamptz '2026-11-19 12:00:00+00',
      interval '5 minutes'
    )
  ),
  1::bigint,
  're-avisa después de reponer y volver a bajar'
);

-- Preferencia apagada: no avisa
update public.module_notification_prefs
set enabled = false
where user_id = 'e1111111-1111-4111-8111-111111111111'
  and module = 'medicamentos';

delete from public.medication_stock_push_sends
where medication_id = 'e2222222-2222-4222-8222-222222222222';

select is(
  (
    select count(*)
    from public.claim_medication_stock_pushes(
      timestamptz '2026-11-20 12:00:00+00',
      interval '5 minutes'
    )
  ),
  0::bigint,
  'con preferencia apagada no avisa'
);

select * from finish();
rollback;
