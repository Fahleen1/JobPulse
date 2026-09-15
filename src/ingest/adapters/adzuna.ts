import type { SourceRecord } from "../types.js";
import { buildNormalizedJob, fetchJson } from "./common.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

interface AdzunaJob {
  id?: string;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
  category?: { label?: string };
}

/**
 * Adzuna requires ADZUNA_APP_ID + ADZUNA_API_KEY.
 * When missing, fetchBoard throws a skip-friendly error handled by the registry.
 */
export class AdzunaAdapter implements SourceAdapter {
  readonly atsType = "adzuna";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    const appId = process.env.ADZUNA_APP_ID?.trim();
    const appKey = process.env.ADZUNA_API_KEY?.trim();
    if (!appId || !appKey) {
      throw new Error("ADZUNA_SKIP: ADZUNA_APP_ID/ADZUNA_API_KEY not configured");
    }

    const countries = ["us", "gb", "de", "fr", "nl", "au"];
    const jobs = [];
    for (const country of countries) {
      const url = new URL(
        `https://api.adzuna.com/v1/api/jobs/${country}/search/1`,
      );
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("results_per_page", "50");
      url.searchParams.set("what", "software engineer");
      // Soft remote preference; still classified via location text.
      url.searchParams.set("what_and", "remote");

      const data = (await fetchJson(url.toString())) as { results?: AdzunaJob[] };
      for (const job of data.results ?? []) {
        if (!job.redirect_url || !job.title || !job.id) {
          continue;
        }
        jobs.push(
          buildNormalizedJob({
            externalId: `${country}-${job.id}`,
            title: job.title,
            description: job.description ?? "",
            applicationUrl: job.redirect_url,
            boardKey: source.board_key,
            companyName: job.company?.display_name ?? null,
            locationText: job.location?.display_name ?? null,
            publishedAt: job.created ?? null,
            roleHint: job.category?.label,
            employmentHint: job.contract_type,
            salaryMin: job.salary_min ?? null,
            salaryMax: job.salary_max ?? null,
            salaryCurrency: country === "gb" ? "GBP" : country === "au" ? "AUD" : "USD",
          }),
        );
      }
    }

    return { jobs, completeSnapshot: true };
  }
}
