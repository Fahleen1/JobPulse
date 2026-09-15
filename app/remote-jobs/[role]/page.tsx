import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobCard } from "@/components/job-card";
import { countryLabel, roleLabel } from "@/lib/jobs/format";
import { getFacets, searchJobsForCategory } from "@/lib/jobs/search";
import { ROLE_FAMILIES } from "@/lib/jobs/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 60;

interface CategoryProps {
  params: Promise<{ role: string }>;
}

export async function generateMetadata({
  params,
}: CategoryProps): Promise<Metadata> {
  const { role } = await params;
  return {
    title: `Remote ${roleLabel(role)} jobs`,
    description: `Remote ${roleLabel(role)} roles on JobPulse`,
  };
}

export default async function RoleCategoryPage({ params }: CategoryProps) {
  const { role } = await params;
  if (!ROLE_FAMILIES.includes(role as never)) {
    notFound();
  }

  const client = createSupabaseServerClient();
  if (!client) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-muted-foreground">Supabase is not configured.</p>
      </main>
    );
  }

  const [result, facets] = await Promise.all([
    searchJobsForCategory(client, role),
    getFacets(client),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Feed
        </Link>
        {" / "}
        Remote jobs
      </p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Remote {roleLabel(role)} jobs
      </h1>
      <p className="mt-2 text-muted-foreground">
        Active and relisted roles in this family (7-day discovery window).
      </p>

      {facets.countries.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {facets.countries.slice(0, 12).map((code) => (
            <Link
              key={code}
              href={`/remote-jobs/${role}/${code.toLowerCase()}`}
              className="rounded-md border border-border bg-white/70 px-2.5 py-1 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              {countryLabel(code)}
            </Link>
          ))}
        </div>
      ) : null}

      <section className="mt-8">
        {result.jobs.length === 0 ? (
          <p className="rounded-lg border border-border bg-white/60 px-4 py-8 text-center text-muted-foreground">
            No recent roles in this category.{" "}
            <Link href="/" className="text-primary underline">
              Browse the feed
            </Link>
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-white/70 px-4 sm:px-5">
            {result.jobs.map((job) => (
              <JobCard key={job.id} job={job} mode="discovered" />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
