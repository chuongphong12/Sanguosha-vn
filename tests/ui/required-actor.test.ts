import { describe, expect, it } from "vitest";

import { requiredActorID } from "../../src/app/screens/main/requiredActor";
import type { TqsGameState } from "../../src/game/model";
import { createInitialState } from "../../src/game/setup";
import { createStartedGame, identityShuffle } from "../helpers/game";

const setPrompt = (G: TqsGameState, prompt: Record<string, unknown>) => {
  G.prompt = { id: 1, effectID: 1, ...prompt } as never;
};

describe("requiredActorID", () => {
  it("is the active player when nothing is pending", () => {
    const G = createStartedGame(4);
    expect(requiredActorID(G)).toBe(G.turn.activePlayerID);
  });

  it("follows the selection phases", () => {
    const G = createInitialState(
      { numPlayers: 4, autoSkipWuxie: true },
      identityShuffle,
    );
    expect(requiredActorID(G)).toBe(G.lordID);
  });

  it("is nobody once the match ended", () => {
    const G = createStartedGame(4);
    G.status = "ended";
    expect(requiredActorID(G)).toBeNull();
  });

  it("uses the responder of an ordinary prompt", () => {
    const G = createStartedGame(4);
    const [, target] = G.seatOrder;
    setPrompt(G, {
      kind: "card-response",
      reason: "slash",
      response: "dodge",
      responderID: target,
    });
    expect(requiredActorID(G)).toBe(target);
  });

  describe("simultaneous windows", () => {
    // The engine fills responderID with the active player "for compatibility",
    // so the device must go to whoever still has to answer instead.
    it("asks each Nam Man target in turn order, skipping the caster and those who passed", () => {
      const G = createStartedGame(4);
      const source = G.turn.activePlayerID;
      const order = G.seatOrder;
      const others = order.filter((id) => id !== source);
      setPrompt(G, {
        kind: "card-response",
        reason: "barbarian-invasion",
        response: "aoe-response",
        responderID: source,
        sourceID: source,
        passedPlayerIDs: [],
      });
      expect(requiredActorID(G)).toBe(others[0]);

      (G.prompt as { passedPlayerIDs: string[] }).passedPlayerIDs = [others[0]];
      expect(requiredActorID(G)).toBe(others[1]);
    });

    it("skips dead players", () => {
      const G = createStartedGame(4);
      const source = G.turn.activePlayerID;
      const others = G.seatOrder.filter((id) => id !== source);
      G.players[others[0]].alive = false;
      setPrompt(G, {
        kind: "card-response",
        reason: "arrow-barrage",
        response: "aoe-response",
        responderID: source,
        sourceID: source,
        passedPlayerIDs: [],
      });
      expect(requiredActorID(G)).toBe(others[1]);
    });

    it("starts a rescue window with the active player, then moves on as players pass", () => {
      const G = createStartedGame(4);
      const active = G.turn.activePlayerID;
      setPrompt(G, {
        kind: "card-response",
        reason: "rescue",
        response: "peach",
        responderID: active,
        passedPlayerIDs: [],
      });
      expect(requiredActorID(G)).toBe(active);
      (G.prompt as { passedPlayerIDs: string[] }).passedPlayerIDs = [active];
      const next = requiredActorID(G);
      expect(next).not.toBe(active);
      expect(G.seatOrder).toContain(next);
    });

    it("falls back to the responder when everyone has already passed", () => {
      const G = createStartedGame(4);
      setPrompt(G, {
        kind: "card-response",
        reason: "nullification",
        response: "nullification",
        responderID: G.turn.activePlayerID,
        passedPlayerIDs: [...G.seatOrder],
      });
      expect(requiredActorID(G)).toBe(G.turn.activePlayerID);
    });
  });
});
