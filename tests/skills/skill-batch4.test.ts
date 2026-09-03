import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  startCardTurn,
} from "../../src/game/cardEngine";
import { GENERALS_BY_ID, SKILLS } from "../../src/game/catalog/generals";
import type { PlayerID, TqsGameState } from "../../src/game/model";
import {
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

function assignGeneral(
  G: TqsGameState,
  playerID: PlayerID,
  generalID: string,
): void {
  G.players[playerID].generalID = generalID;
  G.players[playerID].activeSkillIDs = GENERALS_BY_ID[
    generalID
  ].skillIDs.filter((skillID) => !SKILLS[skillID].lordSkill);
}

function declineOption(G: TqsGameState): void {
  answerCardPrompt(
    G,
    G.prompt!.responderID,
    G.prompt!.id,
    { kind: "option", choice: "decline" },
    identityShuffle,
  );
}

describe("loss and draw-replacement skills (batch 4)", () => {
  it("lets Tu Xi take one hand card from each of two players", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "zhang-liao");
    const firstVictim = G.seatOrder[1];
    const secondVictim = G.seatOrder[2];
    giveCard(G, firstVictim, "peach");
    giveCard(G, secondVictim, "dodge");
    const takenIDs = [
      G.players[firstVictim].hand[0],
      G.players[secondVictim].hand[0],
    ];

    startCardTurn(G, playerID, identityShuffle);
    expect(G.prompt).toMatchObject({ reason: "tu-xi", responderID: playerID });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      kind: "choose-players",
      candidates: expect.arrayContaining([firstVictim, secondVictim]),
    });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "players", playerIDs: [secondVictim, firstVictim] },
      identityShuffle,
    );

    expect(G.turn.step).toBe("play");
    for (const cardID of takenIDs)
      expect(G.players[playerID].hand).toContain(cardID);
    expect(G.players[firstVictim].hand).toHaveLength(0);
    expect(G.players[secondVictim].hand).toHaveLength(0);
  });

  it("draws normally when Tu Xi is declined", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "zhang-liao");
    giveCard(G, G.seatOrder[1], "peach");

    startCardTurn(G, playerID, identityShuffle);
    declineOption(G);

    expect(G.turn.step).toBe("play");
    expect(G.players[playerID].hand).toHaveLength(2);
  });

  it("offers Lian Ying after using the last hand card", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "lu-xun");
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
    expect(G.prompt).toMatchObject({
      reason: "lian-ying",
      responderID: sourceID,
    });
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[sourceID].hand).toHaveLength(1);
    expect(G.prompt).toBeNull();
  });

  it("does not offer Lian Ying while hand cards remain", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "lu-xun");
    const slashID = giveCard(G, sourceID, "slash");
    giveCard(G, sourceID, "dodge");

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
    expect(G.prompt).toBeNull();
  });

  it("draws two cards with Xiao Ji after losing equipment", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "sun-shangxiang");
    const crossbowID = giveCard(G, playerID, "crossbow");
    G.players[playerID].hand.splice(
      G.players[playerID].hand.indexOf(crossbowID),
      1,
    );
    G.players[playerID].equipment.weapon = crossbowID;
    const halberdID = giveCard(G, playerID, "halberd");

    declareCardUse(
      G,
      playerID,
      { cardID: halberdID, targetIDs: [] },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      reason: "xiao-ji",
      responderID: playerID,
    });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[playerID].equipment.weapon).toBe(halberdID);
    expect(G.discard).toContain(crossbowID);
    expect(G.players[playerID].hand).toHaveLength(2);
  });

  it("declines Xiao Ji without drawing", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "sun-shangxiang");
    const crossbowID = giveCard(G, playerID, "crossbow");
    G.players[playerID].hand.splice(
      G.players[playerID].hand.indexOf(crossbowID),
      1,
    );
    G.players[playerID].equipment.weapon = crossbowID;
    const halberdID = giveCard(G, playerID, "halberd");

    declareCardUse(
      G,
      playerID,
      { cardID: halberdID, targetIDs: [] },
      identityShuffle,
    );
    declineOption(G);
    expect(G.players[playerID].hand).toHaveLength(0);
  });
});
