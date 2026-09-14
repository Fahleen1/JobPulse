/**
 * Raw Ashby Job Posting API types.
 * Based on a live GET https://api.ashbyhq.com/posting-api/job-board/Ashby response
 * and https://developers.ashbyhq.com/docs/public-job-posting-api
 *
 * Note: REQUIREMENTS.md said POST; Ashby's public docs use GET. We use GET.
 */

export type AshbyWorkplaceType = "OnSite" | "Remote" | "Hybrid";

export type AshbyEmploymentType =
  | "FullTime"
  | "PartTime"
  | "Intern"
  | "Contract"
  | "Temporary";

export interface AshbyPostalAddress {
  addressLocality?: string;
  addressRegion?: string;
  addressCountry?: string;
  postalCode?: string;
}

export interface AshbyAddress {
  postalAddress?: AshbyPostalAddress;
}

export interface AshbySecondaryLocation {
  location?: string;
  address?: AshbyAddress;
}

export interface AshbyCompensationComponent {
  id?: string;
  summary?: string;
  compensationType?: string;
  interval?: string;
  currencyCode?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
}

export interface AshbyCompensationTier {
  id?: string;
  tierSummary?: string;
  title?: string;
  additionalInformation?: string | null;
  components?: AshbyCompensationComponent[];
}

export interface AshbyCompensation {
  compensationTierSummary?: string;
  scrapeableCompensationSalarySummary?: string;
  compensationTiers?: AshbyCompensationTier[];
  summaryComponents?: AshbyCompensationComponent[];
}

export interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: AshbySecondaryLocation[];
  department?: string;
  team?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: AshbyWorkplaceType;
  descriptionHtml?: string;
  descriptionPlain?: string;
  /** ISO DateTime when the job was *last* published (not first published). */
  publishedAt?: string;
  employmentType?: AshbyEmploymentType;
  address?: AshbyAddress;
  jobUrl?: string;
  applyUrl?: string;
  compensation?: AshbyCompensation;
  shouldDisplayCompensationOnJobBoard?: boolean;
  shouldDisplayCompensationOnJobPostings?: boolean;
}

export interface AshbyJobBoardResponse {
  apiVersion: string;
  jobs: AshbyJob[];
}
