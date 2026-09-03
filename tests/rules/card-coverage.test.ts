import { describe, expect, it } from "vitest";

import { CARD_DEFINITIONS } from "../../src/game/catalog/cards";
import type { CardName } from "../../src/game/model";

const COVERED_CARD_NAMES: CardName[] = [
  "slash",
  "dodge",
  "peach",
  "duel",
  "dismantle",
  "snatch",
  "borrowed-sword",
  "ex-nihilo",
  "nullification",
  "arrow-barrage",
  "barbarian-invasion",
  "peach-garden",
  "harvest",
  "indulgence",
  "lightning",
  "crossbow",
  "qinggang-sword",
  "gender-swords",
  "ice-sword",
  "rock-cleaving-axe",
  "green-dragon-blade",
  "serpent-spear",
  "halberd",
  "qilin-bow",
  "bagua-formation",
  "renwang-shield",
  "jueying",
  "zhaohuang-feidian",
  "dilu",
  "dayuan",
  "red-hare",
  "zixing",
];

describe("card rule coverage", () => {
  it("tracks every card definition in the Standard + EX rules matrix", () => {
    expect(new Set(COVERED_CARD_NAMES)).toEqual(
      new Set(Object.keys(CARD_DEFINITIONS)),
    );
  });
});
