import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import {
  createFreeChainOperation,
  type FreeChainRules,
} from "../../src/game/hegemony/general-rewards";
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
  "GeneralShowed",
  "BeforeGameOverJudge",
  "HpChanged",
  "GameOverJudge",
  "Death",
  "BuryVictim",
  "DeathFinished",
];
function fixture(save = true) {
  const f = drawingSetup();
  f.rules.version = save ? "free-save-v1" : "free-legacy-v1";
  f.rules.unwind = true;
  f.rules.stepBudget = 1;
  f.scheduler = createTriggerScheduler(f.game.seatOrder, f.rules.version);
  for (const player of f.game.seatOrder) {
    f.game.identities[player].headShown = true;
    f.game.identities[player].deputyShown = true;
  }
  f.game.playerMarks.a = {
    Global_GeneralShown: 1,
    Global_General2Shown: 1,
    Global_TheFirstToShowRewarded: 1,
    HaventShowGeneral: 1,
    HaventShowGeneral2: 1,
  };
  let kills = 0,
    pairs = 0,
    hp = 0;
  const rules: FreeChainRules<typeof f.game> = {
    kill: (target) => {
      kills++;
      return { name: "kill-player", data: { target, damage: null } };
    },
    companion: () => {
      pairs++;
      return true;
    },
    maxHp: (_game, _name, head) => {
      hp++;
      return head ? 3 : 4;
    },
    ...(save
      ? {
          validateKillSave: (
            target: string,
            operation: { name: string; data: TriggerData },
          ) => {
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
              throw Error("Invalid saved kill mapping");
          },
        }
      : {}),
  };
  f.rules.operations = f.rules.operations!.filter((op) =>
    ["kill-player", "game-over"].includes(op.name),
  );
  f.rules.operations.push(createFreeChainOperation(rules));
  f.rules.validateEvent = (_game, event) => {
    if (
      !events.includes(event.name) ||
      !event.target ||
      !f.game.seatOrder.includes(event.target)
    )
      throw Error("Invalid fixture event");
  };
  f.rules.skills = [
    {
      id: "fixture-observer",
      rule: true,
      priority: 0,
      events,
      validateSave: (_game, frame, prompt) => {
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
        return { kind: "done", value: false };
      },
    },
  ];
  return { ...f, calls: () => ({ kills, pairs, hp }) };
}
type Fixture = ReturnType<typeof fixture>;
function start(f: Fixture) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      { name: "free-chain", data: "ignored" },
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
  for (let step = 0; step < 700; step++) {
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
  throw Error("Drain did not finish");
}
describe("actual free-chain recovery", () => {
  it("decodes unstarted work emitted by an explicit fixture owner", () => {
    const f = fixture();
    f.rules.operations!.push({
      name: "fixture-owner",
      validateSave: (_g, frame) => {
        if (frame.continuation !== null && frame.continuation !== true)
          throw Error("Invalid fixture owner");
      },
      validateResult: (_g, result) => {
        if (result.value !== null) throw Error("Invalid owner result");
      },
      run: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: { name: "free-chain", data: null },
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
    expect(f.calls()).toEqual({ kills: 0, pairs: 0, hp: 0 });
    finish(f);
    expect(f.game.playerMarks.a["@firstshow"]).toBe(1);
  });

  it.each([2, 7, 10000])("restores valid boundaries at budget %i", (budget) => {
    const f = fixture();
    f.rules.stepBudget = budget;
    f.game.surrenderPlayer = "b";
    start(f);
    finish(f);
    expect(f.game.alive.b).toBe(false);
    expect(f.calls()).toEqual({ kills: 1, pairs: 1, hp: 2 });
  });

  it.each(["answer", "cleanup", "event-child-at-kill"])(
    "rejects an impossible %s boundary",
    (key) => {
      const f = fixture();
      if (key === "event-child-at-kill") f.game.surrenderPlayer = "b";
      start(f);
      const root = f.scheduler.frames[0];
      if (root.kind !== "operation") throw Error("Expected drain");
      if (key === "answer") root.answer = { choice: "go" };
      else if (key === "cleanup")
        root.cleanup = { normalContinuation: root.continuation };
      else
        root.child = {
          consumed: false,
          event: { name: "GeneralShowed", target: "a", data: ["head"] },
        };
      expect(() => reload(f)).toThrow();
    },
  );

  it("rejects a non-null retained result", () => {
    const f = fixture();
    start(f);
    finish(f);
    if (!f.scheduler.operationCompletion) throw Error("Expected result");
    f.scheduler.operationCompletion.value = true;
    expect(() => reload(f)).toThrow();
  });

  it("preserves legacy cursors without enabling save codecs implicitly", () => {
    const f = fixture(false);
    f.game.surrenderPlayer = "b";
    start(f);
    expect(Object.keys(cursor(f)).sort()).toEqual([
      "players",
      "shown",
      "stage",
      "target",
    ]);
    expect(() => createTriggerSaveCodec(f.rules)).toThrow(
      "operation codec coverage",
    );
    for (let step = 0; step < 500 && f.scheduler.yielded; step++)
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    expect(f.calls()).toEqual({ kills: 1, pairs: 1, hp: 2 });
    expect(f.game.alive.b).toBe(false);
  });

  it("keeps a captured surrender target when nested kill events change the next surrender", () => {
    const f = fixture();
    f.game.surrenderPlayer = "b";
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "HpChanged" && context.event.target === "b")
        context.game.surrenderPlayer = "c";
      return observe(context);
    };
    start(f);
    expect(cursor(f).killTarget).toBe("b");
    finish(f);
    expect(f.calls()).toEqual({ kills: 2, pairs: 1, hp: 2 });
    expect(f.game.livingPlayers).toEqual(["a"]);
    expect(f.game.hp.b).toBe(0);
    expect(f.game.hp.c).toBe(0);
  });

  it("preserves captured shown slots despite consumed and rewritten GeneralShowed data", () => {
    const f = fixture();
    f.game.playerMarks.a.Global_General2Shown = 0;
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (context.event.name === "GeneralShowed") {
        context.event.data = ["deputy"];
        observe(context);
        return { kind: "done", value: true };
      }
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.playerMarks.a.HaventShowGeneral).toBe(0);
    expect(f.game.playerMarks.a.HaventShowGeneral2).toBe(1);
    expect(f.game.playerMarks.a["@firstshow"]).toBe(1);
  });

  it("restarts the queue after a nested actual free-chain drain", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (
        context.event.name === "GeneralShowed" &&
        context.event.target === "a" &&
        context.continuation === null &&
        !context.game.trace.includes("nested")
      ) {
        context.game.trace.push("nested");
        context.game.playerMarks.b.Global_GeneralShown = 1;
        return {
          kind: "operation",
          operation: { name: "free-chain", data: null },
          continuation: true,
        };
      }
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.playerMarks.a["@companion"]).toBe(1);
    expect(f.game.playerMarks.b["@companion"]).toBe(1);
    expect(f.calls()).toEqual({ kills: 0, pairs: 2, hp: 4 });
  });

  it("drains requeued marks without paying all-shown rewards twice", () => {
    const f = fixture();
    f.game.playerMarks.a.Global_General2Shown = 0;
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) => {
      if (
        context.event.name === "GeneralShowed" &&
        !context.game.trace.includes("requeued")
      ) {
        context.game.trace.push("requeued");
        context.game.playerMarks.a.Global_General2Shown = 1;
      }
      return observe(context);
    };
    start(f);
    finish(f);
    expect(f.game.playerMarks.a).toMatchObject({
      HaventShowGeneral: 0,
      HaventShowGeneral2: 0,
      "@firstshow": 1,
      "@companion": 1,
    });
    expect(f.calls()).toEqual({ kills: 0, pairs: 1, hp: 2 });
  });

  it("resumes a reveal prompt without paying predicates early", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) =>
      context.event.name === "GeneralShowed" && context.continuation === null
        ? {
            kind: "prompt",
            actor: "a",
            choices: ["go"],
            canCancel: false,
            continuation: true,
          }
        : observe(context);
    start(f);
    finish(f);
    expect(f.calls()).toEqual({ kills: 0, pairs: 1, hp: 2 });
  });

  it("allows a recipient killed by a GeneralShowed child and still follows native mark gates", () => {
    const f = fixture();
    const observe = f.rules.skills[0].effect;
    f.rules.skills[0].effect = (context) =>
      context.event.name === "GeneralShowed" && context.continuation === null
        ? {
            kind: "operation",
            operation: {
              name: "kill-player",
              data: { target: "a", damage: null },
            },
            continuation: true,
          }
        : observe(context);
    start(f);
    finish(f);
    expect(f.game.alive.a).toBe(false);
    expect(f.game.playerMarks.a["@firstshow"]).toBe(1);
    expect(f.calls()).toEqual({ kills: 0, pairs: 0, hp: 0 });
  });

  it.each(["empty", "dead", "dead-surrender"])(
    "preserves the %s no-award path",
    (kind) => {
      const f = fixture();
      if (kind === "empty") f.game.playerMarks.a = {};
      else f.game.alive.a = false;
      if (kind === "dead-surrender") f.game.surrenderPlayer = "a";
      start(f);
      finish(f);
      expect(f.calls()).toEqual({ kills: 0, pairs: 0, hp: 0 });
      if (kind !== "empty")
        expect(f.game.playerMarks.a.Global_GeneralShown).toBe(0);
    },
  );

  it.each(["reveal", "kill"])(
    "decodes %s interruption/unwind without manufactured rewards",
    (branch) => {
      const f = fixture();
      if (branch === "kill") f.game.surrenderPlayer = "b";
      f.rules.skills[0].effect = ({ event }) =>
        event.name === (branch === "kill" ? "GameOverJudge" : "GeneralShowed")
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
      expect(f.calls().pairs).toBe(0);
      expect(f.calls().hp).toBe(0);
    },
  );

  it.each([
    "stage",
    "roster",
    "target",
    "slots",
    "extra",
    "missing",
    "event-name",
    "event-target",
  ])("rejects a forged reveal %s", (key) => {
    const f = fixture();
    start(f);
    const c = cursor(f);
    if (key === "stage") c.stage = "begin";
    else if (key === "roster") c.players = ["b", "a", "c"];
    else if (key === "target") c.target = "b";
    else if (key === "slots") c.shown = ["deputy", "head"];
    else if (key === "extra") c.killTarget = "b";
    else if (key === "missing") f.scheduler.frames.pop();
    else {
      const child = f.scheduler.frames[1];
      if (child.kind !== "event") throw Error("Expected reveal");
      if (key === "event-name") child.event.name = "Death";
      else child.event.target = "b";
    }
    const before = JSON.stringify(f);
    expect(() => reload(f)).toThrow();
    expect(JSON.stringify(f)).toBe(before);
  });

  it.each([
    "missing-target",
    "wrong-target",
    "mapper-target",
    "mapper-damage",
    "mapper-name",
  ])("rejects a forged surrender %s", (key) => {
    const f = fixture();
    f.game.surrenderPlayer = "b";
    start(f);
    const c = cursor(f);
    if (key === "missing-target") delete c.killTarget;
    else if (key === "wrong-target") c.killTarget = "a";
    else {
      const child = f.scheduler.frames[1];
      if (
        child.kind !== "operation" ||
        !child.operation.data ||
        typeof child.operation.data !== "object" ||
        Array.isArray(child.operation.data)
      )
        throw Error("Expected kill");
      if (key === "mapper-name") child.operation.name = "game-over";
      else if (key === "mapper-target") child.operation.data.target = "a";
      else child.operation.data.damage = {};
    }
    expect(() => reload(f)).toThrow();
  });
  it("does not award or invoke predicates during read, then grants each reward once", () => {
    const f = fixture();
    start(f);
    reload(f);
    expect(f.calls()).toEqual({ kills: 0, pairs: 0, hp: 0 });
    finish(f);
    expect(f.calls()).toEqual({ kills: 0, pairs: 1, hp: 2 });
    expect(f.game.playerMarks.a).toMatchObject({
      "@firstshow": 1,
      "@companion": 1,
      "@halfmaxhp": 1,
      Global_GeneralShown: 0,
      Global_General2Shown: 0,
      HaventShowGeneral: 0,
      HaventShowGeneral2: 0,
    });
  });
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
    throw Error("Expected drain cursor");
  return c;
}
