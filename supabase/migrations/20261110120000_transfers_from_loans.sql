-- Migración P2/P4/P9: préstamos y devoluciones → transferencias;
-- settle_shared_month sin devoluciones; título de gasto opcional;
-- transferencias permitidas en meses saldados.

-- 1. Tabla de transferencias (gasto para quien manda, ingreso para quien recibe).
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null,
  transferred_on date not null,
  period date not null,
  notes text,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_amount_positive check (amount > 0),
  constraint transfers_distinct_parties check (from_id <> to_id),
  constraint transfers_period_start check (extract(day from period) = 1),
  constraint transfers_notes_len check (notes is null or char_length(notes) <= 500)
);

create index transfers_from_idx on public.transfers (from_id);
create index transfers_to_idx on public.transfers (to_id);
create index transfers_period_idx on public.transfers (period);

-- 2. Cada préstamo → transferencia de quien prestó a quien recibió.
insert into public.transfers (id, from_id, to_id, amount, transferred_on, period, notes, created_by, created_at, updated_at)
select
  loan.id,
  loan.lender_id,
  loan.borrower_id,
  loan.amount,
  loan.lent_on,
  loan.period,
  loan.notes,
  loan.lender_id,
  loan.created_at,
  loan.updated_at
from public.loans as loan;

-- 3. Cada devolución → transferencia en el otro sentido.
-- Las del saldo (settlement_id) también: el deshacer ya no las borra;
-- quedan como movimiento real de "Te quedan".
insert into public.transfers (id, from_id, to_id, amount, transferred_on, period, notes, created_by, created_at, updated_at)
select
  repayment.id,
  loan.borrower_id,
  loan.lender_id,
  repayment.amount,
  repayment.paid_on,
  repayment.period,
  repayment.notes,
  repayment.created_by,
  repayment.created_at,
  repayment.created_at
from public.loan_repayments as repayment
join public.loans as loan on loan.id = repayment.loan_id;

-- 4. Bajar préstamos / devoluciones y sus guards.
drop trigger if exists loan_repayments_guard_settled on public.loan_repayments;
drop trigger if exists loan_repayments_guard on public.loan_repayments;
drop trigger if exists loans_guard_settled on public.loans;
drop trigger if exists loans_guard on public.loans;

drop view if exists public.loan_balances;

drop table if exists public.loan_repayments;
drop table if exists public.loans;

drop function if exists private.guard_settled_loan_repayment();
drop function if exists private.guard_settled_loan();
drop function if exists private.guard_loan_repayment();
drop function if exists private.guard_loan();

-- 5. Guard de transferencias: cualquiera de las dos del hogar puede anotarlas.
create function private.guard_transfer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    if actor is not null and old.created_by is distinct from actor then
      raise exception 'Solo quien la cargó puede borrar la transferencia';
    end if;
    return old;
  end if;

  if new.period is null then
    new.period := date_trunc('month', new.transferred_on)::date;
  else
    new.period := date_trunc('month', new.period)::date;
  end if;

  if actor is not null then
    if tg_op = 'INSERT' then
      new.created_by := actor;
      if actor is distinct from new.from_id and actor is distinct from new.to_id then
        raise exception 'La transferencia es entre vos y tu compañera';
      end if;
    elsif old.created_by is distinct from actor then
      raise exception 'Solo quien la cargó puede modificar la transferencia';
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.from_id is distinct from old.from_id
    or new.to_id is distinct from old.to_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'No se puede cambiar de quién es la transferencia';
  end if;

  if not exists (
    select 1
    from public.profiles as sender
    join public.profiles as receiver
      on receiver.household_id = sender.household_id
     and sender.household_id is not null
    where sender.id = new.from_id
      and receiver.id = new.to_id
  ) then
    raise exception 'La transferencia es entre las dos del hogar';
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_transfer() from public, anon, authenticated;

create trigger transfers_guard
  before insert or update or delete on public.transfers
  for each row
  execute function private.guard_transfer();

alter table public.transfers enable row level security;

create policy transfers_select on public.transfers
for select to authenticated
using ((select auth.uid()) in (from_id, to_id));

create policy transfers_insert on public.transfers
for insert to authenticated
with check ((select auth.uid()) in (from_id, to_id));

create policy transfers_update on public.transfers
for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy transfers_delete on public.transfers
for delete to authenticated
using (created_by = (select auth.uid()));

revoke all on public.transfers from public, anon, authenticated;
grant select, insert, update, delete on public.transfers to authenticated;

-- 6. settle_shared_month: solo el reparto de gastos compartidos (sin préstamos).
drop function if exists public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid, jsonb);

create or replace function public.settle_shared_month(
  p_month date,
  p_debtor uuid,
  p_creditor uuid,
  p_amount numeric,
  p_expense_amount numeric,
  p_expense_debtor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  household uuid;
  partner uuid;
  month_start date := date_trunc('month', p_month)::date;
  expense_signed numeric(14, 2);
  net numeric(14, 2);
  settlement uuid;
begin
  if actor is null then
    raise exception 'Tenés que entrar para saldar';
  end if;

  select profile.household_id
  into household
  from public.profiles as profile
  where profile.id = actor;

  if household is null then
    raise exception 'No estás en un hogar';
  end if;

  select other.id
  into partner
  from public.profiles as other
  where other.household_id = household
    and other.id <> actor
  limit 1;

  if partner is null then
    raise exception 'Falta tu compañera para saldar';
  end if;

  if p_debtor is distinct from actor and p_debtor is distinct from partner
    or p_creditor is distinct from actor and p_creditor is distinct from partner
    or p_debtor = p_creditor then
    raise exception 'El saldo es entre las dos del hogar';
  end if;

  if p_amount <= 0 or p_expense_amount < 0
    or p_amount <> round(p_amount, 2)
    or p_expense_amount <> round(p_expense_amount, 2) then
    raise exception 'El monto a saldar no cierra';
  end if;

  if exists (
    select 1
    from public.settlements as settlement_row
    where settlement_row.household_id = household
      and settlement_row.month = month_start
  ) then
    raise exception 'Ese mes ya está saldado';
  end if;

  if p_expense_amount = 0 then
    raise exception 'No hay nada para saldar este mes.';
  elsif p_expense_debtor is null
    or (p_expense_debtor is distinct from actor and p_expense_debtor is distinct from partner) then
    raise exception 'El reparto de gastos es entre las dos del hogar';
  elsif p_expense_debtor = p_creditor then
    expense_signed := -round(p_expense_amount, 2);
  else
    expense_signed := round(p_expense_amount, 2);
  end if;

  net := round(expense_signed, 2);
  if net <= 0
    or round(p_amount, 2) <> net
    or p_debtor is distinct from (case when p_creditor = actor then partner else actor end) then
    raise exception 'El monto a saldar no cierra';
  end if;

  insert into public.settlements (household_id, month, debtor_id, creditor_id, amount, settled_by)
  values (household, month_start, p_debtor, p_creditor, net, actor)
  returning id into settlement;

  return settlement;
end;
$$;

revoke all on function public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid) from public, anon;
grant execute on function public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid) to authenticated;

-- 7. Título de gasto opcional (P4) y categoría opcional para el formulario único.
alter table public.expenses
  alter column title drop not null;

alter table public.expenses
  drop constraint if exists expenses_title_len;

alter table public.expenses
  add constraint expenses_title_len check (title is null or char_length(btrim(title)) > 0);

alter table public.expenses
  alter column category_id drop not null;
