import { FeedFilters, LoadMoreLink } from "@/components/feed-filters";
import { JobCard } from "@/components/job-card";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { windowLabel } from "@/lib/jobs/format";
import { getFacets, parseSearchParams, searchJobs } from "@/lib/jobs/search";
import type { Facets, FeedMode, FeedWindow, JobListItem } from "@/lib/jobs/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const revalidate = 60;

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const sp = await searchParams;
  const raw: {
    q?: string;
    role?: string;
    country?: string;
    level?: string;
    window?: FeedWindow;
    mode?: FeedMode;
    cursor?: string;
    limit: number;
  } = { limit: 20 };

  const q = first(sp.q);
  const role = first(sp.role);
  const country = first(sp.country);
  const level = first(sp.level);
  const window = first(sp.window);
  const mode = first(sp.mode);
  const cursor = first(sp.cursor);
  if (q) raw.q = q;
  if (role) raw.role = role;
  if (country) raw.country = country;
  if (level) raw.level = level;
  if (window === "24h" || window === "48h" || window === "7d") raw.window = window;
  if (mode === "verified" || mode === "discovered") raw.mode = mode;
  if (cursor) raw.cursor = cursor;

  const params = parseSearchParams(raw);

  const client = createSupabaseServerClient();
  let jobs: JobListItem[] = [];
  let nextCursor: string | null = null;
  let facets: Facets = { roles: [], countries: [], levels: [] };
  let errorMessage: string | null = null;

  if (!client) {
    errorMessage = "Supabase is not configured. Add public env vars to .env.";
  } else {
    try {
      const [result, facetResult] = await Promise.all([
        searchJobs(client, params),
        getFacets(client),
      ]);
      jobs = result.jobs;
      nextCursor = result.nextCursor;
      facets = facetResult;
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Failed to load jobs";
    }
  }

  const filterState: {
    q?: string;
    role?: string;
    country?: string;
    level?: string;
    window: FeedWindow;
    mode: FeedMode;
  } = {
    window: params.window ?? "24h",
    mode: params.mode ?? "verified",
  };
  if (params.q) filterState.q = params.q;
  if (params.role) filterState.role = params.role;
  if (params.country) filterState.country = params.country;
  if (params.level) filterState.level = params.level;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <section className="mb-8">
        <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
          JobPulse
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Fresh remote IT roles. Verified mode uses employer publish times;
          discovered mode uses when we first saw the listing.
        </p>
      </section>

      <FeedFilters state={filterState} facets={facets} />

      <section className="mt-6">
        {errorMessage ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="text-sm text-destructive">
              {errorMessage}
              <p className="mt-2 text-muted-foreground">
                If you just added the listings view, run the latest Supabase
                migration, then{" "}
                <Link href="/health" className="text-primary underline">
                  check health
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-foreground">No jobs match these filters.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try discovered mode, widen to 7 days, or clear role/country
                filters. Baseline-only listings never appear as newly posted.
              </p>
              <Link
                href="/?mode=discovered&window=7d"
                className={cn(
                  buttonVariants({ variant: "link" }),
                  "mt-4 inline-flex",
                )}
              >
                Show discovered (7 days)
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              {jobs.length} result{jobs.length === 1 ? "" : "s"}
              {filterState.mode === "verified"
                ? " · verified publish times"
                : " · discovery times"}
              {" · "}
              last {windowLabel(filterState.window)}
            </p>
            <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} mode={filterState.mode} />
              ))}
            </div>
            {nextCursor ? (
              <div className="mt-6 flex justify-center">
                <LoadMoreLink state={filterState} cursor={nextCursor} />
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
