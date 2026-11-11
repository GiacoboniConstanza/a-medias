begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1111111-1111-4111-8111-111111111111', 'ahorro-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('a2222222-2222-4222-8222-222222222222', 'ahorro-maru@example.com', '{"display_name":"Maru"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('a3333333-3333-4333-8333-333333333333', 'AHORROS1', 'a1111111-1111-4111-8111-111111111111');

update public.profiles
set household_id = 'a3333333-3333-4333-8333-333333333333'
where id in (
  'a1111111-1111-4111-8111-111111111111',
  'a2222222-2222-4222-8222-222222222222'
);

insert into public.savings (id, household_id, name, emoji, icon, target_amount, is_shared, owner_id)
values
  (
    'a4444444-4444-4444-8444-444444444444',
    'a3333333-3333-4333-8333-333333333333',
    'Viaje',
    'umbrella-beach',
    'umbrella-beach',
    1000,
    true,
    null
  ),
  (
    'a5555555-5555-4555-8555-555555555555',
    'a3333333-3333-4333-8333-333333333333',
    'Sillón',
    'couch',
    'couch',
    500,
    false,
    'a1111111-1111-4111-8111-111111111111'
  );

insert into public.saving_opening_balances (saving_id, user_id, amount) values
  ('a4444444-4444-4444-8444-444444444444', 'a1111111-1111-4111-8111-111111111111', 100),
  ('a5555555-5555-4555-8555-555555555555', 'a1111111-1111-4111-8111-111111111111', 40);

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$update public.savings
    set archived_at = now()
    where id = 'a5555555-5555-4555-8555-555555555555'$$,
  'P0001',
  'Solo se archiva un ahorro con saldo 0.',
  'no se archiva un propio con saldo'
);

select throws_ok(
  $$update public.savings
    set archived_at = now()
    where id = 'a4444444-4444-4444-8444-444444444444'$$,
  'P0001',
  'Solo se archiva un ahorro con saldo 0.',
  'no se archiva un compartido con saldo'
);

-- Vaciar el propio y archivar.
insert into public.saving_moves (
  saving_id, household_id, user_id, kind, amount, spent_on, period
) values (
  'a5555555-5555-4555-8555-555555555555',
  'a3333333-3333-4333-8333-333333333333',
  'a1111111-1111-4111-8111-111111111111',
  'retiro',
  40,
  '2026-11-10',
  '2026-11-01'
);

select lives_ok(
  $$update public.savings
    set archived_at = now()
    where id = 'a5555555-5555-4555-8555-555555555555'$$,
  'se archiva el propio con saldo 0'
);

select lives_ok(
  $$update public.savings
    set archived_at = null
    where id = 'a5555555-5555-4555-8555-555555555555'$$,
  'se puede restaurar un archivado'
);

-- Varios compartidos activos (P4).
select lives_ok(
  $$insert into public.savings (household_id, name, emoji, icon, is_shared, owner_id)
    values (
      'a3333333-3333-4333-8333-333333333333',
      'Auto',
      'car',
      'car',
      true,
      null
    )$$,
  'se puede crear un segundo compartido activo'
);

select is(
  (
    select count(*)
    from public.savings
    where household_id = 'a3333333-3333-4333-8333-333333333333'
      and is_shared
      and archived_at is null
  ),
  2::bigint,
  'quedan dos compartidos activos'
);

-- Alcance inmutable (P19).
select throws_ok(
  $$update public.savings
    set is_shared = false, owner_id = 'a1111111-1111-4111-8111-111111111111'
    where id = 'a4444444-4444-4444-8444-444444444444'$$,
  'P0001',
  'El alcance del ahorro no se puede cambiar. Creá otro.',
  'no se cambia el alcance'
);

select throws_ok(
  $$delete from public.savings where id = 'a4444444-4444-4444-8444-444444444444'$$,
  'P0001',
  'No se puede borrar un ahorro. Archiválo.',
  'no se puede borrar un ahorro'
);

select * from finish();
rollback;
