import { createIngestClient } from "./db.js";
import { loadIngestEnv } from "./load-env.js";
import { seedIngestRegistry } from "./seed.js";

async function main(): Promise<void> {
  loadIngestEnv();
  const client = createIngestClient();
  const result = await seedIngestRegistry(client);
  console.log(
    `Seeded registry: ashby_companies=${result.companiesUpserted} total_sources=${result.sourcesUpserted} aggregators=${result.aggregatorSourcesUpserted} adzuna=${result.adzunaEnabled}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
