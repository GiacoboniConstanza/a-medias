-- Borrado masivo de movimientos: una transacción, todo o nada.

create or replace function public.delete_movements(
  p_month date,
  expense_ids uuid[] default '{}'::uuid[],
  extra_ids uuid[] default '{}'::uuid[],
  transfer_ids uuid[] default '{}'::uuid[],
  saving_move_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  deleted integer := 0;
  n integer;
  month_start date := date_trunc('month', p_month)::date;
  exp_id uuid;
  move_id uuid;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  hid := private.my_household_id();
  if hid is null then
    raise exception 'No estás en un hogar';
  end if;

  if exists (
    select 1 from public.settlements as s
    where s.household_id = hid and s.month = month_start
  ) then
    raise exception 'Ese mes está saldado. Deshacé el saldo en Resumen para eliminar varios.';
  end if;

  -- Pagos de gastos fijos: no se borran desde Movimientos.
  if exists (
    select 1
    from public.fixed_payments as fp
    where fp.expense_id = any (coalesce(expense_ids, '{}'::uuid[]))
  ) then
    raise exception 'Es el pago de un gasto fijo: se deshace en Avisos.';
  end if;

  -- Ahorros archivados.
  if exists (
    select 1
    from public.saving_moves as sm
    join public.savings as s on s.id = sm.saving_id
    where sm.id = any (coalesce(saving_move_ids, '{}'::uuid[]))
      and s.archived_at is not null
  ) then
    raise exception 'El ahorro está archivado.';
  end if;

  -- Transferencias: solo las propias (el trigger también lo exige).
  if exists (
    select 1 from public.transfers as t
    where t.id = any (coalesce(transfer_ids, '{}'::uuid[]))
      and t.created_by is distinct from uid
  ) then
    raise exception 'Solo quien la cargó puede borrar la transferencia';
  end if;

  -- Orden ahorros: primero retiros, después aportes (evita saldo negativo a mitad de camino).
  for move_id in
    select sm.id
    from public.saving_moves as sm
    where sm.id = any (coalesce(saving_move_ids, '{}'::uuid[]))
      and sm.kind = 'retiro'
    order by sm.spent_on desc, sm.created_at desc
  loop
    delete from public.saving_moves where id = move_id and user_id = uid;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'No pude eliminar un movimiento de ahorro';
    end if;
    deleted := deleted + n;
  end loop;

  for move_id in
    select sm.id
    from public.saving_moves as sm
    where sm.id = any (coalesce(saving_move_ids, '{}'::uuid[]))
      and sm.kind = 'aporte'
    order by sm.spent_on desc, sm.created_at desc
  loop
    delete from public.saving_moves where id = move_id and user_id = uid;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'No pude eliminar un movimiento de ahorro';
    end if;
    deleted := deleted + n;
  end loop;

  -- Ingresos puntuales propios.
  delete from public.income_extras as e
  where e.id = any (coalesce(extra_ids, '{}'::uuid[]))
    and e.user_id = uid;
  get diagnostics n = row_count;
  if n <> coalesce(cardinality(extra_ids), 0) then
    raise exception 'No pude eliminar un ingreso';
  end if;
  deleted := deleted + n;

  -- Transferencias propias.
  delete from public.transfers as t
  where t.id = any (coalesce(transfer_ids, '{}'::uuid[]))
    and t.created_by = uid;
  get diagnostics n = row_count;
  if n <> coalesce(cardinality(transfer_ids), 0) then
    raise exception 'No pude eliminar una transferencia';
  end if;
  deleted := deleted + n;

  -- Gastos (compartidos del hogar o propios).
  foreach exp_id in array coalesce(expense_ids, '{}'::uuid[])
  loop
    delete from public.expenses as e where e.id = exp_id;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'No pude eliminar un gasto';
    end if;
    deleted := deleted + n;
  end loop;

  return jsonb_build_object('deleted', deleted);
end;
$$;

revoke all on function public.delete_movements(date, uuid[], uuid[], uuid[], uuid[]) from public, anon;
grant execute on function public.delete_movements(date, uuid[], uuid[], uuid[], uuid[]) to authenticated;
