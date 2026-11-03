-- Archivar y restaurar ahorros, un solo compartido activo,
-- y bloquear préstamos y devoluciones de un mes saldado.

alter table public.shared_goals
  add column if not exists archived_at timestamptz;

alter table public.savings_funds
  add column if not exists archived_at timestamptz;

do $$
declare
  dup uuid;
  idx_valid boolean;
begin
  select g.household_id
  into dup
  from public.shared_goals as g
  group by g.household_id
  having count(*) filter (where g.archived_at is null) > 1
  limit 1;

  if dup is not null then
    raise exception 'Hay más de un ahorro compartido activo en el hogar %. Elegí a mano cuál queda activo antes de aplicar esta migración.', dup;
  end if;

  select i.indisvalid
  into idx_valid
  from pg_index as i
  join pg_class as c on c.oid = i.indexrelid
  join pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'shared_goals_one_active_idx';

  if idx_valid is false then
    execute 'drop index public.shared_goals_one_active_idx';
  end if;
end
$$;

create unique index if not exists shared_goals_one_active_idx
  on public.shared_goals (household_id)
  where archived_at is null;

grant update on public.shared_goals to authenticated;

drop policy if exists shared_goals_update on public.shared_goals;
create policy shared_goals_update on public.shared_goals
for update to authenticated
using (household_id = (select private.my_household_id()))
with check (household_id = (select private.my_household_id()));

create or replace function private.guard_savings_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'shared_goals' then
    if new.household_id is distinct from old.household_id
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
      or new.emoji is distinct from old.emoji
      or new.icon is distinct from old.icon
    then
      raise exception 'No se puede cambiar el hogar ni el ícono del ahorro compartido';
    end if;
  elsif tg_table_name = 'savings_funds' then
    if new.user_id is distinct from old.user_id
      or new.id is distinct from old.id
      or new.created_at is distinct from old.created_at
    then
      raise exception 'No se puede cambiar de quién es el ahorro';
    end if;
  end if;

  if old.archived_at is not null then
    if new.archived_at is not null
      or new.name is distinct from old.name
      or new.target_amount is distinct from old.target_amount
      or new.target_date is distinct from old.target_date
      or (
        tg_table_name = 'savings_funds'
        and (new.icon is distinct from old.icon or new.emoji is distinct from old.emoji)
      )
    then
      raise exception 'Este ahorro está archivado. Restauralo para cambiarlo.';
    end if;
  elsif new.archived_at is not null
    and (
      new.name is distinct from old.name
      or new.target_amount is distinct from old.target_amount
      or new.target_date is distinct from old.target_date
      or (
        tg_table_name = 'savings_funds'
        and (new.icon is distinct from old.icon or new.emoji is distinct from old.emoji)
      )
    )
  then
    raise exception 'Archivar no cambia el nombre ni la meta';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_savings_row() from public, anon, authenticated;

drop trigger if exists shared_goals_guard_archive on public.shared_goals;
create trigger shared_goals_guard_archive
  before update on public.shared_goals
  for each row
  execute function private.guard_savings_row();

drop trigger if exists savings_funds_guard_archive on public.savings_funds;
create trigger savings_funds_guard_archive
  before update on public.savings_funds
  for each row
  execute function private.guard_savings_row();

create or replace function private.guard_archived_savings_money()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archived timestamptz;
  v_fund uuid;
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    v_fund := old.fund_id;
    if v_fund is not null then
      select f.archived_at into v_archived from public.savings_funds as f where f.id = v_fund;
      if v_archived is not null then
        raise exception 'Ese ahorro está archivado. No se le puede sumar ni sacar plata.';
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    v_fund := new.fund_id;
    if v_fund is not null then
      select f.archived_at into v_archived from public.savings_funds as f where f.id = v_fund;
      if v_archived is not null then
        raise exception 'Ese ahorro está archivado. No se le puede sumar ni sacar plata.';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_archived_savings_money() from public, anon, authenticated;

drop trigger if exists bag_movements_guard_archived on public.bag_movements;
create trigger bag_movements_guard_archived
  before insert or update or delete on public.bag_movements
  for each row
  execute function private.guard_archived_savings_money();

drop trigger if exists extra_allocations_guard_archived on public.extra_allocations;
create trigger extra_allocations_guard_archived
  before insert or update or delete on public.extra_allocations
  for each row
  execute function private.guard_archived_savings_money();

create or replace function private.guard_archived_goal_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.shared_goals as g
    where g.id = new.goal_id
      and g.archived_at is not null
  ) then
    raise exception 'Ese ahorro está archivado. No se le pueden sumar aportes.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_archived_goal_contribution() from public, anon, authenticated;

drop trigger if exists goal_contributions_guard_archived on public.goal_contributions;
create trigger goal_contributions_guard_archived
  before insert on public.goal_contributions
  for each row
  execute function private.guard_archived_goal_contribution();

create or replace function public.replace_active_shared_goal(
  p_restore uuid,
  p_name text,
  p_icon text,
  p_target numeric,
  p_target_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_hid uuid;
  v_current_id uuid;
  v_created uuid;
  v_icon text := coalesce(nullif(btrim(p_icon), ''), 'piggy-bank');
begin
  if v_actor is null then
    raise exception 'Tenés que entrar para cambiar el ahorro';
  end if;

  select profile.household_id
  into v_hid
  from public.profiles as profile
  where profile.id = v_actor;

  if v_hid is null or not private.is_member(v_hid) then
    raise exception 'No estás en un hogar';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('shared-goal:' || v_hid::text, 0));

  if p_restore is not null and not exists (
    select 1
    from public.shared_goals as g
    where g.id = p_restore
      and g.household_id = v_hid
  ) then
    raise exception 'Ese ahorro no es de tu hogar';
  end if;

  select g.id
  into v_current_id
  from public.shared_goals as g
  where g.household_id = v_hid
    and g.archived_at is null
  for update;

  if v_current_id is not null and v_current_id is distinct from p_restore then
    update public.shared_goals
    set archived_at = statement_timestamp()
    where id = v_current_id;
  end if;

  if p_restore is null then
    if p_name is null or char_length(btrim(p_name)) = 0 then
      raise exception 'Poné un nombre';
    end if;
    if p_target is null or p_target <= 0 then
      raise exception 'La meta tiene que ser mayor a 0';
    end if;

    insert into public.shared_goals (household_id, name, emoji, icon, target_amount, target_date)
    values (v_hid, btrim(p_name), v_icon, v_icon, p_target, p_target_date)
    returning id into v_created;
    return v_created;
  end if;

  update public.shared_goals
  set archived_at = null
  where id = p_restore;

  return p_restore;
end;
$$;

revoke all on function public.replace_active_shared_goal(uuid, text, text, numeric, date) from public, anon;
grant execute on function public.replace_active_shared_goal(uuid, text, text, numeric, date) to authenticated;

create or replace function private.guard_settled_loan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lender uuid;
  v_borrower uuid;
  v_period date;
  v_loan_id uuid;
  v_hid uuid;
  v_locked boolean;
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_lender := old.lender_id;
    v_borrower := old.borrower_id;
    v_period := old.period;
    v_loan_id := old.id;
  else
    v_lender := new.lender_id;
    v_borrower := new.borrower_id;
    v_period := new.period;
    v_loan_id := new.id;
  end if;

  if not exists (select 1 from auth.users as u where u.id = v_lender)
    or not exists (select 1 from auth.users as u where u.id = v_borrower)
  then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select profile.household_id
  into v_hid
  from public.profiles as profile
  where profile.id = v_lender;

  if v_hid is null or not exists (select 1 from public.households as h where h.id = v_hid) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_locked := exists (
    select 1 from public.settlements as s
    where s.household_id = v_hid and s.month = v_period
  );

  if tg_op = 'UPDATE' and not v_locked then
    v_locked := exists (
      select 1 from public.settlements as s
      where s.household_id = v_hid and s.month = old.period
    );
  end if;

  if tg_op <> 'INSERT' and not v_locked then
    v_locked := exists (
      select 1
      from public.loan_repayments as repayment
      where repayment.loan_id = v_loan_id
        and repayment.settlement_id is not null
    );
  end if;

  if v_locked then
    raise exception 'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este préstamo.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_settled_loan() from public, anon, authenticated;

drop trigger if exists loans_guard_settled on public.loans;
create trigger loans_guard_settled
  before insert or update or delete on public.loans
  for each row
  execute function private.guard_settled_loan();

create or replace function private.guard_settled_loan_repayment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lender uuid;
  v_borrower uuid;
  v_period date;
  v_hid uuid;
  v_locked boolean;
begin
  if coalesce(current_setting('amedias.settling', true), '') = '1' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_period := old.period;
    select loan.lender_id, loan.borrower_id
    into v_lender, v_borrower
    from public.loans as loan
    where loan.id = old.loan_id;
  else
    v_period := new.period;
    select loan.lender_id, loan.borrower_id
    into v_lender, v_borrower
    from public.loans as loan
    where loan.id = new.loan_id;
  end if;

  if v_lender is null
    or not exists (select 1 from auth.users as u where u.id = v_lender)
    or not exists (select 1 from auth.users as u where u.id = v_borrower)
  then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select profile.household_id
  into v_hid
  from public.profiles as profile
  where profile.id = v_lender;

  if v_hid is null or not exists (select 1 from public.households as h where h.id = v_hid) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_locked := exists (
    select 1
    from public.settlements as s
    where s.household_id = v_hid
      and s.month = v_period
  );

  if tg_op = 'UPDATE' and not v_locked then
    v_locked := exists (
      select 1
      from public.settlements as s
      where s.household_id = v_hid
        and s.month = old.period
    );
  end if;

  if v_locked then
    raise exception 'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar esta devolución.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.guard_settled_loan_repayment() from public, anon, authenticated;

drop trigger if exists loan_repayments_guard_settled on public.loan_repayments;
create trigger loan_repayments_guard_settled
  before insert or update or delete on public.loan_repayments
  for each row
  execute function private.guard_settled_loan_repayment();

create or replace view public.loan_balances
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
  end as status,
  coalesce(
    (
      select settlement.month
      from public.loan_repayments as linked
      join public.settlements as settlement on settlement.id = linked.settlement_id
      where linked.loan_id = loan.id
      order by settlement.month desc
      limit 1
    ),
    (
      select settlement.month
      from public.settlements as settlement
      join public.profiles as lender on lender.household_id = settlement.household_id
      where lender.id = loan.lender_id
        and settlement.month = loan.period
    )
  ) as lock_month
from public.loans as loan
left join public.loan_repayments as repayment on repayment.loan_id = loan.id
group by loan.id;


create or replace function private.year_balance(target_year integer, as_of date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  today date := coalesce(as_of, current_date);
  y integer;
  m integer;
  year_offset integer;
  month_start date;
  month_end date;
  future boolean;
  base numeric;
  extras numeric;
  shared_count bigint;
  shared_total numeric;
  private_count bigint;
  private_sum numeric;
  member_ids uuid[];
  member_percents integer[];
  weights numeric[] := array[]::numeric[];
  pct integer;
  my_pos integer;
  my_share numeric;
  expenses numeric;
  saved numeric;
  income_total numeric;
  expense_total numeric;
  saved_total numeric;
  prev_income numeric;
  prev_expenses numeric;
  prev_saved numeric;
  months jsonb := '[]'::jsonb;
  cats jsonb := '{}'::jsonb;
  categories jsonb := '[]'::jsonb;
  cat_ids uuid[];
  cat_amounts numeric[];
  floors numeric[];
  fracs numeric[];
  allocated numeric;
  remaining integer;
  exact numeric;
  best integer;
  i integer;
  portion numeric;
  cat_key text;
  prev_amount numeric;
  rec record;
  raw text;
  total numeric;
  months_json jsonb;
  any_amount boolean;
  funds jsonb;
  goal jsonb;
  highlight jsonb;
  gustos_spent numeric;
  extras_total numeric;
  extras_saved numeric;
  dues_on_time bigint := 0;
  dues_expected bigint := 0;
  year_start date;
  year_end date;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  if target_year is null or target_year < 2000 or target_year > 2100 then
    raise exception 'Ese año no entra en el balance';
  end if;

  select p.household_id into hid
  from public.profiles as p
  where p.id = uid;

  if hid is null then
    raise exception 'No estás en un hogar';
  end if;

  for year_offset in 0..1 loop
    y := target_year - year_offset;
    income_total := null;
    expense_total := null;
    saved_total := null;

    for m in 1..12 loop
      month_start := make_date(y, m, 1);
      month_end := (month_start + interval '1 month')::date;
      future := month_start > date_trunc('month', today)::date;
      base := private.salary_at(uid, month_start);

      select case when count(*) = 0 then null else sum(e.amount) end
      into extras
      from public.income_extras as e
      where e.user_id = uid
        and e.received_on >= month_start
        and e.received_on < month_end;

      select count(*), coalesce(sum(e.amount), 0)
      into shared_count, shared_total
      from public.expenses as e
      where e.household_id = hid
        and e.is_shared
        and e.period = month_start;

      select count(*), coalesce(sum(e.amount), 0)
      into private_count, private_sum
      from public.expenses as e
      where e.owner_id = uid
        and not e.is_shared
        and not e.paid_from_bag
        and e.period = month_start;

      my_share := 0;
      if shared_count > 0 then
        select
          coalesce(array_agg(p.user_id order by p.user_id), array[]::uuid[]),
          coalesce(array_agg(p.percent order by p.user_id), array[]::integer[])
        into member_ids, member_percents
        from private.percents_for(hid, month_start, null, null, null, false) as p;

        weights := array[]::numeric[];
        if member_percents is not null then
          foreach pct in array member_percents loop
            weights := weights || pct::numeric;
          end loop;
        end if;
        my_pos := array_position(member_ids, uid);
        my_share := private.share_at(shared_total, weights, my_pos);
      end if;

      if shared_count = 0 and private_count = 0 then
        expenses := null;
      else
        expenses := private_sum + case when shared_count > 0 then my_share else 0 end;
      end if;

      if base is null and extras is null and expenses is null then
        saved := null;
      elsif future and extras is null and expenses is null then
        saved := null;
      else
        saved := coalesce(base, 0) + coalesce(extras, 0) - coalesce(expenses, 0);
      end if;

      if year_offset = 0 then
        months := months || jsonb_build_object(
          'month', m,
          'base', private.json_money(base),
          'extras', private.json_money(extras),
          'expenses', private.json_money(expenses),
          'saved', private.json_money(saved)
        );

        if shared_count > 0 and my_share <> 0 then
          select
            coalesce(array_agg(grouped.category_id order by grouped.category_id), array[]::uuid[]),
            coalesce(array_agg(grouped.amount order by grouped.category_id), array[]::numeric[])
          into cat_ids, cat_amounts
          from (
            select e.category_id, sum(e.amount) as amount
            from public.expenses as e
            where e.household_id = hid
              and e.is_shared
              and e.period = month_start
            group by e.category_id
          ) as grouped;

          floors := array[]::numeric[];
          fracs := array[]::numeric[];
          allocated := 0;
          if cat_ids is not null then
            for i in 1..coalesce(array_length(cat_ids, 1), 0) loop
              exact := my_share * cat_amounts[i] / shared_total;
              floors := floors || floor(exact * 100);
              fracs := fracs || (exact * 100 - floor(exact * 100));
              allocated := allocated + floor(exact * 100);
            end loop;
            remaining := round(my_share * 100 - allocated)::integer;
            while remaining > 0 loop
              best := 1;
              for i in 2..coalesce(array_length(fracs, 1), 0) loop
                if fracs[i] > fracs[best] then
                  best := i;
                end if;
              end loop;
              floors[best] := floors[best] + 1;
              fracs[best] := -1;
              remaining := remaining - 1;
            end loop;
            for i in 1..coalesce(array_length(cat_ids, 1), 0) loop
              portion := floors[i] / 100;
              if portion <> 0 then
                cat_key := cat_ids[i]::text;
                if cats -> cat_key is null then
                  cats := jsonb_set(cats, array[cat_key], '{}'::jsonb, true);
                end if;
                prev_amount := coalesce((cats -> cat_key ->> m::text)::numeric, 0);
                cats := jsonb_set(
                  cats,
                  array[cat_key, m::text],
                  private.json_money(prev_amount + portion),
                  true
                );
              end if;
            end loop;
          end if;
        end if;

        for rec in
          select e.category_id, sum(e.amount) as amount
          from public.expenses as e
          where e.owner_id = uid
            and not e.is_shared
            and not e.paid_from_bag
            and e.period = month_start
          group by e.category_id
        loop
          cat_key := rec.category_id::text;
          if cats -> cat_key is null then
            cats := jsonb_set(cats, array[cat_key], '{}'::jsonb, true);
          end if;
          prev_amount := coalesce((cats -> cat_key ->> m::text)::numeric, 0);
          cats := jsonb_set(
            cats,
            array[cat_key, m::text],
            private.json_money(prev_amount + rec.amount),
            true
          );
        end loop;
      end if;

      if not future then
        if base is not null or extras is not null then
          income_total := coalesce(income_total, 0) + coalesce(base, 0) + coalesce(extras, 0);
        end if;
        if expenses is not null then
          expense_total := coalesce(expense_total, 0) + expenses;
        end if;
        if saved is not null then
          saved_total := coalesce(saved_total, 0) + saved;
        end if;
      end if;
    end loop;

    if year_offset = 1 then
      prev_income := income_total;
      prev_expenses := expense_total;
      prev_saved := saved_total;
    end if;
  end loop;

  for rec in
    select c.id, c.name, c.icon
    from public.categories as c
    where cats ? c.id::text
      and (c.owner_id is null or c.owner_id = uid)
  loop
    total := 0;
    any_amount := false;
    months_json := '[]'::jsonb;
    for m in 1..12 loop
      raw := cats -> rec.id::text ->> m::text;
      if raw is null then
        months_json := months_json || 'null'::jsonb;
      else
        any_amount := true;
        total := total + raw::numeric;
        months_json := months_json || private.json_money(raw::numeric);
      end if;
    end loop;
    if any_amount then
      categories := categories || jsonb_build_object(
        'id', rec.id,
        'name', rec.name,
        'icon', coalesce(nullif(btrim(rec.icon), ''), 'tag'),
        'total', private.json_money(total),
        'months', months_json
      );
    end if;
  end loop;

  select coalesce(jsonb_agg(elem order by (elem ->> 'total')::numeric desc, elem ->> 'name'), '[]'::jsonb)
  into categories
  from jsonb_array_elements(categories) as elem;

  year_start := make_date(target_year, 1, 1);
  year_end := make_date(target_year + 1, 1, 1);

  select case when count(*) = 0 then null else sum(e.amount) end
  into gustos_spent
  from public.expenses as e
  where e.owner_id = uid
    and e.paid_from_bag
    and not e.is_shared
    and e.period >= year_start
    and e.period < year_end;

  select case when count(*) = 0 then null else sum(e.amount) end
  into extras_total
  from public.income_extras as e
  where e.user_id = uid
    and e.received_on >= year_start
    and e.received_on < year_end;

  if extras_total is null then
    extras_saved := null;
  else
    select coalesce(sum(a.amount), 0)
    into extras_saved
    from public.extra_allocations as a
    join public.income_extras as e on e.id = a.extra_id
    where e.user_id = uid
      and a.user_id = uid
      and a.fund_id is not null
      and e.received_on >= year_start
      and e.received_on < year_end;
  end if;

  select coalesce(jsonb_agg(item order by item ->> 'name'), '[]'::jsonb)
  into funds
  from (
    select jsonb_build_object(
      'id', f.id,
      'name', f.name,
      'icon', coalesce(nullif(btrim(f.icon), ''), 'piggy-bank'),
      'saved', private.json_money(private.fund_saved(uid, f.id)),
      'target', private.json_money(f.target_amount)
    ) as item
    from public.savings_funds as f
    where f.user_id = uid
      and f.archived_at is null
  ) as rows;

  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'icon', coalesce(nullif(btrim(g.icon), ''), 'umbrella-beach'),
    'target', private.json_money(g.target_amount),
    'total', private.json_money(coalesce((
      select sum(c.amount) from public.goal_contributions as c where c.goal_id = g.id
    ), 0)),
    'mine', private.json_money(coalesce((
      select sum(c.amount)
      from public.goal_contributions as c
      where c.goal_id = g.id
        and c.user_id = uid
    ), 0))
  )
  into goal
  from public.shared_goals as g
  where g.household_id = hid
    and g.archived_at is null
  order by g.created_at desc
  limit 1;

  select jsonb_build_object(
    'label', e.label,
    'extra_amount', private.json_money(e.amount),
    'amount', private.json_money(a.amount),
    'month', extract(month from e.received_on)::integer,
    'fund_name', f.name,
    'fund_icon', coalesce(nullif(btrim(f.icon), ''), 'piggy-bank')
  )
  into highlight
  from public.extra_allocations as a
  join public.income_extras as e on e.id = a.extra_id
  join public.savings_funds as f on f.id = a.fund_id
  where e.user_id = uid
    and a.user_id = uid
    and f.user_id = uid
    and f.archived_at is null
    and e.received_on >= year_start
    and e.received_on < year_end
  order by a.amount desc, e.received_on desc
  limit 1;

  select
    count(*) filter (where due.on_time),
    count(*)
  into dues_on_time, dues_expected
  from (
    select exists (
      select 1
      from public.fixed_payments as fp
      where fp.fixed_expense_id = fe.id
        and fp.month = ms.month_start
        and fp.paid_on <= make_date(target_year, ms.m, fe.due_day)
    ) as on_time
    from public.fixed_expenses as fe
    cross join (
      select series.m, make_date(target_year, series.m, 1) as month_start
      from generate_series(1, 12) as series(m)
    ) as ms
    where fe.household_id = hid
      and fe.paused_at is null
      and (fe.is_shared or fe.owner_id = uid)
      and ms.month_start <= date_trunc('month', today)::date
      and ms.month_start >= date_trunc('month', fe.created_at)::date
  ) as due;

  return jsonb_build_object(
    'year', target_year,
    'months', months,
    'categories', categories,
    'previous', jsonb_build_object(
      'income', private.json_money(prev_income),
      'expenses', private.json_money(prev_expenses),
      'saved', private.json_money(prev_saved)
    ),
    'gustos_spent', private.json_money(gustos_spent),
    'extras_total', private.json_money(extras_total),
    'extras_saved', private.json_money(extras_saved),
    'funds', coalesce(funds, '[]'::jsonb),
    'goal', coalesce(goal, 'null'::jsonb),
    'highlight', coalesce(highlight, 'null'::jsonb),
    'dues', jsonb_build_object(
      'on_time', dues_on_time,
      'expected', dues_expected
    )
  );
end;
$$;
