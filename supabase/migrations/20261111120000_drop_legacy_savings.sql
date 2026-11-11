-- Limpieza de Ahorros viejos (fondos, meta, bolsa, allocations).
-- Las pantallas ya usan public.savings / saving_moves / saving_opening_balances.

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

  gustos_spent := null;

  select case when count(*) = 0 then null else sum(e.amount) end
  into extras_total
  from public.income_extras as e
  where e.user_id = uid
    and e.received_on >= year_start
    and e.received_on < year_end;

  select case when count(*) = 0 then null else sum(m.amount) end
  into extras_saved
  from public.saving_moves as m
  where m.user_id = uid
    and m.kind = 'aporte'
    and m.spent_on >= year_start
    and m.spent_on < year_end;

  select coalesce(jsonb_agg(item order by item ->> 'name'), '[]'::jsonb)
  into funds
  from (
    select jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'icon', coalesce(nullif(btrim(s.icon), ''), 'piggy-bank'),
      'saved', private.json_money(
        coalesce((select sum(o.amount) from public.saving_opening_balances o where o.saving_id = s.id and o.user_id = uid), 0)
        + coalesce((select sum(case when m.kind = 'aporte' then m.amount else -m.amount end)
                    from public.saving_moves m where m.saving_id = s.id and m.user_id = uid), 0)
      ),
      'target', private.json_money(s.target_amount)
    ) as item
    from public.savings as s
    where s.household_id = hid
      and not s.is_shared
      and s.owner_id = uid
      and s.archived_at is null
  ) as rows;

  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'icon', coalesce(nullif(btrim(s.icon), ''), 'umbrella-beach'),
    'target', private.json_money(s.target_amount),
    'total', private.json_money(
      coalesce((select sum(o.amount) from public.saving_opening_balances o where o.saving_id = s.id), 0)
      + coalesce((select sum(case when m.kind = 'aporte' then m.amount else -m.amount end)
                  from public.saving_moves m where m.saving_id = s.id), 0)
    ),
    'mine', private.json_money(
      coalesce((select sum(o.amount) from public.saving_opening_balances o where o.saving_id = s.id and o.user_id = uid), 0)
      + coalesce((select sum(case when m.kind = 'aporte' then m.amount else -m.amount end)
                  from public.saving_moves m where m.saving_id = s.id and m.user_id = uid), 0)
    )
  )
  into goal
  from public.savings as s
  where s.household_id = hid
    and s.is_shared
    and s.archived_at is null
  order by s.created_at
  limit 1;

  select jsonb_build_object(
    'label', coalesce(nullif(btrim(m.title), ''), 'Aporte'),
    'extra_amount', private.json_money(m.amount),
    'amount', private.json_money(m.amount),
    'month', extract(month from m.spent_on)::integer,
    'fund_name', s.name,
    'fund_icon', coalesce(nullif(btrim(s.icon), ''), 'piggy-bank')
  )
  into highlight
  from public.saving_moves as m
  join public.savings as s on s.id = m.saving_id
  where m.user_id = uid
    and m.kind = 'aporte'
    and m.spent_on >= year_start
    and m.spent_on < year_end
  order by m.amount desc, m.spent_on desc
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

-- Quitar RPCs y funciones solo del modelo viejo.
drop function if exists public.replace_active_shared_goal(uuid, text, text, numeric, date);
drop function if exists private.replace_active_shared_goal(uuid, text, text, numeric, date);
drop function if exists public.spend_from_gustos(text, uuid, numeric, date);
drop function if exists private.spend_from_gustos(text, uuid, numeric, date);
drop function if exists public.move_bag_money(text, uuid, numeric, date, text);
drop function if exists private.move_bag_money(text, uuid, numeric, date, text);
drop function if exists private.fund_saved(uuid, uuid);
drop function if exists private.gustos_free(uuid);

-- Triggers/policies del modelo viejo (si existen).
drop trigger if exists shared_goals_guard_archive on public.shared_goals;
drop trigger if exists savings_funds_guard_archive on public.savings_funds;
drop trigger if exists bag_movements_guard_archived on public.bag_movements;
drop trigger if exists extra_allocations_guard_archived on public.extra_allocations;
drop trigger if exists goal_contributions_guard_archived on public.goal_contributions;
drop trigger if exists bag_movements_validate on public.bag_movements;
drop trigger if exists extra_allocations_validate on public.extra_allocations;
drop trigger if exists expenses_sync_bag_movement on public.expenses;
drop trigger if exists expenses_clear_bag_movement on public.expenses;

drop table if exists public.extra_allocations cascade;
drop table if exists public.bag_movements cascade;
drop table if exists public.goal_contributions cascade;
drop table if exists public.shared_goals cascade;
drop table if exists public.savings_funds cascade;

drop function if exists private.sync_bag_movement();
drop function if exists private.validate_bag_movement();
