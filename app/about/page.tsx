import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground">About JobPulse</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        JobPulse aggregates remote IT roles from company career boards and
        public job APIs. We separate verified employer publish times from
        discovery timestamps so “posted 2h ago” means what it says.
      </p>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Apply always goes to the employer or board application URL — JobPulse
        does not host applications.
      </p>
      <p className="mt-6">
        <Link href="/" className="text-primary underline">
          Back to feed
        </Link>
      </p>
    </main>
  );
}
