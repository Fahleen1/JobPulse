import type { SourceRecord } from "../types.js";
import { buildNormalizedJob, fetchJson } from "./common.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

interface MuseJob {
  id?: number | string;
  name?: string;
  contents?: string;
  publication_date?: string;
  type?: string;
  company?: { name?: string };
  categories?: Array<{ name?: string }>;
  levels?: Array<{ name?: string }>;
  locations?: Array<{ name?: string }>;
  refs?: { landing_page?: string };
}

const MAX_PAGES = 5;

export class MuseAdapter implements SourceAdapter {
  readonly atsType = "themuse";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    const jobs = [];
    let completeSnapshot = true;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url = new URL(source.endpoint);
      url.searchParams.set("page", String(page));
      url.searchParams.set("descending", "true");

      const data = (await fetchJson(url.toString())) as {
        results?: MuseJob[];
        page_count?: number;
      };

      for (const job of data.results ?? []) {
        const applyUrl = job.refs?.landing_page;
        if (!applyUrl || !job.name || job.id == null) {
          continue;
        }
        // Muse mixes workplace types; keep only clearly remote locations when stated.
        const locationText = (job.locations ?? [])
          .map((entry) => entry.name)
          .filter(Boolean)
          .join(", ");
        const remoteEnough =
          !locationText ||
          /\bremote\b/i.test(locationText) ||
          /\bflexible\b/i.test(locationText);
        if (!remoteEnough) {
          continue;
        }

        jobs.push(
          buildNormalizedJob({
            externalId: String(job.id),
            title: job.name,
            description: job.contents ?? "",
            applicationUrl: applyUrl,
            boardKey: source.board_key,
            companyName: job.company?.name ?? null,
            locationText: locationText || "Remote",
            publishedAt: job.publication_date ?? null,
            roleHint: (job.categories ?? []).map((c) => c.name).join(" "),
            seniorityHint: (job.levels ?? []).map((l) => l.name).join(" "),
            employmentHint: job.type,
          }),
        );
      }

      const pageCount = data.page_count ?? page;
      if (page >= pageCount) {
        break;
      }
      if (page >= MAX_PAGES && page < pageCount) {
        completeSnapshot = false;
      }
    }

    return { jobs, completeSnapshot };
  }
}
