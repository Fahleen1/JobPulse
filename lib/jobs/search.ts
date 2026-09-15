import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decodeCursor,
  encodeCursor,
  windowStartIso,
} from "./format";
import {
  ROLE_FAMILIES,
  SENIORITY_LEVELS,
  type Facets,
  type FeedMode,
  type FeedWindow,
  type JobListItem,
  type JobSearchParams,
  type JobSearchResult,
} from "./types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const LISTING_SELECT = `
  id, company_id, title, slug, description, role_family, seniority, skills,
  employment_type, workplace_type, eligibility_status, eligible_countries,
  region_text, salary_min, salary_max, salary_currency, application_url,
  status, created_at, updated_at, company_name, company_domain, company_logo_url,
  trusted_published_at, trusted_date_kind, discovered_at
`;

function clampLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function normalizeMode(mode: string | undefined): FeedMode {
  return mode === "discovered" ? "discovered" : "verified";
}

function normalizeWindow(window: string | undefined): FeedWindow {
  switch (window) {
    case "48h":
      return "48h";
    case "7d":
      return "7d";
    case "24h":
    default:
      return "24h";
  }
}

/**
 * PostgREST breaks on unquoted spaces in `.or()` filters.
 * Quote patterns and join tokens with `%` so "Software Engineer"
 * matches titles containing both words.
 */
export function buildKeywordOrFilter(raw: string): string | null {
  const tokens = raw
    .replace(/[%_,()]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 6);
  if (tokens.length === 0) {
    return null;
  }
  const pattern = `"%${tokens.join("%")}%"`;
  return `title.ilike.${pattern},company_name.ilike.${pattern},region_text.ilike.${pattern}`;
}

export function parseSearchParams(
  input: URLSearchParams | JobSearchParams,
): Required<Pick<JobSearchParams, "mode" | "window" | "limit">> &
  JobSearchParams {
  const out: Required<Pick<JobSearchParams, "mode" | "window" | "limit">> &
    JobSearchParams = {
    window: "24h",
    mode: "verified",
    limit: DEFAULT_LIMIT,
  };

  if (input instanceof URLSearchParams) {
    const q = input.get("q")?.trim();
    const role = input.get("role")?.trim();
    const country = input.get("country")?.trim()?.toUpperCase();
    const level = input.get("level")?.trim();
    const cursor = input.get("cursor");
    if (q) out.q = q;
    if (role) out.role = role;
    if (country) out.country = country;
    if (level) out.level = level;
    if (cursor) out.cursor = cursor;
    out.window = normalizeWindow(input.get("window") ?? undefined);
    out.mode = normalizeMode(input.get("mode") ?? undefined);
    out.limit = clampLimit(Number(input.get("limit") ?? DEFAULT_LIMIT));
    return out;
  }

  if (input.q?.trim()) out.q = input.q.trim();
  if (input.role?.trim()) out.role = input.role.trim();
  const country = input.country?.trim().toUpperCase();
  if (country) out.country = country;
  if (input.level?.trim()) out.level = input.level.trim();
  if (input.cursor != null && input.cursor !== "") out.cursor = input.cursor;
  out.window = normalizeWindow(input.window);
  out.mode = normalizeMode(input.mode);
  out.limit = clampLimit(input.limit);
  return out;
}

export async function searchJobs(
  client: SupabaseClient,
  rawParams: JobSearchParams | URLSearchParams,
  now: Date = new Date(),
): Promise<JobSearchResult> {
  const params = parseSearchParams(rawParams);
  const mode = params.mode ?? "verified";
  const window = params.window ?? "24h";
  const limit = params.limit ?? DEFAULT_LIMIT;
  const since = windowStartIso(window, now);
  const cursor = decodeCursor(params.cursor);

  const sortColumn =
    mode === "verified" ? "trusted_published_at" : "discovered_at";

  let query = client
    .from("job_listings")
    .select(LISTING_SELECT)
    .in("status", ["active", "relisted"]);

  if (mode === "verified") {
    query = query
      .not("trusted_published_at", "is", null)
      .gte("trusted_published_at", since);
  } else {
    query = query.not("discovered_at", "is", null).gte("discovered_at", since);
  }

  query = query
    .order(sortColumn, { ascending: false })
    .order("id", { ascending: false });

  if (params.role && ROLE_FAMILIES.includes(params.role as never)) {
    query = query.eq("role_family", params.role);
  }
  if (params.level && SENIORITY_LEVELS.includes(params.level as never)) {
    query = query.eq("seniority", params.level);
  }
  if (params.country && /^[A-Z]{2}$/.test(params.country)) {
    const code = params.country;
    query = query.or(
      `eligibility_status.eq.worldwide,eligible_countries.cs.{${code}}`,
    );
  }
  if (params.q) {
    const keywordFilter = buildKeywordOrFilter(params.q);
    if (keywordFilter) {
      query = query.or(keywordFilter);
    }
  }

  if (cursor) {
    query = query.or(
      `${sortColumn}.lt.${cursor.sortAt},and(${sortColumn}.eq.${cursor.sortAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query.limit(limit + 1);
  if (error) {
    throw new Error(`searchJobs: ${error.message}`);
  }

  const rows = (data ?? []) as JobListItem[];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const sortAt =
    last == null
      ? null
      : mode === "verified"
        ? last.trusted_published_at
        : last.discovered_at;
  const nextCursor =
    rows.length > limit && last && sortAt
      ? encodeCursor(sortAt, last.id)
      : null;

  return { jobs: page, nextCursor, mode, window };
}

export async function getJobBySlug(
  client: SupabaseClient,
  slug: string,
): Promise<JobListItem | null> {
  const { data, error } = await client
    .from("job_listings")
    .select(LISTING_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    throw new Error(`getJobBySlug: ${error.message}`);
  }
  return data as JobListItem | null;
}

export async function getJobById(
  client: SupabaseClient,
  id: string,
): Promise<JobListItem | null> {
  const { data, error } = await client
    .from("job_listings")
    .select(LISTING_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`getJobById: ${error.message}`);
  }
  return data as JobListItem | null;
}

export async function getFacets(client: SupabaseClient): Promise<Facets> {
  const { data, error } = await client
    .from("job_listings")
    .select("role_family, seniority, eligible_countries, status")
    .in("status", ["active", "relisted"])
    .limit(2000);

  if (error) {
    throw new Error(`getFacets: ${error.message}`);
  }

  const roles = new Set<string>();
  const levels = new Set<string>();
  const countries = new Set<string>();

  for (const row of data ?? []) {
    if (row.role_family) {
      roles.add(row.role_family);
    }
    if (row.seniority) {
      levels.add(row.seniority);
    }
    for (const code of row.eligible_countries ?? []) {
      if (typeof code === "string" && code.length === 2) {
        countries.add(code.toUpperCase());
      }
    }
  }

  return {
    roles: [...roles].sort(),
    levels: [...levels].sort(
      (a, b) =>
        SENIORITY_LEVELS.indexOf(a as never) -
        SENIORITY_LEVELS.indexOf(b as never),
    ),
    countries: [...countries].sort(),
  };
}

export async function listRolesWithInventory(
  client: SupabaseClient,
): Promise<string[]> {
  const facets = await getFacets(client);
  return facets.roles;
}

export async function searchJobsForCategory(
  client: SupabaseClient,
  role: string,
  country?: string,
): Promise<JobSearchResult> {
  const params: JobSearchParams = {
    role,
    mode: "discovered",
    window: "7d",
    limit: 30,
  };
  if (country) {
    params.country = country;
  }
  return searchJobs(client, params);
}
