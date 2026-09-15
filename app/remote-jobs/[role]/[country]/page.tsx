import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobCard } from "@/components/job-card";
import { countryLabel, roleLabel } from "@/lib/jobs/format";
import { searchJobsForCategory } from "@/lib/jobs/search";
import { ROLE_FAMILIES } from "@/lib/jobs/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 60;

interface CountryCategoryProps {
  params: Promise<{ role: string; country: string }>;
}

export async function generateMetadata({
  params,
}: CountryCategoryProps): Promise<Metadata> {
  const { role, country } = await params;
  const code = country.toUpperCase();
  return {
    title: `Remote ${roleLabel(role)} jobs in ${countryLabel(code)}`,
  };
}

export default async function RoleCountryPage({
  params,
}: CountryCategoryProps) {
  const { role, country } = await params;
  const code = country.toUpperCase();
  if (!ROLE_FAMILIES.includes(role as never) || !/^[A-Z]{2}$/.test(code)) {
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

  const result = await searchJobsForCategory(client, role, code);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Feed
        </Link>
        {" / "}
        <Link href={`/remote-jobs/${role}`} className="hover:text-foreground">
          {roleLabel(role)}
        </Link>
        {" / "}
        {countryLabel(code)}
      </p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Remote {roleLabel(role)} · {countryLabel(code)}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Roles listing {code} in eligibility (7-day discovery window).
      </p>

      <section className="mt-8">
        {result.jobs.length === 0 ? (
          <p className="rounded-lg border border-border bg-white/60 px-4 py-8 text-center text-muted-foreground">
            No matches.{" "}
            <Link
              href={`/remote-jobs/${role}`}
              className="text-primary underline"
            >
              See all {roleLabel(role)}
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
