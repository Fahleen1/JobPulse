import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatEligibility,
  formatJobWhen,
  formatSalary,
  roleLabel,
} from "@/lib/jobs/format";
import { getJobBySlug } from "@/lib/jobs/search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 60;

interface JobPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: JobPageProps): Promise<Metadata> {
  const { slug } = await params;
  const client = createSupabaseServerClient();
  if (!client) {
    return { title: "Job" };
  }
  try {
    const job = await getJobBySlug(client, slug);
    if (!job) {
      return { title: "Job not found" };
    }
    return {
      title: `${job.title} at ${job.company_name}`,
      description: `${job.title} · ${job.company_name} · remote`,
    };
  } catch {
    return { title: "Job" };
  }
}

export default async function JobDetailPage({ params }: JobPageProps) {
  const { slug } = await params;
  const client = createSupabaseServerClient();
  if (!client) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-muted-foreground">Supabase is not configured.</p>
      </main>
    );
  }

  let job;
  try {
    job = await getJobBySlug(client, slug);
  } catch {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-red-800">Failed to load this job.</p>
        <Link href="/" className="mt-4 inline-block text-primary underline">
          Back to feed
        </Link>
      </main>
    );
  }

  if (!job) {
    notFound();
  }

  const when = formatJobWhen(job);
  const salary = formatSalary(
    job.salary_min,
    job.salary_max,
    job.salary_currency,
  );
  const eligibility = formatEligibility(
    job.eligibility_status,
    job.eligible_countries,
    job.region_text,
  );
  const closed = job.status === "closed";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to feed
      </Link>

      {closed ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This listing looks closed. The apply link may no longer work.
        </p>
      ) : null}

      <header className="mt-6">
        <p className="text-sm text-muted-foreground">{job.company_name}</p>
        <h1 className="mt-1 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          {job.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {job.role_family ? roleLabel(job.role_family) : "Role"}
          {job.seniority ? ` · ${job.seniority}` : ""}
          {job.employment_type ? ` · ${job.employment_type}` : ""}
          {` · ${job.workplace_type}`}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={job.application_url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "lg" }))}
        >
          Apply on company site
        </a>
      </div>

      <Card className="mt-8">
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">When</dt>
              <dd className="mt-1 text-foreground">{when.label}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Eligibility</dt>
              <dd className="mt-1 text-foreground">{eligibility}</dd>
            </div>
            {salary ? (
              <div>
                <dt className="text-muted-foreground">Salary</dt>
                <dd className="mt-1 text-foreground">{salary}</dd>
              </div>
            ) : null}
            {job.company_domain ? (
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd className="mt-1 text-foreground">{job.company_domain}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-foreground">Description</h2>
        {job.description ? (
          <Card className="mt-4">
            <CardContent className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {job.description}
            </CardContent>
          </Card>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No description was provided by the source. Use Apply to read the
            full posting on the employer site.
          </p>
        )}
      </section>
    </main>
  );
}
