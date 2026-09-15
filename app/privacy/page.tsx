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
        Saved jobs live in your browser&apos;s localStorage only. We do not
        require an account for browsing or saving. Public analytics or
        third-party scripts may be added later; this page will be updated if
        that happens.
      </p>
      <p className="mt-6">
        <Link href="/" className="text-primary underline">
          Back to feed
        </Link>
      </p>
    </main>
  );
}
