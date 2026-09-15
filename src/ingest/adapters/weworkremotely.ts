import type { SourceRecord } from "../types.js";
import { buildNormalizedJob, fetchText } from "./common.js";
import type { AdapterFetchResult, SourceAdapter } from "./types.js";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function tagValue(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = re.exec(block);
  if (!match?.[1]) {
    return null;
  }
  return decodeXml(match[1].trim());
}

export class WeWorkRemotelyAdapter implements SourceAdapter {
  readonly atsType = "weworkremotely";

  async fetchBoard(source: SourceRecord): Promise<AdapterFetchResult> {
    const xml = await fetchText(source.endpoint);
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    const jobs = [];

    for (const item of items) {
      const title = tagValue(item, "title");
      const link = tagValue(item, "link");
      const description = tagValue(item, "description") ?? "";
      const pubDate = tagValue(item, "pubDate");
      const guid = tagValue(item, "guid") ?? link;
      if (!title || !link || !guid) {
        continue;
      }

      // Titles often look like "Company: Role".
      let companyName: string | null = null;
      let roleTitle = title;
      const split = title.split(":");
      if (split.length >= 2) {
        companyName = split[0]?.trim() || null;
        roleTitle = split.slice(1).join(":").trim() || title;
      }

      jobs.push(
        buildNormalizedJob({
          externalId: guid,
          title: roleTitle,
          description,
          applicationUrl: link,
          boardKey: source.board_key,
          companyName,
          locationText: "Remote",
          publishedAt: pubDate,
        }),
      );
    }

    return { jobs, completeSnapshot: true };
  }
}
