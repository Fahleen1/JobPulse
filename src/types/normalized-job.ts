/**
 * Shared in-memory job shape for Module 1 data proof.
 * Mirrors REQUIREMENTS.md §6 (`jobs` + date fields from `job_sources`).
 * No database persistence in this module.
 *
 * Ashby note: `publishedAt` means *last* published, not first published.
 * Module 1 surfaces date + kind only; repost / baseline handling is Module 3.
 */

export type RoleFamily =
  | "engineering"
  | "qa"
  | "devops"
  | "data"
  | "design"
  | "product"
  | "hr"
  | "support"
  | "other";

export type Seniority =
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "staff"
  | "principal";

export type EmploymentType = "full-time" | "part-time" | "contract";

export type WorkplaceType = "remote" | "hybrid" | "remote-in-region";

export type EligibilityStatus = "worldwide" | "restricted" | "unclear";

/** How trustworthy the employer publication date is. */
export type DateKind = "datetime" | "date_only" | "discovered_only";

export type DatePrecision = "minute" | "day" | "unknown";

export type JobStatus = "active" | "closed" | "relisted" | "baseline";

/** Classification used by the Module 1 proof CLI. */
export type DateClass = "trusted" | "discovery-only";

/** Classification used by the Module 1 proof CLI. */
export type EligibilityClass = "explicit" | "unclear";

export interface DateClassification {
  source_published_at: string | null;
  date_kind: DateKind;
  date_precision: DatePrecision;
  /** True when the timestamp is in the future and must not enter the verified feed. */
  quarantined: boolean;
  date_class: DateClass;
}

export interface EligibilityClassification {
  eligibility_status: EligibilityStatus;
  eligible_countries: string[];
  region_text: string;
  eligibility_class: EligibilityClass;
}

/**
 * Normalized job produced by a source adapter.
 * Fields align with the `jobs` table plus provenance/date fields from `job_sources`.
 */
export interface NormalizedJob {
  external_id: string;
  title: string;
  description: string;
  application_url: string;
  role_family: RoleFamily | null;
  seniority: Seniority | null;
  skills: string[];
  employment_type: EmploymentType | null;
  workplace_type: WorkplaceType;
  eligibility_status: EligibilityStatus;
  eligible_countries: string[];
  region_text: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  /** Employer publication instant from this source, ISO-8601 UTC, or null. */
  source_published_at: string | null;
  date_kind: DateKind;
  date_precision: DatePrecision;
  quarantined: boolean;
  date_class: DateClass;
  eligibility_class: EligibilityClass;
  /** Board / company slug this job was fetched from (proof convenience). */
  board_key: string;
  company_name: string | null;
}
