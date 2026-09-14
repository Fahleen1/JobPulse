import Link from "next/link";
import { getFoundationHealth } from "../../lib/supabase/health";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const health = await getFoundationHealth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl text-ink">Foundation health</h1>
        <Link href="/" className="text-sm text-accent underline-offset-4 hover:underline">
          Home
        </Link>
      </div>

      <section className="border border-line bg-white/70 p-6 backdrop-blur-sm">
        <p className="text-sm uppercase tracking-[0.18em] text-muted">Status</p>
        <p className="mt-2 font-display text-3xl text-ink">
          {health.ok ? "OK" : health.configured ? "Degraded" : "Not configured"}
        </p>
        <p className="mt-3 text-muted">{health.message}</p>
        <p className="mt-4 text-sm text-muted">Checked at {health.checkedAt}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Companies" value={health.counts.companies} />
        <Stat label="Sources" value={health.counts.sources} />
        <Stat label="Jobs" value={health.counts.jobs} />
      </section>

      <section className="border border-line bg-white/50 p-6 text-sm leading-relaxed text-muted">
        <p className="font-medium text-ink">Wire-up checklist</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Create a Supabase project.</li>
          <li>
            Run <code className="text-ink">supabase/migrations/20260914120000_init.sql</code> in
            the SQL editor.
          </li>
          <li>
            Set <code className="text-ink">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-ink">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Netlify env vars.
          </li>
          <li>Redeploy, then reload this page.</li>
        </ol>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border border-line bg-white/70 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">
        {value === null ? "—" : value}
      </p>
    </div>
  );
}
