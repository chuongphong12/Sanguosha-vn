import { describe, expect, it } from "vitest";

import { createPlayerView } from "../../src/game/player-view";
import { declareCardUse } from "../../src/game/cardEngine";
import { createInitialState } from "../../src/game/setup";
import {
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

describe("player view", () => {
  it("shows only the viewer's role, hand and candidates", () => {
    const G = createInitialState({ numPlayers: 4 }, identityShuffle);
    const viewerID = G.seatOrder[1];
    G.players[viewerID].hand = ["card-001", "card-002"];
    G.players[G.lordID].hand = ["card-003"];
    G.players[viewerID].generalCandidates = ["sima-yi"];

    const view = createPlayerView(G, viewerID);
    expect(view.players[viewerID].role).toBe(G.players[viewerID].role);
    expect(view.players[viewerID].hand).toEqual(["card-001", "card-002"]);
    expect(view.players[viewerID].generalCandidates).toEqual([]);
    expect(view.players[G.lordID].role).toBe("lord");
    expect(view.players[G.lordID].hand).toEqual(["hidden"]);
    expect(view.players[G.lordID].generalCandidates).toEqual([]);
  });

  it("reveals a player's fixed candidates after the Lord selects", () => {
    const G = createInitialState({ numPlayers: 4 }, identityShuffle);
    const viewerID = G.seatOrder[1];
    const candidates = [...G.players[viewerID].generalCandidates];
    G.status = "general-selection";

    const view = createPlayerView(G, viewerID);
    expect(view.players[viewerID].generalCandidates).toEqual(candidates);
  });

  it("hides another player's selected general until the match starts", () => {
    const G = createInitialState({ numPlayers: 4 }, identityShuffle);
    const viewerID = G.seatOrder[1];
    const hiddenID = G.seatOrder[2];
    G.status = "general-selection";
    G.players[hiddenID].generalID = "zhen-ji";
    G.players[hiddenID].activeSkillIDs = ["luo-shen", "qing-guo"];
    G.players[hiddenID].hp = 3;
    G.players[hiddenID].maxHP = 3;

    const view = createPlayerView(G, viewerID);
    expect(view.players[hiddenID]).toMatchObject({
      generalID: null,
      generalSelected: true,
      activeSkillIDs: [],
      hp: 0,
      maxHP: 0,
    });
  });

  it("does not mutate authoritative state", () => {
    const G = createInitialState({ numPlayers: 4 }, identityShuffle);
    const before = structuredClone(G);
    createPlayerView(G, G.seatOrder[1]);
    expect(G).toEqual(before);
  });

  it("never exposes the authoritative effect stack", () => {
    const G = createInitialState({ numPlayers: 4 }, identityShuffle);
    G.effectStack.push({
      id: 1,
      kind: "draw",
      targetID: G.seatOrder[0],
      amount: 2,
    });

    const view = createPlayerView(G, G.seatOrder[0]);
    expect(view.effectStack).toEqual([]);
    expect(G.effectStack).toHaveLength(1);
  });

  it("does not expose target hand IDs in card-selection prompts", () => {
    const G = createStartedGame();
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const targetID = G.seatOrder[1];
    const dismantleID = giveCard(G, sourceID, "dismantle");
    const hiddenCardID = giveCard(G, targetID, "peach");
    declareCardUse(
      G,
      sourceID,
      { cardID: dismantleID, targetIDs: [targetID] },
      identityShuffle,
    );

    const view = createPlayerView(G, sourceID);
    expect(view.players[targetID].hand).toEqual(["hidden"]);
    expect(JSON.stringify(view.prompt)).not.toContain(hiddenCardID);
  });
});
