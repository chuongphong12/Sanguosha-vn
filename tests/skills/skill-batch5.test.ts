import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  startCardTurn,
  useSkill,
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

describe("active and conversion skills (batch 5)", () => {
  it("Zhi Heng discards selected cards and redraws the same count once per turn", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "sun-quan");
    const first = giveCard(G, playerID, "dodge");
    const second = giveCard(G, playerID, "dodge");

    expect(
      useSkill(G, playerID, "zhi-heng", [first, second], identityShuffle),
    ).toBe(true);
    expect(G.discard).toContain(first);
    expect(G.discard).toContain(second);
    expect(G.players[playerID].hand).toHaveLength(2);
    expect(useSkill(G, playerID, "zhi-heng", [], identityShuffle)).toBe(false);
  });

  it("Ku Rou loses one HP and draws two cards", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "huang-gai");
    const hp = G.players[playerID].hp;

    expect(useSkill(G, playerID, "ku-rou", null, identityShuffle)).toBe(true);
    expect(G.players[playerID].hp).toBe(hp - 1);
    expect(G.players[playerID].hand).toHaveLength(2);
  });

  it("Qing Nang heals a wounded character by discarding a hand card", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, playerID, "hua-tuo");
    givePhysicalPeachlessSetup(G, targetID);
    const cardID = giveCard(G, playerID, "dodge");
    const woundedHP = G.players[targetID].hp;

    expect(
      useSkill(G, playerID, "qing-nang", { cardID, targetID }, identityShuffle),
    ).toBe(true);
    expect(G.players[targetID].hp).toBe(woundedHP + 1);
    expect(G.discard).toContain(cardID);
    expect(
      useSkill(
        G,
        playerID,
        "qing-nang",
        { cardID: G.players[playerID].hand[0], targetID },
        identityShuffle,
      ),
    ).toBe(false);
  });

  it("Ren De transfers cards and heals once reaching two given", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, playerID, "liu-bei");
    G.players[playerID].hp -= 1;
    const first = giveCard(G, playerID, "dodge");
    const second = giveCard(G, playerID, "dodge");
    const ownerHP = G.players[playerID].hp;

    expect(
      useSkill(
        G,
        playerID,
        "ren-de",
        { cardIDs: [first, second], targetID },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.turn.rendeGiven).toBe(2);
    expect(G.players[targetID].hand).toEqual(
      expect.arrayContaining([first, second]),
    );
    expect(G.players[playerID].hp).toBe(ownerHP + 1);
    expect(
      useSkill(
        G,
        playerID,
        "ren-de",
        { cardIDs: [], targetID },
        identityShuffle,
      ),
    ).toBe(false);
  });

  it("lets Guo Se use a diamond card as Indulgence on another player", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "da-qiao");
    const diamondID = Object.keys(G.cards).find((candidateID) => {
      const card = G.cards[candidateID];
      return (
        card.suit === "diamond" &&
        card.definitionID !== "indulgence" &&
        G.deck.includes(candidateID)
      );
    })!;
    G.deck.splice(G.deck.indexOf(diamondID), 1);
    G.players[sourceID].hand.push(diamondID);

    expect(
      declareCardUse(
        G,
        sourceID,
        {
          kind: "virtual",
          cardID: diamondID,
          as: "indulgence",
          targetIDs: [targetID],
        },
        identityShuffle,
      ),
    ).toBe(true);
    answerNullificationChain(G, {});
    expect(G.players[targetID].judgement).toContain(diamondID);
  });

  it("Luo Shen keeps black cards during the Prepare step", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    assignGeneral(G, playerID, "zhen-ji");
    const blackCards = Object.keys(G.cards)
      .filter((candidateID) => {
        const suit = G.cards[candidateID].suit;
        return (
          (suit === "spade" || suit === "club") && G.deck.includes(candidateID)
        );
      })
      .slice(0, 2);
    stackDeck(G, blackCards);

    startCardTurn(G, playerID, identityShuffle);
    for (let index = 0; index < blackCards.length; index += 1) {
      expect(G.prompt).toMatchObject({ reason: "luo-shen" });
      answerCardPrompt(
        G,
        playerID,
        G.prompt!.id,
        { kind: "option", choice: "activate" },
        identityShuffle,
      );
    }
    expect(G.prompt).toMatchObject({ reason: "luo-shen" });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "decline" },
      identityShuffle,
    );
    expect(G.players[playerID].hand).toEqual(
      expect.arrayContaining(blackCards),
    );
  });

  it("Luo Yi reduces the draw by one and buffs Slash damage", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, sourceID, "xu-chu");
    assignGeneral(G, targetID, "guan-yu");
    const slashID = giveCard(G, sourceID, "slash");
    const targetHP = G.players[targetID].hp;

    startCardTurn(G, sourceID, identityShuffle);
    expect(G.prompt).toMatchObject({ reason: "luo-yi" });
    answerCardPrompt(
      G,
      sourceID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[sourceID].hand).toHaveLength(2);
    expect(G.turn.luoYiBuff).toBe(true);

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
    expect(G.players[targetID].hp).toBe(targetHP - 2);
  });
});

function givePhysicalPeachlessSetup(G: TqsGameState, targetID: PlayerID): void {
  G.players[targetID].hp = Math.max(1, G.players[targetID].maxHP - 1);
}
