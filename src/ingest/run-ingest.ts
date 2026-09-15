import type { PersistStore } from "./persist.js";
import {
  computeBackoffPollAt,
  computeLeaseUntil,
  computeNextSuccessPollAt,
  MAX_PARALLEL_SOURCES,
} from "./schedule.js";
import { getAdapterForSource } from "./adapters/registry.js";
import { ingestFetchedJobs } from "./ingest-source.js";
import { recordIngestionRun } from "./persist.js";
import type { SourceRecord } from "./types.js";

export interface SourceRunSummary {
  sourceId: string;
  boardKey: string;
  atsType: string;
  ok: boolean;
  newCount: number;
  closedCount: number;
  fetchedCount: number;
  error?: string;
}

export interface IngestRunSummary {
  considered: number;
  leased: number;
  succeeded: number;
  failed: number;
  sources: SourceRunSummary[];
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runOne(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) {
        return;
      }
      results[index] = await worker(item);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => runOne(),
  );
  await Promise.all(runners);
  return results;
}

/**
 * Select due sources, lease them, fetch+persist with bounded concurrency.
 */
export async function runIngestion(
  store: PersistStore,
  options: {
    now?: Date;
    limit?: number;
    concurrency?: number;
  } = {},
): Promise<IngestRunSummary> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 50;
  const concurrency = options.concurrency ?? MAX_PARALLEL_SOURCES;

  const due = await store.listDueSources(now, limit);
  const leased: SourceRecord[] = [];

  for (const source of due) {
    const acquired = await store.tryAcquireLease(
      source.id,
      computeLeaseUntil(now),
      now,
    );
    if (acquired) {
      leased.push(acquired);
    }
  }

  const summaries = await mapPool(leased, concurrency, async (source) =>
    processOneSource(store, source, now),
  );

  return {
    considered: due.length,
    leased: leased.length,
    succeeded: summaries.filter((row) => row.ok).length,
    failed: summaries.filter((row) => !row.ok).length,
    sources: summaries,
  };
}

async function processOneSource(
  store: PersistStore,
  source: SourceRecord,
  now: Date,
): Promise<SourceRunSummary> {
  const startedAt = new Date();
  try {
    const adapter = getAdapterForSource(source);
    const fetched = await adapter.fetchBoard(source);
    const result = await ingestFetchedJobs(store, source, fetched.jobs, {
      completeSnapshot: fetched.completeSnapshot,
      startedAt,
      now,
    });

    await store.updateSource(source.id, {
      failure_count: 0,
      last_success_at: now.toISOString(),
      next_poll_at: computeNextSuccessPollAt(source.ats_type, now),
      lease_until: null,
    });

    return {
      sourceId: source.id,
      boardKey: source.board_key,
      atsType: source.ats_type,
      ok: true,
      newCount: result.persist.newCount,
      closedCount: result.closure.closedCount,
      fetchedCount: result.persist.fetchedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Soft-skip Adzuna when API keys are not configured.
    if (message.startsWith("ADZUNA_SKIP:")) {
      await store.updateSource(source.id, {
        failure_count: 0,
        next_poll_at: computeNextSuccessPollAt(source.ats_type, now),
        lease_until: null,
      });
      return {
        sourceId: source.id,
        boardKey: source.board_key,
        atsType: source.ats_type,
        ok: true,
        newCount: 0,
        closedCount: 0,
        fetchedCount: 0,
        error: message,
      };
    }

    const nextFailure = source.failure_count + 1;
    await store.updateSource(source.id, {
      failure_count: nextFailure,
      next_poll_at: computeBackoffPollAt(nextFailure, now),
      lease_until: null,
    });

    const finishedAt = new Date();
    await recordIngestionRun(store, {
      sourceId: source.id,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      completeSnapshot: false,
      fetchedCount: 0,
      newCount: 0,
      changedCount: 0,
      closedCount: 0,
      errorCode: "fetch_or_persist_failed",
      errorMessage: message.slice(0, 2000),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    });

    return {
      sourceId: source.id,
      boardKey: source.board_key,
      atsType: source.ats_type,
      ok: false,
      newCount: 0,
      closedCount: 0,
      fetchedCount: 0,
      error: message,
    };
  }
}
