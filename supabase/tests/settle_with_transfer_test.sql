begin;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'swt-coty@example.test', '{"display_name":"Coty"}'::jsonb),
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'swt-maru@example.test', '{"display_name":"Maru"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0', 'SALDATRF', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1');

update public.profiles
set household_id = 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0'
where id in (
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
);

insert into public.categories (id, household_id, name, emoji, icon)
values (
  'c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9',
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  'Súper',
  'cart-shopping',
  'cart-shopping'
);

insert into public.expenses (
  household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
) values (
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  'c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9',
  'Verdulería',
  10000.00,
  '2026-11-02',
  '2026-11-01',
  true
);

insert into public.transfers (id, from_id, to_id, amount, transferred_on, period, notes, created_by)
values (
  'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c8c8',
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
  500.00,
  '2026-11-03',
  '2026-11-01',
  'Manual',
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
);

select set_config('request.jwt.claim.sub', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      4000.00,
      4000.00,
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      false
    )$$,
  'saldar con switch apagado'
);

select is(
  (select count(*) from public.transfers where period = '2026-11-01'),
  1::bigint,
  'sin transferencia: solo queda la manual'
);

select lives_ok(
  $$select public.undo_shared_month(
      (select id from public.settlements where month = '2026-11-01')
    )$$,
  'deshacer sin transferencia vinculada'
);

select lives_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      4000.00,
      4000.00,
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
    )$$,
  'saldar con transferencia (default)'
);

select is(
  (select count(*) from public.transfers where period = '2026-11-01'),
  2::bigint,
  'con transferencia: manual + saldo'
);

select is(
  (
    select count(*) from public.transfers as t
    join public.settlements as s on s.id = t.settlement_id
    where s.month = '2026-11-01'
      and t.from_id = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
      and t.to_id = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
      and t.amount = 4000.00
      and t.period = '2026-11-01'
  ),
  1::bigint,
  'transferencia del saldo: deudora → acreedora, period = mes'
);

select set_config(
  'test.settle_transfer',
  (
    select t.id::text from public.transfers as t
    where t.settlement_id = (select id from public.settlements where month = '2026-11-01')
  ),
  true
);

select throws_ok(
  $$update public.transfers set amount = 1 where settlement_id is not null$$,
  'P0001',
  'Para cambiarla, deshacé el saldo',
  'no se edita la transferencia del saldo'
);

select throws_ok(
  $$delete from public.transfers where settlement_id is not null$$,
  'P0001',
  'Para cambiarla, deshacé el saldo',
  'no se borra la transferencia del saldo a mano'
);

select throws_ok(
  format(
    $sql$select public.delete_movements(
      '2026-11-01',
      '{}'::uuid[],
      '{}'::uuid[],
      array[%L::uuid],
      '{}'::uuid[]
    )$sql$,
    current_setting('test.settle_transfer')
  ),
  'P0001',
  'Ese mes está saldado. Deshacé el saldo en Resumen para eliminar varios.',
  'delete_movements bloquea el mes saldado'
);

select lives_ok(
  $$select public.undo_shared_month(
      (select id from public.settlements where month = '2026-11-01')
    )$$,
  'deshacer con transferencia vinculada'
);

select is(
  (select count(*) from public.transfers where id = 'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c8c8'),
  1::bigint,
  'deshacer no toca la transferencia manual'
);

select is(
  (
    select count(*) from public.transfers
    where id = current_setting('test.settle_transfer')::uuid
  ),
  0::bigint,
  'deshacer borra la transferencia del saldo'
);

-- Mes de noviembre libre: settlement de octubre + transferencia vinculada con period noviembre.
reset role;
insert into public.settlements (id, household_id, month, debtor_id, creditor_id, amount, settled_by)
values (
  'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  '2026-10-01',
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  100,
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
);
select set_config('app.registering_settlement_transfer', '1', true);
insert into public.transfers (id, from_id, to_id, amount, transferred_on, period, created_by, settlement_id)
values (
  'c6c6c6c6-c6c6-46c6-86c6-c6c6c6c6c6c6',
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  100,
  '2026-11-10',
  '2026-11-01',
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7'
);

select set_config('request.jwt.claim.sub', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$select public.delete_movements(
      '2026-11-01',
      '{}'::uuid[],
      '{}'::uuid[],
      array['c6c6c6c6-c6c6-46c6-86c6-c6c6c6c6c6c6'::uuid],
      '{}'::uuid[]
    )$$,
  'P0001',
  'Para cambiarla, deshacé el saldo',
  'delete_movements excluye la transferencia vinculada al saldo'
);

select * from finish();
rollback;
