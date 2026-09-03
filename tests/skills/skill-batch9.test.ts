import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  canSelectCardTarget,
  declareCardUse,
  endCardPlayPhase,
  startCardTurn,
} from "../../src/game/cardEngine";
import { GENERALS_BY_ID, SKILLS } from "../../src/game/catalog/generals";
import type { PlayerID, TqsGameState } from "../../src/game/model";
import { handLimit } from "../../src/game/rules";
import {
  createStartedGame,
  giveCard,
  givePhysicalCard,
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

describe("Standard 2013 EX skills (batch 9)", () => {
  it("Yao Wu lets a wounded source recover after a red Slash deals damage", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const huaXiongID = G.seatOrder[1];
    assignGeneral(G, sourceID, "zhang-fei");
    assignGeneral(G, huaXiongID, "hua-xiong");
    G.players[sourceID].hp -= 1;
    const woundedHP = G.players[sourceID].hp;
    const slashID = givePhysicalCard(
      G,
      sourceID,
      (card) =>
        card.definitionID === "slash" &&
        (card.suit === "heart" || card.suit === "diamond"),
    );

    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [huaXiongID] },
        identityShuffle,
      ),
    ).toBe(true);
    expect(
      answerCardPrompt(
        G,
        huaXiongID,
        G.prompt!.id,
        { kind: "pass" },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.prompt).toMatchObject({
      kind: "option",
      reason: "yao-wu",
      responderID: sourceID,
      choices: ["recover", "draw"],
    });

    expect(
      answerCardPrompt(
        G,
        sourceID,
        G.prompt!.id,
        { kind: "option", choice: "recover" },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.players[sourceID].hp).toBe(woundedHP + 1);
  });

  it("Yao Wu does not trigger for a black Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const huaXiongID = G.seatOrder[1];
    assignGeneral(G, sourceID, "zhang-fei");
    assignGeneral(G, huaXiongID, "hua-xiong");
    const slashID = givePhysicalCard(
      G,
      sourceID,
      (card) =>
        card.definitionID === "slash" &&
        (card.suit === "club" || card.suit === "spade"),
    );

    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [huaXiongID] },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      huaXiongID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );

    expect(G.prompt).toBeNull();
    expect(G.discard).toContain(slashID);
  });

  it("Wang Zun draws a card and lowers the lord's hand limit for that turn", () => {
    const G = createStartedGame();
    resetHands(G);
    const lordID = G.lordID;
    const yuanShuID = G.seatOrder[1];
    assignGeneral(G, yuanShuID, "yuan-shu");

    startCardTurn(G, lordID, identityShuffle);
    expect(G.prompt).toMatchObject({
      kind: "option",
      reason: "wang-zun",
      responderID: yuanShuID,
    });
    expect(
      answerCardPrompt(
        G,
        yuanShuID,
        G.prompt!.id,
        { kind: "option", choice: "activate" },
        identityShuffle,
      ),
    ).toBe(true);

    expect(G.players[yuanShuID].hand).toHaveLength(1);
    expect(handLimit(G, lordID)).toBe(G.players[lordID].hp - 1);
    while (G.players[lordID].hand.length < G.players[lordID].hp)
      giveCard(G, lordID, "dodge");
    expect(endCardPlayPhase(G, lordID, identityShuffle)).toBe(true);
    expect(G.turn.step).toBe("discard");
  });

  it("Wang Zun can be declined without changing the lord's hand limit", () => {
    const G = createStartedGame();
    resetHands(G);
    const lordID = G.lordID;
    const yuanShuID = G.seatOrder[1];
    assignGeneral(G, yuanShuID, "yuan-shu");

    startCardTurn(G, lordID, identityShuffle);
    answerCardPrompt(
      G,
      yuanShuID,
      G.prompt!.id,
      { kind: "option", choice: "decline" },
      identityShuffle,
    );

    expect(G.players[yuanShuID].hand).toHaveLength(0);
    expect(handLimit(G, lordID)).toBe(G.players[lordID].hp);
  });

  it("Tong Ji makes an in-range Yuan Shu the only legal Slash target", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const yuanShuID = G.seatOrder[1];
    const otherID = G.seatOrder[G.seatOrder.length - 1];
    assignGeneral(G, sourceID, "zhang-fei");
    assignGeneral(G, yuanShuID, "yuan-shu");
    assignGeneral(G, otherID, "lu-bu");
    G.players[yuanShuID].hp = 1;
    giveCard(G, yuanShuID, "dodge");
    giveCard(G, yuanShuID, "dodge");
    const slashID = giveCard(G, sourceID, "slash");

    expect(canSelectCardTarget(G, sourceID, "slash", [], otherID)).toBe(false);
    expect(canSelectCardTarget(G, sourceID, "slash", [], yuanShuID)).toBe(true);
    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [otherID] },
        identityShuffle,
      ),
    ).toBe(false);

    G.players[yuanShuID].hp = G.players[yuanShuID].hand.length;
    expect(canSelectCardTarget(G, sourceID, "slash", [], otherID)).toBe(true);
    expect(
      declareCardUse(
        G,
        sourceID,
        { cardID: slashID, targetIDs: [otherID] },
        identityShuffle,
      ),
    ).toBe(true);
  });
});
