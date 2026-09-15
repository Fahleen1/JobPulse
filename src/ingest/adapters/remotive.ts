import type { SourceRecord } from "../types.js";
import {
  buildNormalizedJob,
  fetchJson,
} from "./common.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

interface RemotiveJob {
  id: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
  tags?: string[];
}

export class RemotiveAdapter implements SourceAdapter {
  readonly atsType = "remotive";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    const data = (await fetchJson(source.endpoint)) as {
      jobs?: RemotiveJob[];
    };
    const jobs = (data.jobs ?? [])
      .filter((job) => job.url && job.title)
      .map((job) =>
        buildNormalizedJob({
          externalId: String(job.id),
          title: job.title ?? "",
          description: job.description ?? "",
          applicationUrl: job.url ?? "",
          boardKey: source.board_key,
          companyName: job.company_name ?? null,
          locationText: job.candidate_required_location ?? null,
          publishedAt: job.publication_date ?? null,
          roleHint: job.category,
          employmentHint: job.job_type,
          skills: job.tags ?? [],
        }),
      );

    return { jobs, completeSnapshot: true };
  }
}
