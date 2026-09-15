import type { SupabaseClient } from "@supabase/supabase-js";
import { ASHBY_BOARDS, ashbyEndpoint } from "../boards.js";

export interface SeedResult {
  companiesUpserted: number;
  sourcesUpserted: number;
  aggregatorSourcesUpserted: number;
  adzunaEnabled: boolean;
}

export interface AggregatorSourceSeed {
  atsType: string;
  boardKey: string;
  endpoint: string;
  permissionNote: string;
  /** When true, only seed if Adzuna env keys exist. */
  requiresAdzunaKeys?: boolean;
}

export const TIER_A_SOURCES: readonly AggregatorSourceSeed[] = [
  {
    atsType: "remotive",
    boardKey: "remotive",
    endpoint: "https://remotive.com/api/remote-jobs",
    permissionNote: "Public Remotive JSON API.",
  },
  {
    atsType: "remoteok",
    boardKey: "remoteok",
    endpoint: "https://remoteok.com/api",
    permissionNote: "Public RemoteOK JSON API (User-Agent required; skip legal notice).",
  },
  {
    atsType: "jobicy",
    boardKey: "jobicy",
    endpoint: "https://jobicy.com/api/v2/remote-jobs",
    permissionNote: "Public Jobicy JSON API.",
  },
  {
    atsType: "arbeitnow",
    boardKey: "arbeitnow",
    endpoint: "https://www.arbeitnow.com/api/job-board-api",
    permissionNote: "Public Arbeitnow JSON API; filter remote=true.",
  },
  {
    atsType: "himalayas",
    boardKey: "himalayas",
    endpoint: "https://himalayas.app/jobs/api",
    permissionNote: "Public Himalayas JSON API (cursor-paginated).",
  },
  {
    atsType: "weworkremotely",
    boardKey: "weworkremotely",
    endpoint: "https://weworkremotely.com/remote-jobs.rss",
    permissionNote: "Public We Work Remotely RSS feed.",
  },
  {
    atsType: "themuse",
    boardKey: "themuse",
    endpoint: "https://www.themuse.com/api/public/jobs",
    permissionNote: "Public The Muse jobs API.",
  },
  {
    atsType: "adzuna",
    boardKey: "adzuna",
    endpoint: "https://api.adzuna.com/v1/api/jobs",
    permissionNote: "Adzuna API — requires ADZUNA_APP_ID + ADZUNA_API_KEY.",
    requiresAdzunaKeys: true,
  },
] as const;

function adzunaKeysPresent(): boolean {
  return Boolean(
    process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_API_KEY?.trim(),
  );
}

/**
 * Idempotently seed Ashby companies/sources + Tier A aggregator sources.
 */
export async function seedIngestRegistry(client: SupabaseClient): Promise<SeedResult> {
  const ashby = await seedAshbyRegistry(client);
  const aggregators = await seedAggregatorSources(client);
  return {
    companiesUpserted: ashby.companiesUpserted,
    sourcesUpserted: ashby.sourcesUpserted + aggregators.sourcesUpserted,
    aggregatorSourcesUpserted: aggregators.sourcesUpserted,
    adzunaEnabled: aggregators.adzunaEnabled,
  };
}

/** @deprecated use seedIngestRegistry */
export async function seedAshbyRegistry(
  client: SupabaseClient,
): Promise<{ companiesUpserted: number; sourcesUpserted: number }> {
  let companiesUpserted = 0;
  let sourcesUpserted = 0;

  for (const board of ASHBY_BOARDS) {
    const { data: company, error: companyError } = await client
      .from("companies")
      .upsert(
        {
          name: board.label,
          canonical_domain: board.canonicalDomain,
          career_url: `https://jobs.ashbyhq.com/${board.boardKey}`,
        },
        { onConflict: "canonical_domain" },
      )
      .select("id")
      .single();

    if (companyError || !company) {
      throw new Error(
        `Failed to upsert company ${board.label}: ${companyError?.message ?? "no row"}`,
      );
    }
    companiesUpserted += 1;

    const { error: sourceError } = await client.from("sources").upsert(
      {
        company_id: company.id,
        ats_type: "ashby",
        board_key: board.boardKey,
        endpoint: ashbyEndpoint(board.boardKey),
        permission_note: "Public Ashby Job Posting API (GET). ToS reviewed for Module 3.",
        enabled: true,
        next_poll_at: new Date().toISOString(),
      },
      { onConflict: "ats_type,board_key" },
    );

    if (sourceError) {
      throw new Error(`Failed to upsert source ${board.boardKey}: ${sourceError.message}`);
    }
    sourcesUpserted += 1;
  }

  return { companiesUpserted, sourcesUpserted };
}

export async function seedAggregatorSources(
  client: SupabaseClient,
): Promise<{ sourcesUpserted: number; adzunaEnabled: boolean }> {
  let sourcesUpserted = 0;
  const adzunaEnabled = adzunaKeysPresent();

  for (const entry of TIER_A_SOURCES) {
    if (entry.requiresAdzunaKeys && !adzunaEnabled) {
      console.log(
        "Skipping Adzuna source seed (set ADZUNA_APP_ID + ADZUNA_API_KEY to enable).",
      );
      continue;
    }

    const { error } = await client.from("sources").upsert(
      {
        company_id: null,
        ats_type: entry.atsType,
        board_key: entry.boardKey,
        endpoint: entry.endpoint,
        permission_note: entry.permissionNote,
        enabled: true,
        next_poll_at: new Date().toISOString(),
      },
      { onConflict: "ats_type,board_key" },
    );

    if (error) {
      throw new Error(`Failed to upsert aggregator ${entry.atsType}: ${error.message}`);
    }
    sourcesUpserted += 1;
  }

  return { sourcesUpserted, adzunaEnabled };
}
