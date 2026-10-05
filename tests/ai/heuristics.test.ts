import { describe, expect, it } from "vitest";

import {
  answerCardPrompt,
  declareCardUse,
  discardCardHand,
  endCardPlayPhase,
} from "../../src/game/cardEngine";
import type { PlayerID, TqsGameState } from "../../src/game/model";
import { getHeuristicMoves } from "../../src/game/ai/ai-heuristics";
import { createInitialState, selectGeneral } from "../../src/game/setup";
import { createStartedGame, identityShuffle } from "../helpers/game";

interface AiMove {
  move: string;
  args: unknown[];
}

const ctxFor = (G: TqsGameState) =>
  ({
    numPlayers: G.seatOrder.length,
    playOrder: G.seatOrder,
    // The real game keeps every player in Stage.NULL, so no stage names appear.
    activePlayers: Object.fromEntries(G.seatOrder.map((id) => [id, null])),
  }) as never;

/** Apply an enumerated move through the same engine functions the game uses. */
function apply(G: TqsGameState, playerID: PlayerID, move: AiMove): boolean {
  switch (move.move) {
    case "playCard":
      return declareCardUse(G, playerID, move.args[0], identityShuffle);
    case "endPlayPhase":
      return endCardPlayPhase(G, playerID, identityShuffle);
    case "discardCards":
      return discardCardHand(G, playerID, move.args[0], identityShuffle);
    case "answerPrompt":
      return answerCardPrompt(
        G,
        playerID,
        move.args[0] as number,
        move.args[1],
        identityShuffle,
      );
    case "selectGeneral":
      return selectGeneral(
        G,
        playerID,
        move.args[0] as string,
        identityShuffle,
      );
    default:
      throw new Error(
        `AI proposed a move the game does not have: ${move.move}`,
      );
  }
}

/** Everyone who could legally act right now, as the real bot driver would ask. */
function actorsWithMoves(G: TqsGameState): Array<[PlayerID, AiMove[]]> {
  const ctx = ctxFor(G);
  return G.seatOrder
    .map((id): [PlayerID, AiMove[]] => [
      id,
      getHeuristicMoves(G, ctx, id) as AiMove[],
    ])
    .filter(([, moves]) => moves.length > 0);
}

describe("heuristic AI", () => {
  it("has a move when it is the acting player's play phase (no stage names needed)", () => {
    const G = createStartedGame(4);
    const active = G.turn.activePlayerID;
    const moves = getHeuristicMoves(G, ctxFor(G), active) as AiMove[];
    expect(G.turn.step).toBe("play");
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.map((m) => m.move)).toSatisfy((names: string[]) =>
      names.every((name) => ["playCard", "endPlayPhase"].includes(name)),
    );
  });

  it("does not move for players who are not acting", () => {
    const G = createStartedGame(4);
    for (const id of G.seatOrder.filter((p) => p !== G.turn.activePlayerID)) {
      expect(getHeuristicMoves(G, ctxFor(G), id)).toEqual([]);
    }
  });

  it("picks generals for every player who still has to choose", () => {
    const G: TqsGameState = createInitialState(
      { numPlayers: 4, autoSkipWuxie: true },
      identityShuffle,
    );
    const lordMoves = getHeuristicMoves(G, ctxFor(G), G.lordID) as AiMove[];
    expect(lordMoves[0]?.move).toBe("selectGeneral");
    expect(apply(G, G.lordID, lordMoves[0])).toBe(true);
    for (const id of G.seatOrder.filter((p) => p !== G.lordID)) {
      const moves = getHeuristicMoves(G, ctxFor(G), id) as AiMove[];
      expect(moves[0]?.move).toBe("selectGeneral");
      expect(apply(G, id, moves[0])).toBe(true);
    }
    expect(G.status).toBe("playing");
  });

  it.each([4, 5, 6, 8, 10])(
    "plays a whole %i-player game on its own: every move is legal and the match never stalls",
    (numPlayers) => {
      const G = createStartedGame(numPlayers);
      let turnsSeen = 0;
      let lastKey = "";
      for (let step = 0; step < 6000 && G.status === "playing"; step += 1) {
        const candidates = actorsWithMoves(G);
        expect(
          candidates.length,
          `stalled at turn ${G.turn.number}, step ${G.turn.step}, prompt ${JSON.stringify(G.prompt)}`,
        ).toBeGreaterThan(0);
        // Any eligible bot may be asked next, as with simultaneous windows.
        const [actor, moves] =
          candidates[Math.floor(Math.random() * candidates.length)];
        const move = moves[Math.floor(Math.random() * moves.length)];
        expect(
          apply(G, actor, move),
          `${actor} proposed an illegal move ${JSON.stringify(move)} at step ${G.turn.step}`,
        ).toBe(true);
        const key = `${G.turn.number}:${G.turn.activePlayerID}`;
        if (key !== lastKey) {
          turnsSeen += 1;
          lastKey = key;
        }
      }
      expect(G.status === "ended" || turnsSeen > numPlayers * 2).toBe(true);
    },
  );
});
