import { describe, expect, it } from "vitest";
import { drawingSetup } from "./drawing-support";
import {
  createTurnStartOperations,
  createTurnStartRule,
} from "../../src/game/hegemony/turn-start";
import {
  createNormalTurnOperations,
  type NormalTurnState,
} from "../../src/game/hegemony/turn-order";
import { createPhaseOperations } from "../../src/game/hegemony/phases";
import {
  createPhaseCleanupOperations,
  createPhaseCleanupRule,
} from "../../src/game/hegemony/phase-cleanup";
import {
  createMarkCleanupOperations,
  type LimitMethod,
} from "../../src/game/hegemony/phase-state";
import {
  createDrawPhaseOperation,
  createDrawPhaseRule,
} from "../../src/game/hegemony/draw-phase";
import {
  createTriggerScheduler,
  dispatchTriggerEvent,
  dispatchTriggerOperation,
  continueTriggerWork,
  unwindTriggerInterruption,
  resumeTriggerPrompt,
  getTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

function setup(battleRoyal = false) {
  const f = drawingSetup();
  const game = Object.assign(f.game, {
    cardResources: f.game.cardResources!,
    faceUp: { a: true, b: true, c: true },
    phaseQueues: Object.fromEntries(
      f.game.seatOrder.map((p) => [p, { phases: [], states: [], index: 0 }]),
    ),
    playerIntMarks: Object.fromEntries(
      f.game.seatOrder.map((p) => [p, {} as Record<string, number[]>]),
    ),
    playerStringMarks: Object.fromEntries(
      f.game.seatOrder.map((p) => [p, {} as Record<string, string[]>]),
    ),
    cardLimitations: Object.fromEntries(
      f.game.seatOrder.map((p) => [
        p,
        {} as Partial<Record<LimitMethod, string[]>>,
      ]),
    ),
    pauses: 0,
    breaks: 0,
    turnOrder: { stage: "regular", anchor: null } as NormalTurnState,
  });
  game.playerPhases = { a: "not-active", b: "not-active", c: "not-active" };
  const registry: TriggerRegistry<typeof game> = {
    ...f.rules,
    version: "turns-ce4e62b-v1",
    unwind: true,
    skills: [
      ...f.rules.skills,
      createTurnStartRule(),
      createPhaseCleanupRule(),
      createDrawPhaseRule(),
      {
        id: "turn-trace",
        priority: 20,
        rule: true,
        events: [
          "TurnStart",
          "TurnedOver",
          "TurnBroken",
          "EventPhaseStart",
          "EventPhaseEnd",
        ],
        effect: ({ game, event }) => {
          game.trace.push({
            event: event.name,
            target: event.target,
            phase:
              event.target === null ? null : game.playerPhases[event.target],
          });
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      ...f.rules.operations!,
      ...createNormalTurnOperations<typeof game>(),
      ...createTurnStartOperations<typeof game>({
        battleRoyal,
        playerCount: 3,
        notify: (n) => ({ name: "turn-notice", data: n }),
      }),
      ...createPhaseOperations<typeof game>({
        notify: (target, phase) => ({
          name: "turn-notice",
          data: { kind: "phase", target, phase },
        }),
      }),
      ...createMarkCleanupOperations({
        notify: (n) => ({ name: "turn-notice", data: n }),
      }),
      ...createPhaseCleanupOperations<typeof game>({
        notify: (n) => ({ name: "turn-notice", data: n }),
        skillExists: () => false,
        hasSkill: () => false,
        imperialCard: () => null,
      }),
      createDrawPhaseOperation(),
      {
        name: "turn-notice",
        run: ({ game, operation, continuation }) => {
          if (continuation === null) {
            game.trace.push({ notice: structuredClone(operation.data) });
            if (game.pauses++ > 0)
              return {
                kind: "prompt",
                actor: "a",
                choices: ["go"],
                canCancel: false,
                continuation: true,
              };
          }
          return { kind: "return", value: null };
        },
      },
    ],
  };
  game.pauses = -1000;
  return {
    game,
    registry,
    scheduler: createTriggerScheduler(game.seatOrder, registry.version),
  };
}
function turn(f: ReturnType<typeof setup>, target: string = "a") {
  return dispatchTriggerEvent(
    f.scheduler,
    f.game,
    f.registry,
    { name: "TurnStart", target, data: null },
    f.game.currentPlayer,
  );
}
function notices(trace: TriggerData[]) {
  return trace.flatMap((x) =>
    x && typeof x === "object" && !Array.isArray(x) && x.notice
      ? [x.notice]
      : [],
  );
}
describe("TurnStart GameRule", () => {
  it("does not play phases for a face-up dead actor", () => {
    const f = setup();
    f.game.alive.a = false;
    turn(f);
    expect(f.game.playerMarks.a.Global_TurnCount).toBe(1);
    expect(f.game.playerMarks.a.Global_RoundCount).toBeUndefined();
    expect(f.game.cardZones.a.cards).toEqual([]);
    expect(
      f.game.trace.some(
        (x) =>
          x &&
          typeof x === "object" &&
          !Array.isArray(x) &&
          x.event === "TurnedOver",
      ),
    ).toBe(false);
  });
  it.each(["off", "shown-friends", "already-entered"])(
    "does not enter BattleRoyal for %s",
    (scenario) => {
      const f = setup(scenario !== "off");
      f.game.faceUp.a = false;
      if (scenario === "shown-friends") {
        f.game.identities.a.headShown = true;
        f.game.identities.b.headShown = true;
      }
      if (scenario === "already-entered")
        f.game.cardResources.roomTags.BattleRoyalMode = true;
      turn(f);
      expect(notices(f.game.trace)).not.toContainEqual({
        kind: "battle-lightbox",
      });
      expect(f.game.playerMarks.a.GlobalBattleRoyalMode).toBeUndefined();
    },
  );
  it("uses current revealed relations rather than counting hidden same-kingdom friends", () => {
    const f = setup(true);
    f.game.faceUp.a = false;
    f.game.identities.a.headShown = true;
    f.game.identities.b.headShown = true;
    f.game.identities.b.role = "careerist";
    turn(f);
    expect(f.game.cardResources.roomTags.BattleRoyalMode).toBe(true);
  });
  it.each([1, 4, 10000])(
    "preserves counters, flags and BattleRoyal across every notice/JSON boundary with budget %i",
    (budget) => {
      const f = setup(true);
      f.registry.stepBudget = budget;
      f.game.faceUp.a = false;
      f.game.pauses = 1;
      f.game.cardResources.roomTags.FirstRound = true;
      step(f);
      let decisions = 0,
        yields = 0;
      while (f.scheduler.frames.length) {
        const saved = JSON.parse(
          JSON.stringify({ game: f.game, scheduler: f.scheduler }),
        );
        f.game = saved.game;
        f.scheduler = saved.scheduler;
        if (f.scheduler.yielded) {
          expect(continueTriggerWork(f.scheduler, f.game, f.registry)).toBe(
            true,
          );
          yields++;
          continue;
        }
        const prompt = getTriggerPrompt(f.scheduler, "a")!;
        expect(prompt).not.toBeNull();
        expect(getTriggerPrompt(f.scheduler, "b")).toBeNull();
        const offered = prompt.choices[0].id;
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, "b", {
            id: prompt.id,
            choice: offered,
          }),
        ).toBe(false);
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
            id: prompt.id,
            choice: "unoffered",
          }),
        ).toBe(false);
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
            id: prompt.id,
            choice: offered,
          }),
        ).toBe(true);
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
            id: prompt.id,
            choice: offered,
          }),
        ).toBe(false);
        expect(++decisions).toBeLessThan(50);
      }
      expect(decisions).toBe(13);
      expect(f.game.faceUp.a).toBe(true);
      expect(f.game.playerMarks.a.Global_TurnCount).toBe(1);
      expect(f.game.playerFlags.a).not.toContain("Global_FirstRound");
      expect(
        f.game.seatOrder.map(
          (p) => f.game.playerMarks[p].GlobalBattleRoyalMode,
        ),
      ).toEqual([1, 1, 1]);
      expect(f.game.turnOrder).toEqual({ stage: "extra", anchor: "a" });
      if (budget < 10000) expect(yields).toBeGreaterThan(0);
    },
  );
  it("fails explicitly on a missing real phase child, preserving committed turn counts", () => {
    const f = setup();
    f.registry.operations = f.registry.operations!.filter(
      (op) => op.name !== "play-phases",
    );
    expect(() => turn(f)).toThrow("Unknown scheduler operation");
    expect(f.game.playerMarks.a.Global_TurnCount).toBe(1);
    expect(f.game.playerMarks.a.Global_RoundCount).toBe(1);
  });
  it("uses currentPlayer, increments counters and enters real phases/Draw exactly once", () => {
    const f = setup();
    f.game.cardResources.roomTags.FirstRound = true;
    expect(turn(f, "b")).toBe(true);
    expect(f.game.cardResources.roomTags.FirstRound).toBe(false);
    expect(f.game.playerMarks.a.Global_TurnCount).toBe(1);
    expect(f.game.playerMarks.a.Global_RoundCount).toBe(1);
    expect(f.game.playerMarks.b.Global_TurnCount).toBeUndefined();
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    expect(f.game.playerPhases.a).toBe("not-active");
    expect(f.game.playerFlags.a).not.toContain("Global_FirstRound");
    expect(notices(f.game.trace).slice(0, 4)).toEqual([
      { kind: "flag", target: "a", name: "Global_FirstRound", enabled: true },
      { kind: "separator" },
      { kind: "mark", target: "a", name: "Global_TurnCount", value: 1 },
      {
        kind: "hand-counts",
        players: [
          { target: "a", count: 0 },
          { target: "b", count: 0 },
          { target: "c", count: 0 },
        ],
      },
    ]);
  });
  it("turns a face-down dead actor over, emits TurnedOver and drains free-chain without phases", () => {
    const f = setup();
    f.game.faceUp.a = false;
    f.game.alive.a = false;
    f.game.cardResources.roomTags.FirstRound = true;
    expect(turn(f)).toBe(true);
    expect(f.game.faceUp.a).toBe(true);
    expect(f.game.playerMarks.a.Global_TurnCount).toBe(1);
    expect(f.game.playerMarks.a.Global_RoundCount).toBeUndefined();
    expect(f.game.playerFlags.a).not.toContain("Global_FirstRound");
    expect(f.game.trace).toContainEqual({
      event: "TurnedOver",
      target: "a",
      phase: "not-active",
    });
    expect(f.game.cardZones.a.cards).toEqual([]);
  });
  it("consumes SkipGameRule before resolving currentPlayer", () => {
    const f = setup();
    f.game.currentPlayer = null;
    f.game.cardResources.roomTags.SkipGameRule = true;
    expect(turn(f)).toBe(true);
    expect(f.game.cardResources.roomTags.SkipGameRule).toBeUndefined();
    expect(f.game.trace).toEqual([
      { event: "TurnStart", target: "a", phase: "not-active" },
    ]);
  });
  it("keeps SkipGameRule when a higher priority skill consumes TurnStart", () => {
    const f = setup();
    f.game.cardResources.roomTags.SkipGameRule = true;
    f.registry.skills.unshift({
      id: "consume",
      priority: 100,
      rule: true,
      events: ["TurnStart"],
      effect: () => ({ kind: "done", value: true }),
    });
    turn(f);
    expect(f.game.cardResources.roomTags.SkipGameRule).toBe(true);
    expect(f.game.playerMarks.a.Global_TurnCount).toBeUndefined();
  });
  it("enters optional BattleRoyal only after hand counts and sets living-player marks", () => {
    const f = setup(true);
    f.game.faceUp.a = false;
    turn(f);
    expect(f.game.cardResources.roomTags.BattleRoyalMode).toBe(true);
    expect(
      f.game.seatOrder.map((p) => f.game.playerMarks[p].GlobalBattleRoyalMode),
    ).toEqual([1, 1, 1]);
    expect(notices(f.game.trace).slice(3, 9)).toEqual([
      { kind: "battle-lightbox" },
      { kind: "battle-log" },
      { kind: "battle-start" },
      { kind: "mark", target: "a", name: "GlobalBattleRoyalMode", value: 1 },
      { kind: "mark", target: "b", name: "GlobalBattleRoyalMode", value: 1 },
      { kind: "mark", target: "c", name: "GlobalBattleRoyalMode", value: 1 },
    ]);
  });
});
function step(f: ReturnType<typeof setup>, name = "normal-turn-step") {
  return dispatchTriggerOperation(
    f.scheduler,
    f.game,
    f.registry,
    { name, data: null },
    f.game.currentPlayer,
  );
}
describe("Normal and extra turn order", () => {
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "keeps eager phase state and does not start another turn during %s unwind",
    (reason) => {
      const f = setup();
      f.game.playerPhases.a = "play";
      f.game.playerMarks.a["used-phase"] = 1;
      f.registry.operations = f.registry.operations!.filter(
        (o) => o.name !== "turn-notice",
      );
      f.registry.operations.push({
        name: "turn-notice",
        run: ({ operation }) => {
          const data = operation.data;
          return data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            data.kind === "mark" &&
            data.name === "used-phase"
            ? { kind: "interrupt", reason }
            : { kind: "return", value: null };
        },
      });
      step(f, "recover-normal-turn");
      expect(f.game.playerMarks.a["used-phase"]).toBe(0);
      expect(f.game.currentPlayer).toBe("a");
      expect(
        unwindTriggerInterruption(
          f.scheduler,
          f.game,
          f.registry,
          f.scheduler.interruption!,
        ),
      ).toBe(true);
      expect(f.scheduler.unwindCompletion?.reason).toBe(reason);
      expect(f.game.currentPlayer).toBe("a");
      expect(f.game.playerPhases.a).toBe("play");
      expect(f.game.playerMarks.b.Global_TurnCount).toBeUndefined();
    },
  );
  it("keeps the selected extra turn and regular anchor through JSON cooperative yields", () => {
    const f = setup();
    f.registry.stepBudget = 1;
    f.game.turnOrder = { stage: "extra", anchor: "c" };
    f.game.cardResources.roomTags.ExtraTurnList = ["a", "b"];
    step(f);
    let yields = 0;
    while (f.scheduler.yielded) {
      const saved = JSON.parse(
        JSON.stringify({ game: f.game, scheduler: f.scheduler }),
      );
      f.game = saved.game;
      f.scheduler = saved.scheduler;
      expect(continueTriggerWork(f.scheduler, f.game, f.registry)).toBe(true);
      expect(++yields).toBeLessThan(1000);
    }
    expect(f.game.currentPlayer).toBe("a");
    expect(f.game.turnOrder).toEqual({ stage: "extra", anchor: "c" });
    expect(f.game.cardResources.roomTags.ExtraTurnList).toEqual(["b"]);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    expect(f.game.playerMarks.a.Global_TurnCount).toBe(1);
  });
  it("does not reset or consume another repeated extra turn within one root", () => {
    const f = setup();
    f.game.turnOrder = { stage: "extra", anchor: "b" };
    f.game.cardResources.roomTags.ExtraTurnList = ["a"];
    f.registry.skills.unshift({
      id: "repeat-extra",
      priority: 100,
      rule: true,
      events: ["TurnStart"],
      effect: ({ game }) => {
        game.cardResources.roomTags.ExtraTurnList = ["a"];
        return { kind: "done", value: true };
      },
    });
    for (let i = 0; i < 3; i++) {
      expect(step(f)).toBe(true);
      expect(f.scheduler.frames).toEqual([]);
      expect(f.game.turnOrder).toEqual({ stage: "extra", anchor: "b" });
      expect(f.game.cardResources.roomTags.ExtraTurnList).toEqual(["a"]);
    }
    expect(f.game.trace).toEqual([]);
  });
  it("retains the captured normal next actor when round-cleanup notices change life facts", () => {
    const f = setup();
    f.game.currentPlayer = "c";
    f.game.turnOrder = { stage: "extra", anchor: "c" };
    f.game.playerMarks.c["used-round"] = 1;
    f.registry.operations = f.registry.operations!.filter(
      (o) => o.name !== "turn-notice",
    );
    f.registry.operations.push({
      name: "turn-notice",
      run: ({ game }) => {
        game.alive.a = false;
        return { kind: "return", value: null };
      },
    });
    step(f);
    expect(f.game.currentPlayer).toBe("a");
    expect(f.game.alive.a).toBe(false);
  });
  it("rejects malformed extra-turn state before allocating a root", () => {
    const f = setup();
    f.game.turnOrder = { stage: "extra", anchor: "a" };
    f.game.cardResources.roomTags.ExtraTurnList = [3];
    const before = JSON.stringify({ game: f.game, scheduler: f.scheduler });
    expect(() => step(f)).toThrow("Invalid extra-turn list");
    expect(JSON.stringify({ game: f.game, scheduler: f.scheduler })).toBe(
      before,
    );
  });
  it.each([undefined, null, []])(
    "preserves absent/null versus empty ExtraTurnList (%j)",
    (list) => {
      const f = setup();
      f.game.turnOrder = { stage: "extra", anchor: "a" };
      if (list !== undefined)
        f.game.cardResources.roomTags.ExtraTurnList = list;
      step(f);
      expect(f.game.cardResources.roomTags.ExtraTurnList).toEqual(
        list === null ? null : undefined,
      );
      expect(f.game.currentPlayer).toBe("b");
      expect(f.game.playerMarks.b.Global_TurnCount).toBeUndefined();
    },
  );
  it("resolves displayed head aliases in living-player order and reads newly granted extra turns live", () => {
    const f = setup();
    f.game.turnOrder = { stage: "extra", anchor: "a" };
    f.game.cardResources.roomTags.ExtraTurnList = ["unknown+b-head"];
    f.registry.skills.push({
      id: "grant-extra",
      events: ["TurnStart"],
      priority: 30,
      rule: true,
      effect: ({ game, event }) => {
        if (event.target === "b")
          game.cardResources.roomTags.ExtraTurnList = ["c"];
        return { kind: "done", value: false };
      },
    });
    step(f);
    expect(f.game.currentPlayer).toBe("b");
    step(f);
    expect(f.game.currentPlayer).toBe("c");
    expect(f.game.turnOrder).toEqual({ stage: "extra", anchor: "a" });
  });
  it.each([false, true])(
    "skips dead seats and retains removed living eligibility (%s)",
    (removed) => {
      const f = setup();
      f.game.turnOrder = { stage: "extra", anchor: "a" };
      f.game.removed.b = removed;
      if (!removed) f.game.alive.b = false;
      step(f);
      expect(f.game.currentPlayer).toBe(removed ? "b" : "c");
    },
  );
  it("skips a dead extra-turn alias and removes it before attempting another turn", () => {
    const f = setup();
    f.game.turnOrder = { stage: "extra", anchor: "a" };
    f.game.alive.b = false;
    f.game.livingPlayers = ["a", "c"];
    f.game.cardResources.roomTags.ExtraTurnList = ["b"];
    step(f);
    expect(f.scheduler.operationCompletion?.value).toBe("extra-skipped");
    expect(f.game.cardResources.roomTags.ExtraTurnList).toEqual([]);
    expect(f.game.currentPlayer).toBe("a");
  });
  it("does not advance or consume pending extras after terminal TurnStart", () => {
    const f = setup();
    f.game.cardResources.roomTags.ExtraTurnList = ["c"];
    f.registry.skills.unshift({
      id: "terminal",
      events: ["TurnStart"],
      priority: 100,
      rule: true,
      effect: ({ game }) => {
        game.gameResult = "a";
        return { kind: "done", value: true };
      },
    });
    step(f);
    expect(f.scheduler.operationCompletion?.value).toBe("finished");
    step(f);
    expect(f.scheduler.operationCompletion?.value).toBe("finished");
    expect(f.game.currentPlayer).toBe("a");
    expect(f.game.cardResources.roomTags.ExtraTurnList).toEqual(["c"]);
    expect(f.game.playerMarks.a.Global_TurnCount).toBeUndefined();
  });
  it("captures recovery next after TurnBroken but before cleanup changes life facts", () => {
    const f = setup();
    f.game.playerPhases.a = "play";
    f.game.playerMarks.a["used-phase"] = 1;
    f.registry.skills.push({
      id: "kill-before-next",
      events: ["TurnBroken"],
      priority: 30,
      rule: true,
      effect: ({ game }) => {
        game.alive.b = false;
        return { kind: "done", value: false };
      },
    });
    f.registry.operations = f.registry.operations!.filter(
      (o) => o.name !== "turn-notice",
    );
    f.registry.operations.push({
      name: "turn-notice",
      run: ({ game, operation }) => {
        const data = operation.data;
        if (
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          data.kind === "mark" &&
          data.name === "used-phase"
        ) {
          game.alive.c = false;
          game.alive.b = true;
        }
        return { kind: "return", value: null };
      },
    });
    step(f, "recover-normal-turn");
    expect(f.game.currentPlayer).toBe("c");
    expect(f.game.playerPhases.a).toBe("not-active");
    expect(f.game.alive.c).toBe(false);
  });
  it("does not repeat phase cleanup when recovery starts at NotActive", () => {
    const f = setup();
    f.game.playerFlags.a = ["retained"];
    step(f, "recover-normal-turn");
    expect(f.game.currentPlayer).toBe("b");
    expect(f.game.playerFlags.a).toEqual(["retained"]);
  });
  it("honors the direct GameRule SkipGameRule guard without replaying package End listeners", () => {
    const f = setup();
    f.game.playerPhases.a = "play";
    f.game.playerHistory.a.Slash = 1;
    f.game.cardResources.roomTags.SkipGameRule = true;
    step(f, "recover-normal-turn");
    expect(f.game.playerHistory.a.Slash).toBe(1);
    expect(f.game.playerPhases.a).toBe("not-active");
    expect(f.game.trace).not.toContainEqual({
      event: "EventPhaseEnd",
      target: "a",
      phase: "play",
    });
  });
  it("restarts a freshly broken recovery from live facts after unwind without replaying eager mark removal", () => {
    const f = setup();
    f.game.playerPhases.a = "play";
    f.game.playerMarks.a["used-phase"] = 1;
    f.game.breaks = 1;
    f.registry.operations = f.registry.operations!.filter(
      (o) => o.name !== "turn-notice",
    );
    f.registry.operations.push({
      name: "turn-notice",
      run: ({ game, operation }) => {
        game.trace.push({ notice: operation.data });
        const data = operation.data;
        if (
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          data.kind === "mark" &&
          data.name === "used-phase" &&
          game.breaks-- > 0
        )
          return { kind: "interrupt", reason: "turn-broken" };
        return { kind: "return", value: null };
      },
    });
    step(f, "recover-normal-turn");
    expect(f.game.currentPlayer).toBe("a");
    expect(f.game.playerMarks.a["used-phase"]).toBe(0);
    expect(
      unwindTriggerInterruption(
        f.scheduler,
        f.game,
        f.registry,
        f.scheduler.interruption!,
      ),
    ).toBe(true);
    const saved = JSON.parse(
      JSON.stringify({ game: f.game, scheduler: f.scheduler }),
    );
    f.game = saved.game;
    f.scheduler = saved.scheduler;
    step(f, "recover-normal-turn");
    expect(f.game.currentPlayer).toBe("b");
    expect(
      f.game.trace.filter(
        (x) =>
          x &&
          typeof x === "object" &&
          !Array.isArray(x) &&
          x.event === "TurnBroken",
      ),
    ).toHaveLength(2);
    expect(
      notices(f.game.trace).filter(
        (x) =>
          x &&
          typeof x === "object" &&
          !Array.isArray(x) &&
          x.kind === "mark" &&
          x.name === "used-phase",
      ),
    ).toHaveLength(1);
  });
  it("unwinds a broken Play then runs direct GameRule End and actual NotActive change before advancing", () => {
    const f = setup();
    f.game.breaks = 1;
    f.game.playerMarks.a["used-phase"] = 1;
    f.game.playerFlags.a = ["temporary"];
    f.game.playerHistory.a.Slash = 1;
    f.registry.skills.push({
      id: "break-play",
      events: ["EventPhaseProceeding"],
      rule: true,
      priority: 10,
      effect: ({ game, event }) => {
        if (game.playerPhases[event.target!] === "play" && game.breaks-- > 0)
          return { kind: "interrupt", reason: "turn-broken" };
        return { kind: "done", value: false };
      },
    });
    step(f);
    expect(f.scheduler.interruption?.reason).toBe("turn-broken");
    expect(f.game.playerPhases.a).toBe("play");
    expect(step(f, "recover-normal-turn")).toBe(false);
    expect(
      unwindTriggerInterruption(
        f.scheduler,
        f.game,
        f.registry,
        f.scheduler.interruption!,
      ),
    ).toBe(true);
    expect(step(f, "recover-normal-turn")).toBe(true);
    expect(f.game.currentPlayer).toBe("b");
    expect(f.game.playerPhases.a).toBe("not-active");
    expect(f.game.turnOrder).toEqual({ stage: "regular", anchor: null });
    expect(f.game.playerMarks.a["used-phase"]).toBe(0);
    expect(f.game.playerHistory.a).toEqual({});
    expect(f.game.playerFlags.a).toEqual([]);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    expect(f.game.trace).toContainEqual({
      event: "TurnBroken",
      target: "a",
      phase: "play",
    });
    expect(f.game.trace).not.toContainEqual({
      event: "EventPhaseEnd",
      target: "a",
      phase: "play",
    });
  });
  it("clears typed round marks including dead seats on the native seat wrap", () => {
    const f = setup();
    f.game.currentPlayer = "c";
    f.game.faceUp.c = false;
    f.game.alive.b = false;
    f.game.livingPlayers = ["a", "c"];
    f.game.seats.c = 2;
    f.game.playerMarks.a["used-round"] = 2;
    f.game.playerMarks.b["negative-round"] = -1;
    f.game.playerIntMarks.b["used-round"] = [4];
    f.game.playerStringMarks.c["used-round"] = ["x"];
    step(f);
    step(f);
    expect(f.game.currentPlayer).toBe("a");
    expect(f.game.playerMarks.a["used-round"]).toBe(0);
    expect(f.game.playerMarks.b["negative-round"]).toBe(-1);
    expect(f.game.playerIntMarks.b["used-round"]).toEqual([]);
    expect(f.game.playerStringMarks.c["used-round"]).toEqual([]);
  });
  it("drains live extra turns but advances the normal seat from the original regular actor", () => {
    const f = setup();
    f.game.cardResources.roomTags.ExtraTurnList = ["b", "unknown", "c"];
    step(f);
    expect(f.game.turnOrder).toEqual({ stage: "extra", anchor: "a" });
    step(f);
    expect(f.game.currentPlayer).toBe("b");
    step(f);
    expect(f.scheduler.operationCompletion?.value).toBe("extra-skipped");
    step(f);
    expect(f.game.currentPlayer).toBe("c");
    expect(f.game.cardResources.roomTags.ExtraTurnList).toEqual([]);
    step(f);
    expect(f.game.currentPlayer).toBe("b");
    expect(f.game.turnOrder).toEqual({ stage: "regular", anchor: null });
    expect(f.game.cardResources.roomTags.ExtraTurnList).toBeUndefined();
    expect(
      f.game.seatOrder.map((p) => f.game.playerMarks[p].Global_TurnCount),
    ).toEqual([1, 1, 1]);
  });
});
