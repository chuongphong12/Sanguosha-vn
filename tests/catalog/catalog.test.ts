import { describe, expect, it } from "vitest";

import {
  CARD_DEFINITIONS,
  STANDARD_2013_DECK,
} from "../../src/game/catalog/cards";
import {
  GENERALS,
  SKILLS,
  getActiveSkillIDs,
  hasLordSkill,
} from "../../src/game/catalog/generals";
import { ROLE_NAMES } from "../../src/game/catalog/roles";

describe("Standard 2013 catalog", () => {
  it("contains the canonical 108-card deck", () => {
    expect(STANDARD_2013_DECK).toHaveLength(108);
    expect(new Set(STANDARD_2013_DECK.map((card) => card.id)).size).toBe(108);

    for (const suit of ["heart", "diamond", "club", "spade"] as const) {
      expect(
        STANDARD_2013_DECK.filter((card) => card.suit === suit),
      ).toHaveLength(27);
      expect(
        STANDARD_2013_DECK.filter(
          (card) => card.suit === suit && card.edition === "ex",
        ),
      ).toHaveLength(1);
    }
  });

  it("contains 53 basic, 36 trick and 19 equipment cards", () => {
    const counts = STANDARD_2013_DECK.reduce<Record<string, number>>(
      (result, card) => {
        const kind = CARD_DEFINITIONS[card.definitionID].kind;
        const group = kind === "delayed-trick" ? "trick" : kind;
        result[group] = (result[group] ?? 0) + 1;
        return result;
      },
      {},
    );

    expect(counts).toEqual({ basic: 53, trick: 36, equipment: 19 });
  });

  it("contains 27 generals and 43 skills", () => {
    expect(GENERALS).toHaveLength(27);
    expect(new Set(GENERALS.map((general) => general.id)).size).toBe(27);
    expect(Object.keys(SKILLS)).toHaveLength(43);

    for (const general of GENERALS) {
      expect(general.skillIDs.length).toBeGreaterThan(0);
      for (const skillID of general.skillIDs)
        expect(SKILLS[skillID]).toBeDefined();
    }
  });

  it("uses the canonical Vietnamese role names", () => {
    expect(ROLE_NAMES).toEqual({
      lord: "Chủ Công",
      loyalist: "Trung Thần",
      rebel: "Phản Tặc",
      renegade: "Nội Gian",
    });
  });

  it("activates Lord skills only for the Lord role", () => {
    expect(getActiveSkillIDs("cao-cao", "lord")).toEqual([
      "jian-xiong",
      "hu-jia",
    ]);
    expect(getActiveSkillIDs("cao-cao", "loyalist")).toEqual(["jian-xiong"]);
    expect(getActiveSkillIDs("liu-bei", "rebel")).toEqual(["ren-de"]);
    expect(getActiveSkillIDs("sun-quan", "renegade")).toEqual(["zhi-heng"]);
    expect(hasLordSkill("cao-cao")).toBe(true);
    expect(hasLordSkill("sima-yi")).toBe(false);
  });
});
