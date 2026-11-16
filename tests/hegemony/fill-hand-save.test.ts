import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import {
  createFillHandCardsOperation,
  type FillHandRules,
} from "../../src/game/hegemony/fill-hand";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  continueTriggerWork,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";

function fixture(save = true) {
  const f = drawingSetup();
  f.rules.skills = [];
  f.rules.unwind = true;
  f.rules.stepBudget = 1;
  f.rules.version = save ? "fill-save-v1" : "fill-legacy-v1";
  f.scheduler = createTriggerScheduler(f.game.seatOrder, f.rules.version);
  f.policy.notify = () => null;
  f.game.cardZones.a.cards = [11];
  f.game.cardZones.draw.cards.pop();
  f.rules.validateEvent = (_game, event) => {
    if (
      event.name === "FetchDrawPileCard"
        ? event.target !== null || event.data !== null
        : ![
            "BeforeCardsMove",
            "ConfirmMoveCards",
            "PreCardsMoveOneTime",
            "CardsMoveOneTime",
          ].includes(event.name) ||
          !event.target ||
          !f.game.seatOrder.includes(event.target)
    )
      throw Error("Unexpected fixture event");
  };
  let drawCalls = 0;
  const draw: FillHandRules["draw"] = (target, count, reason) => {
    drawCalls++;
    return {
      name: "draw-cards",
      data: { players: [target], counts: [count], reason },
    };
  };
  const validateDrawSave: NonNullable<FillHandRules["validateDrawSave"]> = (
    input,
    operation,
  ) => {
    const d = operation.data;
    if (
      operation.name !== "draw-cards" ||
      !d ||
      typeof d !== "object" ||
      Array.isArray(d) ||
      Object.keys(d).length !== 3 ||
      JSON.stringify(d.players) !== JSON.stringify([input.target]) ||
      JSON.stringify(d.counts) !== JSON.stringify([input.shortfall]) ||
      d.reason !== input.reason
    )
      throw Error("Invalid saved fill draw mapping");
  };
  f.rules.operations = f.rules.operations!.filter((op) =>
    [
      "draw-cards",
      "get-n-cards",
      "draw-card",
      "swap-pile",
      "move-cards",
      "game-over",
    ].includes(op.name),
  );
  f.rules.operations.push(
    createFillHandCardsOperation({
      draw,
      ...(save ? { validateDrawSave } : {}),
    }),
  );
  return { ...f, drawCalls: () => drawCalls };
}
type Fixture = ReturnType<typeof fixture>;
function start(
  f: Fixture,
  data: TriggerData = { target: "a", count: 3, reason: "firstshow" },
) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      { name: "fill-hand", data },
      "a",
    ),
  ).toBe(true);
}
function read(f: Fixture) {
  const saved = JSON.parse(
      JSON.stringify({ game: f.game, scheduler: f.scheduler }),
    ),
    before = JSON.stringify(saved);
  f.scheduler = createTriggerSaveCodec(f.rules).read(
    saved.scheduler,
    saved.game,
  );
  f.game = saved.game;
  expect(JSON.stringify(saved)).toBe(before);
}
function finish(f: Fixture) {
  for (let step = 0; step < 500; step++) {
    read(f);
    if (f.scheduler.interruption) return;
    const prompt = f.scheduler.prompt;
    if (prompt)
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.rules, prompt.actor, {
          id: prompt.id,
          choice: "go",
        }),
      ).toBe(true);
    else if (f.scheduler.yielded)
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    else return;
  }
  throw Error("Fill did not finish");
}
describe("actual fill-hand recovery", () => {
  it("decodes an unstarted fill child queued by an explicit fixture owner", () => {
    const f = fixture();
    f.rules.operations!.push({
      name: "fixture-owner",
      validateSave: (_game, frame) => {
        if (
          frame.operation.data !== null ||
          (frame.continuation !== null && frame.continuation !== true)
        )
          throw Error("Invalid fixture owner");
      },
      validateResult: (_game, result) => {
        if (result.value !== null) throw Error("Invalid owner completion");
      },
      run: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: { name: "fill-hand", data: { target: "a", count: 3 } },
              continuation: true,
            }
          : { kind: "return", value: null },
    });
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.rules,
        { name: "fixture-owner", data: null },
        "a",
      ),
    ).toBe(true);
    expect(f.scheduler.frames[1].continuation).toBe(null);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([11, 0, 1]);
    expect(f.drawCalls()).toBe(1);
  });

  it.each(["answer", "cleanup", "event-child"])(
    "rejects an impossible %s boundary",
    (key) => {
      const f = fixture();
      start(f);
      const frame = f.scheduler.frames[0];
      if (key === "answer") frame.answer = { choice: "forged" };
      else if (frame.kind === "operation" && key === "cleanup")
        frame.cleanup = { normalContinuation: frame.continuation };
      else
        frame.child = {
          consumed: false,
          event: { name: "FetchDrawPileCard", target: null, data: null },
        };
      expect(() => read(f)).toThrow();
    },
  );
  it("preserves the legacy boolean cursor and refuses recovery without an explicit draw contract", () => {
    const f = fixture(false);
    start(f);
    const frame = f.scheduler.frames[0];
    expect(frame.continuation).toBe(true);
    expect(() => createTriggerSaveCodec(f.rules)).toThrow(
      "operation codec coverage",
    );
    for (let step = 0; step < 300 && f.scheduler.yielded; step++)
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    expect(f.game.cardZones.a.cards).toEqual([11, 0, 1]);
    expect(f.drawCalls()).toBe(1);
  });

  it.each(["satisfied", "negative", "zero", "dead-reform"])(
    "preserves the %s no-draw branch",
    (kind) => {
      const f = fixture();
      if (kind === "dead-reform") f.game.alive.a = false;
      start(f, {
        target: "a",
        count: kind === "negative" ? -1 : kind === "zero" ? 0 : 1,
        reason: "reform",
      });
      finish(f);
      expect(f.drawCalls()).toBe(0);
      expect(f.game.cardZones.a.cards).toEqual([11]);
    },
  );

  it("does not recompute a paid deficit after a nested actual card gain", () => {
    const f = fixture();
    f.rules.skills.push({
      id: "fixture-gain",
      rule: true,
      priority: 1,
      events: ["FetchDrawPileCard"],
      validateSave: (_game, frame, prompt) => {
        if (
          prompt ||
          (frame.continuation !== null && frame.continuation !== true)
        )
          throw Error("Invalid fixture gain");
      },
      effect: ({ game, continuation }) => {
        if (continuation === null && !game.cardResources.roomTags.gained) {
          game.cardResources.roomTags.gained = true;
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: { moves: [{ ids: [10], to: "a" }] },
            },
            continuation: true,
          };
        }
        return { kind: "done", value: false };
      },
    });
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([11, 10, 0, 1]);
    expect(f.drawCalls()).toBe(1);
  });

  it("keeps its captured draw after the recipient dies during Fetch", () => {
    const f = fixture();
    f.rules.skills.push({
      id: "fixture-death",
      rule: true,
      priority: 1,
      events: ["FetchDrawPileCard"],
      validateSave: () => {},
      effect: ({ game }) => {
        game.alive.a = false;
        return { kind: "done", value: false };
      },
    });
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([11, 0, 1]);
    expect(f.drawCalls()).toBe(1);
  });

  it("restores a nested prompt without invoking the live draw mapper again", () => {
    const f = fixture();
    f.rules.skills.push({
      id: "fixture-prompt",
      rule: true,
      priority: 1,
      events: ["FetchDrawPileCard"],
      validateSave: (_game, frame, prompt) => {
        if (
          (frame.continuation !== null && frame.continuation !== true) ||
          (prompt &&
            (prompt.actor !== "a" ||
              prompt.canCancel ||
              prompt.choices.length !== 1 ||
              prompt.choices[0].id !== "go"))
        )
          throw Error("Invalid fixture prompt");
      },
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "prompt",
              actor: "a",
              choices: ["go"],
              canCancel: false,
              continuation: true,
            }
          : { kind: "done", value: false },
    });
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([11, 0, 1]);
    expect(f.drawCalls()).toBe(1);
  });

  it("decodes an exhausted child and subsequent real unwind without replay", () => {
    const f = fixture();
    start(f, { target: "a", count: 99 });
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([11]);
    if (!f.scheduler.interruption) throw Error("Expected exhaustion");
    expect(
      unwindTriggerInterruption(
        f.scheduler,
        f.game,
        f.rules,
        f.scheduler.interruption,
      ),
    ).toBe(true);
    for (let step = 0; step < 30 && !f.scheduler.unwindCompletion; step++) {
      read(f);
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    }
    read(f);
    expect(f.scheduler.unwindCompletion?.reason).toBe("game-over");
    expect(f.drawCalls()).toBe(1);
  });

  it.each([
    "legacy",
    "target",
    "count",
    "reason",
    "shortfall",
    "zero",
    "negative",
    "fractional",
    "extra",
  ])("rejects a forged %s snapshot without changing the input", (key) => {
    const f = fixture();
    start(f);
    const frame = f.scheduler.frames[0];
    if (key === "legacy") frame.continuation = true;
    else {
      const c = frame.continuation;
      if (!c || typeof c !== "object" || Array.isArray(c))
        throw Error("Expected snapshot");
      if (key === "target") c.target = "b";
      else if (key === "count") c.count = 4;
      else if (key === "reason") c.reason = "other";
      else if (key === "shortfall") c.shortfall = 4;
      else if (key === "zero") c.shortfall = 0;
      else if (key === "negative") c.shortfall = -1;
      else if (key === "fractional") c.shortfall = 1.5;
      else c.extra = true;
    }
    const before = JSON.stringify(f);
    expect(() => read(f)).toThrow();
    expect(JSON.stringify(f)).toBe(before);
  });

  it.each(["missing", "name", "target", "count", "reason", "direction"])(
    "rejects a mismatched %s draw child",
    (key) => {
      const f = fixture();
      start(f);
      const child = f.scheduler.frames[1];
      if (
        child.kind !== "operation" ||
        !child.operation.data ||
        typeof child.operation.data !== "object" ||
        Array.isArray(child.operation.data)
      )
        throw Error("Expected draw child");
      const d = child.operation.data;
      if (key === "missing") f.scheduler.frames.pop();
      else if (key === "name") child.operation.name = "move-cards";
      else if (key === "target") d.players = ["b"];
      else if (key === "count") d.counts = [3];
      else if (key === "reason") d.reason = "other";
      else d.fromUps = [false];
      expect(() => read(f)).toThrow();
    },
  );

  it("rejects a non-null retained completion", () => {
    const f = fixture();
    start(f);
    finish(f);
    if (!f.scheduler.operationCompletion) throw Error("Expected result");
    f.scheduler.operationCompletion.value = true;
    expect(() => read(f)).toThrow();
  });

  it("keeps the captured deficit through actual draw/movement checkpoints", () => {
    const f = fixture();
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([11, 0, 1]);
    expect(f.drawCalls()).toBe(1);
    expect(f.scheduler.operationCompletion?.value).toBe(null);
  });
});
