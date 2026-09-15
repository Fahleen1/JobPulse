import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface IngestDbEnv {
  url: string;
  serviceRoleKey: string;
}

/**
 * Normalize a Supabase project URL to origin only.
 * Users sometimes paste .../rest/v1 which breaks the JS client path.
 */
export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`Invalid Supabase URL: ${raw}`);
  }
  if (url.protocol !== "https:") {
    throw new Error("Supabase URL must use https://");
  }
  // Strip accidental /rest/v1 or /auth/v1 suffixes.
  url.pathname = url.pathname.replace(
    /\/(rest|auth|storage|functions)\/v1\/?$/,
    "",
  );
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (url.pathname !== "/") {
    throw new Error(
      `Supabase URL should be the project origin only (got path ${url.pathname}). Example: https://xxxx.supabase.co`,
    );
  }
  return url.origin;
}

export function getIngestDbEnv(): IngestDbEnv {
  const rawUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl) {
    throw new Error(
      "Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL (https required) for ingestion.",
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env / Netlify / GitHub Actions secrets — never expose it to the browser.",
    );
  }

  return {
    url: normalizeSupabaseUrl(rawUrl),
    serviceRoleKey,
  };
}

/** Service-role client for ingestion writes. Bypasses RLS. */
export function createIngestClient(): SupabaseClient {
  const env = getIngestDbEnv();
  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
