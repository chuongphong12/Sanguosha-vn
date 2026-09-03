import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  endCardPlayPhase,
  startCardTurn,
} from "../../src/game/cardEngine";
import type { CardName } from "../../src/game/model";
import { distanceBetween } from "../../src/game/rules";
import {
  answerNullificationChain,
  createStartedGame,
  giveCard,
  givePhysicalCard,
  identityShuffle,
  resetHands,
  stackDeck,
} from "../helpers/game";

const SELF_OR_GLOBAL: CardName[] = [
  "peach",
  "ex-nihilo",
  "arrow-barrage",
  "barbarian-invasion",
  "peach-garden",
  "harvest",
  "lightning",
];

const SINGLE_TARGET: CardName[] = ["duel", "dismantle", "snatch", "indulgence"];

const EQUIPMENT_CARDS: CardName[] = [
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

function passCurrentNullificationWindow(
  G: ReturnType<typeof createStartedGame>,
): void {
  const effectID = G.effectStack[0]?.id;
  while (
    G.prompt?.kind === "card-response" &&
    G.prompt.reason === "nullification" &&
    G.prompt.effectID === effectID
  ) {
    answerCardPrompt(
      G,
      G.prompt.responderID,
      G.prompt.id,
      { kind: "pass" },
      identityShuffle,
    );
  }
}

describe("Standard + EX card engine", () => {
  it.each(SELF_OR_GLOBAL)("accepts the implicit targets for %s", (cardName) => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    if (cardName === "peach") G.players[playerID].hp -= 1;
    const cardID = giveCard(G, playerID, cardName);

    expect(
      declareCardUse(G, playerID, { cardID, targetIDs: [] }, identityShuffle),
    ).toBe(true);
  });

  it.each(SINGLE_TARGET)("accepts one legal target for %s", (cardName) => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const cardID = giveCard(G, playerID, cardName);
    if (cardName === "dismantle" || cardName === "snatch")
      giveCard(G, targetID, "dodge");

    expect(
      declareCardUse(
        G,
        playerID,
        { cardID, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(true);
  });

  it.each(EQUIPMENT_CARDS)("equips %s into its declared slot", (cardName) => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    const cardID = giveCard(G, playerID, cardName);

    expect(
      declareCardUse(G, playerID, { cardID, targetIDs: [] }, identityShuffle),
    ).toBe(true);
    expect(Object.values(G.players[playerID].equipment)).toContain(cardID);
  });

  it("rejects proactive Dodge and Nullification use", () => {
    for (const cardName of ["dodge", "nullification"] as const) {
      const G = createStartedGame();
      resetHands(G);
      const playerID = G.turn.activePlayerID;
      const cardID = giveCard(G, playerID, cardName);

      expect(
        declareCardUse(G, playerID, { cardID, targetIDs: [] }, identityShuffle),
      ).toBe(false);
      expect(G.players[playerID].hand).toContain(cardID);
    }
  });

  it("accepts Borrowed Sword with two ordered legal targets", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const holderID = G.seatOrder[1];
    const victimID = G.seatOrder[2];
    const trickID = giveCard(G, sourceID, "borrowed-sword");
    const weaponID = giveCard(G, holderID, "halberd");
    G.players[holderID].hand.splice(
      G.players[holderID].hand.indexOf(weaponID),
      1,
    );
    G.players[holderID].equipment.weapon = weaponID;

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: trickID, targetIDs: [holderID, victimID] },
        identityShuffle,
      ),
    ).toBe(true);
  });

  it("lets Crossbow bypass the normal Slash-use limit", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const crossbowID = giveCard(G, sourceID, "crossbow");
    G.players[sourceID].hand.splice(
      G.players[sourceID].hand.indexOf(crossbowID),
      1,
    );
    G.players[sourceID].equipment.weapon = crossbowID;
    G.players[sourceID].slashUses = 3;
    const slashID = giveCard(G, sourceID, "slash");

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(true);
  });

  it("applies offensive and defensive mount distance modifiers", () => {
    const G = createStartedGame(5);
    resetHands(G);
    const sourceID = G.seatOrder[0];
    const targetID = G.seatOrder[2];
    expect(distanceBetween(G, sourceID, targetID)).toBe(2);

    const offensiveID = giveCard(G, sourceID, "red-hare");
    G.players[sourceID].hand.splice(
      G.players[sourceID].hand.indexOf(offensiveID),
      1,
    );
    G.players[sourceID].equipment["offensive-mount"] = offensiveID;
    expect(distanceBetween(G, sourceID, targetID)).toBe(1);

    const defensiveID = giveCard(G, targetID, "jueying");
    G.players[targetID].hand.splice(
      G.players[targetID].hand.indexOf(defensiveID),
      1,
    );
    G.players[targetID].equipment["defensive-mount"] = defensiveID;
    expect(distanceBetween(G, sourceID, targetID)).toBe(2);
  });

  it("resolves Ex Nihilo after a full Nullification pass cycle", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    const cardID = giveCard(G, playerID, "ex-nihilo");
    const nullificationID = giveCard(G, playerID, "nullification");
    stackDeck(G, ["card-001", "card-002"]);
    declareCardUse(G, playerID, { cardID, targetIDs: [] }, identityShuffle);

    expect(G.prompt?.responderID).not.toBe(playerID);
    passCurrentNullificationWindow(G);
    expect(G.players[playerID].hand).toHaveLength(3);
    expect(G.players[playerID].hand).toContain(nullificationID);
  });

  it("lets the trick's source counter a Nullification with their own", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const duelID = giveCard(G, sourceID, "duel");
    const sourceNullification = giveCard(G, sourceID, "nullification");
    const targetNullification = giveCard(G, targetID, "nullification");
    declareCardUse(
      G,
      sourceID,
      { cardID: duelID, targetIDs: [targetID] },
      identityShuffle,
    );

    expect(G.prompt!.responderID).toBe(targetID);
    answerNullificationChain(G, {
      [targetID]: targetNullification,
      [sourceID]: sourceNullification,
    });

    expect(G.prompt).toMatchObject({ kind: "card-response", reason: "duel" });
    expect(G.discard).toEqual(
      expect.arrayContaining([sourceNullification, targetNullification]),
    );
  });

  it("resolves one Nullification window per global-trick target", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const cardID = giveCard(G, sourceID, "arrow-barrage");
    declareCardUse(G, sourceID, { cardID, targetIDs: [] }, identityShuffle);

    const firstAffectedID = G.seatOrder[1];
    expect(G.effectStack[0]).toMatchObject({
      kind: "nullification",
      targetID: firstAffectedID,
    });
  });

  it("reveals and distributes Harvest cards", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const harvestID = giveCard(G, sourceID, "harvest");
    const revealed = G.deck.slice(0, G.seatOrder.length);
    declareCardUse(
      G,
      sourceID,
      { cardID: harvestID, targetIDs: [] },
      identityShuffle,
    );

    passCurrentNullificationWindow(G);
    expect(G.prompt).toMatchObject({
      kind: "harvest-choice",
      responderID: sourceID,
    });
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "harvest", cardID: revealed[0] },
      identityShuffle,
    );
    expect(G.players[sourceID].hand).toContain(revealed[0]);
  });

  it("equips and replaces each equipment slot", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    const first = giveCard(G, playerID, "crossbow");
    const replacement = giveCard(G, playerID, "qinggang-sword");

    expect(
      declareCardUse(
        G,
        playerID,
        { cardID: first, targetIDs: [] },
        identityShuffle,
      ),
    ).toBe(true);
    expect(
      declareCardUse(
        G,
        playerID,
        { cardID: replacement, targetIDs: [] },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.players[playerID].equipment.weapon).toBe(replacement);
    expect(G.discard).toContain(first);
  });

  it("places Indulgence in the target judgement area", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const cardID = giveCard(G, sourceID, "indulgence");
    declareCardUse(
      G,
      sourceID,
      { cardID, targetIDs: [targetID] },
      identityShuffle,
    );

    for (const responderID of G.seatOrder) {
      answerCardPrompt(
        G,
        responderID,
        G.prompt!.id,
        { kind: "pass" },
        identityShuffle,
      );
    }
    expect(G.players[targetID].judgement).toContain(cardID);
  });

  it("skips Play when Indulgence judgement is not a heart", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const indulgenceID = giveCard(G, sourceID, "indulgence");
    for (let index = 0; index < 4; index += 1) giveCard(G, targetID, "dodge");
    declareCardUse(
      G,
      sourceID,
      { cardID: indulgenceID, targetIDs: [targetID] },
      identityShuffle,
    );
    passCurrentNullificationWindow(G);

    G.players[sourceID].hand = [];
    const judgeCard = Object.values(G.cards).find(
      (card) => card.suit === "spade" && card.rank === "K",
    )!;
    stackDeck(G, [judgeCard.id, "card-001", "card-002"]);
    endCardPlayPhase(G, sourceID, identityShuffle);

    passCurrentNullificationWindow(G);
    expect(G.turn.activePlayerID).toBe(targetID);
    expect(G.turn.skippedSteps).toContain("play");
  });

  it("deals three thunder damage when Lightning judges spade 2-9", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const lightningID = giveCard(G, sourceID, "lightning");
    declareCardUse(
      G,
      sourceID,
      { cardID: lightningID, targetIDs: [] },
      identityShuffle,
    );
    passCurrentNullificationWindow(G);
    G.players[sourceID].hand = [];
    const judgeCard = Object.values(G.cards).find(
      (card) => card.suit === "spade" && card.rank === "2",
    )!;
    stackDeck(G, [judgeCard.id, "card-001", "card-002"]);
    const hp = G.players[sourceID].hp;
    startCardTurn(G, sourceID, identityShuffle);
    passCurrentNullificationWindow(G);
    expect(G.players[sourceID].hp).toBe(hp - 3);
  });

  it("lets Renwang Shield block a black Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const slashID = givePhysicalCard(
      G,
      sourceID,
      (card) => card.definitionID === "slash" && card.suit === "spade",
    );
    const shieldID = giveCard(G, targetID, "renwang-shield");
    G.players[targetID].hand.splice(
      G.players[targetID].hand.indexOf(shieldID),
      1,
    );
    G.players[targetID].equipment.armor = shieldID;
    G.players[targetID].hand = [];
    const hp = G.players[targetID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [targetID] },
      identityShuffle,
    );
    expect(G.players[targetID].hp).toBe(hp);
    expect(G.prompt).toBeNull();
  });

  it("allows Bagua Formation to provide Dodge on a red judgement", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const slashID = giveCard(G, sourceID, "slash");
    const baguaID = giveCard(G, targetID, "bagua-formation");
    G.players[targetID].hand.splice(
      G.players[targetID].hand.indexOf(baguaID),
      1,
    );
    G.players[targetID].equipment.armor = baguaID;
    G.players[targetID].hand = [];
    stackDeck(G, ["card-001"]);
    const hp = G.players[targetID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [targetID] },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "bagua" },
      identityShuffle,
    );
    expect(G.players[targetID].hp).toBe(hp);
  });

  it("creates a virtual Slash from two hand cards with Serpent Spear", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const spearID = giveCard(G, sourceID, "serpent-spear");
    G.players[sourceID].hand.splice(
      G.players[sourceID].hand.indexOf(spearID),
      1,
    );
    G.players[sourceID].equipment.weapon = spearID;
    const first = giveCard(G, sourceID, "dodge");
    const second = giveCard(G, sourceID, "peach");

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "serpent-spear",
          cardIDs: [first, second],
          targetIDs: [targetID],
        },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.prompt).toMatchObject({ response: "dodge", targetID });
  });

  it("keeps every physical card in exactly one zone after setup", () => {
    const G = createStartedGame();
    const zoneCardIDs = [
      ...G.deck,
      ...G.discard,
      ...G.processing,
      ...G.seatOrder.flatMap((playerID) => [
        ...G.players[playerID].hand,
        ...Object.values(G.players[playerID].equipment),
        ...G.players[playerID].judgement,
      ]),
    ];

    expect(zoneCardIDs).toHaveLength(108);
    expect(new Set(zoneCardIDs).size).toBe(108);
  });
});
