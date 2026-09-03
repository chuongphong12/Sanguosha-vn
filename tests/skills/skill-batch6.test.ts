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

describe("final batch skills", () => {
  it("Jiu Yuan makes Peaches from others heal the Lord twice", () => {
    const G = createStartedGame();
    resetHands(G);
    const lordID = G.lordID;
    const rescuerID = G.seatOrder[3];
    const attackerID = G.seatOrder[1];
    G.players[lordID].generalID = "sun-quan";
    G.players[lordID].activeSkillIDs = ["zhi-heng", "jiu-yuan"];
    G.players[lordID].hp = 1;
    const slashID = giveCard(G, attackerID, "slash");
    const peachID = giveCard(G, rescuerID, "peach");

    startCardTurn(G, attackerID, identityShuffle);
    for (
      let guard = 0;
      guard < 8 &&
      G.prompt &&
      !(G.prompt.kind === "card-response" && G.prompt.response === "dodge");
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
      G.prompt.responderID !== rescuerID
    ) {
      answerCardPrompt(
        G,
        G.prompt.responderID,
        G.prompt.id,
        { kind: "pass" },
        identityShuffle,
      );
    }
    expect(G.prompt!.responderID).toBe(rescuerID);
    answerCardPrompt(
      G,
      rescuerID,
      G.prompt!.id,
      { kind: "card", cardID: peachID },
      identityShuffle,
    );
    expect(G.players[lordID].alive).toBe(true);
    expect(G.players[lordID].hp).toBe(2);
  });

  it("Jie Yin discards two hand cards and heals both sides", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, playerID, "sun-shangxiang");
    assignGeneral(G, targetID, "guan-yu");
    G.players[targetID].hp -= 1;
    G.players[playerID].hp -= 1;
    const first = giveCard(G, playerID, "dodge");
    const second = giveCard(G, playerID, "dodge");
    const targetHP = G.players[targetID].hp;
    const ownerHP = G.players[playerID].hp;

    expect(
      useSkill(
        G,
        playerID,
        "jie-yin",
        { cardIDs: [first, second], targetID },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.players[targetID].hp).toBe(targetHP + 1);
    expect(G.players[playerID].hp).toBe(ownerHP + 1);
  });

  it("Li Jian forces a Duel between two male generals", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    const first = G.seatOrder[1];
    const second = G.seatOrder[2];
    assignGeneral(G, playerID, "diao-chan");
    assignGeneral(G, first, "guan-yu");
    assignGeneral(G, second, "zhang-fei");
    const cardID = giveCard(G, playerID, "dodge");

    expect(
      useSkill(
        G,
        playerID,
        "li-jian",
        { cardID, firstID: first, secondID: second },
        identityShuffle,
      ),
    ).toBe(true);
    expect(G.prompt).toMatchObject({
      reason: "duel",
      responderID: first,
    });
  });

  it("Yi Ji draws after damage and can pass cards to one player", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    assignGeneral(G, targetID, "guo-jia");
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
    expect(G.prompt).toMatchObject({ reason: "yi-ji", kind: "option" });
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.players[targetID].hand).toHaveLength(2);
    expect(G.prompt).toMatchObject({ reason: "yi-ji" });
    const pool = [...G.players[targetID].hand];
    answerCardPrompt(
      G,
      targetID,
      G.prompt!.id,
      { kind: "zone-cards", choices: [] },
      identityShuffle,
    );
    expect(G.players[targetID].hand).toEqual(pool);
    expect(G.prompt).toBeNull();
  });

  it("Fan Jian resolves damage based on the declared suit", () => {
    for (const [suit, expectedDamage] of [
      ["heart", 0],
      ["club", 1],
    ] as const) {
      const G = createStartedGame();
      resetHands(G);
      const playerID = G.turn.activePlayerID;
      const targetID = G.seatOrder[1];
      assignGeneral(G, playerID, "zhou-yu");
      givePhysicalCard(
        G,
        playerID,
        (card) => card.suit === (suit === "heart" ? "heart" : "spade"),
      );
      giveCard(G, playerID, "dodge");
      const targetHP = G.players[targetID].hp;

      expect(
        useSkill(G, playerID, "fan-jian", { targetID }, identityShuffle),
      ).toBe(true);
      expect(G.prompt).toMatchObject({
        reason: "fan-jian-suit",
        responderID: targetID,
      });
      answerCardPrompt(
        G,
        targetID,
        G.prompt!.id,
        { kind: "option", choice: suit },
        identityShuffle,
      );
      expect(G.players[targetID].hp).toBe(targetHP - expectedDamage);
    }
  });
});
