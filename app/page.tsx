import Link from "next/link";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <p className="font-display text-5xl tracking-tight text-ink md:text-6xl">
        JobPulse
      </p>
      <p className="max-w-xl text-lg leading-relaxed text-muted">
        Real-time remote jobs for IT professionals. Foundation is coming online —
        Module 2 wires Next.js, Supabase, and Netlify SSR.
      </p>
      <p>
        <Link
          href="/health"
          className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
        >
          Check foundation health
        </Link>
      </p>
    </main>
  );
}
