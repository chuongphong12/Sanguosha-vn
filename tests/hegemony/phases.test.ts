import { describe, expect, it } from "vitest";
import {
  createPhaseOperations,
  skipPhase,
  insertPhase,
  isPhaseSkipped,
  type PhaseGame,
  type Phase,
} from "../../src/game/hegemony/phases";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  continueTriggerWork,
  unwindTriggerInterruption,
  type TriggerRegistry,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";
import { drawingSetup, records } from "./drawing-support";
import {
  createDrawPhaseOperation,
  createDrawPhaseRule,
} from "../../src/game/hegemony/draw-phase";

type Game = PhaseGame & {
  trace: TriggerData[];
  pauses: number;
  chains: number;
  notices: number;
};
function setup() {
  const game: Game = {
    seatOrder: ["a", "b"],
    alive: { a: true, b: true },
    playerPhases: { a: "not-active", b: "not-active" },
    phaseQueues: {
      a: { phases: [], states: [], index: 0 },
      b: { phases: [], states: [], index: 0 },
    },
    trace: [],
    pauses: 0,
    chains: 0,
    notices: 0,
  };
  const registry: TriggerRegistry<Game> = {
    version: "phase-test-v1",
    skills: [
      {
        id: "observe",
        rule: true,
        priority: 10,
        events: [
          "EventPhaseChanging",
          "EventPhaseSkipping",
          "EventPhaseStart",
          "EventPhaseProceeding",
          "EventPhaseEnd",
        ],
        effect: ({ game, event }) => {
          game.trace.push({
            event: event.name,
            phase: game.playerPhases[event.target!],
            data: structuredClone(event.data),
          });
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      ...createPhaseOperations<Game>({ notify: () => null }),
      { name: "free-chain", run: () => ({ kind: "return", value: null }) },
    ],
  };
  return {
    game,
    registry,
    scheduler: createTriggerScheduler(game.seatOrder, registry.version),
  };
}
describe("Native phase ownership", () => {
  it("a direct change removes the queue head only after its phase notice resumes", () => {
    const fixture = setup();
    let state = { game: fixture.game, scheduler: fixture.scheduler };
    const registry = fixture.registry;
    state.game.phaseQueues.a.phases = ["draw", "finish"];
    registry.operations = [
      ...createPhaseOperations<Game>({
        notify: () => ({ name: "notice", data: null }),
      }),
      { name: "free-chain", run: () => ({ kind: "return", value: null }) },
      {
        name: "notice",
        run: ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "b",
                choices: ["go"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "return", value: null },
      },
    ];
    dispatchTriggerOperation(
      state.scheduler,
      state.game,
      registry,
      {
        name: "change-phase",
        data: { target: "a", from: "start", to: "draw" },
      },
      "a",
    );
    expect(state.game.playerPhases.a).toBe("draw");
    expect(state.game.phaseQueues.a.phases).toEqual(["draw", "finish"]);
    const prompt = getTriggerPrompt(state.scheduler, "b")!;
    state = JSON.parse(JSON.stringify(state));
    expect(
      resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
        id: prompt.id,
        choice: "go",
      }),
    ).toBe(true);
    expect(state.game.phaseQueues.a.phases).toEqual(["finish"]);
    expect(state.scheduler.operationCompletion?.value).toBe(false);
  });

  it("an actor dying in Start reaches Proceeding then direct NotActive on the following iteration", () => {
    const { game, registry, scheduler } = setup();
    registry.skills.push({
      id: "die",
      events: ["EventPhaseStart"],
      priority: 20,
      rule: true,
      effect: ({ game }) => {
        game.alive.a = false;
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "play-phases",
        data: { target: "a", phases: ["draw", "finish"] },
      },
      "a",
    );
    expect(
      records(game.trace)
        .filter((x) => x.event === "EventPhaseProceeding")
        .map((x) => x.phase),
    ).toEqual(["draw"]);
    expect(
      records(game.trace).filter((x) => x.event === "EventPhaseEnd"),
    ).toEqual([]);
    expect(game.playerPhases.a).toBe("not-active");
    expect(game.phaseQueues.a.phases).toEqual(["finish", "not-active"]);
  });

  it.each([
    { target: "missing", phases: ["draw"] },
    { target: "a", phases: ["invalid"] },
    { target: "a", phases: "draw" },
    { target: "a", phases: [1] },
    null,
  ])(
    "rejects malformed phase admission before allocating a frame: %j",
    (data) => {
      const { game, registry, scheduler } = setup();
      const before = JSON.stringify({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          registry,
          { name: "play-phases", data },
          "a",
        ),
      ).toThrow();
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    },
  );

  it("rejects malformed queue metadata before play but keeps eager effects on a missing free-chain child", () => {
    const { game, registry, scheduler } = setup();
    game.phaseQueues.a.index = -1;
    const before = JSON.stringify({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "play-phases", data: { target: "a", phases: ["draw"] } },
        "a",
      ),
    ).toThrow("Invalid phase queue");
    expect(JSON.stringify({ game, scheduler })).toBe(before);
    game.phaseQueues.a.index = 0;
    registry.operations = registry.operations!.filter(
      (op) => op.name !== "free-chain",
    );
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "play-phases", data: { target: "a", phases: ["draw"] } },
        "a",
      ),
    ).toThrow("Unknown scheduler operation");
    expect(game.playerPhases.a).toBe("none");
  });

  it("uses the native default eight-phase order", () => {
    const { game, registry, scheduler } = setup();
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "play-phases", data: { target: "a", phases: [] } },
      "a",
    );
    expect(
      records(game.trace)
        .filter((x) => x.event === "EventPhaseStart")
        .map((x) => x.phase),
    ).toEqual([
      "round-start",
      "start",
      "judge",
      "draw",
      "play",
      "discard",
      "finish",
      "not-active",
    ]);
  });

  it("play adopts Changing's destination and a consumed Skipping can restore execution", () => {
    const { game, registry, scheduler } = setup();
    registry.skills.push({
      id: "rewrite",
      events: ["EventPhaseChanging", "EventPhaseSkipping"],
      priority: 20,
      rule: true,
      effect: ({ event }) => {
        if (
          event.name === "EventPhaseChanging" &&
          event.data &&
          typeof event.data === "object" &&
          !Array.isArray(event.data) &&
          event.data.to === "draw"
        ) {
          event.data = { from: "start", to: "play" };
          return { kind: "done", value: true };
        }
        return { kind: "done", value: event.name === "EventPhaseSkipping" };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "play-phases", data: { target: "a", phases: ["draw"] } },
      "a",
    );
    expect(game.phaseQueues.a.states[0]).toEqual({
      phase: "play",
      finished: false,
    });
    expect(
      records(game.trace)
        .filter((x) => x.event === "EventPhaseStart")
        .map((x) => x.phase),
    ).toEqual(["play", "not-active"]);
  });

  it("inserts a repeated phase from a package listener in the live sequence", () => {
    const { game, registry, scheduler } = setup();
    registry.skills.push({
      id: "insert",
      events: ["EventPhaseStart"],
      priority: 20,
      rule: true,
      effect: ({ game }) => {
        if (game.playerPhases.a === "draw" && game.phaseQueues.a.index === 0)
          insertPhase(game, "a", "draw");
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "play-phases", data: { target: "a", phases: ["draw"] } },
      "a",
    );
    expect(
      records(game.trace)
        .filter((x) => x.event === "EventPhaseStart")
        .map((x) => x.phase),
    ).toEqual(["draw", "draw", "not-active"]);
  });

  it("consumed Start suppresses Proceeding while preserving the alive End", () => {
    const { game, registry, scheduler } = setup();
    game.playerPhases.a = "draw";
    registry.skills.push({
      id: "consume",
      events: ["EventPhaseStart"],
      priority: 20,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "execute-phase", data: { target: "a" } },
      "a",
    );
    expect(records(game.trace).map((x) => x.event)).toEqual(["EventPhaseEnd"]);
  });

  it.each(["EventPhaseStart", "EventPhaseProceeding"])(
    "omits End after death at %s but preserves native Proceeding dispatch",
    (point) => {
      const { game, registry, scheduler } = setup();
      game.playerPhases.a = "draw";
      registry.skills.push({
        id: "death",
        events: [point],
        priority: 20,
        rule: true,
        effect: ({ game }) => {
          game.alive.a = false;
          return { kind: "done", value: false };
        },
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "execute-phase", data: { target: "a" } },
        "a",
      );
      expect(records(game.trace).map((x) => x.event)).toEqual([
        "EventPhaseStart",
        "EventPhaseProceeding",
      ]);
    },
  );

  it("a live phase changed to NotActive during End terminates play", () => {
    const { game, registry, scheduler } = setup();
    registry.skills.push({
      id: "terminate",
      events: ["EventPhaseEnd"],
      priority: 20,
      rule: true,
      effect: ({ game }) => {
        game.playerPhases.a = "not-active";
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "play-phases",
        data: { target: "a", phases: ["draw", "finish"] },
      },
      "a",
    );
    expect(
      records(game.trace)
        .filter((x) => x.event === "EventPhaseStart")
        .map((x) => x.phase),
    ).toEqual(["draw"]);
    expect(game.playerPhases.a).toBe("not-active");
  });

  it("composes a real Draw body, movement, RNG and free-chain under the new lifecycle", () => {
    const fixture = drawingSetup();
    const game = Object.assign(fixture.game, {
      phaseQueues: Object.fromEntries(
        fixture.game.seatOrder.map((p) => [
          p,
          {
            phases: [] as Phase[],
            states: [] as { phase: Phase; finished: boolean }[],
            index: 0,
          },
        ]),
      ),
    });
    const registry: TriggerRegistry<typeof game> = {
      ...fixture.rules,
      skills: [...fixture.rules.skills, createDrawPhaseRule()],
      operations: [
        ...fixture.rules.operations!,
        createDrawPhaseOperation(),
        ...createPhaseOperations({ notify: () => null }),
      ],
    };
    dispatchTriggerOperation(
      fixture.scheduler,
      game,
      registry,
      { name: "play-phases", data: { target: "a", phases: ["draw"] } },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([0, 1]);
    expect(game.cardZones.draw.cards).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(game.playerPhases.a).toBe("not-active");
    expect(
      records(game.trace).filter((x) => x.name === "DrawNCards"),
    ).toHaveLength(1);
    expect(
      records(game.trace).filter((x) => x.name === "AfterDrawNCards"),
    ).toHaveLength(1);
    expect(game.pileRandom.state).toBe(1); // No recycle was needed.
    expect(fixture.scheduler.frames).toEqual([]);
  });

  for (const reason of ["turn-broken", "stage-change", "game-over"] as const)
    it.each([
      "EventPhaseChanging",
      "EventPhaseSkipping",
      "EventPhaseStart",
      "EventPhaseProceeding",
      "EventPhaseEnd",
    ])(
      `preserves eager phase state at %s on ${reason} without invented cleanup`,
      (point) => {
        const { game, registry, scheduler } = setup();
        registry.unwind = true;
        registry.skills.push({
          id: "stop",
          events: [point],
          priority: 20,
          rule: true,
          effect: () => ({ kind: "interrupt", reason }),
        });
        if (point === "EventPhaseSkipping")
          registry.skills.push({
            id: "skip",
            events: ["EventPhaseChanging"],
            priority: 20,
            rule: true,
            effect: ({ game }) => {
              skipPhase(game, "a", "draw");
              return { kind: "done", value: false };
            },
          });
        dispatchTriggerOperation(
          scheduler,
          game,
          registry,
          { name: "play-phases", data: { target: "a", phases: ["draw"] } },
          "a",
        );
        const expected = point === "EventPhaseChanging" ? "none" : "draw";
        expect(game.playerPhases.a).toBe(expected);
        const interruption = structuredClone(scheduler.interruption!);
        expect(
          unwindTriggerInterruption(scheduler, game, registry, interruption),
        ).toBe(true);
        expect(game.playerPhases.a).toBe(expected);
        expect(scheduler.unwindCompletion).toEqual(interruption);
        expect(scheduler.frames).toEqual([]);
        expect(records(game.trace).some((x) => x.phase === "not-active")).toBe(
          false,
        );
      },
    );

  it.each([
    "EventPhaseChanging",
    "EventPhaseSkipping",
    "EventPhaseStart",
    "EventPhaseProceeding",
    "EventPhaseEnd",
    "phase-notice",
    "free-chain",
  ])("round-trips JSON and bounded work while paused at %s", (point) => {
    let state = setup();
    const registry = state.registry;
    registry.stepBudget = 3;
    registry.operations = createPhaseOperations<Game>({
      notify: () => ({ name: "phase-notice", data: null }),
    });
    for (const name of ["phase-notice", "free-chain"])
      registry.operations.push({
        name,
        run: ({ game, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          if (name === "phase-notice") game.notices++;
          else game.chains++;
          if (point === name && game.pauses === 0) {
            game.pauses++;
            return {
              kind: "prompt",
              actor: "b",
              choices: ["go"],
              canCancel: false,
              continuation: true,
            };
          }
          return { kind: "return", value: null };
        },
      });
    registry.skills.push({
      id: "pause",
      events: [point],
      priority: 20,
      rule: true,
      effect: ({ game, continuation }) => {
        if (continuation !== null || game.pauses > 0)
          return { kind: "done", value: false };
        game.pauses++;
        return {
          kind: "prompt",
          actor: "b",
          choices: ["go"],
          canCancel: false,
          continuation: true,
        };
      },
    });
    if (point === "EventPhaseSkipping")
      registry.skills.push({
        id: "skip",
        events: ["EventPhaseChanging"],
        priority: 20,
        rule: true,
        effect: ({ game }) => {
          skipPhase(game, "a", "draw");
          return { kind: "done", value: false };
        },
      });
    function drain() {
      for (let i = 0; state.scheduler.yielded && i < 1000; i++) {
        state = JSON.parse(JSON.stringify(state));
        expect(continueTriggerWork(state.scheduler, state.game, registry)).toBe(
          true,
        );
      }
      expect(state.scheduler.yielded).not.toBe(true);
    }
    dispatchTriggerOperation(
      state.scheduler,
      state.game,
      registry,
      { name: "play-phases", data: { target: "a", phases: ["draw"] } },
      "a",
    );
    drain();
    const prompt = getTriggerPrompt(state.scheduler, "b")!;
    expect(prompt).not.toBeNull();
    expect(getTriggerPrompt(state.scheduler, "a")).toBeNull();
    expect(getTriggerPrompt(state.scheduler, null)).toBeNull();
    state = JSON.parse(JSON.stringify(state));
    const before = JSON.stringify(state);
    expect(
      resumeTriggerPrompt(state.scheduler, state.game, registry, "a", {
        id: prompt.id,
        choice: "go",
      }),
    ).toBe(false);
    expect(
      resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
        id: prompt.id,
        choice: "bad",
      }),
    ).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(
      resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
        id: prompt.id,
        choice: "go",
      }),
    ).toBe(true);
    drain();
    expect(
      resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
        id: prompt.id,
        choice: "go",
      }),
    ).toBe(false);
    expect(state.game.pauses).toBe(1);
    expect(state.game.notices).toBe(2);
    expect(state.game.chains).toBe(point === "EventPhaseSkipping" ? 2 : 5);
    expect(state.game.playerPhases.a).toBe("not-active");
    expect(state.scheduler.frames).toEqual([]);
  });

  it("retains the previous phase index when a new play enters its dead-actor branch", () => {
    const { game, registry, scheduler } = setup();
    game.phaseQueues.a = {
      index: 5,
      phases: [],
      states: Array.from({ length: 6 }, () => ({
        phase: "draw" as const,
        finished: false,
      })),
    };
    game.alive.a = false;
    registry.skills.push({
      id: "skip-in-death-change",
      rule: true,
      priority: 20,
      events: ["EventPhaseChanging"],
      effect: ({ game }) => {
        skipPhase(game, "a", "draw");
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "play-phases", data: { target: "a", phases: ["draw"] } },
      "a",
    );
    expect(game.phaseQueues.a.index).toBe(5);
    expect(game.phaseQueues.a.states.map((x) => x.finished)).toEqual([
      false,
      false,
    ]);
  });

  it("a skipped phase continues the queue even when Skipping changes current phase to NotActive", () => {
    const { game, registry, scheduler } = setup();
    registry.skills.push({
      id: "skip",
      rule: true,
      priority: 20,
      events: ["EventPhaseChanging", "EventPhaseSkipping"],
      effect: ({ game, event }) => {
        if (
          event.name === "EventPhaseChanging" &&
          game.phaseQueues.a.index === 0
        )
          skipPhase(game, "a", "draw");
        if (event.name === "EventPhaseSkipping")
          game.playerPhases.a = "not-active";
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "play-phases",
        data: { target: "a", phases: ["draw", "finish"] },
      },
      "a",
    );
    expect(game.trace).toContainEqual({
      event: "EventPhaseStart",
      phase: "finish",
      data: null,
    });
    expect(game.trace).not.toContainEqual({
      event: "EventPhaseStart",
      phase: "draw",
      data: null,
    });
  });

  it("skips the first remaining repeat and inserts after the active index without changing current phase", () => {
    const { game } = setup();
    game.playerPhases.a = "draw";
    game.phaseQueues.a = {
      index: 1,
      phases: ["draw", "draw", "draw", "finish"],
      states: ["draw", "draw", "draw", "finish"].map((phase) => ({
        phase: phase as "draw" | "finish",
        finished: false,
      })),
    };
    expect(skipPhase(game, "a", "draw")).toBe(true);
    expect(skipPhase(game, "a", "draw")).toBe(false);
    expect(isPhaseSkipped(game, "a", "draw")).toBe(true);
    insertPhase(game, "a", "play");
    expect(game.phaseQueues.a.phases).toEqual([
      "draw",
      "draw",
      "play",
      "draw",
      "finish",
    ]);
    expect(game.phaseQueues.a.states.map((x) => x.finished)).toEqual([
      false,
      true,
      false,
      false,
      false,
    ]);
    expect(game.playerPhases.a).toBe("draw");
    expect(skipPhase(game, "a", "judge")).toBe(true); // Native emits the skip log even when absent.
    expect(isPhaseSkipped(game, "a", "judge")).toBe(false);
  });

  it("skip-all still emits Skipping and Start for NotActive", () => {
    const { game, registry, scheduler } = setup();
    registry.skills.push({
      id: "skip-all",
      events: ["EventPhaseChanging"],
      priority: 20,
      rule: true,
      effect: ({ game }) => {
        skipPhase(game, "a", null);
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "play-phases",
        data: { target: "a", phases: ["draw", "finish"] },
      },
      "a",
    );
    expect(
      game.trace.map((x) =>
        typeof x === "object" && x !== null && !Array.isArray(x)
          ? [x.event, x.phase]
          : null,
      ),
    ).toEqual([
      ["EventPhaseChanging", "none"],
      ["EventPhaseSkipping", "draw"],
      ["EventPhaseChanging", "none"],
      ["EventPhaseSkipping", "finish"],
      ["EventPhaseChanging", "none"],
      ["EventPhaseSkipping", "not-active"],
      ["EventPhaseStart", "not-active"],
    ]);
  });

  it("direct change ignores rewritten destination and removes only the pending phase head", () => {
    const { game, registry, scheduler } = setup();
    game.playerPhases.a = "start";
    game.phaseQueues.a.phases = ["play", "finish"];
    game.phaseQueues.a.states = [
      { phase: "play", finished: false },
      { phase: "finish", finished: false },
    ];
    registry.skills.push({
      id: "rewrite",
      events: ["EventPhaseChanging"],
      priority: 20,
      rule: true,
      effect: ({ event }) => {
        event.data = { from: "finish", to: "finish" };
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "change-phase",
        data: { target: "a", from: "start", to: "draw" },
      },
      "a",
    );
    expect(game.playerPhases.a).toBe("draw");
    expect(game.phaseQueues.a.phases).toEqual(["finish"]);
    expect(game.phaseQueues.a.states).toHaveLength(2);
    expect(
      game.trace.map((x) =>
        typeof x === "object" && x !== null && !Array.isArray(x)
          ? x.event
          : null,
      ),
    ).toEqual([
      "EventPhaseChanging",
      "EventPhaseStart",
      "EventPhaseProceeding",
      "EventPhaseEnd",
    ]);
    expect(scheduler.operationCompletion?.value).toBe(false);
  });

  it("returns true from a consumed direct change and restores its supplied from", () => {
    const { game, registry, scheduler } = setup();
    registry.skills.push({
      id: "consume",
      events: ["EventPhaseChanging"],
      priority: 20,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "change-phase",
        data: { target: "a", from: "start", to: "draw" },
      },
      "a",
    );
    expect(game.playerPhases.a).toBe("start");
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.trace).toEqual([]);
  });

  it("sends a dead actor directly to NotActive even when Changing is consumed", () => {
    const { game, registry, scheduler } = setup();
    game.alive.a = false;
    registry.skills.push({
      id: "consume",
      events: ["EventPhaseChanging"],
      priority: 20,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "play-phases", data: { target: "a", phases: ["draw"] } },
      "a",
    );
    expect(game.playerPhases.a).toBe("not-active");
    expect(game.trace).toEqual([
      { event: "EventPhaseStart", phase: "not-active", data: null },
    ]);
  });

  it("plays a custom phase then NotActive Start with one current phase authority", () => {
    const { game, registry, scheduler } = setup();
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "play-phases", data: { target: "a", phases: ["draw"] } },
      "a",
    );
    expect(game.trace).toEqual([
      {
        event: "EventPhaseChanging",
        phase: "none",
        data: { from: "not-active", to: "draw" },
      },
      { event: "EventPhaseStart", phase: "draw", data: null },
      { event: "EventPhaseProceeding", phase: "draw", data: null },
      { event: "EventPhaseEnd", phase: "draw", data: null },
      {
        event: "EventPhaseChanging",
        phase: "none",
        data: { from: "draw", to: "not-active" },
      },
      { event: "EventPhaseStart", phase: "not-active", data: null },
    ]);
    expect(game.playerPhases).toEqual({ a: "not-active", b: "not-active" });
    expect(scheduler.frames).toEqual([]);
  });
});
