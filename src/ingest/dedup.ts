/**
 * Canonicalize an application URL for dedup step 2.
 * Lowercases host, strips tracking params, keeps job identifiers (gh_jid, etc.).
 */
export function canonicalizeApplicationUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  const drop = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
    "source",
  ]);

  const kept: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (drop.has(lower) || lower.startsWith("utm_")) {
      return;
    }
    kept.push([key, value]);
  });
  kept.sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [key, value] of kept) {
    url.searchParams.append(key, value);
  }

  // Normalize trailing slash on pathname (keep root "/").
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  url.hash = "";
  return url.toString();
}

export function normalizeTitleForMatch(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeRegionForMatch(regionText: string): string {
  return regionText.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Prefer company ATS observations over aggregator ones when merging.
 */
export function preferAtsObservation(
  existingAtsType: string | null,
  incomingAtsType: string,
): boolean {
  const incomingIsAts = new Set([
    "ashby",
    "greenhouse",
    "lever",
    "smartrecruiters",
    "workday",
  ]).has(incomingAtsType);
  const existingIsAts =
    existingAtsType !== null &&
    new Set([
      "ashby",
      "greenhouse",
      "lever",
      "smartrecruiters",
      "workday",
    ]).has(existingAtsType);

  if (incomingIsAts && !existingIsAts) {
    return true;
  }
  return false;
}
