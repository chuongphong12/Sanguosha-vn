import { describe, expect, it } from "vitest";

import { answerCardPrompt, declareCardUse } from "../../src/game/cardEngine";
import { CARD_DEFINITIONS } from "../../src/game/catalog/cards";
import type {
  CardName,
  EquipmentSlot,
  PlayerID,
  TqsGameState,
} from "../../src/game/model";
import {
  createStartedGame,
  giveCard,
  givePhysicalCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

function equip(
  G: TqsGameState,
  playerID: PlayerID,
  cardName: CardName,
): string {
  const cardID = giveCard(G, playerID, cardName);
  const slot = CARD_DEFINITIONS[cardName].equipmentSlot as EquipmentSlot;
  G.players[playerID].hand.splice(G.players[playerID].hand.indexOf(cardID), 1);
  G.players[playerID].equipment[slot] = cardID;
  return cardID;
}

describe("equipment effects", () => {
  it("lets Qinggang Sword ignore Renwang Shield", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    equip(G, sourceID, "qinggang-sword");
    equip(G, targetID, "renwang-shield");
    const slashID = givePhysicalCard(
      G,
      sourceID,
      (card) => card.definitionID === "slash" && card.suit === "spade",
    );
    const hp = G.players[targetID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [targetID] },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      response: "dodge",
      responderID: targetID,
    });
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.players[targetID].hp).toBe(hp - 1);
  });

  it("resolves both choices of Gender Swords", () => {
    for (const choice of ["discard", "draw"] as const) {
      const G = createStartedGame();
      resetHands(G);
      const sourceID = G.turn.activePlayerID;
      const targetID = G.seatOrder[1];
      G.players[targetID].generalID = "zhen-ji";
      equip(G, sourceID, "gender-swords");
      const slashID = giveCard(G, sourceID, "slash");
      giveCard(G, targetID, "dodge");
      const sourceHandBefore = G.players[sourceID].hand.length;

      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [targetID] },
        identityShuffle,
      );
      answerCardPrompt(
        G,
        sourceID,
        G.prompt!.id,
        { kind: "option", choice: "activate" },
        identityShuffle,
      );
      answerCardPrompt(
        G,
        targetID,
        G.prompt!.id,
        { kind: "option", choice },
        identityShuffle,
      );

      if (choice === "discard") {
        answerCardPrompt(
          G,
          targetID,
          G.prompt!.id,
          {
            kind: "zone-cards",
            choices: [{ zone: "hand", ownerID: targetID, handIndex: 0 }],
          },
          identityShuffle,
        );
        expect(G.players[sourceID].hand).toHaveLength(sourceHandBefore - 1);
      } else {
        expect(G.players[sourceID].hand).toHaveLength(sourceHandBefore);
      }
      expect(G.prompt).toMatchObject({
        response: "dodge",
        responderID: targetID,
      });
    }
  });

  it("lets Ice Sword discard two cards instead of dealing damage", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    equip(G, sourceID, "ice-sword");
    const slashID = giveCard(G, sourceID, "slash");
    const first = giveCard(G, targetID, "dodge");
    const second = giveCard(G, targetID, "peach");
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
      { kind: "pass" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [
          { zone: "hand", ownerID: targetID, handIndex: 0 },
          { zone: "hand", ownerID: targetID, handIndex: 1 },
        ],
      },
      identityShuffle,
    );

    expect(G.players[targetID].hp).toBe(hp);
    expect(G.discard).toEqual(expect.arrayContaining([first, second]));
  });

  it("allows Rock-Cleaving Axe to discard itself as part of its cost", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const axeID = equip(G, sourceID, "rock-cleaving-axe");
    const costID = giveCard(G, sourceID, "peach");
    const slashID = giveCard(G, sourceID, "slash");
    const dodgeID = giveCard(G, targetID, "dodge");
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
      { kind: "card", cardID: dodgeID },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [
          { zone: "hand", ownerID: sourceID, handIndex: 0 },
          { zone: "equipment", ownerID: sourceID, slot: "weapon" },
        ],
      },
      identityShuffle,
    );

    expect(G.players[targetID].hp).toBe(hp - 1);
    expect(G.players[sourceID].equipment.weapon).toBeUndefined();
    expect(G.discard).toEqual(expect.arrayContaining([axeID, costID]));
  });

  it("lets Green Dragon Blade continue with another Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    equip(G, sourceID, "green-dragon-blade");
    const firstSlash = giveCard(G, sourceID, "slash");
    const secondSlash = giveCard(G, sourceID, "slash");
    const dodgeID = giveCard(G, targetID, "dodge");
    const hp = G.players[targetID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: firstSlash, targetIDs: [targetID] },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "card", cardID: dodgeID },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "card", cardID: secondSlash },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );

    expect(G.players[targetID].hp).toBe(hp - 1);
    expect(G.discard).toEqual(
      expect.arrayContaining([firstSlash, secondSlash]),
    );
  });

  it("lets a last-hand Slash target three players with Halberd", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetIDs = G.seatOrder.slice(1, 4);
    equip(G, sourceID, "halberd");
    const slashID = giveCard(G, sourceID, "slash");
    for (const targetID of targetIDs) giveCard(G, targetID, "dodge");
    const hpBefore = targetIDs.map((targetID) => G.players[targetID].hp);

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [...targetIDs].reverse() },
        identityShuffle,
      ),
    ).toBe(true);
    for (const targetID of targetIDs) {
      expect(G.prompt).toMatchObject({ responderID: targetID });
      answerCardPrompt(
        G,
        targetID,
        G.prompt!.id,
        { kind: "pass" },
        identityShuffle,
      );
    }
    expect(targetIDs.map((targetID) => G.players[targetID].hp)).toEqual(
      hpBefore.map((hp) => hp - 1),
    );
  });

  it("lets Qilin Bow discard either target mount after damage", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    equip(G, sourceID, "qilin-bow");
    const mountID = equip(G, targetID, "jueying");
    const slashID = giveCard(G, sourceID, "slash");

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
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [
          {
            zone: "equipment",
            ownerID: targetID,
            slot: "defensive-mount",
          },
        ],
      },
      identityShuffle,
    );

    expect(G.players[targetID].equipment["defensive-mount"]).toBeUndefined();
    expect(G.discard).toContain(mountID);
  });
});
