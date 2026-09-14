export interface SourceRecord {
  id: string;
  company_id: string | null;
  ats_type: string;
  board_key: string;
  endpoint: string;
  enabled: boolean;
  baseline_at: string | null;
  last_success_at: string | null;
  next_poll_at: string;
  failure_count: number;
  lease_until: string | null;
}

export interface CompanyRecord {
  id: string;
  name: string;
  canonical_domain: string;
  career_url: string | null;
  logo_url: string | null;
}

export interface JobRecord {
  id: string;
  company_id: string;
  title: string;
  slug: string;
  description: string | null;
  role_family: string | null;
  seniority: string | null;
  skills: string[];
  employment_type: string | null;
  workplace_type: string;
  eligibility_status: string;
  eligible_countries: string[];
  region_text: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  application_url: string;
  status: string;
}

export interface JobSourceRecord {
  id: string;
  job_id: string;
  source_id: string;
  external_id: string;
  canonical_url: string | null;
  source_published_at: string | null;
  date_kind: string;
  date_precision: string;
  first_seen_at: string;
  last_seen_at: string;
  content_hash: string | null;
  missing_count: number;
  closed_at: string | null;
}
