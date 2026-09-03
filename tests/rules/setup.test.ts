import { describe, expect, it } from "vitest";

import { GENERALS_BY_ID } from "../../src/game/catalog/generals";
import { getRoleDeck } from "../../src/game/catalog/roles";
import { createInitialState, selectGeneral } from "../../src/game/setup";
import { identityShuffle } from "../helpers/game";

describe("match setup", () => {
  it("supports all role distributions from 4 to 10 players", () => {
    for (let numPlayers = 4; numPlayers <= 10; numPlayers += 1) {
      const roles = getRoleDeck(numPlayers);
      expect(roles).toHaveLength(numPlayers);
      expect(roles.filter((role) => role === "lord")).toHaveLength(1);
    }
    expect(
      getRoleDeck(6, "double-renegade").filter((role) => role === "renegade"),
    ).toHaveLength(2);
    expect(
      getRoleDeck(8, "double-renegade").filter((role) => role === "renegade"),
    ).toHaveLength(2);
  });

  it("deals fixed, unique candidate sets before the Lord selects", () => {
    const G = createInitialState({ numPlayers: 9 }, identityShuffle);
    expect(G.players[G.lordID].generalCandidates).toHaveLength(5);
    expect(G.players[G.lordID].generalCandidates.slice(0, 3)).toEqual([
      "cao-cao",
      "liu-bei",
      "sun-quan",
    ]);

    const lordCandidates = [...G.players[G.lordID].generalCandidates];
    const nonLordCandidatesBefore = G.seatOrder
      .slice(1)
      .flatMap((id) => G.players[id].generalCandidates);
    expect(nonLordCandidatesBefore).toHaveLength(16);
    expect(new Set([...lordCandidates, ...nonLordCandidatesBefore]).size).toBe(
      21,
    );
    expect(
      nonLordCandidatesBefore.some((generalID) =>
        lordCandidates.includes(generalID),
      ),
    ).toBe(false);

    expect(selectGeneral(G, G.lordID, "cao-cao", identityShuffle)).toBe(true);
    const nonLordCandidatesAfter = G.seatOrder
      .slice(1)
      .flatMap((id) => G.players[id].generalCandidates);
    expect(nonLordCandidatesAfter).toEqual(nonLordCandidatesBefore);
  });

  it("deals three candidates through eight players and two from nine", () => {
    for (const numPlayers of [4, 5, 6, 7, 8]) {
      const G = createInitialState({ numPlayers }, identityShuffle);
      for (const playerID of G.seatOrder.slice(1)) {
        expect(G.players[playerID].generalCandidates).toHaveLength(3);
      }
    }
    for (const numPlayers of [9, 10]) {
      const G = createInitialState({ numPlayers }, identityShuffle);
      for (const playerID of G.seatOrder.slice(1)) {
        expect(G.players[playerID].generalCandidates).toHaveLength(2);
      }
    }
  });

  it("keeps non-Lord candidates locked until the Lord selects", () => {
    const G = createInitialState({ numPlayers: 4 }, identityShuffle);
    const playerID = G.seatOrder[1];
    const generalID = G.players[playerID].generalCandidates[0];

    expect(selectGeneral(G, playerID, generalID, identityShuffle)).toBe(false);
    expect(G.players[playerID].generalID).toBeNull();
    expect(G.players[playerID].generalCandidates).toContain(generalID);
  });

  it("starts with four cards and applies the lord HP bonus only from five players", () => {
    for (const numPlayers of [4, 5]) {
      const G = createInitialState({ numPlayers }, identityShuffle);
      selectGeneral(G, G.lordID, "cao-cao", identityShuffle);
      for (const playerID of G.seatOrder.slice(1)) {
        selectGeneral(
          G,
          playerID,
          G.players[playerID].generalCandidates[0],
          identityShuffle,
        );
      }

      expect(G.status).toBe("playing");
      expect(G.turn.activePlayerID).toBe(G.lordID);
      expect(G.players[G.lordID].maxHP).toBe(
        GENERALS_BY_ID["cao-cao"].maxHP + (numPlayers >= 5 ? 1 : 0),
      );
      expect(G.turn.step).toBe("play");
      expect(G.players[G.lordID].hand).toHaveLength(6);
      for (const playerID of G.seatOrder.slice(1))
        expect(G.players[playerID].hand).toHaveLength(4);
    }
  });
});
