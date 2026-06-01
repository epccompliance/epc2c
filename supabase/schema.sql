-- ════════════════════════════════════════════════════════════════════════════
-- EPC2C — Supabase schema (SOURCE OF TRUTH, mirrors the LIVE database)
--
-- These tables and policies ALREADY EXIST in the project. This file documents
-- the current state for the repo and is SAFE TO RE-RUN: every statement is
-- idempotent and creates nothing new (CREATE ... IF NOT EXISTS is a no-op on the
-- existing tables; the policy DROP/CREATE re-asserts the identical rules).
--
-- Ownership model:
--   profiles    : one row per auth user (id = auth.users.id)
--   properties  : owned directly via user_id
--   reports     : owned INDIRECTLY via property_id -> properties.user_id
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- properties  (the user's saved property searches)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.properties (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  address       text,
  postcode      text,
  uprn          text,
  epc_rrn       text,             -- EPC report reference number
  epc_data_json jsonb,            -- full property row from the EPC API
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- reports  (a generated compliance report; ownership flows through property)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id                     uuid primary key default gen_random_uuid(),
  property_id            uuid references public.properties(id) on delete cascade,
  selected_measures_json jsonb,
  pathway_results_json   jsonb,
  exemption_results_json jsonb,
  payment_status         text default 'unpaid',
  pdf_url                text,
  created_at             timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (already enabled + policies in place — re-asserted here)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.properties enable row level security;
alter table public.reports    enable row level security;

-- profiles: read/update own
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update using ((select auth.uid()) = id);

-- properties: manage own (select/insert/update/delete)
drop policy if exists "Users manage own properties" on public.properties;
create policy "Users manage own properties" on public.properties
  for all using ((select auth.uid()) = user_id)
          with check ((select auth.uid()) = user_id);

-- reports: manage own, ownership derived through the parent property
drop policy if exists "Users manage own reports" on public.reports;
create policy "Users manage own reports" on public.reports
  for all using (exists (select 1 from public.properties p
                         where p.id = reports.property_id
                           and p.user_id = (select auth.uid())))
          with check (exists (select 1 from public.properties p
                              where p.id = reports.property_id
                                and p.user_id = (select auth.uid())));

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-create a profile row when a user signs up, so profiles stays in sync with
-- auth.users without needing a client-side INSERT (profiles has no INSERT policy).
-- Runs as SECURITY DEFINER so it bypasses RLS. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
