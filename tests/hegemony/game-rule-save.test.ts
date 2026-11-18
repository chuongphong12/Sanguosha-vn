import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import { damageRule } from "../../src/game/hegemony/damage-rule";
import { createGeneralShownRule } from "../../src/game/hegemony/general-rule";
import { createGameOverJudgeRule } from "../../src/game/hegemony/victory";
import { createDrawPhaseOperation } from "../../src/game/hegemony/draw-phase";
import { createFreeChainOperation } from "../../src/game/hegemony/general-rewards";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import {
  continueTriggerWork,
  createTriggerScheduler,
  dispatchTriggerEvent,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  type TriggerData,
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
function fixture(budget = 1) {
  const original = drawingSetup();
  const game = {
    ...original.game,
    rewardFirstShow: false,
    scenarioPresent: false,
  };
  const rules: TriggerRegistry<typeof game> = original.rules;
  const f = { ...original, game, rules };
  f.rules.version = "game-rule-save-v1";
  f.rules.stepBudget = budget;
  f.rules.unwind = true;
  f.scheduler = createTriggerScheduler(f.game.seatOrder, f.rules.version);
  f.policy.notify = () => null;
  f.rules.validateEvent = (_game, event) => {
    if (!events.includes(event.name)) throw Error("Invalid fixture event");
  };
  f.rules.skills = [damageRule("EventPhaseProceeding", "draw-phase")];
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
        const data = operation.data;
        if (
          operation.name !== "kill-player" ||
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
  return f;
}
type Fixture = ReturnType<typeof fixture>;
function reload(f: Fixture) {
  const saved = JSON.parse(
    JSON.stringify({ game: f.game, scheduler: f.scheduler }),
  );
  const before = JSON.stringify(saved);
  f.scheduler = createTriggerSaveCodec(f.rules).read(
    saved.scheduler,
    saved.game,
  );
  f.game = saved.game;
  expect(JSON.stringify(saved)).toBe(before);
}
function start(
  f: Fixture,
  target: string | null = "a",
  data: TriggerData = null,
  name = "EventPhaseProceeding",
) {
  expect(
    dispatchTriggerEvent(
      f.scheduler,
      f.game,
      f.rules,
      { name, target, data },
      "a",
    ),
  ).toBe(true);
}
function finish(f: Fixture) {
  for (let step = 0; step < 500; step++) {
    reload(f);
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
  throw Error("Bridge did not finish");
}
function root(f: Fixture) {
  const frame = f.scheduler.frames[0];
  if (!frame || frame.kind !== "event") throw Error("Expected root event");
  return frame;
}
function seek(f: Fixture, result = false) {
  for (let step = 0; step < 500; step++) {
    if (
      result
        ? root(f).operationChild
        : f.scheduler.frames[1]?.kind === "operation"
    )
      return;
    reload(f);
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  }
  throw Error("Missing bridge child");
}
// A result-producing fixture isolates bridge projection; it is not the damage,
// reveal or winner owner. Actual Draw-owner composition is exercised separately.
function resultFixture(event: string, operation: string, value: TriggerData) {
  const f = fixture();
  f.rules.skills = [damageRule(event, operation)];
  f.rules.validateEvent = (_g, current) => {
    if (current.name !== event && current.name !== "DFDebut")
      throw Error("Invalid fixture event");
  };
  f.rules.operations = [
    {
      name: operation,
      validateSave: (_g, frame, _interruption, prompt, state) => {
        if (
          frame.continuation !== null ||
          frame.answer ||
          frame.child ||
          frame.operationChild ||
          prompt ||
          state?.child
        )
          throw Error("Invalid fixture producer");
      },
      // Any scheduler JSON result is intentional, to probe the bridge's own guard.
      validateResult: () => undefined,
      run: () => ({ kind: "return", value }),
    },
  ];
  return f;
}

const doneResults: Record<string, TriggerData>[] = [
  { data: { after: 3 } },
  { data: null, extra: true },
];
describe("actual GameRule bridge recovery", () => {
  it.each([1, 2, 7, 10000])(
    "restores actual Draw phase once at budget %i",
    (budget) => {
      const f = fixture(budget);
      start(f);
      finish(f);
      expect(f.scheduler.frames).toEqual([]);
      expect(f.scheduler.completion?.consumed).toBe(false);
      expect(f.game.cardZones.a.cards).toEqual([0, 1]);
      expect(f.game.cardZones.draw.cards).toEqual([
        2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      ]);
    },
  );
  it.each([null, "skip"])(
    "keeps null-target/SkipGameRule short circuits: %s",
    (mode) => {
      const f = fixture();
      f.game.cardResources.roomTags.SkipGameRule = true;
      start(f, mode === null ? null : "a");
      finish(f);
      expect(f.game.cardZones.a.cards).toEqual([]);
      expect(f.game.cardResources.roomTags.SkipGameRule).toBeUndefined();
      expect(f.scheduler.completion?.consumed).toBe(false);
    },
  );
  it("does not read a newly changed SkipGameRule on a retained child result", () => {
    const f = fixture();
    start(f);
    seek(f, true);
    f.game.cardResources.roomTags.SkipGameRule = "late-invalid";
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    expect(f.game.cardResources.roomTags.SkipGameRule).toBe("late-invalid");
  });
  it("compares captured JSON by value despite object key order", () => {
    const f = fixture();
    start(f, "a", { outer: { one: 1, two: [true, null] }, tail: 2 });
    seek(f);
    root(f).event.data = { tail: 2, outer: { two: [true, null], one: 1 } };
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });
  it.each([
    "cursor",
    "stage",
    "target",
    "name",
    "input",
    "extra",
    "payload",
    "answer",
    "child-result",
  ])("rejects corrupted bridge %s", (mutation) => {
    const f = fixture();
    start(f);
    seek(f);
    const frame = root(f),
      child = f.scheduler.frames[1];
    if (child.kind !== "operation") throw Error("Expected operation");
    if (mutation === "cursor") frame.continuation = true;
    if (mutation === "stage") frame.stage = "cost";
    if (mutation === "target") frame.event.target = null;
    if (mutation === "name") child.operation.name = "kill-player";
    if (mutation === "input") child.operation.data = null;
    if (mutation === "extra")
      child.operation.data = { target: "a", data: null, extra: 1 };
    if (mutation === "payload")
      child.operation.data = { target: "a", data: [1] };
    if (mutation === "answer") frame.answer = { choice: "go" };
    if (mutation === "child-result")
      frame.child = {
        event: { name: "DrawNCards", target: "a", data: 2 },
        consumed: false,
      };
    expect(() => reload(f)).toThrow();
  });
  it("validates retained operation identity before handing it to the rule", () => {
    const f = fixture();
    start(f);
    seek(f, true);
    root(f).operationChild!.operation.data = { target: "b", data: null };
    expect(() => reload(f)).toThrow("GameRule operation");
  });
  it("does not inspect another selected skill's cursor or prompt", () => {
    const f = fixture();
    f.rules.skills.unshift({
      id: "fixture-prompt",
      priority: 1,
      rule: true,
      events: ["EventPhaseProceeding", "ConfirmMoveCards"],
      validateSave: () => undefined,
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "prompt",
              actor: "a",
              choices: ["go"],
              canCancel: false,
              continuation: { paid: 1 },
            }
          : { kind: "done", value: false },
    });
    start(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });
  it("decodes an actual interrupted Draw descendant during abandonment", () => {
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
    expect(f.scheduler.interruption?.reason).toBe("turn-broken");
    if (!f.scheduler.interruption) throw Error("Expected interruption");
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
  it("keeps the GeneralShown wrapper's DFDebut no-operation branch", () => {
    const f = fixture();
    f.rules.skills = [createGeneralShownRule()];
    f.rules.operations = [];
    f.rules.validateEvent = (_g, event) => {
      if (event.name !== "DFDebut") throw Error("Invalid fixture event");
    };
    start(f, "a", null, "DFDebut");
    finish(f);
    expect(f.scheduler.completion?.consumed).toBe(false);
    expect(f.game.cardZones.a.cards).toEqual([]);
  });
  it.each(doneResults)(
    "projects the retained DamageDone result %j",
    (value) => {
      const f = resultFixture("DamageDone", "fixture-done", value);
      start(f, "a", { before: 2 }, "DamageDone");
      seek(f, true);
      finish(f);
      expect(f.scheduler.completion?.event.data).toEqual(value.data);
    },
  );
  it.each([null, false, [], { noData: 1 }])(
    "rejects malformed retained DamageDone result %j",
    (value) => {
      const f = resultFixture("DamageDone", "fixture-done", value);
      start(f, "a", { before: 2 }, "DamageDone");
      seek(f, true);
      expect(() => reload(f)).toThrow("DamageDone result");
    },
  );
  it.each([true, false])(
    "preserves GeneralShown/GameOverJudge wrapper boolean %s",
    (value) => {
      for (const [event, operation, skill] of [
        [
          "GeneralShown",
          "general-shown",
          createGeneralShownRule<Fixture["game"]>(),
        ],
        [
          "GameOverJudge",
          "game-over-judge",
          createGameOverJudgeRule<Fixture["game"]>(),
        ],
      ] as const) {
        const f = resultFixture(event, operation, value);
        f.rules.skills = [skill];
        start(f, "a", null, event);
        seek(f, true);
        finish(f);
        expect(f.scheduler.completion?.consumed).toBe(value);
      }
    },
  );
  it("rejects a forged queued operation in the DFDebut wrapper branch", () => {
    const f = resultFixture("GeneralShown", "general-shown", false);
    f.rules.skills = [createGeneralShownRule()];
    start(f, "a", null, "GeneralShown");
    seek(f);
    root(f).event.name = "DFDebut";
    expect(() => reload(f)).toThrow("GameRule operation");
  });
  it("rejects forged rule candidates before they can become player prompts", () => {
    const f = fixture();
    start(f);
    seek(f);
    const frame = root(f),
      selected = frame.selected!;
    const forged = {
      ...selected,
      actor: "a",
      owner: "a",
      slot: "head" as const,
    };
    forged.key = JSON.stringify([forged.skill, "a", "a", "head", "a", "rule"]);
    frame.candidates = [forged];
    frame.selected = forged;
    frame.consumed = [forged.key];
    frame.actor = frame.actors.indexOf("a");
    expect(() => reload(f)).toThrow("GameRule occurrence");
  });
  it("rejects a forged unselected target before a rule can execute twice", () => {
    const f = fixture();
    start(f);
    for (let step = 0; step < 100; step++) {
      const frame = root(f);
      if (
        frame.recorded &&
        frame.selected === null &&
        frame.candidates.length
      ) {
        const candidate = frame.candidates[0];
        candidate.target = "b";
        candidate.key = JSON.stringify([
          candidate.skill,
          null,
          null,
          null,
          "b",
          "rule",
        ]);
        expect(() => reload(f)).toThrow("GameRule occurrence");
        return;
      }
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    }
    throw Error("Missing unselected checkpoint");
  });
  it("allows another active skill to mutate the event target before reconciliation", () => {
    const f = fixture();
    f.rules.skills.unshift({
      id: "fixture-retarget",
      priority: 0,
      rule: true,
      events: ["EventPhaseProceeding"],
      validateSave: () => undefined,
      effect: ({ game, event, continuation }) => {
        if (continuation !== null || game.trace.includes("retargeted"))
          return { kind: "done", value: false };
        game.trace.push("retargeted");
        event.target = "b";
        return {
          kind: "prompt",
          actor: "a",
          choices: ["go"],
          canCancel: false,
          continuation: "retargeted",
        };
      },
    });
    start(f);
    finish(f);
    expect(f.scheduler.completion?.event.target).toBe("b");
    expect(f.game.cardZones.a.cards).toEqual([]);
    expect(f.game.cardZones.b.cards).toEqual([]);
  });
});
