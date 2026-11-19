import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import {
  createCardMovementOperation,
  type CardMovementGame,
} from "../../src/game/hegemony/movement";
import {
  createCardOnUseOperation,
  type CardUse,
} from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";

type Game = CardMovementGame & {
  seen: { event: string; target: string | null; data: TriggerData }[];
  applied: CardUse[];
};
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c", "d"],
    alive: { a: true, b: true, c: true, d: true },
    cardZones: {
      hand: { place: "hand", owner: "a", cards: [1] },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    seen: [],
    applied: [],
  };
}
function useData(): CardUse {
  return {
    from: "a",
    to: ["c", "b"],
    card: {
      type: "basic",
      name: "slash",
      className: "Slash",
      skillName: "",
      materialIDs: [1],
      flags: [],
    },
  };
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "card-used-ce4e62b",
    operations: [
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardMovementOperation(),
      createCardUsedOperation({
        use: (data) => ({ name: "apply-use", data }),
      }),
      {
        name: "apply-use",
        run: ({ game, operation }) => {
          game.applied.push(structuredClone(operation.data) as CardUse);
          return { kind: "return", value: null };
        },
      },
    ],
    skills: [
      createCardUsedRule(),
      {
        id: "observe",
        rule: true,
        priority: 1,
        events: [
          "PreCardUsed",
          "TargetSelected",
          "CardUsed",
          "TargetChoosing",
          "TargetConfirming",
          "TargetRecord",
          "TargetChosen",
          "TargetConfirmed",
          "CardFinished",
        ],
        effect: ({ game, event }) => {
          game.seen.push({
            event: event.name,
            target: event.target,
            data: structuredClone(event.data),
          });
          return { kind: "done", value: false };
        },
      },
    ],
  };
}
function dispatch(
  game: Game,
  rules = registry(),
  data: TriggerData = useData(),
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(
    scheduler,
    game,
    rules,
    { name: "card-on-use", data },
    "b",
  );
  return scheduler;
}
function trace(game: Game) {
  return game.seen.map(({ event, target, data }) => [
    event,
    target,
    (data as { index?: number }).index ?? null,
  ]);
}

describe("Hegemony GameRule CardUsed target dispatch", () => {
  it("starts pre-action and Choosing from the payload rewritten before GameRule", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "before-game-rule",
      rule: true,
      priority: 1,
      events: ["CardUsed"],
      effect: ({ event }) => {
        event.data = {
          ...(event.data as CardUse),
          from: "d",
          to: ["a"],
          card: { ...useData().card, name: "peach", className: "Peach" },
        };
        return { kind: "done", value: false };
      },
    });
    rules.operations![2] = createCardUsedOperation({
      preAction: (data) => {
        expect(data.from).toBe("d");
        // Descriptor factories receive copies, not the persisted parent use.
        data.to = [];
        return null;
      },
      use: (data) => ({ name: "apply-use", data }),
    });
    dispatch(game, rules);
    expect(trace(game).slice(3, 8)).toEqual([
      ["TargetChoosing", "d", null],
      ["TargetConfirming", "a", null],
      ["TargetRecord", "d", null],
      ["TargetChosen", "d", 0],
      ["TargetConfirmed", "a", 0],
    ]);
    expect(game.applied).toEqual([
      {
        ...useData(),
        from: "d",
        to: ["a"],
        card: { ...useData().card, name: "peach", className: "Peach" },
        index: 0,
      },
    ]);
    expect(game.seen.at(-1)?.target).toBe("a");
  });
  it("keeps the final Confirmed rewrite in the use child and enclosing CardUsed payload", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "final-confirmed",
      rule: true,
      priority: 0,
      events: ["TargetConfirmed"],
      effect: ({ event }) => {
        if (event.target === "c")
          event.data = {
            ...(event.data as CardUse),
            index: 33,
            to: ["d"],
            nullified_list: ["d"],
            disresponsive_list: ["d"],
          };
        return { kind: "done", value: false };
      },
    });
    const scheduler = dispatch(game, rules);
    const expected = {
      ...useData(),
      to: ["d"],
      index: 33,
      nullified_list: ["d"],
      disresponsive_list: ["d"],
    };
    expect(game.applied).toEqual([expected]);
    expect(scheduler.operationCompletion?.value).toEqual({ data: expected });
  });
  it.each([
    "TargetChoosing",
    "TargetConfirming",
    "TargetRecord",
    "TargetChosen",
    "TargetConfirmed",
    "pre-action",
    "apply-use",
  ])("resumes exactly once after JSON reload at %s", (at) => {
    let game = fixture();
    const rules = registry();
    const baseline = fixture();
    dispatch(baseline);
    if (at === "pre-action") {
      rules.operations![2] = createCardUsedOperation({
        preAction: (data) => ({ name: "pre-action", data }),
        use: (data) => ({ name: "apply-use", data }),
      });
      rules.operations!.push({
        name: "pre-action",
        run: ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "d",
                choices: ["continue"],
                canCancel: false,
                continuation: "waiting",
              }
            : { kind: "return", value: null },
      });
    } else if (at === "apply-use") {
      const apply = rules.operations![3];
      rules.operations![3] = {
        ...apply,
        run: (context) =>
          context.continuation === null
            ? {
                kind: "prompt",
                actor: "d",
                choices: ["continue"],
                canCancel: false,
                continuation: "waiting",
              }
            : apply.run(context),
      };
    } else {
      rules.skills.push({
        id: "pause-target",
        rule: true,
        priority: 0,
        events: [at],
        effect: ({ event, continuation }) => {
          const index = (event.data as { index?: number }).index;
          const first =
            at === "TargetConfirming"
              ? event.target === "b"
              : at === "TargetChosen" || at === "TargetConfirmed"
                ? index === 0
                : true;
          return first && continuation === null
            ? {
                kind: "prompt",
                actor: "d",
                choices: ["continue"],
                canCancel: false,
                continuation: "waiting",
              }
            : { kind: "done", value: false };
        },
      });
    }
    let scheduler = dispatch(game, rules);
    expect(game.applied).toEqual([]);
    expect(game.cardZones.table.cards).toEqual([1]);
    const prompt = getTriggerPrompt(scheduler, "d")!;
    expect(prompt).not.toBeNull();
    expect(getTriggerPrompt(scheduler, "a")).toBeNull();
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "d", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(game).toEqual(baseline);
    expect(scheduler.frames).toEqual([]);
    const finished = JSON.stringify({ game, scheduler });
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "d", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(finished);
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes parents without normal finish/cleanup on %s",
    (reason) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "break-target",
        rule: true,
        priority: 0,
        events: ["TargetConfirmed"],
        effect: () => ({ kind: "interrupt", reason }),
      });
      const scheduler = dispatch(game, rules);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(game.applied).toEqual([]);
      expect(game.seen.at(-1)?.event).toBe("TargetConfirmed");
      expect(game.cardZones.table.cards).toEqual([1]);
      expect(game.cardZones.discard.cards).toEqual([]);
      expect(JSON.parse(JSON.stringify(scheduler))).toEqual(scheduler);
    },
  );
  it("composes a nested onUse during Chosen without replacing the parent payload or cursor", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "nested-use",
      rule: true,
      priority: 0,
      events: ["TargetChosen"],
      effect: ({ event, continuation }) => {
        const data = event.data as CardUse & {
          index?: number;
          nested?: boolean;
        };
        return !data.nested && data.index === 0 && continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "card-on-use",
                data: {
                  ...useData(),
                  from: "c",
                  to: ["d"],
                  card: { ...useData().card, materialIDs: [] },
                  nested: true,
                },
              },
              continuation: "nested-finished",
            }
          : { kind: "done", value: false };
      },
    });
    const scheduler = dispatch(game, rules);
    expect(game.applied).toEqual([
      {
        ...useData(),
        from: "c",
        to: ["d"],
        card: { ...useData().card, materialIDs: [] },
        nested: true,
        index: 0,
      },
      { ...useData(), to: ["b", "c"], index: 1 },
    ]);
    expect(
      game.seen
        .filter((entry) => entry.event === "CardFinished")
        .map((entry) => entry.target),
    ).toEqual(["c", "a"]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(scheduler.frames).toEqual([]);
  });
  it.each([
    null,
    { ...useData(), from: "foreign" },
    { ...useData(), to: ["b", "b"] },
    { ...useData(), card: { ...useData().card, materialIDs: [-1] } },
  ])(
    "rejects malformed standalone CardUsed before allocating frames: %j",
    (data) => {
      const game = fixture();
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = JSON.stringify({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-used", data },
          "b",
        ),
      ).toThrow("Invalid card use");
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    },
  );
  it("allows a standalone target contract whose material is already absent and ignores use child returns", () => {
    const game = fixture();
    game.cardZones.hand.cards = [];
    const rules = registry();
    const apply = rules.operations![3];
    rules.operations![3] = {
      ...apply,
      run: (context) => {
        apply.run(context);
        return { kind: "return", value: { data: { ...useData(), to: [] } } };
      },
    };
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-used", data: useData() },
      "b",
    );
    expect(game.applied[0].to).toEqual(["c", "b"]);
    expect(scheduler.operationCompletion?.value).toEqual({
      data: { ...useData(), index: 1 },
    });
    expect(game.cardZones.discard.cards).toEqual([]);
  });
  it.each([
    "TargetChoosing",
    "TargetConfirming",
    "TargetRecord",
    "TargetChosen",
    "TargetConfirmed",
  ])(
    "ignores the consumed return of %s and continues native caller flow",
    (eventName) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "consume-target",
        rule: true,
        priority: 0,
        events: [eventName],
        effect: () => ({ kind: "done", value: true }),
      });
      dispatch(game, rules);
      expect(game.applied).toEqual([
        { ...useData(), to: ["b", "c"], index: 1 },
      ]);
      expect(game.seen.at(-1)?.event).toBe("CardFinished");
      expect(game.cardZones.discard.cards).toEqual([1]);
    },
  );
  it("allows a same-band player to consume CardUsed before the priority-zero GameRule", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "consume-card-used",
      priority: 0,
      events: ["CardUsed"],
      triggerable: () => [
        {
          actor: "b",
          owner: "b",
          slot: null,
          target: "b",
          occurrence: "consume",
          compulsory: true,
          shown: true,
        },
      ],
      effect: () => ({ kind: "done", value: true }),
    });
    const scheduler = dispatch(game, rules);
    const prompt = getTriggerPrompt(scheduler, "b")!;
    if (prompt.kind !== "order") throw new Error("Expected ordering prompt");
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      }),
    ).toBe(true);
    expect(game.applied).toEqual([]);
    expect(game.seen.map((entry) => entry.event)).toEqual([
      "PreCardUsed",
      "TargetSelected",
      "CardUsed",
      "CardFinished",
    ]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it("hands the latest rewritten use to lower-priority CardUsed handlers before CardFinished", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push(
      {
        id: "modify-chosen",
        rule: true,
        priority: 0,
        events: ["TargetChosen"],
        effect: ({ event }) => {
          event.data = {
            ...(event.data as CardUse),
            index: 99,
            to: ["d"],
            marker: "changed",
          };
          return { kind: "done", value: false };
        },
      },
      {
        id: "after-game-rule",
        rule: true,
        priority: -1,
        events: ["CardUsed"],
        effect: ({ game, event }) => {
          game.seen.push({
            event: "after-rule",
            target: event.target,
            data: structuredClone(event.data),
          });
          expect(game.applied).toHaveLength(1);
          return { kind: "done", value: false };
        },
      },
    );
    dispatch(game, rules);
    expect(trace(game).slice(7, 11)).toEqual([
      ["TargetChosen", "a", 0],
      ["TargetChosen", "a", 1],
      ["TargetConfirmed", "b", 0],
      ["TargetConfirmed", "c", 1],
    ]);
    expect(game.seen.at(-2)?.data).toEqual({
      ...useData(),
      to: ["d"],
      marker: "changed",
      index: 1,
    });
    expect(game.seen.at(-1)?.data).toEqual(game.applied[0]);
  });
  it.each([
    "TargetChoosing",
    "TargetConfirming",
    "TargetRecord",
    "TargetChosen",
    "TargetConfirmed",
  ])("rejects malformed %s rewrites before calling use", (eventName) => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "bad-rewrite",
      rule: true,
      priority: 0,
      events: [eventName],
      effect: ({ event }) => {
        event.data = { ...(event.data as CardUse), to: ["foreign"] };
        return { kind: "done", value: false };
      },
    });
    expect(() => dispatch(game, rules)).toThrow("Invalid card use");
    expect(game.applied).toEqual([]);
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });
  it("confirms only candidates still present in the post-Choosing snapshot", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "rewrite-confirming",
      rule: true,
      priority: 0,
      events: ["TargetConfirming"],
      effect: ({ event }) => {
        if (event.target === "b")
          event.data = { ...(event.data as CardUse), to: ["b", "d"] };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(
      game.seen
        .filter((entry) => entry.event === "TargetConfirming")
        .map((entry) => entry.target),
    ).toEqual(["b"]);
    expect(
      game.seen
        .filter((entry) => entry.event === "TargetConfirmed")
        .map((entry) => entry.target),
    ).toEqual(["b", "d"]);
    expect(game.applied[0].to).toEqual(["b", "d"]);
  });
  it("retains the pre-Record source, length and recipients despite payload rewrites", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "rewrite-record",
      rule: true,
      priority: 0,
      events: ["TargetRecord"],
      effect: ({ event }) => {
        event.data = {
          ...(event.data as CardUse),
          from: "d",
          to: [],
          marker: "rewritten",
        };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(trace(game).slice(7, 11)).toEqual([
      ["TargetChosen", "a", 0],
      ["TargetChosen", "a", 1],
      ["TargetConfirmed", "b", 0],
      ["TargetConfirmed", "c", 1],
    ]);
    expect(game.applied).toEqual([
      { ...useData(), from: "d", to: [], marker: "rewritten", index: 1 },
    ]);
    expect(game.seen.at(-1)?.data).toEqual(game.applied[0]);
  });
  it("adopts Choosing replacements in their supplied order without filtering dead seats", () => {
    const game = fixture();
    game.alive.c = false;
    const rules = registry();
    rules.skills.push({
      id: "rewrite-choosing",
      rule: true,
      priority: 0,
      events: ["TargetChoosing"],
      effect: ({ event }) => {
        event.data = { ...(event.data as CardUse), from: "c", to: ["d", "c"] };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(trace(game).slice(4, 11)).toEqual([
      ["TargetConfirming", "d", null],
      ["TargetConfirming", "c", null],
      ["TargetRecord", "c", null],
      ["TargetChosen", "c", 0],
      ["TargetChosen", "c", 1],
      ["TargetConfirmed", "d", 0],
      ["TargetConfirmed", "c", 1],
    ]);
    expect(game.applied[0].to).toEqual(["d", "c"]);
  });
  it.each(["initial", "TargetChoosing", "TargetConfirming"])(
    "still calls use when targets become empty at %s",
    (at) => {
      const game = fixture();
      const rules = registry();
      if (at !== "initial")
        rules.skills.push({
          id: "clear-targets",
          rule: true,
          priority: 0,
          events: [at],
          effect: ({ event }) => {
            event.data = { ...(event.data as CardUse), to: [] };
            return { kind: "done", value: false };
          },
        });
      dispatch(game, rules, {
        ...useData(),
        to: at === "initial" ? [] : ["b", "c"],
      });
      expect(game.applied).toHaveLength(1);
      expect(game.applied[0].to).toEqual([]);
      expect(
        game.seen.some((entry) =>
          ["TargetRecord", "TargetChosen", "TargetConfirmed"].includes(
            entry.event,
          ),
        ),
      ).toBe(false);
      expect(
        game.seen.filter((entry) => entry.event === "TargetConfirming"),
      ).toHaveLength(at === "TargetConfirming" ? 1 : 0);
      expect(
        game.seen.filter((entry) => entry.event === "TargetChoosing"),
      ).toHaveLength(at === "initial" ? 0 : 1);
      expect(game.cardZones.discard.cards).toEqual([1]);
    },
  );
  it("runs optional pre-action before target triggers and ignores its void return", () => {
    const game = fixture();
    const rules = registry();
    rules.operations![2] = createCardUsedOperation({
      preAction: (data) => ({ name: "pre-action", data }),
      use: (data) => ({ name: "apply-use", data }),
    });
    rules.operations!.push({
      name: "pre-action",
      run: ({ game, operation }) => {
        game.seen.push({
          event: "pre-action",
          target: null,
          data: operation.data,
        });
        return { kind: "return", value: { data: { ...useData(), to: [] } } };
      },
    });
    dispatch(game, rules);
    expect(trace(game).slice(2, 5)).toEqual([
      ["CardUsed", "a", null],
      ["pre-action", null, null],
      ["TargetChoosing", "a", null],
    ]);
    expect(game.applied[0].to).toEqual(["b", "c"]);
  });
  it("runs choosing/confirmation and indexed target events before the use child", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(trace(game)).toEqual([
      ["PreCardUsed", "a", null],
      ["TargetSelected", "a", null],
      ["CardUsed", "a", null],
      ["TargetChoosing", "a", null],
      ["TargetConfirming", "b", null],
      ["TargetConfirming", "c", null],
      ["TargetRecord", "a", null],
      ["TargetChosen", "a", 0],
      ["TargetChosen", "a", 1],
      ["TargetConfirmed", "b", 0],
      ["TargetConfirmed", "c", 1],
      ["CardFinished", "a", 1],
    ]);
    expect(game.applied).toEqual([{ ...useData(), to: ["b", "c"], index: 1 }]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(scheduler.frames).toEqual([]);
  });
});
