-- Ajustes · Categorías: editar, borrar/mover, uso y categoría en fijos (E6–E14, E17–E18).
-- No mueve ni renombra datos existentes.

-- Nombre 1–24: not valid por si hay nombres viejos más largos.
alter table public.categories
  drop constraint if exists categories_name_len;
alter table public.categories
  add constraint categories_name_len check (char_length(btrim(name)) between 1 and 24) not valid;

create policy categories_update on public.categories
for update to authenticated
using (household_id = (select private.my_household_id()))
with check (household_id = (select private.my_household_id()));

-- Solo nombre e ícono (emoji = icon); sin delete por política.
revoke update on table public.categories from authenticated;
grant update (name, icon, emoji) on table public.categories to authenticated;

-- Usos visibles (compartidos + mis privados) en 90 días, y si hay vínculos a mover.
create or replace function public.category_usage()
returns table (category_id uuid, uses bigint, has_links boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  since date;
begin
  if uid is null then
    return;
  end if;
  hid := private.my_household_id();
  if hid is null then
    return;
  end if;
  since := (timezone('America/Argentina/Buenos_Aires', now())::date - 90);

  return query
  with cats as (
    select c.id
    from public.categories as c
    where c.household_id = hid
  ),
  visible as (
    select e.category_id as id, count(*)::bigint as n
    from public.expenses as e
    where e.household_id = hid
      and e.category_id is not null
      and e.spent_on >= since
      and (e.is_shared or e.owner_id = uid)
    group by e.category_id
  ),
  linked as (
    select c.id,
      exists (
        select 1 from public.expenses as e
        where e.category_id = c.id and e.household_id = hid
      )
      or exists (
        select 1 from public.fixed_expenses as f
        where f.category_id = c.id and f.household_id = hid
      )
      or exists (
        select 1
        from public.mp_merchant_prefs as p
        join public.profiles as pr on pr.id = p.owner_id
        where p.category_id = c.id
          and pr.household_id = hid
      )
      or exists (
        select 1 from public.category_budgets as b
        where b.category_id = c.id and b.user_id = uid
      ) as has_links
    from cats as c
  )
  select
    c.id,
    coalesce(v.n, 0::bigint),
    coalesce(l.has_links, false)
  from cats as c
  left join visible as v on v.id = c.id
  left join linked as l on l.id = c.id;
end;
$$;

revoke all on function public.category_usage() from public, anon;
grant execute on function public.category_usage() to authenticated;

-- Borrar/mover: sin política delete; solo esta RPC.
create or replace function public.delete_category(p_id uuid, p_move_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  cat_household uuid;
  dest_household uuid;
  remaining integer;
  has_links boolean;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  hid := private.my_household_id();
  if hid is null then
    raise exception 'No pertenecés a este hogar';
  end if;

  select c.household_id into cat_household
  from public.categories as c
  where c.id = p_id;
  if cat_household is null or cat_household is distinct from hid then
    raise exception 'Esa categoría no es de tu casa';
  end if;

  select count(*)::integer into remaining
  from public.categories as c
  where c.household_id = hid;
  if remaining <= 1 then
    raise exception 'Tiene que quedar al menos una categoría';
  end if;

  select
    exists (select 1 from public.expenses as e where e.category_id = p_id and e.household_id = hid)
    or exists (select 1 from public.fixed_expenses as f where f.category_id = p_id and f.household_id = hid)
    or exists (
      select 1
      from public.mp_merchant_prefs as p
      join public.profiles as pr on pr.id = p.owner_id
      where p.category_id = p_id
        and pr.household_id = hid
    )
    or exists (select 1 from public.category_budgets as b where b.category_id = p_id)
  into has_links;

  if has_links then
    if p_move_to is null then
      raise exception 'Elegí a qué categoría pasan';
    end if;
    if p_move_to = p_id then
      raise exception 'Elegí otra categoría';
    end if;
    select c.household_id into dest_household
    from public.categories as c
    where c.id = p_move_to;
    if dest_household is null or dest_household is distinct from hid then
      raise exception 'Esa categoría no es de tu casa';
    end if;

    update public.expenses
    set category_id = p_move_to
    where category_id = p_id
      and household_id = hid;

    update public.fixed_expenses
    set category_id = p_move_to
    where category_id = p_id
      and household_id = hid;

    update public.mp_merchant_prefs as p
    set category_id = p_move_to
    from public.profiles as pr
    where p.category_id = p_id
      and pr.id = p.owner_id
      and pr.household_id = hid;

    -- Topes: pasar solo si la destino no tiene tope para esa usuaria; si no, se descartan.
    delete from public.category_budgets as keep
    where keep.category_id = p_id
      and exists (
        select 1
        from public.category_budgets as dest
        where dest.user_id = keep.user_id
          and dest.category_id = p_move_to
          and dest.effective_from = keep.effective_from
      );

    update public.category_budgets
    set category_id = p_move_to
    where category_id = p_id;
  elsif p_move_to is not null then
    raise exception 'Esa categoría no tiene gastos para pasar';
  end if;

  delete from public.categories where id = p_id and household_id = hid;
end;
$$;

revoke all on function public.delete_category(uuid, uuid) from public, anon;
grant execute on function public.delete_category(uuid, uuid) to authenticated;

-- E12: en mes saldado se puede cambiar solo category_id de un gasto compartido.
create or replace function private.guard_shared_expense_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  uid := (select auth.uid());

  if tg_op = 'DELETE' then
    if old.is_shared
      and exists (
        select 1
        from public.settlements as s
        where s.household_id = old.household_id
          and s.month = old.period
      )
      and exists (
        select 1 from public.households as h where h.id = old.household_id
      )
      and exists (
        select 1 from auth.users as u where u.id = old.owner_id
      )
    then
      raise exception 'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este gasto.';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.is_shared
    and new.is_shared
    and new.household_id is not distinct from old.household_id
    and new.period is not distinct from old.period
    and new.amount is not distinct from old.amount
    and new.spent_on is not distinct from old.spent_on
    and new.payer_id is not distinct from old.payer_id
    and new.owner_id is not distinct from old.owner_id
    and new.title is not distinct from old.title
    and new.notes is not distinct from old.notes
    and new.paid_from_bag is not distinct from old.paid_from_bag
    and new.mp_operation_id is not distinct from old.mp_operation_id
    and new.category_id is distinct from old.category_id
  then
    return new;
  end if;

  if new.is_shared or (tg_op = 'UPDATE' and old.is_shared) then
    if exists (
      select 1
      from public.settlements as s
      where s.household_id = new.household_id
        and (
          s.month = new.period
          or (tg_op = 'UPDATE' and s.month = old.period)
        )
    ) then
      raise exception 'Ese mes ya está saldado. Deshacé el saldo en Compartidos para cambiar este gasto.';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.is_shared
    and not new.is_shared
    and uid is not null
    and old.owner_id is distinct from uid then
    raise exception 'Solo quien lo cargó puede pasarlo a privado.';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_shared_expense_changes() from public, anon, authenticated;
