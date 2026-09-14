import type { EligibilityClassification } from "../types/normalized-job.js";

export interface EligibilityLocationInput {
  /** Free-text primary location, e.g. Ashby `location`. */
  locationText?: string | null;
  /** Primary country labels from structured address fields. */
  primaryCountries?: Array<string | null | undefined>;
  /** Secondary location labels / countries. */
  secondaryCountries?: Array<string | null | undefined>;
  /** Secondary free-text location strings. */
  secondaryLocationTexts?: Array<string | null | undefined>;
}

const WORLDWIDE_RE =
  /\b(worldwide|world[\s-]?wide|anywhere|global(?:ly)?|any\s+location|work\s+from\s+anywhere)\b/i;

/** "Remote" alone must never imply worldwide. */
const REMOTE_ONLY_RE = /^\s*remote(?:\s*[—\-–]\s*)?\s*$/i;

/**
 * Map common Ashby country labels → ISO 3166-1 alpha-2.
 * Unmapped labels are ignored for `eligible_countries` but kept in `region_text`.
 */
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  "united states": "US",
  usa: "US",
  us: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  america: "US",
  canada: "CA",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  ireland: "IE",
  germany: "DE",
  france: "FR",
  spain: "ES",
  italy: "IT",
  netherlands: "NL",
  "the netherlands": "NL",
  belgium: "BE",
  portugal: "PT",
  switzerland: "CH",
  austria: "AT",
  sweden: "SE",
  norway: "NO",
  denmark: "DK",
  finland: "FI",
  poland: "PL",
  romania: "RO",
  croatia: "HR",
  "czech republic": "CZ",
  czechia: "CZ",
  australia: "AU",
  "new zealand": "NZ",
  india: "IN",
  singapore: "SG",
  japan: "JP",
  "south korea": "KR",
  korea: "KR",
  brazil: "BR",
  mexico: "MX",
  "united arab emirates": "AE",
  uae: "AE",
  "saudi arabia": "SA",
  israel: "IL",
};

export function classifyEligibility(
  input: EligibilityLocationInput,
): EligibilityClassification {
  const locationText = clean(input.locationText);
  const secondaryTexts = (input.secondaryLocationTexts ?? [])
    .map(clean)
    .filter((value): value is string => value !== null);

  const regionParts = [locationText, ...secondaryTexts].filter(
    (value): value is string => value !== null,
  );
  const region_text = regionParts.join(" | ");

  const countryLabels = [
    ...(input.primaryCountries ?? []),
    ...(input.secondaryCountries ?? []),
  ]
    .map(clean)
    .filter((value): value is string => value !== null);

  const isoFromStructured = unique(
    countryLabels
      .map((label) => toIsoCountry(label))
      .filter((code): code is string => code !== null),
  );

  const combinedText = [locationText, ...secondaryTexts, ...countryLabels]
    .filter((value): value is string => value !== null)
    .join(" ");

  if (combinedText.length === 0) {
    return {
      eligibility_status: "unclear",
      eligible_countries: [],
      region_text: "",
      eligibility_class: "unclear",
    };
  }

  // Never treat bare "Remote" as worldwide or restricted.
  if (REMOTE_ONLY_RE.test(combinedText) || isRemoteOnlyPhrase(locationText, countryLabels)) {
    return {
      eligibility_status: "unclear",
      eligible_countries: [],
      region_text,
      eligibility_class: "unclear",
    };
  }

  if (WORLDWIDE_RE.test(combinedText) && isoFromStructured.length === 0) {
    return {
      eligibility_status: "worldwide",
      eligible_countries: [],
      region_text,
      eligibility_class: "explicit",
    };
  }

  const isoFromText = extractIsoFromText(combinedText);
  const eligible_countries = unique([...isoFromStructured, ...isoFromText]);

  if (eligible_countries.length > 0) {
    return {
      eligibility_status: "restricted",
      eligible_countries,
      region_text,
      eligibility_class: "explicit",
    };
  }

  // Explicit regional wording without mappable ISO codes still counts as restricted.
  if (hasExplicitRegionWording(combinedText)) {
    return {
      eligibility_status: "restricted",
      eligible_countries: [],
      region_text,
      eligibility_class: "explicit",
    };
  }

  return {
    eligibility_status: "unclear",
    eligible_countries: [],
    region_text,
    eligibility_class: "unclear",
  };
}

function clean(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function toIsoCountry(label: string): string | null {
  const normalized = label.trim().toLowerCase();
  if (/^[a-z]{2}$/i.test(label.trim())) {
    return label.trim().toUpperCase();
  }
  return COUNTRY_NAME_TO_ISO[normalized] ?? null;
}

function extractIsoFromText(text: string): string[] {
  const found: string[] = [];
  for (const [name, iso] of Object.entries(COUNTRY_NAME_TO_ISO)) {
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
    if (pattern.test(text)) {
      found.push(iso);
    }
  }
  // Common Ashby patterns: "Remote - US", "Remote - European Union"
  if (/\bEU\b|european union/i.test(text)) {
    // EU is a region, not a single ISO country — leave countries empty unless
    // member states were also listed; region wording handled separately.
  }
  return unique(found);
}

function hasExplicitRegionWording(text: string): boolean {
  return /\b(european union|\bEU\b|emea|apac|latam|north america|uk\/?eu)\b/i.test(
    text,
  );
}

function isRemoteOnlyPhrase(
  locationText: string | null,
  countryLabels: string[],
): boolean {
  if (countryLabels.some((label) => !/^remote$/i.test(label))) {
    return false;
  }
  if (locationText === null) {
    return false;
  }
  return REMOTE_ONLY_RE.test(locationText);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
