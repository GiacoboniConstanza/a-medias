begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'settle-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', 'settle-maru@example.com', '{"display_name":"Maru"}'::jsonb),
  ('a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3', 'settle-otra@example.com', '{"display_name":"Otra"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0', 'SALDAMES', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1');

update public.profiles
set household_id = 'a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0'
where id in (
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
  'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2'
);

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$insert into public.loans (id, lender_id, borrower_id, amount, lent_on, period)
    values
      ('a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', 100.01, '2026-10-02', '2026-10-01'),
      ('a5a5a5a5-a5a5-45a5-85a5-a5a5a5a5a5a5', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', 50.00, '2026-11-02', '2026-11-01'),
      ('a6a6a6a6-a6a6-46a6-86a6-a6a6a6a6a6a6', 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', 40.00, '2026-12-02', '2026-12-01')$$,
  'quien presta carga los préstamos de octubre, noviembre y diciembre'
);

select lives_ok(
  $$insert into public.loan_repayments (id, loan_id, amount, paid_on, period, notes)
    values (
      'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7',
      'a5a5a5a5-a5a5-45a5-85a5-a5a5a5a5a5a5',
      10.00,
      '2026-11-15',
      '2026-11-01',
      'A mano'
    )$$,
  'una devolución cargada a mano queda en noviembre'
);

select throws_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      180.01,
      0,
      null,
      '[
        {"loan_id":"a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4","amount":100.01},
        {"loan_id":"a5a5a5a5-a5a5-45a5-85a5-a5a5a5a5a5a5","amount":40.00},
        {"loan_id":"a6a6a6a6-a6a6-46a6-86a6-a6a6a6a6a6a6","amount":40.00}
      ]'::jsonb
    )$$,
  'P0001',
  'Las devoluciones no coinciden con los préstamos pendientes',
  'préstamo de un mes posterior queda afuera'
);

select lives_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      140.01,
      0,
      null,
      '[
        {"loan_id":"a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4","amount":100.01},
        {"loan_id":"a5a5a5a5-a5a5-45a5-85a5-a5a5a5a5a5a5","amount":40.00}
      ]'::jsonb
    )$$,
  'préstamo de un mes anterior entra'
);

select is(
  (select pending from public.loan_balances where id = 'a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4'),
  0::numeric,
  'el préstamo de octubre queda devuelto al saldar noviembre'
);

select is(
  (select pending from public.loan_balances where id = 'a6a6a6a6-a6a6-46a6-86a6-a6a6a6a6a6a6'),
  40.00::numeric,
  'el préstamo de diciembre sigue pendiente'
);

select is(
  (select count(*) from public.loan_repayments where settlement_id is not null and paid_on = '2026-11-30' and period = '2026-11-01'),
  2::bigint,
  'las devoluciones del saldo cuentan el último día de noviembre'
);

select is(
  (select amount from public.settlements where month = '2026-11-01'),
  140.01::numeric,
  'el saldo guarda el neto en centavos'
);

select is(
  (select settlement_id from public.loan_repayments where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7'),
  null::uuid,
  'la devolución a mano no queda vinculada al saldo'
);

select throws_ok(
  $$select public.settle_shared_month(
      '2026-11-01',
      'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2',
      'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1',
      140.01,
      0,
      null,
      '[]'::jsonb
    )$$,
  'P0001',
  'Ese mes ya está saldado',
  'no se puede saldar dos veces el mismo mes'
);

select throws_ok(
  $$delete from public.loan_repayments where settlement_id is not null$$,
  'P0001',
  'La devolución del saldo se borra al deshacer el mes',
  'no se borra a mano la devolución del saldo'
);

reset role;
select set_config('request.jwt.claim.sub', 'a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a3a3a3a3-a3a3-43a3-83a3-a3a3a3a3a3a3","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.settlements where month = '2026-11-01'),
  0::bigint,
  'alguien de otro hogar no ve el saldo'
);

select throws_ok(
  $$select public.undo_shared_month((
      select id from public.settlements where month = '2026-11-01' limit 1
    ))$$,
  'P0001',
  'Ese saldo no es de tu hogar',
  'alguien de otro hogar no deshace el saldo'
);

reset role;
select set_config('request.jwt.claim.sub', 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.undo_shared_month((
      select id from public.settlements where month = '2026-11-01'
    ))$$,
  'la otra del hogar puede deshacer el mes'
);

select is(
  (select count(*) from public.loan_repayments where id = 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7'),
  1::bigint,
  'deshacer no borra la devolución cargada a mano'
);

select is(
  (select count(*) from public.loan_repayments where notes = 'Saldado con el mes'),
  0::bigint,
  'deshacer borra solo las devoluciones del saldo'
);

select is(
  (select pending from public.loan_balances where id = 'a4a4a4a4-a4a4-44a4-84a4-a4a4a4a4a4a4'),
  100.01::numeric,
  'al deshacer vuelve el pendiente de octubre'
);

select * from finish();
rollback;
