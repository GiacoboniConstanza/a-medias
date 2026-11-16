-- Avisos push de Finanzas (diario, vencimientos, silencio).
-- Reglas en vivo, igual que Medicamentos fase 2. No usa scheduled_reminders.
-- Zona horaria: America/Argentina/Buenos_Aires.

-- 1) Preferencia de silencio (default prendido)
alter table public.reminder_preferences
  add column if not exists silence_enabled boolean not null default true;

-- 2) Registro de envíos (usuaria + kind + send_key) — sin duplicar
create table public.finance_push_sends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  send_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, send_key),
  constraint finance_push_sends_kind check (kind in ('daily', 'dues', 'silence'))
);

alter table public.finance_push_sends enable row level security;

create policy finance_push_sends_select on public.finance_push_sends
for select to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.finance_push_sends from public, anon;
grant select on table public.finance_push_sends to authenticated;
grant select, insert, update, delete on table public.finance_push_sends to service_role;

-- 3) Carga inicial: Finanzas prendido solo si ya tenían push_enabled
insert into public.module_notification_prefs (user_id, module, enabled)
select rp.user_id, 'finanzas', true
from public.reminder_preferences as rp
where rp.push_enabled
on conflict on constraint module_notification_prefs_pkey do nothing;

-- Monto vigente del mes (misma regla que api.ts amountForMonth / applies)
create or replace function private.fixed_amount_for_month(
  p_fixed_id uuid,
  p_month date
)
returns numeric
language sql
stable
set search_path = public
as $$
  select a.amount
  from public.fixed_expense_amounts as a
  where a.fixed_expense_id = p_fixed_id
    and a.effective_from <= p_month
  order by a.effective_from desc
  limit 1;
$$;

revoke all on function private.fixed_amount_for_month(uuid, date) from public, anon, authenticated;

-- Título agrupado de vencimientos
create or replace function private.finance_dues_title(p_names text[])
returns text
language sql
immutable
set search_path = public
as $$
  with sorted as (
    select coalesce(array_agg(x order by x), array[]::text[]) as names
    from unnest(p_names) as x
  )
  select case
    when cardinality(names) = 0 or names is null then null
    when cardinality(names) = 1 then 'Vence ' || names[1]
    when cardinality(names) = 2 then 'Vencen ' || names[1] || ' y ' || names[2]
    else 'Vence ' || names[1] || ' y ' || (cardinality(names) - 1)::text || ' más'
  end
  from sorted;
$$;

revoke all on function private.finance_dues_title(text[]) from public, anon, authenticated;

-- 4) Candidatos a enviar (title/body/tag ya armados)
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
  -- Silencio: ≥3 días seguidos sin logged/clear tras una actividad; send_key = inicio racha
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
  -- Diario: cada ask_time; no si logged/clear/revisado; silencio del día lo reemplaza
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
  -- Vencimientos: primer horario; día = due − lead (sin aviso el día del vencimiento)
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
  )
  select * from daily_rows
  union all
  select * from dues_rows
  union all
  select * from silence_rows;
$$;

revoke all on function public.finance_due_pushes(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.finance_due_pushes(timestamptz, interval) to service_role;

-- 5) Reclama (inserta send) y devuelve solo lo recién marcado
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
