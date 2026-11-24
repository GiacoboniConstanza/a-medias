-- Marca un mes de un gasto fijo como «sin monto» sin cortar el arrastre a los meses siguientes.

create table public.fixed_expense_month_clears (
  fixed_expense_id uuid not null references public.fixed_expenses (id) on delete cascade,
  month date not null,
  cleared_by uuid not null references auth.users (id),
  cleared_at timestamptz not null default now(),
  primary key (fixed_expense_id, month),
  constraint fixed_expense_month_clears_month_start check (extract(day from month) = 1)
);

create index fixed_expense_month_clears_month_idx
  on public.fixed_expense_month_clears (month);

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

-- Vaciar montos del mes: compartidos + privados propios, solo impagos con monto.
create or replace function public.clear_fixed_amounts_for_month(p_month date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  cleared integer := 0;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'Elegí el mes';
  end if;

  select p.household_id into hid from public.profiles as p where p.id = uid;
  if hid is null then
    raise exception 'No pertenecés a este hogar';
  end if;

  with candidates as (
    select f.id
    from public.fixed_expenses as f
    where f.household_id = hid
      and f.paused_at is null
      and (
        f.is_shared
        or f.owner_id = uid
      )
      and not exists (
        select 1 from public.fixed_payments as p
        where p.fixed_expense_id = f.id and p.month = p_month
      )
      and private.fixed_amount_for_month(f.id, p_month) is not null
  ),
  inserted as (
    insert into public.fixed_expense_month_clears (fixed_expense_id, month, cleared_by)
    select c.id, p_month, uid from candidates as c
    on conflict (fixed_expense_id, month) do nothing
    returning fixed_expense_id
  )
  select count(*)::integer into cleared from inserted;

  return cleared;
end;
$$;

-- Al cargar un monto de ese mes, se quita la marca.
create or replace function private.clear_fixed_month_mark_on_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fixed_expense_month_clears as c
  where c.fixed_expense_id = new.fixed_expense_id
    and c.month = new.effective_from;
  return new;
end;
$$;

drop trigger if exists fixed_expense_amounts_clear_mark on public.fixed_expense_amounts;
create trigger fixed_expense_amounts_clear_mark
  after insert or update of amount, effective_from on public.fixed_expense_amounts
  for each row
  execute function private.clear_fixed_month_mark_on_amount();

revoke all on function public.clear_fixed_amounts_for_month(date) from public, anon;
grant execute on function public.clear_fixed_amounts_for_month(date) to authenticated;
revoke all on function private.clear_fixed_month_mark_on_amount() from public, anon, authenticated;

alter table public.fixed_expense_month_clears enable row level security;

create policy fixed_expense_month_clears_select on public.fixed_expense_month_clears
for select to authenticated
using (
  exists (
    select 1 from public.fixed_expenses as f
    where f.id = fixed_expense_id
      and private.is_member(f.household_id)
  )
);

create policy fixed_expense_month_clears_insert on public.fixed_expense_month_clears
for insert to authenticated
with check (
  cleared_by = (select auth.uid())
  and exists (
    select 1 from public.fixed_expenses as f
    where f.id = fixed_expense_id
      and private.is_member(f.household_id)
  )
);

create policy fixed_expense_month_clears_delete on public.fixed_expense_month_clears
for delete to authenticated
using (
  exists (
    select 1 from public.fixed_expenses as f
    where f.id = fixed_expense_id
      and private.is_member(f.household_id)
  )
);

revoke all on table public.fixed_expense_month_clears from public, anon;
grant select, insert, delete on public.fixed_expense_month_clears to authenticated;
