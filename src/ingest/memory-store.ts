import type { IngestionRunInput, PersistStore } from "./persist.js";
import type {
  CompanyRecord,
  JobRecord,
  JobSourceRecord,
  SourceRecord,
} from "./types.js";

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
      // Allow update when seedSource wasn't used for lightweight persist tests.
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
