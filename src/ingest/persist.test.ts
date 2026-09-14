import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "../types/normalized-job.js";
import { MemoryPersistStore } from "./memory-store.js";
import { persistNormalizedJobs, recordIngestionRun } from "./persist.js";
import { sanitizeDescription } from "./sanitize.js";
import type { SourceRecord } from "./types.js";
import { JobValidationError, validateNormalizedJob } from "./validate.js";
import { AshbySourceAdapter } from "./adapters/ashby.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptAshbyJobs } from "../ashby/adapter.js";
import type { AshbyJob } from "../ashby/types.js";

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

function sampleSource(companyId: string): SourceRecord {
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
  };
}

describe("sanitizeDescription", () => {
  it("strips script tags and event handlers", () => {
    const dirty =
      '<p onclick="alert(1)">Hi</p><script>evil()</script><a href="javascript:alert(1)">x</a>';
    const clean = sanitizeDescription(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
  });
});

describe("validateNormalizedJob", () => {
  it("accepts a valid job", () => {
    expect(() => validateNormalizedJob(sampleJob())).not.toThrow();
  });

  it("rejects missing apply URL scheme", () => {
    expect(() =>
      validateNormalizedJob(sampleJob({ application_url: "not-a-url" })),
    ).toThrow(JobValidationError);
  });
});

describe("persistNormalizedJobs idempotency", () => {
  it("does not duplicate on second import and keeps first_seen_at", async () => {
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
    const jobs = [sampleJob()];

    const first = await persistNormalizedJobs(
      store,
      source,
      jobs,
      { now: new Date("2026-09-14T10:00:00.000Z") },
    );
    const second = await persistNormalizedJobs(
      store,
      source,
      jobs,
      { now: new Date("2026-09-14T11:00:00.000Z") },
    );

    expect(first.newCount).toBe(1);
    expect(second.newCount).toBe(0);
    expect(store.jobSources.size).toBe(1);
    expect(store.jobs.size).toBe(1);
    expect(first.results[0]?.firstSeenAt).toBe("2026-09-14T10:00:00.000Z");
    expect(second.results[0]?.firstSeenAt).toBe("2026-09-14T10:00:00.000Z");
    expect(second.results[0]?.firstSeenAt).toBe(first.results[0]?.firstSeenAt);

    await recordIngestionRun(store, {
      sourceId: source.id,
      startedAt: "2026-09-14T10:00:00.000Z",
      finishedAt: "2026-09-14T10:00:01.000Z",
      completeSnapshot: true,
      fetchedCount: 1,
      newCount: 1,
      changedCount: 0,
      closedCount: 0,
      errorCode: null,
      errorMessage: null,
      durationMs: 1000,
    });
    expect(store.ingestionRuns).toHaveLength(1);
  });

  it("updates description on re-import without new job_sources row", async () => {
    const store = new MemoryPersistStore();
    const companyId = "company-1";
    store.seedCompany({
      id: companyId,
      name: "Ashby",
      canonical_domain: "ashbyhq.com",
      career_url: null,
      logo_url: null,
    });
    const source = sampleSource(companyId);

    await persistNormalizedJobs(store, source, [sampleJob()]);
    const second = await persistNormalizedJobs(store, source, [
      sampleJob({ description: "Updated role details" }),
    ]);

    expect(second.newCount).toBe(0);
    expect(second.changedCount).toBe(1);
    expect(store.jobSources.size).toBe(1);
    const job = [...store.jobs.values()][0];
    expect(job?.description).toBe("Updated role details");
  });
});

describe("AshbySourceAdapter + fixture", () => {
  it("exposes ashby atsType and fixture adapts to NormalizedJob", () => {
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../fixtures/ashby/Ashby.json",
    );
    const payload = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      jobs: AshbyJob[];
    };
    const adapted = adaptAshbyJobs(payload.jobs, {
      boardKey: "Ashby",
      companyName: "Ashby",
    });
    expect(adapted.length).toBeGreaterThan(0);
    expect(new AshbySourceAdapter().atsType).toBe("ashby");
  });
});
