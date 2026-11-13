-- Medicamentos privados: ficha, horarios fijos y tomas.
-- Al crear/editar horarios se sincronizan scheduled_reminders (módulo medicamentos).
-- No registra el módulo en user_modules (fase 2).

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  dose_notes text,
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint medications_name_len check (char_length(name) between 1 and 80),
  constraint medications_name_trim check (name = btrim(name)),
  constraint medications_dose_notes_len check (dose_notes is null or char_length(dose_notes) <= 280),
  constraint medications_dates check (ends_on is null or ends_on >= starts_on)
);

create table public.medication_schedules (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  local_time time not null,
  created_at timestamptz not null default now(),
  constraint medication_schedules_unique_time unique (medication_id, local_time)
);

create table public.medication_doses (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dose_on date not null,
  scheduled_time time not null,
  status text not null,
  recorded_at timestamptz not null default now(),
  constraint medication_doses_status check (status in ('taken', 'skipped')),
  constraint medication_doses_unique_slot unique (medication_id, dose_on, scheduled_time)
);

create index medications_user_idx on public.medications (user_id) where active;
create index medication_schedules_med_idx on public.medication_schedules (medication_id);
create index medication_doses_user_day_idx on public.medication_doses (user_id, dose_on);

create trigger medications_guard
  before update on public.medications
  for each row
  execute function private.guard_user_owned_row();

create function private.guard_medication_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  med_owner uuid;
  actor uuid := (select auth.uid());
  target uuid;
begin
  target := case when tg_op = 'DELETE' then old.medication_id else new.medication_id end;

  select m.user_id
  into med_owner
  from public.medications as m
  where m.id = target;

  if med_owner is null then
    raise exception 'Ese medicamento no existe';
  end if;

  if actor is not null and med_owner is distinct from actor then
    raise exception 'Ese medicamento no es tuyo';
  end if;

  if tg_op = 'DELETE' then
    if old.user_id is distinct from med_owner then
      raise exception 'Ese medicamento no es tuyo';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'No se puede cambiar de quién es';
  end if;

  if new.user_id is distinct from med_owner then
    raise exception 'Ese medicamento no es tuyo';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_medication_child() from public, anon, authenticated;

create trigger medication_schedules_guard
  before insert or update or delete on public.medication_schedules
  for each row
  execute function private.guard_medication_child();

create trigger medication_doses_guard
  before insert or update or delete on public.medication_doses
  for each row
  execute function private.guard_medication_child();

-- Sincroniza un medicamento → recordatorios genéricos (uno por horario).
create function private.sync_medication_reminders(p_medication_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  med public.medications%rowtype;
  schedule public.medication_schedules%rowtype;
  should_active boolean;
  reminder_body text;
begin
  select *
  into med
  from public.medications
  where id = p_medication_id;

  if med.id is null then
    return;
  end if;

  should_active :=
    med.active
    and (med.ends_on is null or med.ends_on >= (timezone('America/Argentina/Buenos_Aires', now()))::date);

  reminder_body := nullif(btrim(coalesce(med.dose_notes, '')), '');

  for schedule in
    select *
    from public.medication_schedules as s
    where s.medication_id = med.id
    order by s.local_time
  loop
    insert into public.scheduled_reminders (
      user_id,
      module,
      title,
      body,
      local_time,
      timezone,
      days_of_week,
      starts_on,
      ends_on,
      active,
      ref_table,
      ref_id
    )
    values (
      med.user_id,
      'medicamentos',
      med.name,
      reminder_body,
      schedule.local_time,
      'America/Argentina/Buenos_Aires',
      null,
      med.starts_on,
      med.ends_on,
      should_active,
      'medication_schedules',
      schedule.id
    )
    on conflict (user_id, ref_table, ref_id) where ref_table is not null and ref_id is not null
    do update set
      title = excluded.title,
      body = excluded.body,
      local_time = excluded.local_time,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      active = excluded.active,
      updated_at = statement_timestamp();
  end loop;
end;
$$;

revoke all on function private.sync_medication_reminders(uuid) from public, anon, authenticated;

create function private.trg_sync_medication_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  med_id uuid;
begin
  if tg_table_name = 'medications' then
    if tg_op = 'DELETE' then
      -- Los horarios se borran por CASCADE y cada uno limpia su reminder.
      return old;
    end if;
    perform private.sync_medication_reminders(new.id);
    return new;
  end if;

  med_id := case when tg_op = 'DELETE' then old.medication_id else new.medication_id end;
  if tg_op = 'DELETE' then
    delete from public.scheduled_reminders
    where ref_table = 'medication_schedules'
      and ref_id = old.id;
    return old;
  end if;
  perform private.sync_medication_reminders(med_id);
  return new;
end;
$$;

revoke all on function private.trg_sync_medication_reminders() from public, anon, authenticated;

create trigger medications_sync_reminders
  after insert or update of name, dose_notes, starts_on, ends_on, active or delete
  on public.medications
  for each row
  execute function private.trg_sync_medication_reminders();

create trigger medication_schedules_sync_reminders
  after insert or update or delete
  on public.medication_schedules
  for each row
  execute function private.trg_sync_medication_reminders();

alter table public.medications enable row level security;
alter table public.medication_schedules enable row level security;
alter table public.medication_doses enable row level security;

create policy medications_select on public.medications
for select to authenticated
using (user_id = (select auth.uid()));

create policy medications_insert on public.medications
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy medications_update on public.medications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy medications_delete on public.medications
for delete to authenticated
using (user_id = (select auth.uid()));

create policy medication_schedules_select on public.medication_schedules
for select to authenticated
using (user_id = (select auth.uid()));

create policy medication_schedules_insert on public.medication_schedules
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy medication_schedules_update on public.medication_schedules
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy medication_schedules_delete on public.medication_schedules
for delete to authenticated
using (user_id = (select auth.uid()));

create policy medication_doses_select on public.medication_doses
for select to authenticated
using (user_id = (select auth.uid()));

create policy medication_doses_insert on public.medication_doses
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy medication_doses_update on public.medication_doses
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy medication_doses_delete on public.medication_doses
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.medications from public, anon;
revoke all on table public.medication_schedules from public, anon;
revoke all on table public.medication_doses from public, anon;

grant select, insert, update, delete on public.medications to authenticated;
grant select, insert, update, delete on public.medication_schedules to authenticated;
grant select, insert, update, delete on public.medication_doses to authenticated;
