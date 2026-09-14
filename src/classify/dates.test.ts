import { describe, expect, it } from "vitest";
import { classifyDate } from "./dates.js";

describe("classifyDate", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");

  it("treats full ISO datetimes as trusted", () => {
    const result = classifyDate("2024-03-04T14:29:08.532+00:00", now);
    expect(result).toEqual({
      source_published_at: "2024-03-04T14:29:08.532Z",
      date_kind: "datetime",
      date_precision: "minute",
      quarantined: false,
      date_class: "trusted",
    });
  });

  it("treats date-only values as trusted day precision", () => {
    const result = classifyDate("2026-09-10", now);
    expect(result.date_kind).toBe("date_only");
    expect(result.date_precision).toBe("day");
    expect(result.date_class).toBe("trusted");
    expect(result.source_published_at).toBe("2026-09-10T00:00:00.000Z");
  });

  it("returns discovery-only for missing or unparseable values", () => {
    expect(classifyDate(null, now).date_class).toBe("discovery-only");
    expect(classifyDate(undefined, now).date_kind).toBe("discovered_only");
    expect(classifyDate("not-a-date", now).source_published_at).toBeNull();
  });

  it("quarantines future timestamps into discovery-only", () => {
    const result = classifyDate("2026-12-01T00:00:00.000Z", now);
    expect(result.quarantined).toBe(true);
    expect(result.date_class).toBe("discovery-only");
    expect(result.date_kind).toBe("datetime");
  });
});
