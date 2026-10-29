-- Guarda un nombre de ícono de Font Awesome en categorías, fondos, metas y avisos.
-- La columna emoji queda para no romper filas viejas; la app lee y escribe icon.

alter table public.categories
  add column icon text not null default 'tag';

alter table public.savings_funds
  add column icon text not null default 'tag';

alter table public.shared_goals
  add column icon text not null default 'tag';

alter table public.fixed_expenses
  add column icon text not null default 'tag';

update public.categories
set icon = case emoji
  when '🛒' then 'cart-shopping'
  when '🍕' then 'pizza-slice'
  when '🚌' then 'bus'
  when '💡' then 'lightbulb'
  when '🎉' then 'champagne-glasses'
  when '🏠' then 'house'
  when '👗' then 'shirt'
  when '☕' then 'mug-hot'
  when '✈️' then 'plane'
  when '🛋️' then 'couch'
  when '💻' then 'laptop'
  when '🏖️' then 'umbrella-beach'
  when '🔥' then 'fire'
  when '📶' then 'wifi'
  when '🩺' then 'stethoscope'
  when '✨' then 'star'
  when '🐷' then 'piggy-bank'
  when '🛍️' then 'bag-shopping'
  when '📚' then 'book'
  when '🏢' then 'building'
  else 'tag'
end;

update public.savings_funds
set icon = case emoji
  when '🛒' then 'cart-shopping'
  when '🍕' then 'pizza-slice'
  when '🚌' then 'bus'
  when '💡' then 'lightbulb'
  when '🎉' then 'champagne-glasses'
  when '🏠' then 'house'
  when '👗' then 'shirt'
  when '☕' then 'mug-hot'
  when '✈️' then 'plane'
  when '🛋️' then 'couch'
  when '💻' then 'laptop'
  when '🏖️' then 'umbrella-beach'
  when '🔥' then 'fire'
  when '📶' then 'wifi'
  when '🩺' then 'stethoscope'
  when '✨' then 'star'
  when '🐷' then 'piggy-bank'
  when '🛍️' then 'bag-shopping'
  when '📚' then 'book'
  when '🏢' then 'building'
  else 'tag'
end;

update public.shared_goals
set icon = case emoji
  when '🛒' then 'cart-shopping'
  when '🍕' then 'pizza-slice'
  when '🚌' then 'bus'
  when '💡' then 'lightbulb'
  when '🎉' then 'champagne-glasses'
  when '🏠' then 'house'
  when '👗' then 'shirt'
  when '☕' then 'mug-hot'
  when '✈️' then 'plane'
  when '🛋️' then 'couch'
  when '💻' then 'laptop'
  when '🏖️' then 'umbrella-beach'
  when '🔥' then 'fire'
  when '📶' then 'wifi'
  when '🩺' then 'stethoscope'
  when '✨' then 'star'
  when '🐷' then 'piggy-bank'
  when '🛍️' then 'bag-shopping'
  when '📚' then 'book'
  when '🏢' then 'building'
  else 'tag'
end;

update public.fixed_expenses
set icon = case emoji
  when '🛒' then 'cart-shopping'
  when '🍕' then 'pizza-slice'
  when '🚌' then 'bus'
  when '💡' then 'lightbulb'
  when '🎉' then 'champagne-glasses'
  when '🏠' then 'house'
  when '👗' then 'shirt'
  when '☕' then 'mug-hot'
  when '✈️' then 'plane'
  when '🛋️' then 'couch'
  when '💻' then 'laptop'
  when '🏖️' then 'umbrella-beach'
  when '🔥' then 'fire'
  when '📶' then 'wifi'
  when '🩺' then 'stethoscope'
  when '✨' then 'star'
  when '🐷' then 'piggy-bank'
  when '🛍️' then 'bag-shopping'
  when '📚' then 'book'
  when '🏢' then 'building'
  else 'tag'
end;

alter table public.categories
  add constraint categories_icon_len check (char_length(btrim(icon)) > 0);

alter table public.savings_funds
  add constraint savings_funds_icon_len check (char_length(btrim(icon)) > 0);

alter table public.shared_goals
  add constraint shared_goals_icon_len check (char_length(btrim(icon)) > 0);

alter table public.fixed_expenses
  add constraint fixed_expenses_icon_len check (char_length(btrim(icon)) > 0);

create or replace function private.create_household()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  hid uuid;
  code text;
  linked integer;
begin
  uid := private.ensure_profile();

  select p.household_id
  into hid
  from public.profiles as p
  where p.id = uid
  for update;

  if hid is not null then
    return hid;
  end if;

  select h.id
  into hid
  from public.households as h
  where h.created_by = uid
  order by h.created_at, h.id
  limit 1
  for update;

  if hid is null then
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    insert into public.households (invite_code, created_by)
    values (code, uid)
    returning id into hid;
  end if;

  if not exists (
    select 1
    from public.categories as c
    where c.household_id = hid
      and c.owner_id is null
  ) then
    insert into public.categories (household_id, owner_id, name, emoji, icon)
    values
      (hid, null, 'Súper', '🛒', 'cart-shopping'),
      (hid, null, 'Comida', '🍕', 'pizza-slice'),
      (hid, null, 'Viajes', '🚌', 'bus'),
      (hid, null, 'Servicios', '💡', 'lightbulb'),
      (hid, null, 'Salidas', '🎉', 'champagne-glasses'),
      (hid, null, 'Hogar', '🏠', 'house');
  end if;

  update public.profiles
  set household_id = hid
  where id = uid
    and household_id is null;

  get diagnostics linked = row_count;

  if linked <> 1 then
    raise exception 'No se pudo vincular el hogar al perfil';
  end if;

  return hid;
end;
$$;
