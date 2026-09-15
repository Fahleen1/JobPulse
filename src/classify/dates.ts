import type { DateClassification } from "../types/normalized-job.js";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Unix seconds are typically 1e9–1e10; ms are ~1e12+. */
const UNIX_MS_THRESHOLD = 1e12;
/** Reject epoch / pre-modern junk as trusted publish times. */
const MIN_TRUSTED_MS = Date.UTC(2000, 0, 1);

/**
 * Normalize API date inputs (ISO strings, unix seconds, or ms) to an ISO instant.
 * Returns null when missing or unparseable.
 */
export function normalizePublishedAtInput(
  publishedAt: string | number | null | undefined,
): string | null {
  if (publishedAt == null) {
    return null;
  }

  if (typeof publishedAt === "number") {
    return fromUnixNumber(publishedAt);
  }

  const trimmed = publishedAt.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (DATE_ONLY_RE.test(trimmed)) {
    return trimmed;
  }

  if (/^\d+$/.test(trimmed)) {
    return fromUnixNumber(Number(trimmed));
  }

  const instant = Date.parse(trimmed);
  if (Number.isNaN(instant)) {
    return null;
  }
  return new Date(instant).toISOString();
}

function fromUnixNumber(value: number): string | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const ms = value < UNIX_MS_THRESHOLD ? value * 1000 : value;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

/** True when a publish instant is sane enough to show as "Posted". */
export function isPlausibleTrustedPublish(
  iso: string,
  now: Date = new Date(),
): boolean {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return false;
  }
  if (then < MIN_TRUSTED_MS) {
    return false;
  }
  // Allow a small clock skew into the future; larger = not trusted for display.
  if (then > now.getTime() + 24 * 60 * 60 * 1000) {
    return false;
  }
  return true;
}

/**
 * Classify an employer publication timestamp from a source like Ashby `publishedAt`.
 * Never invents a time when the source did not provide one.
 */
export function classifyDate(
  publishedAt: string | number | null | undefined,
  now: Date = new Date(),
): DateClassification {
  const normalized = normalizePublishedAtInput(publishedAt);
  if (normalized == null) {
    return discoveryOnly();
  }

  if (DATE_ONLY_RE.test(normalized)) {
    const parsed = parseDateOnlyUtc(normalized);
    if (parsed === null) {
      return discoveryOnly();
    }
    if (parsed.getTime() < MIN_TRUSTED_MS) {
      return discoveryOnly();
    }

    const quarantined = isFutureDateOnly(normalized, now);
    return {
      source_published_at: `${normalized}T00:00:00.000Z`,
      date_kind: "date_only",
      date_precision: "day",
      quarantined,
      date_class: quarantined ? "discovery-only" : "trusted",
    };
  }

  const instant = Date.parse(normalized);
  if (Number.isNaN(instant)) {
    return discoveryOnly();
  }

  if (instant < MIN_TRUSTED_MS) {
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
