-- Etiquetas del hogar para memos (compartidas por las dos).
-- No cambia la tabla memos ni sus políticas.

create table public.memo_labels (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  constraint memo_labels_name_len check (char_length(name) between 1 and 24),
  constraint memo_labels_name_trim check (name = btrim(name)),
  constraint memo_labels_color_ok check (
    color in ('menta', 'agua', 'durazno', 'lila', 'avellana')
  )
);

create unique index memo_labels_household_name_ci
  on public.memo_labels (household_id, lower(name));

create index memo_labels_household_idx
  on public.memo_labels (household_id, created_at);

create table public.memo_label_links (
  memo_id uuid not null references public.memos (id) on delete cascade,
  label_id uuid not null references public.memo_labels (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (memo_id, label_id)
);

create index memo_label_links_label_idx
  on public.memo_label_links (label_id);

create function private.guard_memo_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  new.name := btrim(new.name);

  if char_length(new.name) < 1 or char_length(new.name) > 24 then
    raise exception 'El nombre de la etiqueta tiene que tener entre 1 y 24 caracteres';
  end if;

  if new.color not in ('menta', 'agua', 'durazno', 'lila', 'avellana') then
    raise exception 'Ese color de etiqueta no existe';
  end if;

  if actor is not null
    and new.household_id is distinct from (select private.my_household_id()) then
    raise exception 'La etiqueta tiene que ser de tu hogar';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
      or new.household_id is distinct from old.household_id
      or new.created_at is distinct from old.created_at then
      raise exception 'No se puede cambiar de qué hogar es la etiqueta';
    end if;
  end if;

  if exists (
    select 1
    from public.memo_labels as l
    where l.household_id = new.household_id
      and lower(l.name) = lower(new.name)
      and (tg_op = 'INSERT' or l.id is distinct from new.id)
  ) then
    raise exception 'Ya hay una etiqueta «%»', new.name;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_memo_label() from public, anon, authenticated;

create trigger memo_labels_guard
  before insert or update or delete on public.memo_labels
  for each row
  execute function private.guard_memo_label();

create function private.guard_memo_label_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  memo_home uuid;
  label_home uuid;
  link_count integer;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  select m.household_id into memo_home
  from public.memos as m
  where m.id = new.memo_id;

  if memo_home is null then
    raise exception 'Ese memo no existe';
  end if;

  select l.household_id into label_home
  from public.memo_labels as l
  where l.id = new.label_id;

  if label_home is null then
    raise exception 'Esa etiqueta no existe';
  end if;

  if memo_home is distinct from label_home then
    raise exception 'La etiqueta tiene que ser del mismo hogar que el memo';
  end if;

  select count(*)::integer into link_count
  from public.memo_label_links as link
  where link.memo_id = new.memo_id;

  if link_count >= 3 then
    raise exception 'Hasta 3 etiquetas por memo';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_memo_label_link() from public, anon, authenticated;

create trigger memo_label_links_guard
  before insert or update or delete on public.memo_label_links
  for each row
  execute function private.guard_memo_label_link();

alter table public.memo_labels enable row level security;
alter table public.memo_label_links enable row level security;

create policy memo_labels_select on public.memo_labels
for select to authenticated
using (household_id = (select private.my_household_id()));

create policy memo_labels_insert on public.memo_labels
for insert to authenticated
with check (household_id = (select private.my_household_id()));

create policy memo_labels_update on public.memo_labels
for update to authenticated
using (household_id = (select private.my_household_id()))
with check (household_id = (select private.my_household_id()));

create policy memo_labels_delete on public.memo_labels
for delete to authenticated
using (household_id = (select private.my_household_id()));

create policy memo_label_links_select on public.memo_label_links
for select to authenticated
using (
  exists (
    select 1
    from public.memos as m
    where m.id = memo_id
      and (
        m.owner_id = (select auth.uid())
        or (
          m.shared
          and m.household_id = (select private.my_household_id())
        )
      )
  )
);

create policy memo_label_links_insert on public.memo_label_links
for insert to authenticated
with check (
  exists (
    select 1
    from public.memos as m
    where m.id = memo_id
      and (
        m.owner_id = (select auth.uid())
        or (
          m.shared
          and m.household_id = (select private.my_household_id())
        )
      )
  )
  and exists (
    select 1
    from public.memo_labels as l
    where l.id = label_id
      and l.household_id = (select private.my_household_id())
  )
);

create policy memo_label_links_delete on public.memo_label_links
for delete to authenticated
using (
  exists (
    select 1
    from public.memos as m
    where m.id = memo_id
      and (
        m.owner_id = (select auth.uid())
        or (
          m.shared
          and m.household_id = (select private.my_household_id())
        )
      )
  )
);

revoke all on table public.memo_labels from public, anon;
revoke all on table public.memo_label_links from public, anon;
grant select, insert, update, delete on public.memo_labels to authenticated;
grant select, insert, delete on public.memo_label_links to authenticated;
