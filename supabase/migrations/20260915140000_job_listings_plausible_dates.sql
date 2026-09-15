-- Exclude implausible (pre-2000 / epoch) publish times from trusted clock.
create or replace view public.job_listings
with (security_invoker = true)
as
select
  j.id,
  j.company_id,
  j.title,
  j.slug,
  j.description,
  j.role_family,
  j.seniority,
  j.skills,
  j.employment_type,
  j.workplace_type,
  j.eligibility_status,
  j.eligible_countries,
  j.region_text,
  j.salary_min,
  j.salary_max,
  j.salary_currency,
  j.application_url,
  j.status,
  j.created_at,
  j.updated_at,
  c.name as company_name,
  c.canonical_domain as company_domain,
  c.logo_url as company_logo_url,
  (
    select js.source_published_at
    from public.job_sources js
    where js.job_id = j.id
      and js.closed_at is null
      and js.date_kind in ('datetime', 'date_only')
      and js.source_published_at is not null
      and js.source_published_at >= timestamptz '2000-01-01'
    order by js.source_published_at desc nulls last
    limit 1
  ) as trusted_published_at,
  (
    select js.date_kind
    from public.job_sources js
    where js.job_id = j.id
      and js.closed_at is null
      and js.date_kind in ('datetime', 'date_only')
      and js.source_published_at is not null
      and js.source_published_at >= timestamptz '2000-01-01'
    order by js.source_published_at desc nulls last
    limit 1
  ) as trusted_date_kind,
  (
    select min(js.first_seen_at)
    from public.job_sources js
    where js.job_id = j.id
  ) as discovered_at
from public.jobs j
join public.companies c on c.id = j.company_id;

grant select on public.job_listings to anon, authenticated;
