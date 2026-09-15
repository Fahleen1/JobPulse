import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeRegionForMatch,
  normalizeTitleForMatch,
} from "./dedup.js";
import type {
  IngestionRunInput,
  PersistStore,
} from "./persist.js";
import type {
  CompanyRecord,
  JobRecord,
  JobSourceRecord,
  SourceRecord,
} from "./types.js";

function requireData<T>(data: T | null, error: { message: string } | null, label: string): T {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  if (data === null) {
    throw new Error(`${label}: no data returned`);
  }
  return data;
}

export class SupabasePersistStore implements PersistStore {
  constructor(private readonly client: SupabaseClient) {}

  async getCompany(id: string): Promise<CompanyRecord | null> {
    const { data, error } = await this.client
      .from("companies")
      .select("id, name, canonical_domain, career_url, logo_url")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`getCompany: ${error.message}`);
    }
    return data;
  }

  async upsertCompany(input: {
    name: string;
    canonicalDomain: string;
    careerUrl?: string | null;
  }): Promise<CompanyRecord> {
    const { data, error } = await this.client
      .from("companies")
      .upsert(
        {
          name: input.name,
          canonical_domain: input.canonicalDomain,
          career_url: input.careerUrl ?? null,
        },
        { onConflict: "canonical_domain" },
      )
      .select("id, name, canonical_domain, career_url, logo_url")
      .single();
    return requireData(data, error, "upsertCompany");
  }

  async findJobSource(
    sourceId: string,
    externalId: string,
  ): Promise<JobSourceRecord | null> {
    const { data, error } = await this.client
      .from("job_sources")
      .select(
        "id, job_id, source_id, external_id, canonical_url, source_published_at, date_kind, date_precision, first_seen_at, last_seen_at, content_hash, missing_count, closed_at",
      )
      .eq("source_id", sourceId)
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) {
      throw new Error(`findJobSource: ${error.message}`);
    }
    return data;
  }

  async listOpenJobSources(sourceId: string): Promise<JobSourceRecord[]> {
    const { data, error } = await this.client
      .from("job_sources")
      .select(
        "id, job_id, source_id, external_id, canonical_url, source_published_at, date_kind, date_precision, first_seen_at, last_seen_at, content_hash, missing_count, closed_at",
      )
      .eq("source_id", sourceId)
      .is("closed_at", null);
    if (error) {
      throw new Error(`listOpenJobSources: ${error.message}`);
    }
    return data ?? [];
  }

  async findJobIdByCanonicalUrl(canonicalUrl: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("job_sources")
      .select("job_id")
      .eq("canonical_url", canonicalUrl)
      .is("closed_at", null)
      .limit(1)
      .maybeSingle();
    if (error) {
      throw new Error(`findJobIdByCanonicalUrl: ${error.message}`);
    }
    return data?.job_id ?? null;
  }

  async findFuzzyJobId(input: {
    companyId: string;
    normalizedTitle: string;
    normalizedRegion: string;
    contentHash: string;
  }): Promise<string | null> {
    const { data, error } = await this.client
      .from("job_sources")
      .select(
        "job_id, content_hash, jobs!inner(id, company_id, title, region_text, status)",
      )
      .eq("content_hash", input.contentHash)
      .is("closed_at", null)
      .eq("jobs.company_id", input.companyId)
      .limit(50);
    if (error) {
      throw new Error(`findFuzzyJobId: ${error.message}`);
    }

    for (const row of data ?? []) {
      const job = row.jobs as unknown as {
        id: string;
        company_id: string;
        title: string;
        region_text: string;
      };
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
    const { data, error } = await this.client
      .from("job_sources")
      .select("source_id, sources!inner(ats_type)")
      .eq("job_id", jobId);
    if (error) {
      throw new Error(`findPreferredAtsTypeForJob: ${error.message}`);
    }

    const ats = new Set([
      "ashby",
      "greenhouse",
      "lever",
      "smartrecruiters",
      "workday",
    ]);
    let fallback: string | null = null;
    for (const row of data ?? []) {
      const type = (row.sources as unknown as { ats_type: string }).ats_type;
      if (ats.has(type)) {
        return type;
      }
      fallback ??= type;
    }
    return fallback;
  }

  async listDueSources(now: Date, limit: number): Promise<SourceRecord[]> {
    const nowIso = now.toISOString();
    const { data, error } = await this.client
      .from("sources")
      .select(
        "id, company_id, ats_type, board_key, endpoint, enabled, baseline_at, last_success_at, next_poll_at, failure_count, lease_until",
      )
      .eq("enabled", true)
      .lte("next_poll_at", nowIso)
      .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
      .order("next_poll_at", { ascending: true })
      .limit(limit);
    if (error) {
      throw new Error(`listDueSources: ${error.message}`);
    }
    return (data ?? []) as SourceRecord[];
  }

  async tryAcquireLease(
    sourceId: string,
    leaseUntil: string,
    now: Date,
  ): Promise<SourceRecord | null> {
    const nowIso = now.toISOString();
    const { data, error } = await this.client
      .from("sources")
      .update({ lease_until: leaseUntil })
      .eq("id", sourceId)
      .eq("enabled", true)
      .lte("next_poll_at", nowIso)
      .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
      .select(
        "id, company_id, ats_type, board_key, endpoint, enabled, baseline_at, last_success_at, next_poll_at, failure_count, lease_until",
      )
      .maybeSingle();
    if (error) {
      throw new Error(`tryAcquireLease: ${error.message}`);
    }
    return (data as SourceRecord | null) ?? null;
  }

  async getJob(id: string): Promise<JobRecord | null> {
    const { data, error } = await this.client
      .from("jobs")
      .select(
        "id, company_id, title, slug, description, role_family, seniority, skills, employment_type, workplace_type, eligibility_status, eligible_countries, region_text, salary_min, salary_max, salary_currency, application_url, status",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`getJob: ${error.message}`);
    }
    return data;
  }

  async insertJob(input: Omit<JobRecord, "id"> & { id?: string }): Promise<JobRecord> {
    const { data, error } = await this.client
      .from("jobs")
      .insert({
        id: input.id,
        company_id: input.company_id,
        title: input.title,
        slug: input.slug,
        description: input.description,
        role_family: input.role_family,
        seniority: input.seniority,
        skills: input.skills,
        employment_type: input.employment_type,
        workplace_type: input.workplace_type,
        eligibility_status: input.eligibility_status,
        eligible_countries: input.eligible_countries,
        region_text: input.region_text,
        salary_min: input.salary_min,
        salary_max: input.salary_max,
        salary_currency: input.salary_currency,
        application_url: input.application_url,
        status: input.status,
      })
      .select(
        "id, company_id, title, slug, description, role_family, seniority, skills, employment_type, workplace_type, eligibility_status, eligible_countries, region_text, salary_min, salary_max, salary_currency, application_url, status",
      )
      .single();
    return requireData(data, error, "insertJob");
  }

  async updateJob(id: string, patch: Partial<JobRecord>): Promise<JobRecord> {
    const { data, error } = await this.client
      .from("jobs")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        "id, company_id, title, slug, description, role_family, seniority, skills, employment_type, workplace_type, eligibility_status, eligible_countries, region_text, salary_min, salary_max, salary_currency, application_url, status",
      )
      .single();
    return requireData(data, error, "updateJob");
  }

  async insertJobSource(
    input: Omit<JobSourceRecord, "id"> & { id?: string },
  ): Promise<JobSourceRecord> {
    const { data, error } = await this.client
      .from("job_sources")
      .insert(input)
      .select(
        "id, job_id, source_id, external_id, canonical_url, source_published_at, date_kind, date_precision, first_seen_at, last_seen_at, content_hash, missing_count, closed_at",
      )
      .single();
    return requireData(data, error, "insertJobSource");
  }

  async updateJobSource(
    id: string,
    patch: Partial<JobSourceRecord>,
  ): Promise<JobSourceRecord> {
    // Never allow first_seen_at to be overwritten via patch.
    const { first_seen_at: _ignored, ...safePatch } = patch;
    const { data, error } = await this.client
      .from("job_sources")
      .update(safePatch)
      .eq("id", id)
      .select(
        "id, job_id, source_id, external_id, canonical_url, source_published_at, date_kind, date_precision, first_seen_at, last_seen_at, content_hash, missing_count, closed_at",
      )
      .single();
    return requireData(data, error, "updateJobSource");
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
    const { error } = await this.client.from("sources").update(patch).eq("id", id);
    if (error) {
      throw new Error(`updateSource: ${error.message}`);
    }
  }

  async insertIngestionRun(input: IngestionRunInput): Promise<{ id: string }> {
    const { data, error } = await this.client
      .from("ingestion_runs")
      .insert({
        source_id: input.sourceId,
        started_at: input.startedAt,
        finished_at: input.finishedAt,
        complete_snapshot: input.completeSnapshot,
        fetched_count: input.fetchedCount,
        new_count: input.newCount,
        changed_count: input.changedCount,
        closed_count: input.closedCount,
        error_code: input.errorCode,
        error_message: input.errorMessage,
        duration_ms: input.durationMs,
      })
      .select("id")
      .single();
    return requireData(data, error, "insertIngestionRun");
  }
}
