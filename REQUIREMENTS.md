# JobPulse --- Product Requirements & Development Guide

**Real-time remote job aggregator for IT professionals**
**Target markets:** US, Canada, Europe (UK/EU), Middle East (UAE/Saudi)

---

## 1. Problem

Remote job seekers discover openings late. LinkedIn and Indeed rank by engagement, not recency, so by the time you see a role it already has hundreds of applicants. Most companies post to their own career page (via an ATS like Greenhouse, Lever, or Ashby) before or at the same time as LinkedIn. Several of those ATS platforms expose free, public JSON APIs. That is the wedge.

Meanwhile, free aggregator APIs (Remotive, RemoteOK, Himalayas, Jobicy, etc.) already collect remote jobs across thousands of companies and hand them out in JSON with no API key required.

**JobPulse combines both**: aggregator APIs for instant breadth across all IT roles, and direct ATS polling for the freshest, most trustworthy signal from hand-picked companies. Clicking "Apply" takes the user straight to the company's own career page. Search is free, forever.

---

## 2. Scope

### In v1 (MVP)

- Job feed sorted by recency (newest first), infinite-scroll or paginated.
- Filters: role family, region/country, remote type, seniority, posted-within (24h / 48h / 7d).
- Keyword search across title + company + tags.
- Job detail page with description, salary (when available), tags, source, dates, location restrictions.
- "Apply on company site" button that deep-links to the original application URL.
- Saved jobs stored in browser `localStorage` (no sync, no account needed).
- Company identity block on each job (name, domain, initials-based logo fallback).
- Automated ingestion from Tier A aggregator APIs + Tier B ATS APIs on a schedule.
- A handful of server-rendered SEO pages for core categories.
- Health monitoring via Supabase dashboard + SQL views (no custom admin UI).
- Report-bad-listing link on every job.
- Mobile-responsive design.

### Out of v1 (deferred)

- User accounts, authentication, profiles.
- Email/push alerts and notifications.
- Resume uploads, ATS scoring, AI matching.
- Application tracker.
- Payments, subscriptions, Stripe.
- Auto-fill or auto-apply.
- Custom admin dashboard.
- Hybrid/on-site listings.
- Slack/Discord/Telegram bots.
- Mass programmatic SEO pages (role x city x skill).

### Phase 2 (paid tier, after feed is proven)

- Optional accounts with synced saved jobs and search history.
- Resume parsing via LLM-based structured extraction.
- ATS-readability score.
- Auto-match score (rank jobs by fit to parsed resume).
- Priority/instant alerts (real-time push instead of batched).
- Auto-fill assistant (pre-fill common fields, never auto-submit).
- Application tracker (kanban-style).
- Billing via Stripe, freemium model.

---

## 3. Target Users

**Who:** Software engineers (all levels), QA, DevOps/SRE, data/AI engineers, designers, product managers, HR/talent acquisition, and broader IT roles.

**Where:** US, Canada, Europe (UK, EU), Middle East (UAE, Saudi Arabia, and other remote-friendly countries).

**Persona:** Technically comfortable, checks job boards daily, frustrated by "500+ applicants" postings, wants speed and recency over polish.

### Role families (in the data model and filters from day one)

| ID | Label |
|----|-------|
| `engineering` | Software Engineering (Frontend, Backend, Full-Stack, Mobile) |
| `qa` | Quality Assurance / Testing |
| `devops` | DevOps / SRE / Infrastructure |
| `data` | Data Engineering / Data Science / AI-ML |
| `design` | UI/UX Design / Product Design |
| `product` | Product Management |
| `hr` | HR / Talent Acquisition / People Ops |
| `support` | Technical Support / Customer Success |
| `other` | Catch-all for roles that don't fit above |

### Eligibility model

- Never infer "Worldwide" from the word "remote." Only mark a job as worldwide when the source explicitly says so.
- Distinguish company headquarters from applicant eligibility (a US company does not automatically hire worldwide).
- When the source does not state eligible locations, display "Eligibility unclear."
- Store `eligible_countries[]` as an array and `region_text` as the raw string from the source.

---

## 4. Job Sources

No single source is complete. JobPulse uses three tiers. Tier A gives you inventory on day one; Tier B gives you the freshest, most trustworthy signal; Tier C makes the registry grow without manual work.

### Tier A --- Free Aggregator APIs (breadth, no key needed)

These are public, free, and specifically meant for reuse. Pull them directly instead of scraping LinkedIn/Indeed.

| Source | Endpoint | Notes |
|--------|----------|-------|
| Remotive | `remotive.com/api/remote-jobs` | Clean JSON, well-structured |
| RemoteOK | `remoteok.com/api` | Needs `User-Agent` header; first array item is a legal notice, skip it |
| Himalayas | `himalayas.app/jobs/api` | Cursor-paginated, includes salary/seniority/timezone |
| Jobicy | `jobicy.com/api/v2/remote-jobs` | Straightforward JSON |
| Arbeitnow | `arbeitnow.com/api/job-board-api` | EU-heavy; filter on the `remote` boolean (feed includes on-site) |
| We Work Remotely | `weworkremotely.com/remote-jobs.rss` | RSS feed + category feeds |
| The Muse | Public API, no key | Multiple categories |
| Adzuna | Free API key, multi-country | US/UK/DE/FR/NL/AU; requires free registration for key |

**Poll these hourly.** They cover thousands of companies across all target regions and role families without you needing to know any company slugs.

### Tier B --- ATS Public APIs (freshness, highest trust)

These require a known company board slug. Start with 30--50 hand-picked remote-friendly tech companies and grow the registry over time.

| ATS | Endpoint Pattern | Notes |
|-----|------------------|-------|
| Ashby (first) | POST `api.ashbyhq.com/posting-api/job-board/{board}` | `publishedAt` means *last* published; detect reposts |
| Greenhouse (second) | GET `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` | `first_published` in detail response is the real date; list `updated_at` is not a posting date |
| Lever (third) | GET `api.lever.co/v0/postings/{slug}?mode=json` | Global + EU endpoints; no documented creation timestamp, so label discovery time only |
| SmartRecruiters | GET `api.smartrecruiters.com/v1/companies/{slug}/postings` | Paginated, 100/page |
| Workday | POST `{tenant}.wd5.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` | Limit param caps at 20 silently; throttles fast paging |

**Poll Tier B every 30 minutes** for the initial 30--50 companies. Move high-value sources to 15-minute polling only after measuring capacity and rate limits.

### Tier C --- Crowdsourced / Direct Submission

- Let users submit a company career-page URL.
- Auto-detect which ATS it uses (Greenhouse, Lever, Ashby are identifiable from URL patterns or a quick fetch).
- Add to the polling registry automatically after verification.
- This is how the company directory grows without manual work.

### Important: what NOT to scrape

Do not scrape LinkedIn or Indeed. Both have aggressive anti-bot systems and terms that prohibit automated scraping. The entire sourcing strategy uses only official public APIs and RSS feeds.

---

## 5. The Freshness Contract

Freshness is the entire product differentiator. The system must never lie about when a job was posted.

### Three separate clocks

| Stored Value | Meaning | Display Example |
|-------------|---------|-----------------|
| `published_at` | Trusted employer publication date from the ATS/source | "Posted 2 hours ago" |
| `first_seen_at` | First time JobPulse's system observed this job ID | "Discovered 2 hours ago --- posting date unavailable" |
| `last_checked_at` | Last successful availability check | Operational health only, not shown to users as freshness |

**Rules:**
- Never overwrite `first_seen_at` once set.
- Store all timestamps in UTC as `timestamptz`.
- For date-only values (no time component), display "Posted Sep 14" and never invent hours or minutes.
- For the verified feed, a date-only value is included only if the entire possible time interval fits the selected 24h/48h window.

### Two feeds

**Verified feed (default):** Active remote jobs with a trusted employer timestamp in the selected window (24h, 48h, or 7d). This is what users see first.

**Discovered feed:** Uses `first_seen_at` only. Clearly labeled. Useful for sources that don't provide a publication date (like Lever).

### Baseline imports

When a new company/source is added to the registry, the first import marks all existing undated jobs as **baseline inventory**. They are never announced as "newly posted." Only jobs that appear in subsequent polls and were not in the baseline are treated as new.

### Reposts

Ashby's `publishedAt` is "last published," not "first published." A reappearing role or a bumped last-published timestamp goes into a **relisted** state, not automatically to the top of the verified feed. Preserve the original `first_seen_at` and `published_at`.

### Polling cadence and detection latency

- Tier A aggregators: poll hourly.
- Tier B ATS boards: poll every 30 minutes (15 minutes for high-value sources, measured).
- Add random jitter (0--60s) to prevent thundering herd.
- At 50 boards polled hourly, baseline is ~1,200 board requests/day before detail fetches.
- Target: 95% of dated jobs on monitored sources detected within 90 minutes under normal operation.
- Quarantine future-dated timestamps and ambiguous timezones.

---

## 6. Data Model

All tables live in Supabase PostgreSQL. SQL migrations are stored in Git.

### companies

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | |
| `name` | text, NOT NULL | |
| `canonical_domain` | text, UNIQUE | e.g. `stripe.com` |
| `career_url` | text | Link to their careers page |
| `logo_url` | text, nullable | Use initials as fallback in UI |
| `created_at` | timestamptz | |

### sources

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | |
| `company_id` | uuid, FK -> companies, nullable | Null for aggregator sources |
| `ats_type` | text | `ashby`, `greenhouse`, `lever`, `remotive`, `remoteok`, etc. |
| `board_key` | text | Slug or identifier for the board |
| `endpoint` | text | Full URL or URL template |
| `permission_note` | text | Record of ToS review |
| `enabled` | boolean, default true | |
| `baseline_at` | timestamptz, nullable | When the first import completed |
| `last_success_at` | timestamptz, nullable | |
| `next_poll_at` | timestamptz | |
| `failure_count` | int, default 0 | |
| `lease_until` | timestamptz, nullable | Prevents overlapping runs |

### jobs

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | |
| `company_id` | uuid, FK -> companies | |
| `title` | text, NOT NULL | |
| `slug` | text, UNIQUE | URL-friendly identifier |
| `description` | text | Sanitized HTML or plain text |
| `role_family` | text | One of the role family IDs above |
| `seniority` | text, nullable | `junior`, `mid`, `senior`, `lead`, `staff`, `principal` |
| `skills` | text[] | Extracted skill tags |
| `employment_type` | text, nullable | `full-time`, `part-time`, `contract` |
| `workplace_type` | text | `remote`, `hybrid`, `remote-in-region` |
| `eligibility_status` | text | `worldwide`, `restricted`, `unclear` |
| `eligible_countries` | text[] | ISO country codes |
| `region_text` | text | Raw location string from source |
| `salary_min` | int, nullable | |
| `salary_max` | int, nullable | |
| `salary_currency` | text, nullable | ISO 4217 code |
| `application_url` | text, NOT NULL | Direct link to company apply page |
| `status` | text | `active`, `closed`, `relisted`, `baseline` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### job_sources

Links a canonical job to every source observation. This is how dedup and provenance work.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | |
| `job_id` | uuid, FK -> jobs | |
| `source_id` | uuid, FK -> sources | |
| `external_id` | text | The ID from the source API |
| `canonical_url` | text | |
| `source_published_at` | timestamptz, nullable | Employer date from this source |
| `date_kind` | text | `datetime`, `date_only`, `discovered_only` |
| `date_precision` | text | `minute`, `day`, `unknown` |
| `source_updated_at` | timestamptz, nullable | |
| `first_seen_at` | timestamptz, NOT NULL | Immutable once set |
| `last_seen_at` | timestamptz | |
| `content_hash` | text | Hash of normalized description |
| `missing_count` | int, default 0 | Consecutive complete fetches that missed this job |
| `closed_at` | timestamptz, nullable | |

**Constraint:** UNIQUE on `(source_id, external_id)` to prevent duplicate imports.

### ingestion_runs

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | |
| `source_id` | uuid, FK -> sources | |
| `started_at` | timestamptz | |
| `finished_at` | timestamptz, nullable | |
| `complete_snapshot` | boolean | Was this a full, successful fetch? |
| `fetched_count` | int | |
| `new_count` | int | |
| `changed_count` | int | |
| `closed_count` | int | |
| `error_code` | text, nullable | |
| `error_message` | text, nullable | |
| `duration_ms` | int | |

### Indexes

- `jobs`: index on `(status, created_at DESC, id)` for keyset pagination of the feed.
- `jobs`: GIN index on `role_family` and `eligible_countries` for filter queries.
- `jobs`: GIN full-text index on `title || ' ' || description` for keyword search.
- `sources`: index on `(enabled, next_poll_at)` for due-source selection.
- `job_sources`: unique index on `(source_id, external_id)`.

### Pagination

Keyset pagination using `(created_at, id)` as the cursor. Default 20 results per page, max 50. Cache common query results for 1--5 minutes.

### Data retention

- Prune `ingestion_runs` logs after 14 days.
- Keep closed jobs for 30 days (for company page history), then archive to a compact hash table for repost detection.
- Monitor total storage including indexes against Supabase's 500MB free limit.

---

## 7. Ingestion Rules

### Ordered deduplication (three steps)

1. **Exact source identity:** Idempotent upsert using `(source_id, external_id)`. Same source, same ID = same record.
2. **Canonical application URL:** Normalize the host, remove tracking parameters (UTM, etc.), but preserve job identifiers like `gh_jid`. If two sources point to the same canonical apply URL, they are the same job.
3. **Cross-source fuzzy match:** Compare verified company domain + normalized title + location + description `content_hash`. Prefer the company's own ATS source. Queue uncertain matches for manual review rather than auto-merging.

**Do not merge by title alone.** Two identical titles at the same company may be different teams or headcount.

### Closure rules

- A job is marked closed only after **two consecutive complete, successful** board fetches both miss it.
- A failed, malformed, or partially-paginated response must **never** trigger closures.
- An authoritative closed status, confirmed expiry date, or HTTP 404/410 can close immediately.
- HTTP 403, 429, or timeout is "unknown availability" --- retry, do not close.
- HTTP 200 may still be a soft-404 or generic careers redirect: check for the expected job identity or an explicit "closed" message.
- After two missed expected polls, show a source-health warning in the admin view.
- If a source has not succeeded for 24 hours, suppress its jobs from the verified feed until revalidated.

### Fetch safety

- Fetch only approved HTTPS hosts. Reject private/local IPs.
- Revalidate redirect destinations (no open redirects to internal services).
- Limit response body size (e.g., 5MB max) and request timeout (e.g., 30s).
- Sanitize all imported HTML. Strip `<script>`, event handlers, and executable content.
- Validate all fields against expected types before database write.
- Store the Supabase service key only in server/worker environment secrets. Never expose it in browser bundles.

### Retry and backoff

- On failure: exponential backoff starting at 1 minute, capped at 1 hour.
- Respect `Retry-After` headers.
- Per-source leases (`lease_until` column) prevent overlapping runs for the same source.
- Bounded concurrency: process at most 5 sources in parallel per ingestion run.
- Add random jitter (0--60s) to poll times.

---

## 8. API Surface & Pages

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/jobs` | Job feed. Params: `q`, `role`, `country`, `level`, `window` (24h/48h/7d), `mode` (verified/discovered), `cursor`, `limit`. Validate all inputs. Return next cursor. |
| GET | `/api/jobs/:id` | Single job detail. Return 404 for missing, indicate "closed" for closed jobs. |
| GET | `/api/facets` | Available filter values (role families, countries, seniority levels). Cache aggressively. |

Server-rendered pages call the same search functions directly (no HTTP round-trip back to self).

The "Apply" button links straight to the source `application_url`. An optional non-blocking click event can measure outbound interest, but must never obstruct or delay navigation.

### Pages

| Path | Description | Rendering |
|------|-------------|-----------|
| `/` | Homepage = job feed with filters and search | SSR with ISR (revalidate every 60s) |
| `/jobs/[slug]` | Job detail page | SSR |
| `/remote-jobs/[role-family]` | Category page (e.g., `/remote-jobs/engineering`) | SSR with ISR |
| `/remote-jobs/[role-family]/[country]` | Category + country (e.g., `/remote-jobs/engineering/canada`) | SSR with ISR, only for combinations with real inventory |
| `/about` | What JobPulse is, freshness methodology, source list | Static |
| `/privacy` | Privacy notice | Static |

Only create category pages that have real job inventory behind them. Do not generate empty pages or speculative role-x-city combinations.

---

## 9. Technology Stack & Zero-Cost Boundary

Every tool below is free at the scale of a pilot. The document notes the real limits so you know when you will outgrow them.

### Application

**Next.js** (App Router) with **TypeScript** and **Tailwind CSS**. No paid component library. Next.js gives you SSR/ISR for SEO pages, API routes for the endpoints, and server components in one codebase. Keep the ingestion script in the same repo but as a separate entry point (`npm run ingest`), never triggered by visitor requests.

### Database and Auth

**Supabase** (PostgreSQL). SQL migrations committed to Git. Use Supabase client / PostgREST for reads, the connection pooler for writes from serverless functions.

| Resource | Free Limit | Mitigation |
|----------|-----------|------------|
| Database size | 500 MB | Prune ingestion logs after 14 days, archive closed jobs after 30 days, monitor storage including indexes |
| Egress | 5 GB/month | Cache common queries 1--5 min, use keyset pagination (small payloads), serve static assets from Netlify CDN |
| Inactivity pause | ~1 week | Set up a keep-alive cron ping (a simple health-check query every few days) |
| Backups | Not included on free | Self-managed `pg_dump` export on a weekly schedule via GitHub Actions |

No Redis, Kafka, Elasticsearch, microservices, or headless browser fleet.

### Search

PostgreSQL full-text search using a GIN index on `title || ' ' || description`. This is sufficient for the MVP. Move to Typesense or Meilisearch only if search volume or query complexity demands it.

### Hosting

**Netlify Free** is the primary host. Unlike Vercel Hobby (restricted to personal, non-commercial use), Netlify's free plan **explicitly permits commercial projects**.

| Resource | Free Limit | Notes |
|----------|-----------|-------|
| Credits | 300/month, hard cap | Cannot generate a bill; site pauses if exceeded |
| Bandwidth | ~15 GB (at 20 credits/GB) | Sufficient for early traffic; static assets served from CDN |
| Function compute | ~30 GB-hours (at 10 credits/GB-hr) | SSR/ISR/API routes run as serverless functions |
| Web requests | ~1.5M (at 2 credits/10k) | |
| Builds | 300 build minutes/month | |
| Next.js support | Full App Router via OpenNext adapter | SSR, ISR, RSC, streaming, middleware all supported |

**Fallback (only if Netlify doesn't work):** Cloudflare Workers via OpenNext. Blocker: free tier has a hard **10ms CPU per invocation** that Next.js SSR may exceed (Error 1102). Benchmark before committing. 100k requests/day, 5 cron triggers max.

### Ingestion Scheduling

**GitHub Actions** scheduled workflows on a **public repository** (with all secrets in Actions encrypted secrets).

| Fact | Detail |
|------|--------|
| Cost on public repos | Free, unlimited minutes |
| Private repos (free account) | Scheduled workflows are **disabled** (not just limited --- they silently won't run) |
| Minimum interval | Every 5 minutes |
| Reliability | Runs can be delayed or dropped; public-repo schedules may disable after 60 days without a commit. Monitor actual runs. |

**Alternative for private repos:** Supabase Edge Functions + `pg_cron` extension (if available on free tier) or an external free cron service (cron-job.org) triggering a `workflow_dispatch` endpoint.

### Testing

- **Vitest** for unit tests (freshness rules, normalization, dedup logic).
- **Playwright** for E2E browser tests (search, filter, view detail, click apply).
- Local PostgreSQL or Supabase CLI for database integration tests.

---

## 10. SEO Strategy

SEO is the primary organic growth channel for a jobs product. Do it right from day one, but keep it honest.

### Server-rendered pages

Every page that should be indexed is rendered on the server with clean URLs, unique `<title>` and `<meta description>`, and proper `<link rel="canonical">`. Use ISR to keep pages fresh without rebuilding on every request.

### Sitemap

Generate a `sitemap.xml` that includes only pages with real inventory. Exclude empty category pages, search/filter URLs with arbitrary query params, and closed job pages.

### robots.txt

Allow crawling of all public pages. Use `noindex` meta tags (not `robots.txt` Disallow) for pages you don't want indexed, so crawlers can still read the `noindex` directive.

### JobPosting structured data (schema.org)

Add `JobPosting` markup on individual job detail pages, **only when both conditions are met:**

1. A trusted employer publication date exists (not just `first_seen_at`).
2. A complete job description is available.

If either is missing, omit the markup entirely. Never fabricate dates for structured data. For fully remote roles, use `jobLocationType: TELECOMMUTE` with accurate `applicantLocationRequirements`.

Remove structured data promptly when a job is closed. Do not imply a direct-apply experience you don't provide (the user is redirected to the company's page).

### Internal linking

Link category pages to each other and to the homepage. Link job detail pages back to their category. This creates a crawlable structure without a complex link graph.

### "Last updated X minutes ago"

Show this on every page. Freshness is the differentiator --- make it visible.

---

## 11. Development Modules (Build Order)

Build in this order. Each module has an exit condition --- do not move on until it's met.

### Module 1: Data Proof (Days 1--4)

**What:** Pick 10 Ashby companies. Fetch their boards. Inspect the publication date, location, and eligibility fields. Write a small TypeScript script that hits the API and logs normalized output.

**Exit condition:** You can classify each job as "has trusted date" vs "discovery-only" and "has explicit eligibility" vs "unclear." The normalized output matches the `jobs` schema.

### Module 2: Foundation (Week 1)

**What:** Initialize the Git repo, set up Next.js + TypeScript + Tailwind, create Supabase project, write SQL migrations for all tables, deploy a test page to Netlify to confirm SSR works within the free credit budget.

**Exit condition:** A server-rendered page that queries the database and returns a result is live on Netlify. Secrets are in environment variables, not in code.

### Module 3: Reliable Ingestion Pipeline (Week 2)

**What:** Build the full ingestion service:
- Source adapter interface (one shared normalized-job contract; one adapter per source type).
- Adapters for all Tier A aggregators + Ashby.
- Due-source selection using `next_poll_at` and `lease_until`.
- Normalization, validation, ordered three-step dedup, atomic upserts.
- Complete-snapshot closure reconciliation.
- Baseline-import handling for new sources.
- Retry/backoff/jitter.
- `ingestion_runs` logging.
- GitHub Actions workflow with hourly cron trigger.

**Exit condition:** Run ingestion for 48 hours. Repeated imports produce no duplicates. `first_seen_at` never changes. A simulated source failure does not mass-close jobs. The ingestion run logs show success rates and timing.

### Module 4: Usable Product (Week 3)

**What:** Build the public interface:
- Homepage feed with filters (role, country, seniority, posted-within) and keyword search.
- Job detail page with description, dates (using the correct clock), salary, eligibility, and "Apply on company site" button.
- Category pages for role families with inventory.
- `localStorage` saved jobs with save/unsave toggle.
- Mobile-responsive layout.
- Loading, empty, and error states.

**Exit condition:** A complete mobile user journey works with real data: open feed, filter by role and country, view a job, click Apply (lands on company career page), save a job, see it in saved list.

### Module 5: Quality and SEO (Week 4)

**What:**
- Add Greenhouse and Lever adapters.
- Run ingestion for 7 consecutive days. Manually inspect 30+ listings across sources and regions.
- Add sitemap, robots.txt, canonical tags, meta tags, and conditional JobPosting structured data.
- Add the "Last updated X minutes ago" display.
- Add the about page with freshness methodology and source list.
- Add the report-bad-listing link.
- Write tests: fake-clock freshness tests, fixture double-import, closure safety, Playwright apply flow.

**Exit condition:** Every "Posted" badge in a 30-job sample has source evidence. No baseline jobs are mislabeled as new. No duplicates from repeated imports. Google's Rich Results Test passes on job pages with structured data. All tests pass.

### Module 6: Launch and Feedback (Weeks 5--6)

**What:**
- Invite 10--20 job seekers to test.
- Share curated fresh-job selections on LinkedIn/X with accurate timestamps.
- Fix feedback. Add sources and companies users request.
- Expand to 100--200 sources only after measuring ingestion cost and usefulness.
- Add Supabase `pg_dump` backup workflow.
- Add source-health SQL views for monitoring.

**Exit condition:** At least 10 of 20 testers return within a week. At least 5 identify a relevant role they hadn't seen elsewhere. Source health is monitored and no silent failures exist.

---

## 12. Testing Strategy

| Area | What to Test |
|------|-------------|
| Freshness logic | Fake the clock: test exactly 24h/48h boundaries, date-only ambiguity, future dates, edit timestamps, baseline imports, relisting. |
| Source adapters | Recorded API response fixtures + one small live smoke test per adapter. Test missing fields, changed response shapes, pagination, 429 responses, timeouts, malformed JSON. |
| Dedup | Import a fixture twice: job count must not change, `first_seen_at` must not change. Test concurrent upserts. Test exact matches vs similar-but-distinct roles. |
| Closures | Job missing from two complete runs = closed. Failed/partial run = no closures. Test soft-404, generic redirects, 403/429, internal-IP rejection. |
| Search and filters | Correct country eligibility filtering, keyword matching, age boundaries, stable cursor pagination. |
| Security | No database service key in browser assets. No public write access. Sanitized HTML in descriptions. SSRF prevention (reject private IPs, limit redirects). |
| Browser E2E | Playwright: open -> filter -> detail -> Apply (external link). Local save/unsave. Narrow screens, keyboard navigation, loading/empty/error states. |
| Performance | Synthetic 10,000-job dataset. Examine slow query plans. Verify cached search under 500ms on the real deployment. |
| SEO | Validate server-rendered HTML, canonical tags, sitemap, robots.txt, JobPosting structured data via Google Rich Results Test. |

---

## 13. Risks and Mitigations

| Risk | Response |
|------|----------|
| **Rights and terms** | A public API endpoint is not blanket republication permission. Record each provider's ToS, attribution requirements, and takedown contacts. Use summaries and links where permitted. Seek permission when unclear. |
| **LinkedIn/Indeed scraping** | Do not do it. Their agreements prohibit automated scraping. The entire strategy avoids this by using only public APIs and RSS feeds. |
| **Descriptions and logos** | Do not assume logos or full descriptions are freely reusable. Use authorized content only. When in doubt, link to the source rather than reproducing. Initials-based fallback for logos. |
| **Privacy** | No resumes or applicant data at launch. Minimize analytics. Publish a privacy notice. Review EU/regional rules before adding accounts, tracking, or alerts. |
| **Wrong geography / scams** | Preserve employer location restrictions verbatim. Never infer worldwide. Add report and suppression paths. Verify company-to-ATS relationships. |
| **Cost and quotas** | Monitor Netlify credits, Supabase storage, and GitHub Actions minutes. Keep SQL migrations and data exports portable. Keep adapters replaceable. Free plans and API terms can change at any time. |
| **Source API changes** | Runtime schema validation on every fetch. If an adapter sees an unexpected response shape, it logs an error and skips that source rather than writing bad data. Contract tests that alert on schema drift. |
| **Supabase inactivity pause** | Keep-alive cron ping every few days. |

---

## 14. Phase 2: Monetization

**Free forever:** Search, browse, filters, saved jobs, and direct apply links. This is the acquisition engine --- never gate it.

**Paid tier:** Resume parsing, ATS-readability score, auto-match, priority alerts, auto-fill, application tracker. Describe any ATS analysis as heuristic feedback, not a universal score. Get explicit consent before sending resume data to any AI provider.

**Sponsored listings (later):** Companies pay for verified/boosted placement. Sponsored jobs must still satisfy freshness and eligibility standards. Payment must not make an old job appear new.

**What not to do:** Do not sell applicant information. Do not lock the freshest jobs behind payment if freshness + free is the brand promise.

---

## 15. Open Items (Resolve Before Coding)

1. **Name availability:** Check domain, trademark, and social-handle availability for "JobPulse" before buying anything.
2. **Initial company registry:** Curate the first 30--50 ATS company slugs (mix of Ashby/Greenhouse/Lever, remote-friendly tech companies hiring across target regions).
3. **Middle East sources:** Bayt, Naukrigulf, etc. may not have public APIs. Research whether dedicated local board APIs exist or if Tier A aggregators already cover the region.
4. **Recheck all API endpoints and free-tier limits** before starting Module 1. The endpoints in this document were verified as of September 2026.
5. **Data retention policy:** Decide how long to keep closed job records (proposed: 30 days, then archive to hash-only for repost detection).
6. **Netlify credit spike:** Deploy a representative SSR page early (Module 2) and measure actual credit consumption to confirm the free tier is viable for your expected page count.

---

## 16. Vibe-Coding Protocol

This project is designed for AI-assisted development. Follow these rules to keep the build trustworthy:

1. **One module at a time.** Ask the coding agent for one module, its acceptance checks, and a small diff. Do not build the UI before the pipeline works.
2. **Commit after every working milestone.** Do not accumulate uncommitted changes across modules.
3. **Review yourself:** SQL migrations, secrets handling, fetch rules, and date logic. A convincing screen is not evidence that the data is correct.
4. **Test with real data.** Fixtures are necessary but not sufficient. Run the actual API calls against real ATS boards during Module 1.
5. **Do not add what is not in v1.** Resist the urge to add accounts, AI features, payments, or a dashboard before the feed is proven useful.

### First prompt to give the coding agent

> Build only the ingestion proof for a remote jobs MVP using TypeScript and PostgreSQL (Supabase). Support one Ashby board adapter and the shared normalized job schema from REQUIREMENTS.md. Keep `published_at`, `first_seen_at`, and `last_checked_at` separate. Treat Ashby's `publishedAt` as "last published" and detect reposts conservatively. Add baseline-import handling, idempotent upserts using `(source_id, external_id)`, complete-fetch closure protection, and fixture-based tests. Do not add accounts, AI features, payments, or a custom dashboard. Show the proposed schema and acceptance checks before writing implementation code. Never invent source fields or expose database secrets in client code.
