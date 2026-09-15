import type { SourceRecord } from "../types.js";
import { buildNormalizedJob, fetchJson } from "./common.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

interface ArbeitnowJob {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  location?: string;
  created_at?: string;
  tags?: string[];
  job_types?: string[];
}

export class ArbeitnowAdapter implements SourceAdapter {
  readonly atsType = "arbeitnow";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    const data = (await fetchJson(source.endpoint)) as { data?: ArbeitnowJob[] };
    const jobs = (data.data ?? [])
      .filter((job) => job.remote === true && job.url && job.title)
      .map((job) =>
        buildNormalizedJob({
          externalId: String(job.slug ?? job.url),
          title: job.title ?? "",
          description: job.description ?? "",
          applicationUrl: job.url ?? "",
          boardKey: source.board_key,
          companyName: job.company_name ?? null,
          locationText: job.location ?? null,
          publishedAt: job.created_at ?? null,
          skills: job.tags ?? [],
          employmentHint: (job.job_types ?? []).join(" "),
        }),
      );

    return { jobs, completeSnapshot: true };
  }
}
