import type {
  DateKind,
  DatePrecision,
  EligibilityStatus,
  NormalizedJob,
  WorkplaceType,
} from "../types/normalized-job.js";

const WORKPLACE: ReadonlySet<string> = new Set([
  "remote",
  "hybrid",
  "remote-in-region",
]);

const ELIGIBILITY: ReadonlySet<string> = new Set([
  "worldwide",
  "restricted",
  "unclear",
]);

const DATE_KIND: ReadonlySet<string> = new Set([
  "datetime",
  "date_only",
  "discovered_only",
]);

const DATE_PRECISION: ReadonlySet<string> = new Set(["minute", "day", "unknown"]);

export class JobValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobValidationError";
  }
}

/**
 * Validate a normalized job before DB write. Throws JobValidationError on failure.
 */
export function validateNormalizedJob(job: NormalizedJob): void {
  if (!job.external_id.trim()) {
    throw new JobValidationError("external_id is required");
  }
  if (!job.title.trim()) {
    throw new JobValidationError("title is required");
  }
  if (!isHttpUrl(job.application_url)) {
    throw new JobValidationError(`application_url must be https URL: ${job.application_url}`);
  }
  if (!WORKPLACE.has(job.workplace_type)) {
    throw new JobValidationError(`invalid workplace_type: ${job.workplace_type}`);
  }
  if (!ELIGIBILITY.has(job.eligibility_status)) {
    throw new JobValidationError(`invalid eligibility_status: ${job.eligibility_status}`);
  }
  if (!DATE_KIND.has(job.date_kind)) {
    throw new JobValidationError(`invalid date_kind: ${job.date_kind}`);
  }
  if (!DATE_PRECISION.has(job.date_precision)) {
    throw new JobValidationError(`invalid date_precision: ${job.date_precision}`);
  }
  if (job.source_published_at !== null && Number.isNaN(Date.parse(job.source_published_at))) {
    throw new JobValidationError(`invalid source_published_at: ${job.source_published_at}`);
  }
}

export function assertWorkplaceType(value: string): asserts value is WorkplaceType {
  if (!WORKPLACE.has(value)) {
    throw new JobValidationError(`invalid workplace_type: ${value}`);
  }
}

export function assertEligibilityStatus(
  value: string,
): asserts value is EligibilityStatus {
  if (!ELIGIBILITY.has(value)) {
    throw new JobValidationError(`invalid eligibility_status: ${value}`);
  }
}

export function assertDateKind(value: string): asserts value is DateKind {
  if (!DATE_KIND.has(value)) {
    throw new JobValidationError(`invalid date_kind: ${value}`);
  }
}

export function assertDatePrecision(value: string): asserts value is DatePrecision {
  if (!DATE_PRECISION.has(value)) {
    throw new JobValidationError(`invalid date_precision: ${value}`);
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
