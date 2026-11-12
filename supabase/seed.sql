-- Datos de ejemplo para `supabase db reset`.
-- Coty: coty@example.com / amedias-demo
-- Maru: maru@example.com / amedias-demo
-- El reparto de octubre 2026 queda 60/40 y Maru le debe $ 84.000 a Coty.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'coty@example.com',
    extensions.crypt('amedias-demo', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Coty"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'maru@example.com',
    extensions.crypt('amedias-demo', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Maru"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) values
  (
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    '{"sub":"11111111-1111-4111-8111-111111111111","email":"coty@example.com","email_verified":true}'::jsonb,
    'email',
    '11111111-1111-4111-8111-111111111111',
    now(),
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    '{"sub":"22222222-2222-4222-8222-222222222222","email":"maru@example.com","email_verified":true}'::jsonb,
    'email',
    '22222222-2222-4222-8222-222222222222',
    now(),
    now(),
    now()
  );

insert into public.households (id, invite_code, created_by)
values ('01010101-0101-4101-8101-010101010101', 'CASERA26', '11111111-1111-4111-8111-111111111111');

update public.profiles
set
  household_id = '01010101-0101-4101-8101-010101010101',
  display_name = 'Coty'
where id = '11111111-1111-4111-8111-111111111111';

update public.profiles
set
  household_id = '01010101-0101-4101-8101-010101010101',
  display_name = 'Maru'
where id = '22222222-2222-4222-8222-222222222222';

insert into public.categories (id, household_id, name, emoji, icon) values
  ('aaaaaaaa-0001-4000-8000-000000000001', '01010101-0101-4101-8101-010101010101', 'Súper', '🛒', 'cart-shopping'),
  ('aaaaaaaa-0002-4000-8000-000000000002', '01010101-0101-4101-8101-010101010101', 'Comida', '🍕', 'pizza-slice'),
  ('aaaaaaaa-0003-4000-8000-000000000003', '01010101-0101-4101-8101-010101010101', 'Viajes', '🚌', 'bus'),
  ('aaaaaaaa-0004-4000-8000-000000000004', '01010101-0101-4101-8101-010101010101', 'Servicios', '💡', 'lightbulb'),
  ('aaaaaaaa-0005-4000-8000-000000000005', '01010101-0101-4101-8101-010101010101', 'Salidas', '🎉', 'champagne-glasses'),
  ('aaaaaaaa-0006-4000-8000-000000000006', '01010101-0101-4101-8101-010101010101', 'Hogar', '🏠', 'house'),
  ('aaaaaaaa-0009-4000-8000-000000000009', '01010101-0101-4101-8101-010101010101', 'Ropa', '👗', 'shirt'),
  ('aaaaaaaa-000a-4000-8000-00000000000a', '01010101-0101-4101-8101-010101010101', 'Café', '☕', 'mug-hot'),
  ('aaaaaaaa-000b-4000-8000-00000000000b', '01010101-0101-4101-8101-010101010101', 'Salud', '🩺', 'stethoscope');


insert into public.base_salaries (user_id, amount, effective_from) values
  ('11111111-1111-4111-8111-111111111111', 900000, '2026-10-01'),
  ('22222222-2222-4222-8222-222222222222', 600000, '2026-10-01');


insert into public.income_extras (id, user_id, household_id, amount, label, received_on) values
  ('eeeeeeee-0001-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '01010101-0101-4101-8101-010101010101', 335000, 'Ahorros anteriores', '2026-09-02'),
  ('eeeeeeee-0002-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '01010101-0101-4101-8101-010101010101', 300000, 'Incentivo', '2026-10-10'),
  ('eeeeeeee-0003-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', '01010101-0101-4101-8101-010101010101', 80000, 'Guardia', '2026-10-03');


insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, is_shared
) values
  ('bbbbbbbb-0001-4000-8000-000000000001', '01010101-0101-4101-8101-010101010101', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0006-4000-8000-000000000006', 'Alquiler', 250000, '2026-10-01', true),
  ('bbbbbbbb-0002-4000-8000-000000000002', '01010101-0101-4101-8101-010101010101', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0004-4000-8000-000000000004', 'Camuzzi', 18300, '2026-10-05', true),
  ('bbbbbbbb-0003-4000-8000-000000000003', '01010101-0101-4101-8101-010101010101', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0004-4000-8000-000000000004', 'Edersa', 22700, '2026-10-07', true),
  ('bbbbbbbb-0004-4000-8000-000000000004', '01010101-0101-4101-8101-010101010101', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0001-4000-8000-000000000001', 'Súper', 45200, '2026-10-09', true),
  ('bbbbbbbb-0005-4000-8000-000000000005', '01010101-0101-4101-8101-010101010101', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0004-4000-8000-000000000004', 'Internet', 15800, '2026-10-12', true),
  ('bbbbbbbb-0006-4000-8000-000000000006', '01010101-0101-4101-8101-010101010101', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0002-4000-8000-000000000002', 'Comida afuera', 32000, '2026-10-11', false),
  ('bbbbbbbb-0007-4000-8000-000000000007', '01010101-0101-4101-8101-010101010101', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0005-4000-8000-000000000005', 'Cine', 18000, '2026-10-08', false),
  ('bbbbbbbb-0008-4000-8000-000000000008', '01010101-0101-4101-8101-010101010101', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0009-4000-8000-000000000009', 'Campera', 15000, '2026-10-14', false),
  ('bbbbbbbb-0009-4000-8000-000000000009', '01010101-0101-4101-8101-010101010101', '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-000a-4000-8000-00000000000a', 'Café', 7000, '2026-10-15', false),
  ('bbbbbbbb-000a-4000-8000-00000000000a', '01010101-0101-4101-8101-010101010101', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-000b-4000-8000-00000000000b', 'Farmacia', 12000, '2026-10-13', false);



insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared
) values
  ('dddddddd-0001-4000-8000-000000000001', '01010101-0101-4101-8101-010101010101', null, 'aaaaaaaa-0006-4000-8000-000000000006', 'Alquiler', '🏠', 'house', 250000, 1, true),
  ('dddddddd-0002-4000-8000-000000000002', '01010101-0101-4101-8101-010101010101', null, 'aaaaaaaa-0004-4000-8000-000000000004', 'Camuzzi', '🔥', 'fire', 18300, 5, true),
  ('dddddddd-0003-4000-8000-000000000003', '01010101-0101-4101-8101-010101010101', null, 'aaaaaaaa-0004-4000-8000-000000000004', 'Edersa', '💡', 'lightbulb', 22700, 7, true),
  ('dddddddd-0004-4000-8000-000000000004', '01010101-0101-4101-8101-010101010101', null, 'aaaaaaaa-0004-4000-8000-000000000004', 'Internet', '📶', 'wifi', 15800, 12, true),
  ('dddddddd-0005-4000-8000-000000000005', '01010101-0101-4101-8101-010101010101', null, 'aaaaaaaa-0006-4000-8000-000000000006', 'Expensas', '🏢', 'building', 35000, 18, true),
  ('dddddddd-0006-4000-8000-000000000006', '01010101-0101-4101-8101-010101010101', '22222222-2222-4222-8222-222222222222', 'aaaaaaaa-000b-4000-8000-00000000000b', 'Osde', '🩺', 'stethoscope', 45000, 25, false);

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
select
  fe.id,
  fe.expected_amount,
  date '2026-10-01',
  coalesce(fe.owner_id, '11111111-1111-4111-8111-111111111111'::uuid)
from public.fixed_expenses as fe
where fe.household_id = '01010101-0101-4101-8101-010101010101';

insert into public.fixed_payments (fixed_expense_id, month, paid_on, payer_id, amount, expense_id) values
  ('dddddddd-0001-4000-8000-000000000001', '2026-10-01', '2026-10-01', '11111111-1111-4111-8111-111111111111', 250000, 'bbbbbbbb-0001-4000-8000-000000000001'),
  ('dddddddd-0002-4000-8000-000000000002', '2026-10-01', '2026-10-05', '22222222-2222-4222-8222-222222222222', 18300, 'bbbbbbbb-0002-4000-8000-000000000002'),
  ('dddddddd-0003-4000-8000-000000000003', '2026-10-01', '2026-10-07', '22222222-2222-4222-8222-222222222222', 22700, 'bbbbbbbb-0003-4000-8000-000000000003'),
  ('dddddddd-0004-4000-8000-000000000004', '2026-10-01', '2026-10-12', '22222222-2222-4222-8222-222222222222', 15800, 'bbbbbbbb-0005-4000-8000-000000000005');

-- Ahorros unificados (saldo inicial ya migrado; sin fondos/meta/bolsa viejos).
insert into public.savings (
  id, household_id, name, emoji, icon, target_amount, target_date, is_shared, owner_id, archived_at
) values
  ('ffffffff-0001-4000-8000-000000000001', '01010101-0101-4101-8101-010101010101', 'Viaje', '✈️', 'plane', 600000, null, false, '11111111-1111-4111-8111-111111111111', null),
  ('ffffffff-0002-4000-8000-000000000002', '01010101-0101-4101-8101-010101010101', 'Sillón', '🛋️', 'couch', 250000, null, false, '11111111-1111-4111-8111-111111111111', null),
  ('ffffffff-0003-4000-8000-000000000003', '01010101-0101-4101-8101-010101010101', 'Notebook', '💻', 'laptop', 800000, null, false, '11111111-1111-4111-8111-111111111111', null),
  ('ffffffff-0004-4000-8000-000000000004', '01010101-0101-4101-8101-010101010101', 'Curso', '📚', 'book', 200000, null, false, '22222222-2222-4222-8222-222222222222', null),
  ('99999999-0001-4000-8000-000000000001', '01010101-0101-4101-8101-010101010101', 'Vacaciones juntas', '🏖️', 'umbrella-beach', 1200000, '2027-01-15', true, null, null),
  ('aaaaaaaa-9001-4000-8000-000000000001', '01010101-0101-4101-8101-010101010101', 'Gustos', 'bag-shopping', 'bag-shopping', null, null, false, '11111111-1111-4111-8111-111111111111', null),
  ('aaaaaaaa-9002-4000-8000-000000000002', '01010101-0101-4101-8101-010101010101', 'Gustos', 'bag-shopping', 'bag-shopping', null, null, false, '22222222-2222-4222-8222-222222222222', null);

insert into public.saving_opening_balances (saving_id, user_id, amount) values
  ('ffffffff-0001-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 420000),
  ('ffffffff-0002-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 90000),
  ('ffffffff-0003-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 35000),
  ('ffffffff-0004-4000-8000-000000000004', '22222222-2222-4222-8222-222222222222', 50000),
  ('99999999-0001-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 330000),
  ('99999999-0001-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 210000),
  ('aaaaaaaa-9001-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 90000),
  ('aaaaaaaa-9002-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 30000);

insert into public.saving_moves (
  id, saving_id, household_id, user_id, kind, amount, spent_on, period, title, notes
) values
  (
    '51111111-1111-4111-8111-111111111111',
    'ffffffff-0002-4000-8000-000000000002',
    '01010101-0101-4101-8101-010101010101',
    '11111111-1111-4111-8111-111111111111',
    'aporte',
    30000,
    '2026-11-08',
    '2026-11-01',
    null,
    null
  ),
  (
    '52222222-2222-4222-8222-222222222222',
    'ffffffff-0002-4000-8000-000000000002',
    '01010101-0101-4101-8101-010101010101',
    '11111111-1111-4111-8111-111111111111',
    'retiro',
    10000,
    '2026-11-10',
    '2026-11-01',
    'Arreglo del lavarropas',
    null
  );

-- Comidas: alimentos de ejemplo para desarrollo local (NO son ARGENFOODS).
-- Solo corren con `npx supabase db reset`. Un `db push` no los carga.
insert into public.common_foods (
  id, name, search_name,
  protein_per_100g, carbs_per_100g, fat_per_100g, kcal_per_100g,
  portions, source
) values
  (
    'a1000000-0000-4000-8000-000000000001',
    'Café con leche (ejemplo)',
    'cafe con leche ejemplo',
    3.3, 5.0, 3.3, 63,
    '[{"label":"Taza","grams":120,"suggested":true}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Tostadas de pan francés (ejemplo)',
    'tostadas de pan frances ejemplo',
    8.3, 55.0, 1.7, 268,
    '[{"label":"2 rebanadas","grams":60,"suggested":true},{"label":"1 rebanada","grams":30}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Queso crema (ejemplo)',
    'queso crema ejemplo',
    6.7, 6.7, 26.7, 293,
    '[{"label":"Cucharada","grams":15,"suggested":true}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    'Milanesa de pollo al horno (ejemplo)',
    'milanesa de pollo al horno ejemplo',
    20.0, 10.0, 6.7, 180,
    '[{"label":"Mediana","grams":150,"suggested":true},{"label":"Chica","grams":100}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000005',
    'Puré de papas (ejemplo)',
    'pure de papas ejemplo',
    1.9, 16.7, 1.9, 91,
    '[{"label":"Taza","grams":210,"suggested":true}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000006',
    'Huevo duro (ejemplo)',
    'huevo duro ejemplo',
    12.6, 1.1, 10.6, 155,
    '[{"label":"2 unidades","grams":100,"suggested":true},{"label":"1 unidad","grams":50}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000007',
    'Banana (ejemplo)',
    'banana ejemplo',
    0.8, 22.5, 0.0, 93,
    '[{"label":"Mediana","grams":120,"suggested":true}]'::jsonb,
    'example'
  ),
  (
    'a1000000-0000-4000-8000-000000000008',
    'Arroz blanco cocido (ejemplo)',
    'arroz blanco cocido ejemplo',
    2.7, 28.2, 0.3, 130,
    '[{"label":"Taza","grams":158,"suggested":true}]'::jsonb,
    'example'
  )
on conflict (id) do nothing;
