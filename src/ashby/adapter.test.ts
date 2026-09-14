import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adaptAshbyJob, adaptAshbyJobs } from "./adapter.js";
import type { AshbyJob, AshbyJobBoardResponse } from "./types.js";
import type { NormalizedJob } from "../types/normalized-job.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/ashby/Ashby.json",
);

const REQUIRED_KEYS: Array<keyof NormalizedJob> = [
  "external_id",
  "title",
  "description",
  "application_url",
  "role_family",
  "seniority",
  "skills",
  "employment_type",
  "workplace_type",
  "eligibility_status",
  "eligible_countries",
  "region_text",
  "salary_min",
  "salary_max",
  "salary_currency",
  "source_published_at",
  "date_kind",
  "date_precision",
  "quarantined",
  "date_class",
  "eligibility_class",
  "board_key",
  "company_name",
];

function loadFixture(): AshbyJobBoardResponse {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as AshbyJobBoardResponse;
}

function baseJob(overrides: Partial<AshbyJob> = {}): AshbyJob {
  return {
    id: "job-1",
    title: "Software Engineer",
    applyUrl: "https://jobs.ashbyhq.com/example/apply/job-1",
    workplaceType: "Remote",
    isRemote: true,
    location: "Remote - US",
    publishedAt: "2026-09-01T10:00:00.000Z",
    descriptionPlain: "Build things",
    ...overrides,
  };
}

describe("adaptAshbyJob", () => {
  it("maps fixture jobs into NormalizedJob without crashing on optionals", () => {
    const fixture = loadFixture();
    const adapted = adaptAshbyJobs(fixture.jobs, {
      boardKey: "Ashby",
      companyName: "Ashby",
    });

    expect(adapted.length).toBeGreaterThan(0);
    for (const job of adapted) {
      for (const key of REQUIRED_KEYS) {
        expect(job).toHaveProperty(key);
      }
      expect(job.board_key).toBe("Ashby");
      expect(job.application_url.length).toBeGreaterThan(0);
      expect(["trusted", "discovery-only"]).toContain(job.date_class);
      expect(["explicit", "unclear"]).toContain(job.eligibility_class);
    }
  });

  it("classifies publishedAt as trusted datetime", () => {
    const job = adaptAshbyJob(baseJob(), {
      boardKey: "Ashby",
      companyName: "Ashby",
      now: new Date("2026-09-14T12:00:00.000Z"),
    });
    expect(job).not.toBeNull();
    expect(job?.date_class).toBe("trusted");
    expect(job?.date_kind).toBe("datetime");
    expect(job?.source_published_at).toBe("2026-09-01T10:00:00.000Z");
  });

  it("classifies missing publishedAt as discovery-only", () => {
    const raw = baseJob();
    delete raw.publishedAt;
    const job = adaptAshbyJob(raw, {
      boardKey: "Ashby",
      companyName: "Ashby",
    });
    expect(job?.date_class).toBe("discovery-only");
    expect(job?.date_kind).toBe("discovered_only");
    expect(job?.source_published_at).toBeNull();
  });

  it("never upgrades bare Remote to worldwide", () => {
    const raw = baseJob({
      location: "Remote",
      secondaryLocations: [],
    });
    delete raw.address;
    const job = adaptAshbyJob(raw, { boardKey: "Ashby", companyName: "Ashby" });
    expect(job?.eligibility_status).toBe("unclear");
    expect(job?.eligibility_class).toBe("unclear");
  });

  it("marks restricted remote roles as remote-in-region", () => {
    const job = adaptAshbyJob(
      baseJob({
        location: "Remote - US",
        address: {
          postalAddress: { addressCountry: "United States" },
        },
      }),
      { boardKey: "Ashby", companyName: "Ashby" },
    );
    expect(job?.workplace_type).toBe("remote-in-region");
    expect(job?.eligibility_status).toBe("restricted");
    expect(job?.eligibility_class).toBe("explicit");
    expect(job?.eligible_countries).toContain("US");
  });

  it("skips on-site-only jobs", () => {
    const job = adaptAshbyJob(
      baseJob({
        workplaceType: "OnSite",
        isRemote: false,
        location: "San Francisco, CA",
      }),
      { boardKey: "Ashby", companyName: "Ashby" },
    );
    expect(job).toBeNull();
  });

  it("skips jobs without apply/job URL", () => {
    const raw = baseJob();
    delete raw.applyUrl;
    delete raw.jobUrl;
    const job = adaptAshbyJob(raw, {
      boardKey: "Ashby",
      companyName: "Ashby",
    });
    expect(job).toBeNull();
  });
});
