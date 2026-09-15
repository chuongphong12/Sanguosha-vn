import { describe, expect, it } from "vitest";
import { answerCardPrompt, resolveCardGame } from "../../src/game/cardEngine";
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

describe("Bug fix 5", () => {
  it("Bug 5: gui-cai should intercept bagua judgement", () => {
    const G = createStartedGame();
    resetHands(G);
    const attackerID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const simaYiID = G.seatOrder[2];

    assignGeneral(G, targetID, "guo-jia"); // arbitrary target
    assignGeneral(G, simaYiID, "sima-yi"); // has gui-cai

    // Give target eight-diagrams
    const baguaCard = giveCard(G, targetID, "bagua-formation");
    G.players[targetID].equipment.armor = baguaCard;

    // Give attacker slash
    const slashCard = giveCard(G, attackerID, "slash");

    // Attacker uses slash on target
    G.effectStack.unshift({
      id: G.nextResolutionID++,
      kind: "slash",
      use: {
        id: G.nextResolutionID++,
        cardName: "slash",
        sourceID: attackerID,
        targetIDs: [targetID],
        materialCardIDs: [slashCard],
        reason: "play",
        color: "red",
      },
      targetIndex: 0,
      stage: "dodge",
      dodgesRequired: 1,
      dodgesUsed: 0,
      ignoreArmor: false,
      ignoreDodge: false,
      tieJiTried: false,
      baguaTried: false,
      liuLiDiscardID: null,
    });

    G.prompt = {
      id: G.nextResolutionID++,
      effectID: G.effectStack[0].id,
      kind: "card-response",
      response: "dodge",
      responderID: targetID,
      reason: "slash",
      allowBagua: true,
      allowSerpentSpear: false,
      allowPass: false,
      sourceID: attackerID,
      targetID: targetID,
      subjectCardName: null,
      chainDepth: 0,
      currentlyNegated: false,
      forbidCard: false,
      summonFaction: null,
    };

    // Give Sima Yi a hand card to use for gui-cai
    giveCard(G, simaYiID, "peach");

    // Target chooses to use Bagua
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "bagua" },
      identityShuffle,
    );

    // Process the pushed effect
    resolveCardGame(G, identityShuffle);

    // If Bug 5 is fixed, Sima Yi should be prompted for gui-cai
    // BEFORE the bagua result is fully applied.
    expect(G.prompt).toMatchObject({
      reason: "gui-cai",
      responderID: simaYiID,
    });
  });
});
