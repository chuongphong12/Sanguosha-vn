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
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";

type Game = CardEffectGame & {
  seen: { name: string; target: string | null; data: TriggerData }[];
  applied: TriggerData[];
  results: TriggerData[];
  canceled: boolean;
  slash: boolean;
  trick: boolean;
};
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    cardZones: {},
    playerFlags: { a: [], b: [], c: [] },
    seen: [],
    applied: [],
    results: [],
    canceled: false,
    slash: false,
    trick: true,
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
    version: "card-effected-ce4e62b",
    operations: [
      createCardEffectOperation({ isSlash: (game) => game.slash }),
      createCardEffectedOperation({
        isSlash: (game) => game.slash,
        isTrick: (game) => game.trick,
        cancel: (effect) => ({ name: "cancel-effect", data: effect }),
        onEffect: (effect) => ({ name: "apply-effect", data: effect }),
      }),
      {
        name: "cancel-effect",
        run: ({ game, operation }) => {
          game.seen.push({
            name: "cancel",
            target: null,
            data: operation.data,
          });
          return { kind: "return", value: game.canceled };
        },
      },
      {
        name: "apply-effect",
        run: ({ game, operation }) => {
          game.applied.push(structuredClone(operation.data));
          return { kind: "return", value: { to: "c" } };
        },
      },
      {
        name: "observe-result",
        run: ({ game, operation, operationChild }) => {
          if (!operationChild)
            return {
              kind: "operation",
              operation: { name: "card-effect", data: operation.data },
              continuation: null,
            };
          game.results.push(operationChild.value);
          return { kind: "return", value: null };
        },
      },
    ],
    skills: [
      createCardEffectedRule(),
      {
        id: "observe-effect-events",
        rule: true,
        priority: 1,
        events: [
          "CardEffect",
          "CardEffected",
          "CardEffectConfirmed",
          "PostCardEffected",
        ],
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
  name = "observe-result",
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(scheduler, game, rules, { name, data }, "a");
  return scheduler;
}

describe("Hegemony GameRule CardEffected", () => {
  it.each([
    { canceled: false, pause: null },
    { canceled: false, pause: "cancel-effect" },
    { canceled: false, pause: "CardEffectConfirmed" },
    { canceled: true, pause: "cancel-effect" },
  ])(
    "composes onUse, resource preparation, GameRule effects and material cleanup: %j",
    ({ canceled, pause }) => {
      let game = fixture();
      game.canceled = canceled;
      game.cardZones = {
        hand: { owner: "a", place: "hand", cards: [1] },
        table: { owner: null, place: "table", cards: [] },
        discard: { owner: null, place: "discard", cards: [] },
      };
      game.cardResources = {
        cards: {
          duel: {
            kind: "virtual",
            key: "duel-key",
            isSlash: false,
            isNDTrick: true,
            flags: ["keep-until-finished"],
            tags: {},
          },
        },
        playerTags: { a: {}, b: {}, c: {} },
        roomTags: { "duel-keyHegNullificationTargets": ["c"] },
      };
      const rules = registry();
      const resources = { reference: () => "duel" };
      rules.operations!.push(
        createCardOnUseOperation({
          tableZone: "table",
          discardZone: "discard",
        }),
        createCardMovementOperation(),
        createCardUsedOperation({
          resources,
          use: (data) => ({ name: "card-use", data }),
        }),
        createCardUseOperation({
          ...resources,
          effect: (data) => ({ name: "card-effect", data }),
        }),
      );
      rules.skills.push(
        createCardUsedRule(),
        createCardFinishedRule(resources),
        {
          id: "observe-material-finish",
          priority: 1,
          rule: true,
          events: ["CardFinished"],
          effect: ({ game }) => {
            game.seen.push({
              name: "CardFinished",
              target: null,
              data: [...game.cardZones.table.cards],
            });
            return { kind: "done", value: false };
          },
        },
      );
      if (pause === "cancel-effect") {
        const handler = rules.operations![2];
        rules.operations![2] = {
          ...handler,
          run: (context) => {
            if (context.continuation !== null)
              return { kind: "return", value: context.continuation };
            const result = handler.run(context);
            if (result.kind !== "return")
              throw new Error("Expected cancellation result");
            return {
              kind: "prompt",
              actor: "b",
              choices: ["continue"],
              canCancel: false,
              continuation: result.value,
            };
          },
        };
      } else if (pause) {
        rules.skills.push({
          id: "pause-composed-confirmation",
          priority: 0,
          rule: true,
          events: [pause],
          effect: ({ continuation }) =>
            continuation === null
              ? {
                  kind: "prompt",
                  actor: "b",
                  choices: ["continue"],
                  canCancel: false,
                  continuation: true,
                }
              : { kind: "done", value: false },
        });
      }
      const card = { ...effectData().card, materialIDs: [1] };
      let scheduler = dispatch(
        game,
        rules,
        {
          from: "a",
          to: ["b", "c"],
          card,
          nullified_list: ["c"],
          disresponsive_list: ["b"],
        },
        "card-on-use",
      );
      if (pause) {
        const prompt = getTriggerPrompt(scheduler, "b")!;
        expect(prompt).not.toBeNull();
        expect(game.cardZones.table.cards).toEqual([1]);
        expect(game.seen.some((entry) => entry.name === "CardFinished")).toBe(
          false,
        );
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
        const after = structuredClone({ game, scheduler });
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(false);
        expect({ game, scheduler }).toEqual(after);
      }
      expect(game.applied).toEqual(
        canceled
          ? []
          : [{ ...effectData(), card, multiple: true, disresponsive: true }],
      );
      expect(game.seen.filter((entry) => entry.name === "cancel")).toHaveLength(
        1,
      );
      expect(
        game.seen
          .filter((entry) => entry.name === "PostCardEffected")
          .map((entry) => entry.target),
      ).toEqual(["b", "c"]);
      expect(game.seen.at(-1)).toEqual({
        name: "CardFinished",
        target: null,
        data: [1],
      });
      expect(game.cardZones.hand.cards).toEqual([]);
      expect(game.cardZones.table.cards).toEqual([]);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.cardResources!.roomTags).toEqual({
        CardUseNullifiedList: ["c"],
      });
      const reference = game.cardResources!.cards.duel;
      if (reference.kind !== "virtual")
        throw new Error("Expected virtual fixture card");
      expect(reference.flags).toEqual([]);
      expect(game.playerFlags).toEqual({ a: [], b: [], c: [] });
      expect(scheduler.frames).toEqual([]);
    },
  );

  it("still confirms a recipient killed by the cancellation child, then skips non-Slash onEffect", () => {
    const game = fixture();
    const rules = registry();
    const handler = rules.operations![2];
    rules.operations![2] = {
      ...handler,
      run: (context) => {
        context.game.alive.b = false;
        return handler.run(context);
      },
    };
    dispatch(game, rules);
    expect(game.seen.map((entry) => entry.name)).toEqual([
      "CardEffect",
      "CardEffected",
      "cancel",
      "CardEffectConfirmed",
      "PostCardEffected",
    ]);
    expect(game.applied).toEqual([]);
    expect(game.results).toEqual([true]);
  });

  it("confirms and applies a dead Slash with a null source", () => {
    const game = fixture();
    game.alive.b = false;
    game.slash = true;
    game.trick = false;
    const data = { ...effectData(), from: null, nullified: true };
    dispatch(game, registry(), data);
    expect(game.applied).toEqual([data]);
    expect(game.results).toEqual([true]);
    expect(
      game.seen.find((entry) => entry.name === "CardEffectConfirmed")?.target,
    ).toBe("b");
  });
  it.each(["cancel-declined", "cancel-accepted", "confirmed", "on-effect"])(
    "resumes exactly once after JSON reload at %s",
    (pause) => {
      let game = fixture();
      game.canceled = pause === "cancel-accepted";
      const rules = registry();
      if (pause.startsWith("cancel") || pause === "on-effect") {
        const index = pause === "on-effect" ? 3 : 2;
        const handler = rules.operations![index];
        rules.operations![index] = {
          ...handler,
          run: (context) => {
            if (context.continuation !== null)
              return { kind: "return", value: context.continuation };
            const result = handler.run(context);
            if (result.kind !== "return")
              throw new Error("Expected fixture return");
            return {
              kind: "prompt",
              actor: "b",
              choices: ["continue"],
              canCancel: false,
              continuation: result.value,
            };
          },
        };
      } else {
        rules.skills.push({
          id: "pause-confirmed",
          rule: true,
          priority: 0,
          events: ["CardEffectConfirmed"],
          effect: ({ game, continuation }) => {
            if (continuation !== null) return { kind: "done", value: false };
            game.playerFlags.b.push("confirmed-once");
            return {
              kind: "prompt",
              actor: "b",
              choices: ["continue"],
              canCancel: false,
              continuation: true,
            };
          },
        });
      }
      let scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "b")!;
      expect(prompt).not.toBeNull();
      expect(getTriggerPrompt(scheduler, "a")).toBeNull();
      expect(game.results).toEqual([]);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      const beforeWrongActor = structuredClone({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect({ game, scheduler }).toEqual(beforeWrongActor);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(game.applied).toEqual(game.canceled ? [] : [effectData()]);
      expect(game.results).toEqual([!game.canceled]);
      expect(game.seen.filter((entry) => entry.name === "cancel")).toHaveLength(
        1,
      );
      expect(
        game.seen.filter((entry) => entry.name === "PostCardEffected"),
      ).toHaveLength(1);
      expect(game.playerFlags.b).toEqual(
        pause === "confirmed" ? ["confirmed-once"] : [],
      );
      expect(scheduler.frames).toEqual([]);
      const completed = structuredClone({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect({ game, scheduler }).toEqual(completed);
    },
  );

  it.each(["cancel-effect", "apply-effect"])(
    "freezes %s interruption without fabricated Post or unwind",
    (name) => {
      const game = fixture();
      const rules = registry();
      const index = name === "cancel-effect" ? 2 : 3;
      const handler = rules.operations![index];
      rules.operations![index] = {
        ...handler,
        run: (context) => {
          handler.run(context);
          context.game.playerFlags.b.push("eager-before-interrupt");
          return { kind: "interrupt", reason: "turn-broken" };
        },
      };
      const scheduler = dispatch(game, rules);
      expect(scheduler.interruption?.reason).toBe("turn-broken");
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(game.seen.at(-1)?.name).toBe(
        name === "cancel-effect" ? "cancel" : "CardEffectConfirmed",
      );
      expect(game.playerFlags.b).toEqual(["eager-before-interrupt"]);
      expect(game.results).toEqual([]);
      expect(game.applied).toEqual(
        name === "apply-effect" ? [effectData()] : [],
      );
    },
  );

  it("freezes an interrupted Confirmed event without calling onEffect or Post", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "interrupt-confirmed",
      rule: true,
      priority: 0,
      events: ["CardEffectConfirmed"],
      effect: () => ({ kind: "interrupt", reason: "stage-change" }),
    });
    const scheduler = dispatch(game, rules);
    expect(scheduler.interruption?.reason).toBe("stage-change");
    expect(game.applied).toEqual([]);
    expect(game.results).toEqual([]);
    expect(game.seen.at(-1)?.name).toBe("CardEffectConfirmed");
  });

  it("keeps nested canceled room effects separate from the parent's void onEffect return", () => {
    const game = fixture();
    const rules = registry();
    rules.operations![3] = {
      name: "apply-effect",
      run: ({ game, operation, operationChild }) => {
        if (operationChild)
          return { kind: "return", value: operationChild.value };
        game.applied.push(structuredClone(operation.data));
        return {
          kind: "operation",
          operation: {
            name: "card-effect",
            data: { ...effectData(), from: "c", to: "a", nullified: true },
          },
          continuation: true,
        };
      },
    };
    dispatch(game, rules);
    expect(game.seen.map(({ name, target }) => [name, target])).toEqual([
      ["CardEffect", "b"],
      ["CardEffected", "b"],
      ["cancel", null],
      ["CardEffectConfirmed", "b"],
      ["CardEffect", "a"],
      ["CardEffected", "a"],
      ["PostCardEffected", "a"],
      ["PostCardEffected", "b"],
    ]);
    expect(game.applied).toEqual([effectData()]);
    expect(game.results).toEqual([true]);
  });

  it.each([null, "false", 0, { canceled: true }])(
    "rejects a non-boolean cancellation child result: %j",
    (value) => {
      const game = fixture();
      const rules = registry();
      rules.operations![2] = {
        name: "cancel-effect",
        run: ({ game }) => {
          game.playerFlags.b.push("cancel-child-eager");
          return { kind: "return", value };
        },
      };
      expect(() => dispatch(game, rules)).toThrow(
        "Invalid card cancellation result",
      );
      expect(game.applied).toEqual([]);
      expect(game.playerFlags.b).toEqual(["cancel-child-eager"]);
      expect(game.seen.at(-1)?.name).toBe("CardEffected");
    },
  );

  it("revalidates selected recipient flags after the cancellation child", () => {
    const game = fixture();
    const rules = registry();
    rules.operations![2] = {
      name: "cancel-effect",
      run: ({ game }) => {
        Object.assign(game.playerFlags, { b: "bad" });
        return { kind: "return", value: true };
      },
    };
    expect(() => dispatch(game, rules)).toThrow(
      "Invalid card effect recipient flags",
    );
    expect(game.applied).toEqual([]);
    expect(game.results).toEqual([]);
  });

  it("passes null sources and opaque extras to Confirmed and onEffect", () => {
    const game = fixture();
    const data = {
      ...effectData(),
      from: null,
      disresponsive: true,
      extra: { package: [1, "keep"] },
    };
    dispatch(game, registry(), data);
    expect(game.applied).toEqual([data]);
    expect(
      game.seen.find((entry) => entry.name === "CardEffectConfirmed"),
    ).toEqual({ name: "CardEffectConfirmed", target: "b", data });
  });

  it("uses copied live ancestry/type and descriptor data without allowing adapter mutation leaks", () => {
    const game = fixture();
    const rules = registry();
    rules.operations![1] = createCardEffectedOperation({
      isSlash: (snapshot, effect) => {
        snapshot.playerFlags.b.push("slash-leak");
        effect.to = "c";
        return false;
      },
      isTrick: (snapshot, effect) => {
        snapshot.alive.b = false;
        effect.nullified = true;
        return true;
      },
      cancel: (effect) => {
        const data = structuredClone(effect);
        effect.to = "c";
        return { name: "cancel-effect", data };
      },
      onEffect: (effect) => {
        const data = structuredClone(effect);
        effect.nullified = true;
        return { name: "apply-effect", data };
      },
    });
    dispatch(game, rules);
    expect(game.playerFlags.b).toEqual([]);
    expect(game.alive.b).toBe(true);
    expect(game.applied).toEqual([effectData()]);
    expect(game.seen.at(-1)?.data).toEqual(effectData());
  });

  it("honors current trick identity even when the supplied card snapshot says basic", () => {
    const game = fixture();
    game.canceled = true;
    const data = effectData();
    data.card.type = "basic";
    dispatch(game, registry(), data);
    expect(game.results).toEqual([false]);
    expect(game.seen.some((entry) => entry.name === "cancel")).toBe(true);
    expect(game.applied).toEqual([]);
  });

  it("does not ask cancellation for a current non-trick despite trick snapshot metadata", () => {
    const game = fixture();
    game.trick = false;
    game.canceled = true;
    dispatch(game);
    expect(game.seen.some((entry) => entry.name === "cancel")).toBe(false);
    expect(game.applied).toEqual([effectData()]);
    expect(game.results).toEqual([true]);
  });

  it.each(["consume", "rewrite"])(
    "runs player skills before GameRule in priority zero: %s",
    (action) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "same-band-player",
        priority: 0,
        events: ["CardEffected"],
        triggerable: () => [
          {
            actor: "a",
            owner: "a",
            slot: null,
            target: "b",
            occurrence: "once",
            compulsory: true,
            shown: true,
          },
        ],
        effect: ({ event }) => {
          event.data = { ...effectData(), to: "c" };
          return { kind: "done", value: action === "consume" };
        },
      });
      const scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "a")!;
      expect(prompt.kind).toBe("order");
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: prompt.choices[0].id,
        }),
      ).toBe(true);
      expect(game.applied).toEqual(
        action === "consume" ? [] : [{ ...effectData(), to: "c" }],
      );
      expect(game.results).toEqual([action !== "consume"]);
      expect(
        game.seen.find((entry) => entry.name === "CardEffectConfirmed")?.target,
      ).toBe(action === "consume" ? undefined : "c");
    },
  );

  it.each([
    null,
    { from: "unknown" },
    { to: null },
    { multiple: 1 },
    { card: { ...effectData().card, materialIDs: [1, 1] } },
  ])("rejects malformed standalone effect data atomically: %j", (rewrite) => {
    const game = fixture();
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = structuredClone({ game, scheduler });
    const data = rewrite === null ? null : { ...effectData(), ...rewrite };
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-effected", data },
        "a",
      ),
    ).toThrow("Invalid card");
    expect({ game, scheduler }).toEqual(before);
  });
  it.each(["flags", "alive"])(
    "rejects invalid selected %s before allocating a standalone frame",
    (field) => {
      const game = fixture();
      if (field === "flags") Object.assign(game.playerFlags, { b: [1] });
      else Object.assign(game.alive, { b: "yes" });
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-effected", data: effectData() },
          "a",
        ),
      ).toThrow();
      expect({ game, scheduler }).toEqual(before);
    },
  );

  it.each(["isSlash", "isTrick"] as const)(
    "rejects a non-boolean live %s lookup before applying an effect",
    (field) => {
      const game = fixture();
      const rules = registry();
      rules.operations![1] = createCardEffectedOperation({
        isSlash: () => false,
        isTrick: () => true,
        [field]: () => JSON.parse('"yes"'),
        cancel: (effect) => ({ name: "cancel-effect", data: effect }),
        onEffect: (effect) => ({ name: "apply-effect", data: effect }),
      });
      expect(() =>
        dispatch(game, rules, effectData(), "card-effected"),
      ).toThrow("Invalid card effect kind");
      expect(game.applied).toEqual([]);
    },
  );

  it("rejects invalid alive state after confirmation and retains completed event side effects", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "invalidate-alive",
      rule: true,
      priority: 0,
      events: ["CardEffectConfirmed"],
      effect: ({ game }) => {
        Object.assign(game.alive, { b: 1 });
        game.playerFlags.b.push("eager");
        return { kind: "done", value: false };
      },
    });
    expect(() => dispatch(game, rules)).toThrow(
      "Invalid card effect recipient alive state",
    );
    expect(game.playerFlags.b).toEqual(["eager"]);
    expect(game.applied).toEqual([]);
    expect(game.seen.at(-1)?.name).toBe("CardEffectConfirmed");
  });
  it.each([false, true])(
    "rechecks alive and live Slash ancestry after Confirmed (Slash=%s)",
    (slash) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "kill-during-confirmation",
        rule: true,
        priority: 0,
        events: ["CardEffectConfirmed"],
        effect: ({ game, event }) => {
          game.alive.b = false;
          game.slash = slash;
          event.data = null;
          return { kind: "done", value: true };
        },
      });
      dispatch(game, rules);
      expect(game.applied).toEqual(slash ? [effectData()] : []);
      expect(game.results).toEqual([true]);
      expect(game.seen.at(-1)?.data).toEqual(effectData());
    },
  );

  it("ignores Confirmed payload rewrites and consumption and onEffect return values", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "rewrite-confirmed",
      rule: true,
      priority: 0,
      events: ["CardEffectConfirmed"],
      effect: ({ event }) => {
        event.data = { ...effectData(), to: "c", from: null, nullified: true };
        return { kind: "done", value: true };
      },
    });
    dispatch(game, rules);
    expect(game.applied).toEqual([effectData()]);
    expect(game.seen.at(-1)).toEqual({
      name: "PostCardEffected",
      target: "b",
      data: effectData(),
    });
    expect(game.results).toEqual([true]);
  });

  it("captures GameRule's rewritten recipient separately from Room's original flag cleanup", () => {
    const game = fixture();
    game.canceled = true;
    game.playerFlags.b = ["original", "Global_NonSkillNullify"];
    game.playerFlags.c = ["rewritten"];
    const rules = registry();
    rules.skills.push({
      id: "rewrite-before-game-rule",
      rule: true,
      priority: 1,
      events: ["CardEffected"],
      effect: ({ event }) => {
        event.data = {
          ...(event.data as CardEffect),
          to: "c",
          from: null,
          extra: { keep: 1 },
        };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(
      game.seen.find((entry) => entry.name === "cancel")?.data,
    ).toMatchObject({ to: "c", from: null, extra: { keep: 1 } });
    expect(game.playerFlags.b).toEqual(["original"]);
    expect(game.playerFlags.c).toEqual(["rewritten", "Global_NonSkillNullify"]);
    expect(game.applied).toEqual([]);
    expect(game.results).toEqual([false]);
  });
  it("consumes a nullified non-Slash before cancellation or confirmation", () => {
    const game = fixture();
    const data = effectData();
    data.nullified = true;
    dispatch(game, registry(), data);
    expect(game.seen.map((entry) => entry.name)).toEqual([
      "CardEffect",
      "CardEffected",
      "PostCardEffected",
    ]);
    expect(game.applied).toEqual([]);
    expect(game.results).toEqual([false]);
  });

  it("sets a canceled trick's flag once, while Room clears its original recipient", () => {
    const game = fixture();
    game.canceled = true;
    game.playerFlags.b = ["keep", "Global_NonSkillNullify"];
    const rules = registry();
    rules.skills.push({
      id: "observe-cancel-flag",
      rule: true,
      priority: 0,
      events: ["PostCardEffected"],
      effect: ({ game }) => {
        game.applied.push([...game.playerFlags.b]);
        return { kind: "done", value: false };
      },
    });
    const scheduler = dispatch(game, rules, effectData(), "card-effected");
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.playerFlags.b).toEqual(["keep", "Global_NonSkillNullify"]);
    expect(game.applied).toEqual([]);
    dispatch(game, rules);
    expect(game.results).toEqual([false]);
    expect(game.applied).toEqual([["keep"]]);
    expect(game.playerFlags.b).toEqual(["keep"]);
  });

  it("lets a nullified Slash through without calling trick cancellation", () => {
    const game = fixture();
    game.slash = true;
    game.trick = false;
    const data = effectData();
    data.card.type = "basic";
    data.card.className = "Slash";
    data.nullified = true;
    dispatch(game, registry(), data);
    expect(game.seen.map((entry) => entry.name)).toEqual([
      "CardEffect",
      "CardEffected",
      "CardEffectConfirmed",
      "PostCardEffected",
    ]);
    expect(game.applied).toEqual([data]);
    expect(game.results).toEqual([true]);
  });
  it("confirms a trick after cancellation declines, then applies the original effect", () => {
    const game = fixture();
    dispatch(game);
    expect(game.seen.map((entry) => entry.name)).toEqual([
      "CardEffect",
      "CardEffected",
      "cancel",
      "CardEffectConfirmed",
      "PostCardEffected",
    ]);
    expect(game.applied).toEqual([effectData()]);
    expect(game.results).toEqual([true]);
    expect(game.playerFlags.b).toEqual([]);
  });
});
