begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', 'loan-coty@example.com', '{"display_name":"Coty"}'::jsonb),
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', 'loan-maru@example.com', '{"display_name":"Maru"}'::jsonb),
  ('c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3', 'loan-otra@example.com', '{"display_name":"Otra"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0', 'PRESTAMO', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1');

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
  $$insert into public.loans (id, lender_id, borrower_id, amount, lent_on, notes)
    values (
      'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2',
      200000.00,
      '2026-11-02',
      'Hasta que cobre'
    )$$,
  'quien presta puede cargar el préstamo'
);

select is(
  (select status from public.loan_balances where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'),
  'pendiente',
  'sin devoluciones queda pendiente'
);

select throws_ok(
  $$insert into public.loans (lender_id, borrower_id, amount, lent_on)
    values (
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1',
      10,
      '2026-11-02'
    )$$,
  '23514',
  null,
  'no te podés prestar a vos misma'
);

reset role;
select set_config('request.jwt.claim.sub', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select pending from public.loan_balances where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'),
  200000.00::numeric,
  'quien recibe ve el pendiente'
);

select results_eq(
  $$update public.loans
    set amount = 1
    where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'
    returning id$$,
  $$select null::uuid where false$$,
  'quien recibe no edita el préstamo'
);

select lives_ok(
  $$insert into public.loan_repayments (id, loan_id, amount, paid_on)
    values (
      'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5',
      'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4',
      80000.00,
      '2026-11-10'
    )$$,
  'quien recibe puede devolver una parte'
);

select is(
  (
    select status || ' ' || pending::text
    from public.loan_balances
    where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'
  ),
  'parcial 120000.00',
  'una devolución parcial deja el resto pendiente'
);

select throws_ok(
  $$insert into public.loan_repayments (loan_id, amount, paid_on)
    values ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 120000.01, '2026-11-11')$$,
  'P0001',
  'La devolución supera lo que falta del préstamo',
  'no se puede devolver más que el préstamo'
);

reset role;
select set_config('request.jwt.claim.sub', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$update public.loans
    set amount = 70000
    where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'$$,
  'P0001',
  'La devolución supera lo que falta del préstamo',
  'el monto no puede bajar de lo ya devuelto'
);

select results_eq(
  $$delete from public.loan_repayments
    where id = 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5'
    returning id$$,
  $$select null::uuid where false$$,
  'quien prestó no borra la devolución de la otra'
);

select lives_ok(
  $$insert into public.loan_repayments (loan_id, amount, paid_on)
    values ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 120000.00, '2026-11-20')$$,
  'se puede devolver justo lo que falta'
);

select is(
  (select status from public.loan_balances where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'),
  'saldado',
  'al cubrir el monto queda saldado'
);

select throws_ok(
  $$insert into public.loan_repayments (loan_id, amount, paid_on)
    values ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4', 0.01, '2026-11-21')$$,
  'P0001',
  'La devolución supera lo que falta del préstamo',
  'un préstamo saldado no acepta otra devolución'
);

reset role;
select set_config('request.jwt.claim.sub', 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.loan_balances where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'),
  0::bigint,
  'alguien de otro hogar no ve el préstamo'
);

reset role;
select set_config('request.jwt.claim.sub', 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$delete from public.loan_repayments where id = 'c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c5c5'$$,
  'quien cargó la devolución puede borrarla'
);

reset role;
select set_config('request.jwt.claim.sub', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$delete from public.loans where id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'$$,
  'quien prestó puede borrar el préstamo'
);

select is_empty(
  $$select id from public.loan_repayments where loan_id = 'c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4'$$,
  'borrar el préstamo borra las devoluciones'
);

select * from finish();
rollback;
