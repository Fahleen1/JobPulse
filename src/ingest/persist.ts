import type { NormalizedJob } from "../types/normalized-job.js";
import {
  domainFromApplicationUrl,
  employerDomainFromName,
} from "./adapters/common.js";
import { contentHash } from "./content-hash.js";
import {
  canonicalizeApplicationUrl,
  normalizeRegionForMatch,
  normalizeTitleForMatch,
  preferAtsObservation,
} from "./dedup.js";
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
  merged: boolean;
  mergeReason: "exact" | "canonical_url" | "fuzzy" | null;
}

export interface PersistBatchResult {
  fetchedCount: number;
  newCount: number;
  changedCount: number;
  relistedCount: number;
  mergedCount: number;
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
  upsertCompany(input: {
    name: string;
    canonicalDomain: string;
    careerUrl?: string | null;
  }): Promise<CompanyRecord>;
  findJobSource(
    sourceId: string,
    externalId: string,
  ): Promise<JobSourceRecord | null>;
  listOpenJobSources(sourceId: string): Promise<JobSourceRecord[]>;
  /** Dedup step 2: find an open job that already uses this canonical apply URL. */
  findJobIdByCanonicalUrl(canonicalUrl: string): Promise<string | null>;
  /**
   * Dedup step 3: exact fuzzy match on company + normalized title + region + content hash.
   * Returns null when uncertain (caller must not auto-merge).
   */
  findFuzzyJobId(input: {
    companyId: string;
    normalizedTitle: string;
    normalizedRegion: string;
    contentHash: string;
  }): Promise<string | null>;
  /** Ats type of a preferred observation for a job, if any. */
  findPreferredAtsTypeForJob(jobId: string): Promise<string | null>;
  listDueSources(now: Date, limit: number): Promise<SourceRecord[]>;
  tryAcquireLease(
    sourceId: string,
    leaseUntil: string,
    now: Date,
  ): Promise<SourceRecord | null>;
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
  const now = options.now ?? new Date();
  const baselineImport = options.baselineImport === true;
  const nowIso = now.toISOString();
  const results: PersistJobResult[] = [];
  let newCount = 0;
  let changedCount = 0;
  let relistedCount = 0;
  let mergedCount = 0;

  for (const raw of jobs) {
    validateNormalizedJob(raw);
    const description = sanitizeDescription(raw.description);
    const hash = contentHash(description);
    const canonicalUrl = canonicalizeApplicationUrl(raw.application_url);
    const company = await resolveCompanyForJob(store, source, raw);
    const existing = await store.findJobSource(source.id, raw.external_id);

    if (existing) {
      const outcome = await updateExistingObservation(
        store,
        source,
        existing,
        raw,
        description,
        hash,
        canonicalUrl,
        nowIso,
        baselineImport,
      );
      if (outcome.changed) {
        changedCount += 1;
      }
      if (outcome.relisted) {
        relistedCount += 1;
      }
      results.push(outcome.result);
      continue;
    }

    // Dedup step 2: canonical application URL.
    let mergeJobId = await store.findJobIdByCanonicalUrl(canonicalUrl);
    let mergeReason: PersistJobResult["mergeReason"] = mergeJobId
      ? "canonical_url"
      : null;

    // Dedup step 3: conservative fuzzy match (all four signals).
    if (!mergeJobId) {
      mergeJobId = await store.findFuzzyJobId({
        companyId: company.id,
        normalizedTitle: normalizeTitleForMatch(raw.title),
        normalizedRegion: normalizeRegionForMatch(raw.region_text),
        contentHash: hash,
      });
      if (mergeJobId) {
        mergeReason = "fuzzy";
      }
    }

    if (mergeJobId) {
      const merged = await attachObservationToJob(
        store,
        source,
        mergeJobId,
        raw,
        description,
        hash,
        canonicalUrl,
        nowIso,
        baselineImport,
      );
      mergedCount += 1;
      if (merged.changed) {
        changedCount += 1;
      }
      results.push({
        externalId: raw.external_id,
        jobId: mergeJobId,
        jobSourceId: merged.jobSourceId,
        created: false,
        firstSeenAt: merged.firstSeenAt,
        relisted: false,
        merged: true,
        mergeReason,
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
      application_url: canonicalUrl,
      status: initialStatus,
    });

    const jobSource = await store.insertJobSource({
      id: newId(),
      job_id: job.id,
      source_id: source.id,
      external_id: raw.external_id,
      canonical_url: canonicalUrl,
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
      merged: false,
      mergeReason: null,
    });
  }

  return {
    fetchedCount: jobs.length,
    newCount,
    changedCount,
    relistedCount,
    mergedCount,
    results,
  };
}

async function resolveCompanyForJob(
  store: PersistStore,
  source: SourceRecord,
  job: NormalizedJob,
): Promise<CompanyRecord> {
  if (source.company_id) {
    const existing = await store.getCompany(source.company_id);
    if (!existing) {
      throw new Error(
        `Company ${source.company_id} not found for source ${source.board_key}`,
      );
    }
    return existing;
  }

  const domain =
    domainFromApplicationUrl(job.application_url) ??
    employerDomainFromName(job.company_name);
  return store.upsertCompany({
    name: job.company_name?.trim() || domain,
    canonicalDomain: domain,
    careerUrl: null,
  });
}

async function updateExistingObservation(
  store: PersistStore,
  source: SourceRecord,
  existing: JobSourceRecord,
  raw: NormalizedJob,
  description: string,
  hash: string,
  canonicalUrl: string,
  nowIso: string,
  baselineImport: boolean,
): Promise<{
  result: PersistJobResult;
  changed: boolean;
  relisted: boolean;
}> {
  const prev = await store.getJob(existing.job_id);
  if (!prev) {
    throw new Error(`Orphan job_sources row ${existing.id} missing job ${existing.job_id}`);
  }

  const publishedBumped = isLaterTimestamp(
    raw.source_published_at,
    existing.source_published_at,
  );
  const relisted = publishedBumped;
  const preservedPublishedAt = publishedBumped
    ? existing.source_published_at
    : (raw.source_published_at ?? existing.source_published_at);

  let nextStatus = prev.status;
  if (relisted) {
    nextStatus = "relisted";
  } else if (prev.status === "closed") {
    nextStatus = baselineImport ? "baseline" : "active";
  }

  const preferredAts = await store.findPreferredAtsTypeForJob(prev.id);
  const shouldWriteJobFields = preferAtsObservation(preferredAts, source.ats_type)
    || preferredAts === null
    || preferredAts === source.ats_type;

  const updatedJob = shouldWriteJobFields
    ? await store.updateJob(prev.id, {
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
        application_url: canonicalUrl,
        status: nextStatus,
      })
    : await store.updateJob(prev.id, { status: nextStatus });

  const updatedSource = await store.updateJobSource(existing.id, {
    canonical_url: canonicalUrl,
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

  return {
    changed,
    relisted,
    result: {
      externalId: raw.external_id,
      jobId: updatedJob.id,
      jobSourceId: updatedSource.id,
      created: false,
      firstSeenAt: existing.first_seen_at,
      relisted,
      merged: false,
      mergeReason: "exact",
    },
  };
}

async function attachObservationToJob(
  store: PersistStore,
  source: SourceRecord,
  jobId: string,
  raw: NormalizedJob,
  description: string,
  hash: string,
  canonicalUrl: string,
  nowIso: string,
  baselineImport: boolean,
): Promise<{ jobSourceId: string; firstSeenAt: string; changed: boolean }> {
  const prev = await store.getJob(jobId);
  if (!prev) {
    throw new Error(`Merge target job ${jobId} not found`);
  }

  const preferredAts = await store.findPreferredAtsTypeForJob(jobId);
  const shouldWriteJobFields = preferAtsObservation(preferredAts, source.ats_type)
    || preferredAts === null
    || preferredAts === source.ats_type;

  let changed = false;
  if (shouldWriteJobFields) {
    const updated = await store.updateJob(jobId, {
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
      application_url: canonicalUrl,
      status: prev.status === "closed"
        ? baselineImport
          ? "baseline"
          : "active"
        : prev.status,
    });
    changed =
      prev.title !== updated.title ||
      prev.description !== updated.description ||
      prev.status !== updated.status;
  }

  const jobSource = await store.insertJobSource({
    id: newId(),
    job_id: jobId,
    source_id: source.id,
    external_id: raw.external_id,
    canonical_url: canonicalUrl,
    source_published_at: raw.source_published_at,
    date_kind: raw.date_kind,
    date_precision: raw.date_precision,
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    content_hash: hash,
    missing_count: 0,
    closed_at: null,
  });

  return {
    jobSourceId: jobSource.id,
    firstSeenAt: jobSource.first_seen_at,
    changed,
  };
}

export async function recordIngestionRun(
  store: PersistStore,
  input: IngestionRunInput,
): Promise<{ id: string }> {
  return store.insertIngestionRun(input);
}
