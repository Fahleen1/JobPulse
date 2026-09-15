import type { SourceRecord } from "../types.js";
import { buildNormalizedJob, fetchJson } from "./common.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

interface JobicyJob {
  id?: string | number;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobType?: string;
  jobGeo?: string;
  jobLevel?: string;
  jobIndustry?: string;
  pubDate?: string;
  jobDescription?: string;
}

export class JobicyAdapter implements SourceAdapter {
  readonly atsType = "jobicy";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    const data = (await fetchJson(source.endpoint)) as { jobs?: JobicyJob[] };
    const jobs = (data.jobs ?? [])
      .filter((job) => job.url && job.jobTitle)
      .map((job) =>
        buildNormalizedJob({
          externalId: String(job.id ?? job.url),
          title: job.jobTitle ?? "",
          description: job.jobDescription ?? "",
          applicationUrl: job.url ?? "",
          boardKey: source.board_key,
          companyName: job.companyName ?? null,
          locationText: job.jobGeo ?? null,
          publishedAt: job.pubDate ?? null,
          roleHint: Array.isArray(job.jobIndustry)
            ? job.jobIndustry.join(" ")
            : String(job.jobIndustry ?? ""),
          seniorityHint: job.jobLevel,
          employmentHint: Array.isArray(job.jobType)
            ? job.jobType.join(" ")
            : String(job.jobType ?? ""),
        }),
      );

    return { jobs, completeSnapshot: true };
  }
}
