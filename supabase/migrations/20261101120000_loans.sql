-- Préstamos entre las dos del hogar. No son gastos ni ingresos:
-- quien recibe la plata la usa como quiere y anota sus gastos aparte.

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  lender_id uuid not null references auth.users (id) on delete cascade,
  borrower_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null,
  lent_on date not null,
  period date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_amount_positive check (amount > 0),
  constraint loans_distinct_parties check (lender_id <> borrower_id),
  constraint loans_period_start check (extract(day from period) = 1),
  constraint loans_notes_len check (notes is null or char_length(notes) <= 500)
);

create table public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  amount numeric(12, 2) not null,
  paid_on date not null,
  period date not null,
  notes text,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint loan_repayments_amount_positive check (amount > 0),
  constraint loan_repayments_period_start check (extract(day from period) = 1),
  constraint loan_repayments_notes_len check (notes is null or char_length(notes) <= 500)
);

create index loans_lender_idx on public.loans (lender_id);
create index loans_borrower_idx on public.loans (borrower_id);
create index loan_repayments_loan_idx on public.loan_repayments (loan_id, paid_on);

create function private.guard_loan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  repaid numeric(12, 2);
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.period is null then
    new.period := date_trunc('month', new.lent_on)::date;
  else
    new.period := date_trunc('month', new.period)::date;
  end if;

  if actor is not null and new.lender_id is distinct from actor then
    raise exception 'Solo quien presta puede cargar el préstamo';
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.lender_id is distinct from old.lender_id
    or new.borrower_id is distinct from old.borrower_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'No se puede cambiar de quién es el préstamo';
  end if;

  if not exists (
    select 1
    from public.profiles as lender
    join public.profiles as borrower
      on borrower.household_id = lender.household_id
     and lender.household_id is not null
    where lender.id = new.lender_id
      and borrower.id = new.borrower_id
  ) then
    raise exception 'El préstamo es entre las dos del hogar';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(sum(amount), 0)
    into repaid
    from public.loan_repayments
    where loan_id = new.id;

    if new.amount < repaid then
      raise exception 'La devolución supera lo que falta del préstamo';
    end if;
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_loan() from public, anon, authenticated;

create trigger loans_guard
  before insert or update or delete on public.loans
  for each row
  execute function private.guard_loan();

create function private.guard_loan_repayment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  loan_amount numeric(12, 2);
  repaid numeric(12, 2);
begin
  if tg_op = 'DELETE' then
    -- El cascade al borrar el préstamo entra anidado: no exige que cada
    -- devolución sea de quien está borrando el préstamo.
    if actor is not null
      and pg_trigger_depth() = 1
      and old.created_by is distinct from actor then
      raise exception 'Solo quien la cargó puede borrar la devolución';
    end if;
    return old;
  end if;

  if new.period is null then
    new.period := date_trunc('month', new.paid_on)::date;
  else
    new.period := date_trunc('month', new.period)::date;
  end if;

  if actor is not null then
    if tg_op = 'INSERT' then
      new.created_by := actor;
    elsif old.created_by is distinct from actor then
      raise exception 'Solo quien la cargó puede modificar la devolución';
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.loan_id is distinct from old.loan_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'No se puede cambiar de qué préstamo es la devolución';
  end if;

  select amount
  into loan_amount
  from public.loans
  where id = new.loan_id
  for update;

  if loan_amount is null then
    raise exception 'El préstamo no existe';
  end if;

  if not exists (
    select 1
    from public.loans
    where id = new.loan_id
      and new.created_by in (lender_id, borrower_id)
  ) then
    raise exception 'Solo quienes participan pueden registrar la devolución';
  end if;

  select coalesce(sum(amount), 0)
  into repaid
  from public.loan_repayments
  where loan_id = new.loan_id
    and id is distinct from new.id;

  if repaid + new.amount > loan_amount then
    raise exception 'La devolución supera lo que falta del préstamo';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_loan_repayment() from public, anon, authenticated;

create trigger loan_repayments_guard
  before insert or update or delete on public.loan_repayments
  for each row
  execute function private.guard_loan_repayment();

alter table public.loans enable row level security;
alter table public.loan_repayments enable row level security;

create policy loans_select on public.loans
for select to authenticated
using ((select auth.uid()) in (lender_id, borrower_id));

create policy loans_insert on public.loans
for insert to authenticated
with check (lender_id = (select auth.uid()));

create policy loans_update on public.loans
for update to authenticated
using (lender_id = (select auth.uid()))
with check (lender_id = (select auth.uid()));

create policy loans_delete on public.loans
for delete to authenticated
using (lender_id = (select auth.uid()));

create policy loan_repayments_select on public.loan_repayments
for select to authenticated
using (
  exists (
    select 1
    from public.loans as loan
    where loan.id = loan_id
      and (select auth.uid()) in (loan.lender_id, loan.borrower_id)
  )
);

create policy loan_repayments_insert on public.loan_repayments
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.loans as loan
    where loan.id = loan_id
      and (select auth.uid()) in (loan.lender_id, loan.borrower_id)
  )
);

create policy loan_repayments_update on public.loan_repayments
for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy loan_repayments_delete on public.loan_repayments
for delete to authenticated
using (created_by = (select auth.uid()));

revoke all on public.loans from public, anon, authenticated;
revoke all on public.loan_repayments from public, anon, authenticated;
grant select, insert, update, delete on public.loans to authenticated;
grant select, insert, update, delete on public.loan_repayments to authenticated;

create view public.loan_balances
with (security_invoker = true) as
select
  loan.id,
  loan.lender_id,
  loan.borrower_id,
  loan.amount,
  loan.lent_on,
  loan.period,
  loan.notes,
  loan.created_at,
  coalesce(sum(repayment.amount), 0)::numeric(12, 2) as repaid,
  (loan.amount - coalesce(sum(repayment.amount), 0))::numeric(12, 2) as pending,
  case
    when coalesce(sum(repayment.amount), 0) = 0 then 'pendiente'
    when coalesce(sum(repayment.amount), 0) < loan.amount then 'parcial'
    else 'saldado'
  end as status
from public.loans as loan
left join public.loan_repayments as repayment on repayment.loan_id = loan.id
group by loan.id;

revoke all on public.loan_balances from public, anon, authenticated;
grant select on public.loan_balances to authenticated;
