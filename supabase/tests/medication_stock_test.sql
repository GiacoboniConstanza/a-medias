begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a1111111-1111-4111-8111-111111111101',
    'stock-coty@example.test',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'a2222222-2222-4222-8222-222222222202',
    'stock-maru@example.test',
    '{"display_name":"Maru"}'::jsonb
  );

select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1111111-1111-4111-8111-111111111101","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.medications (id, user_id, name, dose_notes, stock_qty, units_per_dose)
values (
  'b1111111-1111-4111-8111-111111111101',
  'a1111111-1111-4111-8111-111111111101',
  'Losartán',
  '50 mg',
  5,
  1
);

insert into public.medication_periods (
  id, medication_id, user_id, starts_on, ends_on, started_at
)
values (
  'c1111111-1111-4111-8111-111111111101',
  'b1111111-1111-4111-8111-111111111101',
  'a1111111-1111-4111-8111-111111111101',
  '2026-11-01',
  null,
  timestamptz '2026-11-01 03:00:00+00'
);

insert into public.medication_schedules (id, medication_id, user_id, local_time)
values
  (
    'd1111111-1111-4111-8111-111111111101',
    'b1111111-1111-4111-8111-111111111101',
    'a1111111-1111-4111-8111-111111111101',
    '08:00'
  ),
  (
    'd1111111-1111-4111-8111-111111111102',
    'b1111111-1111-4111-8111-111111111101',
    'a1111111-1111-4111-8111-111111111101',
    '20:00'
  );

-- Descuento al marcar tomada
select is(
  (
    select stock_qty
    from public.set_medication_dose_with_stock(
      'b1111111-1111-4111-8111-111111111101',
      '2026-11-18',
      '08:00',
      'taken',
      'Losartán',
      '50 mg'
    )
  ),
  4,
  'marcar tomada descuenta 1'
);

select is(
  (
    select units_deducted
    from public.medication_doses
    where medication_id = 'b1111111-1111-4111-8111-111111111101'
      and dose_on = '2026-11-18'
      and scheduled_time = '08:00'
  ),
  1,
  'guarda unidades descontadas'
);

-- Devolución al desmarcar
select lives_ok(
  $$select public.set_medication_dose_with_stock(
      'b1111111-1111-4111-8111-111111111101',
      '2026-11-18',
      '08:00',
      null,
      '',
      null
    )$$,
  'desmarcar no falla'
);

select is(
  (select stock_qty from public.medications where id = 'b1111111-1111-4111-8111-111111111101'),
  5,
  'desmarcar devuelve exactamente lo descontado'
);

-- Piso 0: con stock 0 marca igual y descuenta 0
update public.medications
set stock_qty = 0
where id = 'b1111111-1111-4111-8111-111111111101';

select is(
  (
    select units_deducted
    from public.set_medication_dose_with_stock(
      'b1111111-1111-4111-8111-111111111101',
      '2026-11-18',
      '20:00',
      'taken',
      'Losartán',
      '50 mg'
    )
  ),
  0,
  'con stock 0 descuenta 0'
);

select is(
  (select stock_qty from public.medications where id = 'b1111111-1111-4111-8111-111111111101'),
  0,
  'stock no baja de 0'
);

-- Pasar a salteada no inventa unidades
select is(
  (
    select stock_qty
    from public.set_medication_dose_with_stock(
      'b1111111-1111-4111-8111-111111111101',
      '2026-11-18',
      '20:00',
      'skipped',
      'Losartán',
      '50 mg'
    )
  ),
  0,
  'saltear con 0 no inventa stock'
);

-- Sumar
update public.medications
set stock_qty = 5
where id = 'b1111111-1111-4111-8111-111111111101';

select is(
  (
    select stock_qty
    from public.add_medication_stock('b1111111-1111-4111-8111-111111111101', 30)
  ),
  35,
  'sumar 30 a 5 da 35'
);

-- Ajustar
select is(
  (
    select stock_qty
    from public.adjust_medication_stock('b1111111-1111-4111-8111-111111111101', 20)
  ),
  20,
  'ajustar a 20'
);

-- Concurrencia razonable: dos tomas del mismo día no descuentan de más
update public.medications set stock_qty = 2 where id = 'b1111111-1111-4111-8111-111111111101';
delete from public.medication_doses
where medication_id = 'b1111111-1111-4111-8111-111111111101';

select lives_ok(
  $$select public.set_medication_dose_with_stock(
      'b1111111-1111-4111-8111-111111111101', '2026-11-17', '08:00', 'taken', 'Losartán', null
    );
    select public.set_medication_dose_with_stock(
      'b1111111-1111-4111-8111-111111111101', '2026-11-17', '20:00', 'taken', 'Losartán', null
    )$$,
  'dos tomas en secuencia'
);

select is(
  (select stock_qty from public.medications where id = 'b1111111-1111-4111-8111-111111111101'),
  0,
  'dos tomas descuentan 2 y quedan 0'
);

-- Remarcar la misma no descuenta dos veces netas (vuelve y vuelve a descontar 1)
select is(
  (
    select stock_qty
    from public.set_medication_dose_with_stock(
      'b1111111-1111-4111-8111-111111111101',
      '2026-11-17',
      '08:00',
      'taken',
      'Losartán',
      null
    )
  ),
  0,
  'remarcar tomada con stock 0 sigue en 0'
);

-- Privacidad: la otra no ve ni cambia stock / movimientos
reset role;
select set_config('request.jwt.claim.sub', 'a2222222-2222-4222-8222-222222222202', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a2222222-2222-4222-8222-222222222202","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.medications where id = 'b1111111-1111-4111-8111-111111111101'),
  0::bigint,
  'otra no ve medicamento ni stock'
);

select is(
  (select count(*) from public.medication_stock_moves),
  0::bigint,
  'otra no ve movimientos'
);

select throws_ok(
  $$select public.add_medication_stock('b1111111-1111-4111-8111-111111111101', 10)$$,
  'P0001',
  'Ese medicamento no es tuyo',
  'otra no suma stock ajeno'
);

select throws_ok(
  $$select public.adjust_medication_stock('b1111111-1111-4111-8111-111111111101', 99)$$,
  'P0001',
  'Ese medicamento no es tuyo',
  'otra no ajusta stock ajeno'
);

select throws_ok(
  $$select public.set_medication_dose_with_stock(
      'b1111111-1111-4111-8111-111111111101',
      '2026-11-18',
      '08:00',
      'taken',
      'Ajeno',
      null
    )$$,
  'P0001',
  'Ese medicamento no es tuyo',
  'otra no marca toma con stock ajeno'
);

select * from finish();
rollback;
