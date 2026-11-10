begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'xfer-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'xfer-maru@example.com', '{"display_name":"Maru"}'::jsonb),
  ('c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3', 'xfer-otra@example.com', '{"display_name":"Otra"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0', 'TRANSFER', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1');

update public.profiles
set household_id = 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0'
where id in (
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2'
);

select set_config('request.jwt.claim.sub', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.transfers (id, from_id, to_id, amount, transferred_on, notes)
    values (
      'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      20000.00,
      '2026-11-02',
      'Mitad del regalo'
    )$$,
  'quien manda puede cargar la transferencia'
);

select is(
  (select period from public.transfers where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'),
  '2026-11-01'::date,
  'sin período, usa el mes de la fecha'
);

select lives_ok(
  $$insert into public.transfers (id, from_id, to_id, amount, transferred_on, period)
    values (
      'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      15000.00,
      '2026-11-05',
      '2026-11-01'
    )$$,
  'quien recibe también puede anotar que le pasaron'
);

select throws_ok(
  $$insert into public.transfers (from_id, to_id, amount, transferred_on)
    values (
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3',
      10.00,
      '2026-11-02'
    )$$,
  'P0001',
  'La transferencia es entre las dos del hogar',
  'no se puede transferir fuera del hogar'
);

select throws_ok(
  $$insert into public.transfers (from_id, to_id, amount, transferred_on)
    values (
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      10.00,
      '2026-11-02'
    )$$,
  '23514',
  'new row for relation "transfers" violates check constraint "transfers_distinct_parties"',
  'no se puede transferir a sí misma'
);

-- Mes saldado: las transferencias siguen permitidas (P9).
insert into public.settlements (id, household_id, month, debtor_id, creditor_id, amount, settled_by)
values (
  'c6c6c6c6-c6c6-46c6-86c6-c6c6c6c6c6c6',
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  '2026-11-01',
  'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
  100.00,
  'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1'
);

select lives_ok(
  $$insert into public.transfers (from_id, to_id, amount, transferred_on, period)
    values (
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      5.00,
      '2026-11-20',
      '2026-11-01'
    )$$,
  'en un mes saldado se pueden cargar transferencias'
);

select lives_ok(
  $$update public.transfers
    set notes = 'editada'
    where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'$$,
  'quien la cargó puede editarla'
);

select set_config('request.jwt.claim.sub', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2","role":"authenticated"}',
  true
);

select throws_ok(
  $$delete from public.transfers where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'$$,
  'P0001',
  'Solo quien la cargó puede borrar la transferencia',
  'la otra no borra la transferencia ajena'
);

select set_config('request.jwt.claim.sub', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}',
  true
);

select lives_ok(
  $$delete from public.transfers where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'$$,
  'quien la cargó puede borrarla'
);

-- Título de gasto opcional (P4).
insert into public.categories (id, household_id, owner_id, name, emoji, icon)
values (
  'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
  'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
  null,
  'Súper',
  'cart-shopping',
  'cart-shopping'
);

select lives_ok(
  $$insert into public.expenses (
      household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
    ) values (
      'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7',
      null,
      12000.00,
      '2026-12-02',
      '2026-12-01',
      true
    )$$,
  'el gasto acepta título nulo'
);

select lives_ok(
  $$insert into public.expenses (
      household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
    ) values (
      'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      null,
      null,
      500.00,
      '2026-12-03',
      '2026-12-01',
      false
    )$$,
  'el gasto acepta categoría nula'
);

select * from finish();
rollback;
