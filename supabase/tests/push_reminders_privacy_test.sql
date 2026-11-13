begin;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a1111111-1111-4111-8111-111111111111',
    'push-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    'push-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  );

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key, user_agent)
values (
  'a1111111-1111-4111-8111-111111111111',
  'https://example.test/push/coty',
  'p256',
  'auth',
  'TestAgent/1'
);

insert into public.scheduled_reminders (
  id, user_id, module, title, body, local_time, timezone, days_of_week, active
)
values (
  'b1111111-1111-4111-8111-111111111111',
  'a1111111-1111-4111-8111-111111111111',
  'finanzas',
  '¿Gastaste algo hoy?',
  'Anotalo',
  '21:30',
  'America/Argentina/Buenos_Aires',
  null,
  true
);

select is(
  (select count(*) from public.push_subscriptions where endpoint = 'https://example.test/push/coty'),
  1::bigint,
  'dueña ve su suscripción'
);

select is(
  (select count(*) from public.scheduled_reminders where id = 'b1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'dueña ve su recordatorio'
);

reset role;

select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.push_subscriptions where endpoint = 'https://example.test/push/coty'),
  0::bigint,
  'otra no ve la suscripción'
);

select is(
  (select count(*) from public.scheduled_reminders where id = 'b1111111-1111-4111-8111-111111111111'),
  0::bigint,
  'otra no ve el recordatorio'
);

select throws_ok(
  $$insert into public.scheduled_reminders (
      user_id, module, title, local_time
    ) values (
      'a1111111-1111-4111-8111-111111111111',
      'finanzas',
      'Ajeno',
      '10:00'
    )$$,
  '42501',
  null,
  'no puede insertar recordatorio a nombre de la otra'
);

update public.scheduled_reminders
set title = 'Hack'
where id = 'b1111111-1111-4111-8111-111111111111';

delete from public.push_subscriptions
where endpoint = 'https://example.test/push/coty';

reset role;

select is(
  (select title from public.scheduled_reminders where id = 'b1111111-1111-4111-8111-111111111111'),
  '¿Gastaste algo hoy?',
  'otra no le cambia el título'
);

select is(
  (select count(*) from public.push_subscriptions where endpoint = 'https://example.test/push/coty'),
  1::bigint,
  'otra no borra la suscripción'
);

-- Lógica de “qué toca ahora” (zona AR, sin duplicar).
select set_config('request.jwt.claim.sub', '', true);
set local role postgres;

select is(
  (
    select count(*)
    from public.reminders_due_at(
      timestamptz '2026-11-13 21:30:20-03'
    )
    where id = 'b1111111-1111-4111-8111-111111111111'
  ),
  1::bigint,
  'toca a las 21:30 hora Argentina'
);

update public.scheduled_reminders
set last_sent_at = timestamptz '2026-11-13 21:30:05-03'
where id = 'b1111111-1111-4111-8111-111111111111';

select is(
  (
    select count(*)
    from public.reminders_due_at(
      timestamptz '2026-11-13 21:30:40-03'
    )
    where id = 'b1111111-1111-4111-8111-111111111111'
  ),
  0::bigint,
  'no duplica en el mismo minuto'
);

-- Aviso de una sola vez (fire_at), instante en zona AR.
insert into public.scheduled_reminders (
  id, user_id, module, title, body, fire_at, timezone, active
)
values (
  'b2222222-2222-4222-8222-222222222222',
  'a1111111-1111-4111-8111-111111111111',
  'finanzas',
  'Vence Alquiler',
  'Marcalo',
  timestamp '2026-11-15 09:00:00' at time zone 'America/Argentina/Buenos_Aires',
  'America/Argentina/Buenos_Aires',
  true
);

select throws_ok(
  $$insert into public.scheduled_reminders (
      user_id, module, title, local_time, fire_at
    ) values (
      'a1111111-1111-4111-8111-111111111111',
      'finanzas',
      'Modo mixto',
      '10:00',
      now()
    )$$,
  '23514',
  null,
  'no admite local_time y fire_at a la vez'
);

select is(
  (
    select count(*)
    from public.reminders_due_at(
      timestamp '2026-11-15 08:59:00' at time zone 'America/Argentina/Buenos_Aires'
    )
    where id = 'b2222222-2222-4222-8222-222222222222'
  ),
  0::bigint,
  'fire_at aún no toca antes de la hora AR'
);

select is(
  (
    select count(*)
    from public.reminders_due_at(
      timestamp '2026-11-15 09:00:30' at time zone 'America/Argentina/Buenos_Aires'
    )
    where id = 'b2222222-2222-4222-8222-222222222222'
  ),
  1::bigint,
  'fire_at toca a la hora exacta en AR'
);

select ok(
  (
    select last_sent_at is not null and not active
    from public.claim_due_reminders(
      timestamp '2026-11-15 09:01:00' at time zone 'America/Argentina/Buenos_Aires'
    )
    where id = 'b2222222-2222-4222-8222-222222222222'
  ),
  'claim de una vez marca enviado y desactiva'
);

select is(
  (
    select count(*)
    from public.reminders_due_at(
      timestamp '2026-11-15 10:00:00' at time zone 'America/Argentina/Buenos_Aires'
    )
    where id = 'b2222222-2222-4222-8222-222222222222'
  ),
  0::bigint,
  'fire_at no se vuelve a enviar'
);

select * from finish();
rollback;
