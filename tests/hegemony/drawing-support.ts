import {
  createDrawCardOperation,
  createGetNCardsOperation,
  createSwapPileOperation,
  type DrawPileGame,
  type DrawPileRules,
} from "../../src/game/hegemony/draw-pile";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createGameOverOperation } from "../../src/game/hegemony/victory";
import {
  createFreeChainOperation,
  type FreeChainGame,
} from "../../src/game/hegemony/general-rewards";
import { createKillPlayerOperation } from "../../src/game/hegemony/death";
import { createDrawCardsOperation } from "../../src/game/hegemony/draw-cards";
import { createFillHandCardsOperation } from "../../src/game/hegemony/fill-hand";
import {
  createTriggerScheduler,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

export type DrawingGame = DrawPileGame &
  FreeChainGame & {
    playerPhases: Record<string, string>;
    trace: TriggerData[];
  };
export function drawingSetup() {
  const players = ["a", "b", "c"],
    ids = Array.from({ length: 12 }, (_, id) => id);
  const game: DrawingGame = {
    seatOrder: players,
    alive: { a: true, b: true, c: true },
    livingPlayers: [...players],
    seats: { a: 1, b: 2, c: 3 },
    currentPlayer: "a",
    playerFlags: { a: [], b: [], c: [] },
    playerMarks: { a: {}, b: {}, c: {} },
    playerPhases: { a: "draw", b: "play", c: "not-active" },
    hp: { a: 4, b: 4, c: 4 },
    maxHp: { a: 4, b: 4, c: 4 },
    removed: { a: false, b: false, c: false },
    chained: { a: false, b: false, c: false },
    damageStack: [],
    currentdying: {},
    playerHistory: { a: {}, b: {}, c: {} },
    acquiredSkills: Object.fromEntries(
      players.map((p) => [p, { head: [], deputy: [] }]),
    ),
    scenarioRoleShown: { a: false, b: false, c: false },
    surrenderPlayer: null,
    bianhuaChoice: { a: null, b: null, c: null },
    identities: Object.fromEntries(
      players.map((p) => [
        p,
        {
          head: `${p}-head`,
          deputy: `${p}-deputy`,
          headKingdom: "wei",
          kingdom: "wei",
          role: "lord",
          headShown: false,
          deputyShown: false,
          lord: false,
          generalLord: false,
          actualHeadLord: false,
        },
      ]),
    ),
    generalNames: Object.fromEntries(
      players.map((p) => [p, [`${p}-head`, `${p}-deputy`]]),
    ),
    displayedGenerals: Object.fromEntries(
      players.map((p) => [p, { head: `${p}-head`, deputy: `${p}-deputy` }]),
    ),
    generalCatalog: Object.fromEntries(
      players
        .flatMap((p) => [`${p}-head`, `${p}-deputy`])
        .map((name) => [
          name,
          { kingdom: "wei", doubleKingdom: false, lord: false },
        ]),
    ),
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    cardZones: {
      draw: { owner: null, place: "draw", cards: ids },
      reserved: { owner: null, place: "draw", cards: [] },
      discard: { owner: null, place: "discard", cards: [] },
      a: { owner: "a", place: "hand", cards: [] },
      b: { owner: "b", place: "hand", cards: [] },
      c: { owner: "c", place: "hand", cards: [] },
    },
    wrappedCards: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          name: "jink",
          className: "Jink",
          suit: "heart",
          number: id + 1,
          skillName: "",
          modified: false,
          flags: ["visible", "keep"],
          tags: { keep: true },
        },
      ]),
    ),
    pileRandom: { algorithm: "mulberry32-v1", state: 1 },
    trace: [],
  };
  const policy: DrawPileRules = {
    drawZone: "draw",
    reservedZone: "reserved",
    discardZone: "discard",
    notify: (notice) => ({ name: "notice", data: notice }),
  };
  const rules: TriggerRegistry<DrawingGame> = {
    version: "drawing-ce4e62b",
    skills: [
      {
        id: "observer",
        priority: 20,
        rule: true,
        events: [
          "FetchDrawPileCard",
          "BeforeCardsMove",
          "ConfirmMoveCards",
          "PreCardsMoveOneTime",
          "CardsMoveOneTime",
          "DrawNCards",
          "AfterDrawNCards",
          "GeneralShowed",
        ],
        effect: ({ game, event }) => {
          game.trace.push({ ...structuredClone(event) });
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      createDrawCardsOperation(),
      createFillHandCardsOperation({
        draw: (target, count, reason) => ({
          name: "draw-cards",
          data: { players: [target], counts: [count], reason },
        }),
      }),
      createGetNCardsOperation(policy),
      createDrawCardOperation(policy),
      createSwapPileOperation(policy),
      createGameOverOperation(),
      createKillPlayerOperation(),
      createCardMovementOperation(undefined, undefined, undefined, undefined, {
        originals: Object.fromEntries(
          ids.map((id) => [
            id,
            {
              name: "jink",
              className: "Jink",
              suit: "heart",
              number: id + 1,
              skillName: "",
            },
          ]),
        ),
      }),
      createFreeChainOperation({
        kill: (target) => ({
          name: "kill-player",
          data: { target, damage: null },
        }),
        companion: () => false,
        maxHp: () => 4,
      }),
      {
        name: "notice",
        run: ({ game, operation }) => {
          game.trace.push(operation.data);
          return { kind: "return", value: null };
        },
      },
    ],
  };
  return {
    game,
    rules,
    policy,
    scheduler: createTriggerScheduler(game.seatOrder, rules.version),
  };
}
export function records(trace: TriggerData[]) {
  return trace.filter(
    (value): value is Record<string, TriggerData> =>
      value !== null && typeof value === "object" && !Array.isArray(value),
  );
}
