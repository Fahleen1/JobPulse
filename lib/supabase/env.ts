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

export interface SupabasePublicEnv {
  url: string;
  anonKey: string;
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl || !anonKey) {
    return null;
  }

  try {
    const url = normalizeSupabaseUrl(rawUrl);
    return { url, anonKey };
  } catch {
    return null;
  }
}

export function getSupabaseServiceRoleKey(): string | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key && key.length > 0 ? key : null;
}
