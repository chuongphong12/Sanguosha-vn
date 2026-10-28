import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  continueTriggerWork,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

describe("Hegemony opt-in interruption unwind", () => {
  it("rejects an omitted saved unwind boundary without running normal work", () => {
    const game = { calls: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "missing-boundary",
      unwind: true,
      skills: [],
      operations: [
        {
          name: "owner",
          run: ({ game, continuation }) => {
            game.calls++;
            return continuation === null
              ? {
                  kind: "prompt",
                  actor: "a",
                  choices: ["yes"],
                  canCancel: false,
                  continuation: true,
                }
              : { kind: "return", value: null };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "owner", data: null },
      "a",
    );
    const prompt = getTriggerPrompt(scheduler, "a")!;
    const forged = JSON.parse(JSON.stringify(scheduler));
    forged.unwind = {
      interruption: {
        id: "interruption-99",
        reason: "turn-broken",
        eventId: "operation-1",
      },
    };
    const before = JSON.stringify({ forged, game });
    expect(
      resumeTriggerPrompt(forged, game, registry, "a", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toBe(false);
    expect(JSON.stringify({ forged, game })).toBe(before);
  });

  it("rejects an unknown saved operation before beginning unwind", () => {
    const game = { paid: 1 };
    const registry: TriggerRegistry<typeof game> = {
      version: "missing-operation",
      unwind: true,
      skills: [],
      operations: [
        {
          name: "owner",
          run: () => ({ kind: "interrupt", reason: "turn-broken" }),
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "owner", data: null },
      "a",
    );
    const before = JSON.stringify({ scheduler, game });
    expect(
      unwindTriggerInterruption(
        scheduler,
        game,
        { ...registry, operations: [] },
        scheduler.interruption!,
      ),
    ).toBe(false);
    expect(JSON.stringify({ scheduler, game })).toBe(before);
  });
  it("preserves the existing normal operation receiver for legacy handlers", () => {
    const registry: TriggerRegistry<object> = {
      version: "receiver-v1",
      skills: [],
      operations: [
        {
          name: "receiver",
          run() {
            return { kind: "return", value: this.name };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      {},
      registry,
      { name: "receiver", data: null },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toBe("receiver");
  });
  it("cleans nested owners from inside out without resuming abandoned work", () => {
    const game = { trace: [] as string[], paid: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "unwind-v1",
      unwind: true,
      skills: [],
      operations: [
        {
          name: "outer",
          run: ({ game, continuation }) => {
            if (continuation !== null) throw new Error("Abandoned outer ran");
            game.paid++;
            return {
              kind: "operation",
              operation: { name: "inner", data: null },
              continuation: "outer-paid",
            };
          },
          unwind: ({ game, normalContinuation, interruption }) => {
            game.trace.push(`${normalContinuation}:${interruption.reason}`);
            return { kind: "return", value: null };
          },
        },
        {
          name: "inner",
          run: () => ({ kind: "interrupt", reason: "turn-broken" }),
          unwind: ({ game, normalContinuation }) => {
            game.trace.push(`inner:${normalContinuation}`);
            return { kind: "return", value: null };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a", "b"], registry.version);
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "outer", data: null },
        "a",
      ),
    ).toBe(true);
    expect(game.trace).toEqual([]);
    const stopped = structuredClone(scheduler.interruption!);
    expect(unwindTriggerInterruption(scheduler, game, registry, stopped)).toBe(
      true,
    );
    expect(game.trace).toEqual(["inner:null", "outer-paid:turn-broken"]);
    expect(game.paid).toBe(1);
    expect(scheduler.frames).toEqual([]);
    expect(scheduler.operationCompletion).toBeNull();
    expect(scheduler.unwindCompletion).toEqual(stopped);
    expect(unwindTriggerInterruption(scheduler, game, registry, stopped)).toBe(
      false,
    );
  });

  it("restores a private cleanup prompt and rejects a profile that no longer opts in", () => {
    let game = { paid: 0, cleaned: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "cleanup-prompts-v1",
      unwind: true,
      skills: [],
      operations: [
        {
          name: "paid",
          run: ({ game }) => {
            game.paid++;
            return { kind: "interrupt", reason: "stage-change" };
          },
          unwind: ({ game, continuation, answer }) => {
            if (continuation === null)
              return {
                kind: "prompt",
                actor: "b",
                choices: ["clean"],
                canCancel: false,
                continuation: "waiting",
              };
            if (answer?.choice !== "clean")
              throw new Error("Missing cleanup decision");
            game.cleaned++;
            return { kind: "return", value: "not-a-normal-result" };
          },
        },
      ],
    };
    let scheduler = createTriggerScheduler(["a", "b"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "paid", data: null },
      "a",
    );
    const stopped = structuredClone(scheduler.interruption!);
    expect(
      unwindTriggerInterruption(scheduler, game, registry, {
        ...stopped,
        eventId: "stale",
      }),
    ).toBe(false);
    expect(
      unwindTriggerInterruption(
        scheduler,
        game,
        { ...registry, unwind: false },
        stopped,
      ),
    ).toBe(false);
    expect(unwindTriggerInterruption(scheduler, game, registry, stopped)).toBe(
      true,
    );
    expect(getTriggerPrompt(scheduler, "a")).toBeNull();
    const prompt = getTriggerPrompt(scheduler, "b")!;
    ({ scheduler, game } = JSON.parse(JSON.stringify({ scheduler, game })));
    const before = JSON.stringify({ scheduler, game });
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "paid", data: null },
        "a",
      ),
    ).toBe(false);
    for (const [actor, choice] of [
      ["a", "clean"],
      ["b", "unoffered"],
      ["b", null],
    ] as const)
      expect(
        resumeTriggerPrompt(scheduler, game, registry, actor, {
          id: prompt.id,
          choice,
        }),
      ).toBe(false);
    expect(
      resumeTriggerPrompt(
        scheduler,
        game,
        { ...registry, unwind: false },
        "b",
        { id: prompt.id, choice: "clean" },
      ),
    ).toBe(false);
    expect(JSON.stringify({ scheduler, game })).toBe(before);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: prompt.id,
        choice: "clean",
      }),
    ).toBe(true);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: prompt.id,
        choice: "clean",
      }),
    ).toBe(false);
    expect(game).toEqual({ paid: 1, cleaned: 1 });
    expect(scheduler.operationCompletion).toBeNull();
    expect(scheduler.unwindCompletion).toEqual(stopped);
  });

  it("fences a new interruption in the same cleanup frame from its old receipt", () => {
    const game = { entered: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "reinterrupt-v1",
      unwind: true,
      skills: [],
      operations: [
        {
          name: "owner",
          run: () => ({ kind: "interrupt", reason: "turn-broken" }),
          unwind: ({ game }) => {
            game.entered++;
            return { kind: "interrupt", reason: "turn-broken" };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "owner", data: null },
      "a",
    );
    const first = structuredClone(scheduler.interruption!);
    unwindTriggerInterruption(scheduler, game, registry, first);
    const second = structuredClone(scheduler.interruption!);
    const before = JSON.stringify(scheduler);
    expect(unwindTriggerInterruption(scheduler, game, registry, first)).toBe(
      false,
    );
    expect(JSON.stringify(scheduler)).toBe(before);
    expect(second).not.toEqual(first);
    expect(unwindTriggerInterruption(scheduler, game, registry, second)).toBe(
      true,
    );
    expect(game.entered).toBe(1);
    expect(scheduler.frames).toEqual([]);
    expect(scheduler.unwindCompletion).toEqual(second);
  });

  it("yields bounded normal work and restores it without replaying committed stages", () => {
    let game = { trace: [] as string[] };
    const registry: TriggerRegistry<typeof game> = {
      version: "budget-v1",
      stepBudget: 1,
      skills: [],
      operations: [
        {
          name: "outer",
          run: ({ game, continuation, operationChild }) => {
            if (continuation === null) {
              game.trace.push("outer:start");
              return {
                kind: "operation",
                operation: { name: "inner", data: null },
                continuation: "waiting",
              };
            }
            expect(operationChild?.value).toBe("inner-result");
            game.trace.push("outer:done");
            return { kind: "return", value: "done" };
          },
        },
        {
          name: "inner",
          run: ({ game }) => {
            game.trace.push("inner");
            return { kind: "return", value: "inner-result" };
          },
        },
      ],
    };
    let scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "outer", data: null },
      "a",
    );
    expect(game.trace).toEqual(["outer:start"]);
    expect(scheduler.yielded).toBe(true);
    const before = JSON.stringify({ scheduler, game });
    expect(
      continueTriggerWork(scheduler, game, { ...registry, version: "wrong" }),
    ).toBe(false);
    expect(JSON.stringify({ scheduler, game })).toBe(before);
    for (let i = 0; i < 2; i++) {
      ({ scheduler, game } = JSON.parse(JSON.stringify({ scheduler, game })));
      expect(continueTriggerWork(scheduler, game, registry)).toBe(true);
    }
    expect(game.trace).toEqual(["outer:start", "inner", "outer:done"]);
    expect(scheduler.operationCompletion?.value).toBe("done");
    expect(scheduler.yielded).toBe(false);
    expect(continueTriggerWork(scheduler, game, registry)).toBe(false);
  });

  it("rejects forged cleanup ownership and missing cleanup handlers before accepting a reply", () => {
    const game = { paid: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "ownership-v1",
      unwind: true,
      skills: [],
      operations: [
        {
          name: "owner",
          run: ({ game }) => {
            game.paid++;
            return { kind: "interrupt", reason: "turn-broken" };
          },
          unwind: ({ continuation }) =>
            continuation === null
              ? {
                  kind: "prompt",
                  actor: "a",
                  choices: ["yes"],
                  canCancel: false,
                  continuation: true,
                }
              : { kind: "return", value: null },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "owner", data: null },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    const prompt = getTriggerPrompt(scheduler, "a")!;
    for (const boundary of ["missing", null]) {
      const forged = structuredClone(scheduler);
      forged.unwind!.boundary = boundary;
      const before = JSON.stringify({ forged, game });
      expect(
        resumeTriggerPrompt(forged, game, registry, "a", {
          id: prompt.id,
          choice: "yes",
        }),
      ).toBe(false);
      expect(JSON.stringify({ forged, game })).toBe(before);
    }
    const before = JSON.stringify({ scheduler, game });
    const withoutCatch = {
      ...registry,
      operations: registry.operations!.map(({ name, run }) => ({ name, run })),
    };
    expect(
      resumeTriggerPrompt(scheduler, game, withoutCatch, "a", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toBe(false);
    expect(JSON.stringify({ scheduler, game })).toBe(before);
  });

  it.each([undefined, 1, 5])(
    "resumes cleanup children/events under budget %s with isolated normal continuations",
    (stepBudget) => {
      let state = {
        game: { trace: [] as string[], locals: [] as number[] },
        scheduler: createTriggerScheduler(["a", "b"], "children-v1"),
      };
      const registry: TriggerRegistry<typeof state.game> = {
        version: "children-v1",
        unwind: true,
        stepBudget,
        skills: [
          {
            id: "break",
            events: ["Break"],
            priority: 0,
            rule: true,
            effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
          },
          {
            id: "cleanup",
            events: ["Cleanup"],
            priority: 0,
            rule: true,
            effect: ({ game, continuation }) => {
              if (continuation === null) {
                game.trace.push("cleanup:event");
                return {
                  kind: "prompt",
                  actor: "b",
                  choices: ["yes"],
                  canCancel: false,
                  continuation: true,
                };
              }
              game.trace.push("cleanup:answer");
              return { kind: "done", value: false };
            },
          },
        ],
        operations: [
          {
            name: "owner",
            run: ({ game, continuation }) => {
              if (continuation !== null)
                throw new Error("Abandoned normal continuation");
              game.trace.push("paid");
              return {
                kind: "event",
                event: { name: "Break", target: "a", data: null },
                continuation: { paid: 1 },
              };
            },
            unwind: ({
              game,
              normalContinuation,
              continuation,
              operationChild,
            }) => {
              if (
                !normalContinuation ||
                typeof normalContinuation !== "object" ||
                Array.isArray(normalContinuation) ||
                typeof normalContinuation.paid !== "number"
              )
                throw new Error("Missing normal local");
              game.locals.push(normalContinuation.paid);
              normalContinuation.paid = 99;
              if (continuation === null) {
                game.trace.push("cleanup:start");
                return {
                  kind: "operation",
                  operation: { name: "cleanup-child", data: null },
                  continuation: true,
                };
              }
              expect(operationChild?.value).toBe("child-result");
              game.trace.push("cleanup:done");
              return { kind: "return", value: null };
            },
          },
          {
            name: "cleanup-child",
            run: ({ continuation, child }) =>
              continuation === null
                ? {
                    kind: "event",
                    event: { name: "Cleanup", target: "b", data: "private" },
                    continuation: true,
                  }
                : {
                    kind: "return",
                    value: child?.consumed === false ? "child-result" : "wrong",
                  },
          },
        ],
      };
      function drain() {
        for (let i = 0; state.scheduler.yielded && i < 200; i++) {
          state = JSON.parse(JSON.stringify(state));
          expect(
            continueTriggerWork(state.scheduler, state.game, registry),
          ).toBe(true);
        }
        expect(state.scheduler.yielded).not.toBe(true);
      }
      dispatchTriggerOperation(
        state.scheduler,
        state.game,
        registry,
        { name: "owner", data: null },
        "a",
      );
      drain();
      const stopped = structuredClone(state.scheduler.interruption!);
      expect(
        unwindTriggerInterruption(
          state.scheduler,
          state.game,
          registry,
          stopped,
        ),
      ).toBe(true);
      drain();
      const prompt = getTriggerPrompt(state.scheduler, "b")!;
      expect(prompt).not.toBeNull();
      expect(getTriggerPrompt(state.scheduler, "a")).toBeNull();
      state = JSON.parse(JSON.stringify(state));
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
          id: prompt.id,
          choice: "yes",
        }),
      ).toBe(true);
      drain();
      expect(state.game.trace).toEqual([
        "paid",
        "cleanup:start",
        "cleanup:event",
        "cleanup:answer",
        "cleanup:done",
      ]);
      expect(state.game.locals).toEqual([1, 1]);
      expect(state.scheduler.frames).toEqual([]);
      expect(state.scheduler.unwindCompletion).toEqual(stopped);
      expect(state.scheduler.operationCompletion).toBeNull();
      expect(state.scheduler.nextId).toBeGreaterThan(
        Number(prompt.id.split("-")[1]),
      );
    },
  );

  it("abandons an interrupted catch and propagates the new reason through outer catches", () => {
    const game = { trace: [] as string[] };
    const registry: TriggerRegistry<typeof game> = {
      version: "nested-catch-v1",
      unwind: true,
      skills: [],
      operations: [
        {
          name: "outer",
          run: () => ({
            kind: "operation",
            operation: { name: "inner", data: null },
            continuation: true,
          }),
          unwind: ({ game, interruption }) => {
            game.trace.push(`outer:${interruption.reason}`);
            return { kind: "return", value: null };
          },
        },
        {
          name: "inner",
          run: () => ({ kind: "interrupt", reason: "turn-broken" }),
          unwind: ({ game, continuation }) => {
            if (continuation !== null)
              throw new Error("Re-entered abandoned catch");
            game.trace.push("inner:catch");
            return {
              kind: "operation",
              operation: { name: "cleanup", data: null },
              continuation: true,
            };
          },
        },
        {
          name: "cleanup",
          run: () => ({ kind: "interrupt", reason: "stage-change" }),
          unwind: ({ game, interruption }) => {
            game.trace.push(`child:${interruption.reason}`);
            return { kind: "return", value: null };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "outer", data: null },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    const second = structuredClone(scheduler.interruption!);
    expect(second.reason).toBe("stage-change");
    unwindTriggerInterruption(scheduler, game, registry, second);
    expect(game.trace).toEqual([
      "inner:catch",
      "child:stage-change",
      "outer:stage-change",
    ]);
    expect(scheduler.frames).toEqual([]);
    expect(scheduler.unwindCompletion).toEqual(second);
  });

  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "lets each operation own reason-specific cleanup for %s",
    (reason) => {
      const game = { paid: 0, cleaned: 0 };
      const registry: TriggerRegistry<typeof game> = {
        version: "reasons-v1",
        unwind: true,
        skills: [],
        operations: [
          {
            name: "owner",
            run: ({ game }) => {
              game.paid++;
              return { kind: "interrupt", reason };
            },
            unwind: ({ game, interruption }) => {
              if (interruption.reason !== "game-over") game.cleaned++;
              return { kind: "return", value: null };
            },
          },
        ],
      };
      const scheduler = createTriggerScheduler(["a"], registry.version);
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "owner", data: null },
        "a",
      );
      unwindTriggerInterruption(
        scheduler,
        game,
        registry,
        scheduler.interruption!,
      );
      expect(game).toEqual({
        paid: 1,
        cleaned: reason === "game-over" ? 0 : 1,
      });
      expect(scheduler.operationCompletion).toBeNull();
    },
  );

  it("keeps legacy profiles frozen and validates budgets before allocation", () => {
    const game = { cleaned: false };
    const registry: TriggerRegistry<typeof game> = {
      version: "legacy",
      skills: [],
      operations: [
        {
          name: "owner",
          run: () => ({ kind: "interrupt", reason: "turn-broken" }),
          unwind: ({ game }) => {
            game.cleaned = true;
            return { kind: "return", value: null };
          },
        },
      ],
    };
    for (const stepBudget of [0, -1, 1.5, Infinity]) {
      const scheduler = createTriggerScheduler(["a"], registry.version);
      const before = JSON.stringify(scheduler);
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          { ...registry, stepBudget },
          { name: "owner", data: null },
          "a",
        ),
      ).toThrow("Invalid scheduler step budget");
      expect(JSON.stringify(scheduler)).toBe(before);
    }
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "owner", data: null },
      "a",
    );
    const before = JSON.stringify(scheduler);
    expect(scheduler.interruption).toEqual({
      reason: "turn-broken",
      eventId: "operation-1",
    });
    expect(
      unwindTriggerInterruption(
        scheduler,
        game,
        registry,
        scheduler.interruption!,
      ),
    ).toBe(false);
    expect(continueTriggerWork(scheduler, game, registry)).toBe(false);
    expect(JSON.stringify(scheduler)).toBe(before);
    expect(game.cleaned).toBe(false);
  });

  it("rejects a saved cursor pointing at an enclosing abandoned catch", () => {
    const game = { calls: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "catch-owner-v1",
      unwind: true,
      skills: [],
      operations: [
        {
          name: "outer",
          run: () => ({ kind: "interrupt", reason: "turn-broken" }),
          unwind: ({ game }) => {
            game.calls++;
            return {
              kind: "operation",
              operation: { name: "inner", data: null },
              continuation: true,
            };
          },
        },
        {
          name: "inner",
          run: () => ({ kind: "interrupt", reason: "stage-change" }),
          unwind: () => ({
            kind: "prompt",
            actor: "a",
            choices: ["yes"],
            canCancel: false,
            continuation: true,
          }),
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "outer", data: null },
      "a",
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    unwindTriggerInterruption(
      scheduler,
      game,
      registry,
      scheduler.interruption!,
    );
    const prompt = getTriggerPrompt(scheduler, "a")!;
    const forged = structuredClone(scheduler);
    forged.unwind!.boundary = forged.frames[0].id;
    const before = JSON.stringify({ forged, game });
    expect(
      resumeTriggerPrompt(forged, game, registry, "a", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toBe(false);
    expect(JSON.stringify({ forged, game })).toBe(before);
    const malformed = JSON.parse(JSON.stringify(scheduler));
    delete malformed.frames.at(-1).cleanup.normalContinuation;
    const malformedBefore = JSON.stringify({ malformed, game });
    expect(
      resumeTriggerPrompt(malformed, game, registry, "a", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toBe(false);
    expect(JSON.stringify({ malformed, game })).toBe(malformedBefore);
  });
});
