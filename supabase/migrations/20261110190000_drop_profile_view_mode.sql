-- El modo Contable/Amigable ya no existe en la app.
-- Ninguna función/RPC/policy/trigger referencia profiles.view_mode;
-- el check profiles_view_mode cae con la columna.

alter table public.profiles
  drop column if exists view_mode;
