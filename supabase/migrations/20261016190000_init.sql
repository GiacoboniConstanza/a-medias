-- A Medias: hogar de dos personas, gastos compartidos proporcionales al sueldo base
-- y datos privados (extras, fondos, gastos y categorías propias) visibles solo para su dueña.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint households_invite_code_len check (char_length(invite_code) between 6 and 12)
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id),
  display_name text not null,
  view_mode text not null default 'friendly',
  created_at timestamptz not null default now(),
  constraint profiles_display_name_len check (char_length(btrim(display_name)) > 0),
  constraint profiles_view_mode check (view_mode in ('friendly', 'accounting'))
);

create table public.monthly_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  month date not null,
  base_amount numeric(14, 2) not null,
  constraint monthly_incomes_user_month unique (user_id, month),
  constraint monthly_incomes_month_start check (extract(day from month) = 1),
  constraint monthly_incomes_base_nonnegative check (base_amount >= 0)
);

create table public.income_extras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  amount numeric(14, 2) not null,
  label text not null,
  received_on date not null,
  created_at timestamptz not null default now(),
  constraint income_extras_amount_positive check (amount > 0),
  constraint income_extras_label_len check (char_length(btrim(label)) > 0)
);

create table public.savings_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null,
  target_amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint savings_funds_name_len check (char_length(btrim(name)) > 0),
  constraint savings_funds_target_positive check (target_amount > 0)
);

create table public.extra_allocations (
  id uuid primary key default gen_random_uuid(),
  extra_id uuid not null references public.income_extras (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  fund_id uuid references public.savings_funds (id) on delete restrict,
  amount numeric(14, 2) not null,
  constraint extra_allocations_amount_positive check (amount > 0)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  name text not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint categories_name_len check (char_length(btrim(name)) > 0)
);

create unique index categories_shared_name_idx
  on public.categories (household_id, name)
  where owner_id is null;

create unique index categories_private_name_idx
  on public.categories (household_id, owner_id, name)
  where owner_id is not null;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  payer_id uuid not null references auth.users (id),
  category_id uuid not null references public.categories (id),
  title text not null,
  amount numeric(14, 2) not null,
  spent_on date not null,
  is_shared boolean not null,
  created_at timestamptz not null default now(),
  constraint expenses_title_len check (char_length(btrim(title)) > 0),
  constraint expenses_amount_positive check (amount > 0)
);

create table public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  emoji text not null,
  target_amount numeric(14, 2) not null,
  target_date date,
  created_at timestamptz not null default now(),
  constraint shared_goals_name_len check (char_length(btrim(name)) > 0),
  constraint shared_goals_target_positive check (target_amount > 0)
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.shared_goals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null,
  mode text not null,
  created_at timestamptz not null default now(),
  constraint goal_contributions_amount_positive check (amount > 0),
  constraint goal_contributions_mode check (mode in ('free', 'percentage'))
);

create table public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  owner_id uuid references auth.users (id) on delete cascade,
  category_id uuid references public.categories (id),
  title text not null,
  emoji text not null,
  expected_amount numeric(14, 2) not null,
  due_day integer not null,
  is_shared boolean not null,
  created_at timestamptz not null default now(),
  constraint fixed_expenses_title_len check (char_length(btrim(title)) > 0),
  constraint fixed_expenses_amount_positive check (expected_amount > 0),
  constraint fixed_expenses_due_day check (due_day between 1 and 28),
  constraint fixed_expenses_privacy check (
    (is_shared and owner_id is null) or (not is_shared and owner_id is not null)
  )
);

create table public.fixed_payments (
  id uuid primary key default gen_random_uuid(),
  fixed_expense_id uuid not null references public.fixed_expenses (id) on delete cascade,
  month date not null,
  paid_on date not null,
  payer_id uuid not null references auth.users (id),
  amount numeric(14, 2) not null,
  expense_id uuid references public.expenses (id) on delete set null,
  constraint fixed_payments_month_unique unique (fixed_expense_id, month),
  constraint fixed_payments_month_start check (extract(day from month) = 1),
  constraint fixed_payments_amount_positive check (amount > 0)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month date not null,
  debtor_id uuid not null references auth.users (id),
  creditor_id uuid not null references auth.users (id),
  amount numeric(14, 2) not null,
  settled_by uuid not null references auth.users (id),
  settled_at timestamptz not null default now(),
  constraint settlements_month_unique unique (household_id, month),
  constraint settlements_month_start check (extract(day from month) = 1),
  constraint settlements_amount_nonnegative check (amount >= 0),
  constraint settlements_distinct_people check (debtor_id <> creditor_id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  daily_enabled boolean not null default true,
  dues_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index profiles_household_idx on public.profiles (household_id);
create index monthly_incomes_household_month_idx on public.monthly_incomes (household_id, month);
create index income_extras_user_idx on public.income_extras (user_id, received_on);
create index extra_allocations_extra_idx on public.extra_allocations (extra_id);
create index extra_allocations_fund_idx on public.extra_allocations (fund_id);
create index categories_household_idx on public.categories (household_id);
create index expenses_household_spent_idx on public.expenses (household_id, spent_on);
create index expenses_owner_idx on public.expenses (owner_id);
create index expenses_payer_idx on public.expenses (payer_id);
create index savings_funds_user_idx on public.savings_funds (user_id);
create index goal_contributions_goal_idx on public.goal_contributions (goal_id);
create index fixed_expenses_household_idx on public.fixed_expenses (household_id);
create index fixed_payments_month_idx on public.fixed_payments (month);
create index settlements_household_month_idx on public.settlements (household_id, month);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create function private.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.household_id
  from public.profiles as p
  where p.id = (select auth.uid())
$$;

create function private.is_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.household_id = target
  );
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Sin nombre'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

create function private.limit_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  members integer;
begin
  if new.household_id is not null and new.household_id is distinct from old.household_id then
    select count(*)
    into members
    from public.profiles as p
    where p.household_id = new.household_id
      and p.id is distinct from new.id;

    if members >= 2 then
      raise exception 'Este hogar ya tiene dos personas';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_limit_household
  before update on public.profiles
  for each row
  execute function private.limit_household();

create function private.validate_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat_owner uuid;
  cat_household uuid;
  payer_household uuid;
begin
  select c.owner_id, c.household_id
  into cat_owner, cat_household
  from public.categories as c
  where c.id = new.category_id;

  if cat_household is null or cat_household is distinct from new.household_id then
    raise exception 'La categoría no es de este hogar';
  end if;

  if new.is_shared and cat_owner is not null then
    raise exception 'Un gasto compartido no puede usar una categoría privada';
  end if;

  if not new.is_shared and cat_owner is distinct from new.owner_id then
    raise exception 'Esa categoría privada no es tuya';
  end if;

  if not new.is_shared and new.payer_id is distinct from new.owner_id then
    raise exception 'Un gasto privado lo pagás vos';
  end if;

  select p.household_id
  into payer_household
  from public.profiles as p
  where p.id = new.payer_id;

  if payer_household is distinct from new.household_id then
    raise exception 'Quien pagó no está en el hogar';
  end if;

  if (select auth.uid()) is not null and not private.is_member(new.household_id) then
    raise exception 'No pertenecés a este hogar';
  end if;

  if (select auth.uid()) is not null and new.owner_id is distinct from (select auth.uid()) then
    raise exception 'Solo podés anotar gastos a tu nombre';
  end if;

  return new;
end;
$$;

create trigger expenses_validate
  before insert or update on public.expenses
  for each row
  execute function private.validate_expense();

create function private.validate_allocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  extra_amount numeric(14, 2);
  extra_owner uuid;
  allocated numeric(14, 2);
begin
  select e.amount, e.user_id
  into extra_amount, extra_owner
  from public.income_extras as e
  where e.id = new.extra_id;

  if extra_owner is null then
    raise exception 'Ese extra no existe';
  end if;

  if new.user_id is distinct from extra_owner then
    raise exception 'El reparto no es de quien recibió el extra';
  end if;

  if new.fund_id is not null and not exists (
    select 1
    from public.savings_funds as f
    where f.id = new.fund_id
      and f.user_id = new.user_id
  ) then
    raise exception 'Ese fondo no es tuyo';
  end if;

  select coalesce(sum(a.amount), 0)
  into allocated
  from public.extra_allocations as a
  where a.extra_id = new.extra_id
    and a.id is distinct from new.id;

  if allocated + new.amount > extra_amount then
    raise exception 'El reparto supera el extra';
  end if;

  return new;
end;
$$;

create trigger extra_allocations_validate
  before insert or update on public.extra_allocations
  for each row
  execute function private.validate_allocation();

create function private.validate_fixed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat_owner uuid;
  cat_household uuid;
begin
  if new.category_id is null then
    return new;
  end if;

  select c.owner_id, c.household_id
  into cat_owner, cat_household
  from public.categories as c
  where c.id = new.category_id;

  if cat_household is null or cat_household is distinct from new.household_id then
    raise exception 'La categoría no es de este hogar';
  end if;

  if new.is_shared and cat_owner is not null then
    raise exception 'Un gasto fijo compartido no puede usar una categoría privada';
  end if;

  if not new.is_shared and cat_owner is distinct from new.owner_id then
    raise exception 'Esa categoría privada no es tuya';
  end if;

  return new;
end;
$$;

create trigger fixed_expenses_validate
  before insert or update on public.fixed_expenses
  for each row
  execute function private.validate_fixed();

create function private.create_household()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  existing uuid;
  code text;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select p.household_id into existing
  from public.profiles as p
  where p.id = uid;

  if existing is not null then
    raise exception 'Ya estás en un hogar';
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.households (invite_code, created_by)
  values (code, uid)
  returning id into hid;

  update public.profiles
  set household_id = hid
  where id = uid;

  insert into public.categories (household_id, owner_id, name, emoji)
  values
    (hid, null, 'Súper', '🛒'),
    (hid, null, 'Comida', '🍕'),
    (hid, null, 'Viajes', '🚌'),
    (hid, null, 'Servicios', '💡'),
    (hid, null, 'Salidas', '🎉'),
    (hid, null, 'Hogar', '🏠');

  return hid;
end;
$$;

create function private.join_household(invite text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  members integer;
  existing uuid;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select p.household_id into existing
  from public.profiles as p
  where p.id = uid;

  if existing is not null then
    raise exception 'Ya estás en un hogar';
  end if;

  select h.id into hid
  from public.households as h
  where h.invite_code = upper(btrim(invite));

  if hid is null then
    raise exception 'Ese código no existe';
  end if;

  select count(*) into members
  from public.profiles as p
  where p.household_id = hid;

  if members >= 2 then
    raise exception 'Este hogar ya tiene dos personas';
  end if;

  update public.profiles
  set household_id = hid
  where id = uid;

  return hid;
end;
$$;

create function public.create_household()
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_household()
$$;

create function public.join_household(invite text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.join_household(invite)
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.limit_household() from public;
revoke all on function private.validate_expense() from public;
revoke all on function private.validate_allocation() from public;
revoke all on function private.validate_fixed() from public;
revoke all on function private.create_household() from public;
revoke all on function private.join_household(text) from public;
revoke all on function private.my_household_id() from public;
revoke all on function private.is_member(uuid) from public;

grant usage on schema private to authenticated;
grant execute on function private.my_household_id() to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.create_household() to authenticated;
grant execute on function private.join_household(text) to authenticated;

revoke all on function public.create_household() from public, anon;
revoke all on function public.join_household(text) from public, anon;
grant execute on function public.create_household() to authenticated;
grant execute on function public.join_household(text) to authenticated;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.monthly_incomes enable row level security;
alter table public.income_extras enable row level security;
alter table public.savings_funds enable row level security;
alter table public.extra_allocations enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.shared_goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.fixed_payments enable row level security;
alter table public.settlements enable row level security;
alter table public.push_subscriptions enable row level security;

create policy households_select on public.households
for select to authenticated
using (
  id = (select private.my_household_id())
  or created_by = (select auth.uid())
);

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (
    household_id is not null
    and household_id = (select private.my_household_id())
  )
);

create policy profiles_update on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and household_id is not distinct from (select private.my_household_id())
);

create policy monthly_incomes_select on public.monthly_incomes
for select to authenticated
using (household_id = (select private.my_household_id()));

create policy monthly_incomes_insert on public.monthly_incomes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and household_id = (select private.my_household_id())
);

create policy monthly_incomes_update on public.monthly_incomes
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and household_id = (select private.my_household_id())
);

create policy income_extras_all on public.income_extras
for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and household_id = (select private.my_household_id())
);

create policy savings_funds_all on public.savings_funds
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy extra_allocations_all on public.extra_allocations
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy categories_select on public.categories
for select to authenticated
using (
  household_id = (select private.my_household_id())
  and (owner_id is null or owner_id = (select auth.uid()))
);

create policy categories_insert on public.categories
for insert to authenticated
with check (
  household_id = (select private.my_household_id())
  and (owner_id is null or owner_id = (select auth.uid()))
);

create policy expenses_select on public.expenses
for select to authenticated
using (
  (is_shared and household_id = (select private.my_household_id()))
  or (not is_shared and owner_id = (select auth.uid()))
);

create policy expenses_insert on public.expenses
for insert to authenticated
with check (
  household_id = (select private.my_household_id())
  and owner_id = (select auth.uid())
);

create policy expenses_delete on public.expenses
for delete to authenticated
using (owner_id = (select auth.uid()));

create policy shared_goals_select on public.shared_goals
for select to authenticated
using (household_id = (select private.my_household_id()));

create policy shared_goals_insert on public.shared_goals
for insert to authenticated
with check (household_id = (select private.my_household_id()));

create policy goal_contributions_select on public.goal_contributions
for select to authenticated
using (
  exists (
    select 1
    from public.shared_goals as g
    where g.id = goal_id
      and g.household_id = (select private.my_household_id())
  )
);

create policy goal_contributions_insert on public.goal_contributions
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.shared_goals as g
    where g.id = goal_id
      and g.household_id = (select private.my_household_id())
  )
);

create policy fixed_expenses_select on public.fixed_expenses
for select to authenticated
using (
  household_id = (select private.my_household_id())
  and (is_shared or owner_id = (select auth.uid()))
);

create policy fixed_expenses_insert on public.fixed_expenses
for insert to authenticated
with check (
  household_id = (select private.my_household_id())
  and (
    (is_shared and owner_id is null)
    or (not is_shared and owner_id = (select auth.uid()))
  )
);

create policy fixed_payments_select on public.fixed_payments
for select to authenticated
using (
  exists (
    select 1
    from public.fixed_expenses as fe
    where fe.id = fixed_expense_id
      and fe.household_id = (select private.my_household_id())
      and (fe.is_shared or fe.owner_id = (select auth.uid()))
  )
);

create policy fixed_payments_insert on public.fixed_payments
for insert to authenticated
with check (
  payer_id = (select auth.uid())
  and exists (
    select 1
    from public.fixed_expenses as fe
    where fe.id = fixed_expense_id
      and fe.household_id = (select private.my_household_id())
      and (fe.is_shared or fe.owner_id = (select auth.uid()))
  )
);

create policy fixed_payments_delete on public.fixed_payments
for delete to authenticated
using (
  exists (
    select 1
    from public.fixed_expenses as fe
    where fe.id = fixed_expense_id
      and fe.household_id = (select private.my_household_id())
      and (fe.is_shared or fe.owner_id = (select auth.uid()))
  )
);

create policy settlements_select on public.settlements
for select to authenticated
using (household_id = (select private.my_household_id()));

create policy settlements_insert on public.settlements
for insert to authenticated
with check (
  household_id = (select private.my_household_id())
  and settled_by = (select auth.uid())
);

create policy settlements_delete on public.settlements
for delete to authenticated
using (household_id = (select private.my_household_id()));

create policy push_subscriptions_all on public.push_subscriptions
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on table public.households from public, anon;
revoke all on table public.profiles from public, anon;
revoke all on table public.monthly_incomes from public, anon;
revoke all on table public.income_extras from public, anon;
revoke all on table public.savings_funds from public, anon;
revoke all on table public.extra_allocations from public, anon;
revoke all on table public.categories from public, anon;
revoke all on table public.expenses from public, anon;
revoke all on table public.shared_goals from public, anon;
revoke all on table public.goal_contributions from public, anon;
revoke all on table public.fixed_expenses from public, anon;
revoke all on table public.fixed_payments from public, anon;
revoke all on table public.settlements from public, anon;
revoke all on table public.push_subscriptions from public, anon;

grant select on public.households to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.monthly_incomes to authenticated;
grant select, insert, update, delete on public.income_extras to authenticated;
grant select, insert, update, delete on public.savings_funds to authenticated;
grant select, insert, update, delete on public.extra_allocations to authenticated;
grant select, insert on public.categories to authenticated;
grant select, insert, delete on public.expenses to authenticated;
grant select, insert on public.shared_goals to authenticated;
grant select, insert on public.goal_contributions to authenticated;
grant select, insert on public.fixed_expenses to authenticated;
grant select, insert, delete on public.fixed_payments to authenticated;
grant select, insert, delete on public.settlements to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
