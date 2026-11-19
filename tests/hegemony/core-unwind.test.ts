import { describe, expect, it } from "vitest";
import {
  createDamageOperation,
  type Damage,
  type DamageGame,
} from "../../src/game/hegemony/damage";
import {
  createDamageDoneOperation,
  createDamageDoneRule,
} from "../../src/game/hegemony/damage-rule";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import {
  createCardOnUseOperation,
  readExecutionCardUse,
  type CardUse,
} from "../../src/game/hegemony/card-on-use";
import {
  createRoomUseCardOperation,
  createRoomUseCleanupOperation,
  type RoomUseCleanupGame,
  type RoomCardUse,
  type RoomUseRules,
  type RoomUseCleanupRules,
} from "../../src/game/hegemony/room-use-card";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  unwindTriggerInterruption,
  getTriggerPrompt,
  resumeTriggerPrompt,
  continueTriggerWork,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = DamageGame &
  RoomUseCleanupGame & {
    completed: number;
    roomCleaned: number;
    afterCalls: number;
    finished: number;
    brokenSeen: boolean;
    pauses: number;
    finishedCards: string[];
  };
function packet(): Damage {
  return {
    from: "a",
    to: "b",
    card: null,
    damage: 2,
    nature: "normal",
    chain: false,
    transfer: false,
    by_user: true,
    reason: "",
    flags: [],
    transfer_reason: "",
    prevented: false,
  };
}
function fixture(): Game {
  return {
    seatOrder: ["a", "b"],
    alive: { a: true, b: true },
    removed: { a: false, b: false },
    hp: { a: 10, b: 10 },
    chained: { a: false, b: false },
    currentPlayer: "a",
    damageStack: [packet()],
    playerMarks: { a: {}, b: {} },
    playerFlags: { a: [], b: [] },
    cardZones: {},
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {} },
      roomTags: { is_chained: 1, CurrentDamageStruct: packet() },
    },
    completed: 0,
    playerHistory: { a: {}, b: {} },
    roomCleaned: 0,
    afterCalls: 0,
    pileRandom: { algorithm: "mulberry32-v1", state: 42 },
    engineCardFlags: {},
    finished: 0,
    brokenSeen: false,
    pauses: 0,
    finishedCards: [],
  };
}
function slashUse(): CardUse {
  return {
    from: "a",
    to: ["b"],
    card: {
      type: "basic",
      name: "slash-a",
      className: "Slash",
      skillName: "",
      materialIDs: [],
      flags: [],
    },
  };
}
function slashResources(game: Game) {
  game.cardResources.cards = {
    "slash-a": {
      kind: "virtual",
      key: "first",
      isSlash: true,
      isNDTrick: false,
      flags: [],
      tags: {},
    },
    "slash-b": {
      kind: "virtual",
      key: "second",
      isSlash: true,
      isNDTrick: false,
      flags: [],
      tags: {},
    },
  };
  game.cardResources.playerTags.a.Jink_first = [9];
  game.cardResources.playerTags.b.Jink_second = [7];
}
const resourceRules = { reference: (use: CardUse) => use.card.name };
function cardRegistry(
  point: string,
  reason: "turn-broken" | "stage-change" | "game-over",
): TriggerRegistry<Game> {
  return {
    version: `card-boundary-${point}-${reason}`,
    unwind: true,
    operations: [
      createCardUsedOperation({
        resources: resourceRules,
        preAction: () =>
          point === "pre-action" ? { name: "stop", data: null } : null,
        use: () => ({ name: point === "use" ? "stop" : "end", data: null }),
      }),
      { name: "stop", run: () => ({ kind: "interrupt", reason }) },
      { name: "end", run: () => ({ kind: "return", value: null }) },
    ],
    skills: [
      {
        id: "stop",
        events: [point],
        priority: 10,
        rule: true,
        effect: () => ({ kind: "interrupt", reason }),
      },
    ],
  };
}
function roomFixture(): Game {
  const game = fixture();
  slashResources(game);
  game.cardZones = {
    hand: { owner: "a", place: "hand", cards: [1] },
    table: { owner: null, place: "table", cards: [] },
    discard: { owner: null, place: "discard", cards: [] },
  };
  return game;
}
function roomEntry(): RoomCardUse {
  const use = slashUse();
  use.card.materialIDs = [1];
  return { reference: "slash-a", use };
}
function roomRegistry(
  overrides: Partial<RoomUseRules<Game>> = {},
): TriggerRegistry<Game> {
  return {
    version: "room-cleanup-v1",
    unwind: true,
    skills: [createCardUsedRule(), createCardFinishedRule(resourceRules)],
    operations: [
      createRoomUseCardOperation({
        parse: (_game, entry) => entry,
        inPlay: () => true,
        limited: () => false,
        notify: () => null,
        metadata: (_game, entry) => ({
          identity: entry.reference,
          realIdentity: entry.reference,
          virtual: true,
          lua: false,
          delayed: false,
          handlingMethod: "use",
          canRecast: false,
          face: {
            name: entry.use.card.name,
            className: entry.use.card.className,
            skillName: entry.use.card.skillName,
            suit: "no-suit",
            number: 0,
          },
          showSkill: "",
        }),
        validate: (entry) => ({ name: "validate-fixture", data: entry }),
        onUse: ({ use }) => ({ name: "card-on-use", data: use }),
        after: () => ({ name: "after-fixture", data: null }),
        ...overrides,
      }),
      {
        name: "validate-fixture",
        run: ({ operation }) => ({
          kind: "return",
          value: { entry: operation.data, validated: operation.data },
        }),
      },
      {
        name: "after-fixture",
        run: ({ game }) => {
          game.afterCalls++;
          return { kind: "return", value: null };
        },
      },
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardMovementOperation(),
      createCardUsedOperation({
        resources: resourceRules,
        use: () => ({ name: "break-use", data: null }),
      }),
      {
        name: "break-use",
        run: () => ({ kind: "interrupt", reason: "turn-broken" }),
      },
      {
        name: "room-use-cleanup",
        run: ({ game }) => {
          game.roomCleaned++;
          return { kind: "return", value: null };
        },
      },
    ],
  };
}

function physicalFixture(game: Game, ids: number[]) {
  game.wrappedCards ??= {};
  for (const id of ids) {
    game.engineCardFlags[id] = ["base-keep", "using"];
    game.wrappedCards[id] = {
      name: "physical",
      className: "Slash",
      suit: "spade",
      number: id,
      skillName: "",
      flags: ["wrapped-keep", "using"],
      tags: {},
      modified: true,
    };
  }
}
function realCleanup(
  registry: TriggerRegistry<Game>,
  cards: RoomUseCleanupRules["physicalCards"],
  notify: RoomUseCleanupRules["notify"] = () => null,
) {
  registry.operations = registry.operations!.filter(
    (operation) => operation.name !== "room-use-cleanup",
  );
  registry.operations.push(
    createRoomUseCleanupOperation({
      discardZone: "discard",
      physicalCards: cards,
      notify,
    }),
  );
}

describe("Native protected core interruption cleanup", () => {
  it("marks the live wrapped card modified when the sweep removes using", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    game.cardZones.hand.cards.push(2);
    physicalFixture(game, [1, 2]);
    game.wrappedCards![2].modified = false;
    realCleanup(registry, [
      { id: 1, enabled: true },
      { id: 2, enabled: true },
    ]);
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.wrappedCards![2]).toMatchObject({
      modified: true,
      flags: ["wrapped-keep"],
    });
    expect(game.cardZones.hand.cards).toEqual([2]);
    expect(game.engineCardFlags[2]).toEqual([]);
  });

  it("unwinds a new Room use invoked inside an already-running CardFinished catch", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    game.cardZones.hand.cards.push(2);
    physicalFixture(game, [1, 2]);
    realCleanup(registry, [
      { id: 1, enabled: true },
      { id: 2, enabled: true },
    ]);
    const first = game.cardResources.cards["slash-a"];
    if (first.kind !== "virtual") throw new Error("Virtual fixture required");
    first.flags = ["outer-virtual"];
    registry.skills.push({
      id: "nested-room",
      events: ["CardFinished"],
      priority: 10,
      rule: true,
      effect: ({ game, event, continuation }) => {
        if (continuation !== null)
          throw new Error("Abandoned outer catch event resumed");
        const use = readExecutionCardUse(game, event.data);
        game.finishedCards.push(use.card.name);
        if (use.card.name !== "slash-a") return { kind: "done", value: false };
        const inner = {
          reference: "slash-b",
          use: {
            ...slashUse(),
            card: { ...slashUse().card, name: "slash-b", materialIDs: [2] },
          },
        };
        return {
          kind: "operation",
          operation: { name: "room-use-card", data: inner },
          continuation: true,
        };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    const nested = structuredClone(scheduler.interruption!);
    expect(nested.reason).toBe("turn-broken");
    unwindTriggerInterruption(scheduler, game, registry, nested);
    expect(game.finishedCards).toEqual(["slash-a", "slash-b"]);
    expect([...game.cardZones.discard.cards].sort()).toEqual([1, 2]);
    expect(game.cardZones.hand.cards).toEqual([]);
    expect(game.playerHistory.a.Slash).toBe(2);
    expect(game.pileRandom.state).toBe(3663131668); // Only the completed inner catch shuffled.
    expect(game.cardResources.cards["slash-a"]).toMatchObject({
      flags: ["outer-virtual"],
    });
    expect(game.playerFlags.a).not.toContain("Global_ProcessBroken");
    expect(game.afterCalls).toBe(0);
    expect(scheduler.unwindCompletion).toEqual(nested);
  });

  it("fails explicitly when an opt-in profile omits the required cleanup body or resources", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    registry.operations = registry.operations!.filter(
      (operation) => operation.name !== "room-use-cleanup",
    );
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    expect(() =>
      unwindTriggerInterruption(
        scheduler,
        game,
        registry,
        scheduler.interruption!,
      ),
    ).toThrow("Unknown scheduler operation");
    expect(scheduler.unwindCompletion).toBeNull();
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.afterCalls).toBe(0);
    const other = fixture();
    slashResources(other);
    const withoutResources = cardRegistry("TargetChosen", "turn-broken");
    withoutResources.operations![0] = createCardUsedOperation({
      use: () => ({ name: "end", data: null }),
    });
    const pending = createTriggerScheduler(
      other.seatOrder,
      withoutResources.version,
    );
    dispatchTriggerOperation(
      pending,
      other,
      withoutResources,
      { name: "card-used", data: slashUse() },
      "a",
    );
    expect(() =>
      unwindTriggerInterruption(
        pending,
        other,
        withoutResources,
        pending.interruption!,
      ),
    ).toThrow("Missing CardUsed cleanup resources/local");
    expect(other.cardResources.playerTags.a.Jink_first).toEqual([9]);
  });

  it("rejects a malformed private Room cleanup stage rather than spinning", () => {
    let state = {
      game: roomFixture(),
      scheduler: createTriggerScheduler(["a", "b"], "room-cleanup-v1"),
    };
    const registry = roomRegistry();
    physicalFixture(state.game, [1]);
    realCleanup(registry, [{ id: 1, enabled: true }]);
    registry.skills.push({
      id: "pause-finished",
      events: ["CardFinished"],
      priority: 10,
      rule: true,
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "prompt",
              actor: "b",
              choices: ["yes"],
              canCancel: false,
              continuation: true,
            }
          : { kind: "done", value: false },
    });
    dispatchTriggerOperation(
      state.scheduler,
      state.game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      state.scheduler,
      state.game,
      registry,
      state.scheduler.interruption!,
    );
    const prompt = getTriggerPrompt(state.scheduler, "b")!;
    state = JSON.parse(JSON.stringify(state));
    const frame = state.scheduler.frames.find(
      (frame) =>
        frame.kind === "operation" &&
        frame.operation.name === "room-use-cleanup",
    );
    if (
      !frame ||
      !frame.continuation ||
      typeof frame.continuation !== "object" ||
      Array.isArray(frame.continuation)
    )
      throw new Error("Missing cleanup frame");
    frame.continuation.stage = 99;
    expect(() =>
      resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toThrow("Invalid Room-use cleanup continuation");
    expect(state.game.pileRandom.state).toBe(42);
    expect(state.game.cardZones.discard.cards).toEqual([1]);
  });

  it("resets engine flags without RNG or wrapped sweeps when the enabled pool is empty", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    physicalFixture(game, [1]);
    realCleanup(registry, [{ id: 1, enabled: false }]);
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.engineCardFlags[1]).toEqual([]);
    expect(game.wrappedCards![1].flags).toContain("using");
    expect(game.pileRandom.state).toBe(42);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });

  it("keeps Room catch locals when CardFinished rewrites data and claims another table card", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    game.cardZones.table.cards = [2];
    game.cardZones.handB = { owner: "b", place: "hand", cards: [] };
    physicalFixture(game, [1, 2]);
    realCleanup(registry, [
      { id: 1, enabled: true },
      { id: 2, enabled: true },
    ]);
    game.playerFlags.b = ["Global_ProcessBroken"];
    const original = game.cardResources.cards["slash-a"];
    if (original.kind !== "virtual")
      throw new Error("Virtual fixture required");
    original.flags = ["virtual-keep"];
    registry.skills.push({
      id: "claim-rewrite",
      events: ["CardFinished"],
      priority: 10,
      rule: true,
      effect: ({ game, event, continuation }) => {
        if (continuation !== null) return { kind: "done", value: false };
        const use = readExecutionCardUse(game, event.data);
        use.from = "b";
        use.card.name = "slash-b";
        event.data = use;
        game.finished++;
        return {
          kind: "operation",
          operation: {
            name: "move-cards",
            data: { moves: [{ ids: [2], to: "handB", open: true }] },
          },
          continuation: true,
        };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.finished).toBe(1);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.handB.cards).toEqual([2]);
    expect(game.playerFlags.a).not.toContain("Global_ProcessBroken");
    expect(game.playerFlags.b).toContain("Global_ProcessBroken");
    expect(game.cardResources.cards["slash-a"]).toMatchObject({
      flags: ["virtual-keep"],
    });
    expect(game.cardResources.playerTags.b).not.toHaveProperty("Jink_second");
  });

  it("continues the Room catch when CardFinished is consumed before GameRule", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    physicalFixture(game, [1]);
    realCleanup(registry, [{ id: 1, enabled: true }]);
    const card = game.cardResources.cards["slash-a"];
    if (card.kind !== "virtual") throw new Error("Virtual fixture required");
    card.flags = ["virtual-keep"];
    registry.skills.push({
      id: "consume-finished",
      events: ["CardFinished"],
      priority: 10,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.cardResources.cards["slash-a"]).toMatchObject({
      flags: ["virtual-keep"],
    });
    expect(game.playerFlags.a).not.toContain("Global_ProcessBroken");
    expect(game.wrappedCards![1].flags).not.toContain("using");
    expect(game.engineCardFlags[1]).toEqual([]);
    expect(game.pileRandom.state).toBe(1831565855);
  });

  it("captures the alive list after CardFinished and leaves delayed areas outside the physical sweep", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    game.cardZones.delayed = { owner: "b", place: "delayed", cards: [2] };
    physicalFixture(game, [1, 2]);
    realCleanup(registry, [
      { id: 1, enabled: true },
      { id: 2, enabled: true },
    ]);
    game.cardResources.playerTags.b.Qinggang = ["keep-dead"];
    game.playerFlags.b = ["Global_GongxinOperator", "skill_InTempMoving"];
    registry.skills.push({
      id: "death-condition",
      events: ["CardFinished"],
      priority: 10,
      rule: true,
      effect: ({ game }) => {
        game.alive.b = false;
        return { kind: "done", value: false };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.cardZones.delayed.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.wrappedCards![2].flags).not.toContain("using");
    expect(game.cardResources.playerTags.b.Qinggang).toEqual(["keep-dead"]);
    expect(game.playerFlags.b).toEqual([
      "Global_GongxinOperator",
      "skill_InTempMoving",
    ]);
  });

  it("does not notify a captured temporary flag already removed before JSON resume", () => {
    let state = {
      game: roomFixture(),
      scheduler: createTriggerScheduler(["a", "b"], "room-cleanup-v1"),
    };
    const registry = roomRegistry();
    physicalFixture(state.game, [1]);
    state.game.playerFlags.a = ["one_InTempMoving", "two_InTempMoving"];
    realCleanup(registry, [{ id: 1, enabled: true }], (notice) =>
      notice.kind === "player-flag"
        ? { name: "flag-notice", data: null }
        : null,
    );
    registry.operations!.push({
      name: "flag-notice",
      run: ({ game, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        game.pauses++;
        game.playerFlags.a = game.playerFlags.a.filter(
          (flag) => flag !== "two_InTempMoving",
        );
        return {
          kind: "prompt",
          actor: "b",
          choices: ["yes"],
          canCancel: false,
          continuation: true,
        };
      },
    });
    dispatchTriggerOperation(
      state.scheduler,
      state.game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      state.scheduler,
      state.game,
      registry,
      state.scheduler.interruption!,
    );
    const prompt = getTriggerPrompt(state.scheduler, "b")!;
    expect(state.game.pauses).toBe(1);
    state = JSON.parse(JSON.stringify(state));
    resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
      id: prompt.id,
      choice: "yes",
    });
    expect(getTriggerPrompt(state.scheduler, "b")).toBeNull();
    expect(state.game.pauses).toBe(1);
    expect(state.game.playerFlags.a).toEqual([]);
    expect(state.scheduler.unwindCompletion?.reason).toBe("turn-broken");
  });

  it("retains captured player/flag iteration when a notice changes live tags and life", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    physicalFixture(game, [1]);
    realCleanup(registry, [{ id: 1, enabled: true }], (notice) =>
      notice.kind === "player-flag" && notice.player === "a"
        ? { name: "notice-effect", data: null }
        : null,
    );
    game.playerFlags.a = ["old_InTempMoving"];
    game.playerFlags.b = ["other_InTempMoving"];
    game.cardResources.playerTags.b.Qinggang = ["old"];
    registry.operations!.push({
      name: "notice-effect",
      run: ({ game }) => {
        game.cardResources.playerTags.a.Qinggang = ["new"];
        game.playerFlags.a.push("new_InTempMoving");
        game.alive.b = false;
        return { kind: "return", value: null };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.playerFlags.a).toEqual(["new_InTempMoving"]);
    expect(game.cardResources.playerTags.a.Qinggang).toEqual(["new"]);
    expect(game.playerFlags.b).toEqual([]);
    expect(game.cardResources.playerTags.b).not.toHaveProperty("Qinggang");
  });

  it("executes CardFinished and the global sweep for a virtual use without materials", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    game.cardZones.table.cards = [2];
    physicalFixture(game, [1, 2]);
    realCleanup(registry, [
      { id: 1, enabled: true },
      { id: 2, enabled: true },
    ]);
    registry.skills.push({
      id: "finished-count",
      events: ["CardFinished"],
      priority: 10,
      rule: true,
      effect: ({ game }) => {
        game.finished++;
        return { kind: "done", value: false };
      },
    });
    const entry = roomEntry();
    entry.use.card.materialIDs = [];
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: entry },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.finished).toBe(1);
    expect(game.cardZones.hand.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
    expect(game.pileRandom.state).toBe(3663131668);
  });

  it.each(["material", "sweep"])(
    "does not retry a Room catch interrupted during its %s movement",
    (point) => {
      const game = roomFixture(),
        registry = roomRegistry();
      game.cardZones.table.cards = [2];
      physicalFixture(game, [1, 2]);
      realCleanup(registry, [
        { id: 1, enabled: true },
        { id: 2, enabled: true },
      ]);
      registry.skills.push({
        id: "break-cleanup-move",
        events: ["BeforeCardsMove"],
        priority: 10,
        rule: true,
        effect: ({ event }) => {
          const data = event.data;
          const match =
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            Array.isArray(data.moves) &&
            data.moves.some(
              (item) =>
                item &&
                typeof item === "object" &&
                !Array.isArray(item) &&
                item.to === "discard" &&
                Array.isArray(item.ids) &&
                item.ids.includes(point === "material" ? 1 : 2),
            );
          return match
            ? { kind: "interrupt", reason: "turn-broken" }
            : { kind: "done", value: false };
        },
      });
      const scheduler = createTriggerScheduler(
        game.seatOrder,
        registry.version,
      );
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "room-use-card", data: roomEntry() },
        "a",
      );
      unwindTriggerInterruption(
        scheduler,
        game,
        registry,
        scheduler.interruption!,
      );
      const fresh = structuredClone(scheduler.interruption!);
      unwindTriggerInterruption(scheduler, game, registry, fresh);
      expect(game.cardZones.table.cards).toContain(
        point === "material" ? 1 : 2,
      );
      expect(game.pileRandom.state).toBe(
        point === "material" ? 42 : 3663131668,
      );
      expect(game.afterCalls).toBe(0);
      expect(scheduler.unwindCompletion).toEqual(fresh);
    },
  );

  it("composes actual damage, CardUsed and Room catch bodies in one interrupted use", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    physicalFixture(game, [1]);
    realCleanup(registry, [{ id: 1, enabled: true }]);
    registry.operations!.push(
      createDamageOperation(),
      createDamageDoneOperation(),
    );
    registry.skills.push(
      createDamageDoneRule(),
      {
        id: "break-damaged",
        events: ["Damaged"],
        priority: 10,
        rule: true,
        effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
      },
      {
        id: "finished-count",
        events: ["CardFinished"],
        priority: 10,
        rule: true,
        effect: ({ game }) => {
          game.finished++;
          return { kind: "done", value: false };
        },
      },
    );
    registry.operations!.find(
      (operation) => operation.name === "break-use",
    )!.run = ({ continuation }) => {
      if (continuation !== null) throw new Error("Abandoned use body resumed");
      return {
        kind: "operation",
        operation: { name: "damage", data: packet() },
        continuation: true,
      };
    };
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    expect(game.hp.b).toBe(8);
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.hp.b).toBe(8);
    expect(game.damageStack).toEqual([]);
    expect(game.cardResources.roomTags).not.toHaveProperty(
      "CurrentDamageStruct",
    );
    expect(game.cardResources.playerTags.a).not.toHaveProperty("Jink_first");
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.finished).toBe(1);
    expect(game.playerFlags.a).not.toContain("Global_ProcessBroken");
    expect(game.afterCalls).toBe(0);
    expect(game.playerHistory.a.Slash).toBe(1);
  });

  it("runs each recursive converted Room catch with its own local card and one RNG sweep", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    game.cardZones.hand.cards.push(2);
    physicalFixture(game, [1, 2]);
    realCleanup(registry, [
      { id: 1, enabled: true },
      { id: 2, enabled: true },
    ]);
    registry.operations!.find(
      (operation) => operation.name === "validate-fixture",
    )!.run = ({ game, operation }) => {
      const data = operation.data;
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        typeof data.reference !== "string"
      )
        throw new Error("Bad fixture entry");
      const entry = {
        reference: data.reference,
        use: readExecutionCardUse(game, data.use),
      };
      const validated =
        entry.reference === "slash-a"
          ? {
              reference: "slash-b",
              use: {
                ...entry.use,
                card: { ...entry.use.card, name: "slash-b", materialIDs: [2] },
              },
            }
          : entry;
      return { kind: "return", value: { entry, validated } };
    };
    registry.skills.push({
      id: "finished-cards",
      events: ["CardFinished"],
      priority: 10,
      rule: true,
      effect: ({ game, event }) => {
        game.finishedCards.push(
          readExecutionCardUse(game, event.data).card.name,
        );
        return { kind: "done", value: false };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    expect(game.cardZones.hand.cards).toEqual([1]);
    expect(game.cardZones.table.cards).toEqual([2]);
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.finishedCards).toEqual(["slash-b", "slash-a"]);
    expect(game.cardZones.hand.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
    expect(game.playerHistory.a.Slash).toBe(2);
    expect(game.afterCalls).toBe(0);
    expect(game.pileRandom.state).toBe(3031295998); // Two two-card sweeps.
    expect(game.playerFlags.a).toContain("Global_MoreSlashInOneTurn");
    expect(game.playerFlags.a).not.toContain("Global_ProcessBroken");
  });

  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "abandons the Room catch when CardFinished throws a new %s",
    (reason) => {
      const game = roomFixture(),
        registry = roomRegistry();
      physicalFixture(game, [1]);
      realCleanup(registry, [{ id: 1, enabled: true }]);
      game.cardResources.cards["slash-a"] = {
        kind: "virtual",
        key: "first",
        isSlash: true,
        isNDTrick: false,
        flags: ["virtual-keep"],
        tags: {},
      };
      game.cardResources.playerTags.a.Qinggang = ["first"];
      registry.skills.push({
        id: "break-finished",
        events: ["CardFinished"],
        priority: 10,
        rule: true,
        effect: ({ game }) => {
          game.finished++;
          return { kind: "interrupt", reason };
        },
      });
      const scheduler = createTriggerScheduler(
        game.seatOrder,
        registry.version,
      );
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "room-use-card", data: roomEntry() },
        "a",
      );
      const original = structuredClone(scheduler.interruption!);
      unwindTriggerInterruption(scheduler, game, registry, original);
      const fresh = structuredClone(scheduler.interruption!);
      expect(fresh.reason).toBe(reason);
      expect(fresh.id).not.toBe(original.id);
      expect(
        unwindTriggerInterruption(scheduler, game, registry, original),
      ).toBe(false);
      unwindTriggerInterruption(scheduler, game, registry, fresh);
      expect(game.finished).toBe(1);
      expect(game.playerFlags.a).toContain("Global_ProcessBroken");
      expect(game.cardResources.playerTags.a.Qinggang).toEqual(["first"]);
      expect(game.cardResources.cards["slash-a"].kind).toBe("virtual");
      expect(game.engineCardFlags[1]).toEqual(["base-keep", "using"]);
      expect(game.wrappedCards![1].flags).toContain("using");
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.pileRandom.state).toBe(42);
      expect(game.afterCalls).toBe(0);
      expect(scheduler.unwindCompletion).toEqual(fresh);
    },
  );

  for (const reason of ["turn-broken", "stage-change", "game-over"] as const)
    it.each([
      "validate",
      "history",
      "wrap-notice",
      "physical-notice",
      "on-use",
      "after",
    ])(`honors Room useCard try boundary at %s for ${reason}`, (point) => {
      const game = roomFixture();
      physicalFixture(game, [1]);
      const delayed = point === "wrap-notice",
        virtual = point !== "physical-notice";
      const registry = roomRegistry({
        validate: (entry) => ({
          name: point === "validate" ? "break-use" : "validate-fixture",
          data: entry,
        }),
        notify: (notice) => {
          if (!notice || typeof notice !== "object" || Array.isArray(notice))
            return null;
          if (
            (point === "history" && notice.kind === "history") ||
            ((point === "wrap-notice" || point === "physical-notice") &&
              (notice.kind === "update" || notice.kind === "reset"))
          )
            return { name: "break-use", data: null };
          return null;
        },
        metadata: (_game, entry) => ({
          identity: entry.reference,
          realIdentity: entry.reference,
          virtual,
          delayed,
          lua: false,
          handlingMethod: "use",
          canRecast: false,
          showSkill: "",
          face: {
            name: entry.use.card.name,
            className: entry.use.card.className,
            suit: "spade",
            number: 1,
            skillName: "",
          },
        }),
      });
      registry.operations!.find(
        (operation) => operation.name === "break-use",
      )!.run = () =>
        point === "after"
          ? { kind: "return", value: null }
          : { kind: "interrupt", reason };
      if (point === "after")
        registry.operations!.find(
          (operation) => operation.name === "after-fixture",
        )!.run = ({ game }) => {
          game.afterCalls++;
          return { kind: "interrupt", reason };
        };
      const entry = roomEntry();
      if (delayed) {
        entry.use.card.type = "trick";
        entry.use.card.className = "DelayedTrick";
        game.cardResources.cards[entry.reference].isSlash = false;
      }
      if (!virtual)
        game.cardResources.cards[entry.reference] = {
          kind: "wrapped",
          id: 1,
          key: "1",
          isSlash: true,
          isNDTrick: false,
        };
      const scheduler = createTriggerScheduler(
        game.seatOrder,
        registry.version,
      );
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "room-use-card", data: entry },
        "a",
      );
      expect(scheduler.interruption?.reason).toBe(reason);
      unwindTriggerInterruption(
        scheduler,
        game,
        registry,
        scheduler.interruption!,
      );
      expect(game.roomCleaned).toBe(
        reason === "game-over" || point === "validate" || point === "history"
          ? 0
          : 1,
      );
      expect(game.afterCalls).toBe(point === "after" ? 1 : 0);
      expect(scheduler.operationCompletion).toBeNull();
    });

  it.each([
    "material-move",
    "finished",
    "player-flag",
    "sweep-move",
    "card-flag",
  ])(
    "restores actual Room cleanup paused at %s without repeating effects or RNG",
    (point) => {
      let state = {
        game: roomFixture(),
        scheduler: createTriggerScheduler(["a", "b"], "room-cleanup-v1"),
      };
      const game = state.game;
      game.cardZones.table.cards = [2];
      game.cardZones.judge = { owner: "b", place: "judge", cards: [3] };
      game.cardZones.hand.cards.push(4);
      game.playerFlags.a = ["skill_InTempMoving", "keep"];
      game.cardResources.playerTags.a.Qinggang = ["first"];
      physicalFixture(game, [1, 2, 3, 4]);
      const registry = roomRegistry();
      registry.stepBudget = 5;
      realCleanup(
        registry,
        [1, 2, 3, 4].map((id) => ({ id, enabled: id !== 4 })),
        (notice) => ({ name: "cleanup-notice", data: notice }),
      );
      registry.operations!.push({
        name: "cleanup-notice",
        run: ({ game, operation, continuation }) => {
          const data = operation.data;
          if (
            continuation === null &&
            game.pauses === 0 &&
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            data.kind === point
          ) {
            game.pauses++;
            return {
              kind: "prompt",
              actor: "b",
              choices: ["yes"],
              canCancel: false,
              continuation: true,
            };
          }
          return { kind: "return", value: null };
        },
      });
      registry.skills.push({
        id: "pause-cleanup",
        events: ["BeforeCardsMove", "CardFinished"],
        priority: 10,
        rule: true,
        effect: ({ game, event, continuation }) => {
          if (continuation !== null) return { kind: "done", value: false };
          if (event.name === "CardFinished") game.finished++;
          const data = event.data;
          const move =
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            Array.isArray(data.moves)
              ? data.moves.some(
                  (item) =>
                    item &&
                    typeof item === "object" &&
                    !Array.isArray(item) &&
                    item.to === "discard" &&
                    Array.isArray(item.ids) &&
                    item.ids.includes(point === "material-move" ? 1 : 2),
                )
              : false;
          if (
            game.pauses === 0 &&
            ((point === "finished" && event.name === "CardFinished") ||
              ((point === "material-move" || point === "sweep-move") && move))
          ) {
            game.pauses++;
            return {
              kind: "prompt",
              actor: "b",
              choices: ["yes"],
              canCancel: false,
              continuation: true,
            };
          }
          return { kind: "done", value: false };
        },
      });
      function drain() {
        for (let i = 0; state.scheduler.yielded && i < 500; i++) {
          state = JSON.parse(JSON.stringify(state));
          expect(
            continueTriggerWork(state.scheduler, state.game, registry),
          ).toBe(true);
        }
        expect(state.scheduler.yielded).not.toBe(true);
      }
      dispatchTriggerOperation(
        state.scheduler,
        state.game,
        registry,
        { name: "room-use-card", data: roomEntry() },
        "a",
      );
      drain();
      expect(state.scheduler.interruption?.reason).toBe("turn-broken");
      unwindTriggerInterruption(
        state.scheduler,
        state.game,
        registry,
        state.scheduler.interruption!,
      );
      drain();
      const prompt = getTriggerPrompt(state.scheduler, "b")!;
      expect(prompt).not.toBeNull();
      expect(getTriggerPrompt(state.scheduler, "a")).toBeNull();
      const randomAtPause = state.game.pileRandom.state;
      expect(randomAtPause).toBe(
        point === "sweep-move" || point === "card-flag" ? 1199730185 : 42,
      );
      state = JSON.parse(JSON.stringify(state));
      const before = JSON.stringify(state);
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "a", {
          id: prompt.id,
          choice: "yes",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
          id: prompt.id,
          choice: "unoffered",
        }),
      ).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
          id: prompt.id,
          choice: "yes",
        }),
      ).toBe(true);
      drain();
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
          id: prompt.id,
          choice: "yes",
        }),
      ).toBe(false);
      expect(state.game.finished).toBe(1);
      expect(state.game.pauses).toBe(1);
      expect(state.game.pileRandom.state).toBe(1199730185);
      expect([...state.game.cardZones.discard.cards].sort()).toEqual([1, 2, 3]);
      expect(state.game.cardZones.hand.cards).toEqual([4]);
      expect(state.game.playerFlags.a).toEqual(["keep"]);
      expect(state.game.playerHistory.a.Slash).toBe(1);
      expect(state.game.afterCalls).toBe(0);
      expect(state.scheduler.frames).toEqual([]);
    },
  );

  it("runs actual Room cleanup with flagged CardFinished, broad physical sweep and independent base/wrapped flags", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    game.cardZones.hand.cards.push(4);
    game.cardZones.table.cards.push(2);
    game.cardZones.judge = { owner: "b", place: "judge", cards: [3] };
    game.wrappedCards = {};
    for (const id of [1, 2, 3, 4]) {
      game.engineCardFlags[id] = ["base-keep", "using"];
      game.wrappedCards[id] = {
        name: "physical",
        className: "Slash",
        suit: "spade",
        number: id,
        skillName: "",
        flags: ["wrapped-keep", "using"],
        tags: {},
        modified: true,
      };
    }
    game.playerFlags.a = [
      "Global_GongxinOperator",
      "skill_InTempMoving",
      "keep",
    ];
    game.cardResources.playerTags.a.Qinggang = ["first"];
    game.cardResources.playerTags.b.Qinggang = ["second"];
    registry.operations = registry.operations!.filter(
      (operation) => operation.name !== "room-use-cleanup",
    );
    registry.operations.push(
      createRoomUseCleanupOperation({
        discardZone: "discard",
        physicalCards: [1, 2, 3, 4].map((id) => ({ id, enabled: id !== 4 })),
        notify: () => null,
      }),
    );
    registry.skills.push({
      id: "observe-finished",
      events: ["CardFinished"],
      priority: 10,
      rule: true,
      effect: ({ game }) => {
        expect(game.cardZones.discard.cards).toEqual([1]);
        game.finished++;
        game.brokenSeen = game.playerFlags.a.includes("Global_ProcessBroken");
        return { kind: "done", value: false };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.finished).toBe(1);
    expect(game.brokenSeen).toBe(true);
    expect(game.playerFlags.a).toEqual(["keep"]);
    expect(game.cardResources.playerTags.a).not.toHaveProperty("Qinggang");
    expect(game.cardResources.playerTags.b).not.toHaveProperty("Qinggang");
    expect([...game.cardZones.discard.cards].sort()).toEqual([1, 2, 3]);
    expect(game.cardZones.hand.cards).toEqual([4]);
    expect(game.cardZones.table.cards).toEqual([]);
    expect(game.cardZones.judge.cards).toEqual([]);
    expect(game.engineCardFlags).toEqual({ 1: [], 2: [], 3: [], 4: [] });
    for (const id of [1, 2, 3]) {
      expect(game.wrappedCards![id].flags).toEqual(["wrapped-keep"]);
      expect(game.wrappedCards![id].modified).toBe(true);
    }
    expect(game.wrappedCards![4].flags).toEqual(["wrapped-keep", "using"]);
    expect(game.pileRandom.state).toBe(1199730185); // Three forward-shuffle draws from state42.
    expect(game.afterCalls).toBe(0);
  });
  it("enters the Room catch after actual onUse payment and abandons validateAfter", () => {
    const game = roomFixture(),
      registry = roomRegistry();
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-use-card", data: roomEntry() },
      "a",
    );
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.playerHistory.a.Slash).toBe(1);
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.roomCleaned).toBe(1);
    expect(game.afterCalls).toBe(0);
    expect(game.playerHistory.a.Slash).toBe(1);
    expect(scheduler.operationCompletion).toBeNull();
  });
  for (const reason of ["turn-broken", "stage-change", "game-over"] as const)
    it.each([
      ["pre-action", false],
      ["TargetChoosing", false],
      ["TargetConfirming", false],
      ["TargetRecord", true],
      ["TargetChosen", true],
      ["TargetConfirmed", true],
      ["use", true],
    ] as const)(
      `honors CardUsed protected locals at %s for ${reason}`,
      (point, protectedRegion) => {
        const game = fixture();
        slashResources(game);
        const registry = cardRegistry(point, reason);
        const scheduler = createTriggerScheduler(
          game.seatOrder,
          registry.version,
        );
        dispatchTriggerOperation(
          scheduler,
          game,
          registry,
          { name: "card-used", data: slashUse() },
          "a",
        );
        const frozen = structuredClone(game);
        unwindTriggerInterruption(
          scheduler,
          game,
          registry,
          scheduler.interruption!,
        );
        if (protectedRegion && reason !== "game-over") {
          expect(game.cardResources.playerTags.a).not.toHaveProperty(
            "Jink_first",
          );
          expect(game.cardResources.playerTags.b.Jink_second).toEqual([7]);
        } else expect(game).toEqual(frozen);
      },
    );

  it.each(["TargetRecord", "TargetConfirmed"])(
    "keeps native local versus shared use identity when %s rewrites before a throw",
    (point) => {
      const game = fixture();
      slashResources(game);
      const registry = cardRegistry(
        point === "TargetRecord" ? "TargetChosen" : "use",
        "turn-broken",
      );
      registry.skills.push({
        id: "rewrite",
        events: [point],
        priority: 10,
        rule: true,
        effect: ({ game, event }) => {
          const use = readExecutionCardUse(game, event.data);
          use.from = "b";
          use.card.name = "slash-b";
          event.data = use;
          return { kind: "done", value: false };
        },
      });
      const scheduler = createTriggerScheduler(
        game.seatOrder,
        registry.version,
      );
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "card-used", data: slashUse() },
        "a",
      );
      unwindTriggerInterruption(
        scheduler,
        game,
        registry,
        scheduler.interruption!,
      );
      if (point === "TargetRecord") {
        expect(game.cardResources.playerTags.a).not.toHaveProperty(
          "Jink_first",
        );
        expect(game.cardResources.playerTags.b.Jink_second).toEqual([7]);
      } else {
        expect(game.cardResources.playerTags.a.Jink_first).toEqual([1]);
        expect(game.cardResources.playerTags.b).not.toHaveProperty(
          "Jink_second",
        );
      }
    },
  );

  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "cleans a non-Slash use's current Jink key only for caught %s",
    (reason) => {
      const game = fixture();
      slashResources(game);
      game.cardResources.cards["slash-a"].isSlash = false;
      const use = slashUse();
      use.card.type = "trick";
      use.card.className = "Duel";
      const registry = cardRegistry("TargetChosen", reason);
      const scheduler = createTriggerScheduler(
        game.seatOrder,
        registry.version,
      );
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "card-used", data: use },
        "a",
      );
      expect(game.cardResources.playerTags.a.Jink_first).toEqual([9]);
      unwindTriggerInterruption(
        scheduler,
        game,
        registry,
        scheduler.interruption!,
      );
      if (reason === "game-over")
        expect(game.cardResources.playerTags.a.Jink_first).toEqual([9]);
      else
        expect(game.cardResources.playerTags.a).not.toHaveProperty(
          "Jink_first",
        );
      expect(game.cardResources.playerTags.b.Jink_second).toEqual([7]);
    },
  );

  it("removes prepared Jink at a protected CardUsed interruption instead of restoring its backup", () => {
    const game = fixture();
    slashResources(game);
    const registry: TriggerRegistry<Game> = {
      version: "card-used-unwind-v1",
      unwind: true,
      operations: [
        createCardUsedOperation({
          resources: resourceRules,
          use: () => ({ name: "unused", data: null }),
        }),
      ],
      skills: [
        {
          id: "interrupt",
          events: ["TargetChosen"],
          priority: 10,
          rule: true,
          effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
        },
      ],
    };
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "card-used", data: slashUse() },
      "a",
    );
    expect(game.cardResources.playerTags.a.Jink_first).toEqual([1]);
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.cardResources.playerTags.a).not.toHaveProperty("Jink_first");
    expect(game.cardResources.playerTags.b.Jink_second).toEqual([7]);
  });
  const damageBoundaries = [
    ["ConfirmDamage", false],
    ["Predamage", false],
    ["DamageForseen", true],
    ["DamageCaused", true],
    ["DamageInflicted", true],
    ["PreDamageDone", true],
    ["DamageDone", true],
    ["Damage", true],
    ["Damaged", true],
    ["DamageComplete", true],
  ] as const;
  for (const reason of ["turn-broken", "stage-change", "game-over"] as const)
    it.each(damageBoundaries)(
      `honors the damage try boundary at %s for ${reason}`,
      (event, protectedRegion) => {
        const game = fixture();
        game.cardResources.roomTags.keep = "unrelated";
        const registry: TriggerRegistry<Game> = {
          version: "damage-boundaries-v1",
          unwind: true,
          operations: [createDamageOperation(), createDamageDoneOperation()],
          skills: [
            createDamageDoneRule(),
            {
              id: "interrupt",
              events: [event],
              priority: 10,
              rule: true,
              effect: () => ({ kind: "interrupt", reason }),
            },
          ],
        };
        const scheduler = createTriggerScheduler(
          game.seatOrder,
          registry.version,
        );
        dispatchTriggerOperation(
          scheduler,
          game,
          registry,
          { name: "damage", data: packet() },
          "a",
        );
        const frozen = structuredClone(game);
        expect(
          unwindTriggerInterruption(
            scheduler,
            game,
            registry,
            scheduler.interruption!,
          ),
        ).toBe(true);
        expect(game.hp).toEqual(frozen.hp);
        if (protectedRegion && reason !== "game-over") {
          expect(game.damageStack).toEqual([]);
          expect(game.cardResources.roomTags).toEqual({ keep: "unrelated" });
        } else expect(game).toEqual(frozen);
      },
    );

  it("clears the whole damage stack after real HP loss without rolling HP back or emitting DamageComplete", () => {
    let game = fixture();
    const registry: TriggerRegistry<Game> = {
      version: "core-damage-unwind-v1",
      unwind: true,
      operations: [createDamageOperation(), createDamageDoneOperation()],
      skills: [
        createDamageDoneRule(),
        {
          id: "break-after-hp",
          events: ["Damaged"],
          priority: 10,
          rule: true,
          effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
        },
        {
          id: "observe-complete",
          events: ["DamageComplete"],
          priority: 10,
          record: ({ game }) => {
            game.completed++;
          },
          effect: () => ({ kind: "done", value: false }),
        },
      ],
    };
    let scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "damage", data: packet() },
      "a",
    );
    expect(game.hp.b).toBe(8);
    expect(game.damageStack).toHaveLength(2);
    ({ scheduler, game } = JSON.parse(JSON.stringify({ scheduler, game })));
    expect(
      unwindTriggerInterruption(
        scheduler,
        game,
        registry,
        scheduler.interruption!,
      ),
    ).toBe(true);
    expect(game.hp.b).toBe(8);
    expect(game.damageStack).toEqual([]);
    expect(game.cardResources.roomTags).not.toHaveProperty("is_chained");
    expect(game.cardResources.roomTags).not.toHaveProperty(
      "CurrentDamageStruct",
    );
    expect(game.completed).toBe(0);
  });

  it("unwinds real transferred damage inside its still-protected outer damage", () => {
    const game = fixture();
    const transferred = { ...packet(), from: "b", to: "a", transfer: true };
    const registry: TriggerRegistry<Game> = {
      version: "transfer-unwind-v1",
      unwind: true,
      operations: [createDamageOperation(), createDamageDoneOperation()],
      skills: [
        createDamageDoneRule(),
        {
          id: "transfer",
          events: ["DamageInflicted"],
          priority: 10,
          rule: true,
          effect: ({ game, event }) => {
            if (event.target !== "b") return { kind: "done", value: false };
            game.cardResources.playerTags.b.TransferDamage = transferred;
            return { kind: "done", value: true };
          },
        },
        {
          id: "break-transfer",
          events: ["Damaged"],
          priority: 10,
          rule: true,
          effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
        },
      ],
    };
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "damage", data: packet() },
      "a",
    );
    expect(game.hp).toEqual({ a: 8, b: 10 });
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    expect(game.damageStack).toEqual([]);
    expect(game.cardResources.roomTags).toEqual({});
    expect(game.cardResources.playerTags.b.TransferDamage).toEqual(transferred);
    expect(game.hp).toEqual({ a: 8, b: 10 });
  });
});
