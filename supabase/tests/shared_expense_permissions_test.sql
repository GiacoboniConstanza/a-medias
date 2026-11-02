begin;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
    'gastos-coty@example.com',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
    'gastos-maru@example.com',
    '{"display_name":"Maru"}'::jsonb
  );

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(public.create_household() is not null, 'la dueña crea el hogar');

insert into public.categories (id, household_id, owner_id, name, emoji, icon)
select
  'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
  p.household_id,
  p.id,
  'Café',
  '☕',
  'mug-hot'
from public.profiles as p
where p.id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
select
  'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
  p.household_id,
  p.id,
  p.id,
  c.id,
  'Súper',
  1000,
  '2026-10-07',
  '2026-10-01',
  true
from public.profiles as p
join public.categories as c on c.household_id = p.household_id and c.owner_id is null and c.name = 'Súper'
where p.id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
select
  'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5',
  p.household_id,
  p.id,
  p.id,
  'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
  'Café propio',
  200,
  '2026-10-08',
  '2026-10-01',
  false
from public.profiles as p
where p.id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

insert into public.expenses (
  id, household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
)
select
  'f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6',
  p.household_id,
  p.id,
  p.id,
  c.id,
  'Noviembre',
  300,
  '2026-11-02',
  '2026-11-01',
  true
from public.profiles as p
join public.categories as c on c.household_id = p.household_id and c.owner_id is null and c.name = 'Súper'
where p.id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

reset role;
select set_config(
  'test.invite',
  (
    select h.invite_code
    from public.households as h
    join public.profiles as p on p.household_id = h.id
    where p.id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
  ),
  true
);

select set_config('request.jwt.claim.sub', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.join_household(current_setting('test.invite'))$$,
  'la otra persona entra al hogar'
);

update public.expenses
set title = 'Súper de las dos', payer_id = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4';

select is(
  (select title from public.expenses where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'),
  'Súper de las dos',
  'la otra persona edita un compartido'
);

select is(
  (select payer_id from public.expenses where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'),
  'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'::uuid,
  'la otra persona cambia quién pagó'
);

select throws_ok(
  $$update public.expenses set is_shared = false where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'$$,
  'P0001',
  'Solo quien lo cargó puede pasarlo a privado.',
  'la otra persona no pasa a privado un compartido ajeno'
);

update public.expenses
set title = 'Café hack'
where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5';

delete from public.expenses where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5';

select set_config('request.jwt.claim.sub', 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1","role":"authenticated"}',
  true
);

select is(
  (select title from public.expenses where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'),
  'Café propio',
  'la otra persona no edita un privado ajeno'
);

update public.expenses
set is_shared = false, category_id = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', payer_id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
where id = 'f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6';

select is(
  (select is_shared from public.expenses where id = 'f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f6f6'),
  false,
  'la dueña sí pasa su compartido a privado'
);

insert into public.settlements (household_id, month, debtor_id, creditor_id, amount, settled_by)
select
  p.household_id,
  '2026-10-01',
  'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
  p.id,
  0,
  p.id
from public.profiles as p
where p.id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

select throws_ok(
  $$update public.expenses set title = 'No' where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'$$,
  'P0001',
  'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este gasto.',
  'nadie edita un compartido de un mes saldado'
);

select throws_ok(
  $$delete from public.expenses where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'$$,
  'P0001',
  'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este gasto.',
  'nadie borra un compartido de un mes saldado'
);

select throws_ok(
  $$insert into public.expenses (
      household_id, owner_id, payer_id, category_id, title, amount, spent_on, period, is_shared
    )
    select p.household_id, p.id, p.id, c.id, 'Tarde', 10, '2026-10-20', '2026-10-01', true
    from public.profiles as p
    join public.categories as c on c.household_id = p.household_id and c.owner_id is null and c.name = 'Súper'
    where p.id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'$$,
  'P0001',
  'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este gasto.',
  'nadie carga un compartido en un mes saldado'
);

update public.expenses
set title = 'Café corregido'
where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5';

select is(
  (select title from public.expenses where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'),
  'Café corregido',
  'un privado del mes saldado sí se edita'
);

select throws_ok(
  $$update public.expenses
    set is_shared = true,
        category_id = (
          select c.id
          from public.categories as c
          join public.profiles as p on p.household_id = c.household_id
          where p.id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
            and c.owner_id is null
            and c.name = 'Súper'
        )
    where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'$$,
  'P0001',
  'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este gasto.',
  'pasar un privado a compartido en un mes saldado falla'
);

delete from public.settlements
where month = '2026-10-01'
  and household_id = (select household_id from public.profiles where id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');

update public.expenses
set title = 'Súper otra vez'
where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4';

select is(
  (select title from public.expenses where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'),
  'Súper otra vez',
  'después de deshacer el saldo, el compartido se puede editar'
);

select set_config('request.jwt.claim.sub', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2","role":"authenticated"}',
  true
);

delete from public.expenses where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4';

select is(
  (select count(*) from public.expenses where id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'),
  0::bigint,
  'la otra persona borra un compartido'
);

select is(
  (select count(*) from public.expenses where id = 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5'),
  0::bigint,
  'la otra persona no ve el privado ajeno'
);

select * from finish();
rollback;
