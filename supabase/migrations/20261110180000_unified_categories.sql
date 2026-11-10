-- Una sola lista de categorías por hogar (sin privadas).

-- 0. Validadores sin dueño ANTES del repunte.
-- El UPDATE de category_id dispara expenses_validate / fixed_expenses_validate;
-- la versión vieja rechaza un gasto privado apuntando a una categoría compartida
-- ("Esa categoría privada no es tuya") y un compartido apuntando a una privada.
create or replace function private.validate_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat_household uuid;
  payer_household uuid;
begin
  if new.category_id is not null then
    select c.household_id
    into cat_household
    from public.categories as c
    where c.id = new.category_id;

    if cat_household is null or cat_household is distinct from new.household_id then
      raise exception 'La categoría no es de este hogar';
    end if;
  end if;

  if not new.is_shared and new.payer_id is distinct from new.owner_id then
    raise exception 'Un gasto privado lo pagás vos';
  end if;

  select p.household_id
  into payer_household
  from public.profiles as p
  where p.id = new.payer_id;

  if payer_household is distinct from new.household_id then
    raise exception 'Quien pagó no está en el hogar';
  end if;

  if (select auth.uid()) is not null and not private.is_member(new.household_id) then
    raise exception 'No pertenecés a este hogar';
  end if;

  if tg_op = 'INSERT'
    and (select auth.uid()) is not null
    and new.owner_id is distinct from (select auth.uid()) then
    raise exception 'Solo podés anotar gastos a tu nombre';
  end if;

  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'No se puede cambiar quién cargó el gasto';
  end if;

  return new;
end;
$$;

create or replace function private.validate_fixed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat_household uuid;
begin
  if new.category_id is null then
    return new;
  end if;

  select c.household_id
  into cat_household
  from public.categories as c
  where c.id = new.category_id;

  if cat_household is null or cat_household is distinct from new.household_id then
    raise exception 'La categoría no es de este hogar';
  end if;

  return new;
end;
$$;

-- 1. Fusionar duplicados por hogar + lower(trim(name)).
-- Conserva la compartida (owner_id null); si no hay, la más antigua.
with ranked as (
  select
    id,
    household_id,
    owner_id,
    created_at,
    lower(btrim(name)) as name_key,
    first_value(id) over (
      partition by household_id, lower(btrim(name))
      order by
        case when owner_id is null then 0 else 1 end,
        created_at asc,
        id asc
    ) as keep_id
  from public.categories
),
dupes as (
  select id, keep_id
  from ranked
  where id <> keep_id
)
update public.expenses as expense
set category_id = dupes.keep_id
from dupes
where expense.category_id = dupes.id;

with ranked as (
  select
    id,
    household_id,
    owner_id,
    created_at,
    lower(btrim(name)) as name_key,
    first_value(id) over (
      partition by household_id, lower(btrim(name))
      order by
        case when owner_id is null then 0 else 1 end,
        created_at asc,
        id asc
    ) as keep_id
  from public.categories
),
dupes as (
  select id, keep_id
  from ranked
  where id <> keep_id
)
update public.fixed_expenses as fixed
set category_id = dupes.keep_id
from dupes
where fixed.category_id = dupes.id;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by household_id, lower(btrim(name))
      order by
        case when owner_id is null then 0 else 1 end,
        created_at asc,
        id asc
    ) as keep_id
  from public.categories
)
delete from public.categories as category
using ranked
where category.id = ranked.id
  and ranked.id <> ranked.keep_id;

-- 2. Quitar dependencias de owner_id (índices + policies) y la columna.
drop index if exists public.categories_shared_name_idx;
drop index if exists public.categories_private_name_idx;

drop policy if exists categories_select on public.categories;
drop policy if exists categories_insert on public.categories;

alter table public.categories
  drop column if exists owner_id;

-- Helper post-migración: fusiona duplicados restantes (conserva la más antigua).
create or replace function private.merge_duplicate_categories()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with ranked as (
    select
      id,
      first_value(id) over (
        partition by household_id, lower(btrim(name))
        order by created_at asc, id asc
      ) as keep_id
    from public.categories
  ),
  dupes as (
    select id, keep_id from ranked where id <> keep_id
  )
  update public.expenses as expense
  set category_id = dupes.keep_id
  from dupes
  where expense.category_id = dupes.id;

  with ranked as (
    select
      id,
      first_value(id) over (
        partition by household_id, lower(btrim(name))
        order by created_at asc, id asc
      ) as keep_id
    from public.categories
  ),
  dupes as (
    select id, keep_id from ranked where id <> keep_id
  )
  update public.fixed_expenses as fixed
  set category_id = dupes.keep_id
  from dupes
  where fixed.category_id = dupes.id;

  with ranked as (
    select
      id,
      first_value(id) over (
        partition by household_id, lower(btrim(name))
        order by created_at asc, id asc
      ) as keep_id
    from public.categories
  )
  delete from public.categories as category
  using ranked
  where category.id = ranked.id
    and ranked.id <> ranked.keep_id;
end;
$$;

revoke all on function private.merge_duplicate_categories() from public, anon, authenticated;

create unique index categories_household_name_idx
  on public.categories (household_id, lower(btrim(name)));

-- 3. RLS: solo por hogar (recreada sin owner_id).
create policy categories_select on public.categories
for select to authenticated
using (household_id = (select private.my_household_id()));

create policy categories_insert on public.categories
for insert to authenticated
with check (household_id = (select private.my_household_id()));

-- 4. create_household sin owner_id.
create or replace function private.create_household()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  code text;
  linked integer;
begin
  if uid is null then
    raise exception 'Tenés que entrar para crear un hogar';
  end if;

  if exists (
    select 1
    from public.profiles as p
    where p.id = uid
      and p.household_id is not null
  ) then
    raise exception 'Ya estás en un hogar';
  end if;

  select h.id
  into hid
  from public.households as h
  where h.created_by = uid
  order by h.created_at, h.id
  limit 1
  for update;

  if hid is null then
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    insert into public.households (invite_code, created_by)
    values (code, uid)
    returning id into hid;
  end if;

  if not exists (
    select 1
    from public.categories as c
    where c.household_id = hid
  ) then
    insert into public.categories (household_id, name, emoji, icon)
    values
      (hid, 'Súper', '🛒', 'cart-shopping'),
      (hid, 'Comida', '🍕', 'pizza-slice'),
      (hid, 'Viajes', '🚌', 'bus'),
      (hid, 'Servicios', '💡', 'lightbulb'),
      (hid, 'Salidas', '🎉', 'champagne-glasses'),
      (hid, 'Hogar', '🏠', 'house');
  end if;

  update public.profiles
  set household_id = hid
  where id = uid
    and household_id is null;

  get diagnostics linked = row_count;

  if linked <> 1 then
    raise exception 'No se pudo vincular el hogar al perfil';
  end if;

  return hid;
end;
$$;

revoke all on function private.create_household() from public, anon;
grant execute on function private.create_household() to authenticated;

-- 5. year_balance: categorías del hogar sin filtro de dueño.
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