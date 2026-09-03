import { describe, expect, it } from "vitest";

import { STANDARD_2013_DECK } from "../../src/game/catalog/cards";
import { getEquipmentSlotViews } from "../../src/app/ui/equipmentView";

describe("equipment view", () => {
  it("returns all four public equipment slots", () => {
    const cards = Object.fromEntries(
      STANDARD_2013_DECK.map((card) => [card.id, card]),
    );
    const weapon = STANDARD_2013_DECK.find(
      (card) => card.definitionID === "qinggang-sword",
    )!;
    const armor = STANDARD_2013_DECK.find(
      (card) => card.definitionID === "bagua-formation",
    )!;

    expect(
      getEquipmentSlotViews(cards, {
        weapon: weapon.id,
        armor: armor.id,
      }),
    ).toEqual([
      {
        slot: "weapon",
        label: "Vũ Khí",
        cardID: weapon.id,
        cardName: "Thanh Công Kiếm",
        cardLabel: "【Thanh Công Kiếm】 ♠ 6",
      },
      {
        slot: "armor",
        label: "Phòng Cụ",
        cardID: armor.id,
        cardName: "Bát Quái Trận",
        cardLabel: "【Bát Quái Trận】 ♠ 2",
      },
      {
        slot: "offensive-mount",
        label: "Tọa Kỵ -1",
        cardID: null,
        cardName: "Trống",
        cardLabel: "Trống",
      },
      {
        slot: "defensive-mount",
        label: "Tọa Kỵ +1",
        cardID: null,
        cardName: "Trống",
        cardLabel: "Trống",
      },
    ]);
  });
});
