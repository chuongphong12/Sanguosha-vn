import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  startCardTurn,
} from "../../src/game/cardEngine";
import type { PlayerID, TqsGameState } from "../../src/game/model";
import {
  answerNullificationChain,
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

function assignSkills(
  G: TqsGameState,
  playerID: PlayerID,
  faction: "wei" | "shu" | "qun" | "wu",
  skillIDs: string[],
): void {
  const factionGeneral: Record<string, string> = {
    wei: "sima-yi",
    shu: "guan-yu",
    wu: "zhou-yu",
    qun: "lv-bu",
  };
  G.players[playerID].generalID = factionGeneral[faction];
  G.players[playerID].activeSkillIDs = skillIDs;
}

describe("ally summons and Guan Xing", () => {
  it("Hu Jia lets a Wei ally supply the Dodge", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const lordID = G.seatOrder[1];
    const allyID = G.seatOrder[2];
    assignSkills(G, sourceID, "wu", []);
    assignSkills(G, lordID, "wei", ["hu-jia"]);
    assignSkills(G, allyID, "wei", []);
    assignSkills(G, G.seatOrder[3], "wu", []);
    const slashID = giveCard(G, sourceID, "slash");
    const allyDodge = giveCard(G, allyID, "dodge");
    const hp = G.players[lordID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [lordID] },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      response: "dodge",
      responderID: lordID,
      summonFaction: "wei",
    });
    answerCardPrompt(
      G,
      lordID,
      G.prompt!.id,
      { kind: "summon" },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      reason: "ally-summon",
      responderID: allyID,
    });
    answerCardPrompt(
      G,
      allyID,
      G.prompt!.id,
      { kind: "card", cardID: allyDodge },
      identityShuffle,
    );
    expect(G.players[lordID].hp).toBe(hp);
    expect(G.discard).toContain(allyDodge);
  });

  it("Hu Jia falls back to the lord when every ally passes", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const lordID = G.seatOrder[1];
    const allyID = G.seatOrder[2];
    assignSkills(G, sourceID, "wu", []);
    assignSkills(G, lordID, "wei", ["hu-jia"]);
    assignSkills(G, allyID, "wei", []);
    const slashID = giveCard(G, sourceID, "slash");
    const lordDodge = giveCard(G, lordID, "dodge");
    const hp = G.players[lordID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: slashID, targetIDs: [lordID] },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      lordID,
      G.prompt!.id,
      { kind: "summon" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      allyID,
      G.prompt!.id,
      { kind: "pass" },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      response: "dodge",
      responderID: lordID,
    });
    answerCardPrompt(
      G,
      lordID,
      G.prompt!.id,
      { kind: "card", cardID: lordDodge },
      identityShuffle,
    );
    expect(G.players[lordID].hp).toBe(hp);
  });

  it("Ji Jiang lets a Shu ally answer Barbarian Invasion", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const lordID = G.seatOrder[1];
    const allyID = G.seatOrder[2];
    assignSkills(G, lordID, "shu", ["ji-jiang"]);
    assignSkills(G, allyID, "shu", []);
    assignSkills(G, G.seatOrder[3], "wu", []);
    const trickID = giveCard(G, sourceID, "barbarian-invasion");
    const allySlash = giveCard(G, allyID, "slash");
    const hp = G.players[lordID].hp;

    declareCardUse(
      G,
      sourceID,
      { cardID: trickID, targetIDs: [] },
      identityShuffle,
    );
    answerNullificationChain(G, {});
    expect(G.prompt).toMatchObject({
      response: "slash",
      responderID: lordID,
      summonFaction: "shu",
    });
    answerCardPrompt(
      G,
      lordID,
      G.prompt!.id,
      { kind: "summon" },
      identityShuffle,
    );
    answerCardPrompt(
      G,
      allyID,
      G.prompt!.id,
      { kind: "card", cardID: allySlash },
      identityShuffle,
    );
    expect(G.players[lordID].hp).toBe(hp);
    expect(G.discard).toContain(allySlash);
  });

  it("Guan Xing arranges revealed cards between top and bottom", () => {
    const G = createStartedGame();
    resetHands(G);
    const playerID = G.turn.activePlayerID;
    G.players[playerID].generalID = "zhuge-liang";
    G.players[playerID].activeSkillIDs = ["guan-xing", "kong-cheng"];
    const deckBefore = [...G.deck];
    const first = deckBefore[0];
    const second = deckBefore[1];
    const third = deckBefore[2];
    const fourth = deckBefore[3];

    startCardTurn(G, playerID, identityShuffle);
    expect(G.prompt).toMatchObject({ reason: "guan-xing" });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      { kind: "option", choice: "activate" },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      reason: "guan-xing",
      kind: "select-cards",
    });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [
          { zone: "processing", cardID: third },
          { zone: "processing", cardID: first },
        ],
      },
      identityShuffle,
    );
    expect(G.prompt).toMatchObject({
      reason: "guan-xing",
      kind: "select-cards",
    });
    answerCardPrompt(
      G,
      playerID,
      G.prompt!.id,
      {
        kind: "zone-cards",
        choices: [
          { zone: "processing", cardID: second },
          { zone: "processing", cardID: fourth },
        ],
      },
      identityShuffle,
    );

    expect(G.players[playerID].hand).toEqual(
      expect.arrayContaining([third, first]),
    );
    expect(G.deck[0]).toBe("card-005");
    expect(G.deck.slice(-2)).toEqual([second, fourth]);
    expect(G.processing).not.toContain(first);
    expect(G.turn.step).toBe("play");
  });
});
