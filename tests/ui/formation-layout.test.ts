import { describe, expect, it } from "vitest";

import {
  generalPickerLayout,
  screenScale,
} from "../../src/app/screens/main/formationLayout";

describe("generalPickerLayout", () => {
  it("lays candidates side by side at full size when they fit", () => {
    const layout = generalPickerLayout(1600, 860, 3);
    expect(layout.cards).toHaveLength(3);
    expect(layout.cards[0].width).toBe(280);
    expect(layout.cards[1].left - layout.cards[0].left).toBe(280 + 24);
  });

  it("centres the row and shrinks cards that would overflow the viewport", () => {
    const layout = generalPickerLayout(700, 860, 3);
    const first = layout.cards[0];
    const last = layout.cards[2];
    expect(first.width).toBeLessThan(280);
    expect(last.left + last.width).toBeLessThanOrEqual(700 - 30 + 0.001);
    expect(first.left + (last.left + last.width - first.left) / 2).toBeCloseTo(
      350,
    );
  });

  it("puts the confirm button inside each card", () => {
    const layout = generalPickerLayout(1600, 860, 4);
    for (const card of layout.cards) {
      expect(card.confirm.x).toBeGreaterThan(card.left);
      expect(card.confirm.x).toBeLessThan(card.left + card.width);
      expect(card.confirm.y).toBeGreaterThan(card.top);
      expect(card.confirm.y).toBeLessThan(card.top + card.height);
    }
  });
});

describe("screenScale", () => {
  it("never upscales and shrinks proportionally on short viewports", () => {
    expect(screenScale(1200)).toBe(1);
    expect(screenScale(860)).toBe(1);
    expect(screenScale(430)).toBeCloseTo(0.5);
  });
});
