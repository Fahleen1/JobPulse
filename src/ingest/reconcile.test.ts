import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "../types/normalized-job.js";
import { ingestFetchedJobs } from "./ingest-source.js";
import { MemoryPersistStore } from "./memory-store.js";
import { persistNormalizedJobs } from "./persist.js";
import { reconcileClosures } from "./reconcile.js";
import type { SourceRecord } from "./types.js";

function sampleJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    external_id: "ext-1",
    title: "Senior Engineer",
    description: "Build things",
    application_url: "https://jobs.ashbyhq.com/example/apply/ext-1",
    role_family: "engineering",
    seniority: "senior",
    skills: [],
    employment_type: "full-time",
    workplace_type: "remote",
    eligibility_status: "unclear",
    eligible_countries: [],
    region_text: "Remote",
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

function sampleSource(companyId: string, overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: "source-1",
    company_id: companyId,
    ats_type: "ashby",
    board_key: "Ashby",
    endpoint: "https://api.ashbyhq.com/posting-api/job-board/Ashby",
    enabled: true,
    baseline_at: null,
    last_success_at: null,
    next_poll_at: new Date().toISOString(),
    failure_count: 0,
    lease_until: null,
    ...overrides,
  };
}

function setupStore(): { store: MemoryPersistStore; source: SourceRecord } {
  const store = new MemoryPersistStore();
  const companyId = "company-1";
  store.seedCompany({
    id: companyId,
    name: "Ashby",
    canonical_domain: "ashbyhq.com",
    career_url: "https://jobs.ashbyhq.com/Ashby",
    logo_url: null,
  });
  const source = sampleSource(companyId);
  store.seedSource(source);
  return { store, source };
}

describe("baseline import", () => {
  it("marks first complete import jobs as baseline and sets baseline_at", async () => {
    const { store, source } = setupStore();
    const result = await ingestFetchedJobs(store, source, [sampleJob()], {
      completeSnapshot: true,
      now: new Date("2026-09-14T12:00:00.000Z"),
    });

    expect(result.baselineImport).toBe(true);
    expect(result.persist.newCount).toBe(1);
    const job = [...store.jobs.values()][0];
    expect(job?.status).toBe("baseline");
    expect(store.sources.get(source.id)?.baseline_at).toBe("2026-09-14T12:00:00.000Z");
  });

  it("marks later imports as active once baseline_at is set", async () => {
    const { store, source } = setupStore();
    store.seedSource({ ...source, baseline_at: "2026-09-01T00:00:00.000Z" });
    const sourced = { ...source, baseline_at: "2026-09-01T00:00:00.000Z" };

    const result = await ingestFetchedJobs(
      store,
      sourced,
      [sampleJob({ external_id: "ext-new", application_url: "https://jobs.ashbyhq.com/x/ext-new" })],
      { completeSnapshot: true },
    );

    expect(result.baselineImport).toBe(false);
    expect([...store.jobs.values()].every((job) => job.status === "active")).toBe(true);
  });
});

describe("complete-snapshot closure", () => {
  it("does not mass-close on incomplete snapshot", async () => {
    const { store, source } = setupStore();
    await persistNormalizedJobs(store, source, [sampleJob()], {
      now: new Date("2026-09-14T10:00:00.000Z"),
    });

    const closure = await reconcileClosures(
      store,
      source.id,
      new Set(),
      false,
      new Date("2026-09-14T11:00:00.000Z"),
    );

    expect(closure.skipped).toBe(true);
    expect(closure.closedCount).toBe(0);
    expect([...store.jobSources.values()][0]?.missing_count).toBe(0);
    expect([...store.jobs.values()][0]?.status).toBe("active");
  });

  it("increments missing once, then closes on second complete miss", async () => {
    const { store, source } = setupStore();
    await persistNormalizedJobs(store, source, [sampleJob()], {
      now: new Date("2026-09-14T10:00:00.000Z"),
    });

    const firstMiss = await reconcileClosures(
      store,
      source.id,
      new Set(),
      true,
      new Date("2026-09-14T11:00:00.000Z"),
    );
    expect(firstMiss.closedCount).toBe(0);
    expect(firstMiss.missingIncremented).toBe(1);
    expect([...store.jobSources.values()][0]?.missing_count).toBe(1);
    expect([...store.jobs.values()][0]?.status).toBe("active");

    const secondMiss = await reconcileClosures(
      store,
      source.id,
      new Set(),
      true,
      new Date("2026-09-14T12:00:00.000Z"),
    );
    expect(secondMiss.closedCount).toBe(1);
    expect([...store.jobSources.values()][0]?.closed_at).toBe("2026-09-14T12:00:00.000Z");
    expect([...store.jobs.values()][0]?.status).toBe("closed");
  });

  it("does not close jobs still present in the snapshot", async () => {
    const { store, source } = setupStore();
    await persistNormalizedJobs(store, source, [sampleJob()], {
      now: new Date("2026-09-14T10:00:00.000Z"),
    });

    const closure = await reconcileClosures(
      store,
      source.id,
      new Set(["ext-1"]),
      true,
      new Date("2026-09-14T11:00:00.000Z"),
    );
    expect(closure.missingIncremented).toBe(0);
    expect(closure.closedCount).toBe(0);
  });
});

describe("relisted detection", () => {
  it("marks relisted when publishedAt bumps later and preserves original publish time", async () => {
    const { store, source } = setupStore();
    await persistNormalizedJobs(store, source, [sampleJob()], {
      now: new Date("2026-09-14T10:00:00.000Z"),
    });

    const second = await persistNormalizedJobs(
      store,
      source,
      [sampleJob({ source_published_at: "2026-09-20T10:00:00.000Z" })],
      { now: new Date("2026-09-20T11:00:00.000Z") },
    );

    expect(second.relistedCount).toBe(1);
    expect(second.results[0]?.relisted).toBe(true);
    expect([...store.jobs.values()][0]?.status).toBe("relisted");
    expect([...store.jobSources.values()][0]?.source_published_at).toBe(
      "2026-09-01T10:00:00.000Z",
    );
    expect(second.results[0]?.firstSeenAt).toBe("2026-09-14T10:00:00.000Z");
  });
});
