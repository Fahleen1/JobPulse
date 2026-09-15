/**
 * Module 3 safety checks — fixture-based (no live network).
 * Covers: double-import idempotency, first_seen_at immutability,
 * closure safety on failed/incomplete snapshots, baseline marking.
 */
import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "../types/normalized-job.js";
import { ingestFetchedJobs } from "./ingest-source.js";
import { MemoryPersistStore } from "./memory-store.js";
import { persistNormalizedJobs } from "./persist.js";
import { reconcileClosures } from "./reconcile.js";
import type { SourceRecord } from "./types.js";

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    external_id: "safe-1",
    title: "Safety Engineer",
    description: "Keep it safe",
    application_url: "https://jobs.example.com/apply/safe-1",
    role_family: "engineering",
    seniority: "mid",
    skills: [],
    employment_type: "full-time",
    workplace_type: "remote",
    eligibility_status: "unclear",
    eligible_countries: [],
    region_text: "Remote",
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    source_published_at: "2026-09-01T00:00:00.000Z",
    date_kind: "datetime",
    date_precision: "minute",
    quarantined: false,
    date_class: "trusted",
    eligibility_class: "unclear",
    board_key: "Ashby",
    company_name: "Safe Co",
    ...overrides,
  };
}

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: "source-safe",
    company_id: "co-safe",
    ats_type: "ashby",
    board_key: "Ashby",
    endpoint: "https://example.com",
    enabled: true,
    baseline_at: null,
    last_success_at: null,
    next_poll_at: "2026-09-15T00:00:00.000Z",
    failure_count: 0,
    lease_until: null,
    ...overrides,
  };
}

describe("Module 3 safety suite", () => {
  it("double-import is idempotent and first_seen_at never changes", async () => {
    const store = new MemoryPersistStore();
    store.seedCompany({
      id: "co-safe",
      name: "Safe Co",
      canonical_domain: "safeco.com",
      career_url: null,
      logo_url: null,
    });
    const src = source({ baseline_at: "2026-09-01T00:00:00.000Z" });
    store.seedSource(src);

    const first = await persistNormalizedJobs(store, src, [job()], {
      now: new Date("2026-09-15T10:00:00.000Z"),
    });
    const second = await persistNormalizedJobs(store, src, [job()], {
      now: new Date("2026-09-15T11:00:00.000Z"),
    });

    expect(first.newCount).toBe(1);
    expect(second.newCount).toBe(0);
    expect(store.jobSources.size).toBe(1);
    expect(first.results[0]?.firstSeenAt).toBe(second.results[0]?.firstSeenAt);
  });

  it("failed/incomplete snapshot does not mass-close", async () => {
    const store = new MemoryPersistStore();
    store.seedCompany({
      id: "co-safe",
      name: "Safe Co",
      canonical_domain: "safeco.com",
      career_url: null,
      logo_url: null,
    });
    const src = source({ baseline_at: "2026-09-01T00:00:00.000Z" });
    store.seedSource(src);
    await persistNormalizedJobs(store, src, [job()]);

    const closure = await reconcileClosures(
      store,
      src.id,
      new Set(),
      false,
      new Date("2026-09-15T12:00:00.000Z"),
    );
    expect(closure.skipped).toBe(true);
    expect(closure.closedCount).toBe(0);
    expect([...store.jobs.values()][0]?.status).not.toBe("closed");
  });

  it("baseline import marks jobs baseline and sets baseline_at", async () => {
    const store = new MemoryPersistStore();
    store.seedCompany({
      id: "co-safe",
      name: "Safe Co",
      canonical_domain: "safeco.com",
      career_url: null,
      logo_url: null,
    });
    const src = source({ baseline_at: null });
    store.seedSource(src);

    const result = await ingestFetchedJobs(store, src, [job()], {
      completeSnapshot: true,
      now: new Date("2026-09-15T09:00:00.000Z"),
    });

    expect(result.baselineImport).toBe(true);
    expect([...store.jobs.values()][0]?.status).toBe("baseline");
    expect(store.sources.get(src.id)?.baseline_at).toBe("2026-09-15T09:00:00.000Z");
  });
});
