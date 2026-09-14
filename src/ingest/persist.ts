import type { NormalizedJob } from "../types/normalized-job.js";
import { contentHash } from "./content-hash.js";
import { sanitizeDescription } from "./sanitize.js";
import { buildJobSlug } from "./slug.js";
import type {
  CompanyRecord,
  JobRecord,
  JobSourceRecord,
  SourceRecord,
} from "./types.js";
import { validateNormalizedJob } from "./validate.js";

export interface PersistJobResult {
  externalId: string;
  jobId: string;
  jobSourceId: string;
  created: boolean;
  firstSeenAt: string;
  relisted: boolean;
}

export interface PersistBatchResult {
  fetchedCount: number;
  newCount: number;
  changedCount: number;
  relistedCount: number;
  results: PersistJobResult[];
}

export interface IngestionRunInput {
  sourceId: string;
  startedAt: string;
  finishedAt: string;
  completeSnapshot: boolean;
  fetchedCount: number;
  newCount: number;
  changedCount: number;
  closedCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number;
}

export interface PersistOptions {
  now?: Date;
  /**
   * First complete import for a source (`baseline_at` still null).
   * New jobs are stored as `baseline`, not announced as newly posted.
   */
  baselineImport?: boolean;
}

export interface PersistStore {
  getCompany(id: string): Promise<CompanyRecord | null>;
  findJobSource(
    sourceId: string,
    externalId: string,
  ): Promise<JobSourceRecord | null>;
  listOpenJobSources(sourceId: string): Promise<JobSourceRecord[]>;
  getJob(id: string): Promise<JobRecord | null>;
  insertJob(input: Omit<JobRecord, "id"> & { id?: string }): Promise<JobRecord>;
  updateJob(id: string, patch: Partial<JobRecord>): Promise<JobRecord>;
  insertJobSource(
    input: Omit<JobSourceRecord, "id"> & { id?: string },
  ): Promise<JobSourceRecord>;
  updateJobSource(
    id: string,
    patch: Partial<JobSourceRecord>,
  ): Promise<JobSourceRecord>;
  updateSource(
    id: string,
    patch: Partial<
      Pick<
        SourceRecord,
        | "baseline_at"
        | "last_success_at"
        | "next_poll_at"
        | "failure_count"
        | "lease_until"
      >
    >,
  ): Promise<void>;
  insertIngestionRun(input: IngestionRunInput): Promise<{ id: string }>;
}

function newId(): string {
  return crypto.randomUUID();
}

function isLaterTimestamp(
  next: string | null,
  prev: string | null,
): boolean {
  if (!next || !prev) {
    return false;
  }
  const nextMs = Date.parse(next);
  const prevMs = Date.parse(prev);
  if (Number.isNaN(nextMs) || Number.isNaN(prevMs)) {
    return false;
  }
  return nextMs > prevMs;
}

/**
 * Persist normalized jobs for one source using exact (source_id, external_id) identity.
 * Never overwrites first_seen_at once set.
 * Preserves original source_published_at when Ashby bumps last-published (relisted).
 */
export async function persistNormalizedJobs(
  store: PersistStore,
  source: SourceRecord,
  jobs: NormalizedJob[],
  options: PersistOptions = {},
): Promise<PersistBatchResult> {
  if (!source.company_id) {
    throw new Error(`Source ${source.id} is missing company_id (required for Ashby persist)`);
  }

  const company = await store.getCompany(source.company_id);
  if (!company) {
    throw new Error(`Company ${source.company_id} not found for source ${source.board_key}`);
  }

  const now = options.now ?? new Date();
  const baselineImport = options.baselineImport === true;
  const nowIso = now.toISOString();
  const results: PersistJobResult[] = [];
  let newCount = 0;
  let changedCount = 0;
  let relistedCount = 0;

  for (const raw of jobs) {
    validateNormalizedJob(raw);
    const description = sanitizeDescription(raw.description);
    const hash = contentHash(description);
    const existing = await store.findJobSource(source.id, raw.external_id);

    if (existing) {
      const prev = await store.getJob(existing.job_id);
      if (!prev) {
        throw new Error(`Orphan job_sources row ${existing.id} missing job ${existing.job_id}`);
      }

      const publishedBumped = isLaterTimestamp(
        raw.source_published_at,
        existing.source_published_at,
      );
      const relisted = publishedBumped;
      // Preserve original employer publish time; Ashby publishedAt is last-published.
      const preservedPublishedAt = publishedBumped
        ? existing.source_published_at
        : (raw.source_published_at ?? existing.source_published_at);

      let nextStatus = prev.status;
      if (relisted) {
        nextStatus = "relisted";
      } else if (prev.status === "closed") {
        nextStatus = baselineImport ? "baseline" : "active";
      }

      const updatedJob = await store.updateJob(prev.id, {
        title: raw.title,
        description,
        role_family: raw.role_family,
        seniority: raw.seniority,
        skills: raw.skills,
        employment_type: raw.employment_type,
        workplace_type: raw.workplace_type,
        eligibility_status: raw.eligibility_status,
        eligible_countries: raw.eligible_countries,
        region_text: raw.region_text,
        salary_min: raw.salary_min,
        salary_max: raw.salary_max,
        salary_currency: raw.salary_currency,
        application_url: raw.application_url,
        status: nextStatus,
      });

      const updatedSource = await store.updateJobSource(existing.id, {
        canonical_url: raw.application_url,
        source_published_at: preservedPublishedAt,
        date_kind: raw.date_kind,
        date_precision: raw.date_precision,
        last_seen_at: nowIso,
        content_hash: hash,
        missing_count: 0,
        closed_at: null,
      });

      const changed =
        prev.title !== updatedJob.title ||
        prev.description !== updatedJob.description ||
        existing.content_hash !== hash ||
        prev.status !== updatedJob.status;
      if (changed) {
        changedCount += 1;
      }
      if (relisted) {
        relistedCount += 1;
      }

      results.push({
        externalId: raw.external_id,
        jobId: updatedJob.id,
        jobSourceId: updatedSource.id,
        created: false,
        firstSeenAt: existing.first_seen_at,
        relisted,
      });
      continue;
    }

    const initialStatus = baselineImport ? "baseline" : "active";
    const job = await store.insertJob({
      id: newId(),
      company_id: company.id,
      title: raw.title,
      slug: buildJobSlug(raw.title, raw.external_id, source.board_key),
      description,
      role_family: raw.role_family,
      seniority: raw.seniority,
      skills: raw.skills,
      employment_type: raw.employment_type,
      workplace_type: raw.workplace_type,
      eligibility_status: raw.eligibility_status,
      eligible_countries: raw.eligible_countries,
      region_text: raw.region_text,
      salary_min: raw.salary_min,
      salary_max: raw.salary_max,
      salary_currency: raw.salary_currency,
      application_url: raw.application_url,
      status: initialStatus,
    });

    const jobSource = await store.insertJobSource({
      id: newId(),
      job_id: job.id,
      source_id: source.id,
      external_id: raw.external_id,
      canonical_url: raw.application_url,
      source_published_at: raw.source_published_at,
      date_kind: raw.date_kind,
      date_precision: raw.date_precision,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      content_hash: hash,
      missing_count: 0,
      closed_at: null,
    });

    newCount += 1;
    results.push({
      externalId: raw.external_id,
      jobId: job.id,
      jobSourceId: jobSource.id,
      created: true,
      firstSeenAt: jobSource.first_seen_at,
      relisted: false,
    });
  }

  return {
    fetchedCount: jobs.length,
    newCount,
    changedCount,
    relistedCount,
    results,
  };
}

export async function recordIngestionRun(
  store: PersistStore,
  input: IngestionRunInput,
): Promise<{ id: string }> {
  return store.insertIngestionRun(input);
}
