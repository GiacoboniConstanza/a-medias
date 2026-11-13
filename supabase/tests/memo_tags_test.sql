begin;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    'tags-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
    'tags-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  ),
  (
    'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3',
    'tags-otra@example.test',
    '{"display_name":"Otra"}'::jsonb
  );

create temp table tag_home (hid uuid, code text, other_hid uuid);
grant all on table tag_home to authenticated;

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into tag_home (hid)
select public.create_household();

update tag_home
set code = (
  select h.invite_code
  from public.households as h
  where h.id = tag_home.hid
);

insert into public.memos (id, owner_id, household_id, text, shared, done)
values
  (
    'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    (select hid from tag_home),
    'Comprar yerba y azúcar',
    true,
    false
  ),
  (
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2',
    'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
    (select hid from tag_home),
    'Turno con la dentista',
    false,
    false
  );

insert into public.memo_labels (id, household_id, name, color)
values
  (
    'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
    (select hid from tag_home),
    'Súper',
    'menta'
  ),
  (
    'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
    (select hid from tag_home),
    'Casa',
    'avellana'
  ),
  (
    'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
    (select hid from tag_home),
    'Finde',
    'lila'
  ),
  (
    'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4',
    (select hid from tag_home),
    'Trámites',
    'agua'
  );

insert into public.memo_label_links (memo_id, label_id)
values
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'),
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'),
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4');

select throws_ok(
  $$insert into public.memo_labels (household_id, name, color)
    values ((select hid from tag_home), 'súper', 'durazno')$$,
  'P0001',
  'Ya hay una etiqueta «súper»',
  'nombre repetido sin distinguir mayúsculas'
);

insert into public.memo_label_links (memo_id, label_id)
values ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3');

select throws_ok(
  $$insert into public.memo_label_links (memo_id, label_id)
    values ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4')$$,
  'P0001',
  'Hasta 3 etiquetas por memo',
  'la base rechaza la cuarta etiqueta'
);

reset role;

select set_config('request.jwt.claim.sub', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2","role":"authenticated"}',
  true
);
set local role authenticated;

select public.join_household((select code from tag_home));

select is(
  (select count(*) from public.memo_labels),
  4::bigint,
  'Maru ve todas las etiquetas del hogar'
);

select is(
  (
    select count(*)
    from public.memo_label_links
    where memo_id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'
  ),
  0::bigint,
  'Maru no ve uniones de un memo privado de Coty'
);

select is(
  (
    select count(*)
    from public.memo_label_links
    where memo_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
  ),
  3::bigint,
  'Maru ve las uniones del memo compartido'
);

delete from public.memo_label_links
where memo_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
  and label_id = 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3';

select is(
  (
    select count(*)
    from public.memo_label_links
    where memo_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
      and label_id = 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3'
  ),
  0::bigint,
  'Maru puede sacar una etiqueta de un memo compartido de Coty'
);

insert into public.memo_label_links (memo_id, label_id)
values ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1', 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3');

select ok(
  exists (
    select 1
    from public.memo_label_links
    where memo_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
      and label_id = 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3'
  ),
  'Maru puede poner una etiqueta en un memo compartido de Coty'
);

select throws_ok(
  $$insert into public.memo_label_links (memo_id, label_id)
    values ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1')$$,
  '42501',
  'new row violates row-level security policy for table "memo_label_links"',
  'Maru no puede poner etiqueta en un memo privado de Coty'
);

update public.memo_labels
set name = 'Super', color = 'durazno'
where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1';

select is(
  (select name || '/' || color from public.memo_labels where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'),
  'Super/durazno',
  'Maru puede cambiar una etiqueta que creó Coty'
);

delete from public.memo_labels
where id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2';

select is(
  (select count(*) from public.memo_labels where id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'),
  0::bigint,
  'Maru puede eliminar una etiqueta que creó Coty'
);

select is(
  (select count(*) from public.memos where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'),
  1::bigint,
  'eliminar etiqueta deja el memo compartido'
);

reset role;

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.memos where id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'),
  1::bigint,
  'eliminar etiqueta deja el memo privado'
);

select is(
  (
    select count(*)
    from public.memo_label_links
    where label_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
  ),
  0::bigint,
  'al eliminar, se sacan uniones también de memos que quien elimina no veía'
);

update public.memos
set shared = false
where id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1';

select is(
  (
    select count(*)
    from public.memo_label_links
    where memo_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
  ),
  2::bigint,
  'al dejar de compartir, las uniones quedan'
);

reset role;

select set_config('request.jwt.claim.sub', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.memo_label_links
    where memo_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
  ),
  0::bigint,
  'después de dejar de compartir, Maru deja de ver las uniones'
);

reset role;

select set_config('request.jwt.claim.sub', 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3","role":"authenticated"}',
  true
);
set local role authenticated;

update tag_home
set other_hid = public.create_household();

select is(
  (select count(*) from public.memo_labels),
  0::bigint,
  'otro hogar no ve las etiquetas'
);

select throws_ok(
  $$insert into public.memo_labels (id, household_id, name, color)
    values (
      'c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9',
      (select hid from tag_home),
      'Ajena',
      'menta'
    )$$,
  'P0001',
  'La etiqueta tiene que ser de tu hogar',
  'otro hogar no puede crear etiqueta en el hogar ajeno'
);

insert into public.memo_labels (id, household_id, name, color)
values (
  'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c8c8',
  (select other_hid from tag_home),
  'Propia',
  'menta'
);

insert into public.memos (id, owner_id, household_id, text, shared, done)
values (
  'b9b9b9b9-b9b9-49b9-89b9-b9b9b9b9b9b9',
  'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3',
  (select other_hid from tag_home),
  'Memo de otra',
  false,
  false
);

select is(
  (
    select count(*)
    from public.memo_labels
    where id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
  ),
  0::bigint,
  'otro hogar no ve la etiqueta ajena por id'
);

select is(
  (
    select count(*)
    from public.memo_label_links
    where memo_id = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'
  ),
  0::bigint,
  'otro hogar no ve uniones ajenas'
);

reset role;

select throws_ok(
  $$insert into public.memo_label_links (memo_id, label_id)
    values ('b9b9b9b9-b9b9-49b9-89b9-b9b9b9b9b9b9', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1')$$,
  'P0001',
  'La etiqueta tiene que ser del mismo hogar que el memo',
  'no se puede unir una etiqueta de otro hogar'
);

select * from finish();
rollback;
