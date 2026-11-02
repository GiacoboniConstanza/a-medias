-- Vincula las devoluciones generadas al saldar un mes, para poder
-- deshacerlas sin tocar las que se cargaron a mano.

alter table public.loan_repayments
  add column if not exists settlement_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'loan_repayments_settlement_id_fkey'
  ) then
    alter table public.loan_repayments
      add constraint loan_repayments_settlement_id_fkey
      foreign key (settlement_id) references public.settlements (id) on delete cascade;
  end if;
end
$$;

create index if not exists loan_repayments_settlement_idx
  on public.loan_repayments (settlement_id);

create or replace function private.guard_loan_repayment()
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
    if old.settlement_id is not null and pg_trigger_depth() = 1 then
      raise exception 'La devolución del saldo se borra al deshacer el mes';
    end if;
    -- El cascade al borrar el préstamo o el saldo entra anidado.
    if actor is not null
      and pg_trigger_depth() = 1
      and old.created_by is distinct from actor then
      raise exception 'Solo quien la cargó puede borrar la devolución';
    end if;
    return old;
  end if;

  if new.settlement_id is not null
    and coalesce(current_setting('amedias.settling', true), '') is distinct from '1' then
    raise exception 'La devolución del saldo la genera el cierre del mes';
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
    old.settlement_id is not null
    or new.settlement_id is distinct from old.settlement_id
  ) then
    raise exception 'La devolución del saldo no se edita';
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

create or replace function public.settle_shared_month(
  p_month date,
  p_debtor uuid,
  p_creditor uuid,
  p_amount numeric,
  p_expense_amount numeric,
  p_expense_debtor uuid,
  p_repayments jsonb
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
  paid_on date;
  loan_signed numeric(14, 2);
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

  if exists (
    with given as (
      select
        (item.value ->> 'loan_id')::uuid as loan_id,
        round((item.value ->> 'amount')::numeric, 2) as amount
      from jsonb_array_elements(coalesce(p_repayments, '[]'::jsonb)) as item(value)
    ),
    expected as (
      select loan.id as loan_id, round(loan.pending, 2) as amount
      from public.loan_balances as loan
      where loan.period <= month_start
        and loan.pending > 0
        and (loan.lender_id, loan.borrower_id) in ((actor, partner), (partner, actor))
    )
    select 1
    from (
      select given.loan_id, given.amount from given
      except
      select expected.loan_id, expected.amount from expected
    ) as extra
    union all
    select 1
    from (
      select expected.loan_id, expected.amount from expected
      except
      select given.loan_id, given.amount from given
    ) as missing
  ) then
    raise exception 'Las devoluciones no coinciden con los préstamos pendientes';
  end if;

  select coalesce(round(sum(
    case
      when loan.lender_id = p_creditor then loan.pending
      when loan.borrower_id = p_creditor then -loan.pending
      else 0
    end
  ), 2), 0)
  into loan_signed
  from public.loan_balances as loan
  where loan.period <= month_start
    and loan.pending > 0
    and (loan.lender_id, loan.borrower_id) in ((actor, partner), (partner, actor));

  if p_expense_amount = 0 then
    expense_signed := 0;
  elsif p_expense_debtor is null
    or (p_expense_debtor is distinct from actor and p_expense_debtor is distinct from partner) then
    raise exception 'El reparto de gastos es entre las dos del hogar';
  elsif p_expense_debtor = p_creditor then
    expense_signed := -round(p_expense_amount, 2);
  else
    expense_signed := round(p_expense_amount, 2);
  end if;

  net := round(expense_signed + loan_signed, 2);
  if net <= 0
    or round(p_amount, 2) <> net
    or p_debtor is distinct from (case when p_creditor = actor then partner else actor end) then
    raise exception 'El monto a saldar no cierra';
  end if;

  paid_on := (month_start + interval '1 month' - interval '1 day')::date;
  perform set_config('amedias.settling', '1', true);

  insert into public.settlements (household_id, month, debtor_id, creditor_id, amount, settled_by)
  values (household, month_start, p_debtor, p_creditor, net, actor)
  returning id into settlement;

  insert into public.loan_repayments (loan_id, amount, paid_on, period, notes, created_by, settlement_id)
  select
    (item.value ->> 'loan_id')::uuid,
    round((item.value ->> 'amount')::numeric, 2),
    paid_on,
    month_start,
    'Saldado con el mes',
    actor,
    settlement
  from jsonb_array_elements(coalesce(p_repayments, '[]'::jsonb)) as item(value);

  return settlement;
end;
$$;

create or replace function public.undo_shared_month(p_settlement uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  household uuid;
  target uuid;
begin
  if actor is null then
    raise exception 'Tenés que entrar para deshacer';
  end if;

  select profile.household_id
  into household
  from public.profiles as profile
  where profile.id = actor;

  select settlement_row.household_id
  into target
  from public.settlements as settlement_row
  where settlement_row.id = p_settlement;

  if target is null or target is distinct from household then
    raise exception 'Ese saldo no es de tu hogar';
  end if;

  delete from public.settlements
  where id = p_settlement;
end;
$$;

revoke all on function public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid, jsonb) from public, anon;
revoke all on function public.undo_shared_month(uuid) from public, anon;
grant execute on function public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid, jsonb) to authenticated;
grant execute on function public.undo_shared_month(uuid) to authenticated;
