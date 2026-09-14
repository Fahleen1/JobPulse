import type { DateClassification } from "../types/normalized-job.js";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Classify an employer publication timestamp from a source like Ashby `publishedAt`.
 * Never invents a time when the source did not provide one.
 */
export function classifyDate(
  publishedAt: string | null | undefined,
  now: Date = new Date(),
): DateClassification {
  if (publishedAt == null) {
    return discoveryOnly();
  }

  const trimmed = publishedAt.trim();
  if (trimmed.length === 0) {
    return discoveryOnly();
  }

  if (DATE_ONLY_RE.test(trimmed)) {
    const parsed = parseDateOnlyUtc(trimmed);
    if (parsed === null) {
      return discoveryOnly();
    }

    const quarantined = isFutureDateOnly(trimmed, now);
    return {
      source_published_at: `${trimmed}T00:00:00.000Z`,
      date_kind: "date_only",
      date_precision: "day",
      quarantined,
      date_class: quarantined ? "discovery-only" : "trusted",
    };
  }

  const instant = Date.parse(trimmed);
  if (Number.isNaN(instant)) {
    return discoveryOnly();
  }

  const source = new Date(instant);
  const quarantined = source.getTime() > now.getTime();

  return {
    source_published_at: source.toISOString(),
    date_kind: "datetime",
    date_precision: "minute",
    quarantined,
    date_class: quarantined ? "discovery-only" : "trusted",
  };
}

function discoveryOnly(): DateClassification {
  return {
    source_published_at: null,
    date_kind: "discovered_only",
    date_precision: "unknown",
    quarantined: false,
    date_class: "discovery-only",
  };
}

function parseDateOnlyUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Quarantine when the entire calendar day is still after "today" in UTC. */
function isFutureDateOnly(value: string, now: Date): boolean {
  const parsed = parseDateOnlyUtc(value);
  if (parsed === null) {
    return false;
  }
  const todayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return parsed.getTime() > todayStart;
}
