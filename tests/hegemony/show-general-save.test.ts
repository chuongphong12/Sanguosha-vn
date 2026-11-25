import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import {
  createShowGeneralOperation,
  type GeneralRules,
} from "../../src/game/hegemony/general";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import { createAskGeneralShowOperation } from "../../src/game/hegemony/ask-general-show";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import {
  continueTriggerWork,
  createTriggerScheduler,
  dispatchTriggerOperation,
  dispatchTriggerEvent,
  unwindTriggerInterruption,
  resumeTriggerPrompt,
  type TriggerRegistry,
  type TriggerData,
  type TriggerInterruption,
} from "../../src/game/hegemony/scheduler";

function fixture(budget = 1, saving = true) {
  const calls = { policy: 0, mapping: 0 };
  const mapped = (target: string, label: string) => {
    calls.mapping++;
    return { name: "fixture-adapter", data: { target, label } };
  };
  const game = {
    ...drawingSetup().game,
    interruptAt: "",
    rewrite: false,
    allowed: true,
    reason: "turn-broken" as TriggerInterruption["reason"],
    phaseQueues: {
      a: { phases: [], states: [], index: 0 },
      b: { phases: [], states: [], index: 0 },
      c: { phases: [], states: [], index: 0 },
    },
  };
  game.displayedGenerals.a = { head: "anjiang", deputy: "anjiang" };
  const adapters: GeneralRules<typeof game> = {
    canShow: (g) => {
      calls.policy++;
      return g.allowed;
    },
    preshow: (target, head, enabled) =>
      mapped(target, `preshow:${head}:${enabled}`),
    change: (target, head, name) => mapped(target, `change:${head}:${name}`),
    skills: (target, head, shown) => mapped(target, `skills:${head}:${shown}`),
    notify: (target, head, shown, sendLog) =>
      mapped(target, `notify:${head}:${shown}:${sendLog}`),
    filter: (target) => mapped(target, "filter"),
  };
  const rules: TriggerRegistry<typeof game> = {
    version: saving ? "show-general-save-v1" : "show-general-legacy",
    stepBudget: budget,
    unwind: true,
    validateEvent: (_g, e) => {
      if (
        ![
          "GeneralShown",
          "DFDebut",
          "ChoiceMade",
          "EventPhaseProceeding",
        ].includes(e.name)
      )
        throw Error("Invalid fixture event");
    },
    skills: [
      {
        id: "fixture-event-observer",
        priority: 1,
        rule: true,
        events: ["GeneralShown", "DFDebut", "ChoiceMade"],
        validateSave: (_g, frame) => {
          if (frame.continuation !== null && frame.continuation !== true)
            throw Error("Invalid observer cursor");
        },
        effect: ({ game, event, continuation }) => {
          if (continuation === null) {
            game.trace.push({
              event: event.name,
              target: event.target,
              data: structuredClone(event.data),
            });
            if (game.interruptAt === "event")
              return { kind: "interrupt", reason: game.reason };
            if (game.rewrite) event.data = "rewritten";
            return {
              kind: "prompt",
              actor: "b",
              choices: ["ack"],
              canCancel: false,
              continuation: true,
            };
          }
          return { kind: "done", value: game.rewrite };
        },
      },
    ],
    operations: [
      createShowGeneralOperation({
        ...adapters,
        ...(saving
          ? {
              saveShow: {
                validateChild: (c, op) => {
                  const label =
                    c.stage === "preshown"
                      ? `preshow:${c.head}:true`
                      : c.stage === "changed"
                        ? `change:${c.head}:${c.name}`
                        : c.stage === "skills"
                          ? `skills:${c.head}:true`
                          : c.stage === "notified"
                            ? `notify:${c.head}:true:${c.sendLog}`
                            : "filter";
                  if (
                    JSON.stringify(op) !==
                    JSON.stringify({
                      name: "fixture-adapter",
                      data: { target: c.target, label },
                    })
                  )
                    throw Error("Invalid fixture mapping");
                },
              },
            }
          : {}),
      }),
      // Package/presentation child only; the parent identity lifecycle is real.
      {
        name: "fixture-adapter",
        validateSave: (_g, frame) => {
          if (frame.continuation !== null && frame.continuation !== true)
            throw Error("Invalid fixture continuation");
        },
        validateResult: (_g, result) => {
          if (result.value !== null) throw Error("Invalid fixture result");
        },
        run: ({ game, operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          game.trace.push(structuredClone(operation.data));
          if (
            operation.data &&
            typeof operation.data === "object" &&
            !Array.isArray(operation.data) &&
            operation.data.label === game.interruptAt
          )
            return { kind: "interrupt", reason: game.reason };
          return {
            kind: "prompt",
            actor: "b",
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
    adapters,
    calls,
    scheduler: createTriggerScheduler(game.seatOrder, rules.version),
  };
}
type Fixture = ReturnType<typeof fixture>;
function reload(f: Fixture) {
  const saved = JSON.parse(
    JSON.stringify({ game: f.game, scheduler: f.scheduler }),
  );
  const before = JSON.stringify(saved);
  const calls = structuredClone(f.calls);
  f.scheduler = createTriggerSaveCodec(f.rules).read(
    saved.scheduler,
    saved.game,
  );
  f.game = saved.game;
  expect(JSON.stringify(saved)).toBe(before);
  expect(f.calls).toEqual(calls);
}
function advance(f: Fixture, choice = "ack") {
  const p = f.scheduler.prompt;
  if (p)
    expect(
      resumeTriggerPrompt(f.scheduler, f.game, f.rules, p.actor, {
        id: p.id,
        choice,
      }),
    ).toBe(true);
  else if (f.scheduler.yielded)
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  else throw Error("No pending work");
}
function finish(f: Fixture, decode = true) {
  for (let step = 0; step < 200; step++) {
    if (decode) reload(f);
    if (f.scheduler.prompt || f.scheduler.yielded) advance(f);
    else return;
  }
  throw Error("Show did not finish");
}
function start(f: Fixture, data: TriggerData = { target: "a" }) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      { name: "show-general", data },
      "a",
    ),
  ).toBe(true);
}
function owner(f: Fixture) {
  const frame = f.scheduler.frames.find(
    (f) => f.kind === "operation" && f.operation.name === "show-general",
  );
  if (!frame || frame.kind !== "operation") throw Error("Missing show owner");
  return frame;
}
function cursor(f: Fixture) {
  const c = owner(f).continuation;
  if (!c || typeof c !== "object" || Array.isArray(c))
    throw Error("Missing show cursor");
  return c;
}
function seek(f: Fixture, stage: string, retained = false) {
  for (let step = 0; step < 200; step++) {
    const o = owner(f),
      c = o.continuation;
    if (
      c &&
      typeof c === "object" &&
      !Array.isArray(c) &&
      c.stage === stage &&
      (!retained || o.child || o.operationChild)
    )
      return;
    reload(f);
    advance(f);
  }
  throw Error("Missing show boundary");
}

describe("actual show-general recovery", () => {
  it("restores actual head identity lifecycle exactly once with fixture package children", () => {
    const f = fixture();
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.rules,
        { name: "show-general", data: { target: "a" } },
        "a",
      ),
    ).toBe(true);
    finish(f);
    expect(f.game.displayedGenerals.a).toEqual({
      head: "a-head",
      deputy: "anjiang",
    });
    expect(f.game.identities.a.headShown).toBe(true);
    expect(f.game.scenarioRoleShown.a).toBe(true);
    expect(f.game.trace).toEqual([
      { target: "a", label: "preshow:true:true" },
      { target: "a", label: "change:true:a-head" },
      { target: "a", label: "skills:true:true" },
      { target: "a", label: "notify:true:true:true" },
      { event: "GeneralShown", target: "a", data: true },
      { target: "a", label: "filter" },
    ]);
    expect(f.scheduler.frames).toEqual([]);
  });

  it.each([1, 2, 7, 10000])(
    "restores deputy with DFDebut and no log at budget %i",
    (budget) => {
      const f = fixture(budget);
      start(f, {
        target: "a",
        head: false,
        triggerEvent: false,
        sendLog: false,
        ignoreRule: false,
      });
      finish(f);
      expect(f.game.displayedGenerals.a).toEqual({
        head: "anjiang",
        deputy: "a-deputy",
      });
      expect(f.game.identities.a).toMatchObject({
        headShown: false,
        deputyShown: true,
      });
      expect(f.game.trace).toEqual([
        { target: "a", label: "preshow:false:true" },
        { target: "a", label: "change:false:a-deputy" },
        { target: "a", label: "skills:false:true" },
        { target: "a", label: "notify:false:true:false" },
        { event: "DFDebut", target: "a", data: null },
        { target: "a", label: "filter" },
      ]);
    },
  );
  it.each(["preshown", "changed", "skills", "notified", "event", "filtered"])(
    "accepts queued and retained child at %s without replay",
    (stage) => {
      const f = fixture();
      start(f);
      seek(f, stage);
      reload(f);
      seek(f, stage, true);
      reload(f);
      finish(f);
      expect(f.game.trace).toHaveLength(6);
    },
  );
  it.each([
    "extra",
    "target",
    "head",
    "triggerEvent",
    "sendLog",
    "ignoreRule",
    "first",
    "name",
    "stage",
    "missing",
  ])("rejects corrupted cursor %s", (field) => {
    const f = fixture();
    start(f);
    seek(f, "preshown");
    const c = cursor(f);
    if (field === "extra") c.extra = true;
    else if (field === "target") c.target = "b";
    else if (["head", "triggerEvent", "sendLog", "ignoreRule"].includes(field))
      c[field] = false;
    else if (field === "first") c.first = "true";
    else if (field === "name") c.name = "missing-general";
    else if (field === "stage") c.stage = "finished";
    else delete c.name;
    expect(() => reload(f)).toThrow();
  });
  it.each(["preshown", "changed", "skills", "notified", "event", "filtered"])(
    "rejects missing live child at %s",
    (stage) => {
      const f = fixture();
      start(f);
      seek(f, stage);
      f.scheduler.frames.splice(f.scheduler.frames.indexOf(owner(f)) + 1);
      owner(f).child = null;
      owner(f).operationChild = null;
      f.scheduler.prompt = null;
      f.scheduler.yielded = true;
      expect(() => reload(f)).toThrow();
    },
  );
  it.each(["preshown", "changed", "skills", "notified", "filtered"])(
    "rejects altered mapped operation at %s",
    (stage) => {
      const f = fixture();
      start(f);
      seek(f, stage);
      const child =
        f.scheduler.frames[f.scheduler.frames.indexOf(owner(f)) + 1];
      if (child.kind !== "operation") throw Error("Missing child");
      child.operation.data = { target: "b", label: "forged" };
      expect(() => reload(f)).toThrow("mapping");
    },
  );
  it.each(["name", "target"])("rejects altered event %s", (field) => {
    const f = fixture();
    start(f);
    seek(f, "event");
    const child = f.scheduler.frames[f.scheduler.frames.indexOf(owner(f)) + 1];
    if (child.kind !== "event") throw Error("Missing event");
    if (field === "name") child.event.name = "DFDebut";
    else child.event.target = "b";
    expect(() => reload(f)).toThrow("show-general event");
  });
  it("accepts event payload rewrites and consumption without repeating identity changes", () => {
    const f = fixture();
    f.game.rewrite = true;
    start(f);
    seek(f, "event", true);
    expect(owner(f).child?.event.data).toBe("rewritten");
    reload(f);
    finish(f);
    expect(f.game.trace).toHaveLength(6);
    expect(f.game.identities.a.headShown).toBe(true);
  });
  it("uses captured name and first status after mutable state changes, without live policy calls on read", () => {
    const f = fixture();
    start(f);
    seek(f, "preshown");
    f.game.generalNames.a = ["b-head", "b-deputy"];
    f.game.identities.a.deputyShown = true;
    f.game.allowed = false;
    f.game.scenarioRoleShown.a = true;
    f.game.identities.b.headShown = true;
    f.game.scenarioRoleShown.b = true;
    reload(f);
    finish(f);
    expect(f.game.displayedGenerals.a.head).toBe("a-head");
    expect(f.game.identities.a.role).toBe("careerist");
    expect(f.game.trace[1]).toEqual({
      target: "a",
      label: "change:true:a-head",
    });
  });
  it.each(["empty", "shown", "denied"])(
    "restores early completion %s",
    (path) => {
      const f = fixture();
      if (path === "empty") f.game.generalNames.a = [];
      if (path === "shown") f.game.displayedGenerals.a.head = "a-head";
      if (path === "denied") f.game.allowed = false;
      start(f, { target: "a", ignoreRule: false });
      finish(f);
      expect(f.game.trace).toEqual([]);
      expect(f.scheduler.operationCompletion?.value).toBe(null);
    },
  );
  it("rejects forged root results", () => {
    const f = fixture();
    start(f);
    finish(f);
    f.scheduler.operationCompletion!.value = true;
    expect(() => reload(f)).toThrow("show-general result");
  });
  it.each(["null", "array", "validator"])(
    "rejects invalid opt-in contract %s",
    (kind) => {
      const f = fixture();
      Object.assign(f.adapters, {
        saveShow:
          kind === "null"
            ? null
            : kind === "array"
              ? []
              : { validateChild: true },
      });
      expect(() => createShowGeneralOperation(f.adapters)).toThrow(
        "save rules",
      );
    },
  );
  it.each(["target", "flag"])("rejects invalid unstarted input %s", (kind) => {
    const f = fixture();
    start(f);
    const d = owner(f).operation.data;
    if (!d || typeof d !== "object" || Array.isArray(d))
      throw Error("Expected input");
    if (kind === "target") d.target = "missing";
    else d.head = "true";
    expect(() => reload(f)).toThrow();
  });
  it("rejects a child before its owner has started", () => {
    const f = fixture();
    start(f);
    seek(f, "preshown");
    owner(f).continuation = null;
    expect(() => reload(f)).toThrow();
  });
  it.each(["answer", "cleanup"])("rejects unsupported owned %s", (field) => {
    const f = fixture();
    start(f);
    seek(f, "preshown");
    if (field === "answer") owner(f).answer = { choice: "ack" };
    else
      owner(f).cleanup = {
        normalContinuation: owner(f).continuation,
      };
    expect(() => reload(f)).toThrow();
  });
  it("rejects a forged retained child result", () => {
    const f = fixture();
    start(f);
    seek(f, "changed", true);
    owner(f).operationChild!.value = true;
    expect(() => reload(f)).toThrow("fixture result");
  });
  it("routes nested replies to their actual responder and rejects stale/unoffered replies without mutation", () => {
    const f = fixture();
    start(f);
    while (!f.scheduler.prompt) advance(f);
    const p = f.scheduler.prompt;
    const before = JSON.stringify({ scheduler: f.scheduler, game: f.game });
    for (const [actor, id, choice] of [
      ["a", p.id, "ack"],
      ["b", `${p.id}-stale`, "ack"],
      ["b", p.id, "invalid"],
    ]) {
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.rules, actor, {
          id,
          choice,
        }),
      ).toBe(false);
      expect(JSON.stringify({ scheduler: f.scheduler, game: f.game })).toBe(
        before,
      );
    }
    finish(f);
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "restores abandonment at every child for %s",
    (reason) => {
      for (const interruptAt of [
        "preshow:true:true",
        "change:true:a-head",
        "skills:true:true",
        "notify:true:true:true",
        "event",
        "filter",
      ]) {
        const f = fixture();
        f.game.reason = reason;
        f.game.interruptAt = interruptAt;
        start(f);
        for (let step = 0; !f.scheduler.interruption && step < 200; step++) {
          reload(f);
          advance(f);
        }
        expect(f.scheduler.interruption?.reason).toBe(reason);
        for (let step = 0; f.scheduler.frames.length && step < 200; step++) {
          reload(f);
          if (f.scheduler.interruption)
            expect(
              unwindTriggerInterruption(
                f.scheduler,
                f.game,
                f.rules,
                f.scheduler.interruption,
              ),
            ).toBe(true);
          else
            expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(
              true,
            );
        }
        reload(f);
        expect(f.scheduler.frames).toEqual([]);
        expect(
          f.game.trace.filter(
            (t) =>
              t &&
              typeof t === "object" &&
              !Array.isArray(t) &&
              t.label === interruptAt,
          ),
        ).toHaveLength(interruptAt === "event" ? 0 : 1);
      }
    },
  );
  it.each([true, false])(
    "preserves legacy runtime and cursor format for head=%s",
    (head) => {
      const legacy = fixture(1, false),
        saved = fixture();
      start(legacy, { target: "a", head });
      start(saved, { target: "a", head });
      expect(() => createTriggerSaveCodec(legacy.rules)).toThrow("coverage");
      for (let step = 0; step < 200; step++) {
        const a = { ...legacy.scheduler, registryVersion: "compare" },
          b = { ...saved.scheduler, registryVersion: "compare" };
        expect(a).toEqual(b);
        expect(legacy.game).toEqual(saved.game);
        reload(saved);
        if (!legacy.scheduler.prompt && !legacy.scheduler.yielded) break;
        advance(legacy);
        advance(saved);
      }
      expect(saved.scheduler.frames).toEqual([]);
    },
  );
  it("composes real Proceeding/RoundStart/question/ChoiceMade/show-general for both slots", () => {
    const f = fixture();
    f.game.playerPhases.a = "round-start";
    f.rules.skills.push(createPhaseBodyRule());
    f.rules.operations!.push(
      ...createPhaseBodyOperations<typeof f.game>({
        tableZone: "table",
        card: () => {
          throw Error("Unused card");
        },
        onNullified: () => {
          throw Error("Unused mapping");
        },
        saveProceeding: true,
        saveRoundStart: true,
      }).filter((op) =>
        ["phase-proceeding", "round-start-phase"].includes(op.name),
      ),
      createAskGeneralShowOperation({
        enableLordConversion: false,
        canShow: () => true,
        lordAvailable: () => false,
        changeToLord: () => {
          throw Error("No lord");
        },
        notify: () => null,
        save: {
          validateLord: () => {
            throw Error("No lord");
          },
          validateNotice: () => {
            throw Error("No notice child");
          },
        },
      }),
    );
    expect(
      dispatchTriggerEvent(
        f.scheduler,
        f.game,
        f.rules,
        { name: "EventPhaseProceeding", target: "a", data: null },
        "a",
      ),
    ).toBe(true);
    for (let step = 0; step < 300; step++) {
      reload(f);
      if (!f.scheduler.prompt && !f.scheduler.yielded) break;
      advance(
        f,
        f.scheduler.prompt?.choices.some((c) => c.id === "show_both_generals")
          ? "show_both_generals"
          : "ack",
      );
    }
    expect(f.scheduler.frames).toEqual([]);
    expect(f.game.displayedGenerals.a).toEqual({
      head: "a-head",
      deputy: "a-deputy",
    });
    expect(f.game.trace).toHaveLength(13);
  });
});
