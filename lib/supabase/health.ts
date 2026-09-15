import { createSupabaseServerClient } from "./server";

export interface FoundationHealth {
  configured: boolean;
  ok: boolean;
  checkedAt: string;
  message: string;
  counts: {
    companies: number | null;
    sources: number | null;
    jobs: number | null;
  };
}

async function countRows(
  client: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  table: "companies" | "sources" | "jobs",
): Promise<{ count: number | null; error: string | null }> {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    return { count: null, error: error.message };
  }

  return { count: count ?? 0, error: null };
}

export async function getFoundationHealth(): Promise<FoundationHealth> {
  const checkedAt = new Date().toISOString();
  const client = createSupabaseServerClient();

  if (!client) {
    return {
      configured: false,
      ok: false,
      checkedAt,
      message:
        "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel (or in .env.local).",
      counts: { companies: null, sources: null, jobs: null },
    };
  }

  const [companies, sources, jobs] = await Promise.all([
    countRows(client, "companies"),
    countRows(client, "sources"),
    countRows(client, "jobs"),
  ]);

  const firstError = companies.error ?? sources.error ?? jobs.error;
  if (firstError) {
    return {
      configured: true,
      ok: false,
      checkedAt,
      message: `Database query failed: ${firstError}. Apply supabase/migrations/20260914120000_init.sql in the Supabase SQL editor.`,
      counts: {
        companies: companies.count,
        sources: sources.count,
        jobs: jobs.count,
      },
    };
  }

  return {
    configured: true,
    ok: true,
    checkedAt,
    message: "Supabase reachable. Schema responds to count queries.",
    counts: {
      companies: companies.count,
      sources: sources.count,
      jobs: jobs.count,
    },
  };
}
