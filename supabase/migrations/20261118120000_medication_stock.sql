-- Medicamentos: stock (cantidad, unidades por toma, movimientos) y RPCs transaccionales.
-- Rango reservado 20261118120000–20261118120500. No toca Production.

-- 1) Columnas en medications
alter table public.medications
  add column if not exists stock_qty integer,
  add column if not exists units_per_dose integer not null default 1;

alter table public.medications
  drop constraint if exists medications_stock_qty_range;

alter table public.medications
  add constraint medications_stock_qty_range
  check (stock_qty is null or (stock_qty >= 0 and stock_qty <= 9999));

alter table public.medications
  drop constraint if exists medications_units_per_dose_range;

alter table public.medications
  add constraint medications_units_per_dose_range
  check (units_per_dose >= 1 and units_per_dose <= 10);

-- 2) Unidades descontadas por toma (0 si salteada o stock en 0 / sin registrar)
alter table public.medication_doses
  add column if not exists units_deducted integer not null default 0;

alter table public.medication_doses
  drop constraint if exists medication_doses_units_deducted_range;

alter table public.medication_doses
  add constraint medication_doses_units_deducted_range
  check (units_deducted >= 0 and units_deducted <= 10);

-- 3) Movimientos de stock (historial; sin borrado desde la app)
create table if not exists public.medication_stock_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete restrict,
  kind text not null,
  delta integer,
  stock_before integer,
  stock_after integer,
  dose_id uuid references public.medication_doses (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint medication_stock_moves_kind check (
    kind in ('sumar', 'ajustar', 'dejar_de_registrar', 'toma', 'desmarcar')
  )
);

create index if not exists medication_stock_moves_med_idx
  on public.medication_stock_moves (medication_id, created_at desc);

create index if not exists medication_stock_moves_user_idx
  on public.medication_stock_moves (user_id, created_at desc);

create trigger medication_stock_moves_guard
  before insert or update or delete on public.medication_stock_moves
  for each row
  execute function private.guard_medication_child();

alter table public.medication_stock_moves enable row level security;

create policy medication_stock_moves_select on public.medication_stock_moves
for select to authenticated
using (user_id = (select auth.uid()));

create policy medication_stock_moves_insert on public.medication_stock_moves
for insert to authenticated
with check (user_id = (select auth.uid()));

-- Sin update/delete para authenticated: historial inmutable desde la app.
revoke all on table public.medication_stock_moves from public, anon;
grant select, insert on table public.medication_stock_moves to authenticated;
grant select, insert, update, delete on table public.medication_stock_moves to service_role;

-- 4) Limpia avisos de poco stock al reponer (tabla creada en 20100; función acá se redefine allá).
-- Helper interno: devolver unidades a stock (piso null = sin registrar).
create or replace function private.medication_return_units(
  p_medication_id uuid,
  p_units integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_qty integer;
begin
  if p_units is null or p_units <= 0 then
    select stock_qty into current_qty from public.medications where id = p_medication_id;
    return current_qty;
  end if;

  update public.medications
  set stock_qty = case
      when stock_qty is null then null
      else least(9999, stock_qty + p_units)
    end,
    updated_at = statement_timestamp()
  where id = p_medication_id
  returning stock_qty into current_qty;

  return current_qty;
end;
$$;

revoke all on function private.medication_return_units(uuid, integer) from public, anon, authenticated;

-- Descuenta unidades (nunca bajo 0); devuelve cuánto descontó realmente.
create or replace function private.medication_deduct_units(
  p_medication_id uuid,
  p_want integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_qty integer;
  deducted integer;
begin
  select stock_qty into current_qty
  from public.medications
  where id = p_medication_id
  for update;

  if current_qty is null or p_want is null or p_want <= 0 then
    return 0;
  end if;

  deducted := least(current_qty, p_want);

  update public.medications
  set stock_qty = current_qty - deducted,
      updated_at = statement_timestamp()
  where id = p_medication_id;

  return deducted;
end;
$$;

revoke all on function private.medication_deduct_units(uuid, integer) from public, anon, authenticated;

-- 5) Marcar / cambiar / desmarcar toma + stock en una sola transacción
create or replace function public.set_medication_dose_with_stock(
  p_medication_id uuid,
  p_dose_on date,
  p_scheduled_time time,
  p_status text,
  p_name_snapshot text,
  p_dose_snapshot text default null
)
returns table (
  dose_id uuid,
  medication_id uuid,
  dose_on date,
  scheduled_time time,
  status text,
  recorded_at timestamptz,
  name_snapshot text,
  dose_snapshot text,
  units_deducted integer,
  stock_qty integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  med public.medications%rowtype;
  existing public.medication_doses%rowtype;
  new_deducted integer := 0;
  returned_units integer := 0;
  v_stock_before integer;
  v_stock_after integer;
  dose_row public.medication_doses%rowtype;
  move_kind text;
begin
  if actor is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  if p_status is not null and p_status not in ('taken', 'skipped') then
    raise exception 'Estado de toma inválido';
  end if;

  select * into med
  from public.medications as m
  where m.id = p_medication_id
  for update;

  if med.id is null then
    raise exception 'Ese medicamento no existe';
  end if;

  if med.user_id is distinct from actor then
    raise exception 'Ese medicamento no es tuyo';
  end if;

  select * into existing
  from public.medication_doses as d
  where d.medication_id = p_medication_id
    and d.dose_on = p_dose_on
    and d.scheduled_time = p_scheduled_time
  for update;

  v_stock_before := med.stock_qty;

  -- Desmarcar: borrar fila y devolver lo descontado
  if p_status is null then
    if existing.id is null then
      return query
      select
        null::uuid,
        p_medication_id,
        p_dose_on,
        p_scheduled_time,
        null::text,
        null::timestamptz,
        null::text,
        null::text,
        0,
        med.stock_qty;
      return;
    end if;

    if existing.units_deducted > 0 and med.stock_qty is not null then
      v_stock_after := private.medication_return_units(med.id, existing.units_deducted);
      insert into public.medication_stock_moves (
        user_id, medication_id, kind, delta, stock_before, stock_after, dose_id
      ) values (
        actor, med.id, 'desmarcar', existing.units_deducted, v_stock_before, v_stock_after, existing.id
      );
    else
      v_stock_after := med.stock_qty;
    end if;

    delete from public.medication_doses where id = existing.id;

    return query
    select
      null::uuid,
      p_medication_id,
      p_dose_on,
      p_scheduled_time,
      null::text,
      null::timestamptz,
      null::text,
      null::text,
      0,
      v_stock_after;
    return;
  end if;

  -- Si ya estaba tomada, devolver primero lo que había descontado
  if existing.id is not null and existing.units_deducted > 0 and med.stock_qty is not null then
    perform private.medication_return_units(med.id, existing.units_deducted);
    returned_units := existing.units_deducted;
    select m.stock_qty into v_stock_before from public.medications as m where m.id = med.id;
  end if;

  if p_status = 'taken' then
    new_deducted := private.medication_deduct_units(med.id, med.units_per_dose);
  else
    new_deducted := 0;
  end if;

  select m.stock_qty into v_stock_after from public.medications as m where m.id = med.id;

  if existing.id is null then
    insert into public.medication_doses (
      medication_id, user_id, dose_on, scheduled_time, status,
      recorded_at, name_snapshot, dose_snapshot, units_deducted
    ) values (
      p_medication_id, actor, p_dose_on, p_scheduled_time, p_status,
      statement_timestamp(), p_name_snapshot, p_dose_snapshot, new_deducted
    )
    returning * into dose_row;
  else
    update public.medication_doses
    set status = p_status,
        recorded_at = statement_timestamp(),
        name_snapshot = p_name_snapshot,
        dose_snapshot = p_dose_snapshot,
        units_deducted = new_deducted
    where id = existing.id
    returning * into dose_row;
  end if;

  if new_deducted > 0 then
    move_kind := 'toma';
    insert into public.medication_stock_moves (
      user_id, medication_id, kind, delta, stock_before, stock_after, dose_id
    ) values (
      actor, med.id, move_kind, -new_deducted,
      coalesce(v_stock_before, med.stock_qty), v_stock_after, dose_row.id
    );
  elsif returned_units > 0 and p_status = 'skipped' then
    insert into public.medication_stock_moves (
      user_id, medication_id, kind, delta, stock_before, stock_after, dose_id
    ) values (
      actor, med.id, 'desmarcar', returned_units,
      v_stock_before - returned_units, v_stock_after, dose_row.id
    );
  end if;

  return query
  select
    dose_row.id,
    dose_row.medication_id,
    dose_row.dose_on,
    dose_row.scheduled_time,
    dose_row.status,
    dose_row.recorded_at,
    dose_row.name_snapshot,
    dose_row.dose_snapshot,
    dose_row.units_deducted,
    v_stock_after;
end;
$$;

revoke all on function public.set_medication_dose_with_stock(uuid, date, time, text, text, text)
  from public, anon;
grant execute on function public.set_medication_dose_with_stock(uuid, date, time, text, text, text)
  to authenticated;

-- 6) Sumar unidades
create or replace function public.add_medication_stock(
  p_medication_id uuid,
  p_units integer
)
returns table (
  medication_id uuid,
  stock_qty integer,
  move_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  med public.medications%rowtype;
  before_qty integer;
  after_qty integer;
  new_move_id uuid;
begin
  if actor is null then
    raise exception 'Tenés que iniciar sesión';
  end if;
  if p_units is null or p_units <= 0 then
    raise exception 'Poné cuántas sumás.';
  end if;

  select * into med from public.medications where id = p_medication_id for update;
  if med.id is null then
    raise exception 'Ese medicamento no existe';
  end if;
  if med.user_id is distinct from actor then
    raise exception 'Ese medicamento no es tuyo';
  end if;
  if med.stock_qty is null then
    raise exception 'No hay stock registrado. Usá ajustar.';
  end if;

  before_qty := med.stock_qty;
  after_qty := before_qty + p_units;
  if after_qty > 9999 then
    raise exception 'Hasta 9999 unidades.';
  end if;

  update public.medications
  set stock_qty = after_qty, updated_at = statement_timestamp()
  where id = med.id;

  insert into public.medication_stock_moves (
    user_id, medication_id, kind, delta, stock_before, stock_after
  ) values (
    actor, med.id, 'sumar', p_units, before_qty, after_qty
  )
  returning id into new_move_id;

  -- La limpieza de avisos de poco stock se suma en 20261118120100.

  return query select med.id, after_qty, new_move_id;
end;
$$;

revoke all on function public.add_medication_stock(uuid, integer) from public, anon;
grant execute on function public.add_medication_stock(uuid, integer) to authenticated;

-- 7) Ajustar (o dejar de registrar si p_units is null)
create or replace function public.adjust_medication_stock(
  p_medication_id uuid,
  p_units integer
)
returns table (
  medication_id uuid,
  stock_qty integer,
  move_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  med public.medications%rowtype;
  before_qty integer;
  after_qty integer;
  new_move_id uuid;
  move_kind text;
  delta_val integer;
begin
  if actor is null then
    raise exception 'Tenés que iniciar sesión';
  end if;

  select * into med from public.medications where id = p_medication_id for update;
  if med.id is null then
    raise exception 'Ese medicamento no existe';
  end if;
  if med.user_id is distinct from actor then
    raise exception 'Ese medicamento no es tuyo';
  end if;

  before_qty := med.stock_qty;

  if p_units is null then
    if before_qty is null then
      return query select med.id, null::integer, null::uuid;
      return;
    end if;
    move_kind := 'dejar_de_registrar';
    after_qty := null;
    delta_val := null;
  else
    if p_units < 0 or p_units > 9999 then
      raise exception 'Hasta 9999 unidades.';
    end if;
    if before_qty is not null and before_qty = p_units then
      raise exception 'El stock ya es ese número.';
    end if;
    move_kind := 'ajustar';
    after_qty := p_units;
    delta_val := case when before_qty is null then p_units else p_units - before_qty end;
  end if;

  update public.medications
  set stock_qty = after_qty, updated_at = statement_timestamp()
  where id = med.id;

  insert into public.medication_stock_moves (
    user_id, medication_id, kind, delta, stock_before, stock_after
  ) values (
    actor, med.id, move_kind, delta_val, before_qty, after_qty
  )
  returning id into new_move_id;

  -- La limpieza de avisos de poco stock se suma en 20261118120100.

  return query select med.id, after_qty, new_move_id;
end;
$$;

revoke all on function public.adjust_medication_stock(uuid, integer) from public, anon;
grant execute on function public.adjust_medication_stock(uuid, integer) to authenticated;
