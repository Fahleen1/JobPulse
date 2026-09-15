import { describe, expect, it } from "vitest";
import { buildKeywordOrFilter } from "./search";

describe("buildKeywordOrFilter", () => {
  it("quotes multi-word queries for PostgREST", () => {
    expect(buildKeywordOrFilter("Software Engineer")).toBe(
      'title.ilike."%Software%Engineer%",company_name.ilike."%Software%Engineer%",region_text.ilike."%Software%Engineer%"',
    );
  });

  it("returns null for empty input", () => {
    expect(buildKeywordOrFilter("   ")).toBeNull();
  });
});
