-- Presupuesto por categoría (Finanzas).
-- Topes privados con historial por mes; push 80 % / 100 %; switch budget_enabled.

-- 1) Preferencia de avisos de presupuesto (default prendido)
alter table public.reminder_preferences
  add column if not exists budget_enabled boolean not null default true;

-- 2) Tabla de topes con historial (amount null = borrado desde ese mes)
create table public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount numeric(12, 2) null,
  effective_from date not null,
  created_at timestamptz not null default now(),
  constraint category_budgets_amount_check check (amount is null or amount > 0),
  constraint category_budgets_month_start check (extract(day from effective_from) = 1),
  constraint category_budgets_unique unique (user_id, category_id, effective_from)
);

create index category_budgets_user_month_idx
  on public.category_budgets (user_id, effective_from desc);

alter table public.category_budgets enable row level security;

create policy category_budgets_select on public.category_budgets
for select to authenticated
using (user_id = (select auth.uid()));

create policy category_budgets_insert on public.category_budgets
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy category_budgets_update on public.category_budgets
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy category_budgets_delete on public.category_budgets
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.category_budgets from public, anon;
grant select, insert, update, delete on table public.category_budgets to authenticated;
grant select, insert, update, delete on table public.category_budgets to service_role;

-- 3) Kinds de push de presupuesto
alter table public.finance_push_sends
  drop constraint if exists finance_push_sends_kind;

alter table public.finance_push_sends
  add constraint finance_push_sends_kind
  check (kind in ('daily', 'dues', 'silence', 'budget_80', 'budget_100'));

-- 4) Helpers privados
create or replace function private.format_money_ar(p_amount numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select
    '$ '
    || reverse(
      regexp_replace(
        reverse(trunc(round(p_amount, 2))::bigint::text),
        '(\d{3})(?=\d)',
        '\1.',
        'g'
      )
    )
    || ','
    || lpad((abs(round(p_amount * 100)::bigint) % 100)::text, 2, '0');
$$;

revoke all on function private.format_money_ar(numeric) from public, anon, authenticated;

create or replace function private.month_name_es(p_month date)
returns text
language sql
immutable
set search_path = public
as $$
  select case extract(month from p_month)::int
    when 1 then 'enero'
    when 2 then 'febrero'
    when 3 then 'marzo'
    when 4 then 'abril'
    when 5 then 'mayo'
    when 6 then 'junio'
    when 7 then 'julio'
    when 8 then 'agosto'
    when 9 then 'septiembre'
    when 10 then 'octubre'
    when 11 then 'noviembre'
    else 'diciembre'
  end;
$$;

revoke all on function private.month_name_es(date) from public, anon, authenticated;

-- Tope vigente: mayor effective_from <= mes; null amount = sin tope
create or replace function private.budget_cap_for(
  p_user uuid,
  p_category uuid,
  p_month date
)
returns numeric
language sql
stable
set search_path = public
as $$
  select b.amount
  from public.category_budgets as b
  where b.user_id = p_user
    and b.category_id = p_category
    and b.effective_from <= p_month
  order by b.effective_from desc
  limit 1;
$$;

revoke all on function private.budget_cap_for(uuid, uuid, date) from public, anon, authenticated;

-- Gastado en la categoría (privados propios + parte de compartidos)
create or replace function private.budget_spent_for(
  p_user uuid,
  p_household uuid,
  p_category uuid,
  p_month date
)
returns numeric
language sql
stable
set search_path = public
as $$
  with pct as (
    select s.percent::numeric as percent
    from private.percents_for(p_household, p_month, null, null, null, false) as s
    where s.user_id = p_user
  )
  select coalesce(
    sum(
      case
        when e.is_shared then round(e.amount * coalesce((select percent from pct), 50) / 100.0, 2)
        when e.owner_id = p_user then e.amount
        else 0
      end
    ),
    0
  )
  from public.expenses as e
  where e.household_id = p_household
    and e.period = p_month
    and e.category_id = p_category;
$$;

revoke all on function private.budget_spent_for(uuid, uuid, uuid, date)
  from public, anon, authenticated;

-- 5) finance_due_pushes: conserva diario/dues/silence y suma presupuesto
create or replace function public.finance_due_pushes(
  p_at timestamptz default now(),
  p_lookback interval default interval '5 minutes'
)
returns table (
  user_id uuid,
  kind text,
  send_key text,
  title text,
  body text,
  tag text
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      p_at as at,
      greatest(p_lookback, interval '0 minutes') as lookback,
      (p_at at time zone 'America/Argentina/Buenos_Aires') as local_ts,
      ((p_at - greatest(p_lookback, interval '0 minutes'))
        at time zone 'America/Argentina/Buenos_Aires') as local_from
  ),
  days as (
    select distinct d::date as day
    from bounds as b,
      lateral generate_series(
        (b.local_from)::date,
        (b.local_ts)::date,
        interval '1 day'
      ) as d
  ),
  eligible_users as (
    select
      rp.user_id,
      rp.enabled,
      coalesce(
        nullif(rp.ask_times, '{}'::time[]),
        array[rp.first_time, rp.second_time]::time[]
      ) as ask_times,
      rp.due_lead_days,
      rp.reviewed_on,
      rp.hidden_until,
      rp.silence_enabled,
      p.household_id
    from public.reminder_preferences as rp
    join public.profiles as p on p.id = rp.user_id
    where rp.enabled
      and p.household_id is not null
      and exists (
        select 1
        from public.module_notification_prefs as pref
        where pref.user_id = rp.user_id
          and pref.module = 'finanzas'
          and pref.enabled
      )
  ),
  slots as (
    select
      u.user_id,
      u.household_id,
      u.due_lead_days,
      u.reviewed_on,
      u.hidden_until,
      u.silence_enabled,
      days.day as local_day,
      t.slot_time,
      ((days.day + t.slot_time) at time zone 'America/Argentina/Buenos_Aires') as slot_at,
      (
        select min(x)
        from unnest(u.ask_times) as x
      ) as first_time
    from eligible_users as u
    cross join days
    cross join lateral unnest(u.ask_times) as t(slot_time)
  ),
  due_slots as (
    select s.*
    from slots as s
    cross join bounds as b
    where s.slot_at <= b.at
      and s.slot_at >= b.at - b.lookback
      and (s.hidden_until is null or s.hidden_until <= s.slot_at)
  ),
  silence_raw as (
    select
      s.user_id,
      s.local_day,
      s.slot_time,
      s.slot_at,
      streak.streak_start
    from due_slots as s
    cross join lateral (
      select
        max(ds.day) + 1 as streak_start
      from public.daily_statuses as ds
      where ds.user_id = s.user_id
        and ds.day < s.local_day
    ) as streak
    where s.silence_enabled
      and s.slot_time = s.first_time
      and streak.streak_start is not null
      and (s.local_day - streak.streak_start) >= 2
      and not exists (
        select 1
        from public.daily_statuses as ds
        where ds.user_id = s.user_id
          and ds.day between streak.streak_start and s.local_day
      )
      and not exists (
        select 1
        from public.finance_push_sends as send
        where send.user_id = s.user_id
          and send.kind = 'silence'
          and send.send_key = to_char(streak.streak_start, 'YYYY-MM-DD')
      )
  ),
  silence_rows as (
    select
      r.user_id,
      'silence'::text as kind,
      to_char(r.streak_start, 'YYYY-MM-DD') as send_key,
      '¿Seguimos anotando?'::text as title,
      'Hace unos días que no anotás nada. ¿Todo bien?'::text as body,
      ('finance-silence-' || r.user_id::text || '-' || to_char(r.streak_start, 'YYYY-MM-DD')) as tag
    from silence_raw as r
  ),
  silence_days as (
    select distinct user_id, local_day
    from silence_raw
  ),
  daily_rows as (
    select
      s.user_id,
      'daily'::text as kind,
      (to_char(s.local_day, 'YYYY-MM-DD') || '|' || to_char(s.slot_time, 'HH24:MI')) as send_key,
      '¿Gastaste algo hoy?'::text as title,
      'Anotalo en dos toques así no se te escapa.'::text as body,
      ('finance-daily-' || s.user_id::text || '-' || to_char(s.local_day, 'YYYY-MM-DD')) as tag
    from due_slots as s
    where s.reviewed_on is distinct from s.local_day
      and not exists (
        select 1 from silence_days as sd
        where sd.user_id = s.user_id and sd.local_day = s.local_day
      )
      and not exists (
        select 1
        from public.daily_statuses as ds
        where ds.user_id = s.user_id
          and ds.day = s.local_day
      )
      and not exists (
        select 1
        from public.finance_push_sends as send
        where send.user_id = s.user_id
          and send.kind = 'daily'
          and send.send_key = (to_char(s.local_day, 'YYYY-MM-DD') || '|' || to_char(s.slot_time, 'HH24:MI'))
      )
  ),
  dues_matching as (
    select
      s.user_id,
      s.local_day,
      f.id as fixed_id,
      f.title,
      due_month.month as due_month
    from due_slots as s
    join public.fixed_expenses as f
      on f.household_id = s.household_id
     and f.paused_at is null
     and f.remind
     and (
       (f.is_shared and f.owner_id is null)
       or (not f.is_shared and f.owner_id = s.user_id)
     )
    cross join lateral (
      select (s.local_day + (s.due_lead_days * interval '1 day'))::date as due_date
    ) as due
    cross join lateral (
      select make_date(
        extract(year from due.due_date)::int,
        extract(month from due.due_date)::int,
        1
      ) as month
    ) as due_month
    where s.slot_time = s.first_time
      and s.due_lead_days > 0
      and extract(day from due.due_date)::int
        = least(
          f.due_day,
          extract(day from (due_month.month + interval '1 month - 1 day'))::int
        )
      and private.fixed_amount_for_month(f.id, due_month.month) is not null
      and not exists (
        select 1
        from public.fixed_payments as fp
        where fp.fixed_expense_id = f.id
          and fp.month = due_month.month
      )
  ),
  dues_grouped as (
    select
      m.user_id,
      m.local_day,
      array_agg(m.title) as titles
    from dues_matching as m
    group by m.user_id, m.local_day
  ),
  dues_rows as (
    select
      g.user_id,
      'dues'::text as kind,
      to_char(g.local_day, 'YYYY-MM-DD') as send_key,
      private.finance_dues_title(g.titles) as title,
      'Marcalo como pagado cuando lo abones.'::text as body,
      ('finance-dues-' || g.user_id::text || '-' || to_char(g.local_day, 'YYYY-MM-DD')) as tag
    from dues_grouped as g
    where not exists (
      select 1
      from public.finance_push_sends as send
      where send.user_id = g.user_id
        and send.kind = 'dues'
        and send.send_key = to_char(g.local_day, 'YYYY-MM-DD')
    )
  ),
  -- Presupuesto: no depende de rp.enabled; ventana 9–21 AR; solo mes actual
  budget_bounds as (
    select
      b.*,
      (b.local_ts)::date as local_day,
      make_date(
        extract(year from (b.local_ts)::date)::int,
        extract(month from (b.local_ts)::date)::int,
        1
      ) as month_start,
      (b.local_ts)::time as local_time
    from bounds as b
  ),
  budget_users as (
    select
      rp.user_id,
      p.household_id,
      bb.month_start,
      bb.local_day,
      bb.local_time,
      bb.at
    from public.reminder_preferences as rp
    join public.profiles as p on p.id = rp.user_id
    cross join budget_bounds as bb
    where coalesce(rp.budget_enabled, true)
      and p.household_id is not null
      and exists (
        select 1
        from public.module_notification_prefs as pref
        where pref.user_id = rp.user_id
          and pref.module = 'finanzas'
          and pref.enabled
      )
      and bb.local_time >= time '09:00'
      and bb.local_time <= time '21:00'
  ),
  budget_caps as (
    select
      u.user_id,
      u.household_id,
      u.month_start,
      c.id as category_id,
      c.name as category_name,
      private.budget_cap_for(u.user_id, c.id, u.month_start) as cap
    from budget_users as u
    join public.categories as c on c.household_id = u.household_id
  ),
  budget_spent as (
    select
      bc.*,
      private.budget_spent_for(bc.user_id, bc.household_id, bc.category_id, bc.month_start) as spent
    from budget_caps as bc
    where bc.cap is not null
      and bc.cap > 0
  ),
  budget_100_rows as (
    select
      s.user_id,
      'budget_100'::text as kind,
      (to_char(s.month_start, 'YYYY-MM') || '|' || s.category_id::text) as send_key,
      ('Te pasaste del tope de ' || s.category_name)::text as title,
      (
        'Llevás '
        || private.format_money_ar(s.spent)
        || ' de '
        || private.format_money_ar(s.cap)
        || ' en '
        || private.month_name_es(s.month_start)
        || '.'
      )::text as body,
      (
        'finance-budget-100-'
        || s.user_id::text
        || '-'
        || s.category_id::text
        || '-'
        || to_char(s.month_start, 'YYYY-MM')
      ) as tag
    from budget_spent as s
    where s.spent >= s.cap
      and not exists (
        select 1
        from public.finance_push_sends as send
        where send.user_id = s.user_id
          and send.kind = 'budget_100'
          and send.send_key = (to_char(s.month_start, 'YYYY-MM') || '|' || s.category_id::text)
      )
  ),
  budget_80_rows as (
    select
      s.user_id,
      'budget_80'::text as kind,
      (to_char(s.month_start, 'YYYY-MM') || '|' || s.category_id::text) as send_key,
      ('Te acercás al tope de ' || s.category_name)::text as title,
      (
        'Ya usaste el '
        || floor((s.spent / s.cap) * 100)::int::text
        || ' % de tus '
        || private.format_money_ar(s.cap)
        || ' de '
        || private.month_name_es(s.month_start)
        || '.'
      )::text as body,
      (
        'finance-budget-80-'
        || s.user_id::text
        || '-'
        || s.category_id::text
        || '-'
        || to_char(s.month_start, 'YYYY-MM')
      ) as tag
    from budget_spent as s
    where s.spent >= s.cap * 0.8
      and s.spent < s.cap
      and not exists (
        select 1
        from public.finance_push_sends as send
        where send.user_id = s.user_id
          and send.kind = 'budget_80'
          and send.send_key = (to_char(s.month_start, 'YYYY-MM') || '|' || s.category_id::text)
      )
      and not exists (
        select 1
        from budget_100_rows as h
        where h.user_id = s.user_id
          and h.send_key = (to_char(s.month_start, 'YYYY-MM') || '|' || s.category_id::text)
      )
  )
  select * from daily_rows
  union all
  select * from dues_rows
  union all
  select * from silence_rows
  union all
  select * from budget_80_rows
  union all
  select * from budget_100_rows;
$$;

revoke all on function public.finance_due_pushes(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.finance_due_pushes(timestamptz, interval) to service_role;

-- Al claimar un 100 %, también registra el 80 % del mismo mes/categoría (sin enviarlo)
create or replace function public.claim_finance_due_pushes(
  p_at timestamptz default now(),
  p_lookback interval default interval '5 minutes'
)
returns table (
  user_id uuid,
  kind text,
  send_key text,
  title text,
  body text,
  tag text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select *
    from public.finance_due_pushes(p_at, p_lookback) as s
  ),
  mark_80 as (
    insert into public.finance_push_sends as send (user_id, kind, send_key, sent_at)
    select due.user_id, 'budget_80', due.send_key, p_at
    from due
    where due.kind = 'budget_100'
    on conflict on constraint finance_push_sends_pkey do nothing
    returning send.user_id
  ),
  claimed as (
    insert into public.finance_push_sends as send (user_id, kind, send_key, sent_at)
    select due.user_id, due.kind, due.send_key, p_at
    from due
    on conflict on constraint finance_push_sends_pkey do nothing
    returning send.user_id as claimed_user_id, send.kind as claimed_kind, send.send_key as claimed_key
  )
  select
    due.user_id,
    due.kind,
    due.send_key,
    due.title,
    due.body,
    due.tag
  from due
  join claimed as c
    on c.claimed_user_id = due.user_id
   and c.claimed_kind = due.kind
   and c.claimed_key = due.send_key;
end;
$$;

revoke all on function public.claim_finance_due_pushes(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.claim_finance_due_pushes(timestamptz, interval) to service_role;
