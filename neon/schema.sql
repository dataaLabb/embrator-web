create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null default '',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  rep text not null default '',
  category text not null default '',
  sector text not null default '',
  area text not null default '',
  address text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  model text not null default '',
  unit text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null,
  customer_name text not null,
  rep text not null default '',
  category text not null default '',
  sector text not null default '',
  area text not null default '',
  address text not null default '',
  created_by uuid references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null,
  customer_name text not null,
  rep text not null default '',
  category text not null default '',
  sector text not null default '',
  area text not null default '',
  address text not null default '',
  amount numeric(14,2) not null default 0,
  collection_type text not null,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_code text not null,
  customer_name text not null,
  rep text not null default '',
  category text not null default '',
  sector text not null default '',
  area text not null default '',
  address text not null default '',
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_code text not null,
  item_name text not null,
  unit text not null default '',
  model text not null default '',
  qty numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists portal_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
