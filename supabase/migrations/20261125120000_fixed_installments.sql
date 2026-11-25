-- Cuotas: columnas opcionales en fixed_expenses y corte de ventana en fixed_amount_for_month.

alter table public.fixed_expenses
  add column if not exists installment_count integer,
  add column if not exists first_month date,
  add column if not exists total_amount numeric(14, 2),
  add column if not exists installment_closed_from integer,
  add column if not exists installment_payoff_prior_paid boolean;

alter table public.fixed_expenses
  drop constraint if exists fixed_expenses_installment_pair;

alter table public.fixed_expenses
  add constraint fixed_expenses_installment_pair check (
    (installment_count is null and first_month is null)
    or (
      installment_count is not null
      and first_month is not null
      and installment_count >= 2
      and extract(day from first_month) = 1
    )
  );

alter table public.fixed_expenses
  drop constraint if exists fixed_expenses_total_amount_positive;

alter table public.fixed_expenses
  add constraint fixed_expenses_total_amount_positive check (
    total_amount is null or total_amount > 0
  );

alter table public.fixed_expenses
  drop constraint if exists fixed_expenses_closed_from_ok;

alter table public.fixed_expenses
  add constraint fixed_expenses_closed_from_ok check (
    installment_closed_from is null
    or (
      installment_count is not null
      and installment_closed_from >= installment_count
      and installment_closed_from >= 2
    )
  );

create or replace function private.fixed_amount_for_month(
  p_fixed_id uuid,
  p_month date
)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.fixed_expenses as f
      where f.id = p_fixed_id
        and f.installment_count is not null
        and f.first_month is not null
        and (
          p_month < f.first_month
          or p_month > (f.first_month + make_interval(months => f.installment_count - 1))::date
        )
    ) then null
    when exists (
      select 1
      from public.fixed_expense_month_clears as c
      where c.fixed_expense_id = p_fixed_id
        and c.month = p_month
    ) then null
    else (
      select a.amount
      from public.fixed_expense_amounts as a
      where a.fixed_expense_id = p_fixed_id
        and a.effective_from <= p_month
      order by a.effective_from desc
      limit 1
    )
  end
$$;
