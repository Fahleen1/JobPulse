import { classifyDate } from "../classify/dates.js";
import { classifyEligibility } from "../classify/eligibility.js";
import type {
  EmploymentType,
  NormalizedJob,
  RoleFamily,
  Seniority,
  WorkplaceType,
} from "../types/normalized-job.js";
import type { AshbyCompensation, AshbyJob } from "./types.js";

export interface AdaptAshbyJobOptions {
  boardKey: string;
  companyName?: string | null;
  now?: Date;
}

/**
 * Maps one Ashby job into the shared NormalizedJob shape.
 * Returns null when the posting is on-site-only or missing a usable apply URL.
 * Does not invent source fields — missing data stays null / empty / unclear.
 */
export function adaptAshbyJob(
  job: AshbyJob,
  options: AdaptAshbyJobOptions,
): NormalizedJob | null {
  const applicationUrl = pickApplicationUrl(job);
  if (applicationUrl === null) {
    return null;
  }

  const workplace = mapWorkplace(job);
  if (workplace === null) {
    return null;
  }

  const date = classifyDate(job.publishedAt, options.now);
  const eligibility = classifyEligibility({
    locationText: job.location ?? null,
    primaryCountries: [
      job.address?.postalAddress?.addressCountry,
    ],
    secondaryCountries: (job.secondaryLocations ?? []).map(
      (entry) => entry.address?.postalAddress?.addressCountry,
    ),
    secondaryLocationTexts: (job.secondaryLocations ?? []).map(
      (entry) => entry.location,
    ),
  });

  const workplace_type = refineWorkplace(workplace, eligibility.eligibility_status);
  const salary = extractSalary(job.compensation);

  return {
    external_id: job.id,
    title: job.title,
    description: job.descriptionPlain ?? job.descriptionHtml ?? "",
    application_url: applicationUrl,
    role_family: inferRoleFamily(job),
    seniority: inferSeniority(job.title),
    skills: [],
    employment_type: mapEmploymentType(job.employmentType),
    workplace_type,
    eligibility_status: eligibility.eligibility_status,
    eligible_countries: eligibility.eligible_countries,
    region_text: eligibility.region_text,
    salary_min: salary.min,
    salary_max: salary.max,
    salary_currency: salary.currency,
    source_published_at: date.source_published_at,
    date_kind: date.date_kind,
    date_precision: date.date_precision,
    quarantined: date.quarantined,
    date_class: date.date_class,
    eligibility_class: eligibility.eligibility_class,
    board_key: options.boardKey,
    company_name: options.companyName ?? null,
  };
}

export function adaptAshbyJobs(
  jobs: AshbyJob[],
  options: AdaptAshbyJobOptions,
): NormalizedJob[] {
  const adapted: NormalizedJob[] = [];
  for (const job of jobs) {
    const normalized = adaptAshbyJob(job, options);
    if (normalized !== null) {
      adapted.push(normalized);
    }
  }
  return adapted;
}

function pickApplicationUrl(job: AshbyJob): string | null {
  const apply = job.applyUrl?.trim();
  if (apply) {
    return apply;
  }
  const jobUrl = job.jobUrl?.trim();
  return jobUrl && jobUrl.length > 0 ? jobUrl : null;
}

function mapWorkplace(job: AshbyJob): WorkplaceType | null {
  const type = job.workplaceType;
  if (type === "Remote") {
    return "remote";
  }
  if (type === "Hybrid") {
    return "hybrid";
  }
  if (type === "OnSite") {
    return null;
  }
  // Fallback when workplaceType is missing: trust isRemote only for remote.
  if (job.isRemote === true) {
    return "remote";
  }
  return null;
}

function refineWorkplace(
  base: WorkplaceType,
  eligibilityStatus: NormalizedJob["eligibility_status"],
): WorkplaceType {
  if (base === "remote" && eligibilityStatus === "restricted") {
    return "remote-in-region";
  }
  return base;
}

function mapEmploymentType(
  value: AshbyJob["employmentType"],
): EmploymentType | null {
  switch (value) {
    case "FullTime":
      return "full-time";
    case "PartTime":
      return "part-time";
    case "Contract":
      return "contract";
    case "Intern":
    case "Temporary":
    case undefined:
      return null;
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

function extractSalary(compensation: AshbyCompensation | undefined): {
  min: number | null;
  max: number | null;
  currency: string | null;
} {
  const components = compensation?.summaryComponents ?? [];
  const salary = components.find(
    (component) => component.compensationType === "Salary",
  );
  if (!salary) {
    return { min: null, max: null, currency: null };
  }
  return {
    min: typeof salary.minValue === "number" ? salary.minValue : null,
    max: typeof salary.maxValue === "number" ? salary.maxValue : null,
    currency: salary.currencyCode ?? null,
  };
}

function inferRoleFamily(job: AshbyJob): RoleFamily | null {
  const haystack = [job.department, job.team, job.title]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  if (!haystack) {
    return null;
  }
  if (/\b(qa|quality assurance|test engineer|sdet)\b/.test(haystack)) {
    return "qa";
  }
  if (/\b(devops|sre|infrastructure|platform engineer)\b/.test(haystack)) {
    return "devops";
  }
  if (/\b(data science|data engineer|machine learning|ml engineer|ai)\b/.test(haystack)) {
    return "data";
  }
  if (/\b(design|product design|ux|ui)\b/.test(haystack)) {
    return "design";
  }
  if (/\b(product manager|product management)\b/.test(haystack)) {
    return "product";
  }
  if (/\b(recruiter|talent|people ops|human resources|\bhr\b)\b/.test(haystack)) {
    return "hr";
  }
  if (/\b(support|customer success|customer experience)\b/.test(haystack)) {
    return "support";
  }
  if (/\b(engineer|engineering|software|frontend|backend|full[\s-]?stack|mobile)\b/.test(haystack)) {
    return "engineering";
  }
  return "other";
}

function inferSeniority(title: string): Seniority | null {
  const value = title.toLowerCase();
  if (/\bprincipal\b/.test(value)) {
    return "principal";
  }
  if (/\bstaff\b/.test(value)) {
    return "staff";
  }
  if (/\b(lead|head of|manager)\b/.test(value)) {
    return "lead";
  }
  if (/\b(senior|sr\.?)\b/.test(value)) {
    return "senior";
  }
  if (/\b(junior|jr\.?|entry)\b/.test(value)) {
    return "junior";
  }
  if (/\b(mid[\s-]?level|intermediate)\b/.test(value)) {
    return "mid";
  }
  return null;
}
