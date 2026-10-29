-- El permiso para anotar un gasto de la bolsa dura solo el insert.
-- Si quedara prendido, en la misma transacción se podría colar otro gusto.

create or replace function private.spend_from_gustos(
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

  perform set_config('app.bag_write', '', true);

  insert into public.bag_movements (user_id, kind, fund_id, expense_id, amount, label, happened_on)
  values (uid, 'gusto', null, expense, rounded, btrim(expense_title), spent_on);

  return expense;
end;
$$;

revoke all on function private.spend_from_gustos(text, uuid, numeric, date) from public, anon, authenticated;
grant execute on function private.spend_from_gustos(text, uuid, numeric, date) to authenticated;
