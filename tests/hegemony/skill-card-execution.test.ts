import { describe, expect, it } from "vitest";
import {
  createSkillCardOnUseOperation,
  createSkillCardExtraCostOperation,
  type SkillCardUse,
} from "../../src/game/hegemony/skill-card-on-use";
import {
  createCardOnUseOperation,
  type CardUse,
} from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createCardEffectOperation } from "../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createRecoveryOperation } from "../../src/game/hegemony/recovery";
import { createDamageOperation } from "../../src/game/hegemony/damage";
import {
  createDamageDoneOperation,
  createDamageDoneRule,
  createDamageCompleteOperation,
  createDamageCompleteRule,
} from "../../src/game/hegemony/damage-rule";
import { createFillHandCardsOperation } from "../../src/game/hegemony/fill-hand";
import {
  createRewardTokenCostOperation,
  createRewardTokenUseOperation,
  type RewardToken,
} from "../../src/game/hegemony/reward-tokens";
import type { GeneralGame } from "../../src/game/hegemony/general-identity";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
  type TriggerEvent,
  type OperationHandler,
} from "../../src/game/hegemony/scheduler";

type Game = GeneralGame & { trace: TriggerEvent[]; applied: TriggerData[] };
function fixture(): Game {
  const players = ["a", "b", "c"];
  return {
    seatOrder: players,
    livingPlayers: [...players],
    currentPlayer: "a",
    seats: { a: 1, b: 2, c: 3 },
    alive: { a: true, b: true, c: true },
    playerFlags: { a: [], b: [], c: [] },
    playerMarks: { a: {}, b: {}, c: {} },
    hp: { a: 3, b: 3, c: 3 },
    maxHp: { a: 4, b: 4, c: 4 },
    removed: { a: false, b: false, c: false },
    chained: { a: false, b: false, c: false },
    damageStack: [],
    currentdying: { a: "", b: "", c: "" },
    playerHistory: { a: {}, b: {}, c: {} },
    acquiredSkills: Object.fromEntries(
      players.map((p) => [p, { head: [], deputy: [] }]),
    ),
    scenarioRoleShown: { a: false, b: false, c: false },
    identities: Object.fromEntries(
      players.map((p) => [
        p,
        {
          head: `${p}-head`,
          deputy: `${p}-deputy`,
          headKingdom: "wei",
          kingdom: "wei",
          role: "lord",
          headShown: false,
          deputyShown: false,
          lord: false,
          generalLord: false,
          actualHeadLord: false,
        },
      ]),
    ),
    generalNames: Object.fromEntries(
      players.map((p) => [p, [`secret-${p}-head`, `secret-${p}-deputy`]]),
    ),
    displayedGenerals: Object.fromEntries(
      players.map((p) => [p, { head: "anjiang", deputy: "anjiang" }]),
    ),
    generalCatalog: {},
    cardZones: {
      a: { place: "hand", owner: "a", cards: [1, 2] },
      b: { place: "hand", owner: "b", cards: [] },
      c: { place: "hand", owner: "c", cards: [] },
      draw: { place: "draw", owner: null, cards: [3, 4, 5, 6, 7, 8] },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    cardResources: {
      cards: {
        TestSkillCard: {
          kind: "virtual",
          key: "skill-key",
          isSlash: false,
          isNDTrick: false,
          flags: ["keep-until-finished"],
          tags: {},
        },
      },
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    trace: [],
    applied: [],
  };
}
function useData(): SkillCardUse {
  return {
    from: "a",
    to: ["b"],
    card: {
      type: "skill",
      name: "test_skill",
      className: "TestSkillCard",
      skillName: "test_skill",
      materialIDs: [1],
      flags: [],
      skillPosition: "",
      showSkill: "",
      willThrow: true,
    },
  };
}
const resources = { reference: (use: CardUse) => use.card.className };
function registry(): TriggerRegistry<Game> {
  return {
    version: "skill-execution-ce4e62b",
    operations: [
      createSkillCardOnUseOperation({
        tableZone: "table",
        discardZone: "discard",
        extraCost: (data) => ({ name: "skill-card-extra-cost", data }),
        showSkill: (data) => ({ name: "show-fixture", data }),
        afterShow: (data) => ({ name: "post-show-fixture", data }),
        notifyUse: ({ hidden }) => ({ name: "log-fixture", data: { hidden } }),
        generalName: (game, player, position) =>
          game.generalNames[player][position === "left" ? 0 : 1],
        cardState: (game, card) => {
          const ref = game.cardResources.cards[card.className];
          return {
            flags: ref.kind === "virtual" ? ref.flags : [],
            materialIDs: card.materialIDs,
          };
        },
      }),
      createSkillCardExtraCostOperation({
        discardZone: "discard",
        generalName: (game, player, position) =>
          game.generalNames[player][position === "left" ? 0 : 1],
      }),
      createCardMovementOperation(),
      createRecoveryOperation(),
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardUsedOperation({
        resources,
        use: (data) => ({ name: "card-use", data }),
      }),
      createCardUseOperation({
        ...resources,
        effect: (data) => ({ name: "card-effect", data }),
      }),
      createCardEffectOperation({
        isSlash: (_game, effect) => effect.card.className === "Slash",
      }),
      createCardEffectedOperation({
        isSlash: (_game, effect) => effect.card.className === "Slash",
        isTrick: (_game, effect) => effect.card.type === "trick",
        cancel: () => ({ name: "cancel-fixture", data: null }),
        onEffect: (data) => ({ name: "apply-effect-fixture", data }),
      }),
      ...["show-fixture", "post-show-fixture", "log-fixture"].map((name) => ({
        name,
        run: () => ({ kind: "return" as const, value: null }),
      })),
      { name: "cancel-fixture", run: () => ({ kind: "return", value: false }) },
      {
        name: "apply-effect-fixture",
        run: ({ game, operation }) => {
          game.applied.push(structuredClone(operation.data));
          return { kind: "return", value: null };
        },
      },
    ],
    skills: [
      createCardUsedRule(),
      createCardFinishedRule(resources),
      createCardEffectedRule(),
      {
        id: "observe-shared",
        priority: 10,
        rule: true,
        events: [
          "PreCardUsed",
          "TargetSelected",
          "CardUsed",
          "TargetChoosing",
          "TargetConfirming",
          "TargetRecord",
          "TargetChosen",
          "TargetConfirmed",
          "CardEffect",
          "CardEffected",
          "CardEffectConfirmed",
          "PostCardEffected",
          "CardFinished",
          "PreHpRecover",
          "HpRecover",
        ],
        effect: ({ game, event }) => {
          game.trace.push(structuredClone(event));
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
  name = "skill-card-on-use",
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  expect(
    dispatchTriggerOperation(scheduler, game, rules, { name, data }, "a"),
  ).toBe(true);
  return scheduler;
}

describe("Hegemony shared SkillCard execution", () => {
  it("runs actual GameRule targets, common effects, resources and finish after SkillCard cost", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(game.applied).toHaveLength(1);
    expect(game.applied[0]).toMatchObject({
      from: "a",
      to: "b",
      card: { type: "skill" },
      multiple: false,
      nullified: false,
    });
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardResources.cards.TestSkillCard).toMatchObject({ flags: [] });
    expect(game.trace.map((event) => event.name)).toEqual([
      "PreCardUsed",
      "TargetSelected",
      "CardUsed",
      "TargetChoosing",
      "TargetConfirming",
      "TargetRecord",
      "TargetChosen",
      "TargetConfirmed",
      "CardEffect",
      "CardEffected",
      "CardEffectConfirmed",
      "PostCardEffected",
      "CardFinished",
    ]);
    expect(scheduler.frames).toEqual([]);
  });
});

function record(data: TriggerData): Record<string, TriggerData> {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Expected fixture record");
  return data;
}
function handler(
  rules: TriggerRegistry<Game>,
  name: string,
): OperationHandler<Game> {
  const found = rules.operations?.find((operation) => operation.name === name);
  if (!found) throw new Error(`Missing fixture operation ${name}`);
  return found;
}
function virtual(
  game: Game,
  name: string,
  key = name,
  isSlash = false,
  isNDTrick = false,
) {
  game.cardResources.cards[name] = {
    kind: "virtual",
    key,
    isSlash,
    isNDTrick,
    flags: ["pending"],
    tags: {},
  };
}
function pause(rules: TriggerRegistry<Game>, name: string) {
  const operation = handler(rules, name),
    original = operation.run;
  operation.run = (context) => {
    if (context.continuation === null)
      return {
        kind: "prompt",
        actor: "a",
        choices: ["continue"],
        canCancel: false,
        continuation: { fixturePause: true },
      };
    return original({
      ...context,
      continuation:
        record(context.continuation).fixturePause === true
          ? null
          : context.continuation,
    });
  };
}
function recovery(rules: TriggerRegistry<Game>) {
  rules.operations?.splice(
    rules.operations.findIndex(
      (operation) => operation.name === "card-effected",
    ),
    1,
    createCardEffectedOperation<Game>({
      isSlash: () => false,
      isTrick: () => false,
      cancel: () => ({ name: "cancel-fixture", data: null }),
      onEffect: (effect) => ({
        name: "recover",
        data: {
          target: effect.to,
          data: {
            who: effect.from,
            recover: 1,
            card: { reference: effect.card.className, card: effect.card },
          },
        },
      }),
    }),
  );
}

describe("SkillCard common execution boundaries", () => {
  it("runs targetless preAction/use as void children without replacing the shared card", () => {
    const game = fixture(),
      rules = registry();
    rules.operations = rules.operations!.filter(
      (operation) => operation.name !== "card-used",
    );
    rules.operations.push(
      createCardUsedOperation({
        resources,
        preAction: (data) => ({ name: "pre-action-fixture", data }),
        use: (data) => ({ name: "use-override-fixture", data }),
      }),
      ...["pre-action-fixture", "use-override-fixture"].map(
        (name): OperationHandler<Game> => ({
          name,
          run: ({ game, operation }) => {
            game.applied.push({ name, data: operation.data });
            return { kind: "return", value: { data: { from: "invalid" } } };
          },
        }),
      ),
    );
    const scheduler = dispatch(game, rules, { ...useData(), to: [] });
    expect(game.applied.map((entry) => record(entry).name)).toEqual([
      "pre-action-fixture",
      "use-override-fixture",
    ]);
    expect(scheduler.operationCompletion?.value).toMatchObject({
      data: { from: "a", card: { type: "skill" } },
    });
    expect(game.trace.map((event) => event.name)).toEqual([
      "PreCardUsed",
      "TargetSelected",
      "CardUsed",
      "CardFinished",
    ]);
  });

  it("clears the latest wrapped reference after a SkillCard rewrite without restoring its face", () => {
    const game = fixture(),
      rules = registry();
    const wrapped = {
      name: "peach",
      className: "Peach",
      suit: "heart",
      number: 3,
      skillName: "conversion",
      modified: true,
      flags: ["GlobalCardUseDisresponsive"],
      tags: { retained: true },
    };
    game.wrappedCards = { 2: structuredClone(wrapped) };
    game.cardResources.cards.WrappedPeach = {
      kind: "wrapped",
      id: 2,
      key: "2",
      isSlash: false,
      isNDTrick: false,
    };
    rules.skills.push({
      id: "rewrite-wrapped",
      rule: true,
      priority: 5,
      events: ["TargetChoosing"],
      effect: ({ event }) => {
        Object.assign(record(record(event.data).card), {
          type: "basic",
          className: "WrappedPeach",
        });
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(game.applied).toMatchObject([
      {
        card: { type: "basic", className: "WrappedPeach" },
        disresponsive: true,
      },
    ]);
    expect(game.wrappedCards[2]).toEqual({
      ...wrapped,
      flags: [],
      tags: { retained: true, CardUseDisresponsiveList: ["_ALL_PLAYERS"] },
    });
  });

  it.each([true, false])(
    "accepts an explicit generic SkillCard damage reference, with card present = %s",
    (present) => {
      const game = fixture(),
        rules = registry();
      rules.operations!.push(
        createDamageOperation(),
        createDamageDoneOperation(),
        createDamageCompleteOperation(),
      );
      rules.skills.push(createDamageDoneRule(), createDamageCompleteRule(), {
        id: "observe-damage",
        rule: true,
        priority: 10,
        events: ["DamageDone"],
        effect: ({ game, event }) => {
          game.trace.push(structuredClone(event));
          return { kind: "done", value: false };
        },
      });
      handler(rules, "apply-effect-fixture").run = ({
        operation,
        continuation,
      }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const effect = record(operation.data);
        return {
          kind: "operation",
          operation: {
            name: "damage",
            data: {
              from: effect.from,
              to: effect.to,
              card: present
                ? { reference: "TestSkillCard", card: effect.card }
                : null,
              damage: 1,
              nature: "normal",
              chain: false,
              transfer: false,
              by_user: true,
              reason: "fixture",
              flags: [],
              transfer_reason: "",
              prevented: false,
            },
          },
          continuation: true,
        };
      };
      dispatch(game, rules);
      expect(game.hp.b).toBe(2);
      expect(
        record(game.trace.find((event) => event.name === "DamageDone")!.data)
          .card,
      ).toEqual(
        present ? { reference: "TestSkillCard", card: useData().card } : null,
      );
      expect(game.damageStack).toEqual([]);
    },
  );

  it("nests another SkillCard through actual costs, GameRule and effects", () => {
    const game = fixture(),
      rules = registry();
    virtual(game, "NestedSkillCard");
    const original = handler(rules, "apply-effect-fixture").run;
    handler(rules, "apply-effect-fixture").run = (context) => {
      if (
        record(record(context.operation.data).card).className !==
        "TestSkillCard"
      )
        return original(context);
      if (context.continuation !== null) return { kind: "return", value: null };
      const data = useData();
      data.to = ["c"];
      data.card.className = "NestedSkillCard";
      data.card.materialIDs = [2];
      return {
        kind: "operation",
        operation: { name: "skill-card-on-use", data },
        continuation: true,
      };
    };
    const scheduler = dispatch(game, rules);
    expect(scheduler.frames).toEqual([]);
    // Discard movement inserts the new batch at the top of the pile.
    expect(game.cardZones.discard.cards).toEqual([2, 1]);
    expect(game.applied).toMatchObject([
      { to: "c", card: { className: "NestedSkillCard" } },
    ]);
    expect(
      game.trace
        .filter((event) => event.name === "CardFinished")
        .map((event) => record(record(event.data).card).className),
    ).toEqual(["NestedSkillCard", "TestSkillCard"]);
    expect(game.cardResources.cards.NestedSkillCard).toMatchObject({
      flags: [],
    });
  });

  it.each([
    "TargetChoosing",
    "TargetConfirming",
    "TargetConfirmed",
    "CardFinished",
  ])(
    "reloads an actual %s event without repeating shared execution or cost",
    (name) => {
      const game = fixture(),
        rules = registry();
      rules.operations!.push({
        name: "event-pause-fixture",
        run: ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "a",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "return", value: null },
      });
      rules.skills.push({
        id: "event-pause",
        rule: true,
        priority: 5,
        events: [name],
        effect: ({ operationChild }) =>
          operationChild
            ? { kind: "done", value: false }
            : {
                kind: "operation",
                operation: { name: "event-pause-fixture", data: null },
                continuation: null,
              },
      });
      const scheduler = dispatch(game, rules);
      const restored = JSON.parse(JSON.stringify({ game, scheduler })) as {
        game: Game;
        scheduler: typeof scheduler;
      };
      const prompt = getTriggerPrompt(restored.scheduler, "a")!;
      expect(
        resumeTriggerPrompt(restored.scheduler, restored.game, rules, "a", {
          id: prompt.id,
          choice: prompt.choices[0].id,
        }),
      ).toBe(true);
      expect(restored.game.cardZones.discard.cards).toEqual([1]);
      expect(restored.game.applied).toHaveLength(1);
      expect(
        restored.game.trace.filter((event) => event.name === name),
      ).toHaveLength(1);
      expect(restored.scheduler.frames).toEqual([]);
    },
  );

  it("preserves a committed cost when a later effect descriptor is malformed", () => {
    const game = fixture(),
      rules = registry();
    rules.skills.push({
      id: "bad-effect",
      rule: true,
      priority: 5,
      events: ["CardEffect"],
      effect: ({ event }) => {
        record(record(event.data).card).type = "invalid";
        return { kind: "done", value: false };
      },
    });
    expect(() => dispatch(game, rules)).toThrow("Invalid card use");
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.applied).toEqual([]);
    expect(game.trace.some((event) => event.name === "CardFinished")).toBe(
      false,
    );
  });

  it("carries the actual SkillCard reference through recovery, as Jieyin does", () => {
    const game = fixture(),
      rules = registry();
    recovery(rules);
    dispatch(game, rules);
    expect(game.hp.b).toBe(4);
    expect(
      game.trace.find((event) => event.name === "HpRecover")?.data,
    ).toMatchObject({
      who: "a",
      recover: 1,
      card: { reference: "TestSkillCard", card: { type: "skill" } },
    });
  });

  it.each(["PreHpRecover", "CardEffected"])(
    "consumption at %s stops the local effect and still finishes the SkillCard",
    (name) => {
      const game = fixture(),
        rules = registry();
      recovery(rules);
      rules.skills.push({
        id: "consume-fixture",
        rule: true,
        priority: 5,
        events: [name],
        effect: () => ({ kind: "done", value: true }),
      });
      dispatch(game, rules);
      expect(game.hp.b).toBe(3);
      expect(game.trace.at(-1)?.name).toBe("CardFinished");
      expect(game.cardZones.discard.cards).toEqual([1]);
    },
  );

  it("keeps skill effects outside trick cancellation and ignores Confirmed data rewrites", () => {
    const game = fixture(),
      rules = registry();
    handler(rules, "cancel-fixture").run = () => {
      throw new Error("SkillCard is not a trick");
    };
    rules.skills.push({
      id: "confirmed-rewrite",
      rule: true,
      priority: 5,
      events: ["CardEffectConfirmed"],
      effect: ({ event }) => {
        record(event.data).to = "c";
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(game.applied).toMatchObject([{ to: "b" }]);
  });

  it("preserves multiple, nullified/disresponsive lists, and dead-target PostCardEffected", () => {
    const game = fixture(),
      data = {
        ...useData(),
        to: ["a", "b", "c"],
        nullified_list: ["b"],
        disresponsive_list: ["a"],
      };
    game.alive.c = false;
    const rules = registry(),
      apply = handler(rules, "apply-effect-fixture").run;
    handler(rules, "apply-effect-fixture").run = (context) => {
      expect(context.game.cardResources.roomTags["targetsskill-key"]).toEqual([
        "a",
        "c",
      ]);
      return apply(context);
    };
    dispatch(game, rules, data);
    expect(game.applied).toMatchObject([
      { to: "a", multiple: true, nullified: false, disresponsive: true },
    ]);
    expect(
      game.trace
        .filter((event) => event.name === "PostCardEffected")
        .map((event) => event.target),
    ).toEqual(["a", "b", "c"]);
    expect(
      game.trace
        .filter((event) => event.name === "CardEffect")
        .map((event) => event.target),
    ).toEqual(["a", "b"]);
    expect(game.cardResources.roomTags.CardUseNullifiedList).toEqual(["b"]);
    expect(game.cardResources.cards.TestSkillCard).toMatchObject({
      flags: [],
      tags: { CardUseDisresponsiveList: ["a"] },
    });
    expect(game.cardResources.roomTags["targetsskill-key"]).toBeUndefined();
  });

  it("uses current resource flags for global nullification without touching unrelated resources", () => {
    const game = fixture();
    game.cardResources.cards.TestSkillCard = {
      kind: "virtual",
      key: "same-key",
      isSlash: false,
      isNDTrick: false,
      flags: ["GlobalCardUseNullified", "GlobalCardUseDisresponsive"],
      tags: { retained: true },
    };
    virtual(game, "UnrelatedSkillCard", "same-key");
    dispatch(game);
    expect(game.applied).toEqual([]);
    expect(game.cardResources.roomTags.CardUseNullifiedList).toEqual([
      "_ALL_TARGETS",
    ]);
    expect(game.cardResources.cards.TestSkillCard).toMatchObject({
      flags: [],
      tags: { retained: true, CardUseDisresponsiveList: ["_ALL_PLAYERS"] },
    });
    expect(game.cardResources.cards.UnrelatedSkillCard).toMatchObject({
      flags: ["pending"],
    });
  });

  it.each(["basic", "trick", "equip", "skill"] as const)(
    "shares actual targets/effects after a SkillCard becomes %s",
    (type) => {
      const game = fixture(),
        rules = registry();
      virtual(game, "Replacement", "new-key", false, type === "trick");
      game.cardResources.roomTags["new-keyHegNullificationTargets"] = ["c"];
      rules.skills.push({
        id: "rewrite-card",
        rule: true,
        priority: 5,
        events: ["TargetChoosing"],
        effect: ({ event }) => {
          // Replace the entire descriptor: ordinary cards don't carry onUse metadata.
          record(event.data).card = {
            type,
            className: "Replacement",
            name: "replacement",
            skillName: "conversion",
            flags: [],
            materialIDs: [],
          };
          return { kind: "done", value: false };
        },
      });
      dispatch(game, rules);
      expect(game.applied).toMatchObject([
        { card: { type, className: "Replacement" } },
      ]);
      expect(game.cardResources.cards.Replacement).toMatchObject({ flags: [] });
      expect(game.cardResources.cards.TestSkillCard).toMatchObject({
        flags: ["keep-until-finished"],
      });
      expect(
        game.cardResources.roomTags["new-keyHegNullificationTargets"],
      ).toEqual(type === "trick" ? undefined : ["c"]);
    },
  );

  it.each(["basic", "skill"] as const)(
    "accepts a full %s descriptor replacement during CardFinished",
    (type) => {
      const game = fixture(),
        rules = registry();
      virtual(game, "Replacement");
      rules.skills.push({
        id: "finish-replacement",
        rule: true,
        priority: 5,
        events: ["CardFinished"],
        effect: ({ event }) => {
          record(event.data).card = {
            type,
            className: "Replacement",
            name: "replacement",
            skillName: "",
            materialIDs: [],
            flags: [],
          };
          return { kind: "done", value: false };
        },
      });
      const scheduler = dispatch(game, rules);
      expect(scheduler.operationCompletion?.value).toMatchObject({
        data: { card: { type, className: "Replacement" } },
      });
      expect(game.cardResources.cards.Replacement).toMatchObject({ flags: [] });
      expect(game.cardZones.discard.cards).toEqual([1]);
    },
  );

  it("accepts a non-SkillCard becoming a SkillCard inside GameRule without widening its onUse entry", () => {
    const game = fixture(),
      rules = registry();
    const data = {
      ...useData(),
      card: { ...useData().card, type: "basic", className: "Peach" },
    };
    virtual(game, "Peach");
    rules.skills.push({
      id: "become-skill",
      rule: true,
      priority: 5,
      events: ["TargetChoosing"],
      effect: ({ event }) => {
        Object.assign(record(record(event.data).card), useData().card);
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, data, "card-on-use");
    expect(game.applied).toMatchObject([{ card: { type: "skill" } }]);
    const invalid = fixture(),
      before = structuredClone(invalid);
    expect(() =>
      dispatch(invalid, registry(), useData(), "card-on-use"),
    ).toThrow("Invalid card use");
    expect(invalid).toEqual(before);
  });

  it("prepares/restores Jink using current ancestry after skill-to-Slash rewrites", () => {
    const game = fixture(),
      rules = registry();
    virtual(game, "Slash", "slash-key", true);
    game.cardResources.playerTags.a["Jink_slash-key"] = [3];
    rules.skills.push({
      id: "become-slash",
      rule: true,
      priority: 5,
      events: ["TargetChoosing"],
      effect: ({ event }) => {
        Object.assign(record(record(event.data).card), {
          type: "basic",
          className: "Slash",
        });
        return { kind: "done", value: false };
      },
    });
    const apply = handler(rules, "apply-effect-fixture").run;
    handler(rules, "apply-effect-fixture").run = (context) => {
      expect(context.game.cardResources.playerTags.a["Jink_slash-key"]).toEqual(
        [1],
      );
      return apply(context);
    };
    rules.skills.push({
      id: "observe-restored-jink",
      rule: true,
      priority: 5,
      events: ["CardFinished"],
      effect: ({ game }) => {
        expect(game.cardResources.playerTags.a["Jink_slash-key"]).toEqual([3]);
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(game.cardResources.playerTags.a["Jink_slash-key"]).toBeUndefined();
    expect(game.cardResources.cards.Slash).toMatchObject({ flags: [] });
  });

  it("holds target confirmation snapshots while reading updated shared recipients", () => {
    const game = fixture(),
      rules = registry();
    rules.skills.push({
      id: "change-recipients",
      rule: true,
      priority: 5,
      events: ["TargetConfirming"],
      effect: ({ event }) => {
        if (event.target === "a") record(event.data).to = ["a", "c"];
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, { ...useData(), to: ["a", "b"] });
    expect(
      game.trace
        .filter((event) => event.name === "TargetConfirming")
        .map((event) => event.target),
    ).toEqual(["a"]);
    expect(
      game.trace
        .filter((event) => event.name === "TargetConfirmed")
        .map((event) => event.target),
    ).toEqual(["a", "c"]);
    expect(game.applied).toMatchObject([{ to: "a" }, { to: "c" }]);
  });

  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes a paid SkillCard when shared execution interrupts with %s",
    (reason) => {
      const game = fixture(),
        rules = registry();
      rules.skills.push({
        id: "interrupt-fixture",
        rule: true,
        priority: 5,
        events: ["CardEffected"],
        effect: () => ({ kind: "interrupt", reason }),
      });
      const scheduler = dispatch(game, rules);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.applied).toEqual([]);
      expect(game.trace.some((event) => event.name === "CardFinished")).toBe(
        false,
      );
      expect(game.cardResources.cards.TestSkillCard).toMatchObject({
        flags: ["keep-until-finished"],
      });
    },
  );

  it.each([
    "card-used",
    "card-use",
    "card-effect",
    "card-effected",
    "apply-effect-fixture",
    "recover",
  ])(
    "resumes JSON state at %s once and rejects wrong/stale/replayed replies",
    (name) => {
      const game = fixture(),
        rules = registry();
      if (name === "recover") recovery(rules);
      pause(rules, name);
      let scheduler = dispatch(game, rules);
      const restored = JSON.parse(JSON.stringify({ game, scheduler })) as {
        game: Game;
        scheduler: typeof scheduler;
      };
      scheduler = restored.scheduler;
      const prompt = getTriggerPrompt(scheduler, "a")!;
      expect(prompt).not.toBeNull();
      expect(getTriggerPrompt(scheduler, "b")).toBeNull();
      expect(JSON.stringify(prompt)).not.toContain("secret-");
      const answer = { id: prompt.id, choice: prompt.choices[0].id };
      const before = structuredClone(restored);
      expect(
        resumeTriggerPrompt(scheduler, restored.game, rules, "b", answer),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, restored.game, rules, "a", {
          ...answer,
          id: "stale",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, restored.game, rules, "a", {
          ...answer,
          choice: "invalid",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(
          scheduler,
          restored.game,
          { ...rules, version: "stale-registry" },
          "a",
          answer,
        ),
      ).toBe(false);
      expect(restored).toEqual(before);
      expect(
        resumeTriggerPrompt(scheduler, restored.game, rules, "a", answer),
      ).toBe(true);
      expect(scheduler.frames).toEqual([]);
      expect(restored.game.cardZones.discard.cards).toEqual([1]);
      expect(
        restored.game.trace.filter((event) => event.name === "CardFinished"),
      ).toHaveLength(1);
      expect(
        name === "recover" ? restored.game.hp.b : restored.game.applied.length,
      ).toBe(name === "recover" ? 4 : 1);
      const done = structuredClone(restored);
      expect(
        resumeTriggerPrompt(scheduler, restored.game, rules, "a", answer),
      ).toBe(false);
      expect(restored).toEqual(done);
    },
  );

  it.each([
    "invalid-type",
    "duplicate-material",
    "duplicate-target",
    "unknown-player",
    "invalid-flags",
  ])(
    "rejects malformed shared use %s before effects or resources mutate",
    (kind) => {
      const game = fixture(),
        data = record(useData()),
        card = record(data.card);
      if (kind === "invalid-type") card.type = "unknown";
      if (kind === "duplicate-material") card.materialIDs = [1, 1];
      if (kind === "duplicate-target") data.to = ["b", "b"];
      if (kind === "unknown-player") data.from = "unknown";
      if (kind === "invalid-flags") card.flags = [1];
      const before = structuredClone(game);
      expect(() => dispatch(game, registry(), data, "card-used")).toThrow(
        "Invalid card use",
      );
      expect(game).toEqual(before);
    },
  );
});

// Package routing/choice/transport and reference identity remain explicit fixtures.
// Cost, GameRule, fill-hand, movement and recovery below are real engine operations.
function tokenRegistry(token: RewardToken, answer = "draw") {
  const rules = registry();
  handler(rules, "skill-card-on-use");
  rules.operations = rules.operations!.filter(
    (operation) => !["skill-card-on-use", "card-used"].includes(operation.name),
  );
  rules.operations.push(
    createSkillCardOnUseOperation({
      tableZone: "table",
      discardZone: "discard",
      extraCost: (use) => ({
        name: "reward-token-cost",
        data: { player: use.from, token },
      }),
      showSkill: (data) => ({ name: "show-fixture", data }),
      afterShow: (data) => ({ name: "post-show-fixture", data }),
      notifyUse: () => ({ name: "log-fixture", data: null }),
      generalName: (game, player, position) =>
        game.generalNames[player][position === "left" ? 0 : 1],
      cardState: (_game, card) => ({
        flags: card.flags,
        materialIDs: card.materialIDs,
      }),
    }),
    createCardUsedOperation({
      resources,
      use: (use) =>
        use.card.type === "skill"
          ? {
              name: "reward-token-use",
              data: { player: use.from, token, targets: use.to },
            }
          : { name: "card-use", data: use },
    }),
    createRewardTokenCostOperation(),
    createRewardTokenUseOperation({
      draw: (player, count, reason) => ({
        name: "fixed-pile-draw-fixture",
        data: { player, count, reason },
      }),
      peachAvailable: () => true,
      peachLocked: () => false,
      peachProhibited: () => false,
      usePeach: (data) => ({ name: "card-on-use", data }),
      choice: (data) => ({ name: "token-choice-fixture", data }),
      choosePlayer: (data) => ({ name: "choose-player-fixture", data }),
      indicate: (data, target) => ({
        name: "indicate-fixture",
        data: { player: data, target },
      }),
      publicView: (data) => ({ name: "public-view-fixture", data }),
      privateView: (data) => ({ name: "private-view-fixture", data }),
    }),
    createFillHandCardsOperation({
      draw: (player, count, reason) => ({
        name: "fixed-pile-draw-fixture",
        data: { player, count, reason },
      }),
    }),
    {
      name: "fixed-pile-draw-fixture",
      run: ({ game, operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const data = record(operation.data);
        if (typeof data.player !== "string" || typeof data.count !== "number")
          throw new Error("Invalid draw fixture");
        const ids = game.cardZones.draw.cards.slice(0, data.count);
        if (ids.length !== data.count)
          throw new Error("Fixture requires a nonempty fixed draw pile");
        return {
          kind: "operation",
          operation: {
            name: "move-cards",
            data: {
              moves: [
                {
                  ids,
                  to: data.player,
                  open: false,
                  reason: {
                    kind: "draw",
                    actor: data.player,
                    skill: data.reason,
                  },
                },
              ],
            },
          },
          continuation: true,
        };
      },
    },
    {
      name: "token-choice-fixture",
      run: ({ operation }) => ({
        kind: "return",
        value:
          record(operation.data).skill === "firstshow_see"
            ? "head_general"
            : answer,
      }),
    },
    {
      name: "choose-player-fixture",
      run: () => ({ kind: "return", value: "b" }),
    },
    ...["indicate-fixture", "public-view-fixture", "private-view-fixture"].map(
      (name): OperationHandler<Game> => ({
        name,
        run: ({ game, operation }) => {
          game.applied.push({ name, data: operation.data });
          return { kind: "return", value: null };
        },
      }),
    ),
  );
  recovery(rules);
  return rules;
}
function tokenFixture(token: RewardToken) {
  const game = fixture();
  const mark = token === "careerman" ? "@careerist" : `@${token}`;
  game.playerMarks.a[mark] = 1;
  // Extra FirstShow mark proves Careerman's direct use doesn't pay another cost.
  if (token === "careerman") game.playerMarks.a["@firstshow"] = 2;
  virtual(game, "Peach");
  const data = useData();
  data.card.materialIDs = [];
  data.to = token === "firstshow" ? ["b"] : [];
  data.card.skillName = token;
  return { game, data, mark };
}
describe("Reward SkillCards through shared GameRule", () => {
  it.each(["halfmaxhp", "companion", "firstshow", "careerman"] as const)(
    "pays %s once and executes its actual use through GameRule",
    (token) => {
      const { game, data, mark } = tokenFixture(token);
      dispatch(
        game,
        tokenRegistry(token, token === "careerman" ? "draw2cards" : "draw"),
        data,
      );
      expect(game.playerMarks.a[mark]).toBe(0);
      expect(game.cardZones.a.cards).toEqual(
        token === "halfmaxhp" ? [1, 2, 3] : [1, 2, 3, 4],
      );
      expect(game.cardZones.draw.cards).toEqual(
        token === "halfmaxhp" ? [4, 5, 6, 7, 8] : [5, 6, 7, 8],
      );
      expect(
        game.trace.filter((event) => event.name === "CardUsed"),
      ).toHaveLength(1);
      expect(game.trace.at(-1)?.name).toBe("CardFinished");
      if (token !== "firstshow")
        expect(
          game.trace.some((event) => event.name === "TargetChoosing"),
        ).toBe(false);
    },
  );

  it.each(["companion", "careerman"] as const)(
    "nests an actual Peach/recovery inside %s without a second SkillCard cost",
    (token) => {
      const { game, data, mark } = tokenFixture(token);
      dispatch(game, tokenRegistry(token, "peach"), data);
      expect(game.hp.a).toBe(4);
      expect(game.playerMarks.a[mark]).toBe(0);
      expect(
        game.trace
          .filter((event) => event.name === "CardUsed")
          .map((event) => record(record(event.data).card).type),
      ).toEqual(["skill", "basic"]);
      expect(
        game.trace
          .filter((event) => event.name === "CardFinished")
          .map((event) => record(record(event.data).card).type),
      ).toEqual(["basic", "skill"]);
      expect(
        game.trace.find((event) => event.name === "HpRecover")?.data,
      ).toMatchObject({
        card: {
          reference: "Peach",
          card: { type: "basic", skillName: `_${token}` },
        },
      });
    },
  );

  it("calls FirstShow.use directly from Careerman, preserving its mark and requester-only actual names", () => {
    const { game, data } = tokenFixture("careerman");
    dispatch(game, tokenRegistry("careerman", "firstshow"), data);
    expect(game.playerMarks.a["@careerist"]).toBe(0);
    expect(game.playerMarks.a["@firstshow"]).toBe(2);
    expect(game.cardZones.a.cards).toEqual([1, 2, 3, 4]);
    expect(
      game.trace.filter((event) => event.name === "CardUsed"),
    ).toHaveLength(1);
    expect(
      game.applied.find(
        (entry) => record(entry).name === "private-view-fixture",
      ),
    ).toEqual({
      name: "private-view-fixture",
      data: {
        viewer: "a",
        target: "b",
        slot: "head_general",
        names: ["secret-b-head"],
        reason: "firstshow",
      },
    });
    const publicNotice = game.applied.find(
      (entry) => record(entry).name === "public-view-fixture",
    );
    expect(publicNotice).toEqual({
      name: "public-view-fixture",
      data: {
        player: "a",
        target: "b",
        slot: "head_general",
        recipients: ["b", "c"],
      },
    });
    expect(JSON.stringify(publicNotice)).not.toContain("secret-");
    expect(game.playerFlags.b).not.toContain("XianquTarget");
  });

  it.each(["halfmaxhp", "companion", "firstshow", "careerman"] as const)(
    "reloads %s after cost and before moving drawn cards exactly once",
    (token) => {
      const { game, data, mark } = tokenFixture(token),
        rules = tokenRegistry(
          token,
          token === "careerman" ? "firstshow" : "draw",
        );
      pause(rules, "move-cards");
      const scheduler = dispatch(game, rules, data);
      const restored = JSON.parse(JSON.stringify({ game, scheduler })) as {
        game: Game;
        scheduler: typeof scheduler;
      };
      expect(restored.game.playerMarks.a[mark]).toBe(0);
      expect(restored.game.cardZones.a.cards).toEqual([1, 2]);
      const prompt = getTriggerPrompt(restored.scheduler, "a")!;
      expect(getTriggerPrompt(restored.scheduler, "c")).toBeNull();
      expect(JSON.stringify(prompt)).not.toContain("secret-");
      expect(
        resumeTriggerPrompt(restored.scheduler, restored.game, rules, "a", {
          id: prompt.id,
          choice: prompt.choices[0].id,
        }),
      ).toBe(true);
      expect(restored.scheduler.frames).toEqual([]);
      expect(restored.game.playerMarks.a[mark]).toBe(0);
      expect(restored.game.cardZones.a.cards).toEqual(
        token === "halfmaxhp" ? [1, 2, 3] : [1, 2, 3, 4],
      );
      if (token === "careerman")
        expect(restored.game.playerMarks.a["@firstshow"]).toBe(2);
    },
  );
});
