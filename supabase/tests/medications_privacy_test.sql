begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'c1111111-1111-4111-8111-111111111111',
    'meds-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'meds-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  );

select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.medications (id, user_id, name, dose_notes, starts_on, ends_on, active)
values (
  'd1111111-1111-4111-8111-111111111111',
  'c1111111-1111-4111-8111-111111111111',
  'Ibuprofeno',
  '400mg',
  '2026-11-01',
  '2026-11-30',
  true
);

insert into public.medication_schedules (id, medication_id, user_id, local_time)
values (
  'e1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  'c1111111-1111-4111-8111-111111111111',
  '08:00'
);

insert into public.medication_doses (
  id, medication_id, user_id, dose_on, scheduled_time, status
)
values (
  'f1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  'c1111111-1111-4111-8111-111111111111',
  '2026-11-13',
  '08:00',
  'taken'
);

select is(
  (select count(*) from public.medications where id = 'd1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'dueña ve su medicamento'
);

select is(
  (select count(*) from public.medication_schedules where id = 'e1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'dueña ve su horario'
);

select is(
  (select count(*) from public.medication_doses where id = 'f1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'dueña ve su toma'
);

reset role;

select set_config('request.jwt.claim.sub', 'c2222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c2222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.medications where id = 'd1111111-1111-4111-8111-111111111111'),
  0::bigint,
  'otra no ve el medicamento'
);

select is(
  (select count(*) from public.medication_schedules),
  0::bigint,
  'otra no ve horarios ajenos'
);

select is(
  (select count(*) from public.medication_doses),
  0::bigint,
  'otra no ve tomas ajenas'
);

select throws_ok(
  $$insert into public.medication_doses (
      medication_id, user_id, dose_on, scheduled_time, status
    ) values (
      'd1111111-1111-4111-8111-111111111111',
      'c2222222-2222-4222-8222-222222222222',
      '2026-11-13',
      '08:00',
      'taken'
    )$$,
  'P0001',
  'Ese medicamento no es tuyo',
  'no puede registrar toma ajena'
);

update public.medications
set name = 'Ajeno'
where id = 'd1111111-1111-4111-8111-111111111111';

reset role;

select is(
  (select name from public.medications where id = 'd1111111-1111-4111-8111-111111111111'),
  'Ibuprofeno',
  'otra no le cambia el nombre'
);

select set_config('request.jwt.claim.sub', 'c1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.medications
    set dose_notes = '200mg'
    where id = 'd1111111-1111-4111-8111-111111111111'$$,
  'dueña puede editarlo'
);

select * from finish();
rollback;
