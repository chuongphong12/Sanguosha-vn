import { describe, expect, it } from "vitest";

import { parseLocalPlayerCount } from "../../src/app/screens/main/localConfig";

describe("parseLocalPlayerCount", () => {
  it("accepts every count the rules support", () => {
    for (let n = 4; n <= 10; n += 1)
      expect(parseLocalPlayerCount(String(n))).toBe(n);
  });

  it("clamps counts the engine would reject instead of crashing the match", () => {
    expect(parseLocalPlayerCount("2")).toBe(4);
    expect(parseLocalPlayerCount("0")).toBe(4);
    expect(parseLocalPlayerCount("12")).toBe(10);
  });

  it("falls back to 4 for missing or garbage input", () => {
    expect(parseLocalPlayerCount(undefined)).toBe(4);
    expect(parseLocalPlayerCount("abc")).toBe(4);
    expect(parseLocalPlayerCount(null)).toBe(4);
  });
});
