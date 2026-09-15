import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { RemotiveAdapter } from "./remotive.js";
import { RemoteOkAdapter } from "./remoteok.js";
import { getAdapterForSource, listRegisteredAtsTypes } from "./registry.js";
import type { SourceRecord } from "../types.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../../../fixtures/aggregators");

function source(ats: string, endpoint: string): SourceRecord {
  return {
    id: "s1",
    company_id: null,
    ats_type: ats,
    board_key: ats,
    endpoint,
    enabled: true,
    baseline_at: null,
    last_success_at: null,
    next_poll_at: new Date().toISOString(),
    failure_count: 0,
    lease_until: null,
  };
}

describe("Tier A adapters", () => {
  it("registers expected ats types", () => {
    expect(listRegisteredAtsTypes()).toEqual(
      expect.arrayContaining([
        "ashby",
        "remotive",
        "remoteok",
        "jobicy",
        "arbeitnow",
        "himalayas",
        "weworkremotely",
        "themuse",
        "adzuna",
      ]),
    );
  });

  it("maps Remotive fixture jobs to NormalizedJob", async () => {
    const body = readFileSync(join(fixtureDir, "remotive-sample.json"), "utf8");
    const fetchImpl = vi.fn(
      async () =>
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    // RemotiveAdapter uses fetchJson which uses global fetch — stub it.
    vi.stubGlobal("fetch", fetchImpl);

    const adapter = new RemotiveAdapter();
    const result = await adapter.fetchBoard(
      source("remotive", "https://remotive.com/api/remote-jobs"),
    );
    expect(result.completeSnapshot).toBe(true);
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs[0]?.company_name).toBe("Acme Labs");
    expect(result.jobs[1]?.eligibility_status).toBe("worldwide");

    vi.unstubAllGlobals();
  });

  it("skips RemoteOK legal notice item", async () => {
    const payload = [
      { legal: "notice" },
      {
        id: "1",
        position: "Engineer",
        company: "Co",
        description: "hi",
        apply_url: "https://example.com/apply/1",
        date: "2026-09-01T00:00:00.000Z",
        location: "Remote",
        tags: ["js"],
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const result = await new RemoteOkAdapter().fetchBoard(
      source("remoteok", "https://remoteok.com/api"),
    );
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.title).toBe("Engineer");
    vi.unstubAllGlobals();
  });

  it("resolves adapters via registry", () => {
    expect(getAdapterForSource(source("jobicy", "https://jobicy.com")).atsType).toBe(
      "jobicy",
    );
  });
});
