begin;
select plan(18);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'sav-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'sav-maru@example.com', '{"display_name":"Maru"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0', 'SAVINGS1', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1');

update public.profiles
set household_id = 'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0'
where id in (
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'
);

-- Fondo Coty con allocations → fund_saved = 100.
insert into public.savings_funds (id, user_id, name, emoji, icon, target_amount)
values (
  'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1',
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'Colchón',
  'couch',
  'couch',
  500000
);

insert into public.income_extras (id, user_id, household_id, amount, label, received_on)
values (
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
  150,
  'Bonus',
  '2026-10-01'
);

insert into public.extra_allocations (extra_id, user_id, fund_id, amount) values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1', 100),
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', null, 50);

insert into public.shared_goals (id, household_id, name, emoji, icon, target_amount, target_date)
values (
  'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1',
  'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
  'Vacaciones',
  'umbrella-beach',
  'umbrella-beach',
  1200000,
  '2027-01-15'
);

insert into public.goal_contributions (goal_id, user_id, amount, mode) values
  ('g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 200, 'free'),
  ('g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 150, 'free');

-- Simula la migración de saldo inicial sobre estos datos.
insert into public.savings (
  id, household_id, name, emoji, icon, target_amount, target_date, is_shared, owner_id, archived_at, created_at
)
select
  f.id, p.household_id, f.name, f.emoji, f.icon, f.target_amount, f.target_date, false, f.user_id, f.archived_at, f.created_at
from public.savings_funds as f
join public.profiles as p on p.id = f.user_id
where f.id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1';

insert into public.saving_opening_balances (saving_id, user_id, amount)
select f.id, f.user_id, private.fund_saved(f.user_id, f.id)
from public.savings_funds as f
where f.id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1'
  and private.fund_saved(f.user_id, f.id) > 0;

insert into public.savings (
  id, household_id, name, emoji, icon, target_amount, target_date, is_shared, owner_id, archived_at, created_at
)
select g.id, g.household_id, g.name, g.emoji, g.icon, g.target_amount, g.target_date, true, null, g.archived_at, g.created_at
from public.shared_goals as g
where g.id = 'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1';

insert into public.saving_opening_balances (saving_id, user_id, amount)
select c.goal_id, c.user_id, sum(c.amount)
from public.goal_contributions as c
where c.goal_id = 'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1'
group by c.goal_id, c.user_id
having sum(c.amount) > 0;

insert into public.savings (
  id, household_id, name, emoji, icon, target_amount, is_shared, owner_id
) values (
  'g2g2g2g2-g2g2-42g2-82g2-g2g2g2g2g2g2',
  'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
  'Gustos',
  'bag-shopping',
  'bag-shopping',
  null,
  false,
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'
);

insert into public.saving_opening_balances (saving_id, user_id, amount)
values (
  'g2g2g2g2-g2g2-42g2-82g2-g2g2g2g2g2g2',
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  private.gustos_free('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1')
);

select is(
  (select amount from public.saving_opening_balances
    where saving_id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1'
      and user_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'),
  100::numeric,
  'saldo inicial del fondo = fund_saved'
);

select is(
  (select amount from public.saving_opening_balances
    where saving_id = 'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1'
      and user_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'),
  200::numeric,
  'saldo inicial compartido Coty = suma de aportes'
);

select is(
  (select amount from public.saving_opening_balances
    where saving_id = 'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1'
      and user_id = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'),
  150::numeric,
  'saldo inicial compartido Maru = suma de aportes'
);

select is(
  (select amount from public.saving_opening_balances
    where saving_id = 'g2g2g2g2-g2g2-42g2-82g2-g2g2g2g2g2g2'),
  50::numeric,
  'Gustos arranca con gustos_free'
);

select set_config('request.jwt.claim.sub', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.savings where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1'),
  0::bigint,
  'Maru no ve el ahorro propio de Coty'
);

select is(
  (select count(*) from public.savings where id = 'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1'),
  1::bigint,
  'Maru sí ve el compartido'
);

select throws_ok(
  $$insert into public.saving_moves (
      saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1',
      'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      'aporte',
      10,
      '2026-11-10',
      '2026-11-01'
    )$$,
  'P0001',
  'Solo podés anotar movimientos de ahorro a tu nombre',
  'no se puede cargar un movimiento a nombre de la otra'
);

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into public.saving_moves (
      saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1',
      'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      'retiro',
      101,
      '2026-11-10',
      '2026-11-01'
    )$$,
  'P0001',
  'No te alcanza lo ahorrado',
  'no se puede retirar más que el saldo total'
);

select throws_ok(
  $$insert into public.saving_moves (
      saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1',
      'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      'retiro',
      201,
      '2026-11-10',
      '2026-11-01'
    )$$,
  'P0001',
  'No te alcanza lo ahorrado',
  'en un compartido Coty no retira más que lo suyo'
);

select lives_ok(
  $$insert into public.saving_moves (
      id, saving_id, household_id, user_id, kind, amount, spent_on, period
    ) values (
      'm1m1m1m1-m1m1-41m1-81m1-m1m1m1m1m1m1',
      'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1',
      'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      'retiro',
      50,
      '2026-11-10',
      '2026-11-01'
    )$$,
  'Coty retira hasta lo suyo del compartido'
);

select lives_ok(
  $$insert into public.savings (
      id, household_id, name, emoji, icon, target_amount, is_shared, owner_id
    ) values (
      'g3g3g3g3-g3g3-43g3-83g3-g3g3g3g3g3g3',
      'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
      'Auto',
      'car',
      'car',
      null,
      true,
      null
    )$$,
  'se pueden tener varios compartidos activos'
);

select throws_ok(
  $$update public.savings
    set is_shared = false,
        owner_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'
    where id = 'g1g1g1g1-g1g1-41g1-81g1-g1g1g1g1g1g1'$$,
  'P0001',
  'El alcance del ahorro no se puede cambiar. Creá otro.',
  'el alcance es inmutable'
);

select throws_ok(
  $$update public.savings
    set archived_at = now()
    where id = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1'$$,
  'P0001',
  'Solo se archiva un ahorro con saldo 0.',
  'no se archiva con saldo'
);

select lives_ok(
  $$insert into public.savings (
      id, household_id, name, emoji, icon, is_shared, owner_id
    ) values (
      'z0z0z0z0-z0z0-40z0-80z0-z0z0z0z0z0z0',
      'h0h0h0h0-h0h0-40h0-80h0-h0h0h0h0h0h0',
      'Vacío',
      'box',
      'box',
      false,
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'
    )$$,
  'se crea un ahorro propio sin meta ni saldo'
);

select lives_ok(
  $$update public.savings
    set archived_at = now()
    where id = 'z0z0z0z0-z0z0-40z0-80z0-z0z0z0z0z0z0'$$,
  'se archiva con saldo 0'
);

select throws_ok(
  $$delete from public.savings where id = 'z0z0z0z0-z0z0-40z0-80z0-z0z0z0z0z0z0'$$,
  'P0001',
  'No se puede borrar un ahorro. Archiválo.',
  'no se puede borrar un ahorro'
);

select set_config('request.jwt.claim.sub', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2","role":"authenticated"}',
  true
);

update public.saving_moves
set amount = 10
where id = 'm1m1m1m1-m1m1-41m1-81m1-m1m1m1m1m1m1';

select is(
  (select amount from public.saving_moves where id = 'm1m1m1m1-m1m1-41m1-81m1-m1m1m1m1m1m1'),
  50::numeric,
  'Maru no edita el movimiento de Coty (RLS)'
);

delete from public.saving_moves where id = 'm1m1m1m1-m1m1-41m1-81m1-m1m1m1m1m1m1';

select is(
  (select count(*) from public.saving_moves where id = 'm1m1m1m1-m1m1-41m1-81m1-m1m1m1m1m1m1'),
  1::bigint,
  'Maru no borra el movimiento de Coty (RLS)'
);

select * from finish();
rollback;
