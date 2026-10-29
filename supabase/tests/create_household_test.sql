begin;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'hogar-nuevo@example.com',
  '{"display_name":"Nueva"}'::jsonb
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',
  true
);
set local role authenticated;

create temp table created_home (hid uuid);
insert into created_home select public.create_household();

select is(
  (select hid from created_home),
  (select household_id from public.profiles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  'crear hogar deja el perfil vinculado'
);

select is(
  (select public.create_household()),
  (select hid from created_home),
  'si ya tiene hogar, devuelve ese'
);

select is(
  (select count(*) from public.households where created_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'no crea un segundo hogar'
);

reset role;

insert into auth.users (id, email, raw_user_meta_data)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'hogar-roto@example.com',
  '{"display_name":"Rota"}'::jsonb
);

delete from public.profiles
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

insert into public.households (id, invite_code, created_by, created_at)
values
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'VIEJO123',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    now() - interval '2 hours'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'NUEVO123',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    now() - interval '1 hour'
  );

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select public.create_household()),
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'sin perfil, vincula el hogar que ya había creado'
);

select is(
  (select household_id from public.profiles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'el perfil queda apuntando a ese hogar'
);

select is(
  (select count(*) from public.households where created_by = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2::bigint,
  'no inserta otro hogar si ya existían huérfanos'
);

select * from finish();
rollback;
