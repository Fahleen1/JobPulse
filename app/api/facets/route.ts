import { NextResponse } from "next/server";
import { getFacets } from "../../../lib/jobs/search";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export async function GET(): Promise<Response> {
  const client = createSupabaseServerClient();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const facets = await getFacets(client);
    return NextResponse.json(facets, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facets failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
