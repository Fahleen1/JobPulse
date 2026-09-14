import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "./normalized-job.js";

describe("NormalizedJob type contract", () => {
  it("accepts a fully populated Module 1 proof shape", () => {
    const job: NormalizedJob = {
      external_id: "job_1",
      title: "Senior Engineer",
      description: "Build things",
      application_url: "https://jobs.ashbyhq.com/example/job_1",
      role_family: "engineering",
      seniority: "senior",
      skills: ["TypeScript"],
      employment_type: "full-time",
      workplace_type: "remote",
      eligibility_status: "unclear",
      eligible_countries: [],
      region_text: "Remote",
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      source_published_at: "2026-09-14T10:00:00.000Z",
      date_kind: "datetime",
      date_precision: "minute",
      quarantined: false,
      date_class: "trusted",
      eligibility_class: "unclear",
      board_key: "example",
      company_name: "Example Inc",
    };

    expect(job.date_class).toBe("trusted");
    expect(job.eligibility_class).toBe("unclear");
  });
});
