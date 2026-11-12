begin;
select plan(12);

-- IDs que no chocan con seed.sql (1111… / aaaa… / 0101…).
insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1a10001-aaaa-4aaa-8aaa-000000000001', 'mp-coty@example.com', '{"display_name":"Coty MP"}'::jsonb),
  ('a1a10002-bbbb-4bbb-8bbb-000000000002', 'mp-maru@example.com', '{"display_name":"Maru MP"}'::jsonb);

insert into public.households (id, invite_code, created_by)
values ('a1a10000-cccc-4ccc-8ccc-000000000000', 'MPIMPORT', 'a1a10001-aaaa-4aaa-8aaa-000000000001');

update public.profiles
set household_id = 'a1a10000-cccc-4ccc-8ccc-000000000000'
where id in (
  'a1a10001-aaaa-4aaa-8aaa-000000000001',
  'a1a10002-bbbb-4bbb-8bbb-000000000002'
);

insert into public.categories (id, household_id, name, emoji, icon)
values (
  'a1a100ca-dddd-4ddd-8ddd-000000000001',
  'a1a10000-cccc-4ccc-8ccc-000000000000',
  'Súper MP',
  '🛒',
  'cart-shopping'
);

select set_config('request.jwt.claim.sub', 'a1a10001-aaaa-4aaa-8aaa-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a10001-aaaa-4aaa-8aaa-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.import_mp_movements(
    '[
      {"type":"expense","date":"2026-11-01","amount":35078.20,"title":"La Anonima","category_id":"a1a100ca-dddd-4ddd-8ddd-000000000001","is_shared":true,"mp_operation_id":"186176544447"},
      {"type":"income","date":"2026-11-02","amount":3284.67,"title":"Rendimientos","category_id":null,"is_shared":false,"mp_operation_id":"1752498663392"},
      {"type":"transfer","date":"2026-11-05","amount":800000,"title":"Companera Ejemplo","category_id":null,"is_shared":false,"mp_operation_id":"186860352921","transfer_direction":"received"},
      {"type":"credito_mp","date":"2026-11-10","amount":110356.47,"title":"Creditos Mercado Pago","category_id":null,"is_shared":false,"mp_operation_id":"3731351087"},
      {"type":"credito_mp","date":"2026-11-10","amount":16860.41,"title":"Creditos Mercado Pago","category_id":null,"is_shared":false,"mp_operation_id":"3823155186"}
    ]'::jsonb,
    '[{"normalized_name":"companera ejemplo apellido","user_id":"a1a10002-bbbb-4bbb-8bbb-000000000002"}]'::jsonb,
    '[{"merchant_key":"la anonima","category_id":"a1a100ca-dddd-4ddd-8ddd-000000000001","is_shared":true}]'::jsonb,
    true
  )$$,
  'importa lote mixto con aviso de Créditos MP'
);

select is(
  (select count(*) from public.expenses where owner_id = 'a1a10001-aaaa-4aaa-8aaa-000000000001' and mp_operation_id is not null),
  3::bigint,
  'tres gastos con ID de operación (pago + dos débitos)'
);

select is(
  (select count(*) from public.income_extras where user_id = 'a1a10001-aaaa-4aaa-8aaa-000000000001' and mp_operation_id = '1752498663392'),
  1::bigint,
  'rendimientos como ingreso'
);

select is(
  (select count(*) from public.transfers where created_by = 'a1a10001-aaaa-4aaa-8aaa-000000000001' and mp_operation_id = '186860352921'),
  1::bigint,
  'transferencia recibida de la compañera'
);

select is(
  (select count(*) from public.fixed_expenses where owner_id = 'a1a10001-aaaa-4aaa-8aaa-000000000001' and mp_source = 'credito_mp'),
  1::bigint,
  'crea el aviso privado de Créditos MP'
);

select is(
  (select amount from public.fixed_payments fp
    join public.fixed_expenses fe on fe.id = fp.fixed_expense_id
    where fe.mp_source = 'credito_mp' and fe.owner_id = 'a1a10001-aaaa-4aaa-8aaa-000000000001'),
  127216.88::numeric,
  'un solo pago fijo con la suma de los dos débitos del mes'
);

select is(
  (public.import_mp_movements(
    '[{"type":"expense","date":"2026-11-01","amount":35078.20,"title":"La Anonima","category_id":null,"is_shared":true,"mp_operation_id":"186176544447"}]'::jsonb
  ) ->> 'skipped')::integer,
  1,
  'ID repetido se saltea'
);

select throws_ok(
  $$select public.import_mp_movements(
    '[
      {"type":"expense","date":"2026-11-03","amount":10,"title":"Ok","category_id":null,"is_shared":false,"mp_operation_id":"1111111111"},
      {"type":"expense","date":"2026-11-03","amount":-5,"title":"Mal","category_id":null,"is_shared":false,"mp_operation_id":"2222222222"}
    ]'::jsonb
  )$$,
  'P0001',
  'Fila de importación incompleta',
  'lote inválido no inserta'
);

select is(
  (select count(*) from public.expenses where mp_operation_id = '1111111111'),
  0::bigint,
  'el lote fallido no dejó la fila válida'
);

select set_config('request.jwt.claim.sub', 'a1a10002-bbbb-4bbb-8bbb-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a10002-bbbb-4bbb-8bbb-000000000002","role":"authenticated"}',
  true
);

select throws_ok(
  $$insert into public.mp_counterpart_aliases (owner_id, normalized_name, user_id)
    values (
      'a1a10001-aaaa-4aaa-8aaa-000000000001',
      'otro nombre',
      'a1a10002-bbbb-4bbb-8bbb-000000000002'
    )$$,
  '42501',
  null,
  'no podés escribir alias de la otra'
);

select is(
  (select count(*) from public.mp_merchant_prefs where owner_id = 'a1a10001-aaaa-4aaa-8aaa-000000000001'),
  0::bigint,
  'no ves preferencias de la otra'
);

select lives_ok(
  $$insert into public.mp_merchant_prefs (owner_id, merchant_key, category_id, is_shared)
    values (
      'a1a10002-bbbb-4bbb-8bbb-000000000002',
      'mi comercio',
      null,
      false
    )$$,
  'sí podés guardar tus preferencias'
);

select * from finish();
rollback;
