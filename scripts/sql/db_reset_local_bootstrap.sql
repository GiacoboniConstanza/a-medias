-- Bootstrap LOCAL para simular `supabase db reset` + seeds + pg_prove.
-- Destino: socket local user=postgres. No es Production (qjjdcauwovbdlacuslgt).
-- Solo roles/auth/extensiones: las tablas public las crean las migraciones.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end$$;

grant usage on schema public to anon, authenticated, service_role;
grant authenticated to postgres;
grant service_role to postgres;

create schema if not exists auth;
create schema if not exists private;
create schema if not exists extensions;

create extension if not exists pgcrypto with schema extensions;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to postgres, anon, authenticated, service_role;
grant execute on function auth.uid() to postgres, anon, authenticated, service_role;

-- auth.users compatible con el insert de supabase/seed.sql
create table if not exists auth.users (
  instance_id uuid null,
  id uuid primary key,
  aud varchar(255) null,
  role varchar(255) null,
  email text null,
  encrypted_password varchar(255) null,
  email_confirmed_at timestamptz null,
  invited_at timestamptz null,
  confirmation_token varchar(255) null,
  confirmation_sent_at timestamptz null,
  recovery_token varchar(255) null,
  recovery_sent_at timestamptz null,
  email_change_token_new varchar(255) null,
  email_change varchar(255) null,
  email_change_sent_at timestamptz null,
  last_sign_in_at timestamptz null,
  raw_app_meta_data jsonb null,
  raw_user_meta_data jsonb null,
  is_super_admin boolean null,
  created_at timestamptz null,
  updated_at timestamptz null,
  phone text null,
  phone_confirmed_at timestamptz null,
  phone_change text null,
  phone_change_token varchar(255) null,
  phone_change_sent_at timestamptz null,
  email_change_token_current varchar(255) null,
  email_change_confirm_status smallint null,
  banned_until timestamptz null,
  reauthentication_token varchar(255) null,
  reauthentication_sent_at timestamptz null,
  is_sso_user boolean not null default false,
  deleted_at timestamptz null,
  is_anonymous boolean not null default false
);

-- auth.identities compatible con el insert de supabase/seed.sql
create table if not exists auth.identities (
  provider_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  identity_data jsonb not null,
  provider text not null,
  last_sign_in_at timestamptz null,
  created_at timestamptz null,
  updated_at timestamptz null,
  email text generated always as (lower((identity_data ->> 'email'))) stored,
  id uuid primary key default gen_random_uuid(),
  unique (provider_id, provider)
);
