-- Medicamentos fase 2 (§9): períodos, archivado, snapshots, preferencias de avisos,
-- despacho agrupado. No reescribe migraciones 30000/30100. No toca Finanzas.

-- 1) Módulo en user_modules
alter table public.user_modules
  drop constraint if exists user_modules_module;

alter table public.user_modules
  add constraint user_modules_module
  check (module in ('finanzas', 'habitos', 'comidas', 'memos', 'medicamentos'));

create or replace function private.seed_user_modules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_modules (user_id, module, enabled)
  values
    (new.id, 'finanzas', true),
    (new.id, 'habitos', false),
    (new.id, 'comidas', false),
    (new.id, 'memos', false),
    (new.id, 'medicamentos', false)
  on conflict (user_id, module) do nothing;
  return new;
end;
$$;

insert into public.user_modules (user_id, module, enabled)
select p.id, 'medicamentos', false
from public.profiles as p
on conflict (user_id, module) do nothing;

-- 2) Períodos de uso + archivado (en lugar de starts_on/ends_on/active solos)
create table public.medication_periods (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  starts_on date not null,
  ends_on date,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint medication_periods_dates check (ends_on is null or ends_on >= starts_on),
  constraint medication_periods_ended check (
    ended_at is null or ended_at >= started_at
  )
);

create index medication_periods_med_idx on public.medication_periods (medication_id, starts_on);

-- Migrar filas existentes de fase 1 a un período.
insert into public.medication_periods (
  medication_id, user_id, starts_on, ends_on, started_at, ended_at
)
select
  m.id,
  m.user_id,
  m.starts_on,
  m.ends_on,
  m.starts_on::timestamptz,
  case
    when not m.active then coalesce(
      (m.ends_on::timestamp + time '23:59:59') at time zone 'America/Argentina/Buenos_Aires',
      m.updated_at
    )
    when m.ends_on is not null
      and m.ends_on < (timezone('America/Argentina/Buenos_Aires', now()))::date
      then (m.ends_on::timestamp + time '23:59:59') at time zone 'America/Argentina/Buenos_Aires'
    else null
  end
from public.medications as m;

alter table public.medications
  add column if not exists archived_at timestamptz;

update public.medications as m
set archived_at = coalesce(m.archived_at, m.updated_at)
where not m.active and m.archived_at is null;

drop index if exists public.medications_user_idx;

-- Dejar de sincronizar a scheduled_reminders antes de sacar columnas.
drop trigger if exists medications_sync_reminders on public.medications;
drop trigger if exists medication_schedules_sync_reminders on public.medication_schedules;
delete from public.scheduled_reminders where module = 'medicamentos';

-- Quitar columnas viejas (ya copiadas a períodos).
alter table public.medications drop column if exists starts_on;
alter table public.medications drop column if exists ends_on;
alter table public.medications drop column if exists active;

create index medications_user_idx on public.medications (user_id) where archived_at is null;

-- 3) Tomas: snapshot + sin cascade que borre historial
alter table public.medication_doses
  add column if not exists name_snapshot text,
  add column if not exists dose_snapshot text;

update public.medication_doses as d
set
  name_snapshot = coalesce(d.name_snapshot, m.name),
  dose_snapshot = coalesce(d.dose_snapshot, m.dose_notes)
from public.medications as m
where m.id = d.medication_id
  and d.name_snapshot is null;

alter table public.medication_doses
  alter column name_snapshot set not null;

alter table public.medication_doses
  drop constraint if exists medication_doses_medication_id_fkey;

alter table public.medication_doses
  add constraint medication_doses_medication_id_fkey
  foreign key (medication_id) references public.medications (id) on delete restrict;

alter table public.medication_schedules
  drop constraint if exists medication_schedules_medication_id_fkey;

alter table public.medication_schedules
  add constraint medication_schedules_medication_id_fkey
  foreign key (medication_id) references public.medications (id) on delete restrict;

-- 4) Preferencias de avisos por módulo (M29)
create table public.module_notification_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, module),
  constraint module_notification_prefs_module check (
    module in ('finanzas', 'habitos', 'comidas', 'memos', 'medicamentos')
  )
);

create trigger module_notification_prefs_guard
  before update on public.module_notification_prefs
  for each row
  execute function private.guard_user_owned_row();

alter table public.module_notification_prefs enable row level security;

create policy module_notification_prefs_select on public.module_notification_prefs
for select to authenticated
using (user_id = (select auth.uid()));

create policy module_notification_prefs_insert on public.module_notification_prefs
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy module_notification_prefs_update on public.module_notification_prefs
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy module_notification_prefs_delete on public.module_notification_prefs
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.module_notification_prefs from public, anon;
grant select, insert, update, delete on public.module_notification_prefs to authenticated;

-- 5) Registro de envíos agrupados (usuaria + día + hora) — sin duplicar, recupera 5 min
create table public.medication_push_sends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  dose_on date not null,
  scheduled_time time not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, dose_on, scheduled_time)
);

alter table public.medication_push_sends enable row level security;

-- Solo service_role escribe; la dueña puede leer lo suyo.
create policy medication_push_sends_select on public.medication_push_sends
for select to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.medication_push_sends from public, anon;
grant select on public.medication_push_sends to authenticated;
grant select, insert, update, delete on public.medication_push_sends to service_role;

-- 6) RLS períodos
alter table public.medication_periods enable row level security;

create policy medication_periods_select on public.medication_periods
for select to authenticated
using (user_id = (select auth.uid()));

create policy medication_periods_insert on public.medication_periods
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy medication_periods_update on public.medication_periods
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy medication_periods_delete on public.medication_periods
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.medication_periods from public, anon;
grant select, insert, update, delete on public.medication_periods to authenticated;

create trigger medication_periods_guard
  before insert or update or delete on public.medication_periods
  for each row
  execute function private.guard_medication_child();

-- 7) Validación de tomas: día dentro de un período abierto ese día, no futuro (AR)
create or replace function private.medication_day_in_period(
  p_medication_id uuid,
  p_day date,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.medication_periods as p
    where p.medication_id = p_medication_id
      and p.starts_on <= p_day
      and (p.ends_on is null or p.ends_on >= p_day)
      and (p.ended_at is null or (p.ended_at at time zone 'America/Argentina/Buenos_Aires')::date >= p_day)
      and (p.started_at at time zone 'America/Argentina/Buenos_Aires')::date <= p_day
  )
  and p_day <= (p_at at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

create or replace function private.guard_medication_dose_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today_ar date := (statement_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date;
  med_name text;
  med_dose text;
begin
  if new.dose_on > today_ar then
    raise exception 'No se pueden marcar tomas de días futuros';
  end if;

  if not private.medication_day_in_period(new.medication_id, new.dose_on, statement_timestamp()) then
    raise exception 'Ese día no está en un período de uso del medicamento';
  end if;

  -- Snapshot al crear; al cambiar estado se conserva el de entonces si ya había.
  if tg_op = 'INSERT' or new.name_snapshot is null then
    select m.name, m.dose_notes
    into med_name, med_dose
    from public.medications as m
    where m.id = new.medication_id;
    new.name_snapshot := coalesce(new.name_snapshot, med_name);
    new.dose_snapshot := coalesce(new.dose_snapshot, med_dose);
  end if;

  if new.name_snapshot is null or btrim(new.name_snapshot) = '' then
    raise exception 'Falta el nombre de la toma';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_medication_dose_day() from public, anon, authenticated;

drop trigger if exists medication_doses_day_guard on public.medication_doses;
create trigger medication_doses_day_guard
  before insert or update on public.medication_doses
  for each row
  execute function private.guard_medication_dose_day();

-- 8) ¿Medicamento en curso en un instante? (no archivado; período abierto)
create or replace function private.medication_in_course_at(
  p_medication_id uuid,
  p_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.medications as m
    join public.medication_periods as p on p.medication_id = m.id
    where m.id = p_medication_id
      and m.archived_at is null
      and p.started_at <= p_at
      and (p.ended_at is null or p.ended_at > p_at)
      and p.starts_on <= (p_at at time zone 'America/Argentina/Buenos_Aires')::date
      and (p.ends_on is null or p.ends_on >= (p_at at time zone 'America/Argentina/Buenos_Aires')::date)
  );
$$;

-- Slots de toma pendientes de aviso en una ventana (minutos hacia atrás inclusive)
create or replace function public.medication_due_slots(
  p_at timestamptz default now(),
  p_lookback_minutes integer default 5
)
returns table (
  user_id uuid,
  dose_on date,
  scheduled_time time,
  medication_id uuid,
  name text,
  dose_notes text
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      p_at as at,
      (p_at at time zone 'America/Argentina/Buenos_Aires') as local_ts,
      ((p_at - make_interval(mins => greatest(p_lookback_minutes, 0)))
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
  candidates as (
    select
      m.user_id,
      days.day as dose_on,
      s.local_time as scheduled_time,
      m.id as medication_id,
      m.name,
      m.dose_notes,
      ((days.day + s.local_time) at time zone 'America/Argentina/Buenos_Aires') as slot_at
    from public.medications as m
    join public.medication_schedules as s on s.medication_id = m.id
    cross join days
    where m.archived_at is null
      and private.medication_in_course_at(m.id, ((days.day + s.local_time) at time zone 'America/Argentina/Buenos_Aires'))
      and exists (
        select 1
        from public.module_notification_prefs as pref
        where pref.user_id = m.user_id
          and pref.module = 'medicamentos'
          and pref.enabled
      )
  )
  select
    c.user_id,
    c.dose_on,
    c.scheduled_time,
    c.medication_id,
    c.name,
    c.dose_notes
  from candidates as c
  where c.slot_at <= p_at
    and c.slot_at >= p_at - make_interval(mins => greatest(p_lookback_minutes, 0))
    and not exists (
      select 1
      from public.medication_doses as d
      where d.medication_id = c.medication_id
        and d.dose_on = c.dose_on
        and d.scheduled_time = c.scheduled_time
    )
    and not exists (
      select 1
      from public.medication_push_sends as send
      where send.user_id = c.user_id
        and send.dose_on = c.dose_on
        and send.scheduled_time = c.scheduled_time
    );
$$;

revoke all on function public.medication_due_slots(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.medication_due_slots(timestamptz, integer) to service_role;

-- Marca el envío agrupado (usuaria + día + hora) y devuelve los slots recién reclamados
create or replace function public.claim_medication_due_slots(
  p_at timestamptz default now(),
  p_lookback_minutes integer default 5
)
returns table (
  user_id uuid,
  dose_on date,
  scheduled_time time,
  medication_id uuid,
  name text,
  dose_notes text
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
    from public.medication_due_slots(p_at, p_lookback_minutes) as s
  ),
  claimed as (
    insert into public.medication_push_sends as send (user_id, dose_on, scheduled_time, sent_at)
    select distinct due.user_id, due.dose_on, due.scheduled_time, p_at
    from due
    on conflict on constraint medication_push_sends_pkey do nothing
    returning send.user_id as claimed_user_id, send.dose_on as claimed_dose_on, send.scheduled_time as claimed_time
  )
  select
    due.user_id,
    due.dose_on,
    due.scheduled_time,
    due.medication_id,
    due.name,
    due.dose_notes
  from due
  join claimed as c
    on c.claimed_user_id = due.user_id
   and c.claimed_dose_on = due.dose_on
   and c.claimed_time = due.scheduled_time;
end;
$$;

revoke all on function public.claim_medication_due_slots(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_medication_due_slots(timestamptz, integer) to service_role;

-- Índice schedules: tope 6 horas se valida en app; unique ya evita repetir
create or replace function private.guard_medication_schedule_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total integer;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  select count(*)::integer into total
  from public.medication_schedules as s
  where s.medication_id = new.medication_id
    and (tg_op = 'INSERT' or s.id is distinct from new.id);
  if tg_op = 'INSERT' then
    total := total + 1;
  end if;
  if total > 6 then
    raise exception 'Hasta seis horas';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_medication_schedule_count() from public, anon, authenticated;

drop trigger if exists medication_schedules_count_guard on public.medication_schedules;
create trigger medication_schedules_count_guard
  before insert or update on public.medication_schedules
  for each row
  execute function private.guard_medication_schedule_count();
