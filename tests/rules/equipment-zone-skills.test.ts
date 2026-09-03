import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  startCardTurn,
} from "../../src/game/cardEngine";
import { CARD_DEFINITIONS } from "../../src/game/catalog/cards";
import { GENERALS_BY_ID, SKILLS } from "../../src/game/catalog/generals";
import type {
  EquipmentSlot,
  PlayerID,
  TqsGameState,
} from "../../src/game/model";
import {
  answerNullificationChain,
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

/** Draws a physical card matching the predicate straight into an equipment slot. */
function giveEquippedCard(
  G: TqsGameState,
  playerID: PlayerID,
  slot: EquipmentSlot,
  predicate: (card: TqsGameState["cards"][string]) => boolean,
): string {
  const card = G.deck
    .map((cardID) => G.cards[cardID])
    .find((candidate) => predicate(candidate));
  if (!card) throw new Error("Không tìm thấy lá trang bị phù hợp.");
  G.deck.splice(G.deck.indexOf(card.id), 1);
  G.players[playerID].equipment[slot] = card.id;
  return card.id;
}

describe("equipment-zone skill expansion", () => {
  it("lets Wu Sheng use an equipped red weapon as a proactive Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "guan-yu");
    const redWeaponID = giveEquippedCard(
      G,
      sourceID,
      "weapon",
      (card) => card.suit === "heart" || card.suit === "diamond",
    );
    const hp = G.players[targetID].hp;

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "virtual",
          cardID: redWeaponID,
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
    expect(G.players[sourceID].equipment.weapon).toBeUndefined();
    expect(G.discard).toContain(redWeaponID);
  });

  it("lets Qi Xi use an equipped black weapon as Snatch", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "gan-ning");
    const blackWeaponID = giveEquippedCard(
      G,
      sourceID,
      "weapon",
      (card) => card.suit === "club" || card.suit === "spade",
    );
    const victimCardID = giveCard(G, targetID, "peach");

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "virtual",
          cardID: blackWeaponID,
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
    expect(G.players[sourceID].equipment.weapon).toBeUndefined();
    expect(G.discard).toContain(blackWeaponID);
  });

  it("lets Guo Se use an equipped diamond armor as Indulgence", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "da-qiao");
    const diamondArmorID = giveEquippedCard(
      G,
      sourceID,
      "armor",
      (card) => card.suit === "diamond",
    );

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "virtual",
          cardID: diamondArmorID,
          as: "indulgence",
          targetIDs: [targetID],
        },
        identityShuffle,
      ),
    ).toBe(true);
    answerNullificationChain(G, {});
    expect(G.players[sourceID].equipment.armor).toBeUndefined();
    expect(G.players[targetID].judgement).toContain(diamondArmorID);
  });

  it("lets Ji Jiu rescue with an equipped red armor outside Hua Tuo's turn", () => {
    const G = createStartedGame();
    resetHands(G);
    const lordID = G.lordID;
    const huaTuoID = G.seatOrder[1];
    const attackerID = G.seatOrder[3];
    assignGeneral(G, attackerID, "zhang-fei");
    assignGeneral(G, huaTuoID, "hua-tuo");
    G.players[lordID].hp = 1;
    const slashID = giveCard(G, attackerID, "slash");
    const redArmorID = giveEquippedCard(
      G,
      huaTuoID,
      "armor",
      (card) => card.suit === "heart" || card.suit === "diamond",
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
      { kind: "card", cardID: redArmorID },
      identityShuffle,
    );
    expect(G.players[lordID].alive).toBe(true);
    expect(G.players[lordID].hp).toBe(1);
    expect(G.players[huaTuoID].equipment.armor).toBeUndefined();
    expect(G.discard).toContain(redArmorID);
  });

  it("lets Liu Li discard an equipped card to redirect a Slash", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const diaoQiaoID = G.seatOrder[1];
    const newTargetID = G.seatOrder[2];
    assignGeneral(G, diaoQiaoID, "da-qiao");
    assignGeneral(G, newTargetID, "guan-yu");
    const slashID = giveCard(G, sourceID, "slash");
    const discardID = giveEquippedCard(
      G,
      diaoQiaoID,
      "armor",
      (card) => CARD_DEFINITIONS[card.definitionID].equipmentSlot === "armor",
    );
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
        choices: [{ zone: "equipment", ownerID: diaoQiaoID, slot: "armor" }],
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
    answerCardPrompt(
      G,
      newTargetID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.players[newTargetID].hp).toBe(hp - 1);
    expect(G.players[diaoQiaoID].equipment.armor).toBeUndefined();
    expect(G.discard).toContain(discardID);
  });

  it("still rejects virtual conversions using cards from neither hand nor equipment", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "guan-yu");
    const redCardID = G.deck.find(
      (cardID) => G.cards[cardID].suit === "heart",
    )!;

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "virtual",
          cardID: redCardID,
          as: "slash",
          targetIDs: [targetID],
        },
        identityShuffle,
      ),
    ).toBe(false);
  });
});
