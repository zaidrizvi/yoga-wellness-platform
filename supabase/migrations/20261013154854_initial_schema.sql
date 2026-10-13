-- Requires Supabase PostgreSQL 15+; local config uses PostgreSQL 17.
-- No bookings, packages, payments, fake users, or fictional coverage.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one role; independent of optional/lazy profile enrichment.
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'professional', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index user_roles_admin_idx on public.user_roles(user_id) where role = 'admin';

create table public.professional_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  biography text not null default '' check (char_length(biography) <= 3000),
  qualifications_description text not null default '' check (char_length(qualifications_description) <= 3000),
  experience_description text not null default '' check (char_length(experience_description) <= 1500),
  -- An administrator-approved reference, not a private document path.
  approved_image_reference text check (
    approved_image_reference is null or
    (char_length(approved_image_reference) <= 500 and
     approved_image_reference ~ '^public-professional-images/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$')
  ),
  public_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_verifications (
  professional_id uuid primary key references public.professional_profiles(user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'suspended')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  internal_notes text not null default '' check (char_length(internal_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviewed_state_has_timestamp check (status = 'pending' or reviewed_at is not null)
);
create index professional_verifications_reviewer_idx on public.professional_verifications(reviewed_by);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 3000),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text not null default '' check (char_length(short_description) <= 500),
  detailed_description text not null default '' check (char_length(detailed_description) <= 6000),
  -- INR minor units (paise): exact integer representation, never float.
  price_minor bigint check (price_minor between 0 and 100000000),
  duration_minutes integer check (duration_minutes between 1 and 1440),
  currency text not null default 'INR' check (currency = 'INR'),
  is_active boolean not null default true,
  is_published boolean not null default false,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inactive_service_not_published check (not is_published or is_active)
);
create index services_category_idx on public.services(category_id);

create table public.professional_services (
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  primary key (professional_id, service_id)
);
create index professional_services_service_idx on public.professional_services(service_id);
create index professional_services_approver_idx on public.professional_services(approved_by);

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  postal_code text check (postal_code ~ '^[1-9][0-9]{5}$'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (name, postal_code)
);

create table public.professional_service_areas (
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  service_area_id uuid not null references public.service_areas(id) on delete restrict,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  primary key (professional_id, service_area_id)
);
create index professional_service_areas_area_idx on public.professional_service_areas(service_area_id);
create index professional_service_areas_approver_idx on public.professional_service_areas(approved_by);

create table public.administrative_audit (
  id uuid primary key default gen_random_uuid(),
  -- Retain immutable identity references even after account deletion. No PII.
  target_user_id uuid not null,
  actor_user_id uuid,
  action text not null check (action in ('role_change', 'verification_change', 'publication_change')),
  previous_state text,
  new_state text not null,
  reason text check (char_length(reason) <= 4000),
  created_at timestamptz not null default now()
);
create index administrative_audit_target_idx on public.administrative_audit(target_user_id, created_at);

-- Close Data API access immediately, even before the next migration is applied.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_roles', 'professional_profiles', 'professional_verifications',
    'service_categories', 'services', 'professional_services', 'service_areas',
    'professional_service_areas', 'administrative_audit'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;
