import type { FeedMode, FeedWindow, JobListItem } from "./types";

const MIN_TRUSTED_MS = Date.UTC(2000, 0, 1);

/** Skip epoch / garbage publish times already stored in the DB. */
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
  if (then > now.getTime() + 24 * 60 * 60 * 1000) {
    return false;
  }
  return true;
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) {
    return "Other";
  }
  const labels: Record<string, string> = {
    engineering: "Engineering",
    qa: "QA",
    devops: "DevOps",
    data: "Data / AI",
    design: "Design",
    product: "Product",
    hr: "HR / Talent",
    support: "Support",
    other: "Other",
  };
  return labels[role] ?? role;
}

export function countryLabel(code: string): string {
  const upper = code.toUpperCase();
  const overrides: Record<string, string> = {
    AE: "UAE",
    GB: "United Kingdom",
    US: "United States",
    PK: "Pakistan",
  };
  if (overrides[upper]) {
    return overrides[upper];
  }
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(upper);
    return name ?? upper;
  } catch {
    return upper;
  }
}

/** Target-market codes shown first in country filters. */
export const PREFERRED_COUNTRY_CODES = [
  "US",
  "CA",
  "GB",
  "DE",
  "FR",
  "NL",
  "AU",
  "IE",
  "ES",
  "IT",
  "SE",
  "CH",
  "AE",
  "SA",
  "PK",
  "SG",
] as const;

export function orderCountryFacet(
  codes: string[],
  selected?: string,
): string[] {
  const set = new Set(codes.map((c) => c.toUpperCase()));
  if (selected) {
    set.add(selected.toUpperCase());
  }
  const preferred = PREFERRED_COUNTRY_CODES.filter((c) => set.has(c));
  const rest = [...set]
    .filter((c) => !PREFERRED_COUNTRY_CODES.includes(c as never))
    .sort((a, b) => countryLabel(a).localeCompare(countryLabel(b)));
  return [...preferred, ...rest];
}

export function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
): string | null {
  if (min == null && max == null) {
    return null;
  }
  const cur = currency ?? "USD";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 0,
    }).format(n);
  if (min != null && max != null) {
    return `${fmt(min)} – ${fmt(max)}`;
  }
  if (min != null) {
    return `From ${fmt(min)}`;
  }
  return `Up to ${fmt(max!)}`;
}

export function formatEligibility(
  status: string,
  countries: string[],
  regionText: string,
): string {
  if (status === "worldwide") {
    return "Worldwide";
  }
  if (status === "restricted" && countries.length > 0) {
    return countries.map(countryLabel).join(", ");
  }
  if (regionText.trim()) {
    return regionText;
  }
  return "Eligibility unclear";
}

/** Freshness display using the correct clock. */
export function formatJobWhen(
  job: Pick<
    JobListItem,
    "trusted_published_at" | "trusted_date_kind" | "discovered_at"
  >,
  now: Date = new Date(),
  options?: { mode?: FeedMode },
): { label: string; kind: "posted" | "discovered" } {
  const preferDiscovered = options?.mode === "discovered";

  if (preferDiscovered && job.discovered_at) {
    return {
      label: `Discovered ${relativeTime(job.discovered_at, now)}`,
      kind: "discovered",
    };
  }

  const trusted = job.trusted_published_at;
  if (trusted && isPlausibleTrustedPublish(trusted, now)) {
    if (job.trusted_date_kind === "date_only") {
      const day = new Date(trusted);
      return {
        label: `Posted ${day.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        })}`,
        kind: "posted",
      };
    }
    return {
      label: `Posted ${relativeTime(trusted, now)}`,
      kind: "posted",
    };
  }

  if (job.discovered_at) {
    return {
      label: `Discovered ${relativeTime(job.discovered_at, now)}`,
      kind: "discovered",
    };
  }

  return { label: "Date unavailable", kind: "discovered" };
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return "recently";
  }
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function windowLabel(window: FeedWindow): string {
  switch (window) {
    case "24h":
      return "24 hours";
    case "48h":
      return "48 hours";
    case "7d":
      return "7 days";
    default: {
      const _exhaustive: never = window;
      return _exhaustive;
    }
  }
}

export function windowStartIso(window: FeedWindow, now: Date = new Date()): string {
  let hours: number;
  switch (window) {
    case "24h":
      hours = 24;
      break;
    case "48h":
      hours = 48;
      break;
    case "7d":
      hours = 7 * 24;
      break;
    default: {
      const _exhaustive: never = window;
      return _exhaustive;
    }
  }
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

export function encodeCursor(sortAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ sortAt, id }), "utf8").toString("base64url");
}

export function decodeCursor(
  cursor: string | null | undefined,
): { sortAt: string; id: string } | null {
  if (!cursor) {
    return null;
  }
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { sortAt?: string; id?: string; createdAt?: string };
    const sortAt = parsed.sortAt ?? parsed.createdAt;
    if (!sortAt || !parsed.id) {
      return null;
    }
    return { sortAt, id: parsed.id };
  } catch {
    return null;
  }
}

export function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
