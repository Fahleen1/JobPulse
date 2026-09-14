import { createHash } from "node:crypto";

export function contentHash(description: string): string {
  return createHash("sha256").update(description).digest("hex");
}
