import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import {
  createDrawPhaseOperation,
  createDrawPhaseRule,
} from "../../src/game/hegemony/draw-phase";
import { createFreeChainOperation } from "../../src/game/hegemony/general-rewards";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  continueTriggerWork,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";

const events = [
  "DrawNCards",
  "AfterDrawNCards",
  "GeneralShowed",
  "FetchDrawPileCard",
  "BeforeCardsMove",
  "ConfirmMoveCards",
  "PreCardsMoveOneTime",
  "CardsMoveOneTime",
  "BeforeGameOverJudge",
  "HpChanged",
  "GameOverJudge",
  "Death",
  "BuryVictim",
  "DeathFinished",
];
function fixture(stepBudget = 1, promptAt = "") {
  const f = drawingSetup();
  f.rules.version = "draw-phase-save-v1";
  f.rules.stepBudget = stepBudget;
  f.rules.unwind = true;
  f.scheduler = createTriggerScheduler(f.game.seatOrder, f.rules.version);
  f.game.playerFlags.a = ["Global_FirstRound", "keep"];
  f.policy.notify = () => null;
  f.rules.operations = f.rules.operations!.filter((op) =>
    [
      "draw-cards",
      "get-n-cards",
      "draw-card",
      "swap-pile",
      "move-cards",
      "kill-player",
      "game-over",
    ].includes(op.name),
  );
  f.rules.operations.push(
    createDrawPhaseOperation(),
    createFreeChainOperation({
      kill: (target) => ({
        name: "kill-player",
        data: { target, damage: null },
      }),
      validateKillSave: (target, operation) => {
        const d = operation.data;
        if (
          operation.name !== "kill-player" ||
          !d ||
          typeof d !== "object" ||
          Array.isArray(d) ||
          Object.keys(d).length !== 2 ||
          d.target !== target ||
          d.damage !== null
        )
          throw Error("Invalid kill mapping");
      },
      companion: () => false,
      maxHp: () => 4,
    }),
  );
  f.rules.validateEvent = (_g, event) => {
    if (
      !events.includes(event.name) ||
      (event.name === "FetchDrawPileCard"
        ? event.target !== null
        : !event.target || !f.game.seatOrder.includes(event.target))
    )
      throw Error("Invalid fixture event");
  };
  f.rules.skills = [
    {
      id: "fixture-observer",
      rule: true,
      priority: 1,
      events,
      validateSave: (_g, frame, prompt) => {
        if (
          (frame.continuation !== null && frame.continuation !== true) ||
          (prompt &&
            (prompt.actor !== "a" ||
              prompt.canCancel ||
              prompt.choices.length !== 1 ||
              prompt.choices[0].id !== "go"))
        )
          throw Error("Invalid fixture observer");
      },
      effect: ({ game, event, continuation }) => {
        if (continuation === null)
          game.trace.push({ ...structuredClone(event) });
        return continuation === null &&
          event.name === promptAt &&
          (event.target === null || event.target === "a")
          ? {
              kind: "prompt",
              actor: "a",
              choices: ["go"],
              canCancel: false,
              continuation: true,
            }
          : { kind: "done", value: false };
      },
    },
  ];
  return f;
}
type Fixture = ReturnType<typeof fixture>;
function start(f: Fixture, data: TriggerData = { target: "a", data: null }) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      { name: "draw-phase", data },
      "a",
    ),
  ).toBe(true);
}
function reload(f: Fixture) {
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
  for (let step = 0; step < 1000; step++) {
    reload(f);
    if (f.scheduler.interruption) return;
    const p = f.scheduler.prompt;
    if (p)
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.rules, p.actor, {
          id: p.id,
          choice: "go",
        }),
      ).toBe(true);
    else if (f.scheduler.yielded)
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    else return;
  }
  throw Error("Draw phase did not finish");
}
describe("actual Draw-phase recovery", () => {
  it("decodes unstarted phase work without stripping its FirstRound flag", () => {
    const f = fixture();
    f.rules.operations!.push({
      name: "fixture-owner",
      validateSave: (_g, frame) => {
        if (frame.continuation !== null && frame.continuation !== true)
          throw Error("Invalid owner");
      },
      validateResult: (_g, result) => {
        if (result.value !== null) throw Error("Invalid owner result");
      },
      run: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "draw-phase",
                data: { target: "a", data: null },
              },
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
    reload(f);
    expect(f.game.playerFlags.a).toEqual(["Global_FirstRound", "keep"]);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });

  it.each([
    { bonus: -1, ids: [] },
    { bonus: 1, ids: [0, 1, 2, 3, 4] },
  ])("accepts captured native Jieyue bonus $bonus", ({ bonus, ids }) => {
    const f = fixture();
    f.game.playerMarks.a.JieyueExtraDraw = bonus;
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual(ids);
  });

  it.each([2, 4, 6])("rejects a non-null drain input at stage %i", (stage) => {
    const f = fixture();
    start(f);
    seek(f, stage);
    const child = f.scheduler.frames[1];
    if (child.kind !== "operation") throw Error("Expected free-chain");
    child.operation.data = {};
    expect(() => reload(f)).toThrow();
  });

  it.each(["answer", "cleanup"])("rejects a direct %s boundary", (kind) => {
    const f = fixture();
    start(f);
    const root = f.scheduler.frames[0];
    if (root.kind !== "operation") throw Error("Expected phase");
    if (kind === "answer") root.answer = { choice: "go" };
    else root.cleanup = { normalContinuation: root.continuation };
    expect(() => reload(f)).toThrow();
  });

  it("rejects a non-null retained phase result", () => {
    const f = fixture();
    start(f);
    finish(f);
    if (!f.scheduler.operationCompletion) throw Error("Expected result");
    f.scheduler.operationCompletion.value = true;
    expect(() => reload(f)).toThrow();
  });
  it.each([
    "DrawNCards",
    "GeneralShowed",
    "ConfirmMoveCards",
    "AfterDrawNCards",
  ])("restores a nested %s prompt", (name) => {
    const f = fixture(1, name);
    if (name === "GeneralShowed") f.game.playerMarks.a.Global_GeneralShown = 1;
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });

  it.each([
    { count: -2, ids: [] },
    { count: 0, ids: [] },
    { count: 1, ids: [0] },
    { count: 4, ids: [0, 1, 2, 3] },
  ])("captures rewritten count $count", ({ count, ids }) => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "DrawNCards") context.event.data = count;
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual(ids);
    expect(f.game.trace).toContainEqual({
      name: "AfterDrawNCards",
      target: "a",
      data: count,
    });
  });

  it("runs all three actual drains using explicitly queued fixture rewards", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (
        ["DrawNCards", "AfterDrawNCards", "CardsMoveOneTime"].includes(
          context.event.name,
        ) &&
        context.event.target === "a"
      ) {
        context.game.playerMarks.a.Global_GeneralShown = 1;
        context.game.playerMarks.a.Global_TheFirstToShowRewarded = 1;
      }
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.playerMarks.a["@firstshow"]).toBe(3);
    expect(
      f.game.trace.filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          entry.name === "GeneralShowed",
      ),
    ).toHaveLength(3);
  });

  it("does not reread phase/bonus authority or clear a newly added FirstRound flag", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "DrawNCards") {
        context.game.playerPhases.a = "discard";
        context.game.playerMarks.a.JieyueExtraDraw = 715827883;
        context.game.playerFlags.a.push("Global_FirstRound");
      }
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    expect(f.game.playerFlags.a).toEqual(["keep", "Global_FirstRound"]);
  });

  it("keeps positive AfterDraw count when surrender death prevents hand transfer", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "DrawNCards")
        context.game.surrenderPlayer = "a";
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.alive.a).toBe(false);
    expect(f.game.cardZones.a.cards).toEqual([]);
    expect(f.game.trace).toContainEqual({
      name: "AfterDrawNCards",
      target: "a",
      data: 2,
    });
  });

  it("ignores AfterDraw payload rewrites for the captured count", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "AfterDrawNCards") context.event.data = 999;
      return observe(context);
    };
    start(f);
    seek(f, 6);
    expect(cursor(f).count).toBe(2);
    expect(cursor(f).shared).toBe(2);
    finish(f);
  });

  it("preserves native late invalid-count failure after the first drain's eager reward", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "DrawNCards") {
        context.event.data = "bad";
        context.game.playerMarks.a.Global_GeneralShown = 1;
        context.game.playerMarks.a.Global_TheFirstToShowRewarded = 1;
      }
      return observe(context);
    };
    start(f);
    expect(() => finish(f)).toThrow("Invalid Slash integer");
    expect(f.game.playerMarks.a["@firstshow"]).toBe(1);
    expect(f.game.cardZones.a.cards).toEqual([]);
  });

  it.each(["DrawNCards", "GeneralShowed", "AfterDrawNCards"])(
    "preserves %s interruption and real unwind",
    (name) => {
      const f = fixture();
      if (name === "GeneralShowed")
        f.game.playerMarks.a.Global_GeneralShown = 1;
      f.rules.skills[0].effect = ({ event }) =>
        event.name === name
          ? { kind: "interrupt", reason: "turn-broken" }
          : { kind: "done", value: false };
      start(f);
      finish(f);
      if (!f.scheduler.interruption) throw Error("Expected interruption");
      expect(
        unwindTriggerInterruption(
          f.scheduler,
          f.game,
          f.rules,
          f.scheduler.interruption,
        ),
      ).toBe(true);
      for (let step = 0; step < 40 && !f.scheduler.unwindCompletion; step++) {
        reload(f);
        expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
      }
      reload(f);
      expect(f.scheduler.unwindCompletion?.reason).toBe("turn-broken");
      expect(f.game.cardZones.a.cards).toEqual(
        name === "AfterDrawNCards" ? [0, 1] : [],
      );
    },
  );

  it.each(["null-target", "other-phase"])("preserves %s skip", (kind) => {
    const f = fixture();
    if (kind === "other-phase") f.game.playerPhases.a = "play";
    start(f, { target: kind === "null-target" ? null : "a", data: null });
    finish(f);
    expect(f.game.playerFlags.a).toEqual(["Global_FirstRound", "keep"]);
    expect(f.game.trace).toEqual([]);
  });

  it.each([
    "stage",
    "target",
    "initial-count",
    "progress",
    "extra",
    "missing",
    "event-name",
  ])("rejects forged %s", (key) => {
    const f = fixture();
    start(f);
    const c = cursor(f);
    if (key === "stage") c.stage = 7;
    else if (key === "target") c.target = "b";
    else if (key === "initial-count") c.shared = 1;
    else if (key === "progress") c.count = 2;
    else if (key === "extra") c.extra = true;
    else if (key === "missing") f.scheduler.frames.pop();
    else {
      const child = f.scheduler.frames[1];
      if (child.kind !== "event") throw Error("Expected DrawNCards");
      child.event.name = "AfterDrawNCards";
    }
    const before = JSON.stringify(f);
    expect(() => reload(f)).toThrow();
    expect(JSON.stringify(f)).toBe(before);
  });

  it.each(["count", "shared", "reason", "direction", "recipient"])(
    "rejects a contradictory transfer %s",
    (key) => {
      const f = fixture();
      start(f);
      seek(f, 3);
      const c = cursor(f),
        child = f.scheduler.frames[1];
      if (
        child.kind !== "operation" ||
        !child.operation.data ||
        typeof child.operation.data !== "object" ||
        Array.isArray(child.operation.data)
      )
        throw Error("Expected draw request");
      if (key === "count") {
        c.count = 0;
        c.shared = 0;
        child.operation.data.counts = [0];
      } else if (key === "shared") c.shared = 3;
      else if (key === "reason") child.operation.data.reason = "extra";
      else if (key === "direction") child.operation.data.fromUps = [false];
      else child.operation.data.players = ["b"];
      expect(() => reload(f)).toThrow();
    },
  );

  it("does not imply codec coverage for the separate standalone GameRule bridge", () => {
    const f = fixture();
    f.rules.skills.push(createDrawPhaseRule());
    expect(() => createTriggerSaveCodec(f.rules)).toThrow(
      "skill codec coverage",
    );
  });
  it.each([1, 2, 7, 10000])(
    "restores actual draw/drain/movement at budget %i",
    (budget) => {
      const f = fixture(budget);
      start(f);
      finish(f);
      expect(f.game.cardZones.a.cards).toEqual([0, 1]);
      expect(f.game.playerFlags.a).toEqual(["keep"]);
      expect(f.game.trace).toContainEqual({
        name: "AfterDrawNCards",
        target: "a",
        data: 2,
      });
      expect(f.scheduler.operationCompletion?.value).toBe(null);
    },
  );
});

function cursor(f: Fixture) {
  const root = f.scheduler.frames[0],
    c = root.continuation;
  if (
    root.kind !== "operation" ||
    !c ||
    typeof c !== "object" ||
    Array.isArray(c)
  )
    throw Error("Expected Draw cursor");
  return c;
}
function seek(f: Fixture, stage: number) {
  for (let step = 0; step < 400; step++) {
    if (cursor(f).stage === stage) return;
    reload(f);
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  }
  throw Error("Missing phase stage");
}
