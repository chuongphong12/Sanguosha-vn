import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  continueTriggerWork,
  dispatchTriggerOperation,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";

const events = [
  "BeforeCardsMove",
  "ConfirmMoveCards",
  "PreCardsMoveOneTime",
  "CardsMoveOneTime",
];
function fixture(stepBudget = 1, promptAt = "") {
  const f = drawingSetup();
  f.game.cardZones.a.cards = [0, 1];
  f.game.cardZones.b.cards = [2];
  f.game.cardZones.draw.cards = [3, 4, 5, 6, 7, 8, 9, 10, 11];
  f.rules.stepBudget = stepBudget;
  f.rules.unwind = true;
  f.rules.operations = f.rules.operations!.filter(
    (op) => op.name === "move-cards",
  );
  f.rules.validateEvent = (_game, event) => {
    if (
      !events.includes(event.name) ||
      !event.target ||
      !f.game.seatOrder.includes(event.target)
    )
      throw Error("Invalid fixture movement event");
  };
  f.rules.skills = [
    {
      id: "fixture-observer",
      rule: true,
      priority: 0,
      events,
      validateSave: (_game, frame, prompt) => {
        if (frame.continuation !== null && frame.continuation !== true)
          throw Error("Invalid fixture cursor");
        if (
          prompt &&
          (prompt.actor !== frame.event.target ||
            prompt.canCancel ||
            prompt.choices.length !== 1 ||
            prompt.choices[0].id !== "ack")
        )
          throw Error("Invalid fixture prompt");
      },
      effect: ({ game, event, continuation }) => {
        if (continuation === true) return { kind: "done", value: false };
        game.trace.push({ name: event.name, target: event.target });
        if (event.name === promptAt && event.target === "a")
          return {
            kind: "prompt",
            actor: "a",
            choices: ["ack"],
            canCancel: false,
            continuation: true,
          };
        return { kind: "done", value: false };
      },
    },
  ];
  return f;
}
type Fixture = ReturnType<typeof fixture>;
function start(
  f: Fixture,
  moves: TriggerData = [{ ids: [0], from: ["a"], to: "b" }],
) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      { name: "move-cards", data: { moves } },
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
  for (let step = 0; step < 500; step++) {
    reload(f);
    if (f.scheduler.interruption) return;
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
  throw Error("Movement did not finish");
}

function cursor(f: Fixture) {
  const frame = f.scheduler.frames[0];
  if (
    frame.kind !== "operation" ||
    !frame.continuation ||
    typeof frame.continuation !== "object" ||
    Array.isArray(frame.continuation)
  )
    throw Error("Expected movement cursor");
  return frame.continuation;
}

describe("movement recovery boundaries", () => {
  it.each(events)(
    "restores a %s prompt without repeating effects or wrapper filters",
    (eventName) => {
      const f = fixture(1, eventName);
      let filterCalls = 0;
      f.rules.operations = [
        createCardMovementOperation<typeof f.game>(
          undefined,
          undefined,
          undefined,
          undefined,
          {
            originals: f.game.wrappedCards!,
            filters: () => {
              filterCalls++;
              return [];
            },
          },
        ),
      ];
      start(f);
      finish(f);
      expect(filterCalls).toBe(1);
      expect(f.game.cardZones.a.cards).toEqual([1]);
      expect(f.game.cardZones.b.cards).toEqual([2, 0]);
      expect(f.game.trace).toHaveLength(12);
      expect(f.game.wrappedCards![0].flags).toEqual(["keep"]);
    },
  );

  it.each(["BeforeCardsMove", "PreCardsMoveOneTime"])(
    "preserves %s consumption semantics",
    (eventName) => {
      const f = fixture();
      f.rules.skills[0].effect = ({ event }) => ({
        kind: "done",
        value: event.name === eventName && event.target === "a",
      });
      start(f);
      finish(f);
      expect(f.game.cardZones.a.cards).toEqual(
        eventName === "BeforeCardsMove" ? [0, 1] : [1],
      );
      expect(f.scheduler.operationCompletion?.value).toMatchObject({
        cancelled: eventName === "BeforeCardsMove",
      });
    },
  );

  it.each(events)(
    "unwinds an interruption during %s with the correct commit boundary",
    (eventName) => {
      const f = fixture();
      f.rules.skills[0].effect = ({ event }) =>
        event.name === eventName
          ? { kind: "interrupt", reason: "turn-broken" }
          : { kind: "done", value: false };
      start(f);
      finish(f);
      if (!f.scheduler.interruption) throw Error("Expected interruption");
      const committed = ["PreCardsMoveOneTime", "CardsMoveOneTime"].includes(
        eventName,
      );
      expect(f.game.cardZones.b.cards).toEqual(committed ? [2, 0] : [2]);
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
      expect(f.scheduler.unwindCompletion?.reason).toBe("turn-broken");
      expect(f.game.cardZones.b.cards).toEqual(committed ? [2, 0] : [2]);
    },
  );

  it("keeps a Before rewrite separate from Confirm notification rewrites", () => {
    const f = fixture();
    f.game.cardZones.table = { owner: null, place: "table", cards: [] };
    f.rules.skills[0].effect = ({ event }) => {
      if (event.target === "a" && event.name === "BeforeCardsMove")
        event.data = { moves: [{ ids: [0], to: "table", reason: "rewrite" }] };
      if (event.name === "ConfirmMoveCards") event.data = null;
      return { kind: "done", value: false };
    };
    start(f);
    finish(f);
    expect(f.game.cardZones.table.cards).toEqual([0]);
    expect(f.game.cardZones.b.cards).toEqual([2]);
  });

  it.each(["BeforeCardsMove", "CardsMoveOneTime"])(
    "keeps nested actual %s movement when an outer save has historical sources",
    (eventName) => {
      const f = fixture();
      f.game.cardZones.table = { owner: null, place: "table", cards: [] };
      f.rules.skills[0].effect = ({ game, event, continuation }) => {
        if (continuation === true) return { kind: "done", value: false };
        if (
          event.name === eventName &&
          event.target === "a" &&
          !game.trace.includes("nested")
        ) {
          game.trace.push("nested");
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: { moves: [{ ids: [0], to: "table" }] },
            },
            continuation: true,
          };
        }
        return { kind: "done", value: false };
      };
      start(f);
      if (eventName === "BeforeCardsMove")
        expect(() => finish(f)).toThrow("Stale card movement");
      else finish(f);
      expect(f.game.cardZones.table.cards).toEqual([0]);
      expect(f.game.trace).toEqual(["nested"]);
    },
  );

  it.each([
    "stage",
    "actor",
    "actors",
    "from",
    "fromPlaces",
    "open",
    "originTo",
    "lastHandcard",
    "ids",
    "packets",
    "missing-child",
    "event-name",
    "event-target",
  ])("rejects a corrupted saved %s without mutating the candidate", (key) => {
    const f = fixture();
    start(f);
    const c = cursor(f);
    if (key === "stage") c.stage = 4;
    else if (key === "actor") c.actor = 99;
    else if (key === "actors") c.actors = ["b", "a"];
    else if (key === "packets") c.cardPackets = c.moves;
    else if (key === "missing-child") f.scheduler.frames.pop();
    else if (key.startsWith("event-")) {
      const child = f.scheduler.frames[1];
      if (child.kind !== "event") throw Error("Expected event child");
      if (key === "event-name") child.event.name = "ConfirmMoveCards";
      else child.event.target = "b";
    } else {
      const move = Array.isArray(c.moves) ? c.moves[0] : null;
      if (!move || typeof move !== "object" || Array.isArray(move))
        throw Error("Expected packet");
      if (key === "from") move.from = ["b"];
      else if (key === "fromPlaces") move.fromPlaces = [];
      else if (key === "open") move.open = [1];
      else if (key === "originTo") move.originTo = "a";
      else if (key === "lastHandcard") move.lastHandcard = 0;
      else move.ids = [999];
    }
    const before = JSON.stringify(f);
    expect(() => reload(f)).toThrow();
    expect(JSON.stringify(f)).toBe(before);
  });
});

describe("actual movement save codec", () => {
  it.each(["collapsed", "reordered"])(
    "rejects %s retained physical packets",
    (kind) => {
      const f = fixture();
      start(
        f,
        kind === "collapsed"
          ? [{ ids: [0, 1], to: "b", open: [false, true] }]
          : [
              { ids: [0], to: "b" },
              { ids: [2], to: "a" },
            ],
      );
      seekStage(f, 1);
      const c = cursor(f);
      expect(c.cardPackets).toHaveLength(2);
      if (kind === "collapsed") c.cardPackets = structuredClone(c.moves);
      else if (Array.isArray(c.cardPackets)) c.cardPackets.reverse();
      expect(() => reload(f)).toThrow();
    },
  );

  it("preserves historical separated groups after incoming last-hand flags are overwritten", () => {
    const f = fixture();
    f.game.cardZones.draw.cards.shift();
    f.game.cardZones.a.cards.push(3);
    f.rules.skills[0].effect = ({ event }) => {
      if (event.name === "BeforeCardsMove" && event.target === "a")
        event.data = {
          moves: [
            { ids: [0], to: "b", lastHandcard: false },
            { ids: [1], to: "b", lastHandcard: true },
          ],
        };
      return { kind: "done", value: false };
    };
    start(f);
    seekStage(f, 1);
    expect(cursor(f).cardPackets).toMatchObject([
      { lastHandcard: false },
      { lastHandcard: false },
    ]);
    finish(f);
    expect(f.game.cardZones.b.cards).toEqual([2, 0, 1]);
  });
  it.each(["empty", "same-zone", "bottom", "discard", "all-dead"])(
    "restores the %s path",
    (kind) => {
      const f = fixture();
      if (kind === "all-dead") f.game.alive = { a: false, b: false, c: false };
      start(
        f,
        kind === "empty"
          ? []
          : [
              {
                ids: [0, 1],
                to:
                  kind === "same-zone"
                    ? "a"
                    : kind === "bottom"
                      ? "draw"
                      : "discard",
                bottom: kind === "bottom",
              },
            ],
      );
      finish(f);
      if (kind === "bottom")
        expect(f.game.cardZones.draw.cards).toEqual([
          3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1,
        ]);
      else if (["discard", "all-dead"].includes(kind))
        expect(f.game.cardZones.discard.cards).toEqual([1, 0]);
      else expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    },
  );

  it.each(["cancelled", "moves", "data", "input"])(
    "rejects a malformed completion %s",
    (key) => {
      const f = fixture();
      start(f);
      finish(f);
      const result = f.scheduler.operationCompletion;
      if (!result) throw Error("Expected result");
      if (key === "cancelled") result.value = { cancelled: 1, data: null };
      else if (key === "moves") result.value = { cancelled: true, moves: [0] };
      else if (key === "data") result.value = { cancelled: false, moves: [] };
      else result.operation.data = { moves: [{ ids: [999], to: "a" }] };
      expect(() => reload(f)).toThrow();
    },
  );

  it("rejects a changed physical batch when its retained packet list disagrees", () => {
    const f = fixture();
    start(f);
    for (let step = 0; step < 100 && cursor(f).stage !== 1; step++) {
      reload(f);
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    }
    const c = cursor(f);
    expect(c.stage).toBe(1);
    c.cardPackets = [];
    expect(() => reload(f)).toThrow();
  });

  it("accepts captured actors who died during an earlier event", () => {
    const f = fixture();
    start(f);
    f.game.alive.a = false;
    f.game.alive.b = false;
    finish(f);
    expect(f.game.cardZones.b.cards).toEqual([2, 0]);
  });

  it.each([1, 2, 7, 10000])(
    "restores every cooperative checkpoint with budget %i",
    (budget) => {
      const f = fixture(budget);
      start(f, [
        { ids: [0], from: ["a"], to: "b" },
        { ids: [2], from: ["b"], to: "a" },
      ]);
      finish(f);
      expect(f.game.cardZones.a.cards).toEqual([1, 2]);
      expect(f.game.cardZones.b.cards).toEqual([0]);
      expect(f.game.trace).toHaveLength(12);
      expect(f.scheduler.operationCompletion?.value).toMatchObject({
        cancelled: false,
      });
    },
  );
});

function seekStage(f: Fixture, stage: number) {
  for (let step = 0; step < 200; step++) {
    if (cursor(f).stage === stage) return;
    reload(f);
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  }
  throw Error("Expected movement stage");
}
