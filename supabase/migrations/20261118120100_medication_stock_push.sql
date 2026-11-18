-- Avisos push de poco stock / sin unidades (S27).
-- Corrida diaria a las 9:00 AR vía el cron existente (cada minuto + lookback).

create table if not exists public.medication_stock_push_sends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, medication_id, kind),
  constraint medication_stock_push_sends_kind check (kind in ('low_stock', 'out_of_stock'))
);

alter table public.medication_stock_push_sends enable row level security;

create policy medication_stock_push_sends_select on public.medication_stock_push_sends
for select to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.medication_stock_push_sends from public, anon;
grant select on table public.medication_stock_push_sends to authenticated;
grant select, insert, update, delete on table public.medication_stock_push_sends to service_role;

-- Candidatos a las 9:00 AR (ventana lookback, mismo cron de cada minuto).
create or replace function public.medication_stock_due_pushes(
  p_at timestamptz default now(),
  p_lookback interval default interval '5 minutes'
)
returns table (
  user_id uuid,
  medication_id uuid,
  kind text,
  name text,
  stock_qty integer,
  days_left integer,
  estimated_on date
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
      (p_at at time zone 'America/Argentina/Buenos_Aires') as local_ts
  ),
  window_ok as (
    -- ¿p_at cae en la ventana [9:00 − lookback, 9:00] del día local?
    select
      b.*,
      ((b.local_ts)::date + time '09:00') as slot_local,
      (((b.local_ts)::date + time '09:00') at time zone 'America/Argentina/Buenos_Aires') as slot_at
    from bounds as b
  ),
  eligible as (
    select w.*
    from window_ok as w
    where w.slot_at <= w.at
      and w.slot_at >= w.at - w.lookback
  ),
  meds as (
    select
      m.user_id,
      m.id as medication_id,
      m.name,
      m.stock_qty,
      m.units_per_dose,
      (
        select count(*)::integer
        from public.medication_schedules as s
        where s.medication_id = m.id
      ) as times_count,
      (
        select p.starts_on
        from public.medication_periods as p
        where p.medication_id = m.id
          and p.ended_at is null
          and (p.ends_on is null or p.ends_on >= (select (local_ts)::date from eligible limit 1))
        order by p.starts_on desc
        limit 1
      ) as period_starts,
      (
        select p.ends_on
        from public.medication_periods as p
        where p.medication_id = m.id
          and p.ended_at is null
          and (p.ends_on is null or p.ends_on >= (select (local_ts)::date from eligible limit 1))
        order by p.starts_on desc
        limit 1
      ) as period_ends
    from public.medications as m
    where m.archived_at is null
      and m.stock_qty is not null
      and exists (select 1 from eligible)
      and exists (
        select 1
        from public.module_notification_prefs as pref
        where pref.user_id = m.user_id
          and pref.module = 'medicamentos'
          and pref.enabled
      )
      and exists (
        select 1
        from public.medication_periods as p
        where p.medication_id = m.id
          and p.ended_at is null
          and p.starts_on <= coalesce(
            (
              select greatest(p2.starts_on, (select (local_ts)::date from eligible limit 1))
              from public.medication_periods as p2
              where p2.medication_id = m.id
                and p2.ended_at is null
              order by p2.starts_on desc
              limit 1
            ),
            (select (local_ts)::date from eligible limit 1)
          )
          and (p.ends_on is null or p.ends_on >= (select (local_ts)::date from eligible limit 1))
      )
  ),
  calc as (
    select
      m.*,
      (m.times_count * m.units_per_dose) as daily_use,
      case
        when m.times_count * m.units_per_dose <= 0 then null
        else (m.stock_qty / (m.times_count * m.units_per_dose))
      end as days_left,
      case
        when m.period_starts is not null
          and m.period_starts > (select (local_ts)::date from eligible limit 1)
          then m.period_starts
        else (select (local_ts)::date from eligible limit 1)
      end as from_day
    from meds as m
  ),
  tagged as (
    select
      c.user_id,
      c.medication_id,
      case
        when c.stock_qty = 0 then 'out_of_stock'
        when c.days_left is not null and c.days_left <= 3 then 'low_stock'
        else null
      end as kind,
      c.name,
      c.stock_qty,
      c.days_left,
      case
        when c.stock_qty = 0 or c.days_left is null then null
        else (c.from_day + (c.days_left || ' days')::interval)::date
      end as estimated_on,
      c.period_ends
    from calc as c
  )
  select
    t.user_id,
    t.medication_id,
    t.kind,
    t.name,
    t.stock_qty,
    t.days_left,
    case
      when t.period_ends is not null and t.estimated_on is not null and t.estimated_on > t.period_ends
        then t.period_ends
      else t.estimated_on
    end as estimated_on
  from tagged as t
  where t.kind is not null
    and not exists (
      select 1
      from public.medication_stock_push_sends as send
      where send.user_id = t.user_id
        and send.medication_id = t.medication_id
        and send.kind = t.kind
    );
$$;

revoke all on function public.medication_stock_due_pushes(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.medication_stock_due_pushes(timestamptz, interval) to service_role;

create or replace function public.claim_medication_stock_pushes(
  p_at timestamptz default now(),
  p_lookback interval default interval '5 minutes'
)
returns table (
  user_id uuid,
  medication_id uuid,
  kind text,
  name text,
  stock_qty integer,
  days_left integer,
  estimated_on date
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
    from public.medication_stock_due_pushes(p_at, p_lookback) as s
  ),
  claimed as (
    insert into public.medication_stock_push_sends as send (user_id, medication_id, kind, sent_at)
    select due.user_id, due.medication_id, due.kind, p_at
    from due
    on conflict on constraint medication_stock_push_sends_pkey do nothing
    returning send.user_id as claimed_user_id, send.medication_id as claimed_med_id, send.kind as claimed_kind
  )
  select
    due.user_id,
    due.medication_id,
    due.kind,
    due.name,
    due.stock_qty,
    due.days_left,
    due.estimated_on
  from due
  join claimed as c
    on c.claimed_user_id = due.user_id
   and c.claimed_med_id = due.medication_id
   and c.claimed_kind = due.kind;
end;
$$;

revoke all on function public.claim_medication_stock_pushes(timestamptz, interval)
  from public, anon, authenticated;
grant execute on function public.claim_medication_stock_pushes(timestamptz, interval) to service_role;

-- Reemplaza add/adjust para borrar avisos sin try/catch de tabla indefinida.
create or replace function public.add_medication_stock(
  p_medication_id uuid,
  p_units integer
)
returns table (
  medication_id uuid,
  stock_qty integer,
  move_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  med public.medications%rowtype;
  before_qty integer;
  after_qty integer;
  new_move_id uuid;
begin
  if actor is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  if p_units is null or p_units <= 0 then
    raise exception 'Poné cuántas sumás.';
  end if;

  select * into med from public.medications where id = p_medication_id for update;
  if med.id is null then
    raise exception 'Ese medicamento no existe';
  end if;
  if med.user_id is distinct from actor then
    raise exception 'Ese medicamento no es tuyo';
  end if;
  if med.stock_qty is null then
    raise exception 'No hay stock registrado. Usá ajustar.';
  end if;

  before_qty := med.stock_qty;
  after_qty := before_qty + p_units;
  if after_qty > 9999 then
    raise exception 'Hasta 9999 unidades.';
  end if;

  update public.medications
  set stock_qty = after_qty, updated_at = statement_timestamp()
  where id = med.id;

  insert into public.medication_stock_moves (
    user_id, medication_id, kind, delta, stock_before, stock_after
  ) values (
    actor, med.id, 'sumar', p_units, before_qty, after_qty
  )
  returning id into new_move_id;

  delete from public.medication_stock_push_sends
  where medication_stock_push_sends.medication_id = med.id
    and medication_stock_push_sends.user_id = actor;

  return query select med.id, after_qty, new_move_id;
end;
$$;

revoke all on function public.add_medication_stock(uuid, integer) from public, anon;
grant execute on function public.add_medication_stock(uuid, integer) to authenticated;

create or replace function public.adjust_medication_stock(
  p_medication_id uuid,
  p_units integer
)
returns table (
  medication_id uuid,
  stock_qty integer,
  move_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  med public.medications%rowtype;
  before_qty integer;
  after_qty integer;
  new_move_id uuid;
  move_kind text;
  delta_val integer;
begin
  if actor is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select * into med from public.medications where id = p_medication_id for update;
  if med.id is null then
    raise exception 'Ese medicamento no existe';
  end if;
  if med.user_id is distinct from actor then
    raise exception 'Ese medicamento no es tuyo';
  end if;

  before_qty := med.stock_qty;

  if p_units is null then
    if before_qty is null then
      return query select med.id, null::integer, null::uuid;
      return;
    end if;
    move_kind := 'dejar_de_registrar';
    after_qty := null;
    delta_val := null;
  else
    if p_units < 0 or p_units > 9999 then
      raise exception 'Hasta 9999 unidades.';
    end if;
    if before_qty is not null and before_qty = p_units then
      raise exception 'El stock ya es ese número.';
    end if;
    move_kind := 'ajustar';
    after_qty := p_units;
    delta_val := case when before_qty is null then p_units else p_units - before_qty end;
  end if;

  update public.medications
  set stock_qty = after_qty, updated_at = statement_timestamp()
  where id = med.id;

  insert into public.medication_stock_moves (
    user_id, medication_id, kind, delta, stock_before, stock_after
  ) values (
    actor, med.id, move_kind, delta_val, before_qty, after_qty
  )
  returning id into new_move_id;

  if after_qty is null
     or before_qty is null
     or (before_qty is not null and after_qty is not null and after_qty > before_qty) then
    delete from public.medication_stock_push_sends
    where medication_stock_push_sends.medication_id = med.id
      and medication_stock_push_sends.user_id = actor;
  end if;

  return query select med.id, after_qty, new_move_id;
end;
$$;

revoke all on function public.adjust_medication_stock(uuid, integer) from public, anon;
grant execute on function public.adjust_medication_stock(uuid, integer) to authenticated;
