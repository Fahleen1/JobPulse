import type { SourceRecord } from "../types.js";
import { buildNormalizedJob, fetchJson } from "./common.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

interface HimalayasJob {
  guid?: string;
  title?: string;
  description?: string;
  excerpt?: string;
  applicationLink?: string;
  companyName?: string;
  pubDate?: number | string;
  locationRestrictions?: string[];
  categories?: string[];
  seniority?: string[];
  employmentType?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
}

const MAX_PAGES = 5;

export class HimalayasAdapter implements SourceAdapter {
  readonly atsType = "himalayas";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    const jobs = [];
    let cursor: string | null = null;
    let pages = 0;
    let completeSnapshot = true;

    while (pages < MAX_PAGES) {
      pages += 1;
      const url = new URL(source.endpoint);
      url.searchParams.set("limit", "100");
      if (cursor) {
        url.searchParams.set("offset", cursor);
      }

      const data = (await fetchJson(url.toString())) as {
        jobs?: HimalayasJob[];
        nextCursor?: string | null;
      };

      for (const job of data.jobs ?? []) {
        if (!job.applicationLink || !job.title || !job.guid) {
          continue;
        }
        const publishedAt =
          typeof job.pubDate === "number"
            ? job.pubDate
            : (job.pubDate ?? null);
        jobs.push(
          buildNormalizedJob({
            externalId: String(job.guid),
            title: job.title,
            description: job.description ?? job.excerpt ?? "",
            applicationUrl: job.applicationLink,
            boardKey: source.board_key,
            companyName: job.companyName ?? null,
            locationText: (job.locationRestrictions ?? []).join(", ") || null,
            publishedAt,
            roleHint: (job.categories ?? []).join(" "),
            seniorityHint: (job.seniority ?? []).join(" "),
            employmentHint: job.employmentType,
            salaryMin: job.minSalary ?? null,
            salaryMax: job.maxSalary ?? null,
            salaryCurrency: job.currency ?? null,
          }),
        );
      }

      if (!data.nextCursor) {
        break;
      }
      cursor = String(data.nextCursor);
      if (pages >= MAX_PAGES) {
        completeSnapshot = false;
      }
    }

    return { jobs, completeSnapshot };
  }
}
