# JobPulse

Real-time remote job aggregator for IT professionals. Search is free — Apply links go straight to the company career page.

**Target markets:** US, Canada, Europe (UK/EU), Middle East (UAE/Saudi)

## Status

- **Module 1** data proof: complete (`npm run proof`)
- **Module 2** foundation: Next.js + Tailwind + Netlify + Supabase schema in progress

## Requirements

- Node.js 20+
- Supabase project (free tier is fine)
- Netlify site (already connected)

## Setup

```bash
npm install
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Supabase schema

1. Create a project at [supabase.com](https://supabase.com)
2. Open **SQL Editor** and run [`supabase/migrations/20260914120000_init.sql`](supabase/migrations/20260914120000_init.sql)
3. Copy Project URL + anon key into `.env.local` and Netlify env vars

### Netlify env vars

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; needed in Module 3 for ingestion writes |

Redeploy after setting env vars. Confirm at `/health`.

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Next.js local app |
| `npm run build` | Production Next.js build |
| `npm test` | Module 1 Vitest suite |
| `npm run typecheck` | Next + ingestion TypeScript checks |
| `npm run proof` | Live Ashby normalize/classify proof |
| `npm run proof:fixture` | Offline proof against fixture |

## Project layout

```
app/                 # Next.js App Router (SSR pages)
lib/supabase/        # Server Supabase client + health check
supabase/migrations/ # SQL schema committed to git
src/                 # Module 1 Ashby proof / future ingestion CLI
fixtures/ashby/      # Offline Ashby fixture
netlify.toml         # Next.js on Netlify via @netlify/plugin-nextjs
```

## License

Private / unpublished for now.
