-- Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  email text,
  role text not null default 'FREE' check (role in ('FREE','SUPER_ADMIN')),
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE','SUSPENDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('FREE','PREMIUM')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  note text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED','EXPIRED')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_active_idx
  on public.subscriptions(user_id, status, ends_at);

create table if not exists public.membership_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  plan text,
  starts_at timestamptz,
  ends_at timestamptz,
  note text,
  performed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  target_user_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.usage_limits (
  plan text primary key check (plan in ('FREE','PREMIUM')),
  daily_ai_requests integer not null default 20 check (daily_ai_requests >= 0),
  updated_at timestamptz not null default now()
);
insert into public.usage_limits(plan, daily_ai_requests)
values ('FREE', 20), ('PREMIUM', 500)
on conflict (plan) do nothing;

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.system_settings(key,value) values
 ('site_name','"VEX AI"'::jsonb),
 ('site_description','"Your AI workspace."'::jsonb),
 ('maintenance_mode','false'::jsonb),
 ('registration_enabled','true'::jsonb)
on conflict (key) do nothing;

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null default 'chat',
  request_count integer not null default 1,
  tokens_used integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_created_idx on public.ai_usage(created_at);

-- New accounts always receive a FREE profile. Never trust client-supplied role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, username, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
          new.email, 'FREE')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.membership_history enable row level security;
alter table public.admin_logs enable row level security;
alter table public.usage_limits enable row level security;
alter table public.system_settings enable row level security;
alter table public.ai_usage enable row level security;

-- Users may read only their own profile and membership/usage data.
drop policy if exists "profile read own" on public.profiles;
create policy "profile read own" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "subscription read own" on public.subscriptions;
create policy "subscription read own" on public.subscriptions
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "history read own" on public.membership_history;
create policy "history read own" on public.membership_history
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "usage read own" on public.ai_usage;
create policy "usage read own" on public.ai_usage
for select to authenticated using (auth.uid() = user_id);

-- No authenticated write policies on protected tables. All admin writes go through
-- server endpoints using the Service Role key, which is never sent to the browser.
-- Usage limits/settings are intentionally not directly readable by ordinary users.
