begin;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data)
values
  (
    '12121212-1212-4121-8121-121212121212',
    'avisos-a@example.com',
    '{"display_name":"Coty"}'::jsonb
  ),
  (
    '34343434-3434-4343-8343-343434343434',
    'avisos-b@example.com',
    '{"display_name":"Maru"}'::jsonb
  );

select set_config('request.jwt.claim.sub', '12121212-1212-4121-8121-121212121212', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"12121212-1212-4121-8121-121212121212","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(public.create_household() is not null, 'la dueña crea el hogar');

insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared
)
select
  '56565656-5656-4565-8565-565656565656',
  p.household_id,
  null,
  null,
  'Alquiler',
  'house',
  'house',
  250000,
  1,
  true
from public.profiles as p
where p.id = '12121212-1212-4121-8121-121212121212';

insert into public.fixed_expenses (
  id, household_id, owner_id, category_id, title, emoji, icon, expected_amount, due_day, is_shared
)
select
  '78787878-7878-4787-8787-787878787878',
  p.household_id,
  p.id,
  null,
  'Osde',
  'stethoscope',
  'stethoscope',
  45000,
  10,
  false
from public.profiles as p
where p.id = '12121212-1212-4121-8121-121212121212';

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values
  ('56565656-5656-4565-8565-565656565656', 250000, '2026-10-01', '12121212-1212-4121-8121-121212121212'),
  ('78787878-7878-4787-8787-787878787878', 45000, '2026-10-01', '12121212-1212-4121-8121-121212121212');

insert into public.reminder_preferences (user_id, first_time, second_time)
values ('12121212-1212-4121-8121-121212121212', '14:00', '21:30');

insert into public.daily_statuses (user_id, day, kind)
values ('12121212-1212-4121-8121-121212121212', '2026-10-20', 'clear');

reset role;
select set_config(
  'test.invite',
  (
    select h.invite_code
    from public.households as h
    join public.profiles as p on p.household_id = h.id
    where p.id = '12121212-1212-4121-8121-121212121212'
  ),
  true
);

select set_config('request.jwt.claim.sub', '34343434-3434-4343-8343-343434343434', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"34343434-3434-4343-8343-343434343434","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.join_household(current_setting('test.invite'))$$,
  'la otra persona entra al hogar'
);

select is(
  (select count(*) from public.fixed_expenses where id = '56565656-5656-4565-8565-565656565656'),
  1::bigint,
  'el gasto fijo compartido lo ven las dos'
);

select is(
  (select count(*) from public.fixed_expenses where id = '78787878-7878-4787-8787-787878787878'),
  0::bigint,
  'el gasto fijo privado no lo ve la otra'
);

select is(
  (select count(*) from public.fixed_expense_amounts where fixed_expense_id = '78787878-7878-4787-8787-787878787878'),
  0::bigint,
  'el historial privado no lo ve la otra'
);

select is(
  (select count(*) from public.reminder_preferences where user_id = '12121212-1212-4121-8121-121212121212'),
  0::bigint,
  'los horarios de aviso son solo de su dueña'
);

select is(
  (select count(*) from public.daily_statuses where user_id = '12121212-1212-4121-8121-121212121212'),
  0::bigint,
  'el estado diario es solo de su dueña'
);

select throws_ok(
  $$insert into public.daily_statuses (user_id, day, kind)
    values ('12121212-1212-4121-8121-121212121212', '2026-10-21', 'clear')$$,
  '42501',
  'new row violates row-level security policy for table "daily_statuses"',
  'no puede escribir el estado diario de la otra'
);

update public.fixed_expenses
set title = 'Alquiler nuevo'
where id = '56565656-5656-4565-8565-565656565656';

select is(
  (select updated_by from public.fixed_expenses where id = '56565656-5656-4565-8565-565656565656'),
  '34343434-3434-4343-8343-343434343434'::uuid,
  'un compartido registra quién lo cambió'
);

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
values (
  '56565656-5656-4565-8565-565656565656',
  300000,
  '2026-11-01',
  '34343434-3434-4343-8343-343434343434'
);

select is(
  (
    select count(*)
    from public.fixed_expense_amounts
    where fixed_expense_id = '56565656-5656-4565-8565-565656565656'
      and effective_from = '2026-11-01'
  ),
  1::bigint,
  'cualquiera de las dos puede anotar un monto nuevo del compartido'
);

select throws_ok(
  $$insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
    values ('78787878-7878-4787-8787-787878787878', 1, '2026-11-01', '34343434-3434-4343-8343-343434343434')$$,
  '42501',
  'new row violates row-level security policy for table "fixed_expense_amounts"',
  'no puede anotar montos de un privado ajeno'
);

select throws_ok(
  $$insert into public.reminder_preferences (user_id, first_time, second_time)
    values ('12121212-1212-4121-8121-121212121212', '08:00', '09:00')$$,
  '42501',
  'new row violates row-level security policy for table "reminder_preferences"',
  'no puede escribir los horarios de la otra'
);

update public.fixed_expenses
set title = 'Osde hack'
where id = '78787878-7878-4787-8787-787878787878';

select set_config('request.jwt.claim.sub', '12121212-1212-4121-8121-121212121212', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"12121212-1212-4121-8121-121212121212","role":"authenticated"}',
  true
);

select is(
  (select title from public.fixed_expenses where id = '78787878-7878-4787-8787-787878787878'),
  'Osde',
  'la otra persona no cambia un gasto privado'
);

select is(
  (select count(*) from public.fixed_expenses where owner_id = '12121212-1212-4121-8121-121212121212'),
  1::bigint,
  'la dueña sigue viendo su gasto privado'
);

select * from finish();
rollback;
