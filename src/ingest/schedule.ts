/** Tier B ATS default poll interval. */
export const ATS_POLL_MS = 30 * 60 * 1000;
/** Tier A aggregator default poll interval. */
export const AGGREGATOR_POLL_MS = 60 * 60 * 1000;
export const MAX_BACKOFF_MS = 60 * 60 * 1000;
export const MIN_BACKOFF_MS = 60 * 1000;
export const LEASE_MS = 15 * 60 * 1000;
export const MAX_PARALLEL_SOURCES = 5;

const ATS_TYPES = new Set([
  "ashby",
  "greenhouse",
  "lever",
  "smartrecruiters",
  "workday",
]);

export function isAtsType(atsType: string): boolean {
  return ATS_TYPES.has(atsType);
}

export function pollIntervalMs(atsType: string): number {
  return isAtsType(atsType) ? ATS_POLL_MS : AGGREGATOR_POLL_MS;
}

/** Random jitter 0–60s. */
export function jitterMs(random: () => number = Math.random): number {
  return Math.floor(random() * 60_000);
}

export function computeNextSuccessPollAt(
  atsType: string,
  now: Date = new Date(),
  random: () => number = Math.random,
): string {
  const at = new Date(now.getTime() + pollIntervalMs(atsType) + jitterMs(random));
  return at.toISOString();
}

/**
 * Exponential backoff from 1 minute, capped at 1 hour, plus jitter.
 * failureCount is the count *after* this failure is recorded.
 */
export function computeBackoffPollAt(
  failureCount: number,
  now: Date = new Date(),
  random: () => number = Math.random,
): string {
  const exp = Math.max(0, failureCount - 1);
  const delay = Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** exp);
  return new Date(now.getTime() + delay + jitterMs(random)).toISOString();
}

export function computeLeaseUntil(now: Date = new Date()): string {
  return new Date(now.getTime() + LEASE_MS).toISOString();
}
