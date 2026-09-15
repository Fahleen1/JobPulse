import type { SourceRecord } from "../types.js";
import { buildNormalizedJob, fetchJson } from "./common.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

interface RemoteOkJob {
  id?: string | number;
  company?: string;
  position?: string;
  description?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  location?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
  legal?: string;
}

export class RemoteOkAdapter implements SourceAdapter {
  readonly atsType = "remoteok";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    const data = (await fetchJson(source.endpoint)) as RemoteOkJob[];
    if (!Array.isArray(data)) {
      throw new Error("RemoteOK response is not an array");
    }

    // First item is a legal notice — skip it.
    const jobs = data
      .slice(1)
      .filter((job) => job && !("legal" in job) && (job.apply_url || job.url) && job.position)
      .map((job) =>
        buildNormalizedJob({
          externalId: String(job.id ?? job.url),
          title: job.position ?? "",
          description: job.description ?? "",
          applicationUrl: job.apply_url || job.url || "",
          boardKey: source.board_key,
          companyName: job.company ?? null,
          locationText: job.location ?? null,
          publishedAt: job.date ?? null,
          skills: (job.tags ?? []).map(String),
          salaryMin: typeof job.salary_min === "number" ? job.salary_min : null,
          salaryMax: typeof job.salary_max === "number" ? job.salary_max : null,
          salaryCurrency: "USD",
        }),
      );

    return { jobs, completeSnapshot: true };
  }
}
