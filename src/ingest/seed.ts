import type { SupabaseClient } from "@supabase/supabase-js";
import { ASHBY_BOARDS, ashbyEndpoint } from "../boards.js";

export interface SeedResult {
  companiesUpserted: number;
  sourcesUpserted: number;
}

/**
 * Idempotently seed companies + Ashby sources from the Module 1 board list.
 */
export async function seedAshbyRegistry(client: SupabaseClient): Promise<SeedResult> {
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
