begin;
select plan(28);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('a1000001-0001-4001-8001-000000000001', 'planes-coty@example.test', '{"display_name":"Coty"}'::jsonb),
  ('a1000002-0002-4002-8002-000000000002', 'planes-maru@example.test', '{"display_name":"Maru"}'::jsonb),
  ('a1000003-0003-4003-8003-000000000003', 'planes-otra@example.test', '{"display_name":"Otra"}'::jsonb);

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.create_household() is not null, 'Coty crea hogar');
reset role;

select set_config(
  'test.invite',
  (
    select h.invite_code from public.households as h
    join public.profiles as p on p.household_id = h.id
    where p.id = 'a1000001-0001-4001-8001-000000000001'
  ),
  true
);
select set_config('request.jwt.claim.sub', 'a1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok($$select public.join_household(current_setting('test.invite'))$$, 'Maru entra');
reset role;

-- Otro hogar
select set_config('request.jwt.claim.sub', 'a1000003-0003-4003-8003-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000003-0003-4003-8003-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(public.create_household() is not null, 'Otra crea su hogar');
reset role;

-- Coty crea ítems
select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

insert into public.plan_items (
  id, household_id, title, amount, note, tag, is_private, owner_id, chosen, created_by
)
select
  'a2000001-0001-4001-8001-000000000001',
  p.household_id, 'Rack TV', 150000, 'Que entre la tele', 'Living', false, null, true,
  'a1000001-0001-4001-8001-000000000001'
from public.profiles as p where p.id = 'a1000001-0001-4001-8001-000000000001';

insert into public.plan_items (
  id, household_id, title, amount, note, tag, is_private, owner_id, chosen, created_by
)
select
  'a2000002-0002-4002-8002-000000000002',
  p.household_id, 'Lampara', 40000, 'Para leer', 'Cuarto', true, p.id, true,
  'a1000001-0001-4001-8001-000000000001'
from public.profiles as p where p.id = 'a1000001-0001-4001-8001-000000000001';

select is(
  (select count(*) from public.plan_items),
  2::bigint,
  'Coty ve compartido y su privado'
);

-- Maru no ve privado de Coty
reset role;
select set_config('request.jwt.claim.sub', 'a1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.plan_items where id = 'a2000002-0002-4002-8002-000000000002'),
  0::bigint,
  'Maru no ve el privado de Coty'
);

select is(
  (select count(*) from public.plan_items where id = 'a2000001-0001-4001-8001-000000000001'),
  1::bigint,
  'Maru ve el compartido'
);

select is(
  (
    select count(*) from public.plan_items
    where tag is not null and lower(tag) = 'cuarto'
  ),
  0::bigint,
  'Maru no ve la etiqueta del privado'
);

update public.plan_items set title = 'Hack'
where id = 'a2000002-0002-4002-8002-000000000002';
select is(
  (select title from public.plan_items where id = 'a2000001-0001-4001-8001-000000000001'),
  'Rack TV',
  'Maru no edita el privado ajeno (compartido intacto)'
);
select is(
  (
    select count(*) from public.plan_items
    where id = 'a2000002-0002-4002-8002-000000000002' and title = 'Hack'
  ),
  0::bigint,
  'Maru no ve ni confirma el hack del privado'
);

select throws_ok(
  $$
    insert into public.plan_items (
      household_id, title, amount, is_private, owner_id, created_by
    )
    select household_id, 'Ajeno', 1000, true, 'a1000001-0001-4001-8001-000000000001',
      'a1000002-0002-4002-8002-000000000002'
    from public.profiles where id = 'a1000002-0002-4002-8002-000000000002'
  $$,
  '42501',
  null,
  'Maru no crea privado a nombre de Coty'
);

-- Otro hogar no ve
reset role;
select set_config('request.jwt.claim.sub', 'a1000003-0003-4003-8003-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000003-0003-4003-8003-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.plan_items),
  0::bigint,
  'otro hogar no ve plan_items'
);
reset role;

-- Inmutabilidad is_private
select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$update public.plan_items set is_private = true, owner_id = 'a1000001-0001-4001-8001-000000000001'
    where id = 'a2000001-0001-4001-8001-000000000001'$$,
  'P0001',
  'No se puede cambiar si el ítem es privado',
  'no se puede pasar un compartido a privado'
);

-- Normalización tag/note vacíos y límites
select lives_ok(
  $$update public.plan_items set note = '   ', tag = '  ' where id = 'a2000001-0001-4001-8001-000000000001'$$,
  'note y tag vacíos se aceptan'
);
select is(
  (select note from public.plan_items where id = 'a2000001-0001-4001-8001-000000000001'),
  null,
  'note vacía queda null'
);
select is(
  (select tag from public.plan_items where id = 'a2000001-0001-4001-8001-000000000001'),
  null,
  'tag vacía queda null'
);

select throws_ok(
  $$update public.plan_items set title = repeat('x', 81) where id = 'a2000001-0001-4001-8001-000000000001'$$,
  null,
  null,
  'title > 80 se rechaza'
);

select throws_ok(
  $$update public.plan_items set note = repeat('n', 501) where id = 'a2000001-0001-4001-8001-000000000001'$$,
  null,
  null,
  'note > 500 se rechaza'
);

-- RPC tipo y permisos
reset role;
select is(
  (
    select pg_typeof(public.plan_partner_status())::text
  ),
  'text',
  'RPC devuelve text'
);

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  public.plan_partner_status(),
  'falta_sueldo',
  'sin sueldo de Maru → falta_sueldo'
);
reset role;

-- Sueldos del mes actual (Argentina)
select set_config(
  'test.month',
  (date_trunc('month', timezone('America/Argentina/Buenos_Aires', now()))::date)::text,
  true
);

insert into public.base_salaries (user_id, amount, effective_from)
values
  ('a1000001-0001-4001-8001-000000000001', 1000000, current_setting('test.month')::date),
  ('a1000002-0002-4002-8002-000000000002', 800000, current_setting('test.month')::date);

select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  public.plan_partner_status(),
  'alcanza',
  'con sueldo y poco elegido → alcanza'
);

-- En el hogar se ven los sueldos de la otra (panel de reparto); private.salary_at sigue cerrado
reset role;
select set_config('request.jwt.claim.sub', 'a1000002-0002-4002-8002-000000000002', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000002-0002-4002-8002-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select ok(
  (
    select count(*) from public.base_salaries
    where user_id = 'a1000001-0001-4001-8001-000000000001'
  ) >= 1,
  'en el hogar Maru ve el sueldo de Coty (reparto)'
);
select throws_ok(
  $$select private.salary_at('a1000001-0001-4001-8001-000000000001', current_setting('test.month')::date)$$,
  null,
  null,
  'authenticated no ejecuta private.salary_at'
);

-- anon no ejecuta RPC
reset role;
set local role anon;
select throws_ok(
  $$select public.plan_partner_status()$$,
  null,
  null,
  'anon no ejecuta plan_partner_status'
);

-- Señal con reglas de reparto (mes post-corte, vía plan_partner_status_at)
reset role;
select set_config('request.jwt.claim.sub', 'a1000001-0001-4001-8001-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1000001-0001-4001-8001-000000000001","role":"authenticated"}',
  true
);

-- Varios sueldos de Maru en febrero 2027: 200k+200k=400k, ítem compartido 100k a 50/50 → alcanza
insert into public.base_salaries (user_id, amount, effective_from, label)
values
  ('a1000002-0002-4002-8002-000000000002', 200000, '2027-02-01', 'Oficina'),
  ('a1000002-0002-4002-8002-000000000002', 200000, '2027-02-01', 'Clases'),
  ('a1000001-0001-4001-8001-000000000001', 600000, '2027-02-01', 'Oficina');

update public.plan_items
set chosen = true, amount = 100000
where id = 'a2000001-0001-4001-8001-000000000001';

select is(
  private.plan_partner_status_at('2027-02-01'),
  'alcanza',
  'varios sueldos del mes se suman → alcanza'
);

-- Modo mitad: Maru 100k, Coty 900k, ítem 180k → parte Maru 90k, margen 10k → alcanza
insert into public.household_split_settings (
  household_id, mode, percent_by_user, effective_from, created_by
)
select p.household_id, 'even', '{}'::jsonb, '2027-03-01', p.id
from public.profiles as p
where p.id = 'a1000001-0001-4001-8001-000000000001';

insert into public.base_salaries (user_id, amount, effective_from)
values
  ('a1000001-0001-4001-8001-000000000001', 900000, '2027-03-01'),
  ('a1000002-0002-4002-8002-000000000002', 100000, '2027-03-01');

update public.plan_items
set chosen = true, amount = 180000
where id = 'a2000001-0001-4001-8001-000000000001';

select is(
  private.plan_partner_status_at('2027-03-01'),
  'alcanza',
  'modo mitad: Maru pone 90k de 180k con sueldo 100k → alcanza'
);

-- Modo manual 70/30: Maru 30% de 500k = 150k, sueldo 100k → no_alcanza
insert into public.household_split_settings (
  household_id, mode, percent_by_user, effective_from, created_by
)
select
  p.household_id,
  'manual',
  jsonb_build_object(
    'a1000001-0001-4001-8001-000000000001', 70,
    'a1000002-0002-4002-8002-000000000002', 30
  ),
  '2027-04-01',
  p.id
from public.profiles as p
where p.id = 'a1000001-0001-4001-8001-000000000001';

insert into public.base_salaries (user_id, amount, effective_from)
values
  ('a1000001-0001-4001-8001-000000000001', 700000, '2027-04-01'),
  ('a1000002-0002-4002-8002-000000000002', 100000, '2027-04-01');

update public.plan_items
set chosen = true, amount = 500000
where id = 'a2000001-0001-4001-8001-000000000001';

select is(
  private.plan_partner_status_at('2027-04-01'),
  'no_alcanza',
  'modo manual 70/30: Maru 150k > sueldo 100k → no_alcanza'
);

-- Falta sueldo de Maru en mayo 2027
select is(
  private.plan_partner_status_at('2027-05-01'),
  'falta_sueldo',
  'sin sueldo de Maru en el mes → falta_sueldo'
);

-- authenticated no ejecuta el helper privado
set local role authenticated;
select throws_ok(
  $$select private.plan_partner_status_at('2027-02-01')$$,
  null,
  null,
  'authenticated no ejecuta plan_partner_status_at'
);

select finish();
rollback;
