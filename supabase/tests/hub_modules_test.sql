begin;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
    'hub-coty@example.com',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
    'hub-maru@example.com',
    '{"display_name":"Maru"}'::jsonb
  ),
  (
    'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3',
    'hub-vacio@example.com',
    '{"display_name":"Vacio"}'::jsonb
  ),
  (
    'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4',
    'hub-baja@example.com',
    '{"display_name":"Baja"}'::jsonb
  );

select is(
  (
    select enabled
    from public.user_modules
    where user_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
      and module = 'finanzas'
  ),
  true,
  'un perfil nuevo arranca con Finanzas prendido'
);

select set_config('request.jwt.claim.sub', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$update public.user_modules
    set enabled = false
    where user_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
      and module = 'finanzas'$$,
  'P0001',
  'Tiene que quedar al menos un módulo activo',
  'no se puede apagar el único módulo'
);

select lives_ok(
  $$insert into public.user_modules (user_id, module, enabled)
    values ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'memos', true)$$,
  'puede prender un segundo módulo'
);

select lives_ok(
  $$update public.user_modules
    set enabled = false
    where user_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
      and module = 'finanzas'$$,
  'puede apagar Finanzas si queda otro prendido'
);

select throws_ok(
  $$update public.user_modules
    set enabled = false
    where user_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
      and module = 'memos'$$,
  'P0001',
  'Tiene que quedar al menos un módulo activo',
  'no se puede apagar el último que queda'
);

reset role;

update public.user_modules
set enabled = true
where user_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
  and module = 'finanzas';

select lives_ok(
  $$delete from public.user_modules
    where user_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
      and module = 'memos'$$,
  'se puede borrar un módulo si queda otro prendido'
);

select throws_ok(
  $$delete from public.user_modules
    where user_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
      and module = 'finanzas'$$,
  'P0001',
  'Tiene que quedar al menos un módulo activo',
  'no se puede borrar el último módulo prendido'
);

select set_config('request.jwt.claim.sub', 'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (
    select count(*)
    from public.user_modules
    where user_id = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1'
  ),
  0::bigint,
  'no ve los módulos de la otra'
);

reset role;

create temp table hub_home (hid uuid, code text);
grant all on table hub_home to authenticated;

select set_config('request.jwt.claim.sub', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into hub_home (hid)
select public.create_household();

update hub_home
set code = (
  select h.invite_code
  from public.households as h
  where h.id = hub_home.hid
);

insert into public.memos (id, owner_id, household_id, text, shared)
values
  (
    'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1',
    'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
    (select hid from hub_home),
    'Turno de la dermatóloga',
    false
  ),
  (
    'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2',
    'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
    (select hid from hub_home),
    'Comprar alimento para los gatos',
    true
  );

reset role;

select set_config('request.jwt.claim.sub', 'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2","role":"authenticated"}',
  true
);
set local role authenticated;

select public.join_household((select code from hub_home));

select is(
  (select count(*) from public.memos where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1'),
  0::bigint,
  'un memo privado no lo ve la otra'
);

select is(
  (select count(*) from public.memos where id = 'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2'),
  1::bigint,
  'un memo compartido lo ve la otra'
);

update public.memos
set done = true
where id = 'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2';

select is(
  (select done from public.memos where id = 'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2'),
  true,
  'la otra puede marcarlo hecho'
);

select throws_ok(
  $$update public.memos
    set text = 'Otra cosa'
    where id = 'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2'$$,
  'P0001',
  'Solo podés marcarlo hecho',
  'la otra no puede editar el texto'
);

delete from public.memos
where id = 'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2';

select is(
  (select count(*) from public.memos where id = 'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2'),
  1::bigint,
  'la otra no puede borrarlo'
);

reset role;

alter table public.user_modules disable trigger user_modules_guard;
delete from public.user_modules
where user_id = 'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3';
alter table public.user_modules enable trigger user_modules_guard;

select set_config('request.jwt.claim.sub', 'e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$insert into public.user_modules (user_id, module, enabled)
    values ('e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3', 'finanzas', false)$$,
  'P0001',
  'Tiene que quedar al menos un módulo activo',
  'no se puede crear un módulo apagado si no queda otro prendido'
);

reset role;

select lives_ok(
  $$delete from public.profiles where id = 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4'$$,
  'borrar el perfil no lo frena el último módulo'
);

select is(
  (select count(*) from public.user_modules where user_id = 'e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4'),
  0::bigint,
  'al borrar el perfil se van sus módulos'
);

select * from finish();
rollback;
