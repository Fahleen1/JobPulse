# JobPulse

Real-time remote job aggregator for IT professionals. Search is free — Apply links go straight to the company career page.

**Target markets:** US, Canada, Europe (UK/EU), Middle East (UAE/Saudi)

## Status

Module 1 (data proof) is in progress: TypeScript scaffold and shared `NormalizedJob` types are in place. Ashby fetch, classifiers, and the live proof CLI come next.

## Requirements

- Node.js 20+

## Setup

```bash
npm install
```

## How to test (Parts 1–2)

| Command | What it does |
|---------|----------------|
| `npm test` | Runs Vitest (type-contract smoke test for `NormalizedJob`) |
| `npm run typecheck` | Strict TypeScript check (`tsc --noEmit`) |
| `npm run proof` | Proof CLI placeholder (live Ashby board proof lands in Parts 3–5) |
| `npm run test:watch` | Re-runs tests on file changes |

Quick check that everything works:

```bash
npm install
npm run typecheck
npm test
npm run proof
```

You should see:

- typecheck exit 0
- Vitest: 1 passed (`NormalizedJob` type contract)
- proof: scaffold message (until Parts 3–5 replace it)

## Project layout

```
src/
  types/normalized-job.ts   # Shared normalized job shape
  proof.ts                  # CLI entry (`npm run proof`)
  index.ts                  # Public type re-exports
```

## License

Private / unpublished for now.
