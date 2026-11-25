import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import {
  continueTriggerWork,
  createTriggerScheduler,
  dispatchTriggerEvent,
  resumeTriggerPrompt,
  dispatchTriggerOperation,
  unwindTriggerInterruption,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

function fixture(
  budget = 1,
  capture = true,
  result = false,
  interrupt = false,
) {
  const original = drawingSetup();
  const game = {
    ...original.game,
    phaseQueues: Object.fromEntries(
      original.game.seatOrder.map((p) => [
        p,
        { phases: [], states: [], index: 0 },
      ]),
    ),
  };
  game.playerPhases.a = "round-start";
  game.playerMarks.a = { HaventShowGeneral: 1, Global_RoundCount: 1 };
  const rules: TriggerRegistry<typeof game> = {
    version: capture ? "round-start-save-v1" : "round-start-legacy",
    stepBudget: budget,
    unwind: true,
    validateEvent: (_g, event) => {
      if (event.name !== "EventPhaseProceeding")
        throw Error("Invalid fixture event");
    },
    skills: [createPhaseBodyRule()],
    operations: [
      ...createPhaseBodyOperations<typeof game>({
        tableZone: "table",
        card: () => {
          throw Error("Unexpected descriptor");
        },
        onNullified: () => {
          throw Error("Unexpected mapping");
        },
        saveProceeding: true,
        ...(capture ? { saveRoundStart: true as const } : {}),
      }).filter((op) =>
        ["phase-proceeding", "round-start-phase"].includes(op.name),
      ),
      // Acquisition fixture only: it records the request and prompts, but does
      // not implement native ChoiceMade, general reveal or lord conversion.
      {
        name: "ask-general-show",
        validateSave: (g, frame, _interruption, prompt, state) => {
          const data = frame.operation.data;
          if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data) ||
            Object.keys(data).length !== 3 ||
            typeof data.target !== "string" ||
            !g.seatOrder.includes(data.target) ||
            typeof data.reason !== "string" ||
            typeof data.change !== "boolean" ||
            (frame.continuation !== null && frame.continuation !== true) ||
            frame.child ||
            frame.operationChild ||
            state?.child ||
            (frame.answer &&
              (frame.answer.choice !== "ack" || frame.continuation !== true)) ||
            (prompt &&
              (prompt.actor !== data.target ||
                prompt.canCancel ||
                prompt.choices.length !== 1 ||
                prompt.choices[0].id !== "ack" ||
                frame.continuation !== true))
          )
            throw Error("Invalid fixture acquisition");
        },
        validateResult: (_g, completed) => {
          if (typeof completed.value !== "boolean")
            throw Error("Invalid fixture result");
        },
        run: ({ game, operation, continuation }) => {
          const data = operation.data;
          if (
            !data ||
            typeof data !== "object" ||
            Array.isArray(data) ||
            typeof data.target !== "string"
          )
            throw Error("Invalid fixture request");
          if (continuation !== null) return { kind: "return", value: result };
          game.trace.push(structuredClone(data));
          if (interrupt) return { kind: "interrupt", reason: "turn-broken" };
          return {
            kind: "prompt",
            actor: data.target,
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
    rules,
    scheduler: createTriggerScheduler(game.seatOrder, rules.version),
  };
}
type Fixture = ReturnType<typeof fixture>;
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
function start(f: Fixture, target = "a") {
  expect(
    dispatchTriggerEvent(
      f.scheduler,
      f.game,
      f.rules,
      { name: "EventPhaseProceeding", target, data: null },
      "a",
    ),
  ).toBe(true);
}
function finish(f: Fixture, decode = true) {
  for (let step = 0; step < 300; step++) {
    if (decode) reload(f);
    const prompt = f.scheduler.prompt;
    if (prompt)
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.rules, prompt.actor, {
          id: prompt.id,
          choice: "ack",
        }),
      ).toBe(true);
    else if (f.scheduler.yielded)
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    else return;
  }
  throw Error("RoundStart did not finish");
}
function owner(f: Fixture) {
  const frame = f.scheduler.frames.find(
    (frame) =>
      frame.kind === "operation" &&
      frame.operation.name === "round-start-phase",
  );
  if (!frame || frame.kind !== "operation")
    throw Error("Missing RoundStart owner");
  return frame;
}
function seek(f: Fixture, predicate: (f: Fixture) => boolean, decode = true) {
  for (let step = 0; step < 300; step++) {
    if (predicate(f)) return;
    if (decode) reload(f);
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  }
  throw Error("Missing RoundStart checkpoint");
}
function pending(f: Fixture) {
  return f.scheduler.frames.some(
    (frame) =>
      frame.kind === "operation" &&
      frame.operation.name === "round-start-phase" &&
      frame.continuation !== null,
  );
}
describe("actual RoundStart owner recovery", () => {
  it.each([1, 2, 7, 10000])(
    "recovers the actual owners once at budget %i; acquisition is a fixture",
    (budget) => {
      const f = fixture(budget);
      start(f);
      finish(f);
      expect(f.game.trace).toEqual([
        { target: "a", reason: "GameRule_AskForGeneralShow", change: true },
      ]);
      expect(f.scheduler.completion?.consumed).toBe(false);
    },
  );
  it.each([
    [1, 1, true],
    [0, 1, false],
    [1, 2, false],
    [-1, 1, false],
    [3, 1, true],
  ] as const)(
    "captures the native mark gate %i/%i → %s",
    (hidden, round, change) => {
      const f = fixture();
      f.game.playerMarks.a = {
        HaventShowGeneral: hidden,
        Global_RoundCount: round,
      };
      start(f);
      finish(f);
      expect(f.game.trace).toEqual([
        { target: "a", reason: "GameRule_AskForGeneralShow", change },
      ]);
    },
  );
  it.each([true, false])(
    "retains captured change=%s after marks and phase mutate",
    (change) => {
      const f = fixture();
      f.game.playerMarks.a.HaventShowGeneral = change ? 1 : 0;
      start(f);
      seek(f, pending);
      expect(owner(f).continuation).toEqual({ change });
      f.game.playerMarks.a = {
        HaventShowGeneral: change ? 0 : 1,
        Global_RoundCount: 1,
      };
      f.game.playerPhases.a = "none";
      finish(f);
      expect(f.game.trace).toEqual([
        { target: "a", reason: "GameRule_AskForGeneralShow", change },
      ]);
    },
  );
  it("routes the child prompt to the request target, independent of current player", () => {
    const f = fixture();
    f.game.playerPhases.b = "round-start";
    start(f, "b");
    seek(f, (current) => current.scheduler.prompt !== null);
    expect(f.scheduler.prompt?.actor).toBe("b");
    finish(f);
    expect(f.game.trace).toEqual([
      { target: "b", reason: "GameRule_AskForGeneralShow", change: false },
    ]);
  });
  it.each([true, false])(
    "ignores the acquisition fixture's returned boolean %s",
    (result) => {
      const f = fixture(1, true, result);
      start(f);
      seek(f, (current) => current.scheduler.prompt !== null);
      const prompt = f.scheduler.prompt!;
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.rules, prompt.actor, {
          id: prompt.id,
          choice: "ack",
        }),
      ).toBe(true);
      seek(f, (current) =>
        current.scheduler.frames.some(
          (frame) =>
            frame.kind === "operation" &&
            frame.operation.name === "round-start-phase" &&
            frame.operationChild !== null,
        ),
      );
      f.game.playerMarks.a.HaventShowGeneral = 2 ** 31;
      finish(f);
      expect(f.scheduler.completion?.consumed).toBe(false);
      expect(f.game.trace).toHaveLength(1);
    },
  );
  it("leaves the unstarted mark fault to the live owner", () => {
    const f = fixture();
    start(f);
    seek(f, (current) =>
      current.scheduler.frames.some(
        (frame) =>
          frame.kind === "operation" &&
          frame.operation.name === "round-start-phase",
      ),
    );
    expect(owner(f).continuation).toBe(null);
    f.game.playerMarks.a.HaventShowGeneral = 2 ** 31;
    reload(f);
    expect(() => continueTriggerWork(f.scheduler, f.game, f.rules)).toThrow();
    expect(f.game.trace).toEqual([]);
  });
  it.each([
    "legacy",
    "extra",
    "bad-change",
    "wrong-name",
    "wrong-target",
    "reason",
    "change",
    "extra-input",
    "null-input",
    "initial",
    "missing",
    "answer",
    "cleanup",
  ])("rejects corrupted RoundStart %s", (mutation) => {
    const f = fixture();
    start(f);
    seek(f, pending);
    const frame = owner(f),
      index = f.scheduler.frames.indexOf(frame),
      child = f.scheduler.frames[index + 1];
    if (!child || child.kind !== "operation")
      throw Error("Missing acquisition child");
    if (mutation === "legacy") frame.continuation = true;
    if (mutation === "extra") frame.continuation = { change: true, extra: 1 };
    if (mutation === "bad-change") frame.continuation = { change: 1 };
    if (mutation === "wrong-name") child.operation.name = "phase-proceeding";
    if (mutation === "wrong-target")
      child.operation.data = {
        target: "b",
        reason: "GameRule_AskForGeneralShow",
        change: true,
      };
    if (mutation === "reason")
      child.operation.data = { target: "a", reason: "other", change: true };
    if (mutation === "change")
      child.operation.data = {
        target: "a",
        reason: "GameRule_AskForGeneralShow",
        change: false,
      };
    if (mutation === "extra-input")
      child.operation.data = {
        target: "a",
        reason: "GameRule_AskForGeneralShow",
        change: true,
        extra: 1,
      };
    if (mutation === "null-input")
      frame.operation.data = { target: null, data: null };
    if (mutation === "initial") frame.continuation = null;
    if (mutation === "missing") f.scheduler.frames.splice(index + 1);
    if (mutation === "answer") frame.answer = { choice: "ack" };
    if (mutation === "cleanup")
      frame.cleanup = { normalContinuation: frame.continuation };
    expect(() => reload(f)).toThrow();
  });
  it("checks retained request metadata after the fixture has returned", () => {
    const f = fixture();
    start(f);
    seek(f, (current) => current.scheduler.prompt !== null);
    const prompt = f.scheduler.prompt!;
    resumeTriggerPrompt(f.scheduler, f.game, f.rules, prompt.actor, {
      id: prompt.id,
      choice: "ack",
    });
    seek(f, (current) =>
      current.scheduler.frames.some(
        (frame) =>
          frame.kind === "operation" &&
          frame.operation.name === "round-start-phase" &&
          frame.operationChild !== null,
      ),
    );
    owner(f).operationChild!.operation.data = {
      target: "a",
      reason: "GameRule_AskForGeneralShow",
      change: false,
    };
    expect(() => reload(f)).toThrow("RoundStart operation");
  });
  it("validates null-target completion and rejects a nonnull owner result", () => {
    const f = fixture(10000);
    f.rules.skills = [];
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.rules,
        { name: "round-start-phase", data: { target: null, data: null } },
        "a",
      ),
    ).toBe(true);
    reload(f);
    expect(f.scheduler.operationCompletion?.value).toBe(null);
    f.scheduler.operationCompletion!.value = false;
    expect(() => reload(f)).toThrow("RoundStart result");
  });
  it("preserves the default boolean cursor and legacy JSON continuation", () => {
    const f = fixture(1, false);
    start(f);
    seek(f, pending, false);
    expect(owner(f).continuation).toBe(true);
    expect(() => createTriggerSaveCodec(f.rules)).toThrow(
      "operation codec coverage",
    );
    f.scheduler = JSON.parse(JSON.stringify(f.scheduler));
    f.game = JSON.parse(JSON.stringify(f.game));
    finish(f, false);
    expect(f.game.trace).toHaveLength(1);
  });
  it("does not imply Judge codec coverage", () => {
    const f = fixture();
    f.rules.operations!.push(
      ...createPhaseBodyOperations<typeof f.game>({
        tableZone: "table",
        card: () => {
          throw Error("Unused descriptor");
        },
        onNullified: () => {
          throw Error("Unused mapping");
        },
        saveRoundStart: true,
      }).filter((op) => op.name === "judge-phase"),
    );
    expect(() => createTriggerSaveCodec(f.rules)).toThrow(
      "operation codec coverage",
    );
  });
  it("enables standalone RoundStart recovery without the Proceeding opt-in", () => {
    const f = fixture();
    f.rules.skills = [];
    f.rules.operations = f.rules.operations!.filter(
      (op) => op.name === "ask-general-show",
    );
    f.rules.operations.push(
      ...createPhaseBodyOperations<typeof f.game>({
        tableZone: "table",
        card: () => {
          throw Error("Unused descriptor");
        },
        onNullified: () => {
          throw Error("Unused mapping");
        },
        saveRoundStart: true,
      }).filter((op) => op.name === "round-start-phase"),
    );
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.rules,
        { name: "round-start-phase", data: { target: "a", data: null } },
        "a",
      ),
    ).toBe(true);
    finish(f);
    expect(f.scheduler.operationCompletion?.value).toBe(null);
    expect(f.game.trace).toHaveLength(1);
  });
  it("unwinds the owner after the acquisition fixture interrupts", () => {
    const f = fixture(1, true, false, true);
    start(f);
    finish(f);
    if (!f.scheduler.interruption) throw Error("Missing interruption");
    expect(
      unwindTriggerInterruption(
        f.scheduler,
        f.game,
        f.rules,
        f.scheduler.interruption,
      ),
    ).toBe(true);
    finish(f);
    expect(f.scheduler.frames).toEqual([]);
    expect(f.game.trace).toHaveLength(1);
  });
});
