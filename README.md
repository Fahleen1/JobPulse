# JobPulse

Real-time remote job aggregator for IT professionals. Search is free — Apply links go straight to the company career page.

**Target markets:** US, Canada, Europe (UK/EU), Middle East (UAE/Saudi)

## Status

- **Module 1** data proof: complete
- **Module 2** foundation: Next.js + Supabase schema + `/health`
- **Module 3** Parts 1–4: seed, Ashby adapter, idempotent persist, baseline/closure/relisted

## Requirements

- Node.js 20+
- Supabase project (free tier is fine)
- Netlify site (already connected)

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
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; required for `ingest:seed` / `ingest:persist` |

Redeploy after setting env vars. Confirm at `/health`.

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Next.js local app |
| `npm run build` | Production Next.js build |
| `npm test` | Vitest (Module 1 + ingest Parts 1–3) |
| `npm run typecheck` | Next + ingestion TypeScript checks |
| `npm run proof` | Live Ashby normalize/classify proof |
| `npm run ingest:seed` | Upsert 10 Ashby companies + sources |
| `npm run ingest:persist:fixture` | Persist Ashby fixture twice (idempotency check) |
| `npm run ingest:persist` | Fetch live Ashby board + persist twice |

## Module 3 Parts 1–3 quick check

```bash
npm run typecheck && npm test
npm run ingest:seed
npm run ingest:persist:fixture
```

Expect: seed creates 10 companies/sources; second persist reports `new=0` and stable `first_seen_at`.

## Project layout

```
app/                 # Next.js App Router (SSR pages)
lib/supabase/        # Server Supabase client + health check
supabase/migrations/ # SQL schema committed to git
src/ashby/           # Ashby client + adapter
src/ingest/          # Module 3 seed / adapters / persist
fixtures/ashby/      # Offline Ashby fixture
netlify.toml         # Next.js on Netlify via @netlify/plugin-nextjs
```

## License

Private / unpublished for now.
