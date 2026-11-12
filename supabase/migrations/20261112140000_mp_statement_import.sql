-- Importar resumen Mercado Pago: IDs, alias, preferencias de comercio y RPC.

alter table public.expenses
  add column if not exists mp_operation_id text;

alter table public.income_extras
  add column if not exists mp_operation_id text;

alter table public.transfers
  add column if not exists mp_operation_id text;

alter table public.fixed_expenses
  add column if not exists mp_source text;

alter table public.fixed_expenses
  drop constraint if exists fixed_expenses_mp_source_check;

alter table public.fixed_expenses
  add constraint fixed_expenses_mp_source_check
  check (mp_source is null or mp_source = 'credito_mp');

create unique index if not exists expenses_owner_mp_operation_uidx
  on public.expenses (owner_id, mp_operation_id)
  where mp_operation_id is not null;

create unique index if not exists income_extras_user_mp_operation_uidx
  on public.income_extras (user_id, mp_operation_id)
  where mp_operation_id is not null;

create unique index if not exists transfers_created_by_mp_operation_uidx
  on public.transfers (created_by, mp_operation_id)
  where mp_operation_id is not null;

create unique index if not exists fixed_expenses_owner_mp_source_uidx
  on public.fixed_expenses (owner_id)
  where mp_source is not null;

create table if not exists public.mp_counterpart_aliases (
  owner_id uuid not null references auth.users (id) on delete cascade,
  normalized_name text not null,
  -- null = "no es la compañera" (P9); no null = alias de la compañera.
  user_id uuid references auth.users (id) on delete cascade,
  primary key (owner_id, normalized_name),
  constraint mp_counterpart_aliases_name_len check (char_length(btrim(normalized_name)) > 0)
);

create table if not exists public.mp_merchant_prefs (
  owner_id uuid not null references auth.users (id) on delete cascade,
  merchant_key text not null,
  category_id uuid references public.categories (id) on delete set null,
  is_shared boolean not null default true,
  title text,
  primary key (owner_id, merchant_key),
  constraint mp_merchant_prefs_key_len check (char_length(btrim(merchant_key)) > 0)
);

alter table public.mp_counterpart_aliases enable row level security;
alter table public.mp_merchant_prefs enable row level security;

drop policy if exists mp_counterpart_aliases_all on public.mp_counterpart_aliases;
create policy mp_counterpart_aliases_all on public.mp_counterpart_aliases
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists mp_merchant_prefs_all on public.mp_merchant_prefs;
create policy mp_merchant_prefs_all on public.mp_merchant_prefs
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

revoke all on table public.mp_counterpart_aliases from public, anon;
revoke all on table public.mp_merchant_prefs from public, anon;
grant select, insert, update, delete on table public.mp_counterpart_aliases to authenticated;
grant select, insert, update, delete on table public.mp_merchant_prefs to authenticated;

create or replace function public.import_mp_movements(
  rows jsonb,
  aliases jsonb default '[]'::jsonb,
  merchant_prefs jsonb default '[]'::jsonb,
  create_credito_mp boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  partner uuid;
  inserted integer := 0;
  skipped integer := 0;
  item jsonb;
  row_type text;
  spent date;
  amount numeric;
  title text;
  category uuid;
  shared boolean;
  op_id text;
  direction text;
  new_id uuid;
  credito_id uuid;
  first_debit date;
  month_start date;
  month_sum numeric;
  first_expense uuid;
  paid_exists boolean;
  alias_item jsonb;
  pref_item jsonb;
begin
  if uid is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  hid := private.my_household_id();
  if hid is null then
    raise exception 'No estás en un hogar';
  end if;

  select p.id into partner
  from public.profiles as p
  where p.household_id = hid
    and p.id is distinct from uid
  limit 1;

  for alias_item in
    select * from jsonb_array_elements(coalesce(aliases, '[]'::jsonb))
  loop
    insert into public.mp_counterpart_aliases (owner_id, normalized_name, user_id)
    values (
      uid,
      lower(btrim(alias_item ->> 'normalized_name')),
      nullif(alias_item ->> 'user_id', '')::uuid
    )
    on conflict (owner_id, normalized_name) do update
      set user_id = excluded.user_id;
  end loop;

  -- Al setear (o limpiar) quién es la compañera, queda un solo nombre con user_id no nulo.
  if jsonb_array_length(coalesce(aliases, '[]'::jsonb)) > 0 then
    delete from public.mp_counterpart_aliases as a
    where a.owner_id = uid
      and a.user_id is not null
      and a.normalized_name not in (
        select lower(btrim(alias_row ->> 'normalized_name'))
        from jsonb_array_elements(coalesce(aliases, '[]'::jsonb)) as alias_row
        where nullif(alias_row ->> 'user_id', '') is not null
      );
  end if;

  for pref_item in
    select * from jsonb_array_elements(coalesce(merchant_prefs, '[]'::jsonb))
  loop
    insert into public.mp_merchant_prefs (owner_id, merchant_key, category_id, is_shared, title)
    values (
      uid,
      lower(btrim(pref_item ->> 'merchant_key')),
      nullif(pref_item ->> 'category_id', '')::uuid,
      coalesce((pref_item ->> 'is_shared')::boolean, true),
      nullif(btrim(pref_item ->> 'title'), '')
    )
    on conflict (owner_id, merchant_key) do update
      set category_id = excluded.category_id,
          is_shared = excluded.is_shared,
          title = excluded.title;
  end loop;

  select fe.id into credito_id
  from public.fixed_expenses as fe
  where fe.owner_id = uid
    and fe.mp_source = 'credito_mp'
  limit 1;

  if create_credito_mp and credito_id is null then
    select min((row_item ->> 'date')::date)
    into first_debit
    from jsonb_array_elements(coalesce(rows, '[]'::jsonb)) as row_item
    where row_item ->> 'type' = 'credito_mp';

    if first_debit is not null then
      insert into public.fixed_expenses (
        household_id, owner_id, category_id, title, emoji, icon,
        expected_amount, due_day, is_shared, mp_source
      ) values (
        hid,
        uid,
        null,
        'Créditos MP',
        '',
        'receipt',
        1,
        least(28, greatest(1, extract(day from first_debit)::integer)),
        false,
        'credito_mp'
      )
      returning id into credito_id;
    end if;
  end if;

  for item in
    select * from jsonb_array_elements(coalesce(rows, '[]'::jsonb))
  loop
    new_id := null;
    row_type := item ->> 'type';
    spent := (item ->> 'date')::date;
    amount := (item ->> 'amount')::numeric;
    title := nullif(btrim(item ->> 'title'), '');
    category := nullif(item ->> 'category_id', '')::uuid;
    shared := coalesce((item ->> 'is_shared')::boolean, false);
    op_id := nullif(btrim(item ->> 'mp_operation_id'), '');
    direction := item ->> 'transfer_direction';

    if amount is null or amount <= 0 or spent is null or op_id is null then
      raise exception 'Fila de importación incompleta';
    end if;

    if row_type = 'expense' or row_type = 'credito_mp' then
      insert into public.expenses (
        household_id, owner_id, payer_id, category_id, title, amount, spent_on, is_shared, mp_operation_id
      ) values (
        hid, uid, uid, category, title, amount, spent,
        case when row_type = 'credito_mp' then false else coalesce(shared, false) end,
        op_id
      )
      on conflict (owner_id, mp_operation_id) where (mp_operation_id is not null) do nothing
      returning id into new_id;

      if new_id is null then
        skipped := skipped + 1;
      else
        inserted := inserted + 1;
      end if;

    elsif row_type = 'income' then
      insert into public.income_extras (
        user_id, household_id, amount, label, received_on, mp_operation_id
      ) values (
        uid, hid, amount, coalesce(title, 'Ingreso'), spent, op_id
      )
      on conflict (user_id, mp_operation_id) where (mp_operation_id is not null) do nothing
      returning id into new_id;

      if new_id is null then
        skipped := skipped + 1;
      else
        inserted := inserted + 1;
      end if;

    elsif row_type = 'transfer' then
      if partner is null then
        raise exception 'Para importar transferencias, primero sumá a tu compañera';
      end if;
      if direction is distinct from 'sent' and direction is distinct from 'received' then
        raise exception 'La transferencia necesita dirección';
      end if;

      insert into public.transfers (
        from_id, to_id, amount, transferred_on, notes, mp_operation_id
      ) values (
        case when direction = 'sent' then uid else partner end,
        case when direction = 'sent' then partner else uid end,
        amount,
        spent,
        null,
        op_id
      )
      on conflict (created_by, mp_operation_id) where (mp_operation_id is not null) do nothing
      returning id into new_id;

      if new_id is null then
        skipped := skipped + 1;
      else
        inserted := inserted + 1;
      end if;
    else
      raise exception 'Tipo de fila no soportado: %', row_type;
    end if;
  end loop;

  -- Aviso Créditos MP: un fixed_payments por mes con la suma, si el mes no estaba pagado.
  if credito_id is not null then
    for month_start, month_sum, first_expense in
      select
        date_trunc('month', e.spent_on)::date,
        sum(e.amount),
        (array_agg(e.id order by e.spent_on, e.created_at))[1]
      from public.expenses as e
      where e.owner_id = uid
        and e.mp_operation_id in (
          select nullif(btrim(row_item ->> 'mp_operation_id'), '')
          from jsonb_array_elements(coalesce(rows, '[]'::jsonb)) as row_item
          where row_item ->> 'type' = 'credito_mp'
        )
      group by date_trunc('month', e.spent_on)::date
    loop
      select exists (
        select 1 from public.fixed_payments as fp
        where fp.fixed_expense_id = credito_id and fp.month = month_start
      ) into paid_exists;

      if not paid_exists then
        insert into public.fixed_payments (
          fixed_expense_id, month, paid_on, payer_id, amount, expense_id
        )
        select
          credito_id,
          month_start,
          min(e.spent_on),
          uid,
          month_sum,
          first_expense
        from public.expenses as e
        where e.id = first_expense;
      end if;

      update public.fixed_expenses
      set expected_amount = greatest(expected_amount, month_sum)
      where id = credito_id;
    end loop;
  end if;

  return jsonb_build_object('inserted', inserted, 'skipped', skipped);
end;
$$;

revoke all on function public.import_mp_movements(jsonb, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.import_mp_movements(jsonb, jsonb, jsonb, boolean) to authenticated;
