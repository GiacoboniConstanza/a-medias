begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'settle-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', 'settle-maru@example.com', '{"display_name":"Maru"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0', 'SALDAMES', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1');

update public.profiles
set household_id = 'a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0'
where id in (
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2'
);

insert into public.categories (id, household_id, owner_id, name, emoji, icon)
values (
  'a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a9a9',
  'a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0',
  null,
  'Súper',
  'cart-shopping',
  'cart-shopping'
);

insert into public.expenses (
  household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
) values (
  'a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0',
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a9a9',
  'Verdulería',
  10000.00,
  '2026-11-02',
  '2026-11-01',
  true
);

-- Transferencia del mes: no entra al saldo compartido.
insert into public.transfers (from_id, to_id, amount, transferred_on, period, notes, created_by)
values (
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
  20000.00,
  '2026-11-05',
  '2026-11-01',
  'No suma al saldo',
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'
);

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1","role":"authenticated"}',
  true
);
set local role authenticated;

-- Con sueldos 60/40, Coty pagó 10000 → Maru debe 4000.
select lives_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      4000.00,
      4000.00,
      'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2'
    )$$,
  'saldar el mes cierra solo el reparto de gastos'
);

select is(
  (select amount from public.settlements where month = '2026-11-01'),
  4000.00::numeric,
  'el monto del saldo es el del reparto, sin transferencias'
);

select is(
  (select count(*) from public.transfers where period = '2026-11-01'),
  1::bigint,
  'saldar no crea ni borra transferencias'
);

select throws_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      4000.00,
      4000.00,
      'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2'
    )$$,
  'P0001',
  'Ese mes ya está saldado',
  'no se puede saldar dos veces'
);

select throws_ok(
  $$select public.settle_shared_month(
      '2026-12-01',
      'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      100.00,
      0,
      null
    )$$,
  'P0001',
  'No hay nada para saldar este mes.',
  'sin gastos compartidos no se salda'
);

select lives_ok(
  $$select public.undo_shared_month(
      (select id from public.settlements where month = '2026-11-01')
    )$$,
  'deshacer borra el saldo'
);

select is(
  (select count(*) from public.settlements where month = '2026-11-01'),
  0::bigint,
  'después de deshacer no queda el saldo'
);

select is(
  (select count(*) from public.transfers where period = '2026-11-01'),
  1::bigint,
  'deshacer no toca las transferencias (tampoco las que vinieron de devoluciones del saldo)'
);

select * from finish();
rollback;
