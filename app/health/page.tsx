import Link from "next/link";
import { getFoundationHealth } from "../../lib/supabase/health";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const health = await getFoundationHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-foreground">Foundation health</h1>
        <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
          Home
        </Link>
      </div>

      <section className="border border-border bg-white/70 p-6 backdrop-blur-sm">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Status</p>
        <p className="mt-2 font-display text-3xl text-foreground">
          {health.ok ? "OK" : health.configured ? "Degraded" : "Not configured"}
        </p>
        <p className="mt-3 text-muted-foreground">{health.message}</p>
        <p className="mt-4 text-sm text-muted-foreground">Checked at {health.checkedAt}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Companies" value={health.counts.companies} />
        <Stat label="Sources" value={health.counts.sources} />
        <Stat label="Jobs" value={health.counts.jobs} />
      </section>

      <section className="border border-border bg-white/50 p-6 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Wire-up checklist</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Create a Supabase project.</li>
          <li>
            Run <code className="text-foreground">supabase/migrations/20260914120000_init.sql</code> in
            the SQL editor.
          </li>
          <li>
            Set <code className="text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel env vars.
          </li>
          <li>Redeploy, then reload this page.</li>
        </ol>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border border-border bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl text-foreground">
        {value === null ? "—" : value}
      </p>
    </div>
  );
}
