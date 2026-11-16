import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
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
  "BeforeGameOverJudge",
  "HpChanged",
  "GameOverJudge",
  "Death",
  "BuryVictim",
  "DeathFinished",
];
function fixture(stepBudget = 1, promptAt = "") {
  const f = drawingSetup();
  f.game.currentPlayer = "c";
  f.game.hp.b = -3;
  f.game.acquiredSkills.b = {
    head: ["borrowed-head"],
    deputy: ["borrowed-deputy"],
  };
  f.game.playerFlags.b = ["keep"];
  f.game.playerHistory.b = { Slash: 2 };
  f.rules.version = "kill-save-v1";
  f.rules.stepBudget = stepBudget;
  f.rules.unwind = true;
  f.rules.operations = f.rules.operations!.filter((op) =>
    ["kill-player", "game-over"].includes(op.name),
  );
  f.scheduler = createTriggerScheduler(f.game.seatOrder, f.rules.version);
  f.rules.validateEvent = (_game, event) => {
    if (
      !events.includes(event.name) ||
      !event.target ||
      !f.game.seatOrder.includes(event.target)
    )
      throw Error("Invalid fixture death event");
  };
  f.rules.skills = [
    {
      id: "fixture-observer",
      rule: true,
      priority: 0,
      events,
      validateSave: (_game, frame, prompt) => {
        if (frame.continuation !== null && frame.continuation !== true)
          throw Error("Invalid observer cursor");
        if (
          prompt &&
          (prompt.actor !== frame.event.target ||
            prompt.canCancel ||
            prompt.choices.length !== 1 ||
            prompt.choices[0].id !== "go")
        )
          throw Error("Invalid observer prompt");
      },
      effect: ({ game, event, continuation }) => {
        if (continuation === null)
          game.trace.push({ ...structuredClone(event) });
        return event.name === promptAt && continuation === null
          ? {
              kind: "prompt",
              actor: event.target!,
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
function start(f: Fixture, data: TriggerData = { target: "b", damage: null }) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      { name: "kill-player", data },
      "a",
    ),
  ).toBe(true);
}
function reload(f: Fixture) {
  const candidate = JSON.parse(
      JSON.stringify({ game: f.game, scheduler: f.scheduler }),
    ),
    before = JSON.stringify(candidate);
  f.scheduler = createTriggerSaveCodec(f.rules).read(
    candidate.scheduler,
    candidate.game,
  );
  f.game = candidate.game;
  expect(JSON.stringify(candidate)).toBe(before);
}
function finish(f: Fixture) {
  for (let step = 0; step < 600; step++) {
    reload(f);
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
  throw Error("Death did not finish");
}
describe("actual kill-player save codec", () => {
  it("decodes an unstarted actual kill child without performing eager death work", () => {
    const f = fixture();
    f.rules.operations!.push({
      name: "fixture-owner",
      validateSave: (_g, frame) => {
        if (
          frame.operation.data !== null ||
          (frame.continuation !== null && frame.continuation !== true)
        )
          throw Error("Invalid fixture owner");
      },
      validateResult: (_g, result) => {
        if (result.value !== null) throw Error("Invalid fixture result");
      },
      run: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "kill-player",
                data: { target: "b", damage: null },
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
    expect(f.game.alive.b).toBe(true);
    expect(f.game.seats.c).toBe(3);
    finish(f);
    expect(f.game.alive.b).toBe(false);
    expect(f.game.seats.c).toBe(2);
  });

  it("validates a real normalized damage packet across death checkpoints", () => {
    const f = fixture();
    start(f, {
      target: "b",
      damage: {
        from: "a",
        to: "b",
        card: null,
        damage: 1,
        nature: "fire",
        chain: false,
        transfer: false,
        by_user: true,
        reason: "test",
        flags: ["kept"],
        transfer_reason: "",
        prevented: false,
      },
    });
    finish(f);
    expect(f.game.trace[0]).toMatchObject({
      name: "BeforeGameOverJudge",
      data: {
        who: "b",
        damage: { from: "a", nature: "fire", flags: ["kept"] },
      },
    });
  });

  it.each(["request", "result", "answer", "cleanup"])(
    "rejects malformed retained %s",
    (key) => {
      const f = fixture();
      start(f);
      const frame = f.scheduler.frames[0];
      if (frame.kind !== "operation") throw Error("Expected root");
      if (key === "request") frame.operation.data = { target: "b", damage: {} };
      else if (key === "answer") frame.answer = { choice: "go" };
      else if (key === "cleanup")
        frame.cleanup = { normalContinuation: frame.continuation };
      else {
        finish(f);
        if (!f.scheduler.operationCompletion) throw Error("Expected result");
        f.scheduler.operationCompletion.value = true;
      }
      expect(() => reload(f)).toThrow();
    },
  );

  it.each(["death", "finished"])(
    "rejects an out-of-range %s notification index",
    (stage) => {
      const f = fixture();
      start(f);
      for (let step = 0; step < 300 && cursor(f).stage !== stage; step++) {
        reload(f);
        expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
      }
      const c = cursor(f);
      expect(c.stage).toBe(stage);
      c.index = 99;
      expect(() => reload(f)).toThrow();
    },
  );

  it.each(events)(
    "restores prompts during %s without repeating eager work",
    (name) => {
      const f = fixture(1, name);
      start(f);
      finish(f);
      expect(f.game.trace).toHaveLength(10);
      expect(f.game.seats.c).toBe(2);
      expect(f.game.acquiredSkills.b).toEqual({ head: [], deputy: [] });
    },
  );

  it("propagates Before payload rewrites but does not redirect HP or adopt HpChanged data", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "BeforeGameOverJudge")
        context.event.data = { who: "a", damage: null };
      if (context.event.name === "HpChanged")
        context.event.data = { who: "c", damage: null };
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.hp.b).toBe(0);
    expect(f.game.hp.a).toBe(4);
    const judge = f.game.trace.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry) &&
        entry.name === "GameOverJudge",
    );
    expect(judge).toMatchObject({ target: "b", data: { who: "a" } });
  });

  it("accepts re-ordered initial JSON payload keys", () => {
    const f = fixture();
    start(f);
    cursor(f).shared = { damage: null, who: "b" };
    finish(f);
    expect(f.game.hp.b).toBe(0);
  });

  it("keeps the original roster across nested actual kills", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      const { game, event, continuation } = context;
      if (
        event.name === "Death" &&
        event.target === "a" &&
        continuation === null &&
        !game.trace.includes("nested")
      ) {
        game.trace.push("nested", { ...structuredClone(event) });
        return {
          kind: "operation",
          operation: {
            name: "kill-player",
            data: { target: "a", damage: null },
          },
          continuation: true,
        };
      }
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.livingPlayers).toEqual(["c"]);
    expect(f.game.seats.c).toBe(1);
    expect(f.game.acquiredSkills.a).toEqual({ head: [], deputy: [] });
    expect(f.game.acquiredSkills.b).toEqual({ head: [], deputy: [] });
    expect(targets(f, "DeathFinished", "b")).toEqual(["c", "b"]);
  });

  it("allows revival and post-burial skill changes without replaying the earlier clears", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "HpChanged") {
        context.game.alive.b = true;
        context.game.hp.b = 2;
        context.game.livingPlayers.push("b");
        context.game.seats.b = 3;
      }
      if (context.event.name === "BuryVictim")
        context.game.acquiredSkills.b.head.push("new-skill");
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.alive.b).toBe(true);
    expect(f.game.hp.b).toBe(2);
    expect(f.game.acquiredSkills.b).toEqual({
      head: ["new-skill"],
      deputy: [],
    });
  });

  it("does not repeat signed seat validation after a dead-victim decrement reaches int32 minimum", () => {
    const f = fixture();
    f.game.alive.b = false;
    f.game.livingPlayers = ["a", "c"];
    f.game.seats.c = -2147483647;
    start(f);
    finish(f);
    expect(f.game.seats).toEqual({ a: 0, b: 2, c: -2147483648 });
    expect(targets(f, "Death", "b")).toEqual(["c", "a"]);
  });

  it("preserves null-current registration order while skipping currently dead recipients", () => {
    const f = fixture();
    f.game.currentPlayer = null;
    f.game.alive.c = false;
    f.game.livingPlayers = ["a", "b"];
    start(f);
    finish(f);
    expect(targets(f, "Death", "b")).toEqual(["a", "b"]);
  });

  it("accepts an empty captured roster on a repeated dead-victim path", () => {
    const f = fixture();
    f.game.alive = { a: false, b: false, c: false };
    f.game.livingPlayers = [];
    start(f);
    finish(f);
    expect(targets(f, "Death", "b")).toEqual([]);
    expect(f.game.hp.b).toBe(0);
  });

  it("preserves a terminal GameOverJudge interruption before skill clearing", () => {
    const f = fixture();
    f.rules.skills[0].effect = ({ event, continuation }) =>
      event.name === "GameOverJudge" && continuation === null
        ? {
            kind: "operation",
            operation: { name: "game-over", data: "wei" },
            continuation: true,
          }
        : { kind: "done", value: false };
    start(f);
    finish(f);
    expect(f.game.gameResult).toBe("wei");
    expect(f.game.acquiredSkills.b.head).toEqual(["borrowed-head"]);
    if (!f.scheduler.interruption) throw Error("Expected game over");
    expect(
      unwindTriggerInterruption(
        f.scheduler,
        f.game,
        f.rules,
        f.scheduler.interruption,
      ),
    ).toBe(true);
    for (let step = 0; step < 30 && !f.scheduler.unwindCompletion; step++) {
      reload(f);
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    }
    reload(f);
    expect(f.scheduler.unwindCompletion?.reason).toBe("game-over");
    expect(f.game.acquiredSkills.b.head).toEqual(["borrowed-head"]);
  });

  it.each([
    "stage",
    "target",
    "index",
    "roster",
    "order",
    "payload",
    "missing-child",
    "child-name",
    "child-target",
  ])("rejects a forged %s save without changing it", (key) => {
    const f = fixture();
    start(f);
    const c = cursor(f);
    if (key === "stage") c.stage = "done";
    else if (key === "target") c.target = "a";
    else if (key === "index") c.index = 1;
    else if (key === "roster") c.players = ["a", "a"];
    else if (key === "order") c.players = ["c", "b", "a"];
    else if (key === "payload") c.shared = { who: "a", damage: null };
    else if (key === "missing-child") f.scheduler.frames.pop();
    else {
      const child = f.scheduler.frames[1];
      if (child.kind !== "event") throw Error("Expected event child");
      if (key === "child-name") child.event.name = "HpChanged";
      else child.event.target = "a";
    }
    const before = JSON.stringify(f);
    expect(() => reload(f)).toThrow();
    expect(JSON.stringify(f)).toBe(before);
  });

  it.each([1, 2, 7, 10000])(
    "does not repeat eager death changes at budget %i",
    (budget) => {
      const f = fixture(budget);
      start(f);
      finish(f);
      expect(f.game.alive.b).toBe(false);
      expect(f.game.hp.b).toBe(0);
      expect(f.game.livingPlayers).toEqual(["a", "c"]);
      expect(f.game.seats).toEqual({ a: 1, b: 2, c: 2 });
      expect(f.game.acquiredSkills.b).toEqual({ head: [], deputy: [] });
      expect(f.game.playerFlags.b).toEqual(["keep"]);
      expect(f.game.playerHistory.b).toEqual({ Slash: 2 });
      expect(f.game.trace).toHaveLength(10);
      expect(f.scheduler.operationCompletion?.value).toBe(null);
    },
  );
});

function cursor(f: Fixture) {
  const frame = f.scheduler.frames[0],
    c = frame.continuation;
  if (
    frame.kind !== "operation" ||
    !c ||
    typeof c !== "object" ||
    Array.isArray(c)
  )
    throw Error("Expected kill cursor");
  return c;
}
function targets(f: Fixture, name: string, who: string) {
  return f.game.trace.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      Array.isArray(entry) ||
      entry.name !== name ||
      !entry.data ||
      typeof entry.data !== "object" ||
      Array.isArray(entry.data) ||
      entry.data.who !== who
    )
      return [];
    return [entry.target];
  });
}
