import { describe, expect, it } from "vitest";
import {
  answerCardPrompt,
  declareCardUse,
  startCardTurn,
  getVirtualConversions,
  useSkill,
  endCardPlayPhase,
  resumeCardPlayPhase,
  damageEffect,
  resolveCardGame,
} from "../../src/game/cardEngine";
import type {
  CardName,
  EquipmentSlot,
  PromptAnswer,
  TqsGameState,
} from "../../src/game/model";
import { CARD_DEFINITIONS } from "../../src/game/catalog/cards";
import { drawCards } from "../../src/game/rules";
import {
  answerNullificationChain,
  createStartedGame,
  giveCard,
  givePhysicalCard,
  identityShuffle,
  resetHands,
  stackDeck,
} from "../helpers/game";

function fresh(numPlayers = 4) {
  const G = createStartedGame(numPlayers);
  resetHands(G);
  G.config.autoSkipWuxie = true;
  for (const player of Object.values(G.players)) {
    player.generalID = "zhang-fei";
    player.activeSkillIDs = [];
  }
  return G;
}
function answer(G: TqsGameState, playerID: string, value: PromptAnswer) {
  return answerCardPrompt(G, playerID, G.prompt!.id, value, identityShuffle);
}
function equip(G: TqsGameState, playerID: string, name: CardName) {
  const cardID = giveCard(G, playerID, name);
  G.players[playerID].hand.splice(G.players[playerID].hand.indexOf(cardID), 1);
  G.players[playerID].equipment[
    CARD_DEFINITIONS[name].equipmentSlot as EquipmentSlot
  ] = cardID;
  return cardID;
}

describe("Standard 2013 resolution regressions", () => {
  it("Borrowed Sword rejects Spear when Wuxie responses leave the Slash victim in KongCheng", () => {
    const G = fresh();
    G.players["2"].activeSkillIDs = ["kong-cheng"];
    equip(G, "1", "serpent-spear");
    const materials: [string, string] = [
      giveCard(G, "1", "dodge"),
      giveCard(G, "1", "dodge"),
    ];
    const victimWuxie = giveCard(G, "2", "nullification");
    const sourceWuxie = giveCard(G, "0", "nullification");
    const trickID = giveCard(G, "0", "borrowed-sword");
    declareCardUse(
      G,
      "0",
      { cardID: trickID, targetIDs: ["1", "2"] },
      identityShuffle,
    );
    expect(answer(G, "2", { kind: "card", cardID: victimWuxie })).toBe(true);
    expect(answer(G, "0", { kind: "card", cardID: sourceWuxie })).toBe(true);
    answerNullificationChain(G, {});
    expect(G.prompt).toMatchObject({
      reason: "borrowed-sword",
      responderID: "1",
    });
    const before = structuredClone(G);
    expect(answer(G, "1", { kind: "serpent-spear", cardIDs: materials })).toBe(
      false,
    );
    expect(G).toEqual(before);
    expect(answer(G, "1", { kind: "pass" })).toBe(true);
    expect(G.prompt).toBeNull();
  });
  it("FanKui cannot activate when the damage source has only judgement cards", () => {
    const G = fresh();
    G.players["1"].activeSkillIDs = ["fan-kui"];
    const lightningID = giveCard(G, "0", "lightning");
    const slashID = giveCard(G, "0", "slash");
    declareCardUse(
      G,
      "0",
      { cardID: lightningID, targetIDs: [] },
      identityShuffle,
    );
    declareCardUse(
      G,
      "0",
      { cardID: slashID, targetIDs: ["1"] },
      identityShuffle,
    );
    expect(answer(G, "1", { kind: "pass" })).toBe(true);
    expect(G.players["0"].judgement).toContain(lightningID);
    expect(G.prompt).toBeNull();
    expect(G.effectStack).toEqual([]);
  });
  it("GangLie discarding the source's last two cards preserves LianYing", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["lian-ying"];
    G.players["1"].activeSkillIDs = ["gang-lie"];
    const slashID = giveCard(G, "0", "slash");
    const costs = [giveCard(G, "0", "dodge"), giveCard(G, "0", "peach")];
    const judgeID = givePhysicalCard(G, "2", (card) => card.suit === "club");
    stackDeck(G, [judgeID]);
    declareCardUse(
      G,
      "0",
      { cardID: slashID, targetIDs: ["1"] },
      identityShuffle,
    );
    answer(G, "1", { kind: "pass" });
    answer(G, "1", { kind: "option", choice: "activate" });
    answer(G, "0", { kind: "option", choice: "discard-2" });
    answer(G, "0", {
      kind: "zone-cards",
      choices: [
        { zone: "hand", ownerID: "0", handIndex: 0 },
        { zone: "hand", ownerID: "0", handIndex: 1 },
      ],
    });
    expect(G.prompt).toMatchObject({ reason: "lian-ying", responderID: "0" });
    answer(G, "0", { kind: "option", choice: "activate" });
    expect(G.players["0"].hand).toHaveLength(1);
    expect(G.discard).toEqual(expect.arrayContaining(costs));
    expect(G.prompt).toBeNull();
    expect(G.effectStack).toEqual([]);
  });
  it("declining KeJi after skipped Play does not repeat the Draw phase", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["ke-ji"];
    const indulgenceID = giveCard(G, "0", "indulgence");
    G.players["0"].hand.splice(G.players["0"].hand.indexOf(indulgenceID), 1);
    G.players["0"].judgement.push(indulgenceID);
    for (let i = 0; i < 6; i++) giveCard(G, "0", "slash");
    const judgeID = givePhysicalCard(G, "2", (card) => card.suit === "club");
    stackDeck(G, [judgeID]);
    startCardTurn(G, "0", identityShuffle);
    expect(G.players["0"].hand).toHaveLength(8);
    expect(G.prompt).toMatchObject({ reason: "ke-ji" });
    expect(answer(G, "0", { kind: "option", choice: "decline" })).toBe(true);
    expect(G.players["0"].hand).toHaveLength(8);
    expect(G.turn.step).toBe("discard");
    expect(G.prompt).toBeNull();
    expect(G.effectStack).toEqual([]);
  });
  it("FanKui stealing the source's last handcard preserves LianYing and finishes once", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["lian-ying"];
    G.players["1"].activeSkillIDs = ["fan-kui"];
    const slashID = giveCard(G, "0", "slash");
    const stolenID = giveCard(G, "0", "dodge");
    declareCardUse(
      G,
      "0",
      { cardID: slashID, targetIDs: ["1"] },
      identityShuffle,
    );
    answer(G, "1", { kind: "pass" });
    answer(G, "1", { kind: "option", choice: "activate" });
    answer(G, "1", {
      kind: "zone-cards",
      choices: [{ zone: "hand", ownerID: "0", handIndex: 0 }],
    });
    expect(G.prompt).toMatchObject({ reason: "lian-ying", responderID: "0" });
    answer(G, "0", { kind: "option", choice: "activate" });
    expect(G.players["1"].hand).toEqual([stolenID]);
    expect(G.players["0"].hand).toHaveLength(1);
    expect(G.prompt).toBeNull();
    expect(G.effectStack).toEqual([]);
  });
  it("AOE stops immediately at Lord death before damaging later seats", () => {
    const G = fresh();
    G.players["0"].role = "lord";
    G.players["1"].role = "loyalist";
    G.players["2"].role = "rebel";
    G.players["3"].role = "renegade";
    for (const player of Object.values(G.players)) player.hp = 1;
    G.turn.activePlayerID = "3";
    const cardID = giveCard(G, "3", "arrow-barrage");
    expect(
      declareCardUse(G, "3", { cardID, targetIDs: [] }, identityShuffle),
    ).toBe(true);
    expect(G.prompt).toMatchObject({ responderID: "0" });
    expect(answer(G, "0", { kind: "pass" })).toBe(true);
    expect(G.status).toBe("ended");
    expect(G.winner?.side).toBe("rebel");
    expect(G.players["1"].alive).toBe(true);
    expect(G.players["2"].alive).toBe(true);
    expect(G.players["1"].hp).toBe(1);
    expect(G.players["2"].hp).toBe(1);
    expect(G.effectStack).toEqual([]);
    expect(G.prompt).toBeNull();
  });
  it("conserves all 108 physical cards through AOE responses and nested last-hand triggers", () => {
    const G = fresh();
    G.players["1"].activeSkillIDs = ["lian-ying"];
    const dodgeID = giveCard(G, "1", "dodge");
    const cardID = giveCard(G, "0", "arrow-barrage");
    const checkCards = () => {
      const zones = [
        ...G.deck,
        ...G.discard,
        ...G.processing,
        ...Object.values(G.players).flatMap((p) => [
          ...p.hand,
          ...p.judgement,
          ...Object.values(p.equipment),
        ]),
      ];
      expect(zones).toHaveLength(108);
      expect(new Set(zones).size).toBe(108);
      expect([...zones].sort()).toEqual(Object.keys(G.cards).sort());
    };
    expect(
      declareCardUse(G, "0", { cardID, targetIDs: [] }, identityShuffle),
    ).toBe(true);
    checkCards();
    expect(answer(G, "1", { kind: "card", cardID: dodgeID })).toBe(true);
    checkCards();
    expect(answer(G, "1", { kind: "option", choice: "activate" })).toBe(true);
    checkCards();
    expect(answer(G, "2", { kind: "pass" })).toBe(true);
    checkCards();
    expect(answer(G, "3", { kind: "pass" })).toBe(true);
    checkCards();
    expect(G.processing).toEqual([]);
    expect(G.effectStack).toEqual([]);
    expect(G.prompt).toBeNull();
  });
  it("allows one rescuer to play repeated Peaches until negative HP reaches one", () => {
    const G = fresh();
    const peaches = [
      giveCard(G, "0", "peach"),
      giveCard(G, "0", "peach"),
      giveCard(G, "0", "peach"),
    ];
    G.players["1"].hp = 1;
    G.effectStack.push(damageEffect(G, "0", "1", 3));
    resolveCardGame(G, identityShuffle);
    expect(G.players["1"].hp).toBe(-2);
    for (const cardID of peaches) {
      expect(G.prompt).toMatchObject({ reason: "rescue", responderID: "0" });
      expect(answer(G, "0", { kind: "card", cardID })).toBe(true);
    }
    expect(G.players["1"].hp).toBe(1);
    expect(G.players["1"].alive).toBe(true);
    expect(G.prompt).toBeNull();
    expect(G.discard).toEqual(expect.arrayContaining(peaches));
  });
  it("JiZhi directly gains a non-basic revealed card before the original trick finishes", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["ji-zhi"];
    const revealedID = giveCard(G, "0", "crossbow");
    stackDeck(G, [revealedID]);
    const trickID = giveCard(G, "0", "indulgence");
    declareCardUse(
      G,
      "0",
      { cardID: trickID, targetIDs: ["1"] },
      identityShuffle,
    );
    expect(answer(G, "0", { kind: "option", choice: "activate" })).toBe(true);
    expect(G.players["0"].hand).toContain(revealedID);
    expect(G.players["1"].judgement).toContain(trickID);
    expect(G.prompt).toBeNull();
    expect(G.processing).toEqual([]);
  });
  it("an exhausted Draw phase ends the match without advancing to Play", () => {
    const G = fresh();
    G.discard = G.deck.splice(1);
    G.players["3"].hand = G.discard.splice(0);
    startCardTurn(G, "0", identityShuffle);
    expect(G.status).toBe("ended");
    expect(G.winner?.side).toBe("draw");
    expect(G.turn.step).toBe("draw");
    expect(G.prompt).toBeNull();
    expect(G.effectStack).toEqual([]);
  });
  it("Green Dragon's follow-up Slash ignores distance after spending an offensive mount", () => {
    const G = fresh(8);
    G.players["0"].activeSkillIDs = ["wu-sheng"];
    equip(G, "0", "green-dragon-blade");
    const mountID = equip(G, "0", "red-hare");
    const slashID = giveCard(G, "0", "slash");
    const dodgeID = giveCard(G, "4", "dodge");
    expect(
      declareCardUse(
        G,
        "0",
        { cardID: slashID, targetIDs: ["4"] },
        identityShuffle,
      ),
    ).toBe(true);
    answer(G, "4", { kind: "card", cardID: dodgeID });
    answer(G, "0", { kind: "option", choice: "activate" });
    expect(answer(G, "0", { kind: "card", cardID: mountID })).toBe(true);
    expect(G.prompt).toMatchObject({ responderID: "4", reason: "slash" });
    expect(G.players["0"].equipment["offensive-mount"]).toBeUndefined();
    answer(G, "4", { kind: "pass" });
    expect(G.prompt).toBeNull();
  });
  it("requires two new Dodges for each target of a Wushuang Halberd Slash", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["wu-shuang"];
    equip(G, "0", "halberd");
    const slashID = giveCard(G, "0", "slash");
    const dodges = [
      giveCard(G, "1", "dodge"),
      giveCard(G, "1", "dodge"),
      giveCard(G, "2", "dodge"),
      giveCard(G, "2", "dodge"),
    ];
    expect(
      declareCardUse(
        G,
        "0",
        { cardID: slashID, targetIDs: ["1", "2"] },
        identityShuffle,
      ),
    ).toBe(true);
    answer(G, "1", { kind: "card", cardID: dodges[0] });
    answer(G, "1", { kind: "card", cardID: dodges[1] });
    answer(G, "2", { kind: "card", cardID: dodges[2] });
    expect(G.prompt).toMatchObject({ reason: "slash", responderID: "2" });
    answer(G, "2", { kind: "card", cardID: dodges[3] });
    expect(G.prompt).toBeNull();
  });
  it("rejects an AOE response ahead of the next seat without mutating the game", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const cardID = giveCard(G, sourceID, "arrow-barrage");
    declareCardUse(G, sourceID, { cardID, targetIDs: [] }, identityShuffle);
    answerNullificationChain(G, {});
    const before = structuredClone(G);
    expect(
      answerCardPrompt(
        G,
        G.seatOrder[2],
        G.prompt!.id,
        { kind: "pass" },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G).toEqual(before);
  });
  it("takes exactly one card with Snatch and preserves XiaoJi's interruption", () => {
    const G = fresh();
    G.players["1"].activeSkillIDs = ["xiao-ji"];
    const weaponID = equip(G, "1", "crossbow");
    const handID = giveCard(G, "1", "slash");
    const cardID = giveCard(G, "0", "snatch");
    declareCardUse(G, "0", { cardID, targetIDs: ["1"] }, identityShuffle);
    expect(
      answer(G, "0", {
        kind: "zone-cards",
        choices: [{ zone: "equipment", ownerID: "1", slot: "weapon" }],
      }),
    ).toBe(true);
    expect(G.prompt).toMatchObject({ reason: "xiao-ji", responderID: "1" });
    expect(answer(G, "1", { kind: "option", choice: "activate" })).toBe(true);
    expect(G.players["0"].hand).toContain(weaponID);
    expect(G.players["0"].hand).not.toContain(handID);
    expect(G.players["1"].hand).toHaveLength(3);
    expect(G.prompt).toBeNull();
    expect(G.effectStack).toHaveLength(0);
  });
  it.each([false, true])(
    "a red Bagua supplies one Dodge, respecting WuShuang=%s",
    (wuShuang) => {
      const G = fresh();
      if (wuShuang) G.players["0"].activeSkillIDs = ["wu-shuang"];
      equip(G, "1", "bagua-formation");
      const slashID = giveCard(G, "0", "slash");
      const redID = givePhysicalCard(G, "0", (card) => card.suit === "heart");
      stackDeck(G, [redID]);
      const hp = G.players["1"].hp;
      declareCardUse(
        G,
        "0",
        { cardID: slashID, targetIDs: ["1"] },
        identityShuffle,
      );
      expect(answer(G, "1", { kind: "bagua" })).toBe(true);
      if (wuShuang) {
        expect(G.prompt).toMatchObject({ reason: "slash", allowBagua: false });
        const dodgeID = giveCard(G, "1", "dodge");
        expect(answer(G, "1", { kind: "card", cardID: dodgeID })).toBe(true);
      }
      expect(G.players["1"].hp).toBe(hp);
      expect(G.prompt).toBeNull();
      expect(G.effectStack).toHaveLength(0);
    },
  );
  it("declining TieJi continues the original Slash's Dodge window", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["tie-ji"];
    const cardID = giveCard(G, "0", "slash");
    const hp = G.players["1"].hp;
    declareCardUse(G, "0", { cardID, targetIDs: ["1"] }, identityShuffle);
    expect(answer(G, "0", { kind: "option", choice: "decline" })).toBe(true);
    expect(G.prompt).toMatchObject({ reason: "slash", responderID: "1" });
    expect(answer(G, "1", { kind: "pass" })).toBe(true);
    expect(G.players["1"].hp).toBe(hp - 1);
  });
  it.each(["decline", "pass-selection"])(
    "Ice Sword %s preserves LuoYi's Slash bonus",
    (choice) => {
      const G = fresh();
      G.turn.luoYiBuff = true;
      equip(G, "0", "ice-sword");
      giveCard(G, "1", "dodge");
      const cardID = giveCard(G, "0", "slash");
      const hp = G.players["1"].hp;
      declareCardUse(G, "0", { cardID, targetIDs: ["1"] }, identityShuffle);
      answer(G, "1", { kind: "pass" });
      answer(G, "0", {
        kind: "option",
        choice: choice === "decline" ? "decline" : "activate",
      });
      if (choice === "pass-selection") answer(G, "0", { kind: "pass" });
      expect(G.players["1"].hp).toBe(hp - 2);
      expect(G.effectStack).toHaveLength(0);
    },
  );
  it("does not rejudge retained Lightning in the same turn after skipping dead seats", () => {
    const G = fresh();
    G.players["1"].alive = false;
    G.players["2"].alive = false;
    for (const id of ["0", "3"]) {
      const cardID = giveCard(G, id, "lightning");
      G.players[id].hand.splice(G.players[id].hand.indexOf(cardID), 1);
      G.players[id].judgement.push(cardID);
    }
    const missID = givePhysicalCard(G, "0", (card) => card.suit === "heart");
    const hitID = givePhysicalCard(
      G,
      "0",
      (card) => card.suit === "spade" && card.rank === "2",
    );
    stackDeck(G, [missID, hitID]);
    const hp = G.players["0"].hp;
    startCardTurn(G, "0", identityShuffle);
    expect(G.players["0"].hp).toBe(hp);
    expect(G.discard).toContain(missID);
    expect(G.discard).not.toContain(hitID);
    expect(G.players["0"].judgement).toHaveLength(1);
    expect(G.turn.step).toBe("play");
  });
  it("Dismantle emits last-hand loss and preserves LianYing", () => {
    const G = fresh();
    G.players["1"].activeSkillIDs = ["lian-ying"];
    const lostID = giveCard(G, "1", "slash");
    const cardID = giveCard(G, "0", "dismantle");
    declareCardUse(G, "0", { cardID, targetIDs: ["1"] }, identityShuffle);
    expect(
      answer(G, "0", {
        kind: "zone-cards",
        choices: [{ zone: "hand", ownerID: "1", handIndex: 0 }],
      }),
    ).toBe(true);
    expect(G.prompt).toMatchObject({ reason: "lian-ying", responderID: "1" });
    expect(answer(G, "1", { kind: "option", choice: "activate" })).toBe(true);
    expect(G.players["1"].hand).toHaveLength(1);
    expect(G.discard).toContain(lostID);
    expect(G.prompt).toBeNull();
  });
  it.each(["indulgence", "lightning"] as const)(
    "places %s without an early Wuxie window",
    (name) => {
      const G = fresh();
      G.config.autoSkipWuxie = false;
      giveCard(G, "1", "nullification");
      const cardID = giveCard(G, "0", name);
      const targetID = name === "lightning" ? "0" : "1";
      expect(
        declareCardUse(
          G,
          "0",
          { cardID, targetIDs: name === "lightning" ? [] : [targetID] },
          identityShuffle,
        ),
      ).toBe(true);
      expect(G.players[targetID].judgement).toContain(cardID);
      expect(G.prompt).toBeNull();
    },
  );
  it("rejects an illegal virtual Slash without spending its use or material", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["wu-sheng"];
    const cardID = givePhysicalCard(
      G,
      "0",
      (card) => card.suit === "heart" && card.definitionID !== "slash",
    );
    const before = structuredClone(G);
    expect(
      declareCardUse(
        G,
        "0",
        { kind: "virtual", cardID, as: "slash", targetIDs: ["0"] },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G).toEqual(before);
  });
  it("QiXi converts black cards to Dismantle and rejects Snatch atomically", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["qi-xi"];
    giveCard(G, "1", "slash");
    const cardID = givePhysicalCard(
      G,
      "0",
      (card) => card.suit === "spade" && card.definitionID !== "dismantle",
    );
    expect(getVirtualConversions(G, "0", cardID)).toContain("dismantle");
    const before = structuredClone(G);
    expect(
      declareCardUse(
        G,
        "0",
        { kind: "virtual", cardID, as: "snatch", targetIDs: ["1"] },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G).toEqual(before);
    expect(
      declareCardUse(
        G,
        "0",
        { kind: "virtual", cardID, as: "dismantle", targetIDs: ["1"] },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.prompt).toMatchObject({ reason: "dismantle" });
  });
  it("RenDe can give two cards and recover once but rejects a second valid activation", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["ren-de"];
    G.players["0"].hp = 2;
    const cardIDs = [giveCard(G, "0", "slash"), giveCard(G, "0", "dodge")];
    const secondID = giveCard(G, "0", "peach");
    expect(
      useSkill(G, "0", "ren-de", { cardIDs, targetID: "1" }, identityShuffle),
    ).toBe(true);
    expect(G.players["0"].hp).toBe(3);
    const before = structuredClone(G);
    expect(
      useSkill(
        G,
        "0",
        "ren-de",
        { cardIDs: [secondID], targetID: "2" },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G).toEqual(before);
  });
  it.each(["missing", "2"])(
    "YiJi rejects recipient %s without losing cards or throwing",
    (recipientID) => {
      const G = fresh();
      G.players["1"].activeSkillIDs = ["yi-ji"];
      if (recipientID === "2") G.players["2"].alive = false;
      const slashID = giveCard(G, "0", "slash");
      declareCardUse(
        G,
        "0",
        { cardID: slashID, targetIDs: ["1"] },
        identityShuffle,
      );
      answer(G, "1", { kind: "pass" });
      answer(G, "1", { kind: "option", choice: "activate" });
      answer(G, "1", {
        kind: "zone-cards",
        choices: [{ zone: "hand", ownerID: "1", handIndex: 0 }],
      });
      const before = structuredClone(G);
      expect(
        answer(G, "1", { kind: "players", playerIDs: [recipientID] }),
      ).toBe(false);
      expect(G).toEqual(before);
    },
  );
  it("TuXi uses the supplied shuffle and preserves both last-hand loss triggers", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["tu-xi"];
    for (const id of ["1", "2"]) {
      G.players[id].activeSkillIDs = ["lian-ying"];
      giveCard(G, id, "dodge");
    }
    startCardTurn(G, "0", identityShuffle);
    answer(G, "0", { kind: "option", choice: "activate" });
    expect(answer(G, "0", { kind: "players", playerIDs: ["1", "2"] })).toBe(
      true,
    );
    const responders = new Set<string>();
    while (G.prompt?.reason === "lian-ying") {
      responders.add(G.prompt.responderID);
      answer(G, G.prompt.responderID, { kind: "option", choice: "activate" });
    }
    expect([...responders].sort()).toEqual(["1", "2"]);
    expect(G.players["0"].hand).toHaveLength(2);
    expect(G.players["1"].hand).toHaveLength(1);
    expect(G.players["2"].hand).toHaveLength(1);
    expect(G.turn.step).toBe("play");
  });
  it.each(["activate", "decline"])(
    "YingZi %s draws three or two cards then enters Play",
    (choice) => {
      const G = fresh();
      G.players["0"].activeSkillIDs = ["ying-zi"];
      startCardTurn(G, "0", identityShuffle);
      expect(G.prompt).toMatchObject({ reason: "ying-zi", responderID: "0" });
      answer(G, "0", { kind: "option", choice });
      expect(G.players["0"].hand).toHaveLength(choice === "activate" ? 3 : 2);
      expect(G.turn.step).toBe("play");
      expect(G.effectStack).toHaveLength(0);
    },
  );
  it.each(["activate", "decline"])(
    "TianDu %s after Bagua keeps its optional acquisition separate from Dodge",
    (choice) => {
      const G = fresh();
      G.players["1"].activeSkillIDs = ["tian-du"];
      equip(G, "1", "bagua-formation");
      const redID = givePhysicalCard(G, "0", (card) => card.suit === "heart");
      stackDeck(G, [redID]);
      const slashID = giveCard(G, "0", "slash");
      const hp = G.players["1"].hp;
      declareCardUse(
        G,
        "0",
        { cardID: slashID, targetIDs: ["1"] },
        identityShuffle,
      );
      answer(G, "1", { kind: "bagua" });
      expect(G.players["1"].hand).not.toContain(redID);
      expect(G.prompt).toMatchObject({ reason: "tian-du" });
      answer(G, "1", { kind: "option", choice });
      expect(G.players["1"].hand.includes(redID)).toBe(choice === "activate");
      expect(G.discard.includes(redID)).toBe(choice === "decline");
      expect(G.players["1"].hp).toBe(hp);
      expect(G.prompt).toBeNull();
    },
  );
  it.each([false, true])(
    "JiZhi reveals a basic card and offers discard/exchange (exchange=%s)",
    (exchange) => {
      const G = fresh();
      G.players["0"].activeSkillIDs = ["ji-zhi"];
      const revealedID = giveCard(G, "0", "slash");
      stackDeck(G, [revealedID]);
      const swapID = giveCard(G, "0", "dodge");
      const cardID = giveCard(G, "0", "indulgence");
      declareCardUse(G, "0", { cardID, targetIDs: ["1"] }, identityShuffle);
      expect(G.prompt).toMatchObject({ reason: "ji-zhi", kind: "option" });
      answer(G, "0", { kind: "option", choice: "activate" });
      expect(G.prompt).toMatchObject({
        reason: "ji-zhi",
        kind: "select-cards",
      });
      expect(G.processing).toContain(revealedID);
      expect(G.players["0"].hand).not.toContain(revealedID);
      answer(
        G,
        "0",
        exchange
          ? {
              kind: "zone-cards",
              choices: [
                {
                  zone: "hand",
                  ownerID: "0",
                  handIndex: G.players["0"].hand.indexOf(swapID),
                },
              ],
            }
          : { kind: "pass" },
      );
      expect(G.players["0"].hand.includes(revealedID)).toBe(exchange);
      expect(G.players["0"].hand.includes(swapID)).toBe(!exchange);
      expect(G.discard).toContain(exchange ? swapID : revealedID);
      expect(G.players["1"].judgement).toContain(cardID);
      expect(G.processing).toHaveLength(0);
      expect(G.prompt).toBeNull();
    },
  );
  it("QiCai rejects another player's weapon/armor discard but allows Snatch to gain them", () => {
    const G = fresh();
    G.players["1"].activeSkillIDs = ["qi-cai"];
    const armorID = equip(G, "1", "bagua-formation");
    giveCard(G, "1", "slash");
    const cardID = giveCard(G, "0", "dismantle");
    declareCardUse(G, "0", { cardID, targetIDs: ["1"] }, identityShuffle);
    const before = structuredClone(G);
    expect(
      answer(G, "0", {
        kind: "zone-cards",
        choices: [{ zone: "equipment", ownerID: "1", slot: "armor" }],
      }),
    ).toBe(false);
    expect(G).toEqual(before);
    answer(G, "0", {
      kind: "zone-cards",
      choices: [{ zone: "hand", ownerID: "1", handIndex: 0 }],
    });
    const snatchID = giveCard(G, "0", "snatch");
    declareCardUse(
      G,
      "0",
      { cardID: snatchID, targetIDs: ["1"] },
      identityShuffle,
    );
    expect(
      answer(G, "0", {
        kind: "zone-cards",
        choices: [{ zone: "equipment", ownerID: "1", slot: "armor" }],
      }),
    ).toBe(true);
    expect(G.players["0"].hand).toContain(armorID);
  });
  it("KeJi cannot skip Discard after playing a Slash in a Duel during its Play phase", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["ke-ji"];
    const duelID = giveCard(G, "0", "duel");
    const slashID = giveCard(G, "0", "slash");
    const targetSlashID = giveCard(G, "1", "slash");
    for (let i = 0; i < 6; i++) giveCard(G, "0", "dodge");
    declareCardUse(
      G,
      "0",
      { cardID: duelID, targetIDs: ["1"] },
      identityShuffle,
    );
    answer(G, "1", { kind: "card", cardID: targetSlashID });
    answer(G, "0", { kind: "card", cardID: slashID });
    answer(G, "1", { kind: "pass" });
    expect(endCardPlayPhase(G, "0", identityShuffle)).toBe(true);
    expect(G.turn.step).toBe("discard");
    expect(G.prompt).toBeNull();
    expect(G.players["0"].slashUses).toBe(0);
  });
  it("an AOE response using LuXun's last card preserves LianYing and completes only that target", () => {
    const G = fresh();
    G.players["1"].activeSkillIDs = ["lian-ying"];
    const dodgeID = giveCard(G, "1", "dodge");
    const cardID = giveCard(G, "0", "arrow-barrage");
    declareCardUse(G, "0", { cardID, targetIDs: [] }, identityShuffle);
    answer(G, "1", { kind: "card", cardID: dodgeID });
    expect(G.prompt).toMatchObject({ reason: "lian-ying", responderID: "1" });
    answer(G, "1", { kind: "option", choice: "activate" });
    expect(G.prompt).toMatchObject({
      reason: "arrow-barrage",
      responderID: "2",
    });
    expect(G.players["1"].hand).toHaveLength(1);
  });
  it("Discard cannot return to Play after ending the Play phase", () => {
    const G = fresh();
    G.players["0"].hp = 1;
    for (let i = 0; i < 3; i++) giveCard(G, "0", "slash");
    endCardPlayPhase(G, "0", identityShuffle);
    const before = structuredClone(G);
    expect(resumeCardPlayPhase(G, "0")).toBe(false);
    expect(G).toEqual(before);
  });
  it("an unsatisfiable draw ends in a draw before partially dealing cards", () => {
    const G = fresh();
    const deckIDs = G.deck.slice(0, 2);
    G.players["2"].hand = G.deck.slice(2);
    G.deck = deckIDs;
    drawCards(G, "0", 3, identityShuffle);
    expect(G.status).toBe("ended");
    expect(G.winner).toMatchObject({ side: "draw", playerIDs: [] });
    expect(G.players["0"].hand).toHaveLength(0);
    expect(G.deck).toEqual(deckIDs);
    expect(G.prompt).toBeNull();
    expect(G.effectStack).toHaveLength(0);
  });
  it.each([false, true])(
    "AOE Wuxie protects the current target and permits source counter-Wuxie=%s",
    (counter) => {
      const G = fresh();
      G.config.autoSkipWuxie = false;
      const cardID = giveCard(G, "0", "arrow-barrage");
      const protectID = giveCard(G, "2", "nullification");
      const counterID = counter ? giveCard(G, "0", "nullification") : null;
      const hp = G.players["1"].hp;
      declareCardUse(G, "0", { cardID, targetIDs: [] }, identityShuffle);
      answerNullificationChain(G, {
        "2": protectID,
        ...(counterID ? { "0": counterID } : {}),
      });
      if (counter) {
        expect(G.prompt).toMatchObject({
          reason: "arrow-barrage",
          responderID: "1",
        });
        answer(G, "1", { kind: "pass" });
        answerNullificationChain(G, {});
      }
      expect(G.players["1"].hp).toBe(hp - (counter ? 1 : 0));
      expect(G.prompt).toMatchObject({
        reason: "arrow-barrage",
        responderID: "2",
      });
      expect(G.discard).toContain(protectID);
      if (counterID) expect(G.discard).toContain(counterID);
    },
  );
  it("Barbarian Invasion accepts Spear and never receives LuoYi's damage bonus", () => {
    const G = fresh();
    G.turn.luoYiBuff = true;
    equip(G, "1", "serpent-spear");
    const cardIDs: [string, string] = [
      giveCard(G, "1", "dodge"),
      giveCard(G, "1", "peach"),
    ];
    const cardID = giveCard(G, "0", "barbarian-invasion");
    const hp = G.players["2"].hp;
    declareCardUse(G, "0", { cardID, targetIDs: [] }, identityShuffle);
    expect(G.prompt).toMatchObject({ allowSerpentSpear: true });
    expect(answer(G, "1", { kind: "serpent-spear", cardIDs })).toBe(true);
    expect(G.discard).toEqual(expect.arrayContaining(cardIDs));
    answer(G, "2", { kind: "pass" });
    expect(G.players["2"].hp).toBe(hp - 1);
  });
  it("Arrow Barrage rejects Bagua from an unarmored target atomically", () => {
    const G = fresh();
    const cardID = giveCard(G, "0", "arrow-barrage");
    declareCardUse(G, "0", { cardID, targetIDs: [] }, identityShuffle);
    const before = structuredClone(G);
    expect(answer(G, "1", { kind: "bagua" })).toBe(false);
    expect(G).toEqual(before);
  });
  it("rescue starts at the current turn owner and rejects a later rescuer without mutation", () => {
    const G = fresh();
    giveCard(G, "0", "peach");
    const laterID = giveCard(G, "2", "peach");
    G.players["1"].hp = 1;
    G.effectStack.push(damageEffect(G, "0", "1", 1));
    resolveCardGame(G, identityShuffle);
    expect(G.prompt).toMatchObject({ reason: "rescue", responderID: "0" });
    const before = structuredClone(G);
    expect(answer(G, "2", { kind: "card", cardID: laterID })).toBe(false);
    expect(G).toEqual(before);
    answer(G, "0", { kind: "pass" });
    expect(G.prompt).toMatchObject({ responderID: "2" });
    expect(answer(G, "2", { kind: "card", cardID: laterID })).toBe(true);
    expect(G.players["1"].hp).toBe(1);
    expect(G.prompt).toBeNull();
  });
  it("a Lord killing a Loyalist keeps judgement cards and offers XiaoJi after losing armor", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["xiao-ji"];
    G.players["1"].role = "loyalist";
    G.players["1"].hp = 1;
    equip(G, "0", "bagua-formation");
    const delayedID = giveCard(G, "0", "indulgence");
    G.players["0"].hand.splice(G.players["0"].hand.indexOf(delayedID), 1);
    G.players["0"].judgement.push(delayedID);
    giveCard(G, "0", "dodge");
    const slashID = giveCard(G, "0", "slash");
    declareCardUse(
      G,
      "0",
      { cardID: slashID, targetIDs: ["1"] },
      identityShuffle,
    );
    answer(G, "1", { kind: "pass" });
    expect(G.players["0"].hand).toHaveLength(0);
    expect(G.players["0"].equipment).toEqual({});
    expect(G.players["0"].judgement).toEqual([delayedID]);
    expect(G.prompt).toMatchObject({ reason: "xiao-ji", responderID: "0" });
    answer(G, "0", { kind: "option", choice: "activate" });
    expect(G.players["0"].hand).toHaveLength(2);
    expect(G.prompt).toBeNull();
  });
  it.each([
    ["long-dan", "dodge"],
    ["wu-sheng", "peach"],
    ["lian-ying", "slash"],
  ] as const)(
    "Borrowed Sword accepts %s and preserves card-loss interruptions",
    (skillID, material) => {
      const G = fresh();
      G.players["1"].activeSkillIDs = [skillID];
      equip(G, "1", "crossbow");
      const materialID = giveCard(G, "1", material);
      const cardID = giveCard(G, "0", "borrowed-sword");
      const hp = G.players["2"].hp;
      declareCardUse(
        G,
        "0",
        { cardID, targetIDs: ["1", "2"] },
        identityShuffle,
      );
      expect(answer(G, "1", { kind: "card", cardID: materialID })).toBe(true);
      if (skillID === "lian-ying") {
        expect(G.prompt).toMatchObject({ reason: "lian-ying" });
        answer(G, "1", { kind: "option", choice: "activate" });
      }
      expect(G.prompt).toMatchObject({ reason: "slash", responderID: "2" });
      expect(answer(G, "2", { kind: "pass" })).toBe(true);
      expect(G.players["2"].hp).toBe(hp - 1);
      expect(G.players["1"].equipment.weapon).toBeDefined();
      expect(G.discard).toContain(materialID);
      expect(G.effectStack).toHaveLength(0);
    },
  );
  it("Green Dragon Blade can use LongDan's Dodge as a follow-up Slash", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["long-dan"];
    equip(G, "0", "green-dragon-blade");
    const slashID = giveCard(G, "0", "slash");
    const convertedID = giveCard(G, "0", "dodge");
    const dodgeID = giveCard(G, "1", "dodge");
    const hp = G.players["1"].hp;
    declareCardUse(
      G,
      "0",
      { cardID: slashID, targetIDs: ["1"] },
      identityShuffle,
    );
    answer(G, "1", { kind: "card", cardID: dodgeID });
    answer(G, "0", { kind: "option", choice: "activate" });
    expect(answer(G, "0", { kind: "card", cardID: convertedID })).toBe(true);
    answer(G, "1", { kind: "pass" });
    expect(G.players["1"].hp).toBe(hp - 1);
    expect(G.discard).toContain(convertedID);
    expect(G.effectStack).toHaveLength(0);
  });
  it("a HuJia ally's last Dodge preserves LianYing before the original Slash finishes", () => {
    const G = fresh();
    G.players["1"].activeSkillIDs = ["hu-jia"];
    G.players["2"].generalID = "cao-cao";
    G.players["2"].activeSkillIDs = ["lian-ying"];
    const dodgeID = giveCard(G, "2", "dodge");
    const slashID = giveCard(G, "0", "slash");
    const hp = G.players["1"].hp;
    declareCardUse(
      G,
      "0",
      { cardID: slashID, targetIDs: ["1"] },
      identityShuffle,
    );
    answer(G, "1", { kind: "summon" });
    expect(answer(G, "2", { kind: "card", cardID: dodgeID })).toBe(true);
    expect(G.prompt).toMatchObject({ reason: "lian-ying", responderID: "2" });
    answer(G, "2", { kind: "option", choice: "activate" });
    expect(G.players["1"].hp).toBe(hp);
    expect(G.players["2"].hand).toHaveLength(1);
    expect(G.prompt).toBeNull();
  });
  it("spending a red weapon as virtual Slash must not use the sacrificed weapon's range", () => {
    const G = fresh();
    G.players["0"].activeSkillIDs = ["wu-sheng"];
    const weaponID = equip(G, "0", "qilin-bow");
    const before = structuredClone(G);
    expect(
      declareCardUse(
        G,
        "0",
        { kind: "virtual", cardID: weaponID, as: "slash", targetIDs: ["2"] },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G).toEqual(before);
  });
  it("Ice Sword discards in sequence, allowing LianYing between the two discards", () => {
    const G = fresh();
    G.players["1"].activeSkillIDs = ["lian-ying"];
    equip(G, "0", "ice-sword");
    const firstID = giveCard(G, "1", "dodge");
    const slashID = giveCard(G, "0", "slash");
    const hp = G.players["1"].hp;
    declareCardUse(
      G,
      "0",
      { cardID: slashID, targetIDs: ["1"] },
      identityShuffle,
    );
    answer(G, "1", { kind: "pass" });
    answer(G, "0", { kind: "option", choice: "activate" });
    answer(G, "0", {
      kind: "zone-cards",
      choices: [{ zone: "hand", ownerID: "1", handIndex: 0 }],
    });
    expect(G.prompt).toMatchObject({ reason: "lian-ying" });
    answer(G, "1", { kind: "option", choice: "activate" });
    const secondID = G.players["1"].hand[0];
    expect(G.prompt).toMatchObject({
      reason: "ice-sword",
      responderID: "0",
      maximum: 1,
    });
    answer(G, "0", {
      kind: "zone-cards",
      choices: [{ zone: "hand", ownerID: "1", handIndex: 0 }],
    });
    expect(G.prompt).toMatchObject({ reason: "lian-ying" });
    answer(G, "1", { kind: "option", choice: "activate" });
    expect(G.players["1"].hp).toBe(hp);
    expect(G.discard).toEqual(expect.arrayContaining([firstID, secondID]));
    expect(G.players["1"].hand).toHaveLength(1);
    expect(G.prompt).toBeNull();
  });
});
