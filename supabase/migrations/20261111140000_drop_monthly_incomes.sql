-- monthly_incomes quedó sin lecturas tras base_salaries (20261020170000).
drop policy if exists monthly_incomes_select on public.monthly_incomes;
drop policy if exists monthly_incomes_insert on public.monthly_incomes;
drop policy if exists monthly_incomes_update on public.monthly_incomes;
revoke all on table public.monthly_incomes from public, anon, authenticated;
drop table if exists public.monthly_incomes cascade;
