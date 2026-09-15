import { createIngestClient } from "./db.js";
import { loadIngestEnv } from "./load-env.js";
import { runIngestion } from "./run-ingest.js";
import { SupabasePersistStore } from "./supabase-store.js";

async function main(): Promise<void> {
  loadIngestEnv();
  const args = process.argv.slice(2);
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 50;
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("Invalid --limit=");
  }

  const client = createIngestClient();
  const store = new SupabasePersistStore(client);
  const summary = await runIngestion(store, { limit });

  console.log(
    `Ingest done: considered=${summary.considered} leased=${summary.leased} ok=${summary.succeeded} failed=${summary.failed}`,
  );
  for (const row of summary.sources) {
    if (row.ok) {
      console.log(
        `✓ ${row.atsType}/${row.boardKey} fetched=${row.fetchedCount} new=${row.newCount} closed=${row.closedCount}`,
      );
    } else {
      console.log(`✗ ${row.atsType}/${row.boardKey} ${row.error}`);
    }
  }

  if (summary.failed > 0 && summary.succeeded === 0 && summary.leased > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
