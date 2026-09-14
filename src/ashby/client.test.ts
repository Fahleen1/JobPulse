import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { AshbyClientError, fetchAshbyBoard } from "./client.js";
import type { AshbyJobBoardResponse } from "./types.js";

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/ashby/Ashby.json",
);

describe("fetchAshbyBoard", () => {
  it("parses a fixture-shaped Ashby response", async () => {
    const body = readFileSync(fixturePath, "utf8");
    const fetchImpl = vi.fn(async () =>
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await fetchAshbyBoard("Ashby", { fetchImpl });
    expect(result.apiVersion).toBe("1");
    expect(result.jobs.length).toBeGreaterThan(0);
    expect(result.jobs[0]?.id).toBeTruthy();
    expect(result.jobs[0]?.title).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects invalid board keys", async () => {
    await expect(fetchAshbyBoard("../evil")).rejects.toBeInstanceOf(AshbyClientError);
  });

  it("throws on HTTP errors", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("nope", { status: 404 }),
    );
    await expect(fetchAshbyBoard("missing", { fetchImpl })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("validates required job fields", async () => {
    const bad: AshbyJobBoardResponse = {
      apiVersion: "1",
      jobs: [{ id: "", title: "x" } as AshbyJobBoardResponse["jobs"][number]],
    };
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(bad), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    await expect(fetchAshbyBoard("Ashby", { fetchImpl })).rejects.toBeInstanceOf(
      AshbyClientError,
    );
  });
});
