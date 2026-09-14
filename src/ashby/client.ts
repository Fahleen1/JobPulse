import type { AshbyJobBoardResponse } from "./types.js";

const ASHBY_HOST = "api.ashbyhq.com";
const DEFAULT_TIMEOUT_MS = 30_000;
/** Soft cap; Ashby boards like OpenAI can exceed 5MB of JSON. */
const MAX_BODY_BYTES = 20 * 1024 * 1024;

export class AshbyClientError extends Error {
  readonly status?: number;
  readonly boardKey: string;

  constructor(boardKey: string, message: string, status?: number) {
    super(message);
    this.name = "AshbyClientError";
    this.boardKey = boardKey;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export interface FetchAshbyBoardOptions {
  includeCompensation?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function buildBoardUrl(boardKey: string, includeCompensation: boolean): URL {
  if (!/^[A-Za-z0-9_-]+$/.test(boardKey)) {
    throw new AshbyClientError(boardKey, `Invalid Ashby board key: ${boardKey}`);
  }

  const url = new URL(`https://${ASHBY_HOST}/posting-api/job-board/${boardKey}`);
  if (includeCompensation) {
    url.searchParams.set("includeCompensation", "true");
  }
  return url;
}

function assertAshbyResponse(
  boardKey: string,
  data: unknown,
): asserts data is AshbyJobBoardResponse {
  if (data === null || typeof data !== "object") {
    throw new AshbyClientError(boardKey, "Ashby response is not an object");
  }

  const record = data as Record<string, unknown>;
  if (typeof record.apiVersion !== "string") {
    throw new AshbyClientError(boardKey, "Ashby response missing apiVersion");
  }
  if (!Array.isArray(record.jobs)) {
    throw new AshbyClientError(boardKey, "Ashby response missing jobs array");
  }

  for (const [index, job] of record.jobs.entries()) {
    if (job === null || typeof job !== "object") {
      throw new AshbyClientError(boardKey, `Ashby job at index ${index} is not an object`);
    }
    const row = job as Record<string, unknown>;
    if (typeof row.id !== "string" || row.id.length === 0) {
      throw new AshbyClientError(boardKey, `Ashby job at index ${index} missing id`);
    }
    if (typeof row.title !== "string" || row.title.length === 0) {
      throw new AshbyClientError(boardKey, `Ashby job at index ${index} missing title`);
    }
  }
}

/**
 * Fetches a public Ashby job board (GET).
 * @see https://developers.ashbyhq.com/docs/public-job-posting-api
 */
export async function fetchAshbyBoard(
  boardKey: string,
  options: FetchAshbyBoardOptions = {},
): Promise<AshbyJobBoardResponse> {
  const includeCompensation = options.includeCompensation ?? false;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = buildBoardUrl(boardKey, includeCompensation);

  if (url.protocol !== "https:" || url.hostname !== ASHBY_HOST) {
    throw new AshbyClientError(boardKey, `Refusing non-Ashby URL: ${url.toString()}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "JobPulse/0.1 (+https://github.com/Fahleen1/JobPulse)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AshbyClientError(
        boardKey,
        `Ashby board fetch failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw new AshbyClientError(
        boardKey,
        `Ashby response exceeds ${MAX_BODY_BYTES} byte limit`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new AshbyClientError(boardKey, "Ashby response is not valid JSON");
    }

    assertAshbyResponse(boardKey, parsed);
    return parsed;
  } catch (error) {
    if (error instanceof AshbyClientError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AshbyClientError(boardKey, `Ashby board fetch timed out after ${timeoutMs}ms`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new AshbyClientError(boardKey, `Ashby board fetch error: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}
