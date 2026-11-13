begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'aa111111-1111-4111-8111-111111111111',
  'sync-coty@example.test',
  '{"display_name":"Coty"}'::jsonb
);

select set_config('request.jwt.claim.sub', 'aa111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aa111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.medications (id, user_id, name, dose_notes)
values (
  'bb111111-1111-4111-8111-111111111111',
  'aa111111-1111-4111-8111-111111111111',
  'Amoxicilina',
  '500 mg'
);

insert into public.medication_periods (
  medication_id, user_id, starts_on, ends_on, started_at
)
values (
  'bb111111-1111-4111-8111-111111111111',
  'aa111111-1111-4111-8111-111111111111',
  '2026-11-10',
  '2026-11-30',
  timestamptz '2026-11-10 03:00:00+00'
);

insert into public.medication_schedules (id, medication_id, user_id, local_time)
values (
  'cc111111-1111-4111-8111-111111111111',
  'bb111111-1111-4111-8111-111111111111',
  'aa111111-1111-4111-8111-111111111111',
  '08:00'
);

insert into public.medications (id, user_id, name, dose_notes)
values (
  'bb222222-2222-4222-8222-222222222222',
  'aa111111-1111-4111-8111-111111111111',
  'Magnesio',
  null
);

insert into public.medication_periods (
  medication_id, user_id, starts_on, started_at
)
values (
  'bb222222-2222-4222-8222-222222222222',
  'aa111111-1111-4111-8111-111111111111',
  '2026-11-01',
  timestamptz '2026-11-01 03:00:00+00'
);

insert into public.medication_schedules (id, medication_id, user_id, local_time)
values (
  'cc222222-2222-4222-8222-222222222222',
  'bb222222-2222-4222-8222-222222222222',
  'aa111111-1111-4111-8111-111111111111',
  '08:00'
);

insert into public.module_notification_prefs (user_id, module, enabled)
values ('aa111111-1111-4111-8111-111111111111', 'medicamentos', true);

-- Día futuro rechazado
select throws_ok(
  $$insert into public.medication_doses (
      medication_id, user_id, dose_on, scheduled_time, status, name_snapshot
    ) values (
      'bb111111-1111-4111-8111-111111111111',
      'aa111111-1111-4111-8111-111111111111',
      '2099-01-01',
      '08:00',
      'taken',
      'Amoxicilina'
    )$$,
  'P0001',
  'No se pueden marcar tomas de días futuros',
  'rechaza día futuro'
);

-- Día fuera de período
select throws_ok(
  $$insert into public.medication_doses (
      medication_id, user_id, dose_on, scheduled_time, status, name_snapshot
    ) values (
      'bb111111-1111-4111-8111-111111111111',
      'aa111111-1111-4111-8111-111111111111',
      '2026-11-01',
      '08:00',
      'taken',
      'Amoxicilina'
    )$$,
  'P0001',
  'Ese día no está en un período de uso del medicamento',
  'rechaza día fuera de período'
);

reset role;

-- Despacho: sin marcar, agrupado, sin duplicar, preferencia apagada
select is(
  (
    select count(*)
    from public.medication_due_slots(
      timestamp '2026-11-13 08:00:20' at time zone 'America/Argentina/Buenos_Aires',
      5
    )
  ),
  2::bigint,
  'dos tomas sin marcar a las 08:00'
);

select is(
  (
    select count(distinct user_id || dose_on::text || scheduled_time::text)
    from public.claim_medication_due_slots(
      timestamp '2026-11-13 08:00:20' at time zone 'America/Argentina/Buenos_Aires',
      5
    )
  ),
  1::bigint,
  'claim agrupa en un envío por usuaria+hora'
);

select is(
  (
    select count(*)
    from public.medication_due_slots(
      timestamp '2026-11-13 08:01:00' at time zone 'America/Argentina/Buenos_Aires',
      5
    )
  ),
  0::bigint,
  'no duplica después del claim'
);

-- Preferencia apagada: no avisa
update public.module_notification_prefs
set enabled = false
where user_id = 'aa111111-1111-4111-8111-111111111111'
  and module = 'medicamentos';

delete from public.medication_push_sends;

select is(
  (
    select count(*)
    from public.medication_due_slots(
      timestamp '2026-11-13 08:00:20' at time zone 'America/Argentina/Buenos_Aires',
      5
    )
  ),
  0::bigint,
  'preferencia apagada no avisa'
);

-- Marcar una toma: no entra al due
update public.module_notification_prefs set enabled = true
where user_id = 'aa111111-1111-4111-8111-111111111111';

insert into public.medication_doses (
  medication_id, user_id, dose_on, scheduled_time, status, name_snapshot, dose_snapshot
)
values (
  'bb111111-1111-4111-8111-111111111111',
  'aa111111-1111-4111-8111-111111111111',
  '2026-11-13',
  '08:00',
  'taken',
  'Amoxicilina',
  '500 mg'
);

select is(
  (
    select count(*)
    from public.medication_due_slots(
      timestamp '2026-11-13 08:00:20' at time zone 'America/Argentina/Buenos_Aires',
      5
    )
    where medication_id = 'bb111111-1111-4111-8111-111111111111'
  ),
  0::bigint,
  'toma ya marcada no se avisa'
);

select is(
  (
    select count(*)
    from public.medication_due_slots(
      timestamp '2026-11-13 08:00:20' at time zone 'America/Argentina/Buenos_Aires',
      5
    )
    where medication_id = 'bb222222-2222-4222-8222-222222222222'
  ),
  1::bigint,
  'la otra sin marcar sí toca'
);

-- Archivar corta y no pierde tomas
update public.medications
set archived_at = timestamp '2026-11-13 10:30:00' at time zone 'America/Argentina/Buenos_Aires'
where id = 'bb111111-1111-4111-8111-111111111111';

update public.medication_periods
set ended_at = timestamp '2026-11-13 10:30:00' at time zone 'America/Argentina/Buenos_Aires'
where medication_id = 'bb111111-1111-4111-8111-111111111111'
  and ended_at is null;

select is(
  (
    select count(*) from public.medication_doses
    where medication_id = 'bb111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'archivar no borra el historial de tomas'
);

select * from finish();
rollback;
