import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import { createDrawPhaseOperation } from "../../src/game/hegemony/draw-phase";
import { createFreeChainOperation } from "../../src/game/hegemony/general-rewards";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import {
  continueTriggerWork,
  createTriggerScheduler,
  dispatchTriggerEvent,
  dispatchTriggerOperation,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

const events = [
  "EventPhaseProceeding",
  "DrawNCards",
  "AfterDrawNCards",
  "FetchDrawPileCard",
  "BeforeCardsMove",
  "ConfirmMoveCards",
  "PreCardsMoveOneTime",
  "CardsMoveOneTime",
];
function fixture(budget = 1, capture = true) {
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
  const rules: TriggerRegistry<typeof game> = original.rules;
  const f = { ...original, game, rules };
  rules.version = capture
    ? "phase-proceeding-save-v1"
    : "phase-proceeding-legacy";
  rules.stepBudget = budget;
  rules.unwind = true;
  rules.validateEvent = (_g, event) => {
    if (!events.includes(event.name)) throw Error("Invalid fixture event");
  };
  rules.skills = [createPhaseBodyRule()];
  f.policy.notify = () => null;
  rules.operations = rules.operations!.filter((op) =>
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
  rules.operations.push(
    ...createPhaseBodyOperations<typeof game>({
      tableZone: "table",
      card: () => {
        throw Error("Unexpected Judge descriptor");
      },
      onNullified: () => {
        throw Error("Unexpected nullified mapping");
      },
      ...(capture ? { saveProceeding: true as const } : {}),
    }).filter((op) => op.name === "phase-proceeding"),
    createDrawPhaseOperation(),
    createFreeChainOperation({
      kill: (target) => ({
        name: "kill-player",
        data: { target, damage: null },
      }),
      validateKillSave: (target, op) => {
        const data = op.data;
        if (
          op.name !== "kill-player" ||
          !data ||
          typeof data !== "object" ||
          Array.isArray(data) ||
          Object.keys(data).length !== 2 ||
          data.target !== target ||
          data.damage !== null
        )
          throw Error("Invalid fixture kill mapping");
      },
      companion: () => false,
      maxHp: () => 4,
    }),
  );
  f.scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  return f;
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
function start(f: Fixture, target: string | null = "a", data = null) {
  expect(
    dispatchTriggerEvent(
      f.scheduler,
      f.game,
      f.rules,
      { name: "EventPhaseProceeding", target, data },
      "a",
    ),
  ).toBe(true);
}
function finish(f: Fixture) {
  for (let step = 0; step < 600; step++) {
    reload(f);
    const prompt = f.scheduler.prompt;
    if (prompt) {
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.rules, prompt.actor, {
          id: prompt.id,
          choice: "go",
        }),
      ).toBe(true);
      continue;
    }
    if (!f.scheduler.yielded) return;
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  }
  throw Error("Proceeding did not finish");
}
function owner(f: Fixture) {
  const frame = f.scheduler.frames.find(
    (frame) =>
      frame.kind === "operation" && frame.operation.name === "phase-proceeding",
  );
  if (!frame || frame.kind !== "operation")
    throw Error("Missing Proceeding owner");
  return frame;
}
function seek(f: Fixture, predicate: (f: Fixture) => boolean) {
  for (let step = 0; step < 600; step++) {
    if (predicate(f)) return;
    reload(f);
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  }
  throw Error("Missing checkpoint");
}
function pending(f: Fixture) {
  return f.scheduler.frames.some(
    (frame) =>
      frame.kind === "operation" &&
      frame.operation.name === "phase-proceeding" &&
      frame.continuation !== null,
  );
}
describe("actual shared Proceeding recovery", () => {
  it.each([1, 2, 7, 10000])(
    "restores shared GameRule and actual Draw once at budget %i",
    (budget) => {
      const f = fixture(budget);
      start(f);
      finish(f);
      expect(f.game.cardZones.a.cards).toEqual([0, 1]);
      expect(f.scheduler.completion?.consumed).toBe(false);
      expect(f.scheduler.frames).toEqual([]);
    },
  );
  it("keeps the captured Draw branch after its live phase changes", () => {
    const f = fixture();
    start(f);
    seek(f, (current) =>
      current.scheduler.frames.some(
        (frame) =>
          frame.kind === "operation" && frame.operation.name === "draw-cards",
      ),
    );
    expect(owner(f).continuation).toEqual({ child: "draw-phase" });
    f.game.playerPhases.a = "judge";
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });
  it.each(["start", "finish", "not-active"])(
    "restores no-body phase %s",
    (phase) => {
      const f = fixture();
      f.game.playerPhases.a = phase;
      start(f);
      finish(f);
      expect(f.game.cardZones.a.cards).toEqual([]);
      expect(f.scheduler.completion?.consumed).toBe(false);
    },
  );
  it("keeps a null-target no-op", () => {
    const f = fixture();
    start(f, null);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([]);
  });
  it.each([
    ["round-start", "round-start-phase"],
    ["judge", "judge-phase"],
    ["play", "play-phase"],
    ["discard", "discard-phase"],
  ])("captures %s dispatch; its body is a labeled fixture", (phase, name) => {
    const f = fixture();
    f.game.playerPhases.a = phase;
    f.rules.operations!.push({
      name,
      validateSave: () => undefined,
      validateResult: () => undefined,
      run: ({ game, operation }) => {
        game.trace.push(operation.data);
        return { kind: "return", value: null };
      },
    });
    start(f);
    seek(f, pending);
    expect(owner(f).continuation).toEqual({ child: name });
    f.game.playerPhases.a = "none";
    finish(f);
    expect(f.game.trace).toEqual([{ target: "a", data: null }]);
  });
  it("does not run a live phase gate while decoding unstarted work", () => {
    const f = fixture();
    start(f);
    seek(f, (current) =>
      current.scheduler.frames.some(
        (frame) =>
          frame.kind === "operation" &&
          frame.operation.name === "phase-proceeding",
      ),
    );
    expect(owner(f).continuation).toBe(null);
    f.game.playerPhases.a = "none";
    reload(f);
    expect(() => continueTriggerWork(f.scheduler, f.game, f.rules)).toThrow(
      "Invalid Proceeding phase",
    );
  });
  it("ignores later invalid phase data when its child has returned", () => {
    const f = fixture();
    start(f);
    seek(f, (current) =>
      current.scheduler.frames.some(
        (frame) =>
          frame.kind === "operation" &&
          frame.operation.name === "phase-proceeding" &&
          frame.operationChild !== null,
      ),
    );
    f.game.playerPhases.a = "invalid-late";
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });
  it.each([
    "legacy",
    "extra",
    "unknown",
    "wrong-name",
    "wrong-target",
    "payload",
    "input",
    "initial",
    "missing",
    "answer",
    "cleanup",
  ])("rejects corrupt dispatch %s", (mutation) => {
    const f = fixture();
    start(f);
    seek(f, pending);
    const frame = owner(f),
      index = f.scheduler.frames.indexOf(frame),
      child = f.scheduler.frames[index + 1];
    if (!child || child.kind !== "operation")
      throw Error("Missing queued body");
    if (mutation === "legacy") frame.continuation = true;
    if (mutation === "extra")
      frame.continuation = { child: "draw-phase", extra: 1 };
    if (mutation === "unknown") frame.continuation = { child: "other-phase" };
    if (mutation === "wrong-name") child.operation.name = "kill-player";
    if (mutation === "wrong-target")
      child.operation.data = { target: "b", data: null };
    if (mutation === "payload") child.operation.data = { target: "a", data: 2 };
    if (mutation === "input")
      frame.operation.data = { target: null, data: null };
    if (mutation === "initial") frame.continuation = null;
    if (mutation === "missing") f.scheduler.frames.splice(index + 1);
    if (mutation === "answer") frame.answer = { choice: "go" };
    if (mutation === "cleanup")
      frame.cleanup = { normalContinuation: frame.continuation };
    expect(() => reload(f)).toThrow();
  });
  it("rejects a wrong retained branch even when another body name is registered", () => {
    const f = fixture();
    start(f);
    f.rules.operations!.push({
      name: "judge-phase",
      validateSave: () => undefined,
      validateResult: () => undefined,
      run: () => ({ kind: "return", value: null }),
    });
    seek(f, (current) =>
      current.scheduler.frames.some(
        (frame) =>
          frame.kind === "operation" &&
          frame.operation.name === "phase-proceeding" &&
          frame.operationChild !== null,
      ),
    );
    owner(f).operationChild!.operation.name = "judge-phase";
    expect(() => reload(f)).toThrow("Proceeding operation");
  });
  it("rejects nonnull completed Proceeding result", () => {
    const f = fixture(10000);
    f.game.playerPhases.a = "finish";
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.rules,
        { name: "phase-proceeding", data: { target: "a", data: null } },
        "a",
      ),
    ).toBe(true);
    f.scheduler.operationCompletion!.value = false;
    expect(() => reload(f)).toThrow("Proceeding result");
  });
  it("preserves legacy boolean cursors without promising their codec coverage", () => {
    const f = fixture(1, false);
    start(f);
    for (let step = 0; step < 600 && !pending(f); step++)
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    expect(owner(f).continuation).toBe(true);
    expect(() => createTriggerSaveCodec(f.rules)).toThrow(
      "operation codec coverage",
    );
    f.scheduler = JSON.parse(JSON.stringify(f.scheduler));
    f.game = JSON.parse(JSON.stringify(f.game));
    for (let step = 0; step < 600 && f.scheduler.yielded; step++)
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });
  it("does not imply codec coverage for the whole phase body factory", () => {
    const f = fixture();
    f.rules.operations!.push(
      ...createPhaseBodyOperations<typeof f.game>({
        tableZone: "table",
        card: () => {
          throw Error("Unexpected descriptor");
        },
        onNullified: () => {
          throw Error("Unexpected mapping");
        },
        saveProceeding: true,
      }).filter((op) => op.name !== "phase-proceeding"),
    );
    expect(() => createTriggerSaveCodec(f.rules)).toThrow(
      "operation codec coverage",
    );
  });
  it("restores a nested movement prompt through the shared owner", () => {
    const f = fixture();
    f.rules.skills.push({
      id: "fixture-prompt",
      priority: 1,
      rule: true,
      events: ["ConfirmMoveCards"],
      validateSave: () => undefined,
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
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });
  it("restores abandonment after a real Draw descendant interrupts", () => {
    const f = fixture();
    f.rules.skills.push({
      id: "fixture-interrupt",
      priority: 1,
      rule: true,
      events: ["DrawNCards"],
      validateSave: () => undefined,
      effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
    });
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
    expect(f.game.cardZones.a.cards).toEqual([]);
  });
});
