-- Avisos push genéricos (suscripciones + recordatorios programados).
-- Reutiliza public.push_subscriptions (ya usada por Finanzas) y agrega
-- scheduled_reminders para cualquier módulo. No migra avisos de Finanzas.

alter table public.push_subscriptions
  add column if not exists user_agent text,
  add column if not exists updated_at timestamptz not null default now();

create function private.guard_user_owned_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'No se puede cambiar de quién es';
  end if;
  if to_jsonb(new) ? 'updated_at' then
    new.updated_at := statement_timestamp();
  end if;
  return new;
end;
$$;

revoke all on function private.guard_user_owned_row() from public, anon, authenticated;

drop trigger if exists push_subscriptions_guard on public.push_subscriptions;
create trigger push_subscriptions_guard
  before update on public.push_subscriptions
  for each row
  execute function private.guard_user_owned_row();

-- Recordatorios genéricos: hora local, zona, días opcionales, ventana de fechas.
-- days_of_week null = todos los días; 0 = lunes … 6 = domingo (igual que hábitos).
-- ref_table/ref_id apuntan a la entidad del módulo (ej. medication_schedules).
create table public.scheduled_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null,
  title text not null,
  body text,
  local_time time not null,
  timezone text not null default 'America/Argentina/Buenos_Aires',
  days_of_week integer[],
  starts_on date,
  ends_on date,
  active boolean not null default true,
  ref_table text,
  ref_id uuid,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_reminders_module_len check (char_length(module) between 1 and 40),
  constraint scheduled_reminders_module_trim check (module = btrim(module)),
  constraint scheduled_reminders_title_len check (char_length(title) between 1 and 120),
  constraint scheduled_reminders_title_trim check (title = btrim(title)),
  constraint scheduled_reminders_body_len check (body is null or char_length(body) <= 280),
  constraint scheduled_reminders_timezone_len check (char_length(timezone) between 1 and 64),
  constraint scheduled_reminders_ref_pair check (
    (ref_table is null and ref_id is null)
    or (ref_table is not null and ref_id is not null)
  ),
  constraint scheduled_reminders_dates check (
    starts_on is null or ends_on is null or ends_on >= starts_on
  )
);

create unique index scheduled_reminders_ref_uidx
  on public.scheduled_reminders (user_id, ref_table, ref_id)
  where ref_table is not null and ref_id is not null;

create index scheduled_reminders_due_idx
  on public.scheduled_reminders (active, local_time)
  where active;

create index scheduled_reminders_user_idx
  on public.scheduled_reminders (user_id)
  where active;

create function private.guard_scheduled_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  day integer;
  distinct_days integer;
begin
  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'No se puede cambiar de quién es';
  end if;

  if new.days_of_week is not null then
    if cardinality(new.days_of_week) < 1 or cardinality(new.days_of_week) > 7 then
      raise exception 'Elegí entre 1 y 7 días, o dejalo vacío para todos';
    end if;
    foreach day in array new.days_of_week loop
      if day < 0 or day > 6 then
        raise exception 'El día tiene que estar entre 0 y 6';
      end if;
    end loop;
    select count(distinct value)
    into distinct_days
    from unnest(new.days_of_week) as value;
    if distinct_days <> cardinality(new.days_of_week) then
      raise exception 'Los días no se repiten';
    end if;
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_scheduled_reminder() from public, anon, authenticated;

create trigger scheduled_reminders_guard
  before insert or update on public.scheduled_reminders
  for each row
  execute function private.guard_scheduled_reminder();

alter table public.scheduled_reminders enable row level security;

create policy scheduled_reminders_select on public.scheduled_reminders
for select to authenticated
using (user_id = (select auth.uid()));

create policy scheduled_reminders_insert on public.scheduled_reminders
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy scheduled_reminders_update on public.scheduled_reminders
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy scheduled_reminders_delete on public.scheduled_reminders
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.scheduled_reminders from public, anon;
grant select, insert, update, delete on public.scheduled_reminders to authenticated;

-- ¿Este recordatorio toca en p_at? (testeable con pgTAP)
create function private.reminder_is_due(
  r public.scheduled_reminders,
  p_at timestamptz
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    r.active
    and (
      r.last_sent_at is null
      or r.last_sent_at < date_trunc('minute', p_at)
    )
    and (
      select
        local_ts::time >= r.local_time
        and local_ts::time < (r.local_time + interval '1 minute')
        and (r.days_of_week is null or (extract(isodow from local_ts)::integer - 1) = any (r.days_of_week))
        and (r.starts_on is null or local_ts::date >= r.starts_on)
        and (r.ends_on is null or local_ts::date <= r.ends_on)
      from (select (p_at at time zone r.timezone) as local_ts) as t
    );
$$;

revoke all on function private.reminder_is_due(public.scheduled_reminders, timestamptz)
  from public, anon, authenticated;

-- Marca y devuelve los que tocan ahora (service_role / cron). Evita duplicados.
create function public.claim_due_reminders(p_at timestamptz default now())
returns setof public.scheduled_reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select s.id
    from public.scheduled_reminders as s
    where private.reminder_is_due(s, p_at)
    for update of s skip locked
  ),
  updated as (
    update public.scheduled_reminders as s
    set
      last_sent_at = p_at,
      updated_at = statement_timestamp()
    from due
    where s.id = due.id
    returning s.*
  )
  select * from updated;
end;
$$;

revoke all on function public.claim_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(timestamptz) to service_role;

-- Solo lectura de “qué toca” para pruebas (postgres / service_role).
create function public.reminders_due_at(p_at timestamptz default now())
returns setof public.scheduled_reminders
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.scheduled_reminders as s
  where private.reminder_is_due(s, p_at);
$$;

revoke all on function public.reminders_due_at(timestamptz) from public, anon, authenticated;
grant execute on function public.reminders_due_at(timestamptz) to service_role;

-- pg_cron + pg_net: URL y secreto salen de Vault (nada sensible acá).
-- Si faltan extensiones o secretos, no rompe el migrate local.
do $cron$
declare
  job_id bigint;
begin
  begin
    create extension if not exists pg_net with schema extensions;
  exception
    when others then
      raise notice 'pg_net no disponible: %', sqlerrm;
      return;
  end;

  begin
    create extension if not exists pg_cron;
  exception
    when others then
      raise notice 'pg_cron no disponible: %', sqlerrm;
      return;
  end;

  if to_regprocedure('cron.unschedule(text)') is not null then
    begin
      perform cron.unschedule('dispatch-push-reminders');
    exception
      when others then
        null;
    end;
  end if;

  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'Vault no disponible: cron de push no programado';
    return;
  end if;

  perform cron.schedule(
    'dispatch-push-reminders',
    '* * * * *',
    $job$
    select
      net.http_post(
        url := (
          select ds.decrypted_secret
          from vault.decrypted_secrets as ds
          where ds.name = 'push_dispatch_url'
          limit 1
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization',
          'Bearer ' || (
            select ds.decrypted_secret
            from vault.decrypted_secrets as ds
            where ds.name = 'push_dispatch_secret'
            limit 1
          )
        ),
        body := jsonb_build_object('source', 'pg_cron')
      )
    where exists (
      select 1
      from vault.decrypted_secrets as ds
      where ds.name = 'push_dispatch_url'
    )
    and exists (
      select 1
      from vault.decrypted_secrets as ds
      where ds.name = 'push_dispatch_secret'
    );
    $job$
  );
exception
  when others then
    raise notice 'No se pudo programar dispatch-push-reminders: %', sqlerrm;
end;
$cron$;
