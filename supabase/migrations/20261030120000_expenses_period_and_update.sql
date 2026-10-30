-- Editar gastos propios y agrupar los totales por el mes al que corresponden.
-- spent_on sigue siendo la fecha real (avisos del día). period es el día 1 del mes.

create policy expenses_update on public.expenses
for update to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and household_id = (select private.my_household_id())
);

grant update on public.expenses to authenticated;

alter table public.expenses
  add column period date;

update public.expenses
set period = date_trunc('month', spent_on)::date
where period is null;

alter table public.expenses
  alter column period set not null;

alter table public.expenses
  add constraint expenses_period_start check (extract(day from period) = 1);

create index expenses_period_idx on public.expenses (period);

create function private.expenses_fill_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.spent_on is null then
    return new;
  end if;
  if new.period is null then
    new.period := date_trunc('month', new.spent_on)::date;
  else
    new.period := date_trunc('month', new.period)::date;
  end if;
  return new;
end;
$$;

revoke all on function private.expenses_fill_period() from public, anon, authenticated;

create trigger expenses_fill_period
  before insert or update of spent_on, period on public.expenses
  for each row
  execute function private.expenses_fill_period();

-- Un gusto ya anotado se puede corregir. No se puede convertir un gasto común en gusto.
create or replace function private.reject_direct_bag_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.paid_from_bag and coalesce(current_setting('app.bag_write', true), '') is distinct from 'on' then
    if tg_op = 'INSERT' or old.paid_from_bag is not true then
      raise exception 'Los gustos se anotan desde la bolsa';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.validate_bag_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  available numeric(14, 2);
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Ese movimiento no es tuyo';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if new.kind = 'gusto' then
    if new.expense_id is null then
      raise exception 'El gusto tiene que ser un gasto de la bolsa';
    end if;

    if not exists (
      select 1
      from public.expenses as e
      where e.id = new.expense_id
        and e.owner_id = new.user_id
        and e.paid_from_bag
        and not e.is_shared
        and e.amount = new.amount
    ) then
      raise exception 'El gusto tiene que ser un gasto privado de la bolsa';
    end if;

    available := private.gustos_free(new.user_id);
    if tg_op = 'UPDATE' and old.kind = 'gusto' and old.user_id = new.user_id then
      available := available + old.amount;
    end if;
    if new.amount > available then
      raise exception 'No te alcanza lo libre de gustos';
    end if;

    return new;
  end if;

  if new.kind in ('to_fund', 'to_gustos', 'use') then
    if new.fund_id is null then
      raise exception 'Elegí un fondo';
    end if;

    if not exists (
      select 1
      from public.savings_funds as f
      where f.id = new.fund_id
        and f.user_id = new.user_id
    ) then
      raise exception 'Ese fondo no es tuyo';
    end if;

    if new.kind = 'to_fund' then
      available := private.gustos_free(new.user_id);
      if new.amount > available then
        raise exception 'No te alcanza lo libre de gustos';
      end if;
    else
      available := private.fund_saved(new.user_id, new.fund_id);
      if new.amount > available then
        raise exception 'No te alcanza lo ahorrado en el fondo';
      end if;
    end if;

    return new;
  end if;

  raise exception 'Ese movimiento no existe';
end;
$$;

create function private.sync_bag_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.bag_movements
    where expense_id = old.id;
    return old;
  end if;

  if old.paid_from_bag then
    update public.bag_movements
    set amount = new.amount,
        label = btrim(new.title),
        happened_on = new.spent_on
    where expense_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_bag_movement() from public, anon, authenticated;

create trigger expenses_sync_bag_movement
  after update on public.expenses
  for each row
  execute function private.sync_bag_movement();

create trigger expenses_clear_bag_movement
  before delete on public.expenses
  for each row
  execute function private.sync_bag_movement();

create or replace function private.spend_from_gustos(
  expense_title text,
  category_id uuid,
  expense_amount numeric,
  spent_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  expense uuid;
  rounded numeric(14, 2);
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  if spent_on is null then
    raise exception 'Falta la fecha';
  end if;

  if expense_title is null or char_length(btrim(expense_title)) = 0 then
    raise exception 'El gusto necesita una descripción';
  end if;

  rounded := round(expense_amount, 2);
  if rounded is null or rounded <= 0 then
    raise exception 'El monto tiene que ser mayor a cero';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select p.household_id
  into hid
  from public.profiles as p
  where p.id = uid;

  if hid is null then
    raise exception 'No estás en un hogar';
  end if;

  perform set_config('app.bag_write', 'on', true);

  insert into public.expenses (
    household_id,
    owner_id,
    payer_id,
    category_id,
    title,
    amount,
    spent_on,
    period,
    is_shared,
    paid_from_bag
  )
  values (
    hid,
    uid,
    uid,
    category_id,
    btrim(expense_title),
    rounded,
    spent_on,
    date_trunc('month', spent_on)::date,
    false,
    true
  )
  returning id into expense;

  perform set_config('app.bag_write', '', true);

  insert into public.bag_movements (user_id, kind, fund_id, expense_id, amount, label, happened_on)
  values (uid, 'gusto', null, expense, rounded, btrim(expense_title), spent_on);

  return expense;
end;
$$;

create or replace function private.preview_salary_split(
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
    and e.period = effective_from;

  my_old_percent := old_mine;
  my_new_percent := new_mine;
  partner_old_percent := old_partner;
  partner_new_percent := new_partner;
  shared_total := total;
  return next;
end;
$$;

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
              floors := floors || floor(exact);
              fracs := fracs || (exact - floor(exact));
              allocated := allocated + floor(exact);
            end loop;
            remaining := round(my_share - allocated)::integer;
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
              portion := floors[i];
              if portion <> 0 then
                cat_key := cat_ids[i]::text;
                if cats -> cat_key is null then
                  cats := jsonb_set(cats, array[cat_key], '{}'::jsonb, true);
                end if;
                prev_amount := coalesce((cats -> cat_key ->> m::text)::numeric, 0);
                cats := jsonb_set(
                  cats,
                  array[cat_key, m::text],
                  to_jsonb(round(prev_amount + portion)::bigint),
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
            to_jsonb(round(prev_amount + rec.amount)::bigint),
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
        months_json := months_json || to_jsonb(raw::numeric::bigint);
      end if;
    end loop;
    if any_amount then
      categories := categories || jsonb_build_object(
        'id', rec.id,
        'name', rec.name,
        'icon', coalesce(nullif(btrim(rec.icon), ''), 'tag'),
        'total', to_jsonb(round(total)::bigint),
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
