import { describe, expect, it } from "vitest";

import { layoutActionRow } from "../../src/app/ui/layout";

describe("action row layout", () => {
  it("aligns a two-button row to the content frame", () => {
    const layout = layoutActionRow(1840, 820, [180, 190]);

    expect(layout.centers).toEqual([1518, 1711]);
    expect(layout.centers[1] + 190 / 2).toBe(1840 - 34);
    expect(layout.centers[1] - 190 / 2 - (layout.centers[0] + 180 / 2)).toBe(8);
    expect(layout.widths).toEqual([180, 190]);
    expect(layout.centerY + 48 / 2).toBe(820 - 280);
  });

  it("aligns a single button using the same right and bottom insets", () => {
    const layout = layoutActionRow(768, 820, [240]);

    expect(layout.centers).toEqual([614]);
    expect(layout.widths).toEqual([240]);
    expect(layout.centerY).toBe(516);
  });

  it("shrinks a wide response row inside a narrow viewport", () => {
    const layout = layoutActionRow(375, 667, [180, 170, 160]);
    const left = layout.centers[0] - layout.widths[0] / 2;
    const right = layout.centers[2] + layout.widths[2] / 2;

    expect(left).toBeGreaterThanOrEqual(34);
    expect(right).toBeLessThanOrEqual(375 - 34);
  });
});
