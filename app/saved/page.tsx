"use client";

import Link from "next/link";
import { useSavedJobs } from "@/components/saved-jobs-provider";

export default function SavedPage() {
  const { saved, ready, remove } = useSavedJobs();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
        Saved jobs
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Stored only in this browser (localStorage). Clearing site data removes
        them.
      </p>

      {!ready ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : saved.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-white/60 px-4 py-10 text-center">
          <p className="text-foreground">No saved jobs yet.</p>
          <Link href="/" className="mt-3 inline-block text-sm text-primary underline">
            Browse the feed
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border rounded-lg border border-border bg-white/70">
          {saved.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"
            >
              <div className="min-w-0">
                <Link
                  href={`/jobs/${job.slug}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {job.title}
                </Link>
                <p className="text-sm text-muted-foreground">{job.company_name}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(job.id)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
