import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerEvent,
  resumeTriggerPrompt,
  getTriggerPrompt,
  type TriggerRegistry,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";

describe("Hegemony trigger dispatch and resume", () => {
  it.each([
    { shown: false, global: false, canCancel: true },
    { shown: true, global: false, canCancel: false },
    { shown: false, global: true, canCancel: false },
    { shown: true, global: true, canCancel: false },
  ])(
    "uses Wake visibility without global auto-selection: %j",
    ({ shown, global, canCancel }) => {
      const game = { effects: 0 };
      const registry: TriggerRegistry<typeof game> = {
        version: "test-ce4e62b",
        skills: [
          {
            id: "wake",
            events: ["Event"],
            priority: 1,
            triggerable: () => [
              {
                actor: "a",
                owner: "a",
                slot: "head",
                target: "a",
                occurrence: "0",
                wake: true,
                global,
                shown,
              },
            ],
            effect: ({ game }) => {
              game.effects++;
              return { kind: "done", value: false };
            },
          },
        ],
      };
      const scheduler = createTriggerScheduler(["a"], registry.version);
      dispatchTriggerEvent(
        scheduler,
        game,
        registry,
        { name: "Event", target: "a", data: null },
        "a",
      );
      const prompt = getTriggerPrompt(scheduler, "a")!;
      expect(game.effects).toBe(0);
      expect(prompt.canCancel).toBe(canCancel);
      if (!canCancel)
        expect(
          resumeTriggerPrompt(scheduler, game, registry, "a", {
            id: prompt.id,
            choice: null,
          }),
        ).toBe(false);
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      });
      expect(game.effects).toBe(1);
    },
  );
  it("allows cancellation of initial optional offers despite a newly enabled compulsory occurrence", () => {
    const game = { eligible: false, effects: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "earlier",
          events: ["Event"],
          priority: 1,
          triggerable: ({ game }) =>
            game.eligible
              ? [
                  {
                    actor: "a",
                    owner: "a",
                    slot: "head",
                    target: "a",
                    occurrence: "0",
                    shown: true,
                    compulsory: true,
                  },
                ]
              : [],
          effect: ({ game }) => {
            game.effects++;
            return { kind: "done", value: false };
          },
        },
        {
          id: "later",
          events: ["Event"],
          priority: 1,
          record: ({ game }) => {
            game.eligible = true;
          },
          triggerable: () => [
            {
              actor: "a",
              owner: "a",
              slot: "deputy",
              target: "a",
              occurrence: "0",
            },
          ],
          effect: ({ game }) => {
            game.effects++;
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "Event", target: "a", data: null },
      "a",
    );
    const prompt = getTriggerPrompt(scheduler, "a")!;
    expect(prompt.canCancel).toBe(true);
    expect(prompt.choices.map((choice) => choice.skill)).toEqual(["later"]);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: null,
      }),
    ).toBe(true);
    expect(game.effects).toBe(0);
    expect(scheduler.frames).toEqual([]);
  });
  it("does not add an earlier skill enabled by a later record before any trigger attempt", () => {
    const game = { eligible: false, effects: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "earlier",
          events: ["Event"],
          priority: 1,
          triggerable: ({ game }) =>
            game.eligible
              ? [
                  {
                    actor: "a",
                    owner: "a",
                    slot: "head",
                    target: "a",
                    occurrence: "0",
                  },
                ]
              : [],
          effect: ({ game }) => {
            game.effects++;
            return { kind: "done", value: false };
          },
        },
        {
          id: "enable",
          events: ["Event"],
          priority: 1,
          record: ({ game }) => {
            game.eligible = true;
          },
          triggerable: () => [],
          effect: () => ({ kind: "done", value: false }),
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "Event", target: "a", data: null },
      "a",
    );
    expect(scheduler.prompt).toBeNull();
    expect(game.effects).toBe(0);
    expect(scheduler.frames).toEqual([]);
  });

  it.each(["record", "effect"] as const)(
    "rejects invalid event data rewritten by %s before retaining a continuation",
    (stage) => {
      const handler: NonNullable<
        TriggerRegistry<object>["skills"][number]["cost"]
      > = ({ event }) => {
        event.data = NaN;
        return {
          kind: "prompt",
          actor: "a",
          choices: ["yes"],
          canCancel: false,
          continuation: "waiting",
        };
      };
      const registry: TriggerRegistry<object> = {
        version: "test-ce4e62b",
        skills: [
          {
            id: "bad",
            events: ["Event"],
            priority: 1,
            rule: stage === "effect",
            record: stage === "record" ? handler : undefined,
            triggerable: () => [],
            effect:
              stage === "effect"
                ? handler
                : () => ({ kind: "done", value: false }),
          },
        ],
      };
      const scheduler = createTriggerScheduler(["a"], registry.version);
      expect(() =>
        dispatchTriggerEvent(
          scheduler,
          {},
          registry,
          { name: "Event", target: "a", data: 1 },
          "a",
        ),
      ).toThrow("Invalid trigger data");
      expect(scheduler.prompt).toBeNull();
      const failedFrame = scheduler.frames[0];
      if (failedFrame.kind !== "event") throw new Error("Expected event frame");
      expect(failedFrame.event.data).toBe(1);
    },
  );
  it("does not offer a compulsory occurrence invalidated by a later record hook", () => {
    const game = { eligible: true, effects: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "required",
          events: ["DamageDone"],
          priority: 1,
          triggerable: ({ game }) =>
            game.eligible
              ? [
                  {
                    actor: "a",
                    owner: "a",
                    slot: "head",
                    target: "a",
                    occurrence: "0",
                    shown: true,
                    compulsory: true,
                  },
                ]
              : [],
          effect: ({ game }) => {
            game.effects++;
            return { kind: "done", value: false };
          },
        },
        {
          id: "invalidate",
          events: ["DamageDone"],
          priority: 1,
          record: ({ game }) => {
            game.eligible = false;
          },
          triggerable: () => [],
          effect: () => ({ kind: "done", value: false }),
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "DamageDone", target: "a", data: null },
      "a",
    );
    expect(getTriggerPrompt(scheduler, "a")).toBeNull();
    expect(scheduler.frames).toEqual([]);
    expect(game.effects).toBe(0);
  });

  it.each([NaN, Infinity, -Infinity])(
    "rejects non-JSON event data %s before persisting it",
    (value) => {
      const scheduler = createTriggerScheduler(["a"], "test-ce4e62b");
      const registry: TriggerRegistry<object> = {
        version: scheduler.registryVersion,
        skills: [],
      };
      const before = JSON.stringify(scheduler);
      expect(() =>
        dispatchTriggerEvent(
          scheduler,
          {},
          registry,
          { name: "Event", target: "a", data: { nested: [value] } },
          "a",
        ),
      ).toThrow("Invalid trigger data");
      expect(JSON.stringify(scheduler)).toBe(before);
    },
  );

  it("rejects a cyclic event and a non-JSON continuation before creating a prompt", () => {
    const scheduler = createTriggerScheduler(["a"], "test-ce4e62b");
    const registry: TriggerRegistry<object> = {
      version: scheduler.registryVersion,
      skills: [
        {
          id: "bad",
          events: ["Event"],
          priority: 1,
          rule: true,
          effect: () => ({
            kind: "prompt",
            actor: "a",
            choices: ["yes"],
            canCancel: false,
            continuation: { nested: [NaN] },
          }),
        },
      ],
    };
    const data: { [key: string]: TriggerData } = {};
    data.self = data;
    expect(() =>
      dispatchTriggerEvent(
        scheduler,
        {},
        registry,
        { name: "Event", target: "a", data },
        "a",
      ),
    ).toThrow("Invalid trigger data");
    expect(scheduler.frames).toEqual([]);
    expect(() =>
      dispatchTriggerEvent(
        scheduler,
        {},
        registry,
        { name: "Event", target: "a", data: null },
        "a",
      ),
    ).toThrow("Invalid trigger data");
    expect(scheduler.prompt).toBeNull();
  });
  it.each([NaN, Infinity, -Infinity])(
    "rejects invalid priority %s before changing state",
    (priority) => {
      const game = {};
      const registry: TriggerRegistry<typeof game> = {
        version: "test-ce4e62b",
        skills: [
          {
            id: "invalid",
            events: ["DamageDone"],
            priority,
            rule: true,
            effect: () => ({ kind: "done", value: false }),
          },
        ],
      };
      const scheduler = createTriggerScheduler(["a"], registry.version);
      const before = JSON.stringify(scheduler);
      expect(() =>
        dispatchTriggerEvent(
          scheduler,
          game,
          registry,
          { name: "DamageDone", target: "a", data: null },
          "a",
        ),
      ).toThrow("Invalid trigger priority");
      expect(JSON.stringify(scheduler)).toBe(before);
    },
  );
  it.each(["cost", "reveal", "effect"] as const)(
    "reloads a prompt directly in %s without replaying that stage",
    (stage) => {
      const game: { trace: string[] } = { trace: [] };
      const step =
        (
          name: string,
          value: boolean,
        ): NonNullable<
          TriggerRegistry<typeof game>["skills"][number]["cost"]
        > =>
        ({ game, continuation }) => {
          if (continuation === null) {
            game.trace.push(name);
            if (stage === name)
              return {
                kind: "prompt",
                actor: "a",
                choices: ["continue"],
                canCancel: false,
                continuation: "waiting",
              };
          }
          return { kind: "done", value };
        };
      const registry: TriggerRegistry<typeof game> = {
        version: "test-ce4e62b",
        skills: [
          {
            id: "parent",
            events: ["DamageDone"],
            priority: 1,
            triggerable: () => [
              {
                actor: "a",
                owner: "a",
                slot: "head",
                target: "a",
                occurrence: "0",
                global: true,
                compulsory: true,
              },
            ],
            cost: step("cost", true),
            reveal: step("reveal", false),
            effect: step("effect", false),
          },
        ],
      };
      let scheduler = createTriggerScheduler(["a"], registry.version);
      dispatchTriggerEvent(
        scheduler,
        game,
        registry,
        { name: "DamageDone", target: "a", data: null },
        "a",
      );
      scheduler = JSON.parse(JSON.stringify(scheduler));
      const prompt = getTriggerPrompt(scheduler, "a")!;
      expect(
        resumeTriggerPrompt(scheduler, game, registry, "a", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(game.trace).toEqual(["cost", "reveal", "effect"]);
      expect(scheduler.frames).toEqual([]);
      expect(
        resumeTriggerPrompt(scheduler, game, registry, "a", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
    },
  );

  it("consumes only the child event and resumes its parent with the child's result", () => {
    const game: { trace: string[] } = { trace: [] };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "parent",
          events: ["DamageDone"],
          priority: 0,
          rule: true,
          cost: ({ game, continuation, child }) => {
            if (continuation === null)
              return {
                kind: "event",
                event: { name: "Child", target: "a", data: null },
                continuation: "waiting",
              };
            game.trace.push(`child-consumed:${child?.consumed}`);
            return { kind: "done", value: true };
          },
          effect: ({ game }) => {
            game.trace.push("parent");
            return { kind: "done", value: false };
          },
        },
        {
          id: "consume",
          events: ["Child"],
          priority: 2,
          rule: true,
          effect: ({ game }) => {
            game.trace.push("child");
            return { kind: "done", value: true };
          },
        },
        {
          id: "lower",
          events: ["Child"],
          priority: 1,
          rule: true,
          effect: ({ game }) => {
            game.trace.push("must-not-run");
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "DamageDone", target: "a", data: null },
      "a",
    );
    expect(game.trace).toEqual(["child", "child-consumed:true", "parent"]);
    expect(scheduler.completion?.consumed).toBe(false);
    expect(scheduler.interruption).toBeNull();
  });
  it("finishes a nested record hook before collecting that skill's occurrences", () => {
    const game: { trace: string[]; eligible: boolean } = {
      trace: [],
      eligible: false,
    };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "record-parent",
          events: ["DamageDone"],
          priority: 1,
          record: ({ game, continuation }) => {
            if (continuation === null) {
              game.trace.push("record-start");
              return {
                kind: "event",
                event: { name: "RecordChild", target: "a", data: null },
                continuation: "child-started",
              };
            }
            game.trace.push("record-finish");
            return { kind: "done", value: false };
          },
          triggerable: ({ game }) =>
            game.eligible
              ? [
                  {
                    actor: "a",
                    owner: "a",
                    slot: "head",
                    target: "a",
                    occurrence: "0",
                    global: true,
                    compulsory: true,
                  },
                ]
              : [],
          effect: ({ game }) => {
            game.trace.push("parent-effect");
            return { kind: "done", value: false };
          },
        },
        {
          id: "child",
          events: ["RecordChild"],
          priority: 0,
          rule: true,
          effect: ({ game, answer }) => {
            if (!answer)
              return {
                kind: "prompt",
                actor: "a",
                choices: ["continue"],
                canCancel: false,
                continuation: "waiting",
              };
            game.eligible = true;
            game.trace.push("record-child");
            return { kind: "done", value: false };
          },
        },
      ],
    };
    let scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "DamageDone", target: "a", data: null },
      "a",
    );
    expect(game.trace).toEqual(["record-start"]);
    scheduler = JSON.parse(JSON.stringify(scheduler));
    const prompt = getTriggerPrompt(scheduler, "a")!;
    resumeTriggerPrompt(scheduler, game, registry, "a", {
      id: prompt.id,
      choice: "continue",
    });
    expect(game.trace).toEqual([
      "record-start",
      "record-child",
      "record-finish",
      "parent-effect",
    ]);
  });
  it("refreshes eligibility without re-recording and visits deceased seats in current-first order", () => {
    const game: {
      trace: string[];
      changed: boolean;
      alive: Record<string, boolean>;
    } = { trace: [], changed: false, alive: { a: true, b: true, c: false } };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "low",
          events: ["DamageDone"],
          priority: -1,
          rule: true,
          effect: ({ game }) => {
            game.trace.push("low");
            return { kind: "done", value: false };
          },
        },
        {
          id: "change",
          events: ["DamageDone"],
          priority: 2,
          record: ({ game }) => {
            game.trace.push("record:change");
          },
          triggerable: () => [
            {
              actor: "b",
              owner: "b",
              slot: "head",
              target: "a",
              occurrence: "0",
              global: true,
              compulsory: true,
            },
          ],
          effect: ({ game }) => {
            game.changed = true;
            game.trace.push("change");
            return { kind: "done", value: false };
          },
        },
        {
          id: "old",
          events: ["DamageDone"],
          priority: 2,
          record: ({ game }) => {
            game.trace.push("record:old");
          },
          triggerable: ({ game }) =>
            game.changed
              ? []
              : [
                  {
                    actor: "b",
                    owner: "b",
                    slot: "head",
                    target: "a",
                    occurrence: "0",
                  },
                ],
          effect: ({ game }) => {
            game.trace.push("old-must-not-run");
            return { kind: "done", value: false };
          },
        },
        {
          id: "new",
          events: ["DamageDone"],
          priority: 2,
          record: ({ game }) => {
            game.trace.push("record:new");
          },
          triggerable: ({ game }) =>
            game.changed
              ? ["b", "c", "a"].map((actor) => ({
                  actor,
                  owner: actor,
                  slot: null,
                  target: "a",
                  occurrence: "0",
                  global: true,
                  compulsory: true,
                }))
              : [],
          effect: ({ game, selected }) => {
            game.trace.push(selected!.actor!);
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a", "b", "c"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "DamageDone", target: "a", data: null },
      "b",
    );
    expect(game.trace).toEqual([
      "record:change",
      "record:old",
      "record:new",
      "change",
      "b",
      "c",
      "a",
      "low",
    ]);
  });

  it.each([
    { shown: false, equipment: false, canCancel: true },
    { shown: true, equipment: false, canCancel: false },
    { shown: false, equipment: true, canCancel: false },
  ])(
    "uses compulsory visibility at the order prompt: %j",
    ({ shown, equipment, canCancel }) => {
      const game: { trace: string[] } = { trace: [] };
      const registry: TriggerRegistry<typeof game> = {
        version: "test-ce4e62b",
        skills: [
          {
            id: "compulsory",
            events: ["DamageDone"],
            priority: 0,
            triggerable: () => [
              {
                actor: "a",
                owner: "a",
                slot: "head",
                target: "a",
                occurrence: "0",
                compulsory: true,
                shown,
                equipment,
              },
            ],
            cost: ({ game }) => {
              game.trace.push("declined-cost");
              return { kind: "done", value: false };
            },
            reveal: ({ game }) => {
              game.trace.push("must-not-reveal");
              return { kind: "done", value: false };
            },
            effect: ({ game }) => {
              game.trace.push("must-not-effect");
              return { kind: "done", value: false };
            },
          },
        ],
      };
      const scheduler = createTriggerScheduler(["a"], registry.version);
      dispatchTriggerEvent(
        scheduler,
        game,
        registry,
        { name: "DamageDone", target: "a", data: null },
        "a",
      );
      const prompt = getTriggerPrompt(scheduler, "a")!;
      expect(prompt.canCancel).toBe(canCancel);
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      });
      expect(game.trace).toEqual(["declined-cost"]);
      expect(scheduler.frames).toEqual([]);
    },
  );

  it("rejects malformed, foreign, stale and duplicate replies without changing the waiting state", () => {
    const game = { effects: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "choice",
          events: ["DamageDone"],
          priority: 0,
          rule: true,
          effect: ({ game, answer }) => {
            if (!answer)
              return {
                kind: "prompt",
                actor: "a",
                choices: ["yes", "no"],
                canCancel: false,
                continuation: "waiting",
              };
            game.effects++;
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a", "b"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "DamageDone", target: "a", data: null },
      "a",
    );
    const prompt = getTriggerPrompt(scheduler, "a")!;
    const copy = getTriggerPrompt(scheduler, "a")!;
    copy.choices[0].id = "tampered";
    expect(getTriggerPrompt(scheduler, "a")!.choices[0].id).toBe("yes");
    const before = JSON.stringify({ scheduler, game });
    for (const answer of [
      null,
      undefined,
      {},
      { id: prompt.id },
      { id: prompt.id, choice: 1 },
      { id: "old", choice: "yes" },
      { id: prompt.id, choice: "tampered" },
      { id: prompt.id, choice: null },
    ]) {
      expect(resumeTriggerPrompt(scheduler, game, registry, "a", answer)).toBe(
        false,
      );
      expect(JSON.stringify({ scheduler, game })).toBe(before);
    }
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toBe(false);
    expect(
      resumeTriggerPrompt(
        scheduler,
        game,
        { ...registry, version: "different" },
        "a",
        { id: prompt.id, choice: "yes" },
      ),
    ).toBe(false);
    expect(
      dispatchTriggerEvent(
        scheduler,
        game,
        registry,
        { name: "DamageDone", target: "a", data: null },
        "a",
      ),
    ).toBe(false);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toBe(true);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: "yes",
      }),
    ).toBe(false);
    expect(game.effects).toBe(1);
  });
  it("rejects an order reply when its occurrence is no longer eligible", () => {
    const game = { eligible: true, effects: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "optional",
          events: ["DamageDone"],
          priority: 1,
          triggerable: ({ game }) =>
            game.eligible
              ? [
                  {
                    actor: "a",
                    owner: "a",
                    slot: "head",
                    target: "a",
                    occurrence: "0",
                  },
                ]
              : [],
          effect: ({ game }) => {
            game.effects++;
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "DamageDone", target: "a", data: null },
      "a",
    );
    const prompt = getTriggerPrompt(scheduler, "a")!;
    game.eligible = false;
    const before = JSON.stringify(scheduler);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      }),
    ).toBe(false);
    expect(game.effects).toBe(0);
    expect(JSON.stringify(scheduler)).toBe(before);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: null,
      }),
    ).toBe(true);
  });
  it("returns the rewritten event payload for the parent pipeline", () => {
    const game: { amounts: number[] } = { amounts: [] };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "reduce",
          events: ["DamageInflicted"],
          priority: 2,
          rule: true,
          effect: ({ event }) => {
            event.data = { amount: 1 };
            return { kind: "done", value: false };
          },
        },
        {
          id: "observe",
          events: ["DamageInflicted"],
          priority: () => 1,
          rule: true,
          effect: ({ game, event }) => {
            if (
              event.data &&
              typeof event.data === "object" &&
              "amount" in event.data &&
              typeof event.data.amount === "number"
            )
              game.amounts.push(event.data.amount);
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a"], registry.version);
    const input = { name: "DamageInflicted", target: "a", data: { amount: 3 } };
    dispatchTriggerEvent(scheduler, game, registry, input, "a");
    expect(game.amounts).toEqual([1]);
    expect(scheduler.completion?.event.data).toEqual({ amount: 1 });
    expect(input.data).toEqual({ amount: 3 });
  });
  it("offers non-card triggers first and prevents skipping shown compulsory target order", () => {
    const game: { trace: string[] } = { trace: [] };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "cardskill",
          events: ["TargetChosen"],
          priority: 1,
          triggerable: () => [
            {
              actor: "a",
              owner: "a",
              slot: null,
              target: "b",
              occurrence: "0",
              cardSkill: true,
            },
          ],
          effect: ({ game }) => {
            game.trace.push("card");
            return { kind: "done", value: false };
          },
        },
        {
          id: "compulsory",
          events: ["TargetChosen"],
          priority: 1,
          triggerable: () => [
            {
              actor: "a",
              owner: "a",
              slot: "head",
              target: "b",
              occurrence: "b",
              compulsory: true,
              shown: true,
              order: { group: "targets", index: 0 },
            },
            {
              actor: "a",
              owner: "a",
              slot: "head",
              target: "c",
              occurrence: "c",
              compulsory: true,
              shown: true,
              order: { group: "targets", index: 1 },
            },
          ],
          effect: ({ game, selected }) => {
            game.trace.push(selected!.target!);
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a", "b", "c"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "TargetChosen", target: "a", data: null },
      "a",
    );
    for (const target of ["b", "c"]) {
      const prompt = getTriggerPrompt(scheduler, "a")!;
      expect(prompt.choices.map((choice) => choice.target)).toEqual([target]);
      expect(prompt.canCancel).toBe(false);
      const before = JSON.stringify(scheduler);
      expect(
        resumeTriggerPrompt(scheduler, game, registry, "a", {
          id: prompt.id,
          choice: null,
        }),
      ).toBe(false);
      expect(JSON.stringify(scheduler)).toBe(before);
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      });
    }
    const cardPrompt = getTriggerPrompt(scheduler, "a")!;
    expect(cardPrompt.choices.map((choice) => choice.skill)).toEqual([
      "cardskill",
    ]);
    resumeTriggerPrompt(scheduler, game, registry, "a", {
      id: cardPrompt.id,
      choice: cardPrompt.choices[0].id,
    });
    expect(game.trace).toEqual(["b", "c", "card"]);
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "retains suspended parents for explicit cleanup on %s",
    (reason) => {
      const game: { trace: string[] } = { trace: [] };
      const registry: TriggerRegistry<typeof game> = {
        version: "test-ce4e62b",
        skills: [
          {
            id: "parent",
            events: ["DamageDone"],
            priority: 1,
            rule: true,
            cost: ({ continuation }) =>
              continuation === null
                ? {
                    kind: "event",
                    event: { name: "GeneralShown", target: "a", data: null },
                    continuation: "shown",
                  }
                : { kind: "done", value: true },
            effect: ({ game }) => {
              game.trace.push("must-not-run");
              return { kind: "done", value: false };
            },
          },
          {
            id: "interrupt",
            events: ["GeneralShown"],
            priority: 1,
            rule: true,
            effect: () => ({ kind: "interrupt", reason }),
          },
        ],
      };
      const scheduler = createTriggerScheduler(["a"], registry.version);
      dispatchTriggerEvent(
        scheduler,
        game,
        registry,
        { name: "DamageDone", target: "a", data: null },
        "a",
      );
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(scheduler.frames).toHaveLength(2);
      expect(scheduler.prompt).toBeNull();
      expect(game.trace).toEqual([]);
      expect(
        dispatchTriggerEvent(
          scheduler,
          game,
          registry,
          { name: "DamageDone", target: "a", data: null },
          "a",
        ),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, registry, "a", {
          id: "old",
          choice: null,
        }),
      ).toBe(false);
    },
  );
  it("keeps distinct owners, slots and copies, and consumes an ordered target prefix", () => {
    const game: { trace: string[] } = { trace: [] };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "shared",
          events: ["TargetChosen"],
          priority: 1,
          triggerable: () => [
            {
              actor: "a",
              owner: "a",
              slot: "head",
              target: "b",
              occurrence: "target-b",
              order: { group: "targets", index: 0 },
            },
            {
              actor: "a",
              owner: "a",
              slot: "head",
              target: "c",
              occurrence: "target-c",
              order: { group: "targets", index: 1 },
            },
            {
              actor: "a",
              owner: "a",
              slot: "deputy",
              target: "b",
              occurrence: "copy-1",
            },
            {
              actor: "a",
              owner: "a",
              slot: "deputy",
              target: "b",
              occurrence: "copy-2",
            },
            {
              actor: "a",
              owner: "b",
              slot: "head",
              target: "b",
              occurrence: "copy-1",
            },
          ],
          effect: ({ game, selected }) => {
            game.trace.push(
              `${selected!.owner}:${selected!.slot}:${selected!.occurrence}`,
            );
            return { kind: "done", value: false };
          },
        },
      ],
    };
    let scheduler = createTriggerScheduler(["a", "b", "c"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "TargetChosen", target: "a", data: null },
      "a",
    );
    const prompt = getTriggerPrompt(scheduler, "a")!;
    resumeTriggerPrompt(scheduler, game, registry, "a", {
      id: prompt.id,
      choice: prompt.choices[1].id,
    });
    scheduler = JSON.parse(JSON.stringify(scheduler));
    expect(getTriggerPrompt(scheduler, "a")!.choices).toHaveLength(3);
    while (scheduler.prompt) {
      const next = getTriggerPrompt(scheduler, "a")!;
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: next.id,
        choice: next.choices[0].id,
      });
    }
    expect(game.trace).toEqual([
      "a:head:target-c",
      "a:deputy:copy-1",
      "a:deputy:copy-2",
      "b:head:copy-1",
    ]);
  });
  it("resumes a paid cost after a nested move and reveal without replaying payment", () => {
    let game: { trace: string[]; payments: number } = {
      trace: [],
      payments: 0,
    };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "parent",
          events: ["DamageDone"],
          priority: 1,
          triggerable: () => [
            {
              actor: "a",
              owner: "a",
              slot: "deputy",
              target: "b",
              occurrence: "0",
              global: true,
              compulsory: true,
            },
          ],
          cost: ({ game, continuation, child }) => {
            if (continuation === null) {
              game.payments++;
              game.trace.push("pay");
              return {
                kind: "event",
                event: { name: "Move", target: "a", data: null },
                continuation: "paid",
              };
            }
            expect(child?.event.name).toBe("Move");
            game.trace.push("cost-resumed");
            return { kind: "done", value: true };
          },
          reveal: ({ game, continuation }) => {
            if (continuation === null) {
              game.trace.push("reveal");
              return {
                kind: "event",
                event: { name: "GeneralShown", target: "a", data: "deputy" },
                continuation: "shown",
              };
            }
            return { kind: "done", value: false };
          },
          effect: ({ game }) => {
            game.trace.push("parent-effect");
            return { kind: "done", value: false };
          },
        },
        {
          id: "move-rule",
          events: ["Move"],
          priority: 0,
          rule: true,
          effect: ({ game, continuation, answer }) => {
            if (continuation === null)
              return {
                kind: "prompt",
                actor: "b",
                choices: ["confirm"],
                canCancel: false,
                continuation: "waiting",
              };
            expect(answer?.choice).toBe("confirm");
            game.trace.push("move");
            return { kind: "done", value: false };
          },
        },
        {
          id: "show-rule",
          events: ["GeneralShown"],
          priority: 0,
          rule: true,
          effect: ({ game }) => {
            game.trace.push("shown");
            return { kind: "done", value: false };
          },
        },
      ],
    };
    let scheduler = createTriggerScheduler(["a", "b"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "DamageDone", target: "b", data: null },
      "a",
    );
    expect(game.trace).toEqual(["pay"]);
    expect(scheduler.frames).toHaveLength(2);
    scheduler = JSON.parse(JSON.stringify(scheduler));
    game = JSON.parse(JSON.stringify(game));
    const prompt = getTriggerPrompt(scheduler, "b")!;
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: prompt.id,
        choice: "confirm",
      }),
    ).toBe(true);
    expect(game.trace).toEqual([
      "pay",
      "move",
      "cost-resumed",
      "reveal",
      "shown",
      "parent-effect",
    ]);
    expect(game.payments).toBe(1);
    expect(scheduler.frames).toEqual([]);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: prompt.id,
        choice: "confirm",
      }),
    ).toBe(false);
  });
  it("lets the current actor choose equal-priority order and decline optional triggers", () => {
    const game: { trace: string[] } = { trace: [] };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: ["first", "second"].map((id) => ({
        id,
        events: ["DamageDone"],
        priority: 1,
        record: ({ game }) => {
          game.trace.push(`record:${id}`);
        },
        triggerable: () => [
          {
            actor: "b",
            owner: "b",
            slot: "head",
            target: "a",
            occurrence: "0",
          },
        ],
        effect: ({ game }) => {
          game.trace.push(id);
          return { kind: "done", value: false };
        },
      })),
    };
    const scheduler = createTriggerScheduler(["a", "b"], registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "DamageDone", target: "a", data: null },
      "b",
    );
    const prompt = getTriggerPrompt(scheduler, "b")!;
    expect(prompt.choices.map((choice) => choice.skill)).toEqual([
      "first",
      "second",
    ]);
    expect(prompt.canCancel).toBe(true);
    expect(getTriggerPrompt(scheduler, "a")).toBeNull();
    expect(getTriggerPrompt(scheduler, null)).toBeNull();
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: prompt.id,
        choice: prompt.choices[1].id,
      }),
    ).toBe(true);
    expect(game.trace).toEqual(["record:first", "record:second", "second"]);
    const next = getTriggerPrompt(scheduler, "b")!;
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: next.id,
        choice: null,
      }),
    ).toBe(true);
    expect(game.trace).toEqual(["record:first", "record:second", "second"]);
    expect(scheduler.frames).toEqual([]);
  });
  it("records an ordinary skill before cost, reveal and effect, then runs the rule", () => {
    const game: { trace: string[] } = { trace: [] };
    const registry: TriggerRegistry<typeof game> = {
      version: "test-ce4e62b",
      skills: [
        {
          id: "record-skill",
          events: ["DamageDone"],
          priority: 1,
          record: ({ game }) => {
            game.trace.push("record");
          },
          triggerable: () => [
            {
              actor: "a",
              owner: "a",
              slot: "head",
              target: "b",
              occurrence: "0",
              compulsory: true,
              global: true,
            },
          ],
          cost: ({ game }) => {
            game.trace.push("cost");
            return { kind: "done", value: true };
          },
          reveal: ({ game }) => {
            game.trace.push("reveal");
            return { kind: "done", value: false };
          },
          effect: ({ game }) => {
            game.trace.push("effect");
            return { kind: "done", value: false };
          },
        },
        {
          id: "game-rule",
          events: ["DamageDone"],
          priority: 1,
          rule: true,
          effect: ({ game }) => {
            game.trace.push("rule");
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(["a", "b"], registry.version);
    expect(
      dispatchTriggerEvent(
        scheduler,
        game,
        registry,
        { name: "DamageDone", target: "b", data: { amount: 1 } },
        "a",
      ),
    ).toBe(true);
    expect(game.trace).toEqual(["record", "cost", "reveal", "effect", "rule"]);
    expect(scheduler.frames).toEqual([]);
    expect(scheduler.completion?.consumed).toBe(false);
  });
});
