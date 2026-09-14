-- JobPulse initial schema (Module 2)
-- Apply in Supabase SQL editor or via supabase db push / migration runner.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  canonical_domain text not null unique,
  career_url text,
  logo_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sources
-- ---------------------------------------------------------------------------
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  ats_type text not null,
  board_key text not null,
  endpoint text not null,
  permission_note text,
  enabled boolean not null default true,
  baseline_at timestamptz,
  last_success_at timestamptz,
  next_poll_at timestamptz not null default now(),
  failure_count integer not null default 0,
  lease_until timestamptz,
  unique (ats_type, board_key)
);

create index if not exists sources_due_poll_idx
  on public.sources (enabled, next_poll_at);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  role_family text,
  seniority text,
  skills text[] not null default '{}',
  employment_type text,
  workplace_type text not null,
  eligibility_status text not null,
  eligible_countries text[] not null default '{}',
  region_text text not null default '',
  salary_min integer,
  salary_max integer,
  salary_currency text,
  application_url text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_workplace_type_check
    check (workplace_type in ('remote', 'hybrid', 'remote-in-region')),
  constraint jobs_eligibility_status_check
    check (eligibility_status in ('worldwide', 'restricted', 'unclear')),
  constraint jobs_status_check
    check (status in ('active', 'closed', 'relisted', 'baseline'))
);

create index if not exists jobs_feed_idx
  on public.jobs (status, created_at desc, id);

create index if not exists jobs_role_family_idx
  on public.jobs (role_family);

create index if not exists jobs_eligible_countries_gin_idx
  on public.jobs using gin (eligible_countries);

create index if not exists jobs_fts_idx
  on public.jobs
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

-- ---------------------------------------------------------------------------
-- job_sources
-- ---------------------------------------------------------------------------
create table if not exists public.job_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  source_id uuid not null references public.sources (id) on delete cascade,
  external_id text not null,
  canonical_url text,
  source_published_at timestamptz,
  date_kind text not null,
  date_precision text not null,
  source_updated_at timestamptz,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  content_hash text,
  missing_count integer not null default 0,
  closed_at timestamptz,
  constraint job_sources_date_kind_check
    check (date_kind in ('datetime', 'date_only', 'discovered_only')),
  constraint job_sources_date_precision_check
    check (date_precision in ('minute', 'day', 'unknown')),
  unique (source_id, external_id)
);

create index if not exists job_sources_job_id_idx
  on public.job_sources (job_id);

-- ---------------------------------------------------------------------------
-- ingestion_runs
-- ---------------------------------------------------------------------------
create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  complete_snapshot boolean not null default false,
  fetched_count integer not null default 0,
  new_count integer not null default 0,
  changed_count integer not null default 0,
  closed_count integer not null default 0,
  error_code text,
  error_message text,
  duration_ms integer
);

create index if not exists ingestion_runs_source_started_idx
  on public.ingestion_runs (source_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Monitoring helpers (Supabase dashboard / health page)
-- ---------------------------------------------------------------------------
create or replace view public.ingestion_health as
select
  s.id as source_id,
  s.ats_type,
  s.board_key,
  s.enabled,
  s.last_success_at,
  s.next_poll_at,
  s.failure_count,
  s.baseline_at,
  (
    select count(*)::int
    from public.job_sources js
    where js.source_id = s.id
      and js.closed_at is null
  ) as open_job_source_count
from public.sources s;

-- ---------------------------------------------------------------------------
-- Row Level Security: public read for feed tables; writes via service role only
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.sources enable row level security;
alter table public.jobs enable row level security;
alter table public.job_sources enable row level security;
alter table public.ingestion_runs enable row level security;

drop policy if exists companies_public_read on public.companies;
create policy companies_public_read
  on public.companies
  for select
  to anon, authenticated
  using (true);

drop policy if exists sources_public_read on public.sources;
create policy sources_public_read
  on public.sources
  for select
  to anon, authenticated
  using (true);

drop policy if exists jobs_public_read on public.jobs;
create policy jobs_public_read
  on public.jobs
  for select
  to anon, authenticated
  using (true);

drop policy if exists job_sources_public_read on public.job_sources;
create policy job_sources_public_read
  on public.job_sources
  for select
  to anon, authenticated
  using (true);

-- ingestion_runs: no anon access (ops only via service role / dashboard)
