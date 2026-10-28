begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'f5f5f5f5-f5f5-45f5-85f5-f5f5f5f5f5f5',
    'habitos-coty@example.com',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6',
    'habitos-maru@example.com',
    '{"display_name":"Maru"}'::jsonb
  );

select set_config('request.jwt.claim.sub', 'f5f5f5f5-f5f5-45f5-85f5-f5f5f5f5f5f5', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f5f5f5f5-f5f5-45f5-85f5-f5f5f5f5f5f5","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.habits (id, owner_id, name, icon_name, days_of_week)
values (
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'f5f5f5f5-f5f5-45f5-85f5-f5f5f5f5f5f5',
  'Agua',
  'seedling',
  array[0, 1, 2, 3, 4, 5, 6]::integer[]
);

select is(
  (select count(*) from public.habits where id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'),
  1::bigint,
  'quien lo crea lo ve'
);

reset role;

select set_config('request.jwt.claim.sub', 'f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.habits where id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'),
  0::bigint,
  'el hábito no lo ve la otra'
);

select throws_ok(
  $$insert into public.habit_checks (habit_id, day)
    values ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', '2026-10-28')$$,
  'P0001',
  'Ese hábito no es tuyo',
  'no puede marcar el hábito de la otra'
);

update public.habits
set name = 'Ajeno'
where id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1';

reset role;

select is(
  (select name from public.habits where id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'),
  'Agua',
  'la otra no le cambia el nombre'
);

select set_config('request.jwt.claim.sub', 'f5f5f5f5-f5f5-45f5-85f5-f5f5f5f5f5f5', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f5f5f5f5-f5f5-45f5-85f5-f5f5f5f5f5f5","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.habit_checks (habit_id, day)
    values ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', '2026-10-28')$$,
  'el dueño puede marcarlo'
);

reset role;

select set_config('request.jwt.claim.sub', 'f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.habit_checks where habit_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'),
  0::bigint,
  'el tilde tampoco lo ve la otra'
);

select * from finish();
rollback;
