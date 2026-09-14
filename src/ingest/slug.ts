/**
 * Build a URL-safe slug from title + board + full external id.
 * Must be globally unique on `jobs.slug` — never truncate the id so hard
 * that two Ashby UUIDs (or same-title roles) can collide.
 */
export function buildJobSlug(
  title: string,
  externalId: string,
  boardKey: string = "",
): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const boardPart = boardKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  const idPart = externalId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!idPart) {
    throw new Error("external_id produced an empty slug id segment");
  }

  const stem = base.length > 0 ? base : "job";
  const parts = boardPart ? [stem, boardPart, idPart] : [stem, idPart];
  return parts.join("-").slice(0, 180);
}
