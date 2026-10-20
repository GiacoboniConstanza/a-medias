-- Historial de sueldo base. El monto lo ve solo su dueña.
-- El porcentaje del reparto sale de private y no incluye montos ajenos.
-- Los porcentajes siguen a salaryPercents en src/lib/salary.ts.

create table public.base_salaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14, 2) not null,
  effective_from date not null,
  created_at timestamptz not null default now(),
  constraint base_salaries_user_month unique (user_id, effective_from),
  constraint base_salaries_month_start check (extract(day from effective_from) = 1),
  constraint base_salaries_amount_positive check (amount > 0)
);

create index base_salaries_user_effective_idx
  on public.base_salaries (user_id, effective_from desc);

insert into public.base_salaries (user_id, amount, effective_from)
select changes.user_id, changes.base_amount, changes.month
from (
  select
    income.user_id,
    income.base_amount,
    income.month,
    lag(income.base_amount) over (partition by income.user_id order by income.month) as prev_amount
  from public.monthly_incomes as income
) as changes
where changes.prev_amount is null
   or changes.prev_amount is distinct from changes.base_amount;

create table public.split_notices (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  recipient_percent integer not null,
  partner_percent integer not null,
  created_at timestamptz not null default now(),
  constraint split_notices_recipient_month unique (recipient_id, effective_from),
  constraint split_notices_month_start check (extract(day from effective_from) = 1),
  constraint split_notices_percents check (
    recipient_percent between 0 and 100
    and partner_percent between 0 and 100
  )
);

create index split_notices_recipient_idx
  on public.split_notices (recipient_id, effective_from);

create function private.split_percents(bases numeric[])
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  n integer := coalesce(array_length(bases, 1), 0);
  weights numeric[];
  weight_sum numeric := 0;
  percents integer[] := array[]::integer[];
  missing boolean := false;
  i integer;
  total integer := 0;
begin
  if n = 0 then
    return percents;
  end if;

  for i in 1..n loop
    if coalesce(bases[i], 0) <= 0 then
      missing := true;
    end if;
  end loop;

  if missing then
    weights := array[]::numeric[];
    for i in 1..n loop
      weights := weights || 1::numeric;
    end loop;
  else
    weights := bases;
  end if;

  for i in 1..n loop
    weight_sum := weight_sum + coalesce(weights[i], 0);
  end loop;

  for i in 1..n loop
    if weight_sum = 0 then
      percents := percents || round(100::numeric / n)::integer;
    else
      percents := percents || round((weights[i] / weight_sum) * 100)::integer;
    end if;
    total := total + percents[i];
  end loop;

  percents[1] := percents[1] + (100 - total);
  return percents;
end;
$$;

create function private.bases_at(
  target_household uuid,
  target_month date,
  override_user uuid,
  override_amount numeric,
  override_from date,
  replacing boolean
)
returns table (user_id uuid, amount numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  member uuid;
  chosen numeric;
  chosen_from date;
  row_from date;
  row_amount numeric;
begin
  for member in
    select p.id
    from public.profiles as p
    where p.household_id = target_household
    order by p.id
  loop
    chosen := null;
    chosen_from := null;

    for row_from, row_amount in
      select s.effective_from, s.amount
      from public.base_salaries as s
      where s.user_id = member
        and s.effective_from <= target_month
        and not (
          replacing
          and override_user is not null
          and member = override_user
          and s.effective_from = (
            select max(latest.effective_from)
            from public.base_salaries as latest
            where latest.user_id = member
          )
        )
      order by s.effective_from desc
    loop
      chosen := row_amount;
      chosen_from := row_from;
      exit;
    end loop;

    if override_user is not null
      and member = override_user
      and override_from is not null
      and override_amount is not null
      and override_from <= target_month
      and (chosen_from is null or override_from >= chosen_from)
    then
      chosen := override_amount;
    end if;

    user_id := member;
    amount := coalesce(chosen, 0);
    return next;
  end loop;
end;
$$;

create function private.percents_for(
  target_household uuid,
  target_month date,
  override_user uuid,
  override_amount numeric,
  override_from date,
  replacing boolean
)
returns table (user_id uuid, percent integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ids uuid[];
  bases numeric[];
  percents integer[];
  i integer;
begin
  select
    coalesce(array_agg(b.user_id order by b.user_id), array[]::uuid[]),
    coalesce(array_agg(b.amount order by b.user_id), array[]::numeric[])
  into ids, bases
  from private.bases_at(target_household, target_month, override_user, override_amount, override_from, replacing) as b;

  if coalesce(array_length(ids, 1), 0) = 0 then
    return;
  end if;

  percents := private.split_percents(bases);
  for i in 1..array_length(ids, 1) loop
    user_id := ids[i];
    percent := percents[i];
    return next;
  end loop;
end;
$$;

create function private.household_split_percents(target_household uuid, target_month date)
returns table (user_id uuid, percent integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or target_household is null or not private.is_member(target_household) then
    return;
  end if;

  if target_month is null or extract(day from target_month) <> 1 then
    raise exception 'El mes tiene que empezar el día 1';
  end if;

  return query
  select s.user_id, s.percent
  from private.percents_for(target_household, target_month, null, null, null, false) as s;
end;
$$;

create function private.split_is_even(target_household uuid, target_month date)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  missing boolean;
begin
  if target_household is null or not private.is_member(target_household) then
    return false;
  end if;

  select coalesce(bool_or(b.amount <= 0), false)
  into missing
  from private.bases_at(target_household, target_month, null, null, null, false) as b;

  return missing;
end;
$$;

create function private.preview_salary_split(
  new_amount numeric,
  effective_from date,
  replacing boolean
)
returns table (
  my_old_percent integer,
  my_new_percent integer,
  partner_old_percent integer,
  partner_new_percent integer,
  shared_total numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  old_mine integer := 0;
  old_partner integer := 0;
  new_mine integer := 0;
  new_partner integer := 0;
  total numeric;
  rec record;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select p.household_id into hid
  from public.profiles as p
  where p.id = uid;

  if hid is null then
    raise exception 'No pertenecés a este hogar';
  end if;

  if effective_from is null or extract(day from effective_from) <> 1 then
    raise exception 'Elegí el mes';
  end if;

  if new_amount is null or round(new_amount, 2) <= 0 then
    raise exception 'El sueldo tiene que ser mayor a cero';
  end if;

  for rec in
    select s.user_id, s.percent
    from private.percents_for(hid, effective_from, null, null, null, false) as s
  loop
    if rec.user_id = uid then
      old_mine := rec.percent;
    else
      old_partner := rec.percent;
    end if;
  end loop;

  for rec in
    select s.user_id, s.percent
    from private.percents_for(hid, effective_from, uid, round(new_amount, 2), effective_from, replacing) as s
  loop
    if rec.user_id = uid then
      new_mine := rec.percent;
    else
      new_partner := rec.percent;
    end if;
  end loop;

  select coalesce(sum(e.amount), 0)
  into total
  from public.expenses as e
  where e.household_id = hid
    and e.is_shared
    and e.spent_on >= effective_from
    and e.spent_on < (effective_from + interval '1 month')::date;

  my_old_percent := old_mine;
  my_new_percent := new_mine;
  partner_old_percent := old_partner;
  partner_new_percent := new_partner;
  shared_total := total;
  return next;
end;
$$;

create function private.write_split_notice(target_household uuid, author uuid, target_month date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous date := (target_month - interval '1 month')::date;
  partner uuid;
  now_mine integer := 0;
  now_partner integer := 0;
  prev_mine integer := 0;
  prev_partner integer := 0;
  rec record;
begin
  select p.id into partner
  from public.profiles as p
  where p.household_id = target_household
    and p.id <> author
  order by p.id
  limit 1;

  if partner is null then
    delete from public.split_notices as n
    where n.recipient_id = author
      and n.effective_from = target_month;
    return;
  end if;

  for rec in
    select s.user_id, s.percent
    from private.percents_for(target_household, target_month, null, null, null, false) as s
  loop
    if rec.user_id = partner then
      now_partner := rec.percent;
    elsif rec.user_id = author then
      now_mine := rec.percent;
    end if;
  end loop;

  for rec in
    select s.user_id, s.percent
    from private.percents_for(target_household, previous, null, null, null, false) as s
  loop
    if rec.user_id = partner then
      prev_partner := rec.percent;
    elsif rec.user_id = author then
      prev_mine := rec.percent;
    end if;
  end loop;

  delete from public.split_notices as n
  where n.effective_from = target_month
    and n.recipient_id = author;

  if now_mine is not distinct from prev_mine and now_partner is not distinct from prev_partner then
    delete from public.split_notices as n
    where n.effective_from = target_month
      and n.recipient_id = partner;
    return;
  end if;

  insert into public.split_notices (recipient_id, effective_from, recipient_percent, partner_percent)
  values (partner, target_month, now_partner, now_mine)
  on conflict (recipient_id, effective_from) do update
  set recipient_percent = excluded.recipient_percent,
      partner_percent = excluded.partner_percent,
      created_at = statement_timestamp();
end;
$$;

create function private.guard_salary_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.base_salaries as s
      where s.user_id = old.user_id
        and s.effective_from > old.effective_from
    ) then
      raise exception 'Solo podés editar o borrar el aumento más reciente';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if exists (
      select 1
      from public.base_salaries as s
      where s.user_id = new.user_id
        and s.effective_from >= new.effective_from
    ) then
      raise exception 'El aumento tiene que ser posterior al último sueldo';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'El sueldo no cambia de persona';
  end if;

  if exists (
    select 1
    from public.base_salaries as s
    where s.user_id = old.user_id
      and s.effective_from > old.effective_from
  ) then
    raise exception 'Solo podés editar o borrar el aumento más reciente';
  end if;

  if exists (
    select 1
    from public.base_salaries as s
    where s.user_id = old.user_id
      and s.id <> old.id
      and s.effective_from >= new.effective_from
  ) then
    raise exception 'Ese mes ya está en el historial';
  end if;

  return new;
end;
$$;

create function private.sync_salary_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  subject uuid := coalesce(new.user_id, old.user_id);
  hid uuid;
begin
  select p.household_id into hid
  from public.profiles as p
  where p.id = subject;

  if hid is not null then
    perform private.write_split_notice(hid, subject, coalesce(new.effective_from, old.effective_from));
    if tg_op = 'UPDATE' and old.effective_from is distinct from new.effective_from then
      perform private.write_split_notice(hid, subject, old.effective_from);
    end if;
  end if;

  return null;
end;
$$;

create trigger base_salaries_guard
  before insert or update or delete on public.base_salaries
  for each row
  execute function private.guard_salary_change();

create trigger base_salaries_notice
  after insert or update or delete on public.base_salaries
  for each row
  execute function private.sync_salary_notice();

create function public.household_split_percents(target_month date)
returns table (user_id uuid, percent integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.user_id, s.percent
  from private.household_split_percents((select private.my_household_id()), target_month) as s
$$;

create function public.household_split_is_even(target_month date)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.split_is_even((select private.my_household_id()), target_month)
$$;

create function public.preview_salary_split(
  new_amount numeric,
  effective_from date,
  replacing boolean
)
returns table (
  my_old_percent integer,
  my_new_percent integer,
  partner_old_percent integer,
  partner_new_percent integer,
  shared_total numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    preview.my_old_percent,
    preview.my_new_percent,
    preview.partner_old_percent,
    preview.partner_new_percent,
    preview.shared_total
  from private.preview_salary_split(new_amount, effective_from, replacing) as preview
$$;

revoke all on function private.split_percents(numeric[]) from public, anon, authenticated;
revoke all on function private.bases_at(uuid, date, uuid, numeric, date, boolean) from public, anon, authenticated;
revoke all on function private.percents_for(uuid, date, uuid, numeric, date, boolean) from public, anon, authenticated;
revoke all on function private.household_split_percents(uuid, date) from public, anon, authenticated;
revoke all on function private.split_is_even(uuid, date) from public, anon, authenticated;
revoke all on function private.preview_salary_split(numeric, date, boolean) from public, anon, authenticated;
revoke all on function private.write_split_notice(uuid, uuid, date) from public, anon, authenticated;
revoke all on function private.guard_salary_change() from public, anon, authenticated;
revoke all on function private.sync_salary_notice() from public, anon, authenticated;

grant execute on function private.household_split_percents(uuid, date) to authenticated;
grant execute on function private.split_is_even(uuid, date) to authenticated;
grant execute on function private.preview_salary_split(numeric, date, boolean) to authenticated;

revoke all on function public.household_split_percents(date) from public, anon;
revoke all on function public.household_split_is_even(date) from public, anon;
revoke all on function public.preview_salary_split(numeric, date, boolean) from public, anon;
grant execute on function public.household_split_percents(date) to authenticated;
grant execute on function public.household_split_is_even(date) to authenticated;
grant execute on function public.preview_salary_split(numeric, date, boolean) to authenticated;

alter table public.base_salaries enable row level security;
alter table public.split_notices enable row level security;

create policy base_salaries_select on public.base_salaries
for select to authenticated
using (user_id = (select auth.uid()));

create policy base_salaries_insert on public.base_salaries
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy base_salaries_update on public.base_salaries
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy base_salaries_delete on public.base_salaries
for delete to authenticated
using (user_id = (select auth.uid()));

create policy split_notices_select on public.split_notices
for select to authenticated
using (recipient_id = (select auth.uid()));

drop policy if exists monthly_incomes_select on public.monthly_incomes;

create policy monthly_incomes_select on public.monthly_incomes
for select to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.base_salaries from public, anon;
revoke all on table public.split_notices from public, anon;

grant select, insert, update, delete on public.base_salaries to authenticated;
grant select on public.split_notices to authenticated;
