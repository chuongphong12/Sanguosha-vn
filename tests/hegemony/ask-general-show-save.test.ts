import { describe, expect, it } from "vitest";
import { drawingSetup, records } from "./drawing-support";
import { createAskGeneralShowOperation } from "../../src/game/hegemony/ask-general-show";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import {
  continueTriggerWork,
  createTriggerScheduler,
  dispatchTriggerOperation,
  dispatchTriggerEvent,
  unwindTriggerInterruption,
  resumeTriggerPrompt,
  type TriggerOperation,
  type TriggerRegistry,
  type OperationHandler,
  type TriggerInterruption,
} from "../../src/game/hegemony/scheduler";

function fixture(
  budget = 1,
  saving = true,
  enableLord = true,
  reason: TriggerInterruption["reason"] = "turn-broken",
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
    canHead: true,
    canDeputy: true,
    lordAvailable: true,
    pauseChoice: false,
    rewriteChoice: false,
    consumeChoice: false,
    interruptAt: "",
  };
  game.displayedGenerals.a = { head: "anjiang", deputy: "anjiang" };
  const calls = { canShow: 0, lordAvailable: 0, changeToLord: 0, notify: 0 };
  const policy = { notify: true };
  const validateLord = (
    target: string,
    operation: Readonly<TriggerOperation>,
  ) => {
    const d = operation.data;
    if (
      operation.name !== "fixture-lord" ||
      !d ||
      typeof d !== "object" ||
      Array.isArray(d) ||
      Object.keys(d).length !== 1 ||
      d.target !== target
    )
      throw Error("Invalid fixture lord mapping");
  };
  const validateNotice = (
    notice: Readonly<{
      kind: "reveal";
      target: string;
      head: string;
      deputy: string;
    }>,
    operation: Readonly<TriggerOperation>,
  ) => {
    const d = operation.data;
    if (
      operation.name !== "fixture-notice" ||
      !d ||
      typeof d !== "object" ||
      Array.isArray(d) ||
      Object.keys(d).length !== 4 ||
      d.kind !== "reveal" ||
      d.target !== notice.target ||
      d.head !== notice.head ||
      d.deputy !== notice.deputy
    )
      throw Error("Invalid fixture notice mapping");
  };
  const rules: TriggerRegistry<typeof game> = {
    version: saving ? "ask-general-show-save-v1" : "ask-general-show-legacy",
    stepBudget: budget,
    unwind: true,
    validateEvent: (_g, event) => {
      if (!["ChoiceMade", "EventPhaseProceeding"].includes(event.name))
        throw Error("Invalid fixture event");
    },
    skills: [
      createPhaseBodyRule(),
      {
        id: "fixture-choice-observer",
        priority: 1,
        rule: true,
        events: ["ChoiceMade"],
        validateSave: (_g, frame) => {
          if (frame.continuation !== null && frame.continuation !== true)
            throw Error("Invalid fixture observer");
        },
        effect: ({ game, event, continuation }) => {
          if (continuation === null) {
            game.trace.push({
              kind: "choice",
              target: event.target,
              data: structuredClone(event.data),
            });
            if (
              game.interruptAt === "ChoiceMade" ||
              (game.interruptAt === "lord-choice" &&
                typeof event.data === "string" &&
                event.data.startsWith("skillChoice:changetolord:"))
            )
              return { kind: "interrupt", reason };
            if (game.rewriteChoice) event.data = "rewritten";
            if (game.pauseChoice)
              return {
                kind: "prompt",
                actor: "b",
                choices: ["ack"],
                canCancel: false,
                continuation: true,
              };
          }
          return { kind: "done", value: game.consumeChoice };
        },
      },
    ],
    operations: [
      ...createPhaseBodyOperations<typeof game>({
        tableZone: "table",
        card: () => {
          throw Error("Unused descriptor");
        },
        onNullified: () => {
          throw Error("Unused mapping");
        },
        saveProceeding: true,
        saveRoundStart: true,
      }).filter((o) => o.name !== "judge-phase"),
      createAskGeneralShowOperation<typeof game>({
        enableLordConversion: enableLord,
        canShow: (g, _target, head) => {
          calls.canShow++;
          return head ? g.canHead : g.canDeputy;
        },
        lordAvailable: (g) => {
          calls.lordAvailable++;
          return g.lordAvailable;
        },
        changeToLord: (target) => {
          calls.changeToLord++;
          return { name: "fixture-lord", data: { target } };
        },
        notify: (notice) => {
          calls.notify++;
          return policy.notify
            ? { name: "fixture-notice", data: notice }
            : null;
        },
        ...(saving ? { save: { validateLord, validateNotice } } : {}),
      }),
      // These child bodies are fixtures, not native show/lord/notification codecs.
      ...["show-general", "fixture-lord", "fixture-notice"].map<
        OperationHandler<typeof game>
      >((name) => ({
        name,
        validateSave: (g, frame, _interruption, prompt, state) => {
          const d = frame.operation.data;
          if (
            !d ||
            typeof d !== "object" ||
            Array.isArray(d) ||
            typeof d.target !== "string" ||
            !g.seatOrder.includes(d.target) ||
            frame.cleanup ||
            frame.child ||
            frame.operationChild ||
            state?.child ||
            (frame.continuation !== null && frame.continuation !== true) ||
            (frame.answer && frame.answer.choice !== "ack") ||
            (prompt &&
              (prompt.actor !== d.target ||
                prompt.canCancel ||
                prompt.choices.length !== 1 ||
                prompt.choices[0].id !== "ack"))
          )
            throw Error("Invalid fixture child");
          if (
            name === "show-general" &&
            (Object.keys(d).length !== 5 ||
              typeof d.head !== "boolean" ||
              d.triggerEvent !== true ||
              d.sendLog !== false ||
              d.ignoreRule !== true)
          )
            throw Error("Invalid fixture show input");
          if (name === "fixture-lord" && Object.keys(d).length !== 1)
            throw Error("Invalid fixture lord input");
          if (
            name === "fixture-notice" &&
            (Object.keys(d).length !== 4 ||
              d.kind !== "reveal" ||
              typeof d.head !== "string" ||
              typeof d.deputy !== "string")
          )
            throw Error("Invalid fixture notice input");
        },
        validateResult: (_g, result) => {
          if (result.value !== null)
            throw Error("Invalid fixture child result");
        },
        run: ({ game, operation, continuation }) => {
          const d = operation.data;
          if (
            !d ||
            typeof d !== "object" ||
            Array.isArray(d) ||
            typeof d.target !== "string"
          )
            throw Error("Invalid fixture child input");
          if (continuation !== null) return { kind: "return", value: null };
          game.trace.push({ kind: operation.name, data: structuredClone(d) });
          if (operation.name === "fixture-lord")
            game.generalNames[d.target][0] =
              "lord_" + game.generalNames[d.target][0];
          if (operation.name === "show-general") {
            if (d.head) {
              game.identities[d.target].headShown = true;
              game.displayedGenerals[d.target].head =
                game.generalNames[d.target][0];
            } else {
              game.identities[d.target].deputyShown = true;
              game.displayedGenerals[d.target].deputy =
                game.generalNames[d.target][1];
            }
          }
          if (
            game.interruptAt === operation.name ||
            (game.interruptAt === "deputy-show" &&
              operation.name === "show-general" &&
              d.head === false)
          )
            return { kind: "interrupt", reason };
          return {
            kind: "prompt",
            actor: d.target,
            choices: ["ack"],
            canCancel: false,
            continuation: true,
          };
        },
      })),
    ],
  };
  return {
    game,
    rules,
    calls,
    policy,
    scheduler: createTriggerScheduler(game.seatOrder, rules.version),
  };
}
type Fixture = ReturnType<typeof fixture>;
function reload(f: Fixture, decode = true) {
  const saved = JSON.parse(
      JSON.stringify({ game: f.game, scheduler: f.scheduler }),
    ),
    before = JSON.stringify(saved),
    calls = { ...f.calls };
  f.scheduler = decode
    ? createTriggerSaveCodec(f.rules).read(saved.scheduler, saved.game)
    : saved.scheduler;
  f.game = saved.game;
  expect(JSON.stringify(saved)).toBe(before);
  expect(f.calls).toEqual(calls);
}
function start(f: Fixture, change = true) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      {
        name: "ask-general-show",
        data: { target: "a", reason: "round", change },
      },
      "a",
    ),
  ).toBe(true);
}
function finish(
  f: Fixture,
  primary = "show_both_generals",
  lord = "yes",
  decode = true,
) {
  for (let step = 0; step < 1000; step++) {
    reload(f, decode);
    const p = f.scheduler.prompt;
    if (p) {
      const ids = p.choices.map((c) => c.id),
        choice = ids.includes("cancel")
          ? primary
          : ids.includes("yes")
            ? lord
            : "ack";
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.rules, p.actor, {
          id: p.id,
          choice,
        }),
      ).toBe(true);
    } else if (f.scheduler.yielded)
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    else return;
  }
  throw Error("Question did not finish");
}
function question(f: Fixture) {
  const frame = f.scheduler.frames.find(
    (frame) =>
      frame.kind === "operation" && frame.operation.name === "ask-general-show",
  );
  if (!frame || frame.kind !== "operation")
    throw Error("Missing question frame");
  return frame;
}
function cursor(f: Fixture) {
  const c = question(f).continuation;
  if (!c || typeof c !== "object" || Array.isArray(c))
    throw Error("Missing question cursor");
  return c;
}
function advance(f: Fixture, primary = "show_both_generals", lord = "yes") {
  const p = f.scheduler.prompt;
  if (p) {
    const ids = p.choices.map((c) => c.id),
      choice = ids.includes("cancel")
        ? primary
        : ids.includes("yes")
          ? lord
          : "ack";
    expect(
      resumeTriggerPrompt(f.scheduler, f.game, f.rules, p.actor, {
        id: p.id,
        choice,
      }),
    ).toBe(true);
  } else expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
}
function seek(
  f: Fixture,
  stage: number,
  primary = "show_both_generals",
  lord = "yes",
  decode = true,
) {
  for (let step = 0; step < 1000; step++) {
    if (cursor(f).stage === stage) return;
    reload(f, decode);
    advance(f, primary, lord);
  }
  throw Error("Missing question stage");
}
describe("actual general-show question recovery", () => {
  it.each([1, 2, 7, 10000])(
    "restores actual question/ChoiceMade with fixture children at budget %i",
    (budget) => {
      const f = fixture(budget);
      start(f);
      finish(f);
      expect(f.game.identities.a.headShown).toBe(true);
      expect(f.game.identities.a.deputyShown).toBe(true);
      expect(f.scheduler.operationCompletion?.value).toBe(true);
      expect(f.calls).toEqual({
        canShow: 2,
        lordAvailable: 1,
        changeToLord: 1,
        notify: 1,
      });
    },
  );
  it.each([
    "cancel",
    "show_head_general",
    "show_deputy_general",
    "show_both_generals",
  ])("keeps primary decision %s", (primary) => {
    const f = fixture();
    start(f);
    finish(f, primary, "no");
    expect(f.scheduler.operationCompletion?.value).toBe(primary !== "cancel");
    expect(f.game.identities.a.headShown).toBe(
      primary === "show_head_general" || primary === "show_both_generals",
    );
    expect(f.game.identities.a.deputyShown).toBe(
      primary === "show_deputy_general" || primary === "show_both_generals",
    );
    expect(f.calls.notify).toBe(primary === "cancel" ? 0 : 1);
    expect(f.calls.changeToLord).toBe(0);
  });
  it.each([
    [false, false, false, false, ["cancel"]],
    [true, false, false, false, ["show_head_general", "cancel"]],
    [false, true, false, false, ["show_deputy_general", "cancel"]],
    [
      true,
      true,
      false,
      true,
      ["show_head_general", "show_both_generals", "cancel"],
    ],
    [
      true,
      true,
      true,
      false,
      ["show_deputy_general", "show_both_generals", "cancel"],
    ],
    [
      true,
      true,
      false,
      false,
      [
        "show_head_general",
        "show_deputy_general",
        "show_both_generals",
        "cancel",
      ],
    ],
  ] as const)(
    "decodes native offer vector %s/%s/%s/%s",
    (head, deputy, headShown, deputyShown, choices) => {
      const f = fixture();
      f.game.canHead = head;
      f.game.canDeputy = deputy;
      f.game.identities.a.headShown = headShown;
      f.game.identities.a.deputyShown = deputyShown;
      start(f);
      reload(f);
      expect(f.scheduler.prompt?.choices.map((c) => c.id)).toEqual(choices);
    },
  );
  it.each(["both", "empty-deputy"])(
    "returns false before eligibility when already revealed: %s",
    (mode) => {
      const f = fixture();
      f.game.identities.a.headShown = true;
      if (mode === "both") f.game.identities.a.deputyShown = true;
      else f.game.displayedGenerals.a.deputy = "";
      start(f);
      finish(f);
      expect(f.scheduler.operationCompletion?.value).toBe(false);
      expect(f.calls).toEqual({
        canShow: 0,
        lordAvailable: 0,
        changeToLord: 0,
        notify: 0,
      });
    },
  );
  it("retains captured eligibility after the primary prompt", () => {
    const f = fixture();
    start(f);
    f.game.canHead = false;
    f.game.canDeputy = false;
    f.game.lordAvailable = false;
    finish(f);
    expect(f.game.identities.a.headShown).toBe(true);
    expect(f.game.identities.a.deputyShown).toBe(true);
    expect(f.calls).toEqual({
      canShow: 2,
      lordAvailable: 1,
      changeToLord: 1,
      notify: 1,
    });
  });
  it("honors the live shown gate after primary ChoiceMade without recapturing eligibility", () => {
    const f = fixture();
    start(f);
    seek(f, 2);
    f.game.identities.a.headShown = true;
    f.game.displayedGenerals.a.head = "already-shown";
    finish(f);
    expect(f.calls.changeToLord).toBe(0);
    expect(
      records(f.game.trace).filter((r) => r.kind === "show-general"),
    ).toHaveLength(1);
    expect(f.game.identities.a.deputyShown).toBe(true);
  });
  it("does not add a second head gate after the nested lord prompt", () => {
    const f = fixture();
    start(f);
    seek(f, 7);
    f.game.identities.a.headShown = true;
    finish(f, "show_both_generals", "no");
    expect(
      records(f.game.trace).filter((r) => r.kind === "show-general"),
    ).toHaveLength(2);
    expect(f.calls.changeToLord).toBe(0);
  });
  it.each([true, false])(
    "keeps accepted choices despite rewritten/consumed ChoiceMade, lord=%s",
    (convert) => {
      const f = fixture();
      f.game.rewriteChoice = true;
      f.game.consumeChoice = true;
      f.game.pauseChoice = true;
      start(f);
      finish(f, "show_head_general", convert ? "yes" : "no");
      expect(f.calls.changeToLord).toBe(convert ? 1 : 0);
      expect(f.game.identities.a.headShown).toBe(true);
      expect(
        records(f.game.trace)
          .filter((r) => r.kind === "choice")
          .map((r) => r.data),
      ).toEqual([
        "skillChoice:round:show_head_general",
        `skillChoice:changetolord:${convert ? "yes" : "no"}`,
      ]);
    },
  );
  it("retains cancel even when ChoiceMade is rewritten and consumed", () => {
    const f = fixture();
    f.game.rewriteChoice = true;
    f.game.consumeChoice = true;
    start(f);
    finish(f, "cancel");
    expect(f.scheduler.operationCompletion?.value).toBe(false);
    expect(f.calls.changeToLord).toBe(0);
    expect(f.calls.notify).toBe(0);
  });
  it.each(["config", "request", "duplicate"])(
    "skips lord availability at native gate %s",
    (gate) => {
      const f = fixture(1, true, gate !== "config");
      if (gate === "duplicate")
        f.game.generalNames.b[0] = f.game.generalNames.a[0];
      start(f, gate !== "request");
      finish(f);
      expect(f.calls.lordAvailable).toBe(0);
      expect(f.calls.changeToLord).toBe(0);
      expect(f.game.identities.a.headShown).toBe(true);
    },
  );
  it("accepts a null notification without a notification continuation", () => {
    const f = fixture();
    f.policy.notify = false;
    start(f);
    finish(f);
    expect(f.scheduler.operationCompletion?.value).toBe(true);
    expect(
      records(f.game.trace).filter((r) => r.kind === "fixture-notice"),
    ).toEqual([]);
  });
  it("validates captured notice names after live displayed names change", () => {
    const f = fixture();
    start(f);
    seek(f, 5);
    f.game.displayedGenerals.a = { head: "later-head", deputy: "later-deputy" };
    f.policy.notify = false;
    finish(f);
    expect(f.game.trace).toContainEqual({
      kind: "fixture-notice",
      data: {
        kind: "reveal",
        target: "a",
        head: "lord_a-head",
        deputy: "a-deputy",
      },
    });
    expect(f.calls.notify).toBe(1);
  });
  it.each(["actor", "choice", "stale", "null"])(
    "rejects invalid public reply %s without mutation",
    (invalid) => {
      const f = fixture();
      start(f);
      const p = f.scheduler.prompt!;
      const before = JSON.stringify({ game: f.game, scheduler: f.scheduler });
      expect(
        resumeTriggerPrompt(
          f.scheduler,
          f.game,
          f.rules,
          invalid === "actor" ? "b" : p.actor,
          {
            id: invalid === "stale" ? p.id + "-old" : p.id,
            choice:
              invalid === "null"
                ? null
                : invalid === "choice"
                  ? "not-offered"
                  : "cancel",
          },
        ),
      ).toBe(false);
      expect(JSON.stringify({ game: f.game, scheduler: f.scheduler })).toBe(
        before,
      );
      finish(f, "cancel");
    },
  );
  it.each([
    "cancel",
    "show_head_general",
    "show_deputy_general",
    "show_both_generals",
  ])("preserves default legacy JSON behavior for %s", (primary) => {
    const modern = fixture(),
      legacy = fixture(1, false);
    start(modern);
    start(legacy);
    expect(() => createTriggerSaveCodec(legacy.rules)).toThrow(
      "operation codec coverage",
    );
    finish(modern, primary, "no");
    finish(legacy, primary, "no", false);
    expect(modern.game).toEqual(legacy.game);
    expect(modern.calls).toEqual(legacy.calls);
    expect(modern.scheduler.operationCompletion?.value).toBe(
      legacy.scheduler.operationCompletion?.value,
    );
  });
  it("keeps the legacy eight-field cursor through lord conversion and notification", () => {
    const modern = fixture(),
      legacy = fixture(1, false);
    start(modern);
    start(legacy);
    seek(legacy, 5, "show_both_generals", "yes", false);
    expect(Object.keys(cursor(legacy))).toHaveLength(8);
    expect(cursor(legacy)).not.toHaveProperty("notice");
    finish(legacy, "show_both_generals", "yes", false);
    finish(modern);
    expect(modern.game).toEqual(legacy.game);
    expect(modern.calls).toEqual(legacy.calls);
  });
  it("composes actual shared Proceeding/RoundStart with the real question", () => {
    const f = fixture();
    f.game.playerPhases.a = "round-start";
    f.game.playerMarks.a = { HaventShowGeneral: 1, Global_RoundCount: 1 };
    expect(
      dispatchTriggerEvent(
        f.scheduler,
        f.game,
        f.rules,
        { name: "EventPhaseProceeding", target: "a", data: null },
        "a",
      ),
    ).toBe(true);
    finish(f);
    expect(f.scheduler.completion?.consumed).toBe(false);
    expect(f.game.identities.a.headShown).toBe(true);
    expect(f.game.identities.a.deputyShown).toBe(true);
    expect(f.game.trace).toContainEqual({
      kind: "choice",
      target: "a",
      data: "skillChoice:GameRule_AskForGeneralShow:show_both_generals",
    });
  });
  it("uses the nested ChoiceMade responder rather than the outer question target", () => {
    const f = fixture();
    f.game.pauseChoice = true;
    start(f);
    seek(f, 2);
    for (let step = 0; step < 100 && !f.scheduler.prompt; step++) {
      reload(f);
      advance(f);
    }
    const p = f.scheduler.prompt!;
    expect(p.actor).toBe("b");
    const before = JSON.stringify(f.scheduler);
    expect(
      resumeTriggerPrompt(f.scheduler, f.game, f.rules, "a", {
        id: p.id,
        choice: "ack",
      }),
    ).toBe(false);
    expect(JSON.stringify(f.scheduler)).toBe(before);
    finish(f);
    expect(f.scheduler.operationCompletion?.value).toBe(true);
  });
  it.each([
    "extra",
    "target",
    "reason",
    "change",
    "stage0",
    "stage6",
    "stage10",
    "choices",
    "duplicates",
    "both-only",
    "missing-both",
    "choice",
    "lord-answer",
  ])("rejects corrupted initial cursor %s", (mutation) => {
    const f = fixture();
    start(f);
    const c = cursor(f);
    if (mutation === "extra") c.extra = true;
    if (mutation === "target") c.target = "b";
    if (mutation === "reason") c.reason = "other";
    if (mutation === "change") c.change = false;
    if (mutation === "stage0") c.stage = 0;
    if (mutation === "stage6") c.stage = 6;
    if (mutation === "stage10") c.stage = 10;
    if (mutation === "choices") c.choices = ["show_both_generals"];
    if (mutation === "duplicates") c.choices = ["cancel", "cancel"];
    if (mutation === "both-only") c.choices = ["show_both_generals", "cancel"];
    if (mutation === "missing-both")
      c.choices = ["show_head_general", "show_deputy_general", "cancel"];
    if (mutation === "choice") c.choice = "show_both_generals";
    if (mutation === "lord-answer") c.lordChoice = "yes";
    expect(() => reload(f)).toThrow();
  });
  it.each(["actor", "cancel", "offer", "missing", "answer"])(
    "rejects corrupted owned prompt %s",
    (mutation) => {
      const f = fixture();
      start(f);
      const p = f.scheduler.prompt!;
      if (mutation === "actor") p.actor = "b";
      if (mutation === "cancel") p.canCancel = true;
      if (mutation === "offer") p.choices[0].id = "not-offered";
      if (mutation === "missing" || mutation === "answer") {
        f.scheduler.prompt = null;
        f.scheduler.yielded = true;
      }
      if (mutation === "answer") question(f).answer = { choice: "not-offered" };
      expect(() => reload(f)).toThrow("general-show prompt");
    },
  );
  it.each(["config", "request"])(
    "rejects captured lord eligibility outside %s",
    (gate) => {
      const f = fixture(1, true, gate !== "config");
      start(f, gate !== "request");
      cursor(f).changeLord = true;
      expect(() => reload(f)).toThrow("general-show cursor");
    },
  );
  it("rejects lord eligibility contradicted by a captured initially-shown head offer", () => {
    const f = fixture();
    f.game.identities.a.headShown = true;
    start(f);
    expect(f.scheduler.prompt?.choices.map((c) => c.id)).toEqual([
      "show_deputy_general",
      "show_both_generals",
      "cancel",
    ]);
    cursor(f).changeLord = true;
    expect(() => reload(f)).toThrow("general-show cursor");
  });
  it.each([2, 3, 4, 5, 8, 9])(
    "rejects a missing live child at stage %i",
    (stage) => {
      const f = fixture();
      start(f);
      seek(f, stage);
      const index = f.scheduler.frames.indexOf(question(f));
      f.scheduler.frames.splice(index + 1);
      f.scheduler.prompt = null;
      f.scheduler.yielded = true;
      expect(() => reload(f)).toThrow();
    },
  );
  it.each(["head", "trigger", "log", "ignore", "target", "extra"])(
    "rejects altered show-general handoff %s",
    (field) => {
      const f = fixture();
      start(f);
      seek(f, 3);
      const frame =
        f.scheduler.frames[f.scheduler.frames.indexOf(question(f)) + 1];
      if (frame.kind !== "operation") throw Error("Expected show child");
      const d = frame.operation.data;
      if (!d || typeof d !== "object" || Array.isArray(d))
        throw Error("Expected show input");
      if (field === "head") d.head = false;
      if (field === "trigger") d.triggerEvent = false;
      if (field === "log") d.sendLog = true;
      if (field === "ignore") d.ignoreRule = false;
      if (field === "target") d.target = "b";
      if (field === "extra") d.extra = 1;
      expect(() => reload(f)).toThrow();
    },
  );
  it.each([
    [3, "show_deputy_general"],
    [4, "show_head_general"],
    [5, "cancel"],
    [9, "show_deputy_general"],
  ] as const)(
    "rejects stage %i with incompatible decision %s",
    (stage, choice) => {
      const f = fixture();
      start(f);
      seek(f, stage);
      cursor(f).choice = choice;
      expect(() => reload(f)).toThrow("general-show decision");
    },
  );
  it("rejects a conversion child after captured lord=no", () => {
    const f = fixture();
    start(f);
    seek(f, 9);
    cursor(f).lordChoice = "no";
    expect(() => reload(f)).toThrow("general-show decision");
  });
  it("rejects an altered pure lord mapping", () => {
    const f = fixture();
    start(f);
    seek(f, 9);
    const child =
      f.scheduler.frames[f.scheduler.frames.indexOf(question(f)) + 1];
    if (child.kind !== "operation") throw Error("Expected lord child");
    child.operation.data = { target: "b" };
    expect(() => reload(f)).toThrow("fixture lord mapping");
  });
  it.each(["captured-target", "captured-name", "operation-name", "extra"])(
    "rejects altered captured notification %s",
    (mutation) => {
      const f = fixture();
      start(f);
      seek(f, 5);
      const c = cursor(f),
        n = c.notice,
        child = f.scheduler.frames[f.scheduler.frames.indexOf(question(f)) + 1];
      if (
        !n ||
        typeof n !== "object" ||
        Array.isArray(n) ||
        child.kind !== "operation"
      )
        throw Error("Expected notice work");
      if (mutation === "captured-target") n.target = "b";
      if (mutation === "captured-name") n.head = "other";
      if (mutation === "operation-name") child.operation.name = "fixture-lord";
      if (mutation === "extra") n.extra = true;
      expect(() => reload(f)).toThrow();
    },
  );
  it("rejects a changed ChoiceMade recipient while permitting payload rewrites", () => {
    const f = fixture();
    start(f);
    seek(f, 2);
    const child =
      f.scheduler.frames[f.scheduler.frames.indexOf(question(f)) + 1];
    if (child.kind !== "event") throw Error("Expected ChoiceMade child");
    child.event.target = "b";
    expect(() => reload(f)).toThrow("ChoiceMade child");
  });
  it("rejects a nonboolean completed question result", () => {
    const f = fixture();
    start(f);
    finish(f, "cancel");
    f.scheduler.operationCompletion!.value = 1;
    expect(() => reload(f)).toThrow("general-show result");
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "recovers actual question abandonment after %s from fixture show",
    (reason) => {
      const f = fixture(1, true, true, reason);
      f.game.interruptAt = "show-general";
      start(f);
      finish(f);
      if (!f.scheduler.interruption) throw Error("Expected interruption");
      reload(f);
      expect(
        unwindTriggerInterruption(
          f.scheduler,
          f.game,
          f.rules,
          f.scheduler.interruption!,
        ),
      ).toBe(true);
      finish(f);
      expect(f.scheduler.frames).toEqual([]);
      expect(f.game.identities.a.headShown).toBe(true);
      expect(
        records(f.game.trace).filter((r) => r.kind === "show-general"),
      ).toHaveLength(1);
    },
  );
  it.each([
    "ChoiceMade",
    "lord-choice",
    "fixture-lord",
    "deputy-show",
    "fixture-notice",
  ])("retains eager fixture work during unwind from %s", (origin) => {
    const f = fixture();
    f.game.interruptAt = origin;
    start(f);
    finish(f);
    if (!f.scheduler.interruption) throw Error("Expected interruption");
    const trace = JSON.stringify(f.game.trace);
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
    expect(JSON.stringify(f.game.trace)).toBe(trace);
  });
  it("requires both pure child contracts when opting in", () => {
    const options = {
      enableLordConversion: false,
      canShow: () => true,
      lordAvailable: () => false,
      changeToLord: () => ({ name: "unused", data: null }),
      notify: () => null,
      save: { validateLord: () => undefined, validateNotice: () => undefined },
    };
    Object.assign(options.save, { validateNotice: null });
    expect(() => createAskGeneralShowOperation(options)).toThrow(
      "general-show rules",
    );
  });
});
