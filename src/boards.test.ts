import { describe, expect, it } from "vitest";
import { ASHBY_BOARDS, ASHBY_BOARD_KEYS } from "./boards.js";

describe("ASHBY_BOARDS", () => {
  it("lists exactly 10 Module 1 boards", () => {
    expect(ASHBY_BOARDS).toHaveLength(10);
    expect(ASHBY_BOARD_KEYS).toHaveLength(10);
    expect(new Set(ASHBY_BOARD_KEYS).size).toBe(10);
  });
});
