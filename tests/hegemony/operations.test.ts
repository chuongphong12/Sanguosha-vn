import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

describe("Hegemony operation dispatch and resume", () => {
  it("reloads nested operation prompts and returns each result to its own parent", () => {
    let game = { trace: [] as string[] };
    const registry: TriggerRegistry<typeof game> = {
      version: "operations-ce4e62b",
      skills: [],
      operations: [
        {
          name: "outer",
          run: ({ game, continuation, operationChild }) => {
            if (continuation === null) {
              game.trace.push("outer:start");
              return {
                kind: "operation",
                operation: { name: "inner", data: "private" },
                continuation: "waiting",
              };
            }
            game.trace.push(`outer:${JSON.stringify(operationChild?.value)}`);
            return { kind: "return", value: "outer-result" };
          },
        },
        {
          name: "inner",
          run: ({ game, continuation, answer }) => {
            if (continuation === null) {
              game.trace.push("inner:start");
              return {
                kind: "prompt",
                actor: "a",
                choices: ["yes", "no"],
                canCancel: false,
                continuation: "waiting",
              };
            }
            game.trace.push(`inner:${answer?.choice}`);
            return {
              kind: "return",
              value: { accepted: answer?.choice === "yes" },
            };
          },
        },
      ],
    };
    let scheduler = createTriggerScheduler(["a", "b"], registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "outer", data: null },
      "b",
    );
    expect(game.trace).toEqual(["outer:start", "inner:start"]);
    expect(getTriggerPrompt(scheduler, "b")).toBeNull();
    const prompt = getTriggerPrompt(scheduler, "a")!;
    ({ scheduler, game } = JSON.parse(JSON.stringify({ scheduler, game })));
    const frozen = JSON.stringify({ scheduler, game });
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: null,
      }),
    ).toBe(false);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toBe(false);
    expect(JSON.stringify({ scheduler, game })).toBe(frozen);
    resumeTriggerPrompt(scheduler, game, registry, "a", {
      id: prompt.id,
      choice: "yes",
    });
    expect(game.trace).toEqual([
      "outer:start",
      "inner:start",
      "inner:yes",
      'outer:{"accepted":true}',
    ]);
    expect(scheduler.operationCompletion).toEqual({
      operation: { name: "outer", data: null },
      value: "outer-result",
    });
    expect(scheduler.completion).toBeNull();
    expect(scheduler.frames).toEqual([]);
  });
  it("rejects unknown/duplicate operations and wrong-version or foreign-actor dispatch atomically", () => {
    const game = {};
    const registry: TriggerRegistry<typeof game> = {
      version: "v1",
      skills: [],
      operations: [
        { name: "noop", run: () => ({ kind: "return", value: null }) },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    const before = JSON.stringify(scheduler);
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "missing", data: null },
        "a",
      ),
    ).toThrow("Unknown scheduler operation");
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        {
          ...registry,
          operations: [...registry.operations!, ...registry.operations!],
        },
        { name: "noop", data: null },
        "a",
      ),
    ).toThrow("Duplicate scheduler operation");
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        { ...registry, version: "v2" },
        { name: "noop", data: null },
        "a",
      ),
    ).toBe(false);
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "noop", data: null },
        "b",
      ),
    ).toBe(false);
    expect(JSON.stringify(scheduler)).toBe(before);
  });
  it("restores an invalid rewritten operation payload before retaining it", () => {
    const game = {};
    const registry: TriggerRegistry<typeof game> = {
      version: "v1",
      skills: [],
      operations: [
        {
          name: "bad",
          run: ({ operation }) => {
            operation.data = { invalid: NaN };
            return {
              kind: "prompt",
              actor: "a",
              choices: ["ok"],
              canCancel: false,
              continuation: null,
            };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "bad", data: 1 },
        "a",
      ),
    ).toThrow("Invalid trigger data");
    const frame = scheduler.frames[0];
    if (frame.kind !== "operation") throw new Error("Expected operation frame");
    expect(frame.operation.data).toBe(1);
    expect(scheduler.prompt).toBeNull();
  });
});
