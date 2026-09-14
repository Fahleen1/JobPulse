import { adaptAshbyJobs } from "../../ashby/adapter.js";
import { fetchAshbyBoard } from "../../ashby/client.js";
import type { SourceRecord } from "../types.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

export class AshbySourceAdapter implements SourceAdapter {
  readonly atsType = "ashby";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    if (source.ats_type !== "ashby") {
      throw new Error(`AshbySourceAdapter cannot handle ats_type=${source.ats_type}`);
    }

    const response = await fetchAshbyBoard(source.board_key);
    const jobs = adaptAshbyJobs(response.jobs, {
      boardKey: source.board_key,
      companyName: null,
    });

    return {
      jobs,
      completeSnapshot: true,
    };
  }
}

export function getAdapterForSource(source: SourceRecord): SourceAdapter {
  switch (source.ats_type) {
    case "ashby":
      return new AshbySourceAdapter();
    default:
      throw new Error(`No adapter registered for ats_type=${source.ats_type}`);
  }
}
