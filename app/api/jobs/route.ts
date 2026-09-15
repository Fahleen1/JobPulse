import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { searchJobs } from "../../../lib/jobs/search";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(request: Request): Promise<Response> {
  const client = createSupabaseServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const url = new URL(request.url);
    const result = await searchJobs(client, url.searchParams);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
