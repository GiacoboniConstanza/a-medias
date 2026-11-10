begin;
select plan(29);

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

insert into public.shared_goals (id, household_id, name, emoji, icon, target_amount, target_date, created_at)
values (
  'a4444444-4444-4444-8444-444444444444',
  'a3333333-3333-4333-8333-333333333333',
  'Viaje',
  'piggy-bank',
  'piggy-bank',
  1000,
  '2027-01-01',
  timestamptz '2026-01-01'
);

insert into public.goal_contributions (goal_id, user_id, amount, mode)
values ('a4444444-4444-4444-8444-444444444444', 'a1111111-1111-4111-8111-111111111111', 100, 'free');

insert into public.savings_funds (id, user_id, name, emoji, icon, target_amount)
values
  ('a5555555-5555-4555-8555-555555555555', 'a1111111-1111-4111-8111-111111111111', 'Sillón', 'couch', 'couch', 500),
  ('a5555555-5555-4555-8555-555555555556', 'a1111111-1111-4111-8111-111111111111', 'Plantas', 'leaf', 'leaf', 200),
  ('a5555555-5555-4555-8555-555555555557', 'a2222222-2222-4222-8222-222222222222', 'Curso', 'book', 'book', 80);

insert into public.income_extras (id, user_id, household_id, amount, label, received_on)
values (
  'a6666666-6666-4666-8666-666666666666',
  'a1111111-1111-4111-8111-111111111111',
  'a3333333-3333-4333-8333-333333333333',
  40,
  'Extra',
  '2026-06-01'
);

insert into public.extra_allocations (extra_id, user_id, fund_id, amount)
values ('a6666666-6666-4666-8666-666666666666', 'a1111111-1111-4111-8111-111111111111', 'a5555555-5555-4555-8555-555555555555', 40);

select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222222', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.shared_goals
    set name = 'Viaje largo', target_amount = 1200, target_date = '2027-06-01'
    where id = 'a4444444-4444-4444-8444-444444444444'$$,
  'la otra persona edita el nombre y la meta del compartido'
);

select lives_ok(
  $$update public.shared_goals
    set archived_at = statement_timestamp()
    where id = 'a4444444-4444-4444-8444-444444444444'$$,
  'cualquiera archiva el compartido'
);

select is(
  (select count(*) from public.goal_contributions where goal_id = 'a4444444-4444-4444-8444-444444444444'),
  1::bigint,
  'archivar el compartido deja los aportes'
);

select lives_ok(
  $$update public.shared_goals
    set archived_at = null
    where id = 'a4444444-4444-4444-8444-444444444444'$$,
  'cualquiera restaura el compartido'
);

select is(
  (select count(*) from public.savings_funds where id = 'a5555555-5555-4555-8555-555555555555'),
  0::bigint,
  'la otra persona no ve un privado ajeno'
);

select results_eq(
  $$update public.savings_funds
    set archived_at = statement_timestamp()
    where id = 'a5555555-5555-4555-8555-555555555555'
    returning id$$,
  $$select null::uuid where false$$,
  'la otra persona no archiva un privado ajeno'
);

reset role;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.savings_funds
    set archived_at = statement_timestamp()
    where id = 'a5555555-5555-4555-8555-555555555555'$$,
  'la dueña archiva su privado'
);

reset role;

select is(
  private.fund_saved('a1111111-1111-4111-8111-111111111111', 'a5555555-5555-4555-8555-555555555555'),
  40::numeric,
  'un privado archivado conserva la plata'
);

set local role authenticated;

select lives_ok(
  $$update public.savings_funds
    set archived_at = null
    where id = 'a5555555-5555-4555-8555-555555555555'$$,
  'la dueña restaura su privado'
);

reset role;

select is(
  private.fund_saved('a1111111-1111-4111-8111-111111111111', 'a5555555-5555-4555-8555-555555555555'),
  40::numeric,
  'al restaurar el privado vuelve la misma plata'
);

set local role authenticated;

select throws_ok(
  $$insert into public.shared_goals (household_id, name, emoji, icon, target_amount)
    values ('a3333333-3333-4333-8333-333333333333', 'Otro', 'piggy-bank', 'piggy-bank', 10)$$,
  '23505',
  null,
  'un insert directo no deja dos compartidos activos'
);

select lives_ok(
  $$select public.replace_active_shared_goal(null, 'Nuevo', 'umbrella-beach', 800, '2028-01-01')$$,
  'crear otro compartido archiva el actual en la misma operación'
);

select is(
  (select count(*) from public.shared_goals where household_id = 'a3333333-3333-4333-8333-333333333333' and archived_at is null),
  1::bigint,
  'después de crear queda un solo compartido activo'
);

select isnt(
  (select archived_at from public.shared_goals where id = 'a4444444-4444-4444-8444-444444444444'),
  null,
  'el compartido anterior quedó archivado'
);

select is(
  (select count(*) from public.goal_contributions where goal_id = 'a4444444-4444-4444-8444-444444444444'),
  1::bigint,
  'los aportes del compartido archivado siguen'
);

select lives_ok(
  $$select public.replace_active_shared_goal(
    'a4444444-4444-4444-8444-444444444444', null, null, null, null
  )$$,
  'restaurar el viejo archiva el actual'
);

select is(
  (select archived_at from public.shared_goals where id = 'a4444444-4444-4444-8444-444444444444'),
  null,
  'el deshacer deja activo el anterior'
);

select is(
  (
    select count(*)
    from public.shared_goals
    where household_id = 'a3333333-3333-4333-8333-333333333333'
      and archived_at is null
      and id <> 'a4444444-4444-4444-8444-444444444444'
  ),
  0::bigint,
  'el compartido nuevo queda archivado'
);

select throws_ok(
  $$update public.shared_goals
    set archived_at = null
    where household_id = 'a3333333-3333-4333-8333-333333333333'$$,
  '23505',
  null,
  'un update directo no deja dos compartidos activos'
);

select throws_ok(
  $$insert into public.goal_contributions (goal_id, user_id, amount, mode)
    select id, 'a1111111-1111-4111-8111-111111111111', 10, 'free'
    from public.shared_goals
    where household_id = 'a3333333-3333-4333-8333-333333333333'
      and archived_at is not null
    limit 1$$,
  'P0001',
  null,
  'no se suma un aporte a un compartido archivado'
);

select throws_ok(
  $$update public.shared_goals
    set name = 'Cambiado'
    where archived_at is not null$$,
  'P0001',
  null,
  'no se edita el nombre de un compartido archivado'
);

select lives_ok(
  $$update public.savings_funds
    set archived_at = statement_timestamp()
    where id = 'a5555555-5555-4555-8555-555555555555'$$,
  'se vuelve a archivar el privado para frenar la plata'
);

select throws_ok(
  $$update public.extra_allocations
    set amount = 39
    where fund_id = 'a5555555-5555-4555-8555-555555555555'$$,
  'P0001',
  null,
  'no se cambia la plata de un privado archivado'
);

reset role;

select throws_ok(
  $$insert into public.bag_movements (user_id, kind, fund_id, amount, happened_on)
    values (
      'a1111111-1111-4111-8111-111111111111',
      'to_gustos',
      'a5555555-5555-4555-8555-555555555555',
      10,
      '2026-11-02'
    )$$,
  'P0001',
  null,
  'no se saca plata de un privado archivado'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

select is(
  position(
    'a5555555-5555-4555-8555-555555555555' in (private.year_balance(2026, date '2026-11-02') -> 'funds')::text
  ),
  0,
  'Mi año no muestra el fondo archivado'
);

select ok(
  position(
    'a5555555-5555-4555-8555-555555555556' in (private.year_balance(2026, date '2026-11-02') -> 'funds')::text
  ) > 0,
  'Mi año sigue mostrando el fondo activo'
);

select is(
  (private.year_balance(2026, date '2026-11-02') -> 'goal' ->> 'id'),
  'a4444444-4444-4444-8444-444444444444',
  'Mi año toma el compartido activo y no el último creado'
);

-- Transferencias (P9): se pueden cargar y editar aunque el mes esté saldado.
select lives_ok(
  $$insert into public.transfers (id, from_id, to_id, amount, transferred_on, period)
    values (
      'a9999999-9999-4999-8999-999999999999',
      'a1111111-1111-4111-8111-111111111111',
      'a2222222-2222-4222-8222-222222222222',
      80,
      '2026-09-02',
      '2026-09-01'
    )$$,
  'se puede cargar una transferencia'
);

reset role;
insert into public.settlements (id, household_id, month, debtor_id, creditor_id, amount, settled_by)
values (
  'a8888888-8888-4888-8888-888888888888',
  'a3333333-3333-4333-8333-333333333333',
  '2026-09-01',
  'a2222222-2222-4222-8222-222222222222',
  'a1111111-1111-4111-8111-111111111111',
  50,
  'a1111111-1111-4111-8111-111111111111'
);

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$update public.transfers
    set notes = 'mes saldado'
    where id = 'a9999999-9999-4999-8999-999999999999'$$,
  'en un mes saldado se puede editar la transferencia'
);

select lives_ok(
  $$insert into public.transfers (from_id, to_id, amount, transferred_on, period)
    values (
      'a1111111-1111-4111-8111-111111111111',
      'a2222222-2222-4222-8222-222222222222',
      10,
      '2026-09-15',
      '2026-09-01'
    )$$,
  'en un mes saldado se puede cargar otra transferencia'
);

select * from finish();
rollback;
