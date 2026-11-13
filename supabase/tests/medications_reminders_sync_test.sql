begin;
select plan(8);

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

insert into public.medications (id, user_id, name, dose_notes, starts_on, ends_on, active)
values (
  'bb111111-1111-4111-8111-111111111111',
  'aa111111-1111-4111-8111-111111111111',
  'Amoxicilina',
  '1 comp',
  '2026-11-10',
  '2026-11-20',
  true
);

insert into public.medication_schedules (id, medication_id, user_id, local_time)
values
  (
    'cc111111-1111-4111-8111-111111111111',
    'bb111111-1111-4111-8111-111111111111',
    'aa111111-1111-4111-8111-111111111111',
    '08:00'
  ),
  (
    'cc222222-2222-4222-8222-222222222222',
    'bb111111-1111-4111-8111-111111111111',
    'aa111111-1111-4111-8111-111111111111',
    '20:00'
  );

select is(
  (
    select count(*)
    from public.scheduled_reminders
    where module = 'medicamentos'
      and ref_table = 'medication_schedules'
      and user_id = 'aa111111-1111-4111-8111-111111111111'
  ),
  2::bigint,
  'crea un reminder por horario'
);

select is(
  (
    select title
    from public.scheduled_reminders
    where ref_id = 'cc111111-1111-4111-8111-111111111111'
  ),
  'Amoxicilina',
  'el título sigue el nombre del medicamento'
);

select is(
  (
    select body
    from public.scheduled_reminders
    where ref_id = 'cc111111-1111-4111-8111-111111111111'
  ),
  '1 comp',
  'el body trae la dosis/notas'
);

update public.medications
set name = 'Amoxi', dose_notes = '2 comp'
where id = 'bb111111-1111-4111-8111-111111111111';

select is(
  (
    select count(*)
    from public.scheduled_reminders
    where ref_table = 'medication_schedules'
      and title = 'Amoxi'
      and body = '2 comp'
      and user_id = 'aa111111-1111-4111-8111-111111111111'
  ),
  2::bigint,
  'al editar el medicamento actualiza los reminders'
);

delete from public.medication_schedules
where id = 'cc222222-2222-4222-8222-222222222222';

select is(
  (
    select count(*)
    from public.scheduled_reminders
    where ref_id = 'cc222222-2222-4222-8222-222222222222'
  ),
  0::bigint,
  'al borrar un horario borra su reminder'
);

update public.medications
set ends_on = '2026-11-12', active = true
where id = 'bb111111-1111-4111-8111-111111111111';

select is(
  (
    select bool_and(active)
    from public.scheduled_reminders
    where ref_id = 'cc111111-1111-4111-8111-111111111111'
  ),
  false,
  'tratamiento terminado deja de avisar'
);

-- Reactivar y probar due_at sobre el reminder de las 08:00 AR
update public.medications
set ends_on = '2026-11-30', active = true
where id = 'bb111111-1111-4111-8111-111111111111';

reset role;

select is(
  (
    select count(*)
    from public.reminders_due_at(timestamptz '2026-11-13 08:00:15-03')
    where ref_id = 'cc111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'el reminder del horario toca a las 08:00 AR'
);

select is(
  (
    select count(*)
    from public.reminders_due_at(timestamptz '2026-11-13 09:00:00-03')
    where ref_id = 'cc111111-1111-4111-8111-111111111111'
  ),
  0::bigint,
  'fuera de esa hora no toca'
);

select * from finish();
rollback;
