import { describe, expect, it } from "vitest";
import { classifyEligibility } from "./eligibility.js";

describe("classifyEligibility", () => {
  it("never upgrades bare Remote to worldwide", () => {
    const result = classifyEligibility({ locationText: "Remote" });
    expect(result.eligibility_status).toBe("unclear");
    expect(result.eligibility_class).toBe("unclear");
    expect(result.eligible_countries).toEqual([]);
  });

  it("marks explicit worldwide wording as worldwide", () => {
    const result = classifyEligibility({ locationText: "Remote - Worldwide" });
    expect(result.eligibility_status).toBe("worldwide");
    expect(result.eligibility_class).toBe("explicit");
  });

  it("maps structured countries to restricted + ISO codes", () => {
    const result = classifyEligibility({
      locationText: "Remote - US",
      primaryCountries: ["United States"],
      secondaryCountries: ["Canada"],
      secondaryLocationTexts: ["Canada"],
    });
    expect(result.eligibility_status).toBe("restricted");
    expect(result.eligibility_class).toBe("explicit");
    expect(result.eligible_countries).toEqual(["US", "CA"]);
  });

  it("treats European Union wording as explicit restricted without inventing ISO", () => {
    const result = classifyEligibility({
      locationText: "Remote - European Union",
      primaryCountries: ["European Union"],
      secondaryCountries: ["Germany", "Spain"],
    });
    expect(result.eligibility_status).toBe("restricted");
    expect(result.eligibility_class).toBe("explicit");
    expect(result.eligible_countries).toEqual(["DE", "ES"]);
  });

  it("returns unclear when no location signal exists", () => {
    const result = classifyEligibility({});
    expect(result).toMatchObject({
      eligibility_status: "unclear",
      eligibility_class: "unclear",
      eligible_countries: [],
      region_text: "",
    });
  });
});
