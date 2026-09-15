export const ROLE_FAMILIES = [
  "engineering",
  "qa",
  "devops",
  "data",
  "design",
  "product",
  "hr",
  "support",
  "other",
] as const;

export type RoleFamilyId = (typeof ROLE_FAMILIES)[number];

export const SENIORITY_LEVELS = [
  "junior",
  "mid",
  "senior",
  "lead",
  "staff",
  "principal",
] as const;

export type FeedMode = "verified" | "discovered";
export type FeedWindow = "24h" | "48h" | "7d";

export interface JobListItem {
  id: string;
  slug: string;
  title: string;
  company_name: string;
  company_domain: string;
  company_logo_url: string | null;
  role_family: string | null;
  seniority: string | null;
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
  created_at: string;
  trusted_published_at: string | null;
  trusted_date_kind: string | null;
  discovered_at: string | null;
  description?: string | null;
}

export interface JobSearchParams {
  q?: string;
  role?: string;
  country?: string;
  level?: string;
  window?: FeedWindow;
  mode?: FeedMode;
  cursor?: string | null;
  limit?: number;
}

export interface JobSearchResult {
  jobs: JobListItem[];
  nextCursor: string | null;
  mode: FeedMode;
  window: FeedWindow;
}

export interface Facets {
  roles: string[];
  countries: string[];
  levels: string[];
}

export const COUNTRY_LABELS: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  AU: "Australia",
  IE: "Ireland",
  ES: "Spain",
  IT: "Italy",
  SE: "Sweden",
  CH: "Switzerland",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  PK: "Pakistan",
  SG: "Singapore",
};
