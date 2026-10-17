-- Movimientos de la bolsa (gusto, pasar a un fondo, devolver, usar).
-- Cada fila la ve solo su dueña. Los montos se validan en private, con security definer,
-- para no poder pasar de lo libre. No cambia las políticas de las tablas que ya existían.

alter table public.savings_funds
  add column target_date date;

alter table public.expenses
  add column paid_from_bag boolean not null default false;

alter table public.expenses
  add constraint expenses_bag_is_private check (paid_from_bag = false or is_shared = false);

create table public.bag_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  fund_id uuid references public.savings_funds (id) on delete restrict,
  expense_id uuid references public.expenses (id) on delete restrict,
  amount numeric(14, 2) not null,
  label text not null default '',
  happened_on date not null,
  created_at timestamptz not null default now(),
  constraint bag_movements_kind check (kind in ('gusto', 'to_fund', 'to_gustos', 'use')),
  constraint bag_movements_amount_positive check (amount > 0),
  constraint bag_movements_shape check (
    (kind = 'gusto' and fund_id is null and expense_id is not null)
    or (kind in ('to_fund', 'to_gustos', 'use') and fund_id is not null and expense_id is null)
  )
);

create index bag_movements_user_idx on public.bag_movements (user_id, happened_on);
create index bag_movements_fund_idx on public.bag_movements (fund_id);

create function private.gustos_free(uid uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(a.amount)
      from public.extra_allocations as a
      where a.user_id = uid
        and a.fund_id is null
    ), 0)
    + coalesce((
      select sum(m.amount)
      from public.bag_movements as m
      where m.user_id = uid
        and m.kind = 'to_gustos'
    ), 0)
    - coalesce((
      select sum(m.amount)
      from public.bag_movements as m
      where m.user_id = uid
        and m.kind in ('gusto', 'to_fund')
    ), 0)
$$;

create function private.fund_saved(uid uuid, target uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(a.amount)
      from public.extra_allocations as a
      where a.user_id = uid
        and a.fund_id = target
    ), 0)
    + coalesce((
      select sum(m.amount)
      from public.bag_movements as m
      where m.user_id = uid
        and m.fund_id = target
        and m.kind = 'to_fund'
    ), 0)
    - coalesce((
      select sum(m.amount)
      from public.bag_movements as m
      where m.user_id = uid
        and m.fund_id = target
        and m.kind in ('to_gustos', 'use')
    ), 0)
$$;

create function private.reject_direct_bag_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.paid_from_bag and coalesce(current_setting('app.bag_write', true), '') is distinct from 'on' then
    raise exception 'Los gustos se anotan desde la bolsa';
  end if;
  return new;
end;
$$;

create trigger expenses_reject_direct_bag
  before insert or update on public.expenses
  for each row
  execute function private.reject_direct_bag_expense();

create function private.validate_bag_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  available numeric(14, 2);
begin
  if (select auth.uid()) is not null and new.user_id is distinct from (select auth.uid()) then
    raise exception 'Ese movimiento no es tuyo';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  if new.kind = 'gusto' then
    if new.expense_id is null then
      raise exception 'El gusto tiene que ser un gasto de la bolsa';
    end if;

    if not exists (
      select 1
      from public.expenses as e
      where e.id = new.expense_id
        and e.owner_id = new.user_id
        and e.paid_from_bag
        and not e.is_shared
        and e.amount = new.amount
    ) then
      raise exception 'El gusto tiene que ser un gasto privado de la bolsa';
    end if;

    available := private.gustos_free(new.user_id);
    if new.amount > available then
      raise exception 'No te alcanza lo libre de gustos';
    end if;

    return new;
  end if;

  if new.kind in ('to_fund', 'to_gustos', 'use') then
    if new.fund_id is null then
      raise exception 'Elegí un fondo';
    end if;

    if not exists (
      select 1
      from public.savings_funds as f
      where f.id = new.fund_id
        and f.user_id = new.user_id
    ) then
      raise exception 'Ese fondo no es tuyo';
    end if;

    if new.kind = 'to_fund' then
      available := private.gustos_free(new.user_id);
      if new.amount > available then
        raise exception 'No te alcanza lo libre de gustos';
      end if;
    else
      available := private.fund_saved(new.user_id, new.fund_id);
      if new.amount > available then
        raise exception 'No te alcanza lo ahorrado en el fondo';
      end if;
    end if;

    return new;
  end if;

  raise exception 'Ese movimiento no existe';
end;
$$;

create trigger bag_movements_validate
  before insert or update on public.bag_movements
  for each row
  execute function private.validate_bag_movement();

create function private.spend_from_gustos(
  expense_title text,
  category_id uuid,
  expense_amount numeric,
  spent_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  expense uuid;
  rounded numeric(14, 2);
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  if spent_on is null then
    raise exception 'Falta la fecha';
  end if;

  if expense_title is null or char_length(btrim(expense_title)) = 0 then
    raise exception 'El gusto necesita una descripción';
  end if;

  rounded := round(expense_amount, 2);
  if rounded is null or rounded <= 0 then
    raise exception 'El monto tiene que ser mayor a cero';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select p.household_id
  into hid
  from public.profiles as p
  where p.id = uid;

  if hid is null then
    raise exception 'No estás en un hogar';
  end if;

  perform set_config('app.bag_write', 'on', true);

  insert into public.expenses (
    household_id,
    owner_id,
    payer_id,
    category_id,
    title,
    amount,
    spent_on,
    is_shared,
    paid_from_bag
  )
  values (
    hid,
    uid,
    uid,
    category_id,
    btrim(expense_title),
    rounded,
    spent_on,
    false,
    true
  )
  returning id into expense;

  insert into public.bag_movements (user_id, kind, fund_id, expense_id, amount, label, happened_on)
  values (uid, 'gusto', null, expense, rounded, btrim(expense_title), spent_on);

  return expense;
end;
$$;

create function private.move_bag_money(
  movement_kind text,
  target_fund uuid,
  movement_amount numeric,
  happened_on date,
  movement_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  rounded numeric(14, 2);
  movement uuid;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  if happened_on is null then
    raise exception 'Falta la fecha';
  end if;

  if movement_kind not in ('to_fund', 'to_gustos', 'use') then
    raise exception 'Ese movimiento no existe';
  end if;

  if target_fund is null then
    raise exception 'Elegí un fondo';
  end if;

  rounded := round(movement_amount, 2);
  if rounded is null or rounded <= 0 then
    raise exception 'El monto tiene que ser mayor a cero';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if not exists (
    select 1
    from public.savings_funds as f
    where f.id = target_fund
      and f.user_id = uid
  ) then
    raise exception 'Ese fondo no es tuyo';
  end if;

  insert into public.bag_movements (user_id, kind, fund_id, expense_id, amount, label, happened_on)
  values (uid, movement_kind, target_fund, null, rounded, coalesce(btrim(movement_label), ''), happened_on)
  returning id into movement;

  return movement;
end;
$$;

create function public.spend_from_gustos(
  expense_title text,
  category_id uuid,
  expense_amount numeric,
  spent_on date
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.spend_from_gustos(expense_title, category_id, expense_amount, spent_on)
$$;

create function public.move_bag_money(
  movement_kind text,
  target_fund uuid,
  movement_amount numeric,
  happened_on date,
  movement_label text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.move_bag_money(movement_kind, target_fund, movement_amount, happened_on, movement_label)
$$;

revoke all on function private.gustos_free(uuid) from public, anon, authenticated;
revoke all on function private.fund_saved(uuid, uuid) from public, anon, authenticated;
revoke all on function private.reject_direct_bag_expense() from public, anon, authenticated;
revoke all on function private.validate_bag_movement() from public, anon, authenticated;
revoke all on function private.spend_from_gustos(text, uuid, numeric, date) from public, anon, authenticated;
revoke all on function private.move_bag_money(text, uuid, numeric, date, text) from public, anon, authenticated;

grant execute on function private.spend_from_gustos(text, uuid, numeric, date) to authenticated;
grant execute on function private.move_bag_money(text, uuid, numeric, date, text) to authenticated;

revoke all on function public.spend_from_gustos(text, uuid, numeric, date) from public, anon;
revoke all on function public.move_bag_money(text, uuid, numeric, date, text) from public, anon;
grant execute on function public.spend_from_gustos(text, uuid, numeric, date) to authenticated;
grant execute on function public.move_bag_money(text, uuid, numeric, date, text) to authenticated;

revoke all on table public.bag_movements from public, anon, authenticated;
grant select on public.bag_movements to authenticated;

alter table public.bag_movements enable row level security;

create policy bag_movements_select on public.bag_movements
for select to authenticated
using (user_id = (select auth.uid()));
