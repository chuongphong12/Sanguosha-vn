import { describe, expect, it } from "vitest";
import {
  createDrawCardOperation,
  createGetNCardsOperation,
  createSwapPileOperation,
  type DrawPileGame,
  type DrawPileRules,
} from "../../src/game/hegemony/draw-pile";
import { createGameOverOperation } from "../../src/game/hegemony/victory";
import type { DeathGame } from "../../src/game/hegemony/death";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  continueTriggerWork,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  type TriggerRegistry,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";

type Game = DrawPileGame & DeathGame & { notices: TriggerData[] };
function fixture(stepBudget = 1) {
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
    gameResult: null,
    cardResources: { cards: {}, playerTags: { a: {} }, roomTags: {} },
    cardZones: {
      draw: { owner: null, place: "draw", cards: [] },
      reserved: { owner: null, place: "draw", cards: [] },
      discard: { owner: null, place: "discard", cards: [0, 1, 2, 3, 4] },
    },
    pileRandom: { algorithm: "mulberry32-v1", state: 1 },
    notices: [],
  };
  const rules: DrawPileRules = {
    drawZone: "draw",
    reservedZone: "reserved",
    discardZone: "discard",
    notify: (data) => ({ name: "fixture-notice", data }),
  };
  const registry: TriggerRegistry<Game> = {
    version: `pile-save-fixture-${stepBudget}`,
    unwind: true,
    stepBudget,
    skills: [],
    validateEvent: (_g, e) => {
      if (
        e.name !== "FetchDrawPileCard" ||
        e.target !== null ||
        e.data !== null
      )
        throw Error("Unexpected fixture event");
    },
    operations: [
      createDrawCardOperation(rules),
      createGetNCardsOperation(rules),
      createSwapPileOperation(rules),
      createGameOverOperation(),
      {
        name: "fixture-notice",
        validateSave: (_g, frame, _interruption, prompt) => {
          if (
            !frame.operation.data ||
            typeof frame.operation.data !== "object" ||
            Array.isArray(frame.operation.data) ||
            !["reset-pile", "update-pile"].includes(
              String(frame.operation.data.kind),
            ) ||
            ![null, true].includes(frame.continuation as boolean | null)
          )
            throw Error("Invalid fixture notice");
          if (
            prompt &&
            (prompt.actor !== "a" ||
              prompt.canCancel ||
              prompt.choices.length !== 1 ||
              prompt.choices[0].id !== "ack")
          )
            throw Error("Invalid fixture prompt");
        },
        validateResult: (_g, result) => {
          if (result.value !== null) throw Error("Invalid fixture result");
        },
        run: ({ game, operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          game.notices.push(structuredClone(operation.data));
          return {
            kind: "prompt",
            actor: "a",
            choices: ["ack"],
            canCancel: false,
            continuation: true,
          };
        },
      },
    ],
  };
  return {
    game,
    registry,
    rules,
    scheduler: createTriggerScheduler(game.seatOrder, registry.version),
  };
}

function finish(f: ReturnType<typeof fixture>) {
  const codec = createTriggerSaveCodec(f.registry);
  let steps = 0;
  while (true) {
    expect(++steps).toBeLessThan(500);
    const checkpoint = JSON.parse(
      JSON.stringify({ game: f.game, scheduler: f.scheduler }),
    );
    const before = JSON.stringify(checkpoint);
    f.scheduler = codec.read(checkpoint.scheduler, checkpoint.game);
    f.game = checkpoint.game;
    expect(JSON.stringify(checkpoint)).toBe(before);
    if (f.scheduler.interruption) break;
    if (f.scheduler.prompt)
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
          id: f.scheduler.prompt.id,
          choice: "ack",
        }),
      ).toBe(true);
    else if (f.scheduler.yielded)
      expect(continueTriggerWork(f.scheduler, f.game, f.registry)).toBe(true);
    else break;
  }
  return f;
}

describe("actual draw-pile save codecs", () => {
  it.each(["batch-terminal", "swap-terminal"])(
    "rejects an impossible %s condition",
    (kind) => {
      const f = fixture();
      if (kind === "swap-terminal") f.rules.swappingLimit = 0;
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        {
          name: kind === "batch-terminal" ? "get-n-cards" : "swap-pile",
          data: kind === "batch-terminal" ? { count: 6 } : null,
        },
        null,
      );
      const root = f.scheduler.frames[0];
      if (kind === "batch-terminal") {
        if (
          root.kind !== "operation" ||
          !root.continuation ||
          typeof root.continuation !== "object" ||
          Array.isArray(root.continuation)
        )
          throw Error("Expected batch terminal");
        root.operation.data = { count: 2 };
        root.continuation.count = 2;
      } else f.game.cardResources!.roomTags.SwapPile = 0;
      expect(() =>
        createTriggerSaveCodec(f.registry).read(f.scheduler, f.game),
      ).toThrow();
    },
  );
  it("rejects a notification cursor for a batch whose count update was disabled", () => {
    const f = fixture();
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "get-n-cards", data: { count: 1 } },
      null,
    );
    let steps = 0;
    while (true) {
      const root = f.scheduler.frames[0];
      if (
        root.continuation &&
        typeof root.continuation === "object" &&
        !Array.isArray(root.continuation) &&
        root.continuation.stage === "noticed"
      )
        break;
      expect(++steps).toBeLessThan(100);
      if (f.scheduler.prompt)
        resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
          id: f.scheduler.prompt.id,
          choice: "ack",
        });
      else continueTriggerWork(f.scheduler, f.game, f.registry);
    }
    const root = f.scheduler.frames[0];
    if (
      root.kind !== "operation" ||
      !root.operation.data ||
      typeof root.operation.data !== "object" ||
      Array.isArray(root.operation.data) ||
      !root.continuation ||
      typeof root.continuation !== "object" ||
      Array.isArray(root.continuation)
    )
      throw Error("Expected batch notice");
    root.operation.data.updatePileNumber = false;
    root.continuation.updatePileNumber = false;
    expect(() =>
      createTriggerSaveCodec(f.registry).read(f.scheduler, f.game),
    ).toThrow();
  });
  it("keeps child checks active for a new draw emitted by a live cleanup handler", () => {
    const f = fixture();
    f.game.cardZones.draw.cards = [0, 1, 2];
    f.game.cardZones.discard.cards = [];
    f.registry.operations!.push({
      name: "fixture-cleanup-owner",
      validateSave: (_g, frame) => {
        if (frame.continuation !== null && frame.continuation !== true)
          throw Error("Invalid cleanup fixture");
      },
      validateResult: (_g, result) => {
        if (result.value !== null) throw Error("Invalid cleanup result");
      },
      run: () => ({ kind: "interrupt", reason: "turn-broken" }),
      unwind: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: { name: "get-n-cards", data: { count: 2 } },
              continuation: true,
            }
          : { kind: "return", value: null },
    });
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "fixture-cleanup-owner", data: null },
      null,
    );
    expect(
      unwindTriggerInterruption(
        f.scheduler,
        f.game,
        f.registry,
        f.scheduler.interruption!,
      ),
    ).toBe(true);
    let steps = 0;
    while (
      !f.scheduler.frames.some(
        (frame) =>
          frame.kind === "operation" && frame.operation.name === "draw-card",
      )
    ) {
      expect(++steps).toBeLessThan(20);
      expect(continueTriggerWork(f.scheduler, f.game, f.registry)).toBe(true);
    }
    const codec = createTriggerSaveCodec(f.registry);
    expect(codec.read(f.scheduler, f.game).frames).toHaveLength(3);
    f.scheduler.frames.pop();
    expect(() => codec.read(f.scheduler, f.game)).toThrow();
  });
  it("restores a nested actual Fetch draw and rechecks the latest available pile", () => {
    const f = fixture();
    f.registry.skills.push({
      id: "fixture-nested-fetch",
      rule: true,
      priority: 1,
      events: ["FetchDrawPileCard"],
      validateSave: (_game, frame, prompt, state) => {
        const child = state?.child;
        if (
          prompt ||
          (frame.continuation !== null && frame.continuation !== true)
        )
          throw Error("Invalid fixture Fetch cursor");
        if (
          child &&
          (child.kind !== "operation" ||
            child.operation.name !== "draw-card" ||
            !child.operation.data ||
            typeof child.operation.data !== "object" ||
            Array.isArray(child.operation.data) ||
            child.operation.data.fromUp !== false)
        )
          throw Error("Invalid fixture nested draw");
      },
      effect: ({ game, continuation }) => {
        if (continuation === true || game.cardResources!.roomTags.nested)
          return { kind: "done", value: false };
        game.cardResources!.roomTags.nested = true;
        return {
          kind: "operation",
          operation: { name: "draw-card", data: { fromUp: false } },
          continuation: true,
        };
      },
    });
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "draw-card", data: {} },
      null,
    );
    const done = finish(f);
    expect(done.scheduler.operationCompletion?.value).toBe(3);
    expect(done.game.cardZones.reserved.cards).toEqual([2, 3]);
    expect(done.game.cardZones.draw.cards).toEqual([1, 4, 0]);
    expect(done.game.pileRandom.state).toBe(567894474);
    expect(done.game.notices).toEqual([
      { kind: "reset-pile" },
      { kind: "update-pile", count: 5 },
    ]);
  });
  it("reads queued child context through isolated copies", () => {
    const f = fixture();
    f.game.cardZones.draw.cards = [0, 1];
    f.game.cardZones.discard.cards = [];
    const batch = f.registry.operations!.find(
      (op) => op.name === "get-n-cards",
    )!;
    const validate = batch.validateSave!;
    batch.validateSave = (game, frame, interruption, prompt, state) => {
      const child = state?.child;
      validate(game, frame, interruption, prompt, state);
      if (child?.kind === "operation")
        Object.assign(child.operation, { data: { fromUp: false } });
    };
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "get-n-cards", data: { count: 2 } },
      null,
    );
    const decoded = createTriggerSaveCodec(f.registry).read(
      f.scheduler,
      f.game,
    );
    expect(decoded.frames[1]).toMatchObject({
      operation: { data: { fromUp: true } },
    });
    expect(f.scheduler.frames[1]).toMatchObject({
      operation: { data: { fromUp: true } },
    });
  });

  it("preserves the swap handler's existing ignored input contract", () => {
    const f = fixture();
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "swap-pile", data: { legacy: "ignored" } },
      null,
    );
    const done = finish(f);
    expect(done.scheduler.operationCompletion?.value).toBeNull();
    expect(done.game.cardZones.draw.cards).toEqual([3, 1, 4, 0, 2]);
  });

  it.each(["draw-cursor", "swap-cursor", "swap-counter", "game-over-result"])(
    "rejects invalid %s",
    (kind) => {
      const f = fixture();
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        { name: kind === "draw-cursor" ? "draw-card" : "swap-pile", data: {} },
        null,
      );
      if (kind === "draw-cursor" || kind === "swap-cursor")
        f.scheduler.frames[0].continuation = true;
      if (kind === "swap-counter")
        f.game.cardResources!.roomTags.SwapPile = "forged";
      if (kind === "game-over-result")
        Object.assign(f.scheduler, {
          frames: [],
          yielded: false,
          prompt: null,
          operationCompletion: {
            operation: { name: "game-over", data: "." },
            value: null,
          },
        });
      expect(() =>
        createTriggerSaveCodec(f.registry).read(f.scheduler, f.game),
      ).toThrow();
    },
  );
  it("decodes a terminal pile operation while unwind pops its abandoned children", () => {
    const f = fixture();
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "get-n-cards", data: { count: 6 } },
      null,
    );
    const done = finish(f),
      codec = createTriggerSaveCodec(f.registry);
    expect(
      unwindTriggerInterruption(
        done.scheduler,
        done.game,
        f.registry,
        done.scheduler.interruption!,
      ),
    ).toBe(true);
    let steps = 0;
    while (!done.scheduler.unwindCompletion) {
      expect(++steps).toBeLessThan(20);
      done.scheduler = codec.read(
        JSON.parse(JSON.stringify(done.scheduler)),
        done.game,
      );
      expect(continueTriggerWork(done.scheduler, done.game, f.registry)).toBe(
        true,
      );
    }
    expect(codec.read(done.scheduler, done.game).unwindCompletion?.reason).toBe(
      "game-over",
    );
    expect(done.game.pileRandom.state).toBe(1);
  });

  it("rejects a forged paid batch cursor with no queued or completed child", () => {
    const f = fixture();
    f.game.cardZones.draw.cards = [0, 1];
    f.game.cardZones.discard.cards = [];
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "get-n-cards", data: { count: 2 } },
      null,
    );
    f.scheduler.frames.pop();
    expect(() =>
      createTriggerSaveCodec(f.registry).read(f.scheduler, f.game),
    ).toThrow();
  });

  it("rejects a queued child under the non-yielding game-over operation", () => {
    const f = fixture();
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "get-n-cards", data: { count: 6 } },
      null,
    );
    const terminal = f.scheduler.frames[1];
    if (terminal.kind !== "operation") throw Error("Expected queued game-over");
    const forged = structuredClone(terminal);
    forged.id = "operation-3";
    forged.operation = { name: "draw-card", data: {} };
    f.scheduler.frames.push(forged);
    f.scheduler.nextId = 4;
    expect(() =>
      createTriggerSaveCodec(f.registry).read(f.scheduler, f.game),
    ).toThrow();
  });
  it.each([1, 7, 10000])(
    "preserves bottom batch acquisition across budget %i",
    (budget) => {
      const f = fixture(budget);
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        {
          name: "get-n-cards",
          data: { count: 3, fromUp: false, updatePileNumber: false },
        },
        null,
      );
      const done = finish(f);
      expect(done.scheduler.operationCompletion?.value).toEqual([2, 0, 4]);
      expect(done.game.cardZones.draw.cards).toEqual([3, 1]);
      expect(done.game.cardZones.reserved.cards).toEqual([2, 0, 4]);
      expect(done.game.pileRandom.state).toBe(567894474);
      expect(done.game.notices).toEqual([
        { kind: "reset-pile" },
        { kind: "update-pile", count: 5 },
      ]);
    },
  );

  it.each([0, -2])(
    "restores a nonpositive batch count %i without taking material",
    (count) => {
      const f = fixture();
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        { name: "get-n-cards", data: { count } },
        null,
      );
      const done = finish(f);
      expect(done.scheduler.operationCompletion?.value).toEqual([]);
      expect(done.game.pileRandom.state).toBe(1);
      expect(done.game.cardZones.discard.cards).toEqual([0, 1, 2, 3, 4]);
      expect(done.game.notices).toEqual([{ kind: "update-pile", count: 0 }]);
    },
  );

  it.each([true, false])(
    "retains ID zero and noncontiguous IDs for fromUp=%s",
    (fromUp) => {
      const f = fixture();
      f.game.cardZones.draw.cards = [0, 17];
      f.game.cardZones.discard.cards = [];
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        { name: "draw-card", data: { fromUp } },
        null,
      );
      const done = finish(f);
      expect(done.scheduler.operationCompletion?.value).toBe(fromUp ? 0 : 17);
      expect(done.game.cardZones.reserved.cards).toEqual(fromUp ? [0] : [17]);
      expect(done.game.pileRandom.state).toBe(1);
    },
  );

  it.each(["exhausted", "limit", "empty-single"])(
    "restores actual game-over through %s without repeating eager changes",
    (kind) => {
      const f = fixture();
      if (kind === "limit") f.rules.swappingLimit = 0;
      if (kind === "empty-single") f.game.cardZones.discard.cards = [];
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        {
          name: kind === "empty-single" ? "draw-card" : "get-n-cards",
          data:
            kind === "empty-single"
              ? {}
              : { count: kind === "exhausted" ? 6 : 2 },
        },
        null,
      );
      const done = finish(f),
        before = JSON.stringify(done.game);
      expect(done.game.gameResult).toBe(".");
      expect(done.scheduler.interruption?.reason).toBe("game-over");
      expect(done.game.pileRandom.state).toBe(1);
      expect(done.game.notices).toEqual([]);
      expect(done.game.cardResources!.roomTags.SwapPile).toBe(
        kind === "limit" ? 1 : undefined,
      );
      finish(done);
      expect(JSON.stringify(done.game)).toBe(before);
    },
  );

  it.each(["stage", "count", "direction", "update", "ids", "child-result"])(
    "rejects corrupted batch %s without changing cards/RNG",
    (kind) => {
      const f = fixture();
      f.game.cardZones.draw.cards = [0, 1, 2];
      f.game.cardZones.discard.cards = [];
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        { name: "get-n-cards", data: { count: 2 } },
        null,
      );
      const frame = f.scheduler.frames[0];
      if (
        !frame.continuation ||
        typeof frame.continuation !== "object" ||
        Array.isArray(frame.continuation)
      )
        throw Error("Expected batch cursor");
      const c = frame.continuation;
      if (kind === "stage") c.stage = ["drawn"];
      if (kind === "count") c.count = 3;
      if (kind === "direction") c.fromUp = false;
      if (kind === "update") c.updatePileNumber = false;
      if (kind === "ids") c.ids = [0];
      if (kind === "child-result") {
        f.scheduler.frames.pop();
        frame.operationChild = {
          operation: { name: "draw-card", data: {} },
          value: 99,
        };
      }
      const before = JSON.stringify(f);
      expect(() =>
        createTriggerSaveCodec(f.registry).read(f.scheduler, f.game),
      ).toThrow();
      expect(JSON.stringify(f)).toBe(before);
    },
  );

  it.each(["duplicate", "short", "available-card", "unknown-card"])(
    "rejects a corrupt completed batch %s",
    (kind) => {
      const f = fixture();
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        { name: "get-n-cards", data: { count: 3 } },
        null,
      );
      const done = finish(f);
      done.scheduler.operationCompletion!.value =
        kind === "duplicate"
          ? [3, 3, 4]
          : kind === "short"
            ? [3]
            : kind === "available-card"
              ? [3, 1, 0]
              : [3, 1, 99];
      expect(() =>
        createTriggerSaveCodec(f.registry).read(done.scheduler, done.game),
      ).toThrow();
    },
  );
  it.each(["direction", "child-operation"])(
    "rejects a queued draw child that contradicts its batch %s",
    (kind) => {
      const f = fixture();
      f.game.cardZones.draw.cards = [0, 1, 2];
      f.game.cardZones.discard.cards = [];
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        { name: "get-n-cards", data: { count: 2 } },
        null,
      );
      const child = f.scheduler.frames[1];
      if (child.kind !== "operation") throw Error("Expected queued draw");
      expect(
        createTriggerSaveCodec(f.registry).read(f.scheduler, f.game).yielded,
      ).toBe(true);
      if (kind === "direction") child.operation.data = { fromUp: false };
      else child.operation.name = "swap-pile";
      expect(() =>
        createTriggerSaveCodec(f.registry).read(f.scheduler, f.game),
      ).toThrow();
    },
  );
  it("restores actual recycle and batch draws without reshuffling or repeating notices", () => {
    const f = fixture();
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        { name: "get-n-cards", data: { count: 3 } },
        null,
      ),
    ).toBe(true);
    const done = finish(f);
    expect(done.scheduler.operationCompletion?.value).toEqual([3, 1, 4]);
    expect(done.game.cardZones.reserved.cards).toEqual([3, 1, 4]);
    expect(done.game.cardZones.draw.cards).toEqual([0, 2]);
    expect(done.game.pileRandom.state).toBe(567894474);
    expect(done.game.cardResources!.roomTags.SwapPile).toBe(1);
    expect(done.game.notices).toEqual([
      { kind: "reset-pile" },
      { kind: "update-pile", count: 5 },
      { kind: "update-pile", count: 2 },
    ]);
  });
});
