begin;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'archive-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
    'archive-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  );

create temp table archive_home (hid uuid, code text);
grant all on table archive_home to authenticated;

create temp table archive_stamp (
  archived_at timestamptz,
  done boolean,
  done_at timestamptz
);
grant all on table archive_stamp to authenticated;

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into archive_home (hid)
select public.create_household();

update archive_home
set code = (
  select h.invite_code
  from public.households as h
  where h.id = archive_home.hid
);

insert into public.memos (id, owner_id, household_id, text, shared, done)
values
  (
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    (select hid from archive_home),
    'Comprar yerba',
    true,
    true
  ),
  (
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    (select hid from archive_home),
    'Solo mío',
    false,
    false
  );

select is(
  (select archived_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  null,
  'un memo nace sin archived_at'
);

insert into archive_stamp (done, done_at)
select done, done_at
from public.memos
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

update public.memos
set archived_at = '2020-01-01T00:00:00Z'
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select ok(
  (select archived_at is not null from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  'la dueña puede archivar'
);

select ok(
  (
    select archived_at > now() - interval '1 minute'
    from public.memos
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
  ),
  'archived_at lo fija el trigger, no el valor que manda la app'
);

select is(
  (select done from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  (select done from archive_stamp),
  'archivar no cambia done'
);

select is(
  (select done_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  (select done_at from archive_stamp),
  'archivar no cambia done_at'
);

update archive_stamp
set archived_at = (
  select archived_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
);

update public.memos
set text = 'Comprar yerba y azúcar'
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select archived_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  (select archived_at from archive_stamp),
  'al editar un archivado se conserva archived_at'
);

update public.memos
set shared = false
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select archived_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  (select archived_at from archive_stamp),
  'dejar de compartir un archivado lo deja archivado'
);

update public.memos
set shared = true
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

update public.memos
set archived_at = null
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select archived_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  null,
  'la dueña puede desarchivar'
);

reset role;

select set_config('request.jwt.claim.sub', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2","role":"authenticated"}',
  true
);
set local role authenticated;

select public.join_household((select code from archive_home));

update public.memos
set archived_at = '2020-01-01T00:00:00Z'
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select ok(
  (select archived_at is not null from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  'la pareja puede archivar un compartido'
);

update public.memos
set archived_at = null
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (select archived_at from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  null,
  'la pareja puede desarchivar un compartido'
);

update public.memos
set archived_at = '2020-01-01T00:00:00Z'
where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2';

select is(
  (select archived_at from public.memos where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'),
  null,
  'la pareja no puede archivar uno privado (0 filas por RLS)'
);

select throws_ok(
  $$update public.memos
    set text = 'Lo cambió Maru'
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'$$,
  'P0001',
  'Solo podés marcarlo hecho o archivarlo',
  'la pareja no puede cambiar el texto'
);

select throws_ok(
  $$update public.memos
    set shared = false
    where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'$$,
  'P0001',
  'Solo podés marcarlo hecho o archivarlo',
  'la pareja no puede cambiar shared'
);

select * from finish();
rollback;
