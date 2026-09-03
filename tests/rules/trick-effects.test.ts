import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  endCardPlayPhase,
  startCardTurn,
} from "../../src/game/cardEngine";
import type { CardName, PlayerID, TqsGameState } from "../../src/game/model";
import {
  answerNullificationChain,
  createStartedGame,
  giveCard,
  givePhysicalCard,
  identityShuffle,
  resetHands,
  stackDeck,
} from "../helpers/game";

function passNullificationWindow(G: TqsGameState): void {
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

function equipWeapon(
  G: TqsGameState,
  playerID: PlayerID,
  cardName: CardName,
): string {
  const cardID = giveCard(G, playerID, cardName);
  G.players[playerID].hand.splice(G.players[playerID].hand.indexOf(cardID), 1);
  G.players[playerID].equipment.weapon = cardID;
  return cardID;
}

describe("trick card effects", () => {
  it("alternates Slash responses during Duel and damages the first passer", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    G.players[sourceID].generalID = "zhang-fei";
    G.players[sourceID].activeSkillIDs = ["pao-xiao"];
    const duelID = giveCard(G, sourceID, "duel");
    const responseID = giveCard(G, targetID, "slash");
    const hp = G.players[sourceID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: duelID, targetIDs: [targetID] },
      identityShuffle,
    );
    passNullificationWindow(G);
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "card", cardID: responseID },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );

    expect(G.players[sourceID].hp).toBe(hp - 1);
    expect(G.discard).toEqual(expect.arrayContaining([duelID, responseID]));
  });

  it.each([
    ["dismantle", "discard"],
    ["snatch", "gain"],
  ] as const)("resolves %s against a hidden hand card", (cardName, result) => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const trickID = giveCard(G, sourceID, cardName);
    const selectedID = giveCard(G, targetID, "peach");

    declareCardUse(
      G,
      sourceID,
      { cardID: trickID, targetIDs: [targetID] },
      identityShuffle,
    );
    passNullificationWindow(G);
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [{ zone: "hand", ownerID: targetID, handIndex: 0 }],
      },
      identityShuffle,
    );

    expect(G.players[targetID].hand).not.toContain(selectedID);
    if (result === "gain")
      expect(G.players[sourceID].hand).toContain(selectedID);
    else expect(G.discard).toContain(selectedID);
  });

  it("transfers the weapon when Borrowed Sword's holder declines Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const holderID = G.seatOrder[1];
    const victimID = G.seatOrder[2];
    const trickID = giveCard(G, sourceID, "borrowed-sword");
    const weaponID = equipWeapon(G, holderID, "halberd");

    declareCardUse(
      G,
      sourceID,
      { cardID: trickID, targetIDs: [holderID, victimID] },
      identityShuffle,
    );
    passNullificationWindow(G);
    answerCardPrompt(
      G,
      holderID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );

    expect(G.players[holderID].equipment.weapon).toBeUndefined();
    expect(G.players[sourceID].hand).toContain(weaponID);
  });

  it.each([
    ["arrow-barrage", "dodge"],
    ["barbarian-invasion", "slash"],
  ] as const)(
    "resolves one %s response per other living player",
    (cardName, response) => {
      const G = createStartedGame();
      resetHands(G);
      const sourceID = G.turn.activePlayerID;
      const targetIDs = G.seatOrder.slice(1);
      const trickID = giveCard(G, sourceID, cardName);
      const responseID = giveCard(G, targetIDs[0], response);
      const hpBefore = targetIDs.map((targetID) => G.players[targetID].hp);

      declareCardUse(
        G,
        sourceID,
        { cardID: trickID, targetIDs: [] },
        identityShuffle,
      );
      for (const [index, targetID] of targetIDs.entries()) {
        passNullificationWindow(G);
        expect(G.prompt).toMatchObject({ responderID: targetID, response });
        answerCardPrompt(
          G,
          targetID,
          G.prompt!.id,
          index === 0 ? { kind: "card", cardID: responseID } : { kind: "pass" },
          identityShuffle,
        );
      }

      expect(targetIDs.map((targetID) => G.players[targetID].hp)).toEqual([
        hpBefore[0],
        ...hpBefore.slice(1).map((hp) => hp - 1),
      ]);
    },
  );

  it("recovers each wounded living player with Peach Garden", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    for (const playerID of G.seatOrder) G.players[playerID].hp -= 1;
    const hpBefore = G.seatOrder.map((playerID) => G.players[playerID].hp);
    const cardID = giveCard(G, sourceID, "peach-garden");

    declareCardUse(G, sourceID, { cardID, targetIDs: [] }, identityShuffle);
    for (const playerID of G.seatOrder) {
      passNullificationWindow(G);
      expect(G.players[playerID].hp).toBe(
        hpBefore[G.seatOrder.indexOf(playerID)] + 1,
      );
    }
    expect(G.prompt).toBeNull();
  });

  it("closes odd and even Nullification chains with the expected parity", () => {
    for (const count of [1, 2]) {
      const G = createStartedGame();
      resetHands(G);
      const sourceID = G.turn.activePlayerID;
      const targetID = G.seatOrder[1];
      const duelID = giveCard(G, sourceID, "duel");
      const targetNullification = giveCard(G, targetID, "nullification");
      const sourceNullification =
        count === 2 ? giveCard(G, sourceID, "nullification") : null;
      declareCardUse(
        G,
        sourceID,
        { cardID: duelID, targetIDs: [targetID] },
        identityShuffle,
      );
      answerNullificationChain(
        G,
        sourceNullification
          ? { [targetID]: targetNullification, [sourceID]: sourceNullification }
          : { [targetID]: targetNullification },
      );

      if (count === 1) expect(G.prompt).toBeNull();
      else
        expect(G.prompt).toMatchObject({
          reason: "duel",
          responderID: targetID,
        });
      expect(G.discard).toContain(targetNullification);
      if (sourceNullification) expect(G.discard).toContain(sourceNullification);
    }
  });
});

describe("delayed trick effects", () => {
  it("keeps Play when Indulgence judges a heart", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const indulgenceID = giveCard(G, sourceID, "indulgence");
    declareCardUse(
      G,
      sourceID,
      { cardID: indulgenceID, targetIDs: [targetID] },
      identityShuffle,
    );
    passNullificationWindow(G);
    const judgeID = givePhysicalCard(
      G,
      sourceID,
      (card) => card.suit === "heart" && card.id !== indulgenceID,
    );
    G.players[sourceID].hand.splice(
      G.players[sourceID].hand.indexOf(judgeID),
      1,
    );
    stackDeck(G, [judgeID]);

    endCardPlayPhase(G, sourceID, identityShuffle);
    passNullificationWindow(G);

    expect(G.turn.activePlayerID).toBe(targetID);
    expect(G.turn.step).toBe("play");
    expect(G.turn.skippedSteps).not.toContain("play");
    expect(G.discard).toContain(indulgenceID);
  });

  it("transfers Lightning after a non-spade-2-to-9 judgement", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const nextID = G.seatOrder[1];
    const lightningID = giveCard(G, sourceID, "lightning");
    declareCardUse(
      G,
      sourceID,
      { cardID: lightningID, targetIDs: [] },
      identityShuffle,
    );
    passNullificationWindow(G);
    const judgeID = givePhysicalCard(
      G,
      sourceID,
      (card) => card.suit === "heart" && card.id !== lightningID,
    );
    G.players[sourceID].hand.splice(
      G.players[sourceID].hand.indexOf(judgeID),
      1,
    );
    stackDeck(G, [judgeID]);

    startCardTurn(G, sourceID, identityShuffle);
    passNullificationWindow(G);

    expect(G.players[sourceID].judgement).not.toContain(lightningID);
    expect(G.players[nextID].judgement).toContain(lightningID);
  });

  it("rejects duplicate delayed tricks in one judgement area", () => {
    for (const cardName of ["indulgence", "lightning"] as const) {
      const G = createStartedGame();
      resetHands(G);
      const sourceID = G.turn.activePlayerID;
      const targetID = cardName === "lightning" ? sourceID : G.seatOrder[1];
      const existingID = giveCard(G, targetID, cardName);
      G.players[targetID].hand.splice(
        G.players[targetID].hand.indexOf(existingID),
        1,
      );
      G.players[targetID].judgement.push(existingID);
      const duplicateID = giveCard(G, sourceID, cardName);

      expect(
        declareCardUse(
          G,
          sourceID,
          {
            cardID: duplicateID,
            targetIDs: cardName === "lightning" ? [] : [targetID],
          },
          identityShuffle,
        ),
      ).toBe(false);
      expect(G.players[sourceID].hand).toContain(duplicateID);
    }
  });
});

describe("dying and death", () => {
  it("lets a responder rescue a dying player with Peach", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    G.players[targetID].hp = 1;
    const slashID = giveCard(G, sourceID, "slash");
    const peachID = giveCard(G, sourceID, "peach");

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
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({ reason: "rescue", responderID: sourceID });
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "card", cardID: peachID },
      identityShuffle,
    );

    expect(G.players[targetID].alive).toBe(true);
    expect(G.players[targetID].hp).toBe(1);
  });

  it("kills a dying player after every living player passes", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    G.players[targetID].hp = 1;
    const slashID = giveCard(G, sourceID, "slash");
    giveCard(G, targetID, "peach");

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
      { kind: "pass" },
      identityShuffle,
    );
    while (G.prompt?.kind === "card-response" && G.prompt.reason === "rescue") {
      answerCardPrompt(
        G,
        G.prompt.responderID,
        G.prompt.id,
        { kind: "pass" },
        identityShuffle,
      );
    }

    expect(G.players[targetID].alive).toBe(false);
    expect(G.players[targetID].roleRevealed).toBe(true);
    expect(G.players[targetID].hand).toEqual([]);
  });
});
