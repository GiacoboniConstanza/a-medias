begin;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'memos-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
    'memos-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  );

create temp table memo_home (hid uuid, code text);
grant all on table memo_home to authenticated;

create temp table memo_stamp (done_at timestamptz, updated_at timestamptz);
grant all on table memo_stamp to authenticated;

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into memo_home (hid)
select public.create_household();

update memo_home
set code = (
  select h.invite_code
  from public.households as h
  where h.id = memo_home.hid
);

insert into public.memos (id, owner_id, household_id, text, shared, done)
values
  (
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    (select hid from memo_home),
    'Comprar yerba',
    true,
    false
  ),
  (
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    (select hid from memo_home),
    'Solo mío',
    false,
    false
  );

select is(
  (select done_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  null,
  'un memo pendiente nace sin done_at'
);

update public.memos
set text = 'Comprar yerba y azúcar', shared = true
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select text from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  'Comprar yerba y azúcar',
  'la dueña puede editar el texto'
);

update public.memos
set done = true
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select ok(
  (select done_at is not null from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  'al tachar se setea done_at'
);

insert into memo_stamp (done_at, updated_at)
select done_at, updated_at
from public.memos
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select pg_sleep(0.05);

update public.memos
set text = 'Devolver los dos libros'
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select done_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  (select done_at from memo_stamp),
  'done_at se conserva al editar un memo tachado'
);

select ok(
  (
    select updated_at > (select updated_at from memo_stamp)
    from public.memos
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
  ),
  'updated_at sí cambia al editar'
);

update public.memos
set done = false
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select done_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  null,
  'al destachar se limpia done_at'
);

reset role;

select set_config('request.jwt.claim.sub', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2","role":"authenticated"}',
  true
);
set local role authenticated;

select public.join_household((select code from memo_home));

update public.memos
set done = true
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select done from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  true,
  'la otra puede tachar un memo compartido'
);

select ok(
  (select done_at is not null from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  'la otra al tachar también setea done_at'
);

select throws_ok(
  $$update public.memos
    set text = 'Lo cambió Maru'
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'$$,
  'P0001',
  'Solo podés marcarlo hecho',
  'la otra no puede editar el texto'
);

delete from public.memos
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select count(*) from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  1::bigint,
  'la otra no puede borrar (0 filas, el memo sigue)'
);

reset role;

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1","role":"authenticated"}',
  true
);
set local role authenticated;

delete from public.memos
where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2';

select is(
  (select count(*) from public.memos where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'),
  0::bigint,
  'la dueña puede eliminar su memo'
);

insert into public.memos (
  id, owner_id, household_id, text, shared, done, created_at, done_at
)
values (
  'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  (select hid from memo_home),
  'Solo mío',
  false,
  true,
  '2026-11-01T10:00:00Z',
  '2026-11-10T12:00:00Z'
);

select is(
  (select created_at from public.memos where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'),
  '2026-11-01T10:00:00Z'::timestamptz,
  'deshacer puede restaurar created_at'
);

select is(
  (select done_at from public.memos where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'),
  '2026-11-10T12:00:00Z'::timestamptz,
  'deshacer de un memo hecho restaura done_at'
);

select * from finish();
rollback;
