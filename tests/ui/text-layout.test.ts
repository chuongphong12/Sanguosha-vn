import { describe, expect, it } from "vitest";

import { fitScale } from "../../src/app/ui/textLayout";

describe("text layout", () => {
  it("keeps text at natural size when it fits", () => {
    expect(fitScale({ width: 100, height: 30 }, 120, 40)).toBe(1);
  });

  it("scales overflowing text to fit both dimensions", () => {
    expect(fitScale({ width: 240, height: 60 }, 120, 40)).toBe(0.5);
  });

  it("does not produce invalid scales for empty bounds", () => {
    expect(fitScale({ width: 0, height: 0 }, 120, 40)).toBe(1);
    expect(fitScale({ width: 20, height: 20 }, 0, 40)).toBe(0);
  });
});
