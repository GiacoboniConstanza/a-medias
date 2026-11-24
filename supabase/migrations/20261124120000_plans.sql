-- Planes: ítems compartidos o privados para renovar la casa.

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  amount numeric(14, 2) not null,
  note text null,
  tag text null,
  is_private boolean not null default false,
  owner_id uuid null references public.profiles (id) on delete cascade,
  chosen boolean not null default false,
  expense_id uuid null references public.expenses (id) on delete set null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id),
  constraint plan_items_title_len check (char_length(btrim(title)) between 1 and 80),
  constraint plan_items_amount_positive check (amount > 0),
  constraint plan_items_note_len check (note is null or char_length(note) <= 500),
  constraint plan_items_tag_len check (tag is null or char_length(tag) between 1 and 24),
  constraint plan_items_private_owner check (
    (is_private and owner_id is not null)
    or (not is_private and owner_id is null)
  )
);

create unique index plan_items_expense_unique
  on public.plan_items (expense_id)
  where expense_id is not null;

create index plan_items_household_idx
  on public.plan_items (household_id);

create index plan_items_household_tag_idx
  on public.plan_items (household_id, lower(tag))
  where tag is not null;

create or replace function private.normalize_plan_tag(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    left(
      btrim(regexp_replace(coalesce(raw, ''), '\s+', ' ', 'g')),
      24
    ),
    ''
  );
$$;

create or replace function private.guard_plan_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exp record;
begin
  new.title := btrim(new.title);
  if char_length(new.title) < 1 or char_length(new.title) > 80 then
    raise exception 'El nombre del ítem no es válido';
  end if;

  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if new.note is not null and char_length(new.note) > 500 then
    raise exception 'La observación es demasiado larga';
  end if;

  new.tag := private.normalize_plan_tag(new.tag);

  if tg_op = 'UPDATE' then
    if new.is_private is distinct from old.is_private
      or new.owner_id is distinct from old.owner_id then
      raise exception 'No se puede cambiar si el ítem es privado';
    end if;
  end if;

  if new.is_private and new.owner_id is null then
    raise exception 'Un ítem privado necesita dueña';
  end if;
  if not new.is_private and new.owner_id is not null then
    raise exception 'Un ítem compartido no tiene dueña';
  end if;

  if new.expense_id is not null then
    select e.household_id, e.is_shared, e.owner_id, e.amount
      into exp
    from public.expenses as e
    where e.id = new.expense_id;
    if not found then
      raise exception 'Ese gasto no existe';
    end if;
    if exp.household_id is distinct from new.household_id then
      raise exception 'El gasto tiene que ser del mismo hogar';
    end if;
    if new.is_private then
      if exp.is_shared or exp.owner_id is distinct from new.owner_id then
        raise exception 'Un ítem privado solo se une a un gasto privado propio';
      end if;
    else
      if not exp.is_shared then
        raise exception 'Un ítem compartido solo se une a un gasto compartido';
      end if;
    end if;
    new.chosen := false;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists plan_items_guard on public.plan_items;
create trigger plan_items_guard
  before insert or update on public.plan_items
  for each row
  execute function private.guard_plan_item();

alter table public.plan_items enable row level security;

create policy plan_items_select on public.plan_items
for select to authenticated
using (
  household_id = private.my_household_id()
  and (not is_private or owner_id = (select auth.uid()))
);

create policy plan_items_insert on public.plan_items
for insert to authenticated
with check (
  household_id = private.my_household_id()
  and created_by = (select auth.uid())
  and (
    (not is_private and owner_id is null)
    or (is_private and owner_id = (select auth.uid()))
  )
);

create policy plan_items_update on public.plan_items
for update to authenticated
using (
  household_id = private.my_household_id()
  and (not is_private or owner_id = (select auth.uid()))
)
with check (
  household_id = private.my_household_id()
  and (not is_private or owner_id = (select auth.uid()))
);

create policy plan_items_delete on public.plan_items
for delete to authenticated
using (
  household_id = private.my_household_id()
  and (not is_private or owner_id = (select auth.uid()))
);

revoke all on table public.plan_items from public, anon;
grant select, insert, update, delete on table public.plan_items to authenticated;

-- Parte de un total según porcentajes enteros (mismo redondeo que shareAmounts).
create or replace function private.share_cents_for(
  p_total numeric,
  p_user uuid,
  p_ids uuid[],
  p_percents integer[]
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  n integer := coalesce(array_length(p_ids, 1), 0);
  total_cents bigint;
  shares bigint[];
  i integer;
  drift bigint;
  idx integer := 0;
begin
  if n = 0 or p_total is null then
    return 0;
  end if;
  total_cents := round(p_total * 100)::bigint;
  shares := array[]::bigint[];
  for i in 1..n loop
    shares := shares || round(total_cents * (coalesce(p_percents[i], 0)::numeric) / 100)::bigint;
  end loop;
  drift := total_cents - (select coalesce(sum(s), 0) from unnest(shares) as s);
  shares[1] := shares[1] + drift;
  for i in 1..n loop
    if p_ids[i] = p_user then
      idx := i;
      exit;
    end if;
  end loop;
  if idx = 0 then
    return 0;
  end if;
  return shares[idx]::numeric / 100;
end;
$$;

revoke all on function private.share_cents_for(numeric, uuid, uuid[], integer[]) from public, anon, authenticated;
revoke all on function private.normalize_plan_tag(text) from public, anon, authenticated;
revoke all on function private.guard_plan_item() from public, anon, authenticated;

-- Mi año necesita null (mes vacío) cuando no hay fila; bases_at sigue en 0 para el 50/50.
-- Redefine acá (no en 20261123120000) para no reescribir una migración ya aplicada en Producción.
create or replace function private.salary_at(target uuid, target_month date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when target_month >= private.salary_cutover() then
      (
        select sum(s.amount)
        from public.base_salaries as s
        where s.user_id = target
          and s.effective_from = target_month
      )
    else
      (
        select s.amount
        from public.base_salaries as s
        where s.user_id = target
          and s.effective_from <= target_month
        order by s.effective_from desc
        limit 1
      )
  end
$$;

revoke all on function private.salary_at(uuid, date) from public, anon, authenticated;

-- Señal de la pareja para el mes: sueldo = suma de base_salaries del mes
-- (sin arrastre desde salary_cutover), porcentajes = preferencia vigente
-- (proportional / even / manual vía private.percents_for).
create or replace function private.plan_partner_status_at(target_month date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  partner uuid;
  salary numeric;
  shared_total numeric := 0;
  private_total numeric := 0;
  commitment numeric := 0;
  ids uuid[];
  percents integer[];
  row_amount numeric;
begin
  if uid is null then
    return null;
  end if;

  hid := private.my_household_id();
  if hid is null then
    return null;
  end if;

  select p.id into partner
  from public.profiles as p
  where p.household_id = hid
    and p.id <> uid
  order by p.id
  limit 1;

  if partner is null then
    return null;
  end if;

  -- Misma regla que private.salary_at / bases_at: suma del mes desde el corte.
  select coalesce(b.amount, 0)
  into salary
  from private.bases_at(hid, target_month, null, null, null, false) as b
  where b.user_id = partner;

  if coalesce(salary, 0) <= 0 then
    return 'falta_sueldo';
  end if;

  select
    coalesce(array_agg(s.user_id order by s.user_id), array[]::uuid[]),
    coalesce(array_agg(s.percent order by s.user_id), array[]::integer[])
  into ids, percents
  from private.percents_for(hid, target_month, null, null, null, false) as s;

  for row_amount in
    select
      case
        when pay.amount is not null then pay.amount
        else private.fixed_amount_for_month(f.id, target_month)
      end
    from public.fixed_expenses as f
    left join public.fixed_payments as pay
      on pay.fixed_expense_id = f.id and pay.month = target_month
    where f.household_id = hid
      and f.is_shared
      and f.paused_at is null
  loop
    if row_amount is not null then
      shared_total := shared_total + row_amount;
    end if;
  end loop;

  for row_amount in
    select
      case
        when pay.amount is not null then pay.amount
        else private.fixed_amount_for_month(f.id, target_month)
      end
    from public.fixed_expenses as f
    left join public.fixed_payments as pay
      on pay.fixed_expense_id = f.id and pay.month = target_month
    where f.household_id = hid
      and not f.is_shared
      and f.owner_id = partner
      and f.paused_at is null
  loop
    if row_amount is not null then
      private_total := private_total + row_amount;
    end if;
  end loop;

  for row_amount in
    select i.amount
    from public.plan_items as i
    where i.household_id = hid
      and not i.is_private
      and i.chosen
      and i.expense_id is null
  loop
    commitment := commitment + private.share_cents_for(row_amount, partner, ids, percents);
  end loop;

  for row_amount in
    select e.amount
    from public.plan_items as i
    join public.expenses as e on e.id = i.expense_id
    where i.household_id = hid
      and not i.is_private
      and e.is_shared
      and e.period = target_month
  loop
    commitment := commitment + private.share_cents_for(row_amount, partner, ids, percents);
  end loop;

  if salary
    - private.share_cents_for(shared_total, partner, ids, percents)
    - private_total
    - commitment >= 0 then
    return 'alcanza';
  end if;
  return 'no_alcanza';
end;
$$;

create or replace function public.plan_partner_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.plan_partner_status_at(
    date_trunc('month', timezone('America/Argentina/Buenos_Aires', now()))::date
  );
$$;

revoke all on function private.plan_partner_status_at(date) from public, anon, authenticated;
revoke all on function public.plan_partner_status() from public, anon;
grant execute on function public.plan_partner_status() to authenticated;
