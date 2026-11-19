-- Saldar mes con transferencia opcional (issue #6) + saldar por menos.
-- Columna transfers.settlement_id; settlements.expected_amount;
-- settle_shared_month(+p_register_transfer, p_amount ≤ neto);
-- undo borra la vinculada; guard bloquea editar/borrar mientras el saldo exista.

alter table public.transfers
  add column if not exists settlement_id uuid null references public.settlements (id) on delete cascade;

alter table public.settlements
  add column if not exists expected_amount numeric(14, 2) null;

create unique index if not exists transfers_settlement_uidx
  on public.transfers (settlement_id)
  where settlement_id is not null;

-- Guard: no editar ni borrar a mano la transferencia del saldo mientras exista el settlement.
create or replace function private.guard_transfer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    if old.settlement_id is not null then
      -- Solo el deshacer (marca app.undoing_settlement) puede borrarla.
      if current_setting('app.undoing_settlement', true) is distinct from '1' then
        raise exception 'Para cambiarla, deshacé el saldo';
      end if;
      return old;
    end if;
    if actor is not null and old.created_by is distinct from actor then
      raise exception 'Solo quien la cargó puede borrar la transferencia';
    end if;
    return old;
  end if;

  if new.period is null then
    new.period := date_trunc('month', new.transferred_on)::date;
  else
    new.period := date_trunc('month', new.period)::date;
  end if;

  if tg_op = 'INSERT' and new.settlement_id is not null then
    if current_setting('app.registering_settlement_transfer', true) is distinct from '1' then
      raise exception 'No se puede vincular una transferencia al saldo a mano';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and old.settlement_id is not null
    and exists (
      select 1 from public.settlements as s where s.id = old.settlement_id
    ) then
    raise exception 'Para cambiarla, deshacé el saldo';
  end if;

  if tg_op = 'UPDATE' and new.settlement_id is distinct from old.settlement_id then
    raise exception 'No se puede cambiar el vínculo con el saldo';
  end if;

  if actor is not null then
    if tg_op = 'INSERT' then
      new.created_by := actor;
      if actor is distinct from new.from_id and actor is distinct from new.to_id then
        raise exception 'La transferencia es entre vos y tu compañera';
      end if;
    elsif old.created_by is distinct from actor then
      raise exception 'Solo quien la cargó puede modificar la transferencia';
    end if;
  end if;

  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.from_id is distinct from old.from_id
    or new.to_id is distinct from old.to_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'No se puede cambiar de quién es la transferencia';
  end if;

  if not exists (
    select 1
    from public.profiles as sender
    join public.profiles as receiver
      on receiver.household_id = sender.household_id
     and sender.household_id is not null
    where sender.id = new.from_id
      and receiver.id = new.to_id
  ) then
    raise exception 'La transferencia es entre las dos del hogar';
  end if;

  new.updated_at := statement_timestamp();
  return new;
end;
$$;

revoke all on function private.guard_transfer() from public, anon, authenticated;

-- settle_shared_month con switch de transferencia (default prendido)
drop function if exists public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid);
drop function if exists public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid, boolean);

create function public.settle_shared_month(
  p_month date,
  p_debtor uuid,
  p_creditor uuid,
  p_amount numeric,
  p_expense_amount numeric,
  p_expense_debtor uuid,
  p_register_transfer boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  household uuid;
  partner uuid;
  month_start date := date_trunc('month', p_month)::date;
  expense_signed numeric(14, 2);
  net numeric(14, 2);
  settlement uuid;
  today_ar date := (timezone('America/Argentina/Buenos_Aires', now()))::date;
begin
  if actor is null then
    raise exception 'Tenés que entrar para saldar';
  end if;

  select profile.household_id
  into household
  from public.profiles as profile
  where profile.id = actor;

  if household is null then
    raise exception 'No estás en un hogar';
  end if;

  select other.id
  into partner
  from public.profiles as other
  where other.household_id = household
    and other.id <> actor
  limit 1;

  if partner is null then
    raise exception 'Falta tu compañera para saldar';
  end if;

  if p_debtor is distinct from actor and p_debtor is distinct from partner
    or p_creditor is distinct from actor and p_creditor is distinct from partner
    or p_debtor = p_creditor then
    raise exception 'El saldo es entre las dos del hogar';
  end if;

  if p_amount <= 0 or p_expense_amount < 0
    or p_amount <> round(p_amount, 2)
    or p_expense_amount <> round(p_expense_amount, 2) then
    raise exception 'El monto a saldar no cierra';
  end if;

  if exists (
    select 1
    from public.settlements as settlement_row
    where settlement_row.household_id = household
      and settlement_row.month = month_start
  ) then
    raise exception 'Ese mes ya está saldado';
  end if;

  if p_expense_amount = 0 then
    raise exception 'No hay nada para saldar este mes.';
  elsif p_expense_debtor is null
    or (p_expense_debtor is distinct from actor and p_expense_debtor is distinct from partner) then
    raise exception 'El reparto de gastos es entre las dos del hogar';
  elsif p_expense_debtor = p_creditor then
    expense_signed := -round(p_expense_amount, 2);
  else
    expense_signed := round(p_expense_amount, 2);
  end if;

  net := round(expense_signed, 2);
  if net <= 0
    or round(p_amount, 2) > net
    or p_debtor is distinct from (case when p_creditor = actor then partner else actor end) then
    raise exception 'El monto a saldar no cierra';
  end if;

  insert into public.settlements (
    household_id, month, debtor_id, creditor_id, amount, expected_amount, settled_by
  ) values (
    household, month_start, p_debtor, p_creditor, round(p_amount, 2), net, actor
  )
  returning id into settlement;

  if coalesce(p_register_transfer, true) then
    perform set_config('app.registering_settlement_transfer', '1', true);
    insert into public.transfers (
      from_id, to_id, amount, transferred_on, period, notes, created_by, settlement_id
    ) values (
      p_debtor,
      p_creditor,
      round(p_amount, 2),
      today_ar,
      month_start,
      'Saldo ' || to_char(month_start, 'YYYY-MM'),
      actor,
      settlement
    );
    perform set_config('app.registering_settlement_transfer', '', true);
  end if;

  return settlement;
end;
$$;

revoke all on function public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid, boolean)
  from public, anon;
grant execute on function public.settle_shared_month(date, uuid, uuid, numeric, numeric, uuid, boolean)
  to authenticated;

-- undo: borrar settlement (cascade borra la transferencia vinculada)
create or replace function public.undo_shared_month(p_settlement uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  household uuid;
  target uuid;
begin
  if actor is null then
    raise exception 'Tenés que entrar para deshacer';
  end if;

  select profile.household_id
  into household
  from public.profiles as profile
  where profile.id = actor;

  select settlement_row.household_id
  into target
  from public.settlements as settlement_row
  where settlement_row.id = p_settlement;

  if target is null or target is distinct from household then
    raise exception 'Ese saldo no es de tu hogar';
  end if;

  perform set_config('app.undoing_settlement', '1', true);
  delete from public.transfers
  where settlement_id = p_settlement;
  delete from public.settlements
  where id = p_settlement;
  perform set_config('app.undoing_settlement', '', true);
end;
$$;

revoke all on function public.undo_shared_month(uuid) from public, anon;
grant execute on function public.undo_shared_month(uuid) to authenticated;

-- delete_movements: excluir transferencias del saldo
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

  if exists (
    select 1
    from public.fixed_payments as fp
    where fp.expense_id = any (coalesce(expense_ids, '{}'::uuid[]))
  ) then
    raise exception 'Es el pago de un gasto fijo: se deshace en Avisos.';
  end if;

  if exists (
    select 1
    from public.saving_moves as sm
    join public.savings as s on s.id = sm.saving_id
    where sm.id = any (coalesce(saving_move_ids, '{}'::uuid[]))
      and s.archived_at is not null
  ) then
    raise exception 'El ahorro está archivado.';
  end if;

  if exists (
    select 1 from public.transfers as t
    where t.id = any (coalesce(transfer_ids, '{}'::uuid[]))
      and t.settlement_id is not null
  ) then
    raise exception 'Para cambiarla, deshacé el saldo';
  end if;

  if exists (
    select 1 from public.transfers as t
    where t.id = any (coalesce(transfer_ids, '{}'::uuid[]))
      and t.created_by is distinct from uid
  ) then
    raise exception 'Solo quien la cargó puede borrar la transferencia';
  end if;

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

  delete from public.income_extras as e
  where e.id = any (coalesce(extra_ids, '{}'::uuid[]))
    and e.user_id = uid;
  get diagnostics n = row_count;
  if n <> coalesce(cardinality(extra_ids), 0) then
    raise exception 'No pude eliminar un ingreso';
  end if;
  deleted := deleted + n;

  delete from public.transfers as t
  where t.id = any (coalesce(transfer_ids, '{}'::uuid[]))
    and t.created_by = uid
    and t.settlement_id is null;
  get diagnostics n = row_count;
  if n <> coalesce(cardinality(transfer_ids), 0) then
    raise exception 'No pude eliminar una transferencia';
  end if;
  deleted := deleted + n;

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
