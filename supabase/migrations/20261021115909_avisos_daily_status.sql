-- Preferencias extra de Avisos y el estado de cada día.
-- El historial de montos ya vive en fixed_expense_amounts.
-- Un estado diario lo ve y lo escribe solo su dueña.
-- Un gasto fijo privado sigue siendo solo de su dueña; uno compartido, de las dos.

alter table public.reminder_preferences
  add column ask_times time[] not null default array['14:00'::time, '21:30'::time],
  add column due_lead_days smallint not null default 2,
  add column notify_shared boolean not null default true,
  add column sunday_summary boolean not null default false,
  add column push_enabled boolean not null default false;

update public.reminder_preferences
set ask_times = array[first_time, second_time];

alter table public.reminder_preferences
  drop constraint reminder_preferences_times_ordered;

alter table public.reminder_preferences
  add constraint reminder_preferences_due_lead check (due_lead_days between 0 and 28),
  add constraint reminder_preferences_ask_times check (cardinality(ask_times) between 1 and 6);

alter table public.fixed_expenses
  add column remind boolean not null default true;

create table public.daily_statuses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  constraint daily_statuses_kind check (kind in ('logged', 'clear'))
);

alter table public.daily_statuses enable row level security;

create policy daily_statuses_select on public.daily_statuses
for select to authenticated
using (user_id = (select auth.uid()));

create policy daily_statuses_insert on public.daily_statuses
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy daily_statuses_update on public.daily_statuses
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

revoke all on table public.daily_statuses from public, anon;
grant select, insert, update on public.daily_statuses to authenticated;

create function private.sync_logged_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  leftover uuid;
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    select e.id
    into leftover
    from public.expenses as e
    where e.owner_id = old.owner_id
      and e.spent_on = old.spent_on
      and e.id is distinct from old.id
    limit 1;

    if leftover is null then
      delete from public.daily_statuses
      where user_id = old.owner_id
        and day = old.spent_on
        and kind = 'logged';
    end if;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    insert into public.daily_statuses (user_id, day, kind)
    values (new.owner_id, new.spent_on, 'logged')
    on conflict (user_id, day) do update
      set kind = 'logged',
          updated_at = statement_timestamp();
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_logged_day() from public, anon, authenticated;

create trigger expenses_sync_logged_day
  after insert or update or delete on public.expenses
  for each row
  execute function private.sync_logged_day();

insert into public.daily_statuses (user_id, day, kind)
select owner_id, spent_on, 'logged'
from public.expenses
on conflict (user_id, day) do update
  set kind = 'logged',
      updated_at = statement_timestamp();
