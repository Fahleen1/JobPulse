import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  formatEligibility,
  formatJobWhen,
  formatSalary,
  relativeTime,
  windowStartIso,
} from "./format";

describe("formatSalary", () => {
  it("formats ranges", () => {
    expect(formatSalary(100000, 150000, "USD")).toMatch(/100,000/);
  });

  it("returns null when empty", () => {
    expect(formatSalary(null, null, null)).toBeNull();
  });
});

describe("formatEligibility", () => {
  it("labels worldwide and restricted", () => {
    expect(formatEligibility("worldwide", [], "")).toBe("Worldwide");
    expect(formatEligibility("restricted", ["US", "CA"], "")).toContain(
      "United States",
    );
  });
});

describe("formatJobWhen", () => {
  it("prefers trusted datetime clock", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const result = formatJobWhen(
      {
        trusted_published_at: "2026-09-15T10:00:00.000Z",
        trusted_date_kind: "datetime",
        discovered_at: "2026-09-14T00:00:00.000Z",
      },
      now,
    );
    expect(result.kind).toBe("posted");
    expect(result.label).toContain("Posted");
  });

  it("falls back to discovered", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const result = formatJobWhen(
      {
        trusted_published_at: null,
        trusted_date_kind: null,
        discovered_at: "2026-09-15T11:00:00.000Z",
      },
      now,
    );
    expect(result.kind).toBe("discovered");
  });

  it("ignores epoch trusted dates", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const result = formatJobWhen(
      {
        trusted_published_at: "1970-01-01T00:00:00.000Z",
        trusted_date_kind: "datetime",
        discovered_at: "2026-09-15T10:00:00.000Z",
      },
      now,
    );
    expect(result.kind).toBe("discovered");
    expect(result.label).toContain("Discovered");
  });

  it("uses discovery clock when mode is discovered", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const result = formatJobWhen(
      {
        trusted_published_at: "2026-09-15T10:00:00.000Z",
        trusted_date_kind: "datetime",
        discovered_at: "2026-09-15T11:00:00.000Z",
      },
      now,
      { mode: "discovered" },
    );
    expect(result.kind).toBe("discovered");
    expect(result.label).toContain("Discovered");
  });
});

describe("cursor helpers", () => {
  it("round-trips", () => {
    const encoded = encodeCursor("2026-09-15T00:00:00.000Z", "abc");
    expect(decodeCursor(encoded)).toEqual({
      sortAt: "2026-09-15T00:00:00.000Z",
      id: "abc",
    });
  });
});

describe("windowStartIso", () => {
  it("subtracts 24h", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(windowStartIso("24h", now)).toBe("2026-09-14T12:00:00.000Z");
  });

  it("subtracts 7d", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(windowStartIso("7d", now)).toBe("2026-09-08T12:00:00.000Z");
  });
});

describe("relativeTime", () => {
  it("formats hours", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(relativeTime("2026-09-15T10:00:00.000Z", now)).toBe("2h ago");
  });
});
