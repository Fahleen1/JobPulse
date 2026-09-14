import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptAshbyJobs } from "../ashby/adapter.js";
import type { AshbyJob } from "../ashby/types.js";
import { ASHBY_BOARDS } from "../boards.js";
import { getAdapterForSource } from "./adapters/ashby.js";
import { createIngestClient } from "./db.js";
import { ingestFetchedJobs } from "./ingest-source.js";
import { loadIngestEnv } from "./load-env.js";
import { SupabasePersistStore } from "./supabase-store.js";
import type { SourceRecord } from "./types.js";

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/ashby/Ashby.json",
);

async function main(): Promise<void> {
  loadIngestEnv();
  const args = new Set(process.argv.slice(2));
  const useFixture = args.has("--fixture");
  const boardKeyArg = [...args].find((arg) => !arg.startsWith("--"));
  const boardKey = boardKeyArg ?? "Ashby";

  const client = createIngestClient();
  const store = new SupabasePersistStore(client);

  const { data: source, error } = await client
    .from("sources")
    .select(
      "id, company_id, ats_type, board_key, endpoint, enabled, baseline_at, last_success_at, next_poll_at, failure_count, lease_until",
    )
    .eq("ats_type", "ashby")
    .eq("board_key", boardKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!source) {
    throw new Error(
      `Source ashby/${boardKey} not found. Run npm run ingest:seed first.`,
    );
  }

  const sourceRecord = source as SourceRecord;
  const startedAt = new Date();
  let jobs;
  let completeSnapshot = true;

  if (useFixture) {
    if (boardKey !== "Ashby") {
      throw new Error("--fixture only supports board Ashby");
    }
    const payload = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as {
      jobs: AshbyJob[];
    };
    const board = ASHBY_BOARDS.find((entry) => entry.boardKey === "Ashby");
    jobs = adaptAshbyJobs(payload.jobs, {
      boardKey: "Ashby",
      companyName: board?.label ?? "Ashby",
    });
  } else {
    const adapter = getAdapterForSource(sourceRecord);
    const fetched = await adapter.fetchBoard(sourceRecord);
    jobs = fetched.jobs;
    completeSnapshot = fetched.completeSnapshot;
  }

  const first = await ingestFetchedJobs(store, sourceRecord, jobs, {
    completeSnapshot,
    startedAt,
    now: startedAt,
  });

  // Re-read source so baseline_at from first pass is visible to the second.
  const { data: refreshed, error: refreshError } = await client
    .from("sources")
    .select(
      "id, company_id, ats_type, board_key, endpoint, enabled, baseline_at, last_success_at, next_poll_at, failure_count, lease_until",
    )
    .eq("id", sourceRecord.id)
    .single();
  if (refreshError || !refreshed) {
    throw new Error(refreshError?.message ?? "Failed to refresh source");
  }

  const second = await ingestFetchedJobs(store, refreshed as SourceRecord, jobs, {
    completeSnapshot,
    startedAt: new Date(startedAt.getTime() + 1000),
    now: new Date(startedAt.getTime() + 1000),
  });

  console.log(
    `Persist ${boardKey}: baseline=${first.baselineImport} first new=${first.persist.newCount} second new=${second.persist.newCount} closed=${first.closure.closedCount}/${second.closure.closedCount} relisted=${first.persist.relistedCount}/${second.persist.relistedCount}`,
  );
  console.log(
    `first_seen_at stable: ${first.persist.results.every(
      (row, index) => row.firstSeenAt === second.persist.results[index]?.firstSeenAt,
    )}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
