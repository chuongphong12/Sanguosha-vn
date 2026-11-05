import { describe, expect, it } from "vitest";
import {
  createDrawCardOperation,
  createSwapPileOperation,
  type DrawPileGame,
  type DrawPileRules,
} from "../../src/game/hegemony/draw-pile";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createGameOverOperation } from "../../src/game/hegemony/victory";
import type { DeathGame } from "../../src/game/hegemony/death";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = DrawPileGame & DeathGame & { trace: TriggerData[] };
function setup() {
  const game: Game = {
    seatOrder: ["a"],
    alive: { a: true },
    playerFlags: { a: [] },
    playerMarks: { a: {} },
    removed: { a: false },
    hp: { a: 4 },
    maxHp: { a: 4 },
    chained: { a: false },
    currentPlayer: null,
    damageStack: [],
    currentdying: {},
    livingPlayers: ["a"],
    seats: { a: 1 },
    acquiredSkills: { a: { head: [], deputy: [] } },
    playerHistory: { a: {} },
    identities: {},
    cardResources: { cards: {}, playerTags: { a: {} }, roomTags: {} },
    cardZones: {
      draw: { owner: null, place: "draw", cards: [0, 1, 2] },
      reserved: { owner: null, place: "draw", cards: [] },
      discard: { owner: null, place: "discard", cards: [] },
      hand: { owner: "a", place: "hand", cards: [] },
    },
    pileRandom: { algorithm: "mulberry32-v1", state: 1 },
    trace: [],
  };
  const policy: DrawPileRules = {
    drawZone: "draw",
    reservedZone: "reserved",
    discardZone: "discard",
    notify: (notice) => ({ name: "notice", data: notice }),
  };
  const rules: TriggerRegistry<Game> = {
    version: "draw-ce4e62b",
    skills: [
      {
        id: "observe",
        rule: true,
        priority: 20,
        events: ["FetchDrawPileCard", "BeforeCardsMove"],
        effect: ({ game, event }) => {
          game.trace.push({ ...structuredClone(event) });
          return { kind: "done", value: event.name === "FetchDrawPileCard" };
        },
      },
    ],
    operations: [
      createDrawCardOperation(policy),
      createSwapPileOperation(policy),
      createGameOverOperation(),
      createCardMovementOperation(),
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
describe("Room drawCard", () => {
  it("fetches before reserving physical ID zero without physical movement", () => {
    const { game, rules, scheduler } = setup();
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "draw-card", data: {} },
        null,
      ),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toBe(0);
    expect(game.trace).toEqual([
      { name: "FetchDrawPileCard", target: null, data: null },
    ]);
    expect(game.cardZones.draw.cards).toEqual([1, 2]);
    expect(game.cardZones.reserved.cards).toEqual([0]);
  });
  it("draws from the bottom and moves the reservation through real movement", () => {
    const { game, scheduler, rules } = setup();
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "draw-card", data: { fromUp: false } },
        null,
      ),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toBe(2);
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "move-cards",
          data: {
            moves: [
              { ids: [2], to: "hand", reason: { kind: "draw", actor: "a" } },
            ],
          },
        },
        "a",
      ),
    ).toBe(true);
    expect(game.cardZones.reserved.cards).toEqual([]);
    expect(game.cardZones.hand.cards).toEqual([2]);
  });
  it("reads the latest available pile after a nested Fetch draw", () => {
    const { game, scheduler, rules } = setup();
    rules.skills[0].effect = ({ game, continuation }) => {
      if (game.trace.length === 0) {
        game.trace.push("nested");
        return {
          kind: "operation",
          operation: { name: "draw-card", data: {} },
          continuation: true,
        };
      }
      if (continuation) game.trace.push("returned");
      return { kind: "done", value: true };
    };
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-card", data: {} },
      null,
    );
    expect(scheduler.operationCompletion?.value).toBe(1);
    expect(game.cardZones.reserved.cards).toEqual([0, 1]);
    expect(game.cardZones.draw.cards).toEqual([2]);
  });
  it("restores a Fetch prompt and rejects replay without reserving twice", () => {
    const state = setup(),
      { rules } = state;
    let { game, scheduler } = state;
    rules.skills[0].effect = ({ continuation }) =>
      continuation === null
        ? {
            kind: "prompt",
            actor: "a",
            choices: ["go"],
            canCancel: false,
            continuation: true,
          }
        : { kind: "done", value: true };
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-card", data: {} },
      null,
    );
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    const reply = { id: getTriggerPrompt(scheduler, "a")!.id, choice: "go" };
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        ...reply,
        id: "stale",
      }),
    ).toBe(false);
    expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(true);
    expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(false);
    expect(game.cardZones.reserved.cards).toEqual([0]);
  });
  it("recycles an exhausted pile and reserves exactly one shuffled card", () => {
    const { game, scheduler, rules } = setup();
    game.cardZones.draw.cards = [];
    game.cardZones.discard.cards = [0, 1, 2];
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "draw-card", data: {} },
        null,
      ),
    ).toBe(true);
    expect(game.cardZones.discard.cards).toEqual([]);
    expect(game.cardZones.reserved.cards).toHaveLength(1);
    expect(game.cardResources!.roomTags.SwapPile).toBe(1);
    expect(game.trace.slice(1)).toEqual([
      { kind: "reset-pile" },
      { kind: "update-pile", count: 3 },
    ]);
  });
  it("appends a deterministic shuffle and consumes RNG for the final card too", () => {
    const { game, scheduler, rules } = setup();
    game.cardZones.draw.cards = [9];
    game.cardZones.discard.cards = [0, 1, 2];
    game.wrappedCards = {
      0: {
        name: "jink",
        className: "Jink",
        suit: "heart",
        number: 1,
        skillName: "changed",
        modified: true,
        flags: ["keep"],
        tags: { keep: true },
      },
    };
    const before = structuredClone(game.wrappedCards);
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "swap-pile", data: null },
        null,
      ),
    ).toBe(true);
    // Portable stream seed 1: [1346631033, 5874916, 1132683893].
    // Native forward modulo swaps indices [0, 1, 2] for this three-card list.
    expect(game.cardZones.draw.cards).toEqual([9, 0, 1, 2]);
    expect(game.pileRandom).toEqual({
      algorithm: "mulberry32-v1",
      state: 1199730144,
    });
    expect(game.wrappedCards).toEqual(before);
    expect(game.trace).toEqual([
      { kind: "reset-pile" },
      { kind: "update-pile", count: 4 },
    ]);
  });
  it("ends both-empty before increment, ignoring held draw reservations", () => {
    const { game, scheduler, rules } = setup();
    game.cardZones.reserved.cards = game.cardZones.draw.cards;
    game.cardZones.draw.cards = [];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-card", data: {} },
      null,
    );
    expect(game.gameResult).toBe(".");
    expect(scheduler.interruption?.reason).toBe("game-over");
    expect(game.cardResources!.roomTags.SwapPile).toBeUndefined();
    expect(game.pileRandom.state).toBe(1);
  });
  it("replays a nontrivial five-card shuffle from the serialized seed", () => {
    const { game, scheduler, rules } = setup();
    game.cardZones.draw.cards = [];
    game.cardZones.discard.cards = [0, 1, 2, 3, 4];
    const restored = JSON.parse(JSON.stringify({ game, scheduler }));
    for (const state of [{ game, scheduler }, restored]) {
      dispatchTriggerOperation(
        state.scheduler,
        state.game,
        rules,
        { name: "swap-pile", data: null },
        null,
      );
      // Integer transcript above plus [2106790910, 2079575701] gives swaps [3,1,4,3,4].
      expect(state.game.cardZones.draw.cards).toEqual([3, 1, 4, 0, 2]);
      expect(state.game.pileRandom.state).toBe(567894474);
    }
  });
  it("permits disabled swap limits and consumes one RNG step for a single card", () => {
    const { game, scheduler, rules, policy } = setup();
    policy.swappingLimit = -1;
    game.cardResources!.roomTags.SwapPile = 5;
    game.cardZones.draw.cards = [];
    game.cardZones.discard.cards = [0];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-card", data: {} },
      null,
    );
    expect(game.gameResult).toBeUndefined();
    expect(game.pileRandom.state).toBe(1831565814);
    expect(scheduler.operationCompletion?.value).toBe(0);
  });
  it.each([
    [5, true],
    [6, false],
  ])(
    "uses equality at the default limit with prior count %i",
    (count, terminal) => {
      const { game, scheduler, rules } = setup();
      game.cardResources!.roomTags.SwapPile = count;
      game.cardZones.draw.cards = [];
      game.cardZones.discard.cards = [0, 1, 2];
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "draw-card", data: {} },
        null,
      );
      expect(game.cardResources!.roomTags.SwapPile).toBe(count + 1);
      expect(game.gameResult === ".").toBe(terminal);
      expect(game.cardZones.discard.cards).toEqual(terminal ? [0, 1, 2] : []);
      expect(game.pileRandom.state === 1).toBe(terminal);
    },
  );
  it("does not continue if a misregistered terminal operation returns", () => {
    const { game, scheduler, rules } = setup();
    game.cardZones.draw.cards = [];
    rules.operations = rules.operations!.filter(
      (op) => op.name !== "game-over",
    );
    rules.operations.push({
      name: "game-over",
      run: () => ({ kind: "return", value: null }),
    });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "draw-card", data: {} },
        null,
      ),
    ).toThrow("must interrupt");
    expect(game.pileRandom.state).toBe(1);
  });
  it("restores after reset notification without reshuffling and uses the latest count", () => {
    const state = setup(),
      { rules } = state;
    let { game, scheduler } = state;
    game.cardZones.draw.cards = [];
    game.cardZones.discard.cards = [0, 1, 2];
    rules.operations = rules.operations!.filter((op) => op.name !== "notice");
    rules.operations.push({
      name: "notice",
      run: ({ game, operation, continuation }) => {
        if (
          typeof operation.data === "object" &&
          operation.data &&
          !Array.isArray(operation.data) &&
          operation.data.kind === "reset-pile" &&
          continuation === null
        )
          return {
            kind: "prompt",
            actor: "a",
            choices: ["go"],
            canCancel: false,
            continuation: true,
          };
        game.trace.push(operation.data);
        if (continuation) {
          game.cardZones.hand.cards.push(game.cardZones.draw.cards.pop()!);
        }
        return { kind: "return", value: null };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-card", data: {} },
      null,
    );
    const random = structuredClone(game.pileRandom);
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    const reply = { id: getTriggerPrompt(scheduler, "a")!.id, choice: "go" };
    expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(true);
    expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(false);
    expect(game.pileRandom).toEqual(random);
    expect(game.trace.slice(1)).toEqual([
      { kind: "reset-pile" },
      { kind: "update-pile", count: 2 },
    ]);
    expect(game.cardResources!.roomTags.SwapPile).toBe(1);
  });
  it.each(["duplicate", "negative", "same-zone"])(
    "rejects malformed %s before allocating a frame",
    (fault) => {
      const { game, scheduler, rules, policy } = setup();
      if (fault === "duplicate") game.cardZones.hand.cards = [0];
      if (fault === "negative") game.cardZones.draw.cards = [-1];
      if (fault === "same-zone") policy.reservedZone = "draw";
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "draw-card", data: {} },
          null,
        ),
      ).toThrow();
      expect(scheduler.frames).toEqual([]);
      expect(game.trace).toEqual([]);
    },
  );
});
