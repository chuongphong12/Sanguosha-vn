import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  endCardPlayPhase,
  startCardTurn,
} from "../../src/game/cardEngine";
import { GENERALS_BY_ID, SKILLS } from "../../src/game/catalog/generals";
import type { PlayerID, TqsGameState } from "../../src/game/model";
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

describe("passive rule skills (batch 1)", () => {
  it("lets Pao Xiao use multiple Slashes in one turn", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "zhang-fei");
    const firstSlash = giveCard(G, sourceID, "slash");
    const secondSlash = giveCard(G, sourceID, "slash");
    const hp = G.players[targetID].hp;

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: firstSlash, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(true);
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.prompt).toBeNull();
    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: secondSlash, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(true);
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.players[targetID].hp).toBe(hp - 2);
  });

  it("lets Ke Ji skip Discard after a Slash-free turn", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "lu-meng");
    for (let index = 0; index < 8; index += 1) giveCard(G, playerID, "peach");

    expect(endCardPlayPhase(G, playerID, identityShuffle)).toBe(true);
    expect(G.prompt).toMatchObject({ reason: "ke-ji" });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.turn.activePlayerID).not.toBe(playerID);

    const secondRound = createStartedGame();
    resetHands(secondRound);
    const luMengID = secondRound.turn.activePlayerID;
    assignGeneral(secondRound, luMengID, "lu-meng");
    giveCard(secondRound, luMengID, "slash");
    for (let index = 0; index < 7; index += 1)
      giveCard(secondRound, luMengID, "peach");
    const targetID = secondRound.seatOrder[1];
    declareCardUse(
      secondRound,
      luMengID,
      { cardID: secondRound.players[luMengID].hand[0], targetIDs: [targetID] },
      identityShuffle,
    );
    answerCardPrompt(
      secondRound,
      targetID,
      secondRound.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(endCardPlayPhase(secondRound, luMengID, identityShuffle)).toBe(true);
    expect(secondRound.turn.step).toBe("discard");
    expect(secondRound.turn.activePlayerID).toBe(luMengID);
  });

  it("applies Ma Shu as a permanent distance reduction", () => {
    const G = createStartedGame(5);
    resetHands(G);
    const sourceID = G.seatOrder[0];
    const targetID = G.seatOrder[2];
    expect(distanceBetween(G, sourceID, targetID)).toBe(2);
    assignGeneral(G, sourceID, "ma-chao");
    expect(distanceBetween(G, sourceID, targetID)).toBe(1);
  });

  it("lets Qi Cai use Snatch regardless of distance", () => {
    const G = createStartedGame(5);
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const farTargetID = G.seatOrder[2];
    assignGeneral(G, sourceID, "huang-yueying");
    const snatchID = giveCard(G, sourceID, "snatch");
    giveCard(G, farTargetID, "dodge");

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: snatchID, targetIDs: [farTargetID] },
        identityShuffle,
      ),
    ).toBe(true);
    answerNullificationChain(G, {});
  });

  it("blocks Kong Cheng from being targeted while hand is empty", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "zhuge-liang");
    const slashID = giveCard(G, sourceID, "slash");
    const duelID = giveCard(G, sourceID, "duel");

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(false);
    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: duelID, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(false);
    giveCard(G, targetID, "peach");
    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(true);
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
  });

  it("blocks Qian Xun from Snatch and Dismantle", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "lu-xun");
    giveCard(G, targetID, "dodge");
    const dismantleID = giveCard(G, sourceID, "dismantle");

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: dismantleID, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G.players[sourceID].hand).toContain(dismantleID);
  });

  it("requires two Dodges against Wu Shuang's Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "lu-bu");
    const slashID = giveCard(G, sourceID, "slash");
    const firstDodge = giveCard(G, targetID, "dodge");
    const secondDodge = giveCard(G, targetID, "dodge");
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
      { kind: "card", cardID: firstDodge },
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
      { kind: "card", cardID: secondDodge },
      identityShuffle,
    );
    expect(G.players[targetID].hp).toBe(hp);
    expect(G.prompt).toBeNull();
  });

  it("requires two Slashes per Duel round against Wu Shuang", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const luBuID = G.seatOrder[1];
    assignGeneral(G, luBuID, "lu-bu");
    const duelID = giveCard(G, sourceID, "duel");
    const luBuSlash = giveCard(G, luBuID, "slash");
    const firstSourceSlash = giveCard(G, sourceID, "slash");
    const secondSourceSlash = giveCard(G, sourceID, "slash");
    const hp = G.players[luBuID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: duelID, targetIDs: [luBuID] },
      identityShuffle,
    );
    answerNullificationChain(G, {});
    answerCardPrompt(
      G,
      luBuID,
      G.prompt!.id,
      { kind: "card", cardID: luBuSlash },
      identityShuffle,
    );
    expect(G.prompt!.responderID).toBe(sourceID);
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "card", cardID: firstSourceSlash },
      identityShuffle,
    );
    expect(G.prompt!.responderID).toBe(sourceID);
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "card", cardID: secondSourceSlash },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      luBuID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.players[luBuID].hp).toBe(hp - 1);
  });

  it("draws three cards with Ying Zi", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "zhou-yu");
    stackDeck(G, ["card-001", "card-002", "card-003"]);

    startCardTurn(G, playerID, identityShuffle);
    expect(G.players[playerID].hand).toHaveLength(3);
  });

  it("draws one card at end phase with Bi Yue", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "diao-chan");
    giveCard(G, playerID, "peach");
    const nextID = G.seatOrder[1];

    expect(endCardPlayPhase(G, playerID, identityShuffle)).toBe(true);
    expect(G.prompt).toMatchObject({ reason: "bi-yue" });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[playerID].hand).toHaveLength(2);
    expect(G.turn.activePlayerID).toBe(nextID);
  });

  it("takes the judgement card into hand with Tian Du", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "guo-jia");
    const lightningID = giveCard(G, playerID, "lightning");
    declareCardUse(
      G,
      playerID,
      { cardID: lightningID, targetIDs: [] },
      identityShuffle,
    );
    answerNullificationChain(G, {});
    const judgeID = givePhysicalCard(
      G,
      playerID,
      (card) => card.suit === "heart",
    );
    G.players[playerID].hand.splice(
      G.players[playerID].hand.indexOf(judgeID),
      1,
    );
    stackDeck(G, [judgeID]);

    startCardTurn(G, playerID, identityShuffle);
    answerNullificationChain(G, {});
    expect(G.players[playerID].judgement).not.toContain(lightningID);
    expect(G.players[playerID].hand).toContain(judgeID);
    expect(G.discard).not.toContain(judgeID);
  });
});
