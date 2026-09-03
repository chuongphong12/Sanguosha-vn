import { describe, expect, it } from "vitest";

import { answerCardPrompt, declareCardUse } from "../../src/game/cardEngine";
import { GENERALS_BY_ID, SKILLS } from "../../src/game/catalog/generals";
import type { PlayerID, TqsGameState } from "../../src/game/model";
import {
  answerNullificationChain,
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

describe("card conversion skills (batch 2)", () => {
  it("lets Long Dan answer a Dodge prompt with a Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "zhao-yun");
    const slashID = giveCard(G, sourceID, "slash");
    const responseSlash = giveCard(G, targetID, "slash");
    const hp = G.players[targetID].hp;

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
        G.prompt!.id,
        { kind: "card", cardID: responseSlash },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.players[targetID].hp).toBe(hp);
    expect(G.discard).toEqual(expect.arrayContaining([slashID, responseSlash]));
  });

  it("lets Long Dan answer a Duel Slash prompt with a Dodge", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const zhaoYunID = G.seatOrder[1];
    assignGeneral(G, zhaoYunID, "zhao-yun");
    const duelID = giveCard(G, sourceID, "duel");
    const dodgeAsSlash = giveCard(G, zhaoYunID, "dodge");
    const sourceHP = G.players[sourceID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: duelID, targetIDs: [zhaoYunID] },
      identityShuffle,
    );
    answerNullificationChain(G, {});
    expect(G.prompt!.responderID).toBe(zhaoYunID);
    answerCardPrompt(
      G,
      zhaoYunID,
      G.prompt!.id,
      { kind: "card", cardID: dodgeAsSlash },
      identityShuffle,
    );
    expect(G.prompt!.responderID).toBe(sourceID);
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.players[sourceID].hp).toBe(sourceHP - 1);
  });

  it("lets Wu Sheng use a red hand card as a proactive Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "guan-yu");
    const peachID = giveCard(G, sourceID, "peach");
    const hp = G.players[targetID].hp;

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "virtual",
          cardID: peachID,
          as: "slash",
          targetIDs: [targetID],
        },
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
    expect(G.players[targetID].hp).toBe(hp - 1);
    expect(G.discard).toContain(peachID);
    expect(G.players[sourceID].hand).not.toContain(peachID);
  });

  it("rejects virtual Slash conversion without Wu Sheng or Long Dan", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "zhang-fei");
    const peachID = giveCard(G, sourceID, "peach");

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "virtual",
          cardID: peachID,
          as: "slash",
          targetIDs: [targetID],
        },
        identityShuffle,
      ),
    ).toBe(false);
    expect(G.players[sourceID].hand).toContain(peachID);
  });

  it("lets Qing Guo answer a Dodge prompt with an equipment card", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "zhen-ji");
    const slashID = giveCard(G, sourceID, "slash");
    const equipmentCardID = giveCard(G, targetID, "crossbow");
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
      { kind: "card", cardID: equipmentCardID },
      identityShuffle,
    );
    expect(G.players[targetID].hp).toBe(hp);
    expect(G.discard).toContain(equipmentCardID);
  });

  it("lets Qi Xi use a black hand card as Snatch", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "gan-ning");
    const blackSlashID = givePhysicalCard(
      G,
      sourceID,
      (card) =>
        card.definitionID === "slash" &&
        (card.suit === "spade" || card.suit === "club"),
    );
    const victimCardID = giveCard(G, targetID, "peach");

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "virtual",
          cardID: blackSlashID,
          as: "snatch",
          targetIDs: [targetID],
        },
        identityShuffle,
      ),
    ).toBe(true);
    answerNullificationChain(G, {});
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
    expect(G.players[sourceID].hand).toContain(victimCardID);
    expect(G.discard).toContain(blackSlashID);
  });
});
