import { describe, expect, it } from "vitest";

import { answerCardPrompt, declareCardUse } from "../../src/game/cardEngine";
import type { CardName, PlayerID, TqsGameState } from "../../src/game/model";
import {
  answerNullificationChain,
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

const REASON: Record<string, string> = {
  "barbarian-invasion": "slash",
  "arrow-barrage": "dodge",
};

function startAoe(cardName: "barbarian-invasion" | "arrow-barrage") {
  const G = createStartedGame(4);
  resetHands(G);
  const sourceID = G.turn.activePlayerID;
  const trickID = giveCard(G, sourceID, cardName);
  declareCardUse(
    G,
    sourceID,
    { cardID: trickID, targetIDs: [] },
    identityShuffle,
  );
  answerNullificationChain(G, {});
  const targetIDs = G.seatOrder.filter((id) => id !== sourceID);
  return { G, sourceID, targetIDs };
}

const pass = (G: TqsGameState, playerID: PlayerID) => {
  answerNullificationChain(G, {});
  return answerCardPrompt(
    G,
    playerID,
    G.prompt!.id,
    { kind: "pass" },
    identityShuffle,
  );
};

describe.each(["barbarian-invasion", "arrow-barrage"] as const)(
  "%s answered one player at a time",
  (cardName) => {
    it("opens the required response for the next target", () => {
      const { G } = startAoe(cardName);
      expect(G.prompt).toMatchObject({
        kind: "card-response",
        reason: cardName,
        response: REASON[cardName],
      });
    });

    it("lets every target pass in turn; each takes 1 damage and the window then closes", () => {
      const { G, targetIDs } = startAoe(cardName);
      const hpBefore = targetIDs.map((id) => G.players[id].hp);

      for (const targetID of targetIDs) {
        expect(G.prompt, "window is still open for the next target").not.toBe(
          null,
        );
        expect(pass(G, targetID), `${targetID} can pass`).toBe(true);
      }

      expect(targetIDs.map((id) => G.players[id].hp)).toEqual(
        hpBefore.map((hp) => hp - 1),
      );
      expect(G.prompt).toBeNull();
      expect(G.effectStack).toHaveLength(0);
      expect(G.turn.step).toBe("play");
    });

    it("spares a target that answers with the required card while the others pass", () => {
      const { G, targetIDs } = startAoe(cardName);
      const required = REASON[cardName] as CardName;
      const answerCardID = giveCard(G, targetIDs[0], required);
      const hpBefore = targetIDs.map((id) => G.players[id].hp);

      expect(
        answerCardPrompt(
          G,
          targetIDs[0],
          G.prompt!.id,
          { kind: "card", cardID: answerCardID },
          identityShuffle,
        ),
      ).toBe(true);
      for (const targetID of targetIDs.slice(1)) {
        expect(pass(G, targetID)).toBe(true);
      }

      expect(targetIDs.map((id) => G.players[id].hp)).toEqual([
        hpBefore[0],
        ...hpBefore.slice(1).map((hp) => hp - 1),
      ]);
      expect(G.prompt).toBeNull();
      expect(G.effectStack).toHaveLength(0);
    });

    it("does not let a target answer twice", () => {
      const { G, targetIDs } = startAoe(cardName);
      expect(pass(G, targetIDs[0])).toBe(true);
      answerNullificationChain(G, {});
      expect(pass(G, targetIDs[0])).toBe(false);
    });
  },
);
