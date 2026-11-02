-- Un gasto compartido lo editan o borran las dos. Un privado, solo su dueña.
-- Un compartido de un mes saldado no se crea, edita ni borra hasta deshacer el saldo.
-- Solo quien lo cargó puede pasarlo a privado.

create or replace function private.validate_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat_owner uuid;
  cat_household uuid;
  payer_household uuid;
begin
  select c.owner_id, c.household_id
  into cat_owner, cat_household
  from public.categories as c
  where c.id = new.category_id;

  if cat_household is null or cat_household is distinct from new.household_id then
    raise exception 'La categoría no es de este hogar';
  end if;

  if new.is_shared and cat_owner is not null then
    raise exception 'Un gasto compartido no puede usar una categoría privada';
  end if;

  if not new.is_shared and cat_owner is distinct from new.owner_id then
    raise exception 'Esa categoría privada no es tuya';
  end if;

  if not new.is_shared and new.payer_id is distinct from new.owner_id then
    raise exception 'Un gasto privado lo pagás vos';
  end if;

  select p.household_id
  into payer_household
  from public.profiles as p
  where p.id = new.payer_id;

  if payer_household is distinct from new.household_id then
    raise exception 'Quien pagó no está en el hogar';
  end if;

  if (select auth.uid()) is not null and not private.is_member(new.household_id) then
    raise exception 'No pertenecés a este hogar';
  end if;

  if tg_op = 'INSERT'
    and (select auth.uid()) is not null
    and new.owner_id is distinct from (select auth.uid()) then
    raise exception 'Solo podés anotar gastos a tu nombre';
  end if;

  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'No se puede cambiar quién cargó el gasto';
  end if;

  return new;
end;
$$;

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

drop trigger if exists expenses_guard_shared on public.expenses;
create trigger expenses_guard_shared
  before insert or update or delete on public.expenses
  for each row
  execute function private.guard_shared_expense_changes();

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
for update to authenticated
using (
  household_id = (select private.my_household_id())
  and (owner_id = (select auth.uid()) or is_shared)
)
with check (
  household_id = (select private.my_household_id())
  and (is_shared or owner_id = (select auth.uid()))
);

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
for delete to authenticated
using (
  household_id = (select private.my_household_id())
  and (owner_id = (select auth.uid()) or is_shared)
);
