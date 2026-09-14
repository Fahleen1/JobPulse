/**
 * Fixed list of public Ashby board keys for Module 1 proof + Module 3 seed.
 * Verified live via GET /posting-api/job-board/{board} (Sep 2026).
 */
export interface AshbyBoard {
  /** Path segment for jobs.ashbyhq.com / posting API. */
  boardKey: string;
  /** Display name for logs and companies.name. */
  label: string;
  /** Canonical company domain for companies.canonical_domain. */
  canonicalDomain: string;
}

export const ASHBY_BOARDS: readonly AshbyBoard[] = [
  { boardKey: "Ashby", label: "Ashby", canonicalDomain: "ashbyhq.com" },
  { boardKey: "notion", label: "Notion", canonicalDomain: "notion.so" },
  { boardKey: "linear", label: "Linear", canonicalDomain: "linear.app" },
  { boardKey: "ramp", label: "Ramp", canonicalDomain: "ramp.com" },
  { boardKey: "openai", label: "OpenAI", canonicalDomain: "openai.com" },
  { boardKey: "supabase", label: "Supabase", canonicalDomain: "supabase.com" },
  { boardKey: "hex", label: "Hex", canonicalDomain: "hex.tech" },
  { boardKey: "snowflake", label: "Snowflake", canonicalDomain: "snowflake.com" },
  { boardKey: "posthog", label: "PostHog", canonicalDomain: "posthog.com" },
  { boardKey: "latchbio", label: "LatchBio", canonicalDomain: "latch.bio" },
] as const;

export const ASHBY_BOARD_KEYS: readonly string[] = ASHBY_BOARDS.map(
  (board) => board.boardKey,
);

export function ashbyEndpoint(boardKey: string): string {
  return `https://api.ashbyhq.com/posting-api/job-board/${boardKey}`;
}
