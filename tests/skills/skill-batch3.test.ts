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

describe("damage and judgement trigger skills (batch 3)", () => {
  it("lets Fan Kui take a card from the damage source", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "sima-yi");
    const slashID = giveCard(G, sourceID, "slash");
    const stolenID = giveCard(G, sourceID, "dodge");
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
      kind: "option",
      reason: "fan-kui",
      responderID: targetID,
    });
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({ kind: "select-cards", reason: "fan-kui" });
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [{ zone: "hand", ownerID: sourceID, handIndex: 0 }],
      },
      identityShuffle,
    );
    expect(G.players[targetID].hand).toContain(stolenID);
    expect(G.players[targetID].hp).toBe(hp - 1);
  });

  it("forces Gang Lie's judge against a source without two hand cards", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "xiahou-dun");
    const slashID = giveCard(G, sourceID, "slash");
    const hpSource = G.players[sourceID].hp;
    const blackJudgeID = Object.keys(G.cards).find(
      (candidateID) =>
        G.cards[candidateID].suit === "spade" && G.deck.includes(candidateID),
    )!;
    stackDeck(G, [blackJudgeID]);

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

    expect(G.players[targetID].hp).toBe(G.players[targetID].maxHP - 1);
    expect(G.players[sourceID].hp).toBe(hpSource - 1);
  });

  it("does nothing when Gang Lie judges a heart", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "xiahou-dun");
    const slashID = giveCard(G, sourceID, "slash");
    const heartID = Object.keys(G.cards).find(
      (candidateID) =>
        G.cards[candidateID].suit === "heart" && G.deck.includes(candidateID),
    )!;
    stackDeck(G, [heartID]);
    const hpSource = G.players[sourceID].hp;

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

    expect(G.players[sourceID].hp).toBe(hpSource);
    expect(G.players[targetID].hp).toBe(G.players[targetID].maxHP - 1);
  });

  it("lets Gang Lie's source discard two hand cards instead", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "xiahou-dun");
    const slashID = giveCard(G, sourceID, "slash");
    giveCard(G, sourceID, "dodge");
    giveCard(G, sourceID, "dodge");
    const blackJudgeID = Object.keys(G.cards).find(
      (candidateID) =>
        G.cards[candidateID].suit === "spade" && G.deck.includes(candidateID),
    )!;
    stackDeck(G, [blackJudgeID]);

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
      reason: "gang-lie-discard",
      responderID: sourceID,
    });
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [
          { zone: "hand", ownerID: sourceID, handIndex: 0 },
          { zone: "hand", ownerID: sourceID, handIndex: 1 },
        ],
      },
      identityShuffle,
    );
    expect(G.players[sourceID].hand).toHaveLength(0);
    expect(G.prompt).toBeNull();
  });

  it("lets Gui Cai replace a lethal Lightning judgement", () => {
    const G = createStartedGame();
    resetHands(G);
    const ownerID = G.turn.activePlayerID;
    const simaYiID = G.seatOrder[1];
    assignGeneral(G, simaYiID, "sima-yi");
    const lightningID = giveCard(G, ownerID, "lightning");
    declareCardUse(
      G,
      ownerID,
      { cardID: lightningID, targetIDs: [] },
      identityShuffle,
    );
    answerNullificationChain(G, {});
    const strikeID = Object.keys(G.cards).find((candidateID) => {
      const card = G.cards[candidateID];
      return (
        card.suit === "spade" &&
        card.rank === "7" &&
        G.deck.includes(candidateID)
      );
    })!;
    const replacementID = giveCard(G, simaYiID, "peach");
    stackDeck(G, [strikeID]);
    const hp = G.players[ownerID].hp;

    startCardTurn(G, ownerID, identityShuffle);
    answerNullificationChain(G, {});
    expect(G.prompt).toMatchObject({
      reason: "gui-cai",
      responderID: simaYiID,
    });
    answerCardPrompt(
      G,
      simaYiID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      simaYiID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [{ zone: "hand", ownerID: simaYiID, handIndex: 0 }],
      },
      identityShuffle,
    );
    expect(G.players[ownerID].hp).toBe(hp);
    expect(G.discard).toContain(replacementID);
    expect(G.players[ownerID].judgement).not.toContain(lightningID);
    expect(G.players[simaYiID].judgement).toContain(lightningID);
  });
});
