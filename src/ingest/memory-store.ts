import {
  normalizeRegionForMatch,
  normalizeTitleForMatch,
} from "./dedup.js";
import type { IngestionRunInput, PersistStore } from "./persist.js";
import type {
  CompanyRecord,
  JobRecord,
  JobSourceRecord,
  SourceRecord,
} from "./types.js";

const ATS = new Set([
  "ashby",
  "greenhouse",
  "lever",
  "smartrecruiters",
  "workday",
]);

/**
 * In-memory PersistStore for ingest unit tests (no live DB required).
 */
export class MemoryPersistStore implements PersistStore {
  companies = new Map<string, CompanyRecord>();
  sources = new Map<string, SourceRecord>();
  jobs = new Map<string, JobRecord>();
  jobSources = new Map<string, JobSourceRecord>();
  ingestionRuns: Array<IngestionRunInput & { id: string }> = [];

  seedCompany(company: CompanyRecord): void {
    this.companies.set(company.id, company);
  }

  seedSource(source: SourceRecord): void {
    this.sources.set(source.id, source);
  }

  async getCompany(id: string): Promise<CompanyRecord | null> {
    return this.companies.get(id) ?? null;
  }

  async upsertCompany(input: {
    name: string;
    canonicalDomain: string;
    careerUrl?: string | null;
  }): Promise<CompanyRecord> {
    for (const company of this.companies.values()) {
      if (company.canonical_domain === input.canonicalDomain) {
        const next = {
          ...company,
          name: input.name,
          career_url: input.careerUrl ?? company.career_url,
        };
        this.companies.set(company.id, next);
        return next;
      }
    }
    const row: CompanyRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      canonical_domain: input.canonicalDomain,
      career_url: input.careerUrl ?? null,
      logo_url: null,
    };
    this.companies.set(row.id, row);
    return row;
  }

  async findJobSource(
    sourceId: string,
    externalId: string,
  ): Promise<JobSourceRecord | null> {
    for (const row of this.jobSources.values()) {
      if (row.source_id === sourceId && row.external_id === externalId) {
        return row;
      }
    }
    return null;
  }

  async listOpenJobSources(sourceId: string): Promise<JobSourceRecord[]> {
    return [...this.jobSources.values()].filter(
      (row) => row.source_id === sourceId && row.closed_at === null,
    );
  }

  async findJobIdByCanonicalUrl(canonicalUrl: string): Promise<string | null> {
    for (const row of this.jobSources.values()) {
      if (row.closed_at === null && row.canonical_url === canonicalUrl) {
        return row.job_id;
      }
    }
    return null;
  }

  async findFuzzyJobId(input: {
    companyId: string;
    normalizedTitle: string;
    normalizedRegion: string;
    contentHash: string;
  }): Promise<string | null> {
    for (const row of this.jobSources.values()) {
      if (row.closed_at !== null || row.content_hash !== input.contentHash) {
        continue;
      }
      const job = this.jobs.get(row.job_id);
      if (!job || job.company_id !== input.companyId) {
        continue;
      }
      if (
        normalizeTitleForMatch(job.title) === input.normalizedTitle &&
        normalizeRegionForMatch(job.region_text) === input.normalizedRegion
      ) {
        return job.id;
      }
    }
    return null;
  }

  async findPreferredAtsTypeForJob(jobId: string): Promise<string | null> {
    let fallback: string | null = null;
    for (const row of this.jobSources.values()) {
      if (row.job_id !== jobId) {
        continue;
      }
      const source = this.sources.get(row.source_id);
      if (!source) {
        continue;
      }
      if (ATS.has(source.ats_type)) {
        return source.ats_type;
      }
      fallback ??= source.ats_type;
    }
    return fallback;
  }

  async listDueSources(now: Date, limit: number): Promise<SourceRecord[]> {
    const nowMs = now.getTime();
    return [...this.sources.values()]
      .filter((source) => {
        if (!source.enabled) {
          return false;
        }
        if (Date.parse(source.next_poll_at) > nowMs) {
          return false;
        }
        if (source.lease_until && Date.parse(source.lease_until) > nowMs) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) => Date.parse(a.next_poll_at) - Date.parse(b.next_poll_at),
      )
      .slice(0, limit);
  }

  async tryAcquireLease(
    sourceId: string,
    leaseUntil: string,
    now: Date,
  ): Promise<SourceRecord | null> {
    const source = this.sources.get(sourceId);
    if (!source || !source.enabled) {
      return null;
    }
    const nowMs = now.getTime();
    if (Date.parse(source.next_poll_at) > nowMs) {
      return null;
    }
    if (source.lease_until && Date.parse(source.lease_until) > nowMs) {
      return null;
    }
    const next = { ...source, lease_until: leaseUntil };
    this.sources.set(sourceId, next);
    return next;
  }

  async getJob(id: string): Promise<JobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  async insertJob(input: Omit<JobRecord, "id"> & { id?: string }): Promise<JobRecord> {
    const id = input.id ?? crypto.randomUUID();
    if ([...this.jobs.values()].some((job) => job.slug === input.slug)) {
      throw new Error(`duplicate slug ${input.slug}`);
    }
    const row: JobRecord = { ...input, id };
    this.jobs.set(id, row);
    return row;
  }

  async updateJob(id: string, patch: Partial<JobRecord>): Promise<JobRecord> {
    const prev = this.jobs.get(id);
    if (!prev) {
      throw new Error(`job not found ${id}`);
    }
    const next = { ...prev, ...patch, id: prev.id };
    this.jobs.set(id, next);
    return next;
  }

  async insertJobSource(
    input: Omit<JobSourceRecord, "id"> & { id?: string },
  ): Promise<JobSourceRecord> {
    const existing = await this.findJobSource(input.source_id, input.external_id);
    if (existing) {
      throw new Error("duplicate (source_id, external_id)");
    }
    const id = input.id ?? crypto.randomUUID();
    const row: JobSourceRecord = { ...input, id };
    this.jobSources.set(id, row);
    return row;
  }

  async updateJobSource(
    id: string,
    patch: Partial<JobSourceRecord>,
  ): Promise<JobSourceRecord> {
    const prev = this.jobSources.get(id);
    if (!prev) {
      throw new Error(`job_source not found ${id}`);
    }
    const { first_seen_at: _ignored, ...safePatch } = patch;
    const next = { ...prev, ...safePatch, id: prev.id, first_seen_at: prev.first_seen_at };
    this.jobSources.set(id, next);
    return next;
  }

  async updateSource(
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
  ): Promise<void> {
    const prev = this.sources.get(id);
    if (!prev) {
      this.sources.set(id, {
        id,
        company_id: null,
        ats_type: "ashby",
        board_key: "unknown",
        endpoint: "",
        enabled: true,
        baseline_at: null,
        last_success_at: null,
        next_poll_at: new Date().toISOString(),
        failure_count: 0,
        lease_until: null,
        ...patch,
      });
      return;
    }
    this.sources.set(id, { ...prev, ...patch });
  }

  async insertIngestionRun(input: IngestionRunInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    this.ingestionRuns.push({ ...input, id });
    return { id };
  }
}
