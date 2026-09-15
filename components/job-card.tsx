import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  companyInitials,
  formatEligibility,
  formatJobWhen,
  formatSalary,
  roleLabel,
} from "@/lib/jobs/format";
import type { FeedMode, JobListItem } from "@/lib/jobs/types";
import { SaveButton } from "./save-button";

export function JobCard({
  job,
  mode,
}: {
  job: JobListItem;
  mode?: FeedMode;
}) {
  const when = formatJobWhen(job, new Date(), mode ? { mode } : undefined);
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

  return (
    <Card
      size="sm"
      className="rounded-none border-b border-border shadow-none ring-0 first:rounded-t-xl last:rounded-b-xl last:border-b-0"
    >
      <CardContent className="py-4">
        <div className="flex gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-medium text-primary"
            aria-hidden
          >
            {job.company_logo_url ? (
              <img
                src={job.company_logo_url}
                alt=""
                className="h-11 w-11 rounded-md object-cover"
              />
            ) : (
              companyInitials(job.company_name)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/jobs/${job.slug}`}
                  className="block truncate text-lg font-medium text-foreground hover:text-primary"
                >
                  {job.title}
                </Link>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {job.company_name}
                  {job.role_family ? ` · ${roleLabel(job.role_family)}` : ""}
                  {job.seniority ? ` · ${job.seniority}` : ""}
                </p>
              </div>
              <SaveButton
                id={job.id}
                slug={job.slug}
                title={job.title}
                company_name={job.company_name}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge
                variant={when.kind === "posted" ? "default" : "secondary"}
              >
                {when.label}
              </Badge>
              <span>{eligibility}</span>
              {salary ? <span>{salary}</span> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
