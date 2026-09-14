/**
 * Fixed list of public Ashby board keys for Module 1 data proof.
 * Verified live via GET /posting-api/job-board/{board} (Sep 2026).
 */
export interface AshbyBoard {
  /** Path segment for jobs.ashbyhq.com / posting API. */
  boardKey: string;
  /** Display name for logs. */
  label: string;
}

export const ASHBY_BOARDS: readonly AshbyBoard[] = [
  { boardKey: "Ashby", label: "Ashby" },
  { boardKey: "notion", label: "Notion" },
  { boardKey: "linear", label: "Linear" },
  { boardKey: "ramp", label: "Ramp" },
  { boardKey: "openai", label: "OpenAI" },
  { boardKey: "supabase", label: "Supabase" },
  { boardKey: "hex", label: "Hex" },
  { boardKey: "snowflake", label: "Snowflake" },
  { boardKey: "posthog", label: "PostHog" },
  { boardKey: "latchbio", label: "LatchBio" },
] as const;

export const ASHBY_BOARD_KEYS: readonly string[] = ASHBY_BOARDS.map(
  (board) => board.boardKey,
);
