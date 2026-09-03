import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  startCardTurn,
} from "../../src/game/cardEngine";
import { GENERALS_BY_ID, SKILLS } from "../../src/game/catalog/generals";
import type { PlayerID, TqsGameState } from "../../src/game/model";
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

function drainToDodge(G: TqsGameState, playerID: PlayerID): void {
  startCardTurn(G, playerID, identityShuffle);
  for (
    let guard = 0;
    guard < 8 &&
    G.prompt &&
    !(
      (G.prompt.kind === "card-response" && G.prompt.response === "dodge") ||
      (G.prompt.kind === "option" && G.prompt.reason === "tie-ji")
    );
    guard += 1
  ) {
    const pending = G.prompt;
    answerCardPrompt(
      G,
      pending.responderID,
      pending.id,
      pending.kind === "option"
        ? { kind: "option", choice: "decline" }
        : { kind: "pass" },
      identityShuffle,
    );
  }
}

describe("hook-matched skills (batch 7)", () => {
  it("Jian Xiong gains the card that caused the damage", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "cao-cao");
    const slashID = giveCard(G, sourceID, "slash");
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
    expect(G.prompt).toMatchObject({
      reason: "jian-xiong",
      responderID: targetID,
    });
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[targetID].hand).toContain(slashID);
    expect(G.players[targetID].hp).toBe(hp - 1);
    expect(G.discard).not.toContain(slashID);
  });

  it("Tie Ji's red judgement stops the target from dodging", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "ma-chao");
    assignGeneral(G, targetID, "guan-yu");
    giveCard(G, sourceID, "slash");
    const dodgeID = giveCard(G, targetID, "dodge");
    const hp = G.players[targetID].hp;

    drainToDodge(G, sourceID);
    const redJudge = Object.keys(G.cards).find(
      (candidateID) =>
        ["heart", "diamond"].includes(G.cards[candidateID].suit) &&
        G.deck.includes(candidateID),
    )!;
    stackDeck(G, [redJudge]);
    expect(
      declareCardUse(
        G,
        sourceID,
        {
          cardID: G.players[sourceID].hand.find(
            (cardID) => G.cards[cardID].definitionID === "slash",
          )!,
          targetIDs: [targetID],
        },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.prompt).toMatchObject({ reason: "tie-ji", responderID: sourceID });
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[targetID].hp).toBe(hp - 1);
    expect(G.players[targetID].hand).toContain(dodgeID);
    expect(G.discard).toContain(redJudge);
  });

  it("Ji Zhi draws a card after using a trick", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "huang-yueying");
    const trickID = giveCard(G, sourceID, "ex-nihilo");
    giveCard(G, targetID, "dodge");

    declareCardUse(
      G,
      sourceID,
      { cardID: trickID, targetIDs: [] },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({ reason: "ji-zhi" });
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    answerNullificationChain(G, {});
    expect(G.players[sourceID].hand).toHaveLength(3);
  });

  it("Ji Jiu lets Hua Tuo rescue with any red card outside his turn", () => {
    const G = createStartedGame();
    resetHands(G);
    const lordID = G.lordID;
    const huaTuoID = G.seatOrder[1];
    const attackerID = G.seatOrder[3];
    assignGeneral(G, attackerID, "zhang-fei");
    assignGeneral(G, huaTuoID, "hua-tuo");
    G.players[lordID].hp = 1;
    const slashID = giveCard(G, attackerID, "slash");
    const redCardID = givePhysicalCard(G, huaTuoID, (card) =>
      ["heart", "diamond"].includes(card.suit),
    );

    startCardTurn(G, attackerID, identityShuffle);
    declareCardUse(
      G,
      attackerID,
      { cardID: slashID, targetIDs: [lordID] },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      G.prompt!.responderID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    while (
      G.prompt?.kind === "card-response" &&
      G.prompt.reason === "rescue" &&
      G.prompt.responderID !== huaTuoID
    ) {
      answerCardPrompt(
        G,
        G.prompt.responderID,
        G.prompt.id,
        { kind: "pass" },
        identityShuffle,
      );
    }
    expect(G.prompt!.responderID).toBe(huaTuoID);
    answerCardPrompt(
      G,
      huaTuoID,
      G.prompt!.id,
      { kind: "card", cardID: redCardID },
      identityShuffle,
    );
    expect(G.players[lordID].alive).toBe(true);
    expect(G.players[lordID].hp).toBe(1);
  });

  it("Liu Li redirects the Slash to another player", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const diaoQiaoID = G.seatOrder[1];
    const newTargetID = G.seatOrder[2];
    assignGeneral(G, diaoQiaoID, "da-qiao");
    assignGeneral(G, newTargetID, "guan-yu");
    const slashID = giveCard(G, sourceID, "slash");
    const discardID = giveCard(G, diaoQiaoID, "dodge");
    const hp = G.players[newTargetID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [diaoQiaoID] },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      reason: "liu-li",
      responderID: diaoQiaoID,
    });
    answerCardPrompt(
      G,
      diaoQiaoID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      diaoQiaoID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [{ zone: "hand", ownerID: diaoQiaoID, handIndex: 0 }],
      },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      diaoQiaoID,
      G.prompt!.id,
      { kind: "players", playerIDs: [newTargetID] },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      response: "dodge",
      responderID: newTargetID,
    });
    answerCardPrompt(
      G,
      newTargetID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.players[newTargetID].hp).toBe(hp - 1);
    expect(G.discard).toContain(discardID);
    expect(G.players[diaoQiaoID].hp).toBe(G.players[diaoQiaoID].maxHP);
  });
});
