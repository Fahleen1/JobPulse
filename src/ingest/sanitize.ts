/**
 * Strip executable HTML before storing descriptions.
 * Prefer plain text when available; this sanitizes HTML fallbacks.
 */
export function sanitizeDescription(input: string): string {
  let value = input;

  // Remove script/style blocks entirely.
  value = value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  value = value.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // Drop event-handler attributes and javascript: URLs.
  value = value.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  value = value.replace(/\shref\s*=\s*("|')\s*javascript:[^"']*\1/gi, ' href="#"');
  value = value.replace(/\ssrc\s*=\s*("|')\s*javascript:[^"']*\1/gi, "");

  return value.trim();
}
