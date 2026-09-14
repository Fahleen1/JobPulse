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

## How to test

| Command | What it does |
|---------|----------------|
| `npm test` | Vitest: types, Ashby client, adapter, boards, classifiers |
| `npm run typecheck` | Strict TypeScript check |
| `npm run proof:fixture` | Offline proof against `fixtures/ashby/Ashby.json` |
| `npm run proof` | Live proof: fetch 10 Ashby boards → normalize → classify |
| `npm run proof -- --verbose` | Same as live proof with extra fields |

Module 1 exit check:

```bash
npm run typecheck && npm test && npm run proof:fixture && npm run proof
```

You should see trusted vs discovery-only dates and explicit vs unclear eligibility on adapted jobs.


## Project layout

```
src/
  ashby/          # Ashby client + raw API types
  boards.ts       # 10 public Ashby board keys for Module 1
  classify/       # Date + eligibility classifiers
  types/          # Shared NormalizedJob shape
  proof.ts        # CLI entry (`npm run proof`)
fixtures/ashby/   # Offline Ashby response for tests
```

## License

Private / unpublished for now.
