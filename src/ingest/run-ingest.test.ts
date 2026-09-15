import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "../types/normalized-job.js";
import { contentHash } from "./content-hash.js";
import { MemoryPersistStore } from "./memory-store.js";
import { persistNormalizedJobs } from "./persist.js";
import { sanitizeDescription } from "./sanitize.js";
import { runIngestion } from "./run-ingest.js";
import type { SourceRecord } from "./types.js";

function sampleJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    external_id: "ext-1",
    title: "Senior Engineer",
    description: "Build things",
    application_url: "https://jobs.example.com/apply/1?utm_source=x",
    role_family: "engineering",
    seniority: "senior",
    skills: [],
    employment_type: "full-time",
    workplace_type: "remote",
    eligibility_status: "unclear",
    eligible_countries: [],
    region_text: "Remote - US",
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    source_published_at: "2026-09-01T10:00:00.000Z",
    date_kind: "datetime",
    date_precision: "minute",
    quarantined: false,
    date_class: "trusted",
    eligibility_class: "unclear",
    board_key: "Ashby",
    company_name: "Ashby",
    ...overrides,
  };
}

function source(
  id: string,
  boardKey: string,
  atsType: string,
  companyId: string,
): SourceRecord {
  return {
    id,
    company_id: companyId,
    ats_type: atsType,
    board_key: boardKey,
    endpoint: "https://example.com",
    enabled: true,
    baseline_at: "2026-09-01T00:00:00.000Z",
    last_success_at: null,
    next_poll_at: "2026-09-15T00:00:00.000Z",
    failure_count: 0,
    lease_until: null,
  };
}

describe("dedup step 2 canonical URL", () => {
  it("merges two sources pointing at the same apply URL into one job", async () => {
    const store = new MemoryPersistStore();
    store.seedCompany({
      id: "co-1",
      name: "Acme",
      canonical_domain: "acme.com",
      career_url: null,
      logo_url: null,
    });
    const ashby = source("s-ashby", "Acme", "ashby", "co-1");
    const remotive = source("s-remotive", "remotive", "remotive", "co-1");
    store.seedSource(ashby);
    store.seedSource(remotive);

    const first = await persistNormalizedJobs(store, ashby, [sampleJob()]);
    const second = await persistNormalizedJobs(store, remotive, [
      sampleJob({
        external_id: "remotive-99",
        application_url: "https://jobs.example.com/apply/1?utm_campaign=y",
        board_key: "remotive",
      }),
    ]);

    expect(first.newCount).toBe(1);
    expect(second.newCount).toBe(0);
    expect(second.mergedCount).toBe(1);
    expect(second.results[0]?.mergeReason).toBe("canonical_url");
    expect(store.jobs.size).toBe(1);
    expect(store.jobSources.size).toBe(2);
    expect(second.results[0]?.jobId).toBe(first.results[0]?.jobId);
  });
});

describe("dedup step 3 fuzzy", () => {
  it("merges when company+title+region+hash all match", async () => {
    const store = new MemoryPersistStore();
    store.seedCompany({
      id: "co-1",
      name: "Acme",
      canonical_domain: "acme.com",
      career_url: null,
      logo_url: null,
    });
    const ashby = source("s-ashby", "Acme", "ashby", "co-1");
    const other = source("s-other", "other", "remotive", "co-1");
    store.seedSource(ashby);
    store.seedSource(other);

    await persistNormalizedJobs(store, ashby, [sampleJob()]);
    const description = sanitizeDescription("Build things");
    const hash = contentHash(description);

    const second = await persistNormalizedJobs(store, other, [
      sampleJob({
        external_id: "other-1",
        application_url: "https://totally-different.example/jobs/xyz",
        description,
        board_key: "other",
      }),
    ]);

    expect(hash).toBeTruthy();
    expect(second.mergedCount).toBe(1);
    expect(second.results[0]?.mergeReason).toBe("fuzzy");
    expect(store.jobs.size).toBe(1);
    expect(store.jobSources.size).toBe(2);
  });

  it("does not merge when title differs", async () => {
    const store = new MemoryPersistStore();
    store.seedCompany({
      id: "co-1",
      name: "Acme",
      canonical_domain: "acme.com",
      career_url: null,
      logo_url: null,
    });
    const ashby = source("s-ashby", "Acme", "ashby", "co-1");
    const other = source("s-other", "other", "remotive", "co-1");
    store.seedSource(ashby);
    store.seedSource(other);

    await persistNormalizedJobs(store, ashby, [sampleJob()]);
    const second = await persistNormalizedJobs(store, other, [
      sampleJob({
        external_id: "other-2",
        title: "Different Role",
        application_url: "https://other.example/jobs/2",
        board_key: "other",
      }),
    ]);

    expect(second.mergedCount).toBe(0);
    expect(second.newCount).toBe(1);
    expect(store.jobs.size).toBe(2);
  });
});

describe("due source leasing", () => {
  it("lists due sources and acquires a lease once", async () => {
    const store = new MemoryPersistStore();
    const now = new Date("2026-09-15T12:00:00.000Z");
    store.seedCompany({
      id: "co-1",
      name: "Acme",
      canonical_domain: "acme.com",
      career_url: null,
      logo_url: null,
    });
    store.seedSource(source("s1", "Acme", "ashby", "co-1"));

    const due = await store.listDueSources(now, 10);
    expect(due).toHaveLength(1);
    const leased = await store.tryAcquireLease(
      "s1",
      "2026-09-15T12:15:00.000Z",
      now,
    );
    expect(leased?.lease_until).toBe("2026-09-15T12:15:00.000Z");
    const again = await store.tryAcquireLease(
      "s1",
      "2026-09-15T12:20:00.000Z",
      now,
    );
    expect(again).toBeNull();
  });
});

describe("runIngestion failure path", () => {
  it("records backoff without closing jobs when adapter throws", async () => {
    const store = new MemoryPersistStore();
    const now = new Date("2026-09-15T12:00:00.000Z");
    store.seedCompany({
      id: "co-1",
      name: "Acme",
      canonical_domain: "acme.com",
      career_url: null,
      logo_url: null,
    });
    // Unknown ats_type forces getAdapterForSource to throw.
    store.seedSource({
      ...source("s-bad", "bad", "not-a-real-ats", "co-1"),
      next_poll_at: "2026-09-15T00:00:00.000Z",
    });

    const summary = await runIngestion(store, { now, limit: 5, concurrency: 2 });
    expect(summary.failed).toBe(1);
    expect(summary.succeeded).toBe(0);
    expect(store.sources.get("s-bad")?.failure_count).toBe(1);
    expect(store.ingestionRuns[0]?.completeSnapshot).toBe(false);
    expect(store.ingestionRuns[0]?.closedCount).toBe(0);
  });
});
