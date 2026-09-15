import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-3xl text-foreground">Not found</h1>
      <p className="mt-3 text-muted-foreground">That page or job does not exist.</p>
      <Link href="/" className="mt-6 inline-block text-primary underline">
        Back to feed
      </Link>
    </main>
  );
}
