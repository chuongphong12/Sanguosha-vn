import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  discardCardHand,
} from "../../src/game/cardEngine";
import {
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

function passNullificationWindow(
  G: ReturnType<typeof createStartedGame>,
): void {
  while (
    G.prompt?.kind === "card-response" &&
    G.prompt.reason === "nullification"
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

describe("card move payload validation", () => {
  it("rejects malformed play and discard payloads without mutation", () => {
    const G = createStartedGame();
    const playerID = G.turn.activePlayerID;
    const before = structuredClone(G);

    expect(declareCardUse(G, playerID, null, identityShuffle)).toBe(false);
    expect(
      declareCardUse(
        G,
        playerID,
        { cardID: "card-001", targetIDs: null },
        identityShuffle,
      ),
    ).toBe(false);
    expect(discardCardHand(G, playerID, null, identityShuffle)).toBe(false);
    expect(G).toEqual(before);
  });

  it("requires exactly two distinct hand cards for Serpent Spear", () => {
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
    const materialID = giveCard(G, sourceID, "dodge");

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "serpent-spear",
          cardIDs: [materialID],
          targetIDs: [targetID],
        },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G.players[sourceID].hand).toContain(materialID);
    expect(G.effectStack).toEqual([]);
  });

  it("rejects malformed prompt answers and prototype-like zone keys", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const dismantleID = giveCard(G, sourceID, "dismantle");
    const weaponID = giveCard(G, targetID, "crossbow");
    G.players[targetID].hand.splice(
      G.players[targetID].hand.indexOf(weaponID),
      1,
    );
    G.players[targetID].equipment.weapon = weaponID;
    declareCardUse(
      G,
      sourceID,
      { cardID: dismantleID, targetIDs: [targetID] },
      identityShuffle,
    );
    passNullificationWindow(G);
    const promptID = G.prompt!.id;
    const before = structuredClone(G);

    expect(answerCardPrompt(G, sourceID, promptID, null, identityShuffle)).toBe(
      false,
    );
    expect(
      answerCardPrompt(
        G,
        sourceID,
        promptID,
        {
          kind: "zone-cards",
          choices: [
            { zone: "equipment", ownerID: targetID, slot: "constructor" },
          ],
        },
        identityShuffle,
      ),
    ).toBe(false);
    expect(
      answerCardPrompt(
        G,
        sourceID,
        promptID,
        {
          kind: "zone-cards",
          choices: [{ zone: "hand", ownerID: targetID, handIndex: "length" }],
        },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G).toEqual(before);
  });
});
