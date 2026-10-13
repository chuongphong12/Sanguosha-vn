import { describe, expect, it } from "vitest";
import {
  createEnterDyingOperation,
  type DyingGame,
} from "../../src/game/hegemony/dying";
import { createRecoveryOperation } from "../../src/game/hegemony/recovery";
import { createSinglePeachOperation } from "../../src/game/hegemony/peach-response";
import {
  createPostHpReducedOperation,
  createPostHpReducedRule,
  createAskForPeachesOperation,
  createAskForPeachesRule,
  createAskForPeachesDoneOperation,
  createAskForPeachesDoneRule,
  type RescueRules,
} from "../../src/game/hegemony/dying-rule";
import type { SinglePeachRules } from "../../src/game/hegemony/peach-response";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  type TriggerRegistry,
  type TriggerEvent,
  type TriggerData,
  type TriggerSkill,
  getTriggerPrompt,
  resumeTriggerPrompt,
} from "../../src/game/hegemony/scheduler";
import {
  createDamageOperation,
  type Damage,
} from "../../src/game/hegemony/damage";
import {
  createDamageDoneOperation,
  createDamageDoneRule,
  createDamageCompleteOperation,
  createDamageCompleteRule,
} from "../../src/game/hegemony/damage-rule";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardEffectOperation } from "../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import type { SlashCard } from "../../src/game/hegemony/slash";
type Game = DyingGame & { seen: TriggerEvent[] };
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    removed: { a: false, b: false, c: false },
    hp: { a: 4, b: -1, c: 4 },
    maxHp: { a: 4, b: 4, c: 4 },
    chained: { a: false, b: false, c: false },
    currentPlayer: "c",
    damageStack: [],
    playerMarks: { a: {}, b: {}, c: {} },
    playerFlags: { a: [], b: [], c: [] },
    currentdying: { a: "", b: "previous", c: "" },
    cardZones: {},
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    seen: [],
  };
}
const events = [
  "Dying",
  "AskForPeaches",
  "AskForPeachesDone",
  "QuitDying",
  "PreHpRecover",
  "HpChanged",
  "HpRecover",
  "ChoiceMade",
];
function registry(): TriggerRegistry<Game> {
  return {
    version: "dying-ce4e62b",
    operations: [createEnterDyingOperation()],
    skills: [
      {
        id: "observe",
        events,
        priority: 10,
        record: ({ game, event }) => {
          game.seen.push(structuredClone(event));
        },
        effect: () => ({ kind: "done", value: false }),
      },
    ],
  };
}
describe("Hegemony dying lifecycle", () => {
  it("uses a validated Peach once, emits ChoiceMade first and validates the original parsed reply afterward", () => {
    const game = fixture(),
      rules = registry();
    for (const reference of ["parsed", "peach"])
      game.cardResources.cards[reference] = {
        kind: "virtual",
        key: reference,
        isSlash: false,
        isNDTrick: false,
        flags: [],
        tags: {},
      };
    const response = (reference: string) => ({
      reference,
      card: {
        type: "basic" as const,
        name: "peach",
        className: "Peach",
        skillName: "",
        materialIDs: [],
        flags: [],
      },
    });
    rules.operations!.push(
      createSinglePeachOperation({
        request: (request) => ({ name: "reply", data: request }),
        isLimited: () => false,
        cardString: () => "peach:ref",
        validateResponse: (saver, reply) => ({
          name: "validate",
          data: { saver, reply },
        }),
        use: (use, addHistory) => ({ name: "use", data: { use, addHistory } }),
        validateAfter: (saver, original) => ({
          name: "after",
          data: { saver, original },
        }),
      }),
      {
        name: "reply",
        run: () => ({ kind: "return", value: response("parsed") }),
      },
      {
        name: "validate",
        run: () => ({ kind: "return", value: response("peach") }),
      },
      {
        name: "use",
        run: ({ operation }) => {
          game.seen.push({ name: "use", target: null, data: operation.data });
          expect(game.seen[0]).toMatchObject({
            name: "ChoiceMade",
            data: "peach:b:2:peach:ref",
          });
          return {
            kind: "operation",
            operation: {
              name: "recover",
              data: { target: "b", data: { recover: 2, who: "c", card: null } },
            },
            continuation: true,
          };
        },
      },
      {
        name: "after",
        run: ({ operation }) => {
          game.seen.push({ name: "after", target: null, data: operation.data });
          return { kind: "return", value: null };
        },
      },
      createRecoveryOperation(),
    );
    // The external use adapter is void and must return after its child.
    rules.operations = rules.operations!.map((op) =>
      op.name === "use"
        ? {
            ...op,
            run: (context) =>
              context.continuation !== null
                ? { kind: "return", value: null }
                : op.run(context),
          }
        : op,
    );
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-single-peach", data: { saver: "c", who: "b" } },
      "a",
    );
    expect(game.hp.b).toBe(1);
    expect(game.currentCardUseReason).toBe("response-use");
    expect(game.seen.find((e) => e.name === "after")?.data).toMatchObject({
      saver: "c",
      original: { reference: "parsed" },
    });
    expect(game.seen.find((e) => e.name === "use")?.data).toMatchObject({
      addHistory: false,
      use: { from: "c", to: ["b"], card: { flags: ["UsedBySecondWay"] } },
    });
    expect(scheduler.operationCompletion?.value).toMatchObject({
      reference: "peach",
    });
  });
  it("enters dying on HP loss, recovers through the first saver and skips kill delegation", () => {
    const game = fixture(),
      rules = registry();
    game.cardResources.cards.peach = {
      kind: "virtual",
      key: "peach",
      isSlash: false,
      isNDTrick: false,
      flags: [],
      tags: {},
    };
    rules.operations!.push(
      createPostHpReducedOperation(),
      createRecoveryOperation(),
      createAskForPeachesOperation({
        hasActiveWansha: () => false,
        isProhibited: () => false,
        isLocked: () => false,
        ask: (request) => ({ name: "rescue", data: request }),
      }),
      createAskForPeachesDoneOperation({
        kill: (target, damage) => ({
          name: "kill-player",
          data: { target, damage },
        }),
      }),
      {
        name: "rescue",
        run: ({ continuation }) =>
          continuation === null
            ? {
                kind: "operation",
                operation: {
                  name: "recover",
                  data: {
                    target: "b",
                    data: { recover: 2, who: "c", card: null },
                  },
                },
                continuation: true,
              }
            : {
                kind: "return",
                value: {
                  reference: "peach",
                  card: {
                    type: "basic",
                    name: "peach",
                    className: "Peach",
                    skillName: "",
                    materialIDs: [],
                    flags: [],
                  },
                },
              },
      },
      {
        name: "kill-player",
        run: () => {
          throw new Error("Unexpected death");
        },
      },
    );
    rules.skills.push(
      createPostHpReducedRule(),
      createAskForPeachesRule(),
      createAskForPeachesDoneRule(),
    );
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "post-hp-reduced", data: { target: "b", data: 1 } },
      "a",
    );
    expect(game.hp.b).toBe(1);
    expect(
      game.seen.filter((e) => e.name === "AskForPeaches").map((e) => e.target),
    ).toEqual(["c"]);
    expect(
      game.seen.filter((e) => e.name === "AskForPeachesDone"),
    ).toHaveLength(1);
    expect(game.playerFlags.b).toEqual([]);
    expect(scheduler.frames).toEqual([]);
  });
  it("caps recovery at max HP and emits native recovery events", () => {
    const game = fixture(),
      rules = registry();
    rules.operations!.push(createRecoveryOperation());
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "recover",
        data: { target: "b", data: { recover: 8, who: null, card: null } },
      },
      "a",
    );
    expect(game.hp.b).toBe(4);
    expect(game.seen.map((e) => [e.name, e.target])).toEqual([
      ["PreHpRecover", "b"],
      ["HpChanged", "b"],
      ["HpRecover", "b"],
    ]);
    expect(scheduler.frames).toEqual([]);
  });
  it("dispatches current-order dying and rescue events and restores original properties", () => {
    const game = fixture(),
      rules = registry(),
      scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "enter-dying", data: { target: "b", damage: null } },
      "a",
    );
    expect(game.seen.map((e) => [e.name, e.target])).toEqual([
      ["Dying", "c"],
      ["Dying", "a"],
      ["Dying", "b"],
      ["AskForPeaches", "c"],
      ["AskForPeaches", "a"],
      ["AskForPeaches", "b"],
      ["AskForPeachesDone", "b"],
      ["QuitDying", "b"],
    ]);
    expect(game.currentdying).toEqual({ a: "", b: "previous", c: "" });
    expect(game.cardResources.roomTags.CurrentDying).toEqual([]);
    expect(game.playerFlags.b).toEqual([]);
    expect(scheduler.frames).toEqual([]);
  });
});

function peach(reference = "peach0", ids: number[] = []): SlashCard {
  return {
    reference,
    card: {
      type: "basic",
      name: "peach",
      className: "Peach",
      skillName: "",
      materialIDs: ids,
      flags: [],
    },
  };
}
function prepared(): Game {
  const game = fixture();
  for (const reference of ["peach0", "peach1", "peach2", "parsed"])
    game.cardResources.cards[reference] = {
      kind: "virtual",
      key: reference,
      isSlash: false,
      isNDTrick: false,
      flags: [],
      tags: {},
    };
  game.cardZones = {
    hand: { owner: "c", place: "hand", cards: [1, 2] },
    table: { owner: null, place: "table", cards: [] },
    discard: { owner: null, place: "discard", cards: [] },
  };
  game.cardResources.roomTags.answers = [];
  return game;
}
function fullRegistry(
  options: {
    rescue?: Partial<RescueRules<Game>>;
    single?: Partial<SinglePeachRules<Game>>;
  } = {},
): TriggerRegistry<Game> {
  const rules = registry(),
    resources = {
      reference: (use: { card: { materialIDs: number[] } }) =>
        `peach${use.card.materialIDs[0] ?? 0}`,
    };
  rules.operations!.push(
    createPostHpReducedOperation(),
    createAskForPeachesOperation({
      hasActiveWansha: () => false,
      isProhibited: () => false,
      isLocked: () => false,
      ask: (data) => ({ name: "ask-single-peach", data }),
      ...options.rescue,
    }),
    createAskForPeachesDoneOperation({
      kill: (target, damage) => ({
        name: "kill-player",
        data: { target, damage },
      }),
    }),
    createRecoveryOperation(),
    createSinglePeachOperation({
      request: (data) => ({ name: "reply", data }),
      isLimited: () => false,
      cardString: (_, card) => card.reference,
      validateResponse: (saver, card) => ({
        name: "validate",
        data: { saver, card },
      }),
      use: (use, addHistory) => ({
        name: "use-peach",
        data: { use, addHistory },
      }),
      validateAfter: (saver, original) => ({
        name: "after",
        data: { saver, original },
      }),
      ...options.single,
    }),
    {
      name: "reply",
      run: ({ game, operation }) => {
        game.seen.push({ name: "request", target: null, data: operation.data });
        const answers = game.cardResources.roomTags.answers;
        if (!Array.isArray(answers))
          throw new Error("Expected answers fixture");
        return { kind: "return", value: answers.shift() ?? null };
      },
    },
    {
      name: "validate",
      run: ({ game, operation }) => {
        if (
          !operation.data ||
          typeof operation.data !== "object" ||
          Array.isArray(operation.data)
        )
          throw new Error("Expected validation fixture");
        const validations = game.cardResources.roomTags.validations;
        return {
          kind: "return",
          value:
            Array.isArray(validations) && validations.length
              ? validations.shift()!
              : operation.data.card,
        };
      },
    },
    {
      name: "use-peach",
      run: ({ operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        if (
          !operation.data ||
          typeof operation.data !== "object" ||
          Array.isArray(operation.data)
        )
          throw new Error("Expected use fixture");
        return {
          kind: "operation",
          operation: { name: "card-on-use", data: operation.data.use },
          continuation: true,
        };
      },
    },
    {
      name: "after",
      run: ({ game, operation }) => {
        game.seen.push({ name: "after", target: null, data: operation.data });
        return { kind: "return", value: null };
      },
    },
    {
      name: "kill-player",
      run: ({ game, operation }) => {
        if (
          !operation.data ||
          typeof operation.data !== "object" ||
          Array.isArray(operation.data) ||
          typeof operation.data.target !== "string"
        )
          throw new Error("Expected kill fixture");
        game.alive[operation.data.target] = false;
        game.seen.push({
          name: "kill",
          target: operation.data.target,
          data: operation.data,
        });
        return { kind: "return", value: null };
      },
    },
    createCardMovementOperation(),
    createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
    createCardUsedOperation({
      resources,
      use: (data) => ({ name: "card-use", data }),
    }),
    createCardUseOperation({
      ...resources,
      effect: (data) => ({ name: "card-effect", data }),
    }),
    createCardEffectOperation({ isSlash: () => false }),
    createCardEffectedOperation({
      isSlash: () => false,
      isTrick: () => false,
      cancel: () => {
        throw new Error("Unused cancellation");
      },
      onEffect: (effect) => ({
        name: "recover",
        data: {
          target: effect.to,
          data: { recover: 1, who: effect.from, card: null },
        },
      }),
    }),
    createDamageOperation(),
    createDamageDoneOperation(),
    createDamageCompleteOperation(),
  );
  rules.skills.push(
    createPostHpReducedRule(),
    createAskForPeachesRule(),
    createAskForPeachesDoneRule(),
    createCardUsedRule(),
    createCardEffectedRule(),
    createCardFinishedRule(resources),
    createDamageDoneRule(),
    createDamageCompleteRule(),
    {
      id: "observe-integration",
      events: ["PostHpReduced", "DamageComplete", "CardFinished"],
      priority: 10,
      record: ({ game, event }) => {
        game.seen.push(structuredClone(event));
      },
      effect: () => ({ kind: "done", value: false }),
    },
  );
  return rules;
}
function run(
  game: Game,
  rules: TriggerRegistry<Game>,
  name = "enter-dying",
  data: TriggerData = { target: "b", damage: null },
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(scheduler, game, rules, { name, data }, "a");
  return scheduler;
}
function hook(
  rules: TriggerRegistry<Game>,
  name: string,
  effect: TriggerSkill<Game>["effect"],
) {
  rules.skills.push({
    id: `hook-${name}`,
    events: [name],
    priority: 5,
    rule: true,
    effect,
  });
}
function damage(): Damage {
  return {
    from: "a",
    to: "b",
    card: null,
    damage: 5,
    nature: "normal",
    chain: false,
    transfer: false,
    by_user: true,
    reason: "",
    flags: [],
    transfer_reason: "",
    prevented: false,
  };
}

describe("Dying source snapshots", () => {
  it.each(["consume", "recover", "dead"])(
    "retains original Room recipient after a rewritten %s Dying event",
    (mode) => {
      const game = prepared(),
        rules = registry();
      hook(rules, "Dying", ({ game, event }) => {
        event.data = { who: "a", damage: null };
        if (mode === "recover") game.hp.b = 1;
        if (mode === "dead") game.alive.b = false;
        return { kind: "done", value: true };
      });
      run(game, rules);
      expect(game.seen.filter((e) => e.name === "Dying")).toHaveLength(1);
      expect(
        game.seen.filter((e) => e.name === "AskForPeachesDone"),
      ).toHaveLength(mode === "consume" ? 1 : 0);
      expect(game.seen.at(-1)).toMatchObject({
        name: "QuitDying",
        target: "b",
        data: { who: "a" },
      });
      expect(game.playerFlags.b).toEqual(
        mode === "dead" ? ["Global_Dying"] : [],
      );
    },
  );
  it("captures Dying seats once and savers again after current/death changes", () => {
    const game = prepared(),
      rules = registry();
    hook(rules, "Dying", ({ game, event }) => {
      if (event.target === "c") {
        game.currentPlayer = "a";
        game.alive.a = false;
      }
      return { kind: "done", value: false };
    });
    run(game, rules);
    expect(
      game.seen.filter((e) => e.name === "Dying").map((e) => e.target),
    ).toEqual(["c", "a", "b"]);
    expect(
      game.seen.filter((e) => e.name === "AskForPeaches").map((e) => e.target),
    ).toEqual(["b", "c"]);
  });
  it("removes one CurrentDying entry from current nested tags and restores saved saver property", () => {
    const game = prepared(),
      rules = registry();
    game.cardResources.roomTags.CurrentDying = ["b", "b", "other"];
    hook(rules, "AskForPeaches", ({ game, event }) => {
      expect(game.currentdying[event.target!]).toBe("b");
      game.currentdying[event.target!] = "changed";
      game.cardResources.roomTags.CurrentDying = ["b", "nested", "b"];
      game.hp.b = 1;
      return { kind: "done", value: true };
    });
    run(game, rules);
    expect(game.currentdying.c).toBe("");
    expect(game.cardResources.roomTags.CurrentDying).toEqual(["nested", "b"]);
    expect(
      game.seen.filter((e) => e.name === "AskForPeachesDone"),
    ).toHaveLength(1);
  });
  it("handles nested dying with separate saver property restoration", () => {
    const game = prepared(),
      rules = registry();
    hook(rules, "AskForPeaches", ({ game, event, continuation }) => {
      if (
        event.target === "c" &&
        continuation === null &&
        game.cardResources.roomTags.CurrentDying &&
        Array.isArray(game.cardResources.roomTags.CurrentDying) &&
        game.cardResources.roomTags.CurrentDying.length === 1
      ) {
        game.hp.a = 1;
        return {
          kind: "operation",
          operation: {
            name: "enter-dying",
            data: { target: "a", damage: null },
          },
          continuation: true,
        };
      }
      return { kind: "done", value: false };
    });
    run(game, rules);
    expect(game.cardResources.roomTags.CurrentDying).toEqual([]);
    expect(game.currentdying).toEqual({ a: "", b: "previous", c: "" });
    expect(
      game.seen.filter((e) => e.name === "QuitDying").map((e) => e.target),
    ).toEqual(["a", "b"]);
  });
  it.each([1, 4])(
    "PostHpReduced skips positive HP %s before parsing damage",
    (hp) => {
      const game = prepared();
      game.hp.b = hp;
      run(game, fullRegistry(), "post-hp-reduced", {
        target: "b",
        data: { invalid: true },
      });
      expect(game.seen).toEqual([]);
    },
  );
  it.each<TriggerData>([
    null,
    1,
    "loss",
    {},
    { reason: "lose-hp" },
    { recover: 1, who: "c", card: null },
  ])("uses a null damage reason for non-damage PostHpReduced: %s", (data) => {
    const game = prepared();
    run(game, fullRegistry(), "post-hp-reduced", { target: "b", data });
    expect(game.seen.find((e) => e.name === "Dying")?.data).toEqual({
      who: "b",
      damage: null,
    });
  });
  it.each<TriggerData>([{ damage: false }, { nature: "fire" }])(
    "rejects malformed damage-shaped PostHpReduced: %s",
    (data) => {
      const game = prepared();
      expect(() =>
        run(game, fullRegistry(), "post-hp-reduced", { target: "b", data }),
      ).toThrow();
      expect(game.seen).toEqual([]);
      expect(game.cardResources.roomTags.CurrentDying).toBeUndefined();
    },
  );
  it("keeps parent damage data unchanged after rewritten dying reason", () => {
    const game = prepared(),
      rules = fullRegistry();
    game.hp.b = 4;
    hook(rules, "Dying", ({ game, event }) => {
      event.data = { who: "c", damage: null };
      game.hp.b = 1;
      return { kind: "done", value: true };
    });
    run(game, rules, "damage", damage());
    expect(game.seen.find((e) => e.name === "DamageComplete")?.data).toEqual(
      damage(),
    );
    expect(game.seen.at(-1)?.name).toBe("DamageComplete");
  });
});

describe("Rescue rules and recovery", () => {
  it.each(["a", "b", "c"])(
    "active Wansha allows only the current player and dying player: %s",
    (saver) => {
      const game = prepared();
      run(
        game,
        fullRegistry({ rescue: { hasActiveWansha: () => true } }),
        "ask-for-peaches",
        { target: saver, data: { who: "b", damage: null } },
      );
      expect(game.seen.filter((e) => e.name === "request")).toHaveLength(
        saver === "a" ? 0 : 1,
      );
    },
  );
  it.each(["cannot", "prohibited", "locked", "dead"])(
    "does not request a rescue at the %s boundary",
    (mode) => {
      const game = prepared();
      if (mode === "cannot") game.playerFlags.c = ["CannotHelp"];
      if (mode === "dead") game.alive.b = false;
      const rules = fullRegistry({
        rescue: {
          isProhibited: () => mode === "prohibited",
          isLocked: () => mode === "locked",
        },
      });
      run(game, rules, "ask-for-peaches", {
        target: "c",
        data: { who: "b", damage: null },
      });
      expect(game.seen.filter((e) => e.name === "request")).toEqual([]);
    },
  );
  it("short-circuits prohibition before lock and rechecks constraints after accepted response", () => {
    const game = prepared();
    game.cardResources.roomTags.answers = [peach()];
    const rules = fullRegistry({
      rescue: { isProhibited: (g) => g.hp.b === 0, isLocked: () => false },
    });
    run(game, rules, "ask-for-peaches", {
      target: "c",
      data: { who: "b", damage: null },
    });
    expect(game.hp.b).toBe(0);
    expect(game.seen.filter((e) => e.name === "request")).toHaveLength(1);
    const other = prepared();
    run(
      other,
      fullRegistry({
        rescue: {
          isProhibited: () => true,
          isLocked: () => {
            throw new Error("Locked should not be checked");
          },
        },
      }),
      "ask-for-peaches",
      { target: "c", data: { who: "b", damage: null } },
    );
  });
  it("clears only the first CannotHelp and kills the event recipient using rewritten damage", () => {
    const game = prepared();
    game.playerFlags.a = ["CannotHelp"];
    game.playerFlags.b = ["CannotHelp"];
    run(game, fullRegistry(), "ask-for-peaches-done", {
      target: "b",
      data: { who: "c", damage: damage() },
    });
    expect(game.playerFlags.a).toEqual([]);
    expect(game.playerFlags.b).toEqual(["CannotHelp"]);
    expect(game.seen).toEqual([
      { name: "kill", target: "b", data: { target: "b", damage: damage() } },
    ]);
  });
  it.each(["healthy", "dead"])(
    "clears CannotHelp but skips kill for a %s recipient",
    (state) => {
      const game = prepared();
      game.playerFlags.a = ["CannotHelp"];
      if (state === "healthy") game.hp.b = 1;
      else game.alive.b = false;
      run(game, fullRegistry(), "ask-for-peaches-done", {
        target: "b",
        data: null,
      });
      expect(game.playerFlags.a).toEqual([]);
      expect(game.seen).toEqual([]);
    },
  );
  it.each([
    [0, -1],
    [-2, -3],
    [2, 1],
    [10, 4],
  ])("uses signed recovery %s with native upper cap", (recover, expected) => {
    const game = prepared();
    run(game, fullRegistry(), "recover", {
      target: "b",
      data: { recover, who: null, card: null },
    });
    expect(game.hp.b).toBe(expected);
    expect(game.seen.filter((e) => e.name === "HpChanged")).toHaveLength(1);
    expect(game.seen.filter((e) => e.name === "PostHpReduced")).toEqual([]);
  });
  it.each(["dead", "full", "removed", "forbidden"])(
    "skips recovery with initial %s state",
    (state) => {
      const game = prepared();
      if (state === "dead") game.alive.b = false;
      if (state === "full") game.hp.b = 4;
      if (state === "removed") game.removed.b = true;
      if (state === "forbidden")
        game.cardResources.playerTags.b.CannotRecover = true;
      run(game, fullRegistry(), "recover", {
        target: "b",
        data: { recover: 2, who: null, card: null },
      });
      expect(game.seen).toEqual([]);
    },
  );
  it("does not recheck eligibility after PreHpRecover and preserves recovery data through HpChanged", () => {
    const game = prepared(),
      rules = fullRegistry();
    hook(rules, "PreHpRecover", ({ game, event }) => {
      game.alive.b = false;
      game.removed.b = true;
      game.maxHp.b = 2;
      event.data = { recover: 7, who: "a", card: null };
      return { kind: "done", value: false };
    });
    hook(rules, "HpChanged", ({ event }) => {
      event.data = null;
      return { kind: "done", value: true };
    });
    run(game, rules, "recover", {
      target: "b",
      data: { recover: 1, who: null, card: null },
    });
    expect(game.hp.b).toBe(2);
    expect(game.seen.find((e) => e.name === "HpRecover")?.data).toEqual({
      recover: 7,
      who: "a",
      card: null,
    });
  });
  it("consumed PreHpRecover stops before applying HP or validating its rewrite", () => {
    const game = prepared(),
      rules = fullRegistry();
    hook(rules, "PreHpRecover", ({ event }) => {
      event.data = null;
      return { kind: "done", value: true };
    });
    run(game, rules, "recover", {
      target: "b",
      data: { recover: 2, who: null, card: null },
    });
    expect(game.hp.b).toBe(-1);
    expect(game.seen).toHaveLength(1);
  });
});

describe("Single Peach response and full damage composition", () => {
  it.each([null, peach()])(
    "emits refusal for null or limited response without validation/use: %s",
    (reply) => {
      const game = prepared();
      game.cardResources.roomTags.answers = [reply];
      run(
        game,
        fullRegistry({
          single: {
            isLimited: () => true,
            validateResponse: () => {
              throw new Error("Unexpected validation");
            },
          },
        }),
        "ask-single-peach",
        { saver: "c", who: "b" },
      );
      expect(game.seen.filter((e) => e.name === "ChoiceMade")).toEqual([
        { name: "ChoiceMade", target: "c", data: "peach:b:2:" },
      ]);
      expect(game.hp.b).toBe(-1);
      expect(game.currentCardUseReason).toBe("response-use");
    },
  );
  it("retries null validation with original saver/who and rereads current HP for ChoiceMade", () => {
    const game = prepared();
    game.cardResources.roomTags.answers = [peach("parsed"), peach("parsed")];
    game.cardResources.roomTags.validations = [null, peach()];
    const rules = fullRegistry();
    hook(rules, "ChoiceMade", ({ game, event }) => {
      expect(event.data).toBe("peach:b:2:peach0");
      game.hp.b = 0;
      event.data = null;
      return { kind: "done", value: true };
    });
    run(game, rules, "ask-single-peach", { saver: "c", who: "b" });
    expect(game.seen.filter((e) => e.name === "request")).toHaveLength(2);
    expect(game.hp.b).toBe(1);
    expect(game.seen.filter((e) => e.name === "after")).toHaveLength(1);
  });
  it("retains captured identities across ChoiceMade changes and current storage flags", () => {
    const game = prepared();
    game.cardResources.roomTags.answers = [peach("parsed")];
    game.cardResources.roomTags.validations = [peach()];
    const rules = fullRegistry();
    hook(rules, "ChoiceMade", ({ game, event }) => {
      game.cardResources.cards.peach0.key = "changed";
      const ref = game.cardResources.cards.peach0;
      if (ref.kind !== "virtual") throw new Error("Fixture virtual");
      ref.flags = ["keep"];
      event.data = "rewritten";
      return { kind: "done", value: true };
    });
    const scheduler = run(game, rules, "ask-single-peach", {
      saver: "c",
      who: "b",
    });
    expect(scheduler.operationCompletion?.value).toMatchObject({
      reference: "peach0",
      card: { flags: ["keep", "UsedBySecondWay"] },
    });
    expect(game.seen.find((e) => e.name === "after")?.data).toMatchObject({
      saver: "c",
      original: { reference: "parsed" },
    });
  });
  it.each([
    null,
    "Dying",
    "AskForPeaches",
    "ChoiceMade",
    "PreHpRecover",
    "HpChanged",
    "HpRecover",
    "CardFinished",
    "AskForPeachesDone",
    "QuitDying",
  ])(
    "composes damage, two material Peach uses and rescue, with JSON pause at %s",
    (pause) => {
      let game = prepared();
      game.hp.b = 4;
      game.cardResources.roomTags.answers = [
        peach("peach1", [1]),
        peach("peach2", [2]),
      ];
      const rules = fullRegistry();
      if (pause)
        hook(rules, pause, ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "c",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "done", value: false },
        );
      let scheduler = run(game, rules, "damage", damage());
      let pauses = 0;
      while (getTriggerPrompt(scheduler, "c")) {
        const prompt = getTriggerPrompt(scheduler, "c")!;
        const before = structuredClone({ game, scheduler });
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "a", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(false);
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "c", {
            id: "stale",
            choice: "continue",
          }),
        ).toBe(false);
        expect({ game, scheduler }).toEqual(before);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "c", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
        const after = structuredClone({ game, scheduler });
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "c", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(false);
        expect({ game, scheduler }).toEqual(after);
        if (++pauses > 10) throw new Error("Unexpected pause loop");
      }
      expect(pauses).toBe(
        pause
          ? pause === "Dying" || pause === "HpChanged"
            ? 3
            : [
                  "ChoiceMade",
                  "PreHpRecover",
                  "HpChanged",
                  "HpRecover",
                  "CardFinished",
                ].includes(pause)
              ? 2
              : 1
          : 0,
      );
      expect(game.hp.b).toBe(1);
      expect(game.alive.b).toBe(true);
      expect(game.cardZones.discard.cards).toEqual([2, 1]);
      expect(game.cardZones.table.cards).toEqual([]);
      expect(game.damageStack).toEqual([]);
      expect(game.currentdying.c).toBe("");
      expect(game.cardResources.roomTags.CurrentDying).toEqual([]);
      expect(game.seen.filter((e) => e.name === "request")).toHaveLength(2);
      expect(game.seen.filter((e) => e.name === "CardFinished")).toHaveLength(
        2,
      );
      expect(scheduler.frames).toEqual([]);
    },
  );
  it("delegates failed rescue to kill then emits QuitDying and completes damage", () => {
    const game = prepared(),
      rules = fullRegistry();
    game.hp.b = 4;
    run(game, rules, "damage", damage());
    expect(game.alive.b).toBe(false);
    expect(game.seen.filter((e) => e.name === "request")).toHaveLength(3);
    expect(game.seen.filter((e) => e.name === "kill")).toHaveLength(1);
    expect(game.seen.find((e) => e.name === "QuitDying")).toMatchObject({
      target: "b",
    });
    expect(game.seen.at(-1)?.name).toBe("DamageComplete");
    expect(game.playerFlags.b).toEqual([]);
  });
});

describe("Dying boundaries and continuation safety", () => {
  it("re-enters response-use reason when null validation retries the original request", () => {
    const game = prepared();
    game.cardResources.roomTags.answers = [peach(), peach()];
    game.cardResources.roomTags.validations = [null, peach()];
    const rules = fullRegistry();
    rules.operations = rules.operations!.map((op) =>
      op.name === "validate"
        ? {
            ...op,
            run: (context) => {
              context.game.currentCardUseReason = "play";
              return op.run(context);
            },
          }
        : op.name === "reply"
          ? {
              ...op,
              run: (context) => {
                expect(context.game.currentCardUseReason).toBe("response-use");
                return op.run(context);
              },
            }
          : op,
    );
    run(game, rules, "ask-single-peach", { saver: "c", who: "b" });
    expect(game.seen.filter((e) => e.name === "request")).toHaveLength(2);
  });
  it.each(["PostHpReduced", "AskForPeaches", "AskForPeachesDone"])(
    "consumes SkipGameRule before parsing %s",
    (name) => {
      const game = prepared(),
        rules = fullRegistry();
      game.cardResources.roomTags.SkipGameRule = true;
      rules.operations!.push({
        name: "emit",
        run: ({ continuation }) =>
          continuation === null
            ? {
                kind: "event",
                event: { name, target: "b", data: null },
                continuation: true,
              }
            : { kind: "return", value: null },
      });
      run(game, rules, "emit", null);
      expect(game.cardResources.roomTags).not.toHaveProperty("SkipGameRule");
      expect(game.hp.b).toBe(-1);
    },
  );
  it.each(["post-hp-reduced", "ask-for-peaches", "ask-for-peaches-done"])(
    "skips a global null target before data in %s",
    (name) => {
      const game = prepared();
      run(game, fullRegistry(), name, { target: null, data: null });
      expect(game.seen).toEqual([]);
    },
  );
  it("runs a priority-zero player recovery before PostHpReduced GameRule", () => {
    const game = prepared(),
      rules = fullRegistry();
    rules.operations!.push({
      name: "emit",
      run: ({ continuation }) =>
        continuation === null
          ? {
              kind: "event",
              event: { name: "PostHpReduced", target: "b", data: null },
              continuation: true,
            }
          : { kind: "return", value: null },
    });
    rules.skills.push({
      id: "player-rescue",
      events: ["PostHpReduced"],
      priority: 0,
      triggerable: () => [
        {
          actor: "b",
          owner: "b",
          slot: null,
          target: "b",
          occurrence: "recover",
          compulsory: true,
          shown: true,
        },
      ],
      effect: () => ({
        kind: "operation",
        operation: {
          name: "recover",
          data: { target: "b", data: { recover: 2, who: null, card: null } },
        },
        continuation: true,
      }),
    });
    // The fixture skill has one void child, then returns without consuming the event.
    rules.skills = rules.skills.map((skill) =>
      skill.id === "player-rescue"
        ? {
            ...skill,
            effect: (context) =>
              context.continuation !== null
                ? { kind: "done", value: false }
                : skill.effect(context),
          }
        : skill,
    );
    const scheduler = run(game, rules, "emit", null),
      prompt = getTriggerPrompt(scheduler, "b")!;
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      }),
    ).toBe(true);
    expect(game.hp.b).toBe(1);
    expect(game.seen.filter((e) => e.name === "Dying")).toEqual([]);
  });
  it.each(["target", "damage", "CurrentDying", "flags", "alive", "hp"])(
    "rejects malformed enterDying %s before frame allocation",
    (mode) => {
      const game = prepared(),
        rules = registry(),
        scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      let data: TriggerData = { target: "b", damage: null };
      if (mode === "target") data = { target: "unknown", damage: null };
      if (mode === "damage") data = { target: "b", damage: { invalid: true } };
      if (mode === "CurrentDying")
        game.cardResources.roomTags.CurrentDying = null;
      if (mode === "flags") game.playerFlags.b = null!;
      if (mode === "alive") game.alive.b = null!;
      if (mode === "hp") game.hp.b = 0.5;
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "enter-dying", data },
          "a",
        ),
      ).toThrow();
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it.each(["amount", "who", "card"])(
    "rejects malformed recovery %s before frame allocation",
    (mode) => {
      const game = prepared(),
        rules = fullRegistry(),
        scheduler = createTriggerScheduler(game.seatOrder, rules.version),
        data = {
          recover: 1,
          who: null,
          card: null,
          [mode === "amount" ? "recover" : mode]: false,
        };
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "recover", data: { target: "b", data } },
          "a",
        ),
      ).toThrow();
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it("retains PreHpRecover effects when a rewritten recovery overflows", () => {
    const game = prepared(),
      rules = fullRegistry();
    game.hp.b = 3;
    hook(rules, "PreHpRecover", ({ event }) => {
      event.data = { recover: 2147483647, who: null, card: null };
      return { kind: "done", value: false };
    });
    expect(() =>
      run(game, rules, "recover", {
        target: "b",
        data: { recover: 1, who: null, card: null },
      }),
    ).toThrow();
    expect(game.hp.b).toBe(3);
    expect(game.seen).toHaveLength(1);
  });
  it.each(["request", "predicate", "validation", "encoded"])(
    "retains response-use state when late %s output is malformed",
    (mode) => {
      const game = prepared();
      game.cardResources.roomTags.answers = [
        mode === "request" ? false : peach(),
      ];
      game.cardResources.roomTags.validations =
        mode === "validation" ? [false] : [];
      const rules = fullRegistry({
        single: {
          isLimited: () => (mode === "predicate" ? null! : false),
          cardString: () => (mode === "encoded" ? null! : "peach0"),
        },
      });
      expect(() =>
        run(game, rules, "ask-single-peach", { saver: "c", who: "b" }),
      ).toThrow();
      expect(game.currentCardUseReason).toBe("response-use");
      expect(game.hp.b).toBe(-1);
      expect(game.seen.filter((e) => e.name === "ChoiceMade")).toEqual([]);
    },
  );
  it("rejects required-Peach count overflow before frame allocation", () => {
    const game = prepared(),
      rules = fullRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    game.hp.b = -2147483648;
    const before = structuredClone({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "ask-single-peach", data: { saver: "c", who: "b" } },
        "a",
      ),
    ).toThrow();
    expect({ game, scheduler }).toEqual(before);
  });
  it("clears first CannotHelp before rejecting malformed kill data", () => {
    const game = prepared();
    game.playerFlags.a = ["CannotHelp"];
    expect(() =>
      run(game, fullRegistry(), "ask-for-peaches-done", {
        target: "b",
        data: null,
      }),
    ).toThrow();
    expect(game.playerFlags.a).toEqual([]);
    expect(game.alive.b).toBe(true);
  });
  it("keeps one-time Wansha/CannotHelp checks but reevaluates current Peach constraints", () => {
    const game = prepared();
    game.cardResources.roomTags.answers = [peach(), peach()];
    const rules = fullRegistry({
      rescue: {
        hasActiveWansha: (g) => g.playerFlags.c.includes("CannotHelp"),
      },
    });
    hook(rules, "HpRecover", ({ game }) => {
      game.playerFlags.c = ["CannotHelp"];
      game.currentPlayer = "a";
      game.alive.c = false;
      return { kind: "done", value: false };
    });
    run(game, rules, "ask-for-peaches", {
      target: "c",
      data: { who: "b", damage: null },
    });
    expect(game.hp.b).toBe(1);
    expect(game.seen.filter((e) => e.name === "request")).toHaveLength(2);
  });
  it("passes copied game and cards to package predicates without mutating authoritative state", () => {
    const game = prepared();
    game.cardResources.roomTags.answers = [peach()];
    const rules = fullRegistry({
      rescue: {
        hasActiveWansha: (g) => {
          g.hp.b = 99;
          return false;
        },
      },
      single: {
        isLimited: (g, _, card) => {
          g.hp.b = 99;
          card.reference = "unknown";
          return false;
        },
      },
    });
    run(game, rules, "ask-for-peaches", {
      target: "c",
      data: { who: "b", damage: null },
    });
    expect(game.hp.b).toBe(0);
    expect(game.seen.filter((e) => e.name === "request")).toHaveLength(2);
  });
  it.each(["reply", "validate", "use-peach", "after"])(
    "resumes JSON at response child %s with exact-once use",
    (name) => {
      let game = prepared();
      game.cardResources.roomTags.answers = [peach()];
      const rules = fullRegistry();
      const original = rules.operations!.find((op) => op.name === name)!;
      rules.operations = rules.operations!.map((op) =>
        op.name !== name
          ? op
          : {
              ...op,
              run: (context) =>
                context.continuation === null
                  ? {
                      kind: "prompt",
                      actor: "c",
                      choices: ["continue"],
                      canCancel: false,
                      continuation: { stage: "resume" },
                    }
                  : original.run({
                      ...context,
                      continuation:
                        context.continuation &&
                        typeof context.continuation === "object" &&
                        !Array.isArray(context.continuation) &&
                        context.continuation.stage === "resume"
                          ? null
                          : context.continuation,
                    }),
            },
      );
      let scheduler = run(game, rules, "ask-single-peach", {
        saver: "c",
        who: "b",
      });
      const prompt = getTriggerPrompt(scheduler, "c")!;
      expect(prompt).not.toBeNull();
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(game.hp.b).toBe(0);
      expect(game.seen.filter((e) => e.name === "after")).toHaveLength(1);
      expect(game.seen.filter((e) => e.name === "CardFinished")).toHaveLength(
        1,
      );
      expect(scheduler.frames).toEqual([]);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes the active saver property and dying tag at %s",
    (reason) => {
      const game = prepared(),
        rules = fullRegistry();
      hook(rules, "AskForPeaches", () => ({ kind: "interrupt", reason }));
      const scheduler = run(game, rules);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(game.currentdying.c).toBe("b");
      expect(game.playerFlags.b).toEqual(["Global_Dying"]);
      expect(game.cardResources.roomTags.CurrentDying).toEqual(["b"]);
      expect(game.seen.filter((e) => e.name === "QuitDying")).toEqual([]);
    },
  );
});
