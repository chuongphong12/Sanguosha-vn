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

describe("Bug fixes", () => {
  it("Bug 1: qing-guo allows using any black card as Dodge, not just equipment", () => {
    const G = createStartedGame();
    resetHands(G);
    const zhenJiID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "zhen-ji");

    // Give attacker a slash
    const slashCard = giveCard(G, zhenJiID, "slash");

    // We'll give a black dismantle (black)
    const dismantleCard = givePhysicalCard(
      G,
      targetID,
      (c) => c.definitionID === "dismantle" && (c.suit === "spade" || c.suit === "club"),
    );

    // Attacker uses slash on Zhen Ji
    expect(
      declareCardUse(
        G,
        zhenJiID,
        { cardID: slashCard, targetIDs: [targetID] },
        identityShuffle,
      ),
    ).toBe(true);

    // Zhen Ji is prompted for a Dodge
    expect(G.prompt).toMatchObject({
      responderID: targetID,
      reason: "slash",
      kind: "card-response",
    });

    // Zhen Ji should be able to use the black dismantle as Dodge (qing-guo)
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "card", cardID: dismantleCard },
      identityShuffle,
    );

    // Prompt should be cleared and Zhen Ji avoids damage
    expect(G.prompt).toBeNull();
  });

  it("Bug 2: qi-xi transforms black cards into dismantle, not snatch", () => {
    const G = createStartedGame();
    resetHands(G);
    const ganNingID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, ganNingID, "gan-ning");

    // Give Gan Ning a black card, e.g., a black slash
    const blackCard = givePhysicalCard(
      G,
      ganNingID,
      (c) => c.definitionID === "slash" && (c.suit === "spade" || c.suit === "club"),
    );

    // Give target a card so it can be dismantled
    const targetCard = giveCard(G, targetID, "peach");

    // Gan Ning uses the black card as dismantle (qi-xi)
    expect(
      declareCardUse(
        G,
        ganNingID,
        {
          kind: "virtual",
          cardID: blackCard,
          targetIDs: [targetID],
          as: "dismantle",
        },
        identityShuffle,
      ),
    ).toBe(true);

    // Check if the target is prompted to drop a card or we drop it for them
    // Depending on dismantle implementation, if no prompt, target just loses the card
    // Wait, dismantle prompts the user to select which card of target to drop
    answerNullificationChain(G, {});
    expect(G.prompt).toMatchObject({
      responderID: ganNingID,
      reason: "dismantle",
      kind: "select-cards",
    });
  });
});
