import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";
import {
  continueTriggerWork,
  dispatchTriggerOperation,
  unwindTriggerInterruption,
  type OperationFrame,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";

function fixture() {
  const f = drawingSetup();
  f.rules.skills = [];
  f.rules.unwind = true;
  f.rules.stepBudget = 1;
  f.policy.notify = () => null;
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
      throw Error("Unexpected acquisition event");
  };
  f.rules.operations = f.rules.operations!.filter((op) =>
    [
      "draw-cards",
      "get-n-cards",
      "draw-card",
      "swap-pile",
      "game-over",
      "move-cards",
    ].includes(op.name),
  );
  return f;
}
type Fixture = ReturnType<typeof fixture>;

function root(f: Fixture): OperationFrame {
  const frame = f.scheduler.frames[0];
  if (frame?.kind !== "operation") throw Error("Expected draw root");
  return frame;
}
function cursor(f: Fixture) {
  const value = root(f).continuation;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Expected draw cursor");
  return value;
}
function start(f: Fixture, data: TriggerData) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      { name: "draw-cards", data },
      "a",
    ),
  ).toBe(true);
}
function read(f: Fixture) {
  const candidate = JSON.parse(
    JSON.stringify({ game: f.game, scheduler: f.scheduler }),
  );
  const before = JSON.stringify(candidate);
  f.scheduler = createTriggerSaveCodec(f.rules).read(
    candidate.scheduler,
    candidate.game,
  );
  f.game = candidate.game;
  expect(JSON.stringify(candidate)).toBe(before);
}
function finish(f: Fixture) {
  let movementCheckpoints = 0;
  for (let step = 0; step < 500; step++) {
    const moving = f.scheduler.frames.some(
      (frame) =>
        frame.kind === "operation" &&
        frame.operation.name === "move-cards" &&
        frame.continuation !== null,
    );
    if (moving) movementCheckpoints++;
    read(f);
    if (!f.scheduler.yielded || f.scheduler.interruption)
      return movementCheckpoints;
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  }
  throw Error("Draw did not finish");
}

describe("actual player-draw save codec", () => {
  it("recovers acquisition checkpoints and transfers through actual movement once", () => {
    const f = fixture();
    start(f, {
      players: ["a", "b", "c"],
      counts: [1, 2],
      fromUps: [false],
      reason: "yiji",
    });
    expect(finish(f)).toBeGreaterThan(0);
    expect(f.game.cardZones.a.cards).toEqual([11]);
    expect(f.game.cardZones.b.cards).toEqual([0, 1]);
    expect(f.game.cardZones.c.cards).toEqual([2, 3]);
    expect(f.game.cardZones.reserved.cards).toEqual([]);
    expect(f.scheduler.operationCompletion?.value).toBe(null);
    expect(f.game.wrappedCards![11].flags).toEqual(["keep"]);
  });

  it.each([
    { players: [], counts: [1], fromUps: [], reason: "" },
    { players: ["a", "b"], counts: [0, -2], fromUps: [], reason: "" },
    {
      players: ["b", "a", "a"],
      counts: [99, 1],
      fromUps: [true, false],
      reason: "",
    },
    { players: ["b"], counts: [1], fromUps: [], reason: "reform" },
    { players: ["b"], counts: [1], fromUps: [], reason: "Reform" },
  ])(
    "preserves skipped slots, duplicate recipients and exact reform exception: %j",
    (data) => {
      const f = fixture();
      f.game.alive.b = false;
      start(f, data);
      finish(f);
      expect(f.game.cardZones.a.cards).toEqual(
        data.players.length === 3 ? [11, 0] : [],
      );
      expect(f.game.cardZones.b.cards).toEqual(
        data.reason === "reform" ? [0] : [],
      );
    },
  );

  it("does not replay the alive check after an eligible acquisition starts", () => {
    const f = fixture();
    start(f, { players: ["a"], counts: [1] });
    f.game.alive.a = false;
    f.game.removed.a = true;
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0]);
  });

  it("retains earlier reservations when a later recipient exhausts the pile", () => {
    const f = fixture();
    start(f, { players: ["a", "b"], counts: [2, 99] });
    finish(f);
    expect(f.game.gameResult).toBe(".");
    expect(f.game.cardZones.a.cards).toEqual([]);
    expect(f.game.cardZones.reserved.cards).toEqual([0, 1]);
    if (!f.scheduler.interruption) throw Error("Expected exhaustion");
    expect(
      unwindTriggerInterruption(
        f.scheduler,
        f.game,
        f.rules,
        f.scheduler.interruption,
      ),
    ).toBe(true);
    for (let step = 0; step < 20 && !f.scheduler.unwindCompletion; step++) {
      read(f);
      expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    }
    read(f);
    expect(f.scheduler.unwindCompletion?.reason).toBe("game-over");
    expect(f.game.cardZones.reserved.cards).toEqual([0, 1]);
  });

  it.each([
    "stage",
    "index",
    "count",
    "target",
    "players",
    "counts",
    "fromUps",
    "reason",
  ])("rejects forged acquisition %s without changing the candidate", (key) => {
    const f = fixture();
    start(f, { players: ["a", "b"], counts: [1] });
    const c = cursor(f);
    if (key === "stage") c.stage = "next";
    else if (key === "index") c.index = 0;
    else if (key === "count") c.count = 0;
    else if (key === "target") c.target = "b";
    else if (key === "reason") c.reason = "forged";
    else c[key] = key === "fromUps" ? [false] : [];
    const before = JSON.stringify(f);
    expect(() => read(f)).toThrow();
    expect(JSON.stringify(f)).toBe(before);
  });

  it.each(["name", "count", "direction", "notice", "missing"])(
    "rejects a contradictory acquisition child: %s",
    (key) => {
      const f = fixture();
      start(f, { players: ["a"], counts: [1] });
      const child = f.scheduler.frames[1];
      if (
        child.kind !== "operation" ||
        !child.operation.data ||
        typeof child.operation.data !== "object" ||
        Array.isArray(child.operation.data)
      )
        throw Error("Expected queued acquisition");
      if (key === "name") child.operation.name = "draw-card";
      else if (key === "missing") f.scheduler.frames.pop();
      else if (key === "count") child.operation.data.count = 2;
      else if (key === "direction") child.operation.data.fromUp = false;
      else child.operation.data.updatePileNumber = true;
      expect(() => read(f)).toThrow();
    },
  );

  it("accepts equivalent movement objects with reordered JSON keys", () => {
    const f = fixture();
    start(f, { players: ["a"], counts: [1] });
    seekMovement(f);
    const child = f.scheduler.frames[1];
    if (child.kind !== "operation") throw Error("Expected movement child");
    child.operation.data = {
      forceVisible: false,
      moves: [
        {
          reason: { eventName: "", skill: "", actor: "a", kind: "draw" },
          open: false,
          to: "a",
          ids: [0],
        },
      ],
    };
    read(f);
  });

  it("rejects a fabricated physical ID even when parent and movement agree", () => {
    const f = fixture();
    start(f, { players: ["a"], counts: [1] });
    seekMovement(f);
    const moves = [
      {
        ids: [999],
        to: "a",
        open: false,
        reason: { kind: "draw", actor: "a", skill: "", eventName: "" },
      },
    ];
    cursor(f).moves = moves;
    const child = f.scheduler.frames[1];
    if (child.kind !== "operation") throw Error("Expected movement");
    child.operation.data = { moves, forceVisible: false };
    expect(() => read(f)).toThrow();
  });

  it("recovers inside actual movement through its own codec", () => {
    const f = fixture();
    start(f, { players: ["a"], counts: [1] });
    seekMovement(f);
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
    read(f);
    finish(f);
    expect(f.game.cardZones.a.cards).toEqual([0]);
  });

  it.each(["acquired", "moved"])(
    "rejects an omitted mandatory reform slot at %s",
    (stage) => {
      const f = fixture();
      start(f, { players: ["a", "b"], counts: [1], reason: "reform" });
      for (let step = 0; step < 200; step++) {
        const c = cursor(f);
        if (c.stage === stage && c.index === 2) break;
        read(f);
        expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
      }
      const c = cursor(f);
      expect(c.stage).toBe(stage);
      if (!Array.isArray(c.moves)) throw Error("Expected moves");
      c.moves.shift();
      if (stage === "moved") {
        const child = f.scheduler.frames[1];
        if (child.kind !== "operation") throw Error("Expected movement");
        child.operation.data = { moves: c.moves, forceVisible: false };
      }
      expect(() => read(f)).toThrow();
    },
  );

  it.each(["answer", "event-child", "cleanup", "result"])(
    "rejects an impossible draw boundary: %s",
    (key) => {
      const f = fixture();
      start(f, { players: ["a"], counts: [1] });
      const frame = root(f);
      if (key === "answer") frame.answer = { choice: "forged" };
      else if (key === "event-child")
        frame.child = {
          consumed: false,
          event: { name: "FetchDrawPileCard", target: null, data: null },
        };
      else if (key === "cleanup")
        frame.cleanup = {
          normalContinuation: frame.continuation,
        };
      else {
        finish(f);
        if (!f.scheduler.operationCompletion)
          throw Error("Expected completion");
        f.scheduler.operationCompletion.value = true;
      }
      expect(() => read(f)).toThrow();
    },
  );

  it.each([
    "stage",
    "index",
    "target",
    "count",
    "ids",
    "destination",
    "actor",
    "reason",
    "open",
    "extra",
    "child",
  ])("rejects forged movement handoff %s", (key) => {
    const f = fixture();
    start(f, { players: ["a", "b"], counts: [1] });
    seekMovement(f);
    const c = cursor(f);
    if (key === "stage") c.stage = ["moved"];
    else if (key === "index") c.index = 1;
    else if (key === "target") c.target = "a";
    else if (key === "count") c.count = 2;
    else if (key === "child") {
      const child = f.scheduler.frames[1];
      if (
        child.kind !== "operation" ||
        !child.operation.data ||
        typeof child.operation.data !== "object" ||
        Array.isArray(child.operation.data)
      )
        throw Error("Expected movement input");
      child.operation.data.forceVisible = true;
    } else {
      const move = Array.isArray(c.moves) ? c.moves[0] : null;
      if (!move || typeof move !== "object" || Array.isArray(move))
        throw Error("Expected transfer");
      if (key === "ids") move.ids = [-1];
      else if (key === "destination") move.to = "b";
      else if (key === "open") move.open = true;
      else if (key === "extra") move.bottom = false;
      else {
        const reason = move.reason;
        if (!reason || typeof reason !== "object" || Array.isArray(reason))
          throw Error("Expected reason");
        if (key === "actor") reason.actor = "b";
        else reason.skill = "forged";
      }
    }
    expect(() => read(f)).toThrow();
  });
});

function seekMovement(f: Fixture) {
  for (let step = 0; step < 300; step++) {
    if (cursor(f).stage === "moved") return;
    read(f);
    expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
  }
  throw Error("No movement handoff");
}
