/** THROWAWAY M0: real drawing kernel, fixture deck, no full turn loop. */
import type { Game } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";
import { createDrawCardsOperation } from "../../../src/game/hegemony/draw-cards";
import {
  createDrawCardOperation,
  createGetNCardsOperation,
  createSwapPileOperation,
  type DrawPileGame,
} from "../../../src/game/hegemony/draw-pile";
import { createCardMovementOperation } from "../../../src/game/hegemony/movement";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  type TriggerScheduler,
  type TriggerRegistry,
} from "../../../src/game/hegemony/scheduler";
import type { Observation } from "./bot";

export const identity = "PROTOTYPE-ce4e62b-draw-v1";
export type Engine = DrawPileGame & { scheduler: TriggerScheduler };
export type ProofGame = { engine: Engine };
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const pileRules = {
  drawZone: "draw",
  reservedZone: "reserved",
  discardZone: "discard",
  notify: () => null,
};
const registry: TriggerRegistry<Engine> = {
  version: identity,
  skills: [],
  operations: [
    createDrawCardsOperation(),
    createGetNCardsOperation(pileRules),
    createDrawCardOperation(pileRules),
    createSwapPileOperation(pileRules),
    createCardMovementOperation(),
  ],
};
export function initialEngine(): Engine {
  return {
    seatOrder: ["0", "1"],
    alive: { "0": true, "1": true },
    cardZones: {
      draw: { owner: null, place: "draw", cards: [0, 1, 2, 3, 4, 5, 6, 7] },
      reserved: { owner: null, place: "draw", cards: [] },
      discard: { owner: null, place: "discard", cards: [] },
      "0": { owner: "0", place: "hand", cards: [] },
      "1": { owner: "1", place: "hand", cards: [] },
    },
    cardResources: {
      cards: {},
      playerTags: { "0": {}, "1": {} },
      roomTags: {},
    },
    pileRandom: { algorithm: "mulberry32-v1", state: 1 },
    scheduler: createTriggerScheduler(["0", "1"], identity),
  };
}
export function actorObservation(engine: Engine, actor: string) {
  if (!engine.seatOrder.includes(actor)) throw new Error("Invalid actor");
  const decision: Observation = {
    actor,
    kind: "draw",
    offers: [
      ...(engine.cardZones.draw.cards.length
        ? [{ id: "draw", kind: "draw" as const }]
        : []),
      { id: "decline", kind: "decline" },
    ],
  };
  return {
    hand: [...engine.cardZones[actor].cards],
    handCounts: Object.fromEntries(
      engine.seatOrder.map((p) => [p, engine.cardZones[p].cards.length]),
    ),
    decision,
  };
}
export const proofGame: Game<ProofGame> = {
  name: "PROTOTYPE-hegemony-m0",
  disableUndo: true,
  setup: () => ({ engine: initialEngine() }),
  turn: { activePlayers: ["0", "1"] },
  moves: {
    draw: {
      client: false,
      redact: true,
      move: ({ G, playerID }) => {
        // Existing operations use structuredClone. Never pass an Immer proxy.
        const engine = copy(G.engine);
        if (!engine.cardZones.draw.cards.length) return INVALID_MOVE;
        if (
          !dispatchTriggerOperation(
            engine.scheduler,
            engine,
            registry,
            { name: "draw-cards", data: { players: [playerID], counts: [1] } },
            playerID,
          )
        )
          return INVALID_MOVE;
        G.engine = engine;
      },
    },
  },
  playerView: ({ G, playerID }) => ({
    hand: playerID ? [...G.engine.cardZones[playerID].cards] : [],
    handCounts: Object.fromEntries(
      G.engine.seatOrder.map((p) => [p, G.engine.cardZones[p].cards.length]),
    ),
  }),
};
