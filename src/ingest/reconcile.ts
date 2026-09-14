import type { PersistStore } from "./persist.js";

export const CLOSURE_MISS_THRESHOLD = 2;

export interface ClosureReconcileResult {
  /** Open listings that were missing from this complete snapshot. */
  missingIncremented: number;
  /** Jobs closed after reaching the miss threshold. */
  closedCount: number;
  skipped: boolean;
  skipReason: string | null;
}

/**
 * Complete-snapshot closure reconciliation.
 * Incomplete/failed fetches must never call this with completeSnapshot=true.
 */
export async function reconcileClosures(
  store: PersistStore,
  sourceId: string,
  seenExternalIds: ReadonlySet<string>,
  completeSnapshot: boolean,
  now: Date = new Date(),
): Promise<ClosureReconcileResult> {
  if (!completeSnapshot) {
    return {
      missingIncremented: 0,
      closedCount: 0,
      skipped: true,
      skipReason: "incomplete_or_failed_snapshot",
    };
  }

  const open = await store.listOpenJobSources(sourceId);
  const nowIso = now.toISOString();
  let missingIncremented = 0;
  let closedCount = 0;

  for (const row of open) {
    if (seenExternalIds.has(row.external_id)) {
      continue;
    }

    const nextMissing = row.missing_count + 1;
    missingIncremented += 1;

    if (nextMissing >= CLOSURE_MISS_THRESHOLD) {
      await store.updateJobSource(row.id, {
        missing_count: nextMissing,
        closed_at: nowIso,
        last_seen_at: row.last_seen_at,
      });
      await store.updateJob(row.job_id, { status: "closed" });
      closedCount += 1;
    } else {
      await store.updateJobSource(row.id, {
        missing_count: nextMissing,
      });
    }
  }

  return {
    missingIncremented,
    closedCount,
    skipped: false,
    skipReason: null,
  };
}
