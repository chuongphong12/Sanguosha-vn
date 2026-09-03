import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  discardCardHand,
  endCardPlayPhase,
  resumeCardPlayPhase,
} from "../../src/game/cardEngine";
import { distanceBetween } from "../../src/game/rules";
import {
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

describe("core rules v2", () => {
  it("automatically resolves to Play and draws two cards at turn start", () => {
    const G = createStartedGame();
    const playerID = G.turn.activePlayerID;

    expect(G.turn.step).toBe("play");
    expect(G.players[playerID].hand).toHaveLength(6);
  });

  it("resolves Slash with Dodge through a versioned prompt", () => {
    const G = createStartedGame();
    resetHands(G);
    G.turn.step = "play";
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const slashID = giveCard(G, sourceID, "slash");
    const dodgeID = giveCard(G, targetID, "dodge");
    const hp = G.players[targetID].hp;

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.prompt).toMatchObject({
      kind: "card-response",
      response: "dodge",
      responderID: targetID,
    });
    const promptID = G.prompt!.id;
    expect(
      answerCardPrompt(
        G,
        targetID,
        promptID,
        { kind: "card", cardID: dodgeID },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.players[targetID].hp).toBe(hp);
    expect(G.prompt).toBeNull();
    expect(G.discard).toEqual(expect.arrayContaining([slashID, dodgeID]));
  });

  it("rejects stale prompt answers", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const slashID = giveCard(G, sourceID, "slash");
    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [targetID] },
      identityShuffle,
    );

    expect(
      answerCardPrompt(
        G,
        targetID,
        G.prompt!.id + 1,
        { kind: "pass" },
        identityShuffle,
      ),
    ).toBe(false);
  });

  it("returns from Discard to Play without undoing resolved state", () => {
    const G = createStartedGame();
    const playerID = G.turn.activePlayerID;
    const hand = [...G.players[playerID].hand];

    expect(endCardPlayPhase(G, playerID, identityShuffle)).toBe(true);
    expect(G.turn.step).toBe("discard");
    expect(resumeCardPlayPhase(G, playerID)).toBe(true);
    expect(G.turn.step).toBe("play");
    expect(G.players[playerID].hand).toEqual(hand);
  });

  it("discards the exact excess and starts the next turn", () => {
    const G = createStartedGame();
    const playerID = G.turn.activePlayerID;
    endCardPlayPhase(G, playerID, identityShuffle);
    const excess = G.players[playerID].hand.length - G.players[playerID].hp;
    const cards = G.players[playerID].hand.slice(0, excess);

    expect(discardCardHand(G, playerID, cards, identityShuffle)).toBe(true);
    for (let guard = 0; guard < 8 && G.prompt; guard += 1) {
      const prompt = G.prompt;
      answerCardPrompt(
        G,
        prompt.responderID,
        prompt.id,
        prompt.kind === "option"
          ? { kind: "option", choice: "decline" }
          : { kind: "pass" },
        identityShuffle,
      );
    }
    expect(G.turn.activePlayerID).toBe(G.seatOrder[1]);
    expect(G.turn.step).toBe("play");
  });

  it("ignores dead players when calculating distance", () => {
    const G = createStartedGame(5);
    expect(distanceBetween(G, G.seatOrder[0], G.seatOrder[2])).toBe(2);
    G.players[G.seatOrder[1]].alive = false;
    expect(distanceBetween(G, G.seatOrder[0], G.seatOrder[2])).toBe(1);
  });
});
