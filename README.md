# JobPulse

Real-time remote job aggregator for IT professionals. Search is free — Apply links go straight to the company career page.

**Target markets:** US, Canada, Europe (UK/EU), Middle East (UAE/Saudi)

## Status

- **Module 1** data proof: complete
- **Module 2** foundation: Next.js + Supabase schema + `/health`
- **Module 3** ingestion pipeline: Parts 1–8 complete (Ashby + Tier A, scheduler, GHA)

## Requirements

- Node.js 20+
- Supabase project (free tier is fine)
- Netlify site (already connected)
- GitHub Actions secrets for hourly ingest (public repo)

## Setup

```bash
npm install
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# and SUPABASE_SERVICE_ROLE_KEY (ingestion writes)
```

### Supabase schema

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run [`supabase/migrations/20260914120000_init.sql`](supabase/migrations/20260914120000_init.sql)
3. Copy Project URL + anon key + **service role** key into `.env` / `.env.local`

### Netlify env vars

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; required for ingestion |

### GitHub Actions secrets

Add these under **Settings → Secrets and variables → Actions**:

| Secret | Required |
|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | yes |
| `ADZUNA_APP_ID` / `ADZUNA_API_KEY` | optional |

Workflow: [`.github/workflows/ingest.yml`](.github/workflows/ingest.yml) (hourly + manual).

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Next.js local app |
| `npm run build` | Production Next.js build |
| `npm test` | Full Vitest suite |
| `npm run typecheck` | Next + ingestion TypeScript checks |
| `npm run proof` | Live Ashby normalize/classify proof |
| `npm run ingest:seed` | Seed Ashby boards + Tier A aggregator sources |
| `npm run ingest` | Due-source scheduler (max 5 parallel) |
| `npm run ingest:persist:fixture` | Offline Ashby persist idempotency check |

## Module 3 local check

```bash
npm run typecheck && npm test
npm run ingest:seed
npm run ingest -- --limit=10
```

## 48-hour observation checklist

After Actions is enabled, watch for ~48 hours:

1. **Duplicates:** `job_sources` unique on `(source_id, external_id)` — re-runs should not grow duplicate rows for the same IDs.
2. **`first_seen_at`:** never changes on re-import (compare two `ingestion_runs` windows).
3. **No mass-close:** failed/incomplete fetches must not close jobs; only two consecutive complete misses close.
4. **Run health:** `ingestion_runs` shows success rates, `duration_ms`, and error codes when failures happen.
5. **Baseline:** first complete import per source uses `status=baseline` / `baseline_at`, not “newly posted”.

Supabase SQL views: `ingestion_health` (from migration). Table: `ingestion_runs`.

## Project layout

```
app/                      # Next.js App Router
lib/supabase/             # Server Supabase client + health
supabase/migrations/      # SQL schema
src/ashby/                # Ashby client + adapter
src/ingest/               # Seed, adapters, persist, scheduler
src/ingest/adapters/      # Ashby + Tier A aggregators
fixtures/                 # Offline fixtures
.github/workflows/        # Hourly ingest workflow
netlify.toml
```

## License

Private / unpublished for now.
