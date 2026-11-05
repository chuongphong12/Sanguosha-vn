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
  createCardEffectOperation,
  type CardEffect,
  type CardEffectGame,
} from "../../src/game/hegemony/card-effect";

type Game = CardEffectGame & {
  seen: { name: string; target: string | null; data: TriggerData }[];
  results: TriggerData[];
};
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    cardZones: {},
    playerFlags: { a: [], b: [], c: [] },
    seen: [],
    results: [],
  };
}
function effectData(): CardEffect {
  return {
    from: "a",
    to: "b",
    card: {
      type: "trick",
      name: "duel",
      className: "Duel",
      skillName: "",
      materialIDs: [],
      flags: [],
    },
    multiple: false,
    nullified: false,
    disresponsive: false,
  };
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "card-effect-ce4e62b",
    operations: [
      createCardEffectOperation({
        isSlash: (_game, effect) => effect.card.className === "Slash",
      }),
      {
        name: "observe-result",
        run: ({ game, operation, operationChild }) => {
          if (!operationChild)
            return {
              kind: "operation",
              operation: { name: "card-effect", data: operation.data },
              continuation: true,
            };
          game.results.push(operationChild.value);
          return { kind: "return", value: null };
        },
      },
    ],
    skills: [
      {
        id: "observe-effect-events",
        rule: true,
        priority: 1,
        events: ["CardEffect", "CardEffected", "PostCardEffected"],
        effect: ({ game, event }) => {
          game.seen.push({
            name: event.name,
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
  data: TriggerData = effectData(),
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(
    scheduler,
    game,
    rules,
    { name: "observe-result", data },
    "a",
  );
  return scheduler;
}

describe("Hegemony Room cardEffect dispatch", () => {
  it("passes a dead Slash and a null source through all events", () => {
    const game = fixture();
    game.alive.b = false;
    const data = effectData();
    data.from = null;
    data.card.className = "Slash";
    dispatch(game, registry(), data);
    expect(game.seen.map(({ name }) => name)).toEqual([
      "CardEffect",
      "CardEffected",
      "PostCardEffected",
    ]);
    expect(
      game.seen.every((entry) => (entry.data as CardEffect).from === null),
    ).toBe(true);
    expect(game.results).toEqual([true]);
  });

  it.each(["CardEffect", "PostCardEffected"])(
    "ignores %s consumption and retains the original non-skill flag",
    (name) => {
      const game = fixture();
      game.playerFlags.b = ["Global_NonSkillNullify"];
      const rules = registry();
      rules.skills.push({
        id: "consume-other-event",
        rule: true,
        priority: 0,
        events: [name],
        effect: () => ({ kind: "done", value: true }),
      });
      dispatch(game, rules);
      expect(game.results).toEqual([true]);
      expect(game.playerFlags.b).toEqual(["Global_NonSkillNullify"]);
      expect(game.seen.map((entry) => entry.name)).toEqual([
        "CardEffect",
        "CardEffected",
        "PostCardEffected",
      ]);
    },
  );

  it("does not recheck eligibility or redirect event recipients after CardEffect rewrites", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "rewrite-first-effect",
      rule: true,
      priority: 0,
      events: ["CardEffect"],
      effect: ({ game, event }) => {
        game.alive.b = false;
        game.alive.c = false;
        event.data = {
          ...(event.data as CardEffect),
          from: null,
          to: "c",
          nullified: true,
          extra: { keep: 1 },
        };
        return { kind: "done", value: true };
      },
    });
    dispatch(game, rules);
    expect(game.seen.slice(1)).toMatchObject([
      {
        name: "CardEffected",
        target: "b",
        data: { from: null, to: "c", nullified: true, extra: { keep: 1 } },
      },
      {
        name: "PostCardEffected",
        target: "b",
        data: { from: null, to: "c", nullified: true, extra: { keep: 1 } },
      },
    ]);
    expect(game.results).toEqual([true]);
  });

  it("uses copied live game/card ancestry data without permitting predicate mutations", () => {
    const game = fixture();
    game.alive.b = false;
    const rules = registry();
    rules.operations![0] = createCardEffectOperation({
      isSlash: (snapshot, data) => {
        const slash = !snapshot.alive.b;
        snapshot.alive.b = true;
        snapshot.playerFlags.b.push("leak");
        data.to = "c";
        return slash;
      },
    });
    dispatch(game, rules);
    expect(game.alive.b).toBe(false);
    expect(game.playerFlags.b).toEqual([]);
    expect(
      game.seen.every(
        (entry) =>
          entry.target === "b" && (entry.data as CardEffect).to === "b",
      ),
    ).toBe(true);
    expect(game.results).toEqual([true]);
  });

  it.each(["CardEffect", "CardEffected", "PostCardEffected"])(
    "resumes %s from JSON exactly once",
    (name) => {
      const game = fixture();
      game.playerFlags.b = ["Global_NonSkillNullify"];
      const rules = registry();
      rules.skills.push({
        id: "pause-effect",
        rule: true,
        priority: 0,
        events: [name],
        effect: ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "b",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "done", value: name === "CardEffected" },
      });
      const scheduler = dispatch(game, rules);
      const restored = JSON.parse(JSON.stringify({ game, scheduler })) as {
        game: Game;
        scheduler: typeof scheduler;
      };
      const prompt = getTriggerPrompt(restored.scheduler, "b")!;
      expect(getTriggerPrompt(restored.scheduler, "a")).toBeNull();
      expect(
        resumeTriggerPrompt(restored.scheduler, restored.game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(restored.game.seen.map((entry) => entry.name)).toEqual([
        "CardEffect",
        "CardEffected",
        "PostCardEffected",
      ]);
      expect(restored.game.results).toEqual([name !== "CardEffected"]);
      expect(restored.game.playerFlags.b).toEqual(
        name === "CardEffected" ? [] : ["Global_NonSkillNullify"],
      );
      const after = structuredClone(restored);
      expect(
        resumeTriggerPrompt(restored.scheduler, restored.game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect(restored).toEqual(after);
    },
  );

  it.each(["CardEffect", "CardEffected", "PostCardEffected"])(
    "freezes interruption during %s without fabricating the remaining events/result",
    (name) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "interrupt-effect",
        rule: true,
        priority: 0,
        events: [name],
        effect: () => ({ kind: "interrupt", reason: "stage-change" }),
      });
      const scheduler = dispatch(game, rules);
      const names = ["CardEffect", "CardEffected", "PostCardEffected"];
      expect(game.seen.map((entry) => entry.name)).toEqual(
        names.slice(0, names.indexOf(name) + 1),
      );
      expect(game.results).toEqual([]);
      expect(scheduler.interruption?.reason).toBe("stage-change");
      expect(scheduler.frames.length).toBeGreaterThan(0);
    },
  );

  it("keeps nested room effects separate from the parent's shared payload and result", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "nested-effect",
      rule: true,
      priority: 0,
      events: ["CardEffected"],
      effect: ({ event, continuation }) => {
        if (event.target === "b" && continuation === null)
          return {
            kind: "operation",
            operation: {
              name: "card-effect",
              data: { ...(event.data as CardEffect), from: "b", to: "c" },
            },
            continuation: true,
          };
        return { kind: "done", value: event.target === "c" };
      },
    });
    dispatch(game, rules);
    expect(game.seen.map((entry) => [entry.name, entry.target])).toEqual([
      ["CardEffect", "b"],
      ["CardEffected", "b"],
      ["CardEffect", "c"],
      ["CardEffected", "c"],
      ["PostCardEffected", "c"],
      ["PostCardEffected", "b"],
    ]);
    expect(game.results).toEqual([true]);
  });

  it.each([
    { from: "unknown" },
    { to: null },
    { to: "unknown" },
    { multiple: 1 },
    { nullified: "false" },
    { disresponsive: null },
    { card: { ...effectData().card, className: "" } },
    { card: { ...effectData().card, materialIDs: [1, 1] } },
  ])("rejects malformed effect fields atomically: %j", (rewrite) => {
    const game = fixture();
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = structuredClone({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-effect", data: { ...effectData(), ...rewrite } },
        "a",
      ),
    ).toThrow("Invalid card");
    expect({ game, scheduler }).toEqual(before);
  });

  it("rejects a malformed CardEffect rewrite before CardEffected, preserving prior side effects", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "bad-rewrite",
      rule: true,
      priority: 0,
      events: ["CardEffect"],
      effect: ({ game, event }) => {
        game.playerFlags.b.push("committed");
        event.data = { ...(event.data as CardEffect), nullified: "bad" };
        return { kind: "done", value: false };
      },
    });
    expect(() => dispatch(game, rules)).toThrow("Invalid card effect");
    expect(game.seen.map((entry) => entry.name)).toEqual(["CardEffect"]);
    expect(game.playerFlags.b).toEqual(["committed"]);
  });

  it("ignores the terminal PostCardEffected payload when returning the fixed result", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "post-data",
      rule: true,
      priority: 0,
      events: ["PostCardEffected"],
      effect: ({ event }) => {
        event.data = null;
        return { kind: "done", value: true };
      },
    });
    dispatch(game, rules);
    expect(game.results).toEqual([true]);
  });
  it.each([null, {}, { b: "flags" }, { b: [1] }])(
    "rejects malformed selected recipient flags before allocating a frame: %j",
    (flags) => {
      const game = fixture();
      Object.assign(game, { playerFlags: flags });
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-effect", data: effectData() },
          "a",
        ),
      ).toThrow("Invalid card effect recipient flags");
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it("clears only the original recipient's non-skill nullification flag on CardEffected consumption", () => {
    const game = fixture();
    game.playerFlags.b = ["keep", "Global_NonSkillNullify"];
    game.playerFlags.c = ["Global_NonSkillNullify"];
    const rules = registry();
    rules.skills.push({
      id: "consume-effect",
      rule: true,
      priority: 0,
      events: ["CardEffected"],
      effect: ({ event }) => {
        event.data = { ...(event.data as CardEffect), to: "c" };
        return { kind: "done", value: true };
      },
    });
    dispatch(game, rules);
    expect(game.results).toEqual([false]);
    expect(game.playerFlags).toEqual({
      a: [],
      b: ["keep"],
      c: ["Global_NonSkillNullify"],
    });
    expect(game.seen.at(-1)).toMatchObject({
      name: "PostCardEffected",
      target: "b",
      data: { to: "c" },
    });
  });
  it("only posts a dead non-Slash recipient and returns false", () => {
    const game = fixture();
    game.alive.b = false;
    dispatch(game);
    expect(game.seen.map(({ name }) => name)).toEqual(["PostCardEffected"]);
    expect(game.results).toEqual([false]);
  });
  it("dispatches all three events and returns true for unconsumed CardEffected", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(game.seen.map(({ name, target }) => [name, target])).toEqual([
      ["CardEffect", "b"],
      ["CardEffected", "b"],
      ["PostCardEffected", "b"],
    ]);
    expect(game.results).toEqual([true]);
    expect(scheduler.frames).toEqual([]);
  });
});
