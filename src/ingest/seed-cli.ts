import { createIngestClient } from "./db.js";
import { loadIngestEnv } from "./load-env.js";
import { seedAshbyRegistry } from "./seed.js";

async function main(): Promise<void> {
  loadIngestEnv();
  const client = createIngestClient();
  const result = await seedAshbyRegistry(client);
  console.log(
    `Seeded Ashby registry: companies=${result.companiesUpserted} sources=${result.sourcesUpserted}`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
