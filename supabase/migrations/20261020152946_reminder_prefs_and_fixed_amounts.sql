-- Horarios del aviso diario (solo de cada usuaria) e historial de montos de gastos fijos.
-- Un privado lo ve y lo edita su dueña. Uno compartido lo ven y lo editan las dos.

alter table public.fixed_expenses
  add column remind_days_before integer not null default 2,
  add column paused_at timestamptz,
  add column updated_at timestamptz,
  add column updated_by uuid references auth.users (id) on delete set null;

alter table public.fixed_expenses
  add constraint fixed_expenses_remind_days check (remind_days_before between 0 and 28);

create table public.fixed_expense_amounts (
  id uuid primary key default gen_random_uuid(),
  fixed_expense_id uuid not null references public.fixed_expenses (id) on delete cascade,
  amount numeric(14, 2) not null,
  effective_from date not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint fixed_expense_amounts_positive check (amount > 0),
  constraint fixed_expense_amounts_month_start check (extract(day from effective_from) = 1),
  constraint fixed_expense_amounts_unique unique (fixed_expense_id, effective_from)
);

create index fixed_expense_amounts_expense_idx
  on public.fixed_expense_amounts (fixed_expense_id, effective_from);

insert into public.fixed_expense_amounts (fixed_expense_id, amount, effective_from, created_by)
select
  fe.id,
  fe.expected_amount,
  date_trunc('month', fe.created_at)::date,
  coalesce(fe.owner_id, h.created_by)
from public.fixed_expenses as fe
join public.households as h on h.id = fe.household_id;

create table public.reminder_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default true,
  first_time time not null default '14:00',
  second_time time not null default '21:30',
  reviewed_on date,
  hidden_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint reminder_preferences_times_ordered check (first_time < second_time)
);

create function private.touch_fixed_expense()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

create trigger fixed_expenses_touch
  before update on public.fixed_expenses
  for each row
  execute function private.touch_fixed_expense();

create function private.protect_amount_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fixed_expense_id is distinct from old.fixed_expense_id
    or new.effective_from is distinct from old.effective_from then
    raise exception 'El historial de montos no se reescribe';
  end if;
  return new;
end;
$$;

create trigger fixed_expense_amounts_protect
  before update on public.fixed_expense_amounts
  for each row
  execute function private.protect_amount_revision();

revoke all on function private.touch_fixed_expense() from public;
revoke all on function private.protect_amount_revision() from public;

alter table public.fixed_expense_amounts enable row level security;
alter table public.reminder_preferences enable row level security;

create policy fixed_expense_amounts_select on public.fixed_expense_amounts
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

create policy fixed_expense_amounts_insert on public.fixed_expense_amounts
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.fixed_expenses as fe
    where fe.id = fixed_expense_id
      and fe.household_id = (select private.my_household_id())
      and (
        (fe.is_shared and fe.owner_id is null)
        or (not fe.is_shared and fe.owner_id = (select auth.uid()))
      )
  )
);

create policy fixed_expense_amounts_update on public.fixed_expense_amounts
for update to authenticated
using (
  exists (
    select 1
    from public.fixed_expenses as fe
    where fe.id = fixed_expense_id
      and fe.household_id = (select private.my_household_id())
      and (fe.is_shared or fe.owner_id = (select auth.uid()))
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.fixed_expenses as fe
    where fe.id = fixed_expense_id
      and fe.household_id = (select private.my_household_id())
      and (
        (fe.is_shared and fe.owner_id is null)
        or (not fe.is_shared and fe.owner_id = (select auth.uid()))
      )
  )
);

create policy fixed_expenses_update on public.fixed_expenses
for update to authenticated
using (
  household_id = (select private.my_household_id())
  and (is_shared or owner_id = (select auth.uid()))
)
with check (
  household_id = (select private.my_household_id())
  and (
    (is_shared and owner_id is null)
    or (not is_shared and owner_id = (select auth.uid()))
  )
  and updated_by = (select auth.uid())
);

create policy fixed_expenses_delete on public.fixed_expenses
for delete to authenticated
using (
  household_id = (select private.my_household_id())
  and (is_shared or owner_id = (select auth.uid()))
);

create policy reminder_preferences_select on public.reminder_preferences
for select to authenticated
using (user_id = (select auth.uid()));

create policy reminder_preferences_insert on public.reminder_preferences
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy reminder_preferences_update on public.reminder_preferences
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on table public.fixed_expense_amounts from public, anon;
revoke all on table public.reminder_preferences from public, anon;

grant select, insert, update on public.fixed_expense_amounts to authenticated;
grant select, insert, update on public.reminder_preferences to authenticated;
grant update, delete on public.fixed_expenses to authenticated;
