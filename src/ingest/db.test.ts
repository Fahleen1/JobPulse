import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "./db.js";

describe("normalizeSupabaseUrl", () => {
  it("keeps project origin", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe(
      "https://abc.supabase.co",
    );
  });

  it("strips /rest/v1 suffix", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1")).toBe(
      "https://abc.supabase.co",
    );
  });

  it("rejects non-https", () => {
    expect(() => normalizeSupabaseUrl("http://abc.supabase.co")).toThrow(/https/);
  });
});
