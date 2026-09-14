import type { NormalizedJob } from "../../types/normalized-job.js";
import type { SourceRecord } from "../types.js";

export interface AdapterFetchResult {
  jobs: NormalizedJob[];
  /** True only when the full board listing was fetched successfully. */
  completeSnapshot: boolean;
}

export interface SourceAdapter {
  readonly atsType: string;
  fetchBoard(source: SourceRecord): Promise<AdapterFetchResult>;
}
