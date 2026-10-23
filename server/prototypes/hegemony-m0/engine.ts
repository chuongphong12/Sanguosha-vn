/** THROWAWAY M0: real draw and Slash/Jink operations, fixture deck, no full turn. */
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
import {
  battleRules,
  battlePrompt,
  answerBattle,
  playRequest,
  fixtureCard,
  reference,
  type BattleState,
} from "./battle";

export const identity = "PROTOTYPE-ce4e62b-prompt-v2";
export type Engine = DrawPileGame &
  BattleState & { scheduler: TriggerScheduler };
export type EngineCommand =
  | { action: "draw" | "play" }
  | { action: "answer"; answer: { id: string; choice: string | null } };
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
  skills: battleRules.skills,
  operations: [
    ...battleRules.operations,
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
    currentPlayer: "0",
    playerFlags: { "0": [], "1": [] },
    playerMarks: { "0": {}, "1": {} },
    playerHistory: { "0": {}, "1": {} },
    hp: { "0": 4, "1": 4 },
    chained: { "0": false, "1": false },
    removed: { "0": false, "1": false },
    damageStack: [],
    outcomes: [],
    cardZones: {
      draw: { owner: null, place: "draw", cards: [0, 1, 2, 3, 4, 5, 6, 7] },
      reserved: { owner: null, place: "draw", cards: [] },
      discard: { owner: null, place: "discard", cards: [] },
      table: { owner: null, place: "table", cards: [] },
      "0": { owner: "0", place: "hand", cards: [] },
      "1": { owner: "1", place: "hand", cards: [] },
    },
    cardResources: {
      cards: Object.fromEntries(
        Array.from({ length: 8 }, (_, id) => [
          reference(id),
          {
            kind: "wrapped" as const,
            id,
            key: String(id),
            isSlash: id % 2 === 0,
            isNDTrick: false,
          },
        ]),
      ),
      playerTags: { "0": {}, "1": {} },
      roomTags: {},
    },
    wrappedCards: Object.fromEntries(
      Array.from({ length: 8 }, (_, id) => [
        id,
        {
          ...fixtureCard(id).card,
          suit: "spade",
          number: 1,
          modified: false,
          tags: {},
        },
      ]),
    ),
    pileRandom: { algorithm: "mulberry32-v1", state: 1 },
    scheduler: createTriggerScheduler(["0", "1"], identity),
  };
}
export function actorObservation(engine: Engine, actor: string) {
  if (!engine.seatOrder.includes(actor)) throw new Error("Invalid actor");
  const prompt = battlePrompt(engine, actor);
  const decision: Observation = {
    actor,
    kind: prompt?.kind === "response" ? "response" : "draw",
    offers:
      prompt?.kind === "response"
        ? prompt.choices.map(({ id }) => ({
            id,
            kind: id === "decline" ? "decline" : "jink",
          }))
        : engine.scheduler.frames.length
          ? []
          : [
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
    prompt,
    battle: {
      hp: { ...engine.hp },
      discard: [...engine.cardZones.discard.cards],
      outcomes: [...engine.outcomes],
    },
  };
}
export const proofGame: Game<ProofGame> = {
  name: "PROTOTYPE-hegemony-m0",
  disableUndo: true,
  setup: () => ({ engine: initialEngine() }),
  turn: { activePlayers: ["0", "1"] },
  moves: {
    command: {
      client: false,
      redact: true,
      move: ({ G, playerID }, command: EngineCommand) => {
        // Existing operations use structuredClone. Never pass an Immer proxy.
        const engine = copy(G.engine);
        let accepted = false;
        if (command.action === "answer")
          accepted = answerBattle(engine, registry, playerID, command.answer);
        else if (command.action === "play")
          accepted =
            playerID === "0" &&
            !engine.playerHistory[playerID].Slash &&
            dispatchTriggerOperation(
              engine.scheduler,
              engine,
              registry,
              { name: "card-use-request", data: playRequest(playerID) },
              playerID,
            );
        else if (
          command.action === "draw" &&
          engine.cardZones.draw.cards.length
        )
          accepted = dispatchTriggerOperation(
            engine.scheduler,
            engine,
            registry,
            { name: "draw-cards", data: { players: [playerID], counts: [1] } },
            playerID,
          );
        if (!accepted) return INVALID_MOVE;
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
