import { describe, expect, it } from "vitest";
import { setup, drain, answer } from "./composed-turn-support";
import {
  createMatchTurn,
  type TurnMatch,
} from "../../src/game/hegemony/match-turn";
import { createRoomUseCleanupOperation } from "../../src/game/hegemony/room-use-card";

function fixture(budget = 10000) {
  const f = setup();
  f.registry.stepBudget = budget;
  f.game.gameResult = null;
  const match: TurnMatch<typeof f.game> = {
    room: f.game,
    scheduler: f.scheduler,
    turn: { stage: "normal", waiting: false },
  };
  return { ...f, match, owner: createMatchTurn(f.registry) };
}
function finishRoot(f: ReturnType<typeof fixture>, restore = false) {
  let used = false,
    steps = 0;
  while (
    (f.match.turn.stage === "normal" || f.match.turn.stage === "recovery") &&
    f.match.turn.waiting
  ) {
    expect(++steps).toBeLessThan(10000);
    if (restore) {
      f.match = JSON.parse(JSON.stringify(f.match));
      f.game = f.match.room;
      f.scheduler = f.match.scheduler;
      f.owner.validate(f.match);
    }
    const prompt = f.match.scheduler.prompt;
    if (prompt) {
      const paused = JSON.stringify(f.match);
      expect(f.owner.advance(f.match)).toBe(false);
      expect(JSON.stringify(f.match)).toBe(paused);
      const play = f.play.view(f.scheduler, prompt.actor),
        discard = f.discard.view(f.scheduler, prompt.actor);
      let choice: string | null;
      if (play) {
        const confirm = play.choices.find((c) => c.label === "Xác nhận");
        choice =
          confirm?.id ??
          (!used
            ? play.choices.find((c) => c.label.startsWith("Test "))!.id
            : null);
        if (confirm) used = true;
      } else if (discard)
        choice = (discard.choices.find((c) => c.action === "confirm") ??
          discard.choices.find((c) => c.action === "card"))!.id;
      else
        choice = prompt.choices.some((c) => c.id === "show_head_general")
          ? "show_head_general"
          : "no";
      expect(answer(f, choice)).toBe(true);
    } else expect(f.owner.advance(f.match)).toBe(true);
  }
  return steps;
}
describe("trusted match turn owner", () => {
  it("starts one real turn and consumes its completion without starting the next actor", () => {
    const f = fixture();
    expect(f.owner.advance(f.match)).toBe(true);
    expect(f.match.room.playerMarks.a.Global_TurnCount).toBe(1);
    expect(f.match.scheduler.prompt?.actor).toBe("a");
    drain(f);
    expect(f.owner.advance(f.match)).toBe(true);
    expect(f.match.turn).toEqual({ stage: "normal", waiting: false });
    expect(f.match.room.cardZones.a.cards).toEqual([5, 6]);
    expect(f.match.room.playerMarks.b.Global_TurnCount).toBeUndefined();
    expect(f.match.room.currentPlayer).toBe("a");
    expect(f.owner.advance(f.match)).toBe(true);
    expect(f.match.room.currentPlayer).toBe("b");
    expect(f.match.room.playerMarks.b.Global_TurnCount).toBeUndefined();
  });
  it.each([1, 7, 10000])(
    "drives saved cooperative work with budget %i without a second TurnStart",
    (budget) => {
      const f = fixture(budget);
      expect(f.owner.advance(f.match)).toBe(true);
      finishRoot(f, true);
      expect(f.match.turn).toEqual({ stage: "normal", waiting: false });
      expect(f.match.room.cardZones.a.cards).toEqual([5, 6]);
      expect(f.match.room.playerMarks.a.Global_TurnCount).toBe(1);
      expect(f.match.room.playerMarks.b.Global_TurnCount).toBeUndefined();
      expect(f.match.scheduler.frames).toEqual([]);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "classifies %s only after real Room cleanup and stack departure",
    (reason) => {
      const f = fixture(7);
      f.game.interruptEvent = "CardFinished";
      f.game.interruptReason = reason;
      f.owner.advance(f.match);
      finishRoot(f, true);
      expect(f.match.scheduler.frames).toEqual([]);
      expect(f.match.scheduler.interruption).toBeNull();
      expect(f.match.room.cardZones.table.cards).toEqual(
        reason === "game-over" ? [0] : [],
      );
      if (reason === "turn-broken") {
        expect(f.match.turn).toEqual({ stage: "recovery", waiting: false });
        f.owner.advance(f.match);
        finishRoot(f, true);
        expect(f.match.turn).toEqual({ stage: "normal", waiting: false });
        expect(f.match.room.currentPlayer).toBe("b");
        expect(f.match.room.playerPhases.a).toBe("not-active");
        expect(f.match.room.playerMarks.b.Global_TurnCount).toBeUndefined();
      } else {
        expect(f.match.turn).toMatchObject({
          stage: "fault",
          reason:
            reason === "stage-change"
              ? "stage-change"
              : "game-over-without-result",
          interruption: { reason },
        });
        const snapshot = JSON.stringify(f.match);
        expect(f.owner.advance(f.match)).toBe(false);
        expect(JSON.stringify(f.match)).toBe(snapshot);
      }
    },
  );
  it("finishes a real game-over without discarding table material or starting another turn", () => {
    const f = fixture(1);
    f.registry.skills.unshift({
      id: "package-terminal",
      rule: true,
      priority: 100,
      events: ["CardFinished"],
      effect: () => ({
        kind: "operation",
        operation: { name: "game-over", data: "a" },
        continuation: true,
      }),
    });
    f.owner.advance(f.match);
    finishRoot(f, true);
    expect(f.match.turn).toEqual({ stage: "finished" });
    expect(f.match.room.gameResult).toBe("a");
    expect(f.match.room.cardZones.table.cards).toEqual([0]);
    expect(f.match.room.playerMarks.b.Global_TurnCount).toBeUndefined();
    const snapshot = JSON.stringify(f.match);
    expect(f.owner.advance(f.match)).toBe(false);
    expect(JSON.stringify(f.match)).toBe(snapshot);
  });
  it.each(["unbounded", "freeze", "missing-root", "duplicate-root"] as const)(
    "rejects an incompatible %s profile before execution",
    (kind) => {
      const f = setup();
      f.registry.stepBudget = 7;
      if (kind === "unbounded") delete f.registry.stepBudget;
      if (kind === "freeze") f.registry.unwind = false;
      if (kind === "missing-root")
        f.registry.operations = f.registry.operations!.filter(
          (op) => op.name !== "recover-normal-turn",
        );
      if (kind === "duplicate-root")
        f.registry.operations!.push(
          f.registry.operations!.find((op) => op.name === "normal-turn-step")!,
        );
      expect(() => createMatchTurn(f.registry)).toThrow();
    },
  );
  it.each([
    "cursor",
    "finished",
    "waiting",
    "yield",
    "foreign-table",
    "seat-order",
    "identity",
    "stale-unwind",
  ] as const)(
    "rejects invalid saved %s before driving any candidate",
    (kind) => {
      const f = fixture(),
        saved = JSON.parse(JSON.stringify(f.match));
      if (kind === "cursor") saved.turn = { stage: "normal", waiting: "yes" };
      if (kind === "finished") saved.turn = { stage: "finished" };
      if (kind === "waiting") saved.turn.waiting = true;
      if (kind === "yield") saved.scheduler.yielded = true;
      if (kind === "foreign-table")
        saved.scheduler.registryVersion = "startup-full";
      if (kind === "seat-order") saved.scheduler.seatOrder.reverse();
      if (kind === "identity") saved.scheduler.nextId = 0;
      if (kind === "stale-unwind")
        saved.scheduler.unwindCompletion = {
          id: "interruption-1",
          eventId: "operation-1",
          reason: "turn-broken",
        };
      const before = JSON.stringify(saved);
      expect(() => f.owner.advance(saved)).toThrow();
      expect(JSON.stringify(saved)).toBe(before);
      expect(f.match.room.playerMarks.a.Global_TurnCount).toBeUndefined();
    },
  );
  it("rejects a root from a different owner and leaves an actual actor prompt paused", () => {
    const f = fixture();
    f.owner.advance(f.match);
    const saved = JSON.parse(JSON.stringify(f.match));
    saved.scheduler.frames[0].operation.name = "game-over";
    expect(() => f.owner.validate(saved)).toThrow();
    const snapshot = JSON.stringify(f.match);
    expect(f.owner.advance(f.match)).toBe(false);
    expect(JSON.stringify(f.match)).toBe(snapshot);
  });
  it("abandons a Room catch interrupted again and classifies the new reason", () => {
    const f = fixture(1);
    f.game.interruptEvent = "CardFinished";
    f.registry.skills.unshift({
      id: "package-cleanup-break",
      rule: true,
      priority: 100,
      events: ["CardFinished"],
      effect: ({ game }) =>
        game.playerFlags.a.includes("Global_ProcessBroken")
          ? { kind: "interrupt", reason: "stage-change" }
          : { kind: "done", value: false },
    });
    f.owner.advance(f.match);
    finishRoot(f, true);
    expect(f.match.turn).toMatchObject({
      stage: "fault",
      reason: "stage-change",
      interruption: { reason: "stage-change" },
    });
    expect(f.match.room.cardZones.discard.cards).toEqual([0, 4]);
    expect(f.match.room.playerFlags.a).toContain("Global_ProcessBroken");
    expect(f.match.scheduler.frames).toEqual([]);
  });
  it("restarts recovery after a fresh TurnBroken while keeping prior committed facts", () => {
    const f = fixture(7);
    f.game.interruptEvent = "CardFinished";
    f.registry.skills.unshift({
      id: "package-recovery-break",
      rule: true,
      priority: 100,
      events: ["TurnBroken"],
      effect: ({ game }) => {
        if (!game.playerMarks.c.recoveryBreak) {
          game.playerMarks.c.recoveryBreak = 1;
          return { kind: "interrupt", reason: "turn-broken" };
        }
        return { kind: "done", value: false };
      },
    });
    f.owner.advance(f.match);
    finishRoot(f, true);
    f.owner.advance(f.match);
    finishRoot(f, true);
    expect(f.match.turn).toEqual({ stage: "recovery", waiting: false });
    expect(f.match.room.currentPlayer).toBe("a");
    expect(f.match.room.playerMarks.c.recoveryBreak).toBe(1);
    f.owner.advance(f.match);
    finishRoot(f, true);
    expect(f.match.turn).toEqual({ stage: "normal", waiting: false });
    expect(f.match.room.currentPlayer).toBe("b");
    expect(f.match.room.cardZones.discard.cards).toEqual([0, 4]);
    expect(f.match.room.playerMarks.a.Global_TurnCount).toBe(1);
  });
  it("rejects a coerced completion value rather than treating an array as a completed turn", () => {
    const f = fixture();
    f.owner.advance(f.match);
    drain(f);
    const saved = JSON.parse(JSON.stringify(f.match));
    saved.scheduler.operationCompletion.value = ["turn"];
    expect(() => f.owner.advance(saved)).toThrow();
  });
  it("keeps a cleanup child prompt paused and resumes the real Room catch once after JSON", () => {
    const f = fixture(1);
    f.game.interruptEvent = "CardFinished";
    f.game.playerFlags.a.push("test_InTempMoving");
    f.registry.operations = f.registry.operations!.filter(
      (op) => op.name !== "room-use-cleanup",
    );
    f.registry.operations.push(
      createRoomUseCleanupOperation({
        discardZone: "discard",
        physicalCards: Array.from({ length: 12 }, (_, id) => ({
          id,
          enabled: true,
        })),
        notify: () => ({ name: "cleanup-presentation", data: null }),
      }),
      {
        name: "cleanup-presentation",
        run: ({ game, continuation }) => {
          if (continuation === null) {
            game.playerMarks.c.cleanupNotices =
              (game.playerMarks.c.cleanupNotices ?? 0) + 1;
            return {
              kind: "prompt",
              actor: "b",
              choices: ["no"],
              canCancel: false,
              continuation: true,
            };
          }
          return { kind: "return", value: null };
        },
      },
    );
    f.owner.advance(f.match);
    finishRoot(f, true);
    expect(f.match.turn).toEqual({ stage: "recovery", waiting: false });
    expect(f.match.room.playerMarks.c.cleanupNotices).toBe(1);
    expect(f.match.room.playerFlags.a).not.toContain("test_InTempMoving");
    expect(f.match.room.playerFlags.a).not.toContain("Global_ProcessBroken");
    expect(f.match.room.cardZones.discard.cards).toEqual([0, 4]);
  });
  it.each(["yield", "interruption"] as const)(
    "fails explicitly when the scheduler rejects a trusted %s continuation",
    (boundary) => {
      const f = fixture(boundary === "yield" ? 1 : 10000);
      if (boundary === "interruption") f.game.interruptEvent = "CardFinished";
      f.owner.advance(f.match);
      if (boundary === "yield") {
        let steps = 0;
        while (
          !f.match.scheduler.frames
            .slice(1)
            .some((frame) => frame.kind === "operation")
        ) {
          expect(++steps).toBeLessThan(100);
          expect(f.owner.advance(f.match)).toBe(true);
        }
      } else drain(f);
      const saved = JSON.parse(JSON.stringify(f.match));
      const child = saved.scheduler.frames
        .slice(1)
        .find((frame: { kind: string }) => frame.kind === "operation");
      expect(child).toBeDefined();
      child.operation.name = "unknown-saved-child";
      const before = JSON.stringify(saved);
      expect(() => f.owner.advance(saved)).toThrow("Cannot drive match turn");
      expect(JSON.stringify(saved)).toBe(before);
    },
  );
});
