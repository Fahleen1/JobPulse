import { describe, expect, it } from "vitest";
import { buildJobSlug } from "./slug.js";

describe("buildJobSlug", () => {
  it("keeps same-title jobs unique via full external ids", () => {
    const a = buildJobSlug(
      "Senior / Staff Fullstack Engineer",
      "d3bc1ced-3ce4-4086-a050-555055dbb1ff",
      "linear",
    );
    const b = buildJobSlug(
      "Senior / Staff Fullstack Engineer",
      "cd5ae036-0223-427a-b038-ba16ef9dcb32",
      "linear",
    );
    expect(a).not.toBe(b);
    expect(a).toContain("d3bc1ced3ce44086a050555055dbb1ff");
    expect(b).toContain("cd5ae0360223427ab038ba16ef9dcb32");
  });

  it("includes board key so cross-board titles cannot collide on short ids", () => {
    const ashby = buildJobSlug("Engineer", "abc123", "Ashby");
    const notion = buildJobSlug("Engineer", "abc123", "notion");
    expect(ashby).not.toBe(notion);
  });
});
