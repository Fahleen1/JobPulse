import { describe, expect, it } from "vitest";
import {
  canonicalizeApplicationUrl,
  normalizeTitleForMatch,
  preferAtsObservation,
} from "./dedup.js";
import {
  computeBackoffPollAt,
  computeNextSuccessPollAt,
  jitterMs,
} from "./schedule.js";

describe("canonicalizeApplicationUrl", () => {
  it("strips utm params and lowercases host while keeping gh_jid", () => {
    const raw =
      "https://Boards.Greenhouse.IO/Acme/jobs/123?utm_source=li&utm_campaign=x&gh_jid=123";
    expect(canonicalizeApplicationUrl(raw)).toBe(
      "https://boards.greenhouse.io/Acme/jobs/123?gh_jid=123",
    );
  });

  it("removes trailing slash on pathname", () => {
    expect(canonicalizeApplicationUrl("https://example.com/jobs/1/")).toBe(
      "https://example.com/jobs/1",
    );
  });
});

describe("normalizeTitleForMatch", () => {
  it("collapses punctuation and case", () => {
    expect(normalizeTitleForMatch("Senior / Staff Engineer!")).toBe(
      "senior staff engineer",
    );
  });
});

describe("preferAtsObservation", () => {
  it("prefers incoming ATS over existing aggregator", () => {
    expect(preferAtsObservation("remotive", "ashby")).toBe(true);
    expect(preferAtsObservation("ashby", "remotive")).toBe(false);
  });
});

describe("schedule helpers", () => {
  it("applies exponential backoff capped at one hour", () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    const noJitter = () => 0;
    expect(computeBackoffPollAt(1, now, noJitter)).toBe(
      "2026-09-15T00:01:00.000Z",
    );
    expect(computeBackoffPollAt(2, now, noJitter)).toBe(
      "2026-09-15T00:02:00.000Z",
    );
    expect(computeBackoffPollAt(10, now, noJitter)).toBe(
      "2026-09-15T01:00:00.000Z",
    );
  });

  it("schedules ashby success polls around 30 minutes", () => {
    const now = new Date("2026-09-15T00:00:00.000Z");
    const at = Date.parse(computeNextSuccessPollAt("ashby", now, () => 0));
    expect(at - now.getTime()).toBe(30 * 60 * 1000);
  });

  it("jitter is within 0–60s", () => {
    expect(jitterMs(() => 0)).toBe(0);
    expect(jitterMs(() => 0.999)).toBe(59_940);
  });
});
