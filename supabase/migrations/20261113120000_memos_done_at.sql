-- Guarda cuándo se tachó un memo (plantita de la semana).
-- Editar el texto de un memo hecho no tiene que volver a contarlo.

alter table public.memos
  add column done_at timestamptz;

comment on column public.memos.done_at is
  'Cuándo se tachó. Null si está pendiente. Lo maneja el disparador.';

update public.memos
set done_at = updated_at
where done
  and done_at is null;

create or replace function private.guard_memo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    if actor is not null and old.owner_id is distinct from actor then
      raise exception 'Solo quien lo escribió puede borrarlo';
    end if;
    return old;
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = new.owner_id
      and p.household_id = new.household_id
  ) then
    raise exception 'El memo tiene que ser del hogar de quien lo escribe';
  end if;

  if tg_op = 'INSERT' then
    if new.done then
      new.done_at := coalesce(new.done_at, new.created_at, statement_timestamp());
    else
      new.done_at := null;
    end if;
    new.updated_at := statement_timestamp();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.owner_id is distinct from old.owner_id
      or new.household_id is distinct from old.household_id
      or new.created_at is distinct from old.created_at then
      raise exception 'No se puede cambiar de quién es el memo';
    end if;

    if actor is not null and actor is distinct from old.owner_id then
      if not old.shared or old.household_id is distinct from (select private.my_household_id()) then
        raise exception 'No podés editar este memo';
      end if;
      if new.text is distinct from old.text or new.shared is distinct from old.shared then
        raise exception 'Solo podés marcarlo hecho';
      end if;
    end if;

    if new.done is distinct from old.done then
      if new.done then
        new.done_at := statement_timestamp();
      else
        new.done_at := null;
      end if;
    else
      new.done_at := old.done_at;
    end if;

    new.updated_at := statement_timestamp();
  end if;

  return new;
end;
$$;

revoke all on function private.guard_memo() from public, anon, authenticated;
