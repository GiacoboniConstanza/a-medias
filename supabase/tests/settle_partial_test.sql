begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', 'partial-coty@example.test', '{"display_name":"Coty"}'::jsonb),
  ('e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2', 'partial-maru@example.test', '{"display_name":"Maru"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0', 'SALDAPAR', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1');

update public.profiles
set household_id = 'e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0'
where id in (
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2'
);

insert into public.categories (id, household_id, name, emoji, icon)
values (
  'e9e9e9e9-e9e9-49e9-89e9-e9e9e9e9e9e9',
  'e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0',
  'Súper',
  'cart-shopping',
  'cart-shopping'
);

insert into public.expenses (
  household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
) values (
  'e0e0e0e0-e0e0-40e0-80e0-e0e0e0e0e0e0',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
  'e9e9e9e9-e9e9-49e9-89e9-e9e9e9e9e9e9',
  'Verdulería',
  10000.00,
  '2026-11-02',
  '2026-11-01',
  true
);

select set_config('request.jwt.claim.sub', 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1","role":"authenticated"}',
  true
);
set local role authenticated;

-- Rechazos
select throws_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      0,
      4000.00,
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
      false
    )$$,
  'P0001',
  'El monto a saldar no cierra',
  'rechaza monto ≤ 0'
);

select throws_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      4000.01,
      4000.00,
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
      false
    )$$,
  'P0001',
  'El monto a saldar no cierra',
  'rechaza monto > neto'
);

-- Parcial sin transferencia
select lives_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      2500.00,
      4000.00,
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
      false
    )$$,
  'saldar por menos sin transferencia'
);

select is(
  (select amount from public.settlements where month = '2026-11-01'),
  2500.00::numeric,
  'amount = monto pagado'
);

select is(
  (select expected_amount from public.settlements where month = '2026-11-01'),
  4000.00::numeric,
  'expected_amount = neto'
);

select is(
  (select count(*) from public.transfers where settlement_id is not null),
  0::bigint,
  'sin transferencia cuando el switch está apagado'
);

select lives_ok(
  $$select public.undo_shared_month(
      (select id from public.settlements where month = '2026-11-01')
    )$$,
  'deshacer saldo parcial'
);

-- Parcial con transferencia
select lives_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
      'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1',
      3000.00,
      4000.00,
      'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2',
      true
    )$$,
  'saldar por menos con transferencia'
);

select is(
  (
    select t.amount from public.transfers as t
    join public.settlements as s on s.id = t.settlement_id
    where s.month = '2026-11-01'
  ),
  3000.00::numeric,
  'transferencia del saldo = monto pagado'
);

select is(
  (select amount from public.settlements where month = '2026-11-01'),
  3000.00::numeric,
  'con transferencia: amount = pagado'
);

select is(
  (select expected_amount from public.settlements where month = '2026-11-01'),
  4000.00::numeric,
  'con transferencia: expected_amount = neto'
);

select * from finish();
rollback;
