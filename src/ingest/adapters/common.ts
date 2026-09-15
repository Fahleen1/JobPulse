import type {
  EligibilityStatus,
  EmploymentType,
  NormalizedJob,
  RoleFamily,
  Seniority,
  WorkplaceType,
} from "../../types/normalized-job.js";
import { classifyDate } from "../../classify/dates.js";
import { classifyEligibility } from "../../classify/eligibility.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 12 * 1024 * 1024;

export class AggregatorHttpError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AggregatorHttpError";
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export async function fetchJson(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/xml, application/rss+xml, */*",
        "User-Agent": "JobPulse/0.1 (+https://github.com/Fahleen1/JobPulse)",
        ...options.headers,
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new AggregatorHttpError(
        `HTTP ${response.status} for ${url}`,
        response.status,
      );
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      throw new AggregatorHttpError(`Response too large for ${url}`);
    }
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof AggregatorHttpError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AggregatorHttpError(`Timeout fetching ${url}`);
    }
    throw new AggregatorHttpError(
      `Fetch failed for ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "JobPulse/0.1 (+https://github.com/Fahleen1/JobPulse)",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new AggregatorHttpError(`HTTP ${response.status} for ${url}`, response.status);
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      throw new AggregatorHttpError(`Response too large for ${url}`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export function mapRoleFamily(raw: string | null | undefined): RoleFamily | null {
  if (!raw) {
    return null;
  }
  const value = raw.toLowerCase();
  if (/\b(qa|quality|test|sdet)\b/.test(value)) {
    return "qa";
  }
  if (/\b(devops|sre|infra|platform)\b/.test(value)) {
    return "devops";
  }
  if (/\b(data|machine learning|ml|ai)\b/.test(value)) {
    return "data";
  }
  if (/\b(design|ux|ui)\b/.test(value)) {
    return "design";
  }
  if (/\b(product)\b/.test(value)) {
    return "product";
  }
  if (/\b(hr|talent|recruiter|people)\b/.test(value)) {
    return "hr";
  }
  if (/\b(support|customer success)\b/.test(value)) {
    return "support";
  }
  if (/\b(engineer|software|developer|frontend|backend|full[\s-]?stack)\b/.test(value)) {
    return "engineering";
  }
  return "other";
}

export function mapSeniority(raw: string | null | undefined): Seniority | null {
  if (!raw) {
    return null;
  }
  const value = raw.toLowerCase();
  if (/\bprincipal\b/.test(value)) {
    return "principal";
  }
  if (/\bstaff\b/.test(value)) {
    return "staff";
  }
  if (/\b(lead|manager|head)\b/.test(value)) {
    return "lead";
  }
  if (/\b(senior|sr\.?)\b/.test(value)) {
    return "senior";
  }
  if (/\b(junior|jr\.?|entry|intern)\b/.test(value)) {
    return "junior";
  }
  if (/\b(mid|intermediate)\b/.test(value)) {
    return "mid";
  }
  return null;
}

export function mapEmploymentType(
  raw: string | null | undefined,
): EmploymentType | null {
  if (!raw) {
    return null;
  }
  const value = raw.toLowerCase();
  if (value.includes("full")) {
    return "full-time";
  }
  if (value.includes("part")) {
    return "part-time";
  }
  if (value.includes("contract") || value.includes("freelance")) {
    return "contract";
  }
  return null;
}

export function buildNormalizedJob(input: {
  externalId: string;
  title: string;
  description: string;
  applicationUrl: string;
  boardKey: string;
  companyName: string | null;
  locationText: string | null;
  publishedAt: string | number | null;
  roleHint?: string | null | undefined;
  seniorityHint?: string | null | undefined;
  employmentHint?: string | null | undefined;
  workplaceType?: WorkplaceType;
  skills?: string[];
  salaryMin?: number | null | undefined;
  salaryMax?: number | null | undefined;
  salaryCurrency?: string | null | undefined;
  now?: Date;
}): NormalizedJob {
  const date = classifyDate(input.publishedAt, input.now);
  const eligibility = classifyEligibility({
    locationText: input.locationText,
  });
  const workplace =
    input.workplaceType ??
    (eligibility.eligibility_status === "restricted"
      ? "remote-in-region"
      : "remote");

  return {
    external_id: String(input.externalId),
    title: input.title.trim(),
    description: input.description ?? "",
    application_url: input.applicationUrl,
    role_family: mapRoleFamily(input.roleHint ?? input.title),
    seniority: mapSeniority(input.seniorityHint ?? input.title),
    skills: input.skills ?? [],
    employment_type: mapEmploymentType(input.employmentHint),
    workplace_type: workplace,
    eligibility_status: eligibility.eligibility_status as EligibilityStatus,
    eligible_countries: eligibility.eligible_countries,
    region_text: eligibility.region_text,
    salary_min: input.salaryMin ?? null,
    salary_max: input.salaryMax ?? null,
    salary_currency: input.salaryCurrency ?? null,
    source_published_at: date.source_published_at,
    date_kind: date.date_kind,
    date_precision: date.date_precision,
    quarantined: date.quarantined,
    date_class: date.date_class,
    eligibility_class: eligibility.eligibility_class,
    board_key: input.boardKey,
    company_name: input.companyName,
  };
}

export function employerDomainFromName(companyName: string | null | undefined): string {
  const slug = (companyName ?? "unknown")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "unknown"}.employer`;
}

export function domainFromApplicationUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const aggregatorHosts = [
      "remotive.com",
      "remoteok.com",
      "jobicy.com",
      "arbeitnow.com",
      "himalayas.app",
      "weworkremotely.com",
      "themuse.com",
      "adzuna.com",
      "adzuna.co.uk",
    ];
    if (aggregatorHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}
