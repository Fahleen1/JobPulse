import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { adaptAshbyJobs } from "./ashby/adapter.js";
import { fetchAshbyBoard, AshbyClientError } from "./ashby/client.js";
import type { AshbyJob } from "./ashby/types.js";
import { ASHBY_BOARDS } from "./boards.js";
import type { NormalizedJob } from "./types/normalized-job.js";

interface BoardSummary {
  boardKey: string;
  label: string;
  fetched: number;
  adapted: number;
  trustedDates: number;
  discoveryDates: number;
  explicitEligibility: number;
  unclearEligibility: number;
  error?: string;
}

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/ashby/Ashby.json",
);

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const fixtureOnly = args.has("--fixture");
  const verbose = args.has("--verbose") || args.has("-v");

  console.log("JobPulse Module 1 proof — Ashby normalize + classify\n");

  const summaries: BoardSummary[] = [];
  const allJobs: NormalizedJob[] = [];

  if (fixtureOnly) {
    const board = ASHBY_BOARDS.find((entry) => entry.boardKey === "Ashby");
    if (!board) {
      throw new Error("Ashby board missing from ASHBY_BOARDS");
    }
    const payload = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as {
      jobs: AshbyJob[];
    };
    const adapted = adaptAshbyJobs(payload.jobs, {
      boardKey: board.boardKey,
      companyName: board.label,
    });
    allJobs.push(...adapted);
    summaries.push(summarizeBoard(board.boardKey, board.label, payload.jobs.length, adapted));
    console.log(
      `✓ ${board.label.padEnd(12)} fixture fetched=${payload.jobs.length} adapted=${adapted.length}`,
    );
  } else {
    for (const board of ASHBY_BOARDS) {
      try {
        const response = await fetchAshbyBoard(board.boardKey);
        const adapted = adaptAshbyJobs(response.jobs, {
          boardKey: board.boardKey,
          companyName: board.label,
        });
        allJobs.push(...adapted);
        summaries.push(
          summarizeBoard(board.boardKey, board.label, response.jobs.length, adapted),
        );
        console.log(
          `✓ ${board.label.padEnd(12)} fetched=${response.jobs.length} adapted=${adapted.length}`,
        );
      } catch (error) {
        const message =
          error instanceof AshbyClientError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);
        summaries.push({
          boardKey: board.boardKey,
          label: board.label,
          fetched: 0,
          adapted: 0,
          trustedDates: 0,
          discoveryDates: 0,
          explicitEligibility: 0,
          unclearEligibility: 0,
          error: message,
        });
        console.log(`✗ ${board.label.padEnd(12)} ${message}`);
      }
    }
  }

  console.log("\n--- Sample jobs (up to 5 per board) ---\n");
  for (const board of summaries) {
    if (board.error) {
      continue;
    }
    const sample = allJobs
      .filter((job) => job.board_key === board.boardKey)
      .slice(0, 5);
    if (sample.length === 0) {
      continue;
    }
    console.log(`[${board.label}]`);
    for (const job of sample) {
      printJobLine(job, verbose);
    }
    console.log("");
  }

  console.log("--- Totals ---\n");
  const ok = summaries.filter((row) => !row.error);
  const failed = summaries.filter((row) => row.error);
  const totals = ok.reduce(
    (acc, row) => {
      acc.fetched += row.fetched;
      acc.adapted += row.adapted;
      acc.trustedDates += row.trustedDates;
      acc.discoveryDates += row.discoveryDates;
      acc.explicitEligibility += row.explicitEligibility;
      acc.unclearEligibility += row.unclearEligibility;
      return acc;
    },
    {
      fetched: 0,
      adapted: 0,
      trustedDates: 0,
      discoveryDates: 0,
      explicitEligibility: 0,
      unclearEligibility: 0,
    },
  );

  console.log(`boards_ok=${ok.length} boards_failed=${failed.length}`);
  console.log(
    `fetched=${totals.fetched} adapted=${totals.adapted} (remote/hybrid with apply URL)`,
  );
  console.log(
    `date: trusted=${totals.trustedDates} discovery-only=${totals.discoveryDates}`,
  );
  console.log(
    `eligibility: explicit=${totals.explicitEligibility} unclear=${totals.unclearEligibility}`,
  );

  if (failed.length > 0) {
    console.log("\nFailed boards:");
    for (const row of failed) {
      console.log(`- ${row.label}: ${row.error}`);
    }
  }

  if (totals.adapted === 0) {
    process.exitCode = 1;
  }
}

function summarizeBoard(
  boardKey: string,
  label: string,
  fetched: number,
  adapted: NormalizedJob[],
): BoardSummary {
  return {
    boardKey,
    label,
    fetched,
    adapted: adapted.length,
    trustedDates: adapted.filter((job) => job.date_class === "trusted").length,
    discoveryDates: adapted.filter((job) => job.date_class === "discovery-only").length,
    explicitEligibility: adapted.filter((job) => job.eligibility_class === "explicit")
      .length,
    unclearEligibility: adapted.filter((job) => job.eligibility_class === "unclear")
      .length,
  };
}

function printJobLine(job: NormalizedJob, verbose: boolean): void {
  const base = `- ${job.title} | id=${job.external_id} | date=${job.date_class} | eligibility=${job.eligibility_class} (${job.eligibility_status})`;
  if (!verbose) {
    console.log(base);
    return;
  }
  console.log(
    `${base} | workplace=${job.workplace_type} | region=${JSON.stringify(job.region_text)} | published=${job.source_published_at ?? "n/a"}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
