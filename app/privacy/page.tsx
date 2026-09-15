import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground">Privacy</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        JobPulse does not require an account to browse or apply. Apply links go
        to employer sites. We do not collect resumes on JobPulse. Public
        analytics or third-party scripts may be added later; this page will be
        updated if that happens.
      </p>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        Saved jobs and alerts will arrive with accounts — until then, nothing is
        stored in your browser for those features.
      </p>
      <p className="mt-6">
        <Link href="/" className="text-primary underline">
          Back to feed
        </Link>
      </p>
    </main>
  );
}
