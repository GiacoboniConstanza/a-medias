-- Ahorros unificados (aditivo). No borra savings_funds / shared_goals /
-- goal_contributions / bag_movements / extra_allocations ni replace_active_shared_goal:
-- la app actual los sigue usando hasta la tarea de pantallas.

-- 1. Tablas nuevas.
create table public.savings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  emoji text not null,
  icon text not null,
  target_amount numeric(14, 2),
  target_date date,
  is_shared boolean not null,
  owner_id uuid references public.profiles (id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint savings_name_len check (char_length(btrim(name)) > 0),
  constraint savings_emoji_len check (char_length(btrim(emoji)) > 0),
  constraint savings_icon_len check (char_length(btrim(icon)) > 0),
  constraint savings_target_positive check (target_amount is null or target_amount > 0),
  constraint savings_privacy check (
    (is_shared and owner_id is null)
    or (not is_shared and owner_id is not null)
  )
);

create table public.saving_opening_balances (
  saving_id uuid not null references public.savings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null,
  primary key (saving_id, user_id),
  constraint saving_opening_balances_amount_positive check (amount > 0)
);

create table public.saving_moves (
  id uuid primary key default gen_random_uuid(),
  saving_id uuid not null references public.savings (id) on delete restrict,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  amount numeric(14, 2) not null,
  spent_on date not null,
  period date not null,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  constraint saving_moves_kind check (kind in ('aporte', 'retiro')),
  constraint saving_moves_amount_positive check (amount > 0),
  constraint saving_moves_period_start check (extract(day from period) = 1)
);

create index savings_household_idx on public.savings (household_id);
create index savings_owner_idx on public.savings (owner_id) where owner_id is not null;
create index saving_moves_saving_idx on public.saving_moves (saving_id, spent_on desc);
create index saving_moves_user_period_idx on public.saving_moves (user_id, period);
create index saving_moves_household_period_idx on public.saving_moves (household_id, period);

-- 2. Saldo por persona / total (misma cuenta que usarán las pantallas).
create or replace function private.saving_person_balance(
  p_saving uuid,
  p_user uuid,
  p_exclude uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select o.amount
      from public.saving_opening_balances as o
      where o.saving_id = p_saving
        and o.user_id = p_user
    ), 0)
    + coalesce((
      select sum(m.amount)
      from public.saving_moves as m
      where m.saving_id = p_saving
        and m.user_id = p_user
        and m.kind = 'aporte'
        and m.id is distinct from p_exclude
    ), 0)
    - coalesce((
      select sum(m.amount)
      from public.saving_moves as m
      where m.saving_id = p_saving
        and m.user_id = p_user
        and m.kind = 'retiro'
        and m.id is distinct from p_exclude
    ), 0)
$$;

create or replace function private.saving_total_balance(
  p_saving uuid,
  p_exclude uuid default null
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(o.amount)
      from public.saving_opening_balances as o
      where o.saving_id = p_saving
    ), 0)
    + coalesce((
      select sum(m.amount)
      from public.saving_moves as m
      where m.saving_id = p_saving
        and m.kind = 'aporte'
        and m.id is distinct from p_exclude
    ), 0)
    - coalesce((
      select sum(m.amount)
      from public.saving_moves as m
      where m.saving_id = p_saving
        and m.kind = 'retiro'
        and m.id is distinct from p_exclude
    ), 0)
$$;

revoke all on function private.saving_person_balance(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.saving_total_balance(uuid, uuid) from public, anon, authenticated;

-- 3. Triggers de validación.
create or replace function private.fill_saving_move_period()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.period is null then
    new.period := date_trunc('month', new.spent_on)::date;
  end if;
  return new;
end;
$$;

create trigger saving_moves_fill_period
  before insert or update of spent_on, period on public.saving_moves
  for each row
  execute function private.fill_saving_move_period();

create or replace function private.validate_saving()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'No se puede borrar un ahorro. Archiválo.';
  end if;

  if (select auth.uid()) is not null and not private.is_member(new.household_id) then
    raise exception 'No pertenecés a este hogar';
  end if;

  if tg_op = 'UPDATE' then
    if new.is_shared is distinct from old.is_shared
      or new.owner_id is distinct from old.owner_id
      or new.household_id is distinct from old.household_id then
      raise exception 'El alcance del ahorro no se puede cambiar. Creá otro.';
    end if;

    if old.archived_at is null
      and new.archived_at is not null
      and private.saving_total_balance(new.id) <> 0 then
      raise exception 'Solo se archiva un ahorro con saldo 0.';
    end if;
  end if;

  if not new.is_shared then
    if new.owner_id is null then
      raise exception 'Un ahorro propio necesita dueña';
    end if;
    if not exists (
      select 1
      from public.profiles as p
      where p.id = new.owner_id
        and p.household_id = new.household_id
    ) then
      raise exception 'La dueña no está en el hogar';
    end if;
  end if;

  return new;
end;
$$;

create trigger savings_validate
  before insert or update or delete on public.savings
  for each row
  execute function private.validate_saving();

create or replace function private.validate_saving_move()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sav record;
  uid uuid := (select auth.uid());
  person_balance numeric;
  total_balance numeric;
  old_person_balance numeric;
  old_total numeric;
  exclude_id uuid := null;
  signed_amount numeric;
begin
  if tg_op = 'DELETE' then
    if uid is not null and old.user_id is distinct from uid then
      raise exception 'Solo podés borrar tus movimientos de ahorro';
    end if;
    if old.kind = 'aporte'
      and private.saving_person_balance(old.saving_id, old.user_id, old.id) < 0 then
      raise exception 'Ese movimiento deja el saldo en negativo';
    end if;
    return old;
  end if;

  select s.id, s.household_id, s.is_shared, s.owner_id, s.archived_at
  into sav
  from public.savings as s
  where s.id = new.saving_id;

  if sav.id is null then
    raise exception 'Ese ahorro no existe';
  end if;

  if sav.archived_at is not null then
    raise exception 'Ese ahorro está archivado';
  end if;

  new.household_id := sav.household_id;

  if uid is not null and new.user_id is distinct from uid then
    raise exception 'Solo podés anotar movimientos de ahorro a tu nombre';
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'No se puede cambiar quién cargó el movimiento';
  end if;

  if tg_op = 'UPDATE' and new.kind is distinct from old.kind then
    raise exception 'No se puede cambiar el tipo del movimiento';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = new.user_id
      and p.household_id = sav.household_id
  ) then
    raise exception 'Quien carga no está en el hogar';
  end if;

  if not sav.is_shared and sav.owner_id is distinct from new.user_id then
    raise exception 'Ese ahorro no es tuyo';
  end if;

  if new.period is null then
    new.period := date_trunc('month', new.spent_on)::date;
  end if;

  if tg_op = 'UPDATE' and new.saving_id is distinct from old.saving_id then
    old_person_balance := private.saving_person_balance(old.saving_id, old.user_id, old.id);
    old_total := private.saving_total_balance(old.saving_id, old.id);
    if old.kind = 'aporte' and (old_person_balance < 0 or old_total < 0) then
      raise exception 'Ese movimiento deja el saldo en negativo';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.saving_id = old.saving_id then
    exclude_id := old.id;
  end if;

  person_balance := private.saving_person_balance(new.saving_id, new.user_id, exclude_id);
  total_balance := private.saving_total_balance(new.saving_id, exclude_id);
  if new.kind = 'aporte' then
    signed_amount := new.amount;
  else
    signed_amount := -new.amount;
  end if;

  if new.kind = 'retiro' and person_balance < new.amount then
    raise exception 'No te alcanza lo ahorrado';
  end if;

  if person_balance + signed_amount < 0 or total_balance + signed_amount < 0 then
    raise exception 'Ese movimiento deja el saldo en negativo';
  end if;

  return new;
end;
$$;

create trigger saving_moves_validate
  before insert or update or delete on public.saving_moves
  for each row
  execute function private.validate_saving_move();

revoke all on function private.fill_saving_move_period() from public, anon, authenticated;
revoke all on function private.validate_saving() from public, anon, authenticated;
revoke all on function private.validate_saving_move() from public, anon, authenticated;

-- 4. RLS.
alter table public.savings enable row level security;
alter table public.saving_opening_balances enable row level security;
alter table public.saving_moves enable row level security;

create policy savings_select on public.savings
for select to authenticated
using (
  household_id = (select private.my_household_id())
  and (is_shared or owner_id = (select auth.uid()))
);

create policy savings_insert on public.savings
for insert to authenticated
with check (
  household_id = (select private.my_household_id())
  and (
    (is_shared and owner_id is null)
    or (not is_shared and owner_id = (select auth.uid()))
  )
);

create policy savings_update on public.savings
for update to authenticated
using (
  household_id = (select private.my_household_id())
  and (is_shared or owner_id = (select auth.uid()))
)
with check (
  household_id = (select private.my_household_id())
  and (is_shared or owner_id = (select auth.uid()))
);

-- Delete permitido a nivel RLS para que el trigger devuelva el error claro (P6).
create policy savings_delete on public.savings
for delete to authenticated
using (
  household_id = (select private.my_household_id())
  and (is_shared or owner_id = (select auth.uid()))
);

create policy saving_opening_balances_select on public.saving_opening_balances
for select to authenticated
using (
  exists (
    select 1
    from public.savings as s
    where s.id = saving_id
      and s.household_id = (select private.my_household_id())
      and (s.is_shared or s.owner_id = (select auth.uid()))
  )
);

create policy saving_moves_select on public.saving_moves
for select to authenticated
using (
  exists (
    select 1
    from public.savings as s
    where s.id = saving_id
      and s.household_id = (select private.my_household_id())
      and (s.is_shared or s.owner_id = (select auth.uid()))
  )
);

create policy saving_moves_insert on public.saving_moves
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and household_id = (select private.my_household_id())
  and exists (
    select 1
    from public.savings as s
    where s.id = saving_id
      and s.household_id = household_id
      and s.archived_at is null
      and (s.is_shared or s.owner_id = (select auth.uid()))
  )
);

create policy saving_moves_update on public.saving_moves
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy saving_moves_delete on public.saving_moves
for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.savings from public, anon;
revoke all on table public.saving_opening_balances from public, anon;
revoke all on table public.saving_moves from public, anon;

grant select, insert, update, delete on public.savings to authenticated;
grant select on public.saving_opening_balances to authenticated;
grant select, insert, update, delete on public.saving_moves to authenticated;

-- 5. Migración de saldo inicial (regla 5, P13) desde las tablas viejas.
-- Fondos propios → ahorro propio; saldo = private.fund_saved.
insert into public.savings (
  id, household_id, name, emoji, icon, target_amount, target_date, is_shared, owner_id, archived_at, created_at
)
select
  f.id,
  p.household_id,
  f.name,
  coalesce(nullif(btrim(f.emoji), ''), coalesce(nullif(btrim(f.icon), ''), 'piggy-bank')),
  coalesce(nullif(btrim(f.icon), ''), 'piggy-bank'),
  f.target_amount,
  f.target_date,
  false,
  f.user_id,
  f.archived_at,
  f.created_at
from public.savings_funds as f
join public.profiles as p on p.id = f.user_id
where p.household_id is not null;

insert into public.saving_opening_balances (saving_id, user_id, amount)
select
  f.id,
  f.user_id,
  private.fund_saved(f.user_id, f.id)
from public.savings_funds as f
join public.profiles as p on p.id = f.user_id
where p.household_id is not null
  and private.fund_saved(f.user_id, f.id) > 0;

-- Metas compartidas → ahorro compartido; saldo por persona = suma de goal_contributions.
insert into public.savings (
  id, household_id, name, emoji, icon, target_amount, target_date, is_shared, owner_id, archived_at, created_at
)
select
  g.id,
  g.household_id,
  g.name,
  coalesce(nullif(btrim(g.emoji), ''), coalesce(nullif(btrim(g.icon), ''), 'piggy-bank')),
  coalesce(nullif(btrim(g.icon), ''), 'piggy-bank'),
  g.target_amount,
  g.target_date,
  true,
  null,
  g.archived_at,
  g.created_at
from public.shared_goals as g;

insert into public.saving_opening_balances (saving_id, user_id, amount)
select
  c.goal_id,
  c.user_id,
  sum(c.amount)
from public.goal_contributions as c
join public.shared_goals as g on g.id = c.goal_id
group by c.goal_id, c.user_id
having sum(c.amount) > 0;

-- Gustos libre → ahorro propio "Gustos" (P7), solo si gustos_free > 0.
insert into public.savings (
  household_id, name, emoji, icon, target_amount, target_date, is_shared, owner_id, archived_at
)
select
  p.household_id,
  'Gustos',
  'bag-shopping',
  'bag-shopping',
  null,
  null,
  false,
  p.id,
  null
from public.profiles as p
where p.household_id is not null
  and private.gustos_free(p.id) > 0;

insert into public.saving_opening_balances (saving_id, user_id, amount)
select
  s.id,
  s.owner_id,
  private.gustos_free(s.owner_id)
from public.savings as s
where s.name = 'Gustos'
  and not s.is_shared
  and s.owner_id is not null
  and private.gustos_free(s.owner_id) > 0
  and not exists (
    select 1
    from public.saving_opening_balances as o
    where o.saving_id = s.id
      and o.user_id = s.owner_id
  );
