import type { NormalizedJob } from "../types/normalized-job.js";
import {
  persistNormalizedJobs,
  recordIngestionRun,
  type PersistBatchResult,
  type PersistStore,
} from "./persist.js";
import { reconcileClosures, type ClosureReconcileResult } from "./reconcile.js";
import type { SourceRecord } from "./types.js";

export interface IngestSourceResult {
  baselineImport: boolean;
  persist: PersistBatchResult;
  closure: ClosureReconcileResult;
  ingestionRunId: string;
}

/**
 * Full success-path ingest for one source after jobs were fetched+normalized.
 * Applies baseline marking, persist, closure reconciliation, and run logging.
 */
export async function ingestFetchedJobs(
  store: PersistStore,
  source: SourceRecord,
  jobs: NormalizedJob[],
  options: {
    completeSnapshot: boolean;
    now?: Date;
    startedAt?: Date;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
): Promise<IngestSourceResult> {
  const now = options.now ?? new Date();
  const startedAt = options.startedAt ?? now;
  const baselineImport = source.baseline_at === null && options.completeSnapshot;

  const persist = await persistNormalizedJobs(store, source, jobs, {
    now,
    baselineImport,
  });

  const seen = new Set(jobs.map((job) => job.external_id));
  const closure = await reconcileClosures(
    store,
    source.id,
    seen,
    options.completeSnapshot,
    now,
  );

  if (baselineImport) {
    await store.updateSource(source.id, {
      baseline_at: now.toISOString(),
      last_success_at: now.toISOString(),
    });
  } else if (options.completeSnapshot) {
    await store.updateSource(source.id, {
      last_success_at: now.toISOString(),
    });
  }

  const finishedAt = new Date();
  const run = await recordIngestionRun(store, {
    sourceId: source.id,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    completeSnapshot: options.completeSnapshot,
    fetchedCount: persist.fetchedCount,
    newCount: persist.newCount,
    changedCount: persist.changedCount,
    closedCount: closure.closedCount,
    errorCode: options.errorCode ?? null,
    errorMessage: options.errorMessage ?? null,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  });

  return {
    baselineImport,
    persist,
    closure,
    ingestionRunId: run.id,
  };
}
