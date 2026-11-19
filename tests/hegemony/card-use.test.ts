import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import {
  createCardOnUseOperation,
  type CardUse,
} from "../../src/game/hegemony/card-on-use";
import {
  createCardFinishedRule,
  type CardResourceGame,
} from "../../src/game/hegemony/card-resources";
import {
  createCardEffectOperation,
  type CardEffect,
} from "../../src/game/hegemony/card-effect";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";

type Use = CardUse & { card: CardUse["card"] & { reference: string } };
type Game = CardResourceGame & {
  seen: { effect: CardEffect; targets: TriggerData }[];
};
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c", "d"],
    alive: { a: true, b: true, c: true, d: true },
    cardZones: {},
    cardResources: {
      roomTags: { CardUseNullifiedList: ["c"] },
      playerTags: { a: {}, b: {}, c: {}, d: {} },
      cards: {
        trick: {
          kind: "virtual",
          key: "duel-string",
          isSlash: false,
          isNDTrick: true,
          flags: [],
          tags: { CardUseDisresponsiveList: ["b"] },
        },
      },
    },
    seen: [],
  };
}
function useData(): Use {
  return {
    from: "a",
    to: ["b", "c", "d"],
    card: {
      type: "trick",
      name: "duel",
      className: "Duel",
      skillName: "",
      materialIDs: [],
      flags: [],
      reference: "trick",
    },
  };
}
const resourceRules = {
  reference: (use: CardUse) => (use as Use).card.reference,
};
function trickCard(game: Game) {
  const card = game.cardResources!.cards.trick;
  if (card.kind !== "virtual") throw new Error("Expected virtual fixture card");
  return card;
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "card-use-ce4e62b",
    skills: [],
    operations: [
      createCardUseOperation({
        ...resourceRules,
        effect: (data) => ({ name: "observe-effect", data }),
      }),
      {
        name: "observe-effect",
        run: ({ game, operation }) => {
          game.seen.push({
            effect: structuredClone(operation.data) as CardEffect,
            targets: structuredClone(
              game.cardResources!.roomTags["targetsduel-string"],
            ),
          });
          return { kind: "return", value: false };
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
    { name: "card-use", data },
    "a",
  );
  return scheduler;
}

describe("Hegemony common Card use", () => {
  it.each([null, "CardEffected", "PostCardEffected"])(
    "composes onUse, GameRule resources, real room dispatch and final material cleanup with reload at %s",
    (pause) => {
      let game = Object.assign(fixture(), {
        playerFlags: { a: [], b: [], c: [], d: [] },
        events: [] as string[],
      });
      game.cardZones = {
        hand: { owner: "a", place: "hand", cards: [1] },
        table: { owner: null, place: "table", cards: [] },
        discard: { owner: null, place: "discard", cards: [] },
      };
      trickCard(game).flags = [
        "GlobalCardUseNullified",
        "GlobalCardUseDisresponsive",
      ];
      game.cardResources!.roomTags["duel-stringHegNullificationTargets"] = [
        "c",
      ];
      const rules: TriggerRegistry<typeof game> = {
        version: "composed-card-use-ce4e62b",
        operations: [
          createCardOnUseOperation({
            tableZone: "table",
            discardZone: "discard",
          }),
          createCardMovementOperation(),
          createCardUsedOperation({
            resources: resourceRules,
            use: (data) => ({ name: "card-use", data }),
          }),
          createCardUseOperation({
            ...resourceRules,
            effect: (data) => ({ name: "card-effect", data }),
          }),
          createCardEffectOperation({
            isSlash: (snapshot, effect) =>
              snapshot.cardResources!.cards[
                (effect.card as Use["card"]).reference
              ].isSlash,
          }),
        ],
        skills: [
          createCardUsedRule(),
          createCardFinishedRule(resourceRules),
          {
            id: "observe-composition",
            rule: true,
            priority: 1,
            events: [
              "PreCardUsed",
              "CardUsed",
              "CardEffect",
              "CardEffected",
              "PostCardEffected",
              "CardFinished",
            ],
            effect: ({ game, event }) => {
              game.events.push(event.name);
              if (event.name === "CardEffected")
                game.seen.push({
                  effect: structuredClone(event.data) as CardEffect,
                  targets: structuredClone(
                    game.cardResources!.roomTags["targetsduel-string"],
                  ),
                });
              return { kind: "done", value: false };
            },
          },
          {
            id: "pause-composition",
            rule: true,
            priority: 0,
            events: pause ? [pause] : [],
            effect: ({ event, continuation }) =>
              event.target === "c" && continuation === null
                ? {
                    kind: "prompt",
                    actor: "c",
                    choices: ["continue"],
                    canCancel: false,
                    continuation: true,
                  }
                : { kind: "done", value: false },
          },
        ],
      };
      const data = {
        ...useData(),
        nullified_list: ["d"],
        disresponsive_list: ["c"],
      };
      data.card.materialIDs = [1];
      let scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-on-use", data },
        "a",
      );
      if (pause) {
        const prompt = getTriggerPrompt(scheduler, "c")!;
        expect(prompt).not.toBeNull();
        expect(game.cardZones.table.cards).toEqual([1]);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "c", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "c", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(false);
      }
      expect(
        game.seen.map(({ effect, targets }) => [
          effect.to,
          effect.nullified,
          effect.disresponsive,
          targets,
        ]),
      ).toEqual([
        ["b", true, true, []],
        ["c", true, true, []],
        ["d", true, true, []],
      ]);
      expect(game.events).toEqual([
        "PreCardUsed",
        "CardUsed",
        "CardEffect",
        "CardEffected",
        "PostCardEffected",
        "CardEffect",
        "CardEffected",
        "PostCardEffected",
        "CardEffect",
        "CardEffected",
        "PostCardEffected",
        "CardFinished",
      ]);
      expect(game.cardZones).toMatchObject({
        hand: { cards: [] },
        table: { cards: [] },
        discard: { cards: [1] },
      });
      expect(game.cardResources!.roomTags).toEqual({
        CardUseNullifiedList: ["d", "_ALL_TARGETS"],
      });
      expect(trickCard(game)).toMatchObject({
        flags: [],
        tags: { CardUseDisresponsiveList: ["c", "_ALL_PLAYERS"] },
      });
      expect(scheduler.frames).toEqual([]);
    },
  );
  it("uses resource tags rather than contradictory lists in the payload", () => {
    const game = fixture();
    dispatch(game, registry(), {
      ...useData(),
      nullified_list: ["_ALL_TARGETS"],
      disresponsive_list: ["_ALL_PLAYERS"],
    });
    expect(
      game.seen.map((entry) => [
        entry.effect.nullified,
        entry.effect.disresponsive,
      ]),
    ).toEqual([
      [false, true],
      [true, false],
      [false, false],
    ]);
  });

  it("defaults absent tags to empty and uses the supplied target order without filtering dead seats", () => {
    const game = fixture();
    game.cardResources!.roomTags = {};
    trickCard(game).tags = {};
    game.alive.c = false;
    const data = useData();
    data.to = ["d", "c", "b"];
    dispatch(game, registry(), data);
    expect(
      game.seen.map(({ effect, targets }) => [
        effect.to,
        effect.nullified,
        effect.disresponsive,
        targets,
      ]),
    ).toEqual([
      ["d", false, false, ["d", "c", "b"]],
      ["c", false, false, ["c", "b"]],
      ["b", false, false, ["b"]],
    ]);
  });

  it("applies global sentinels to every effect and leaves no unnullified remaining target", () => {
    const game = fixture();
    game.cardResources!.roomTags.CardUseNullifiedList = [
      "b",
      "_ALL_TARGETS",
      "_ALL_TARGETS",
    ];
    trickCard(game).tags.CardUseDisresponsiveList = [
      "_ALL_PLAYERS",
      "_ALL_PLAYERS",
    ];
    dispatch(game);
    expect(
      game.seen.map(({ effect, targets }) => [
        effect.nullified,
        effect.disresponsive,
        targets,
      ]),
    ).toEqual([
      [true, true, []],
      [true, true, []],
      [true, true, []],
    ]);
  });

  it("constructs a single-target effect with multiple false", () => {
    const game = fixture();
    const data = useData();
    data.to = ["b"];
    dispatch(game, registry(), data);
    expect(game.seen).toMatchObject([
      { effect: { from: "a", to: "b", multiple: false }, targets: ["b"] },
    ]);
  });

  it("removes the current targets tag for a zero-target use without calling effects", () => {
    const game = fixture();
    game.cardResources!.roomTags["targetsduel-string"] = ["stale"];
    const data = useData();
    data.to = [];
    dispatch(game, registry(), data);
    expect(game.seen).toEqual([]);
    expect(game.cardResources!.roomTags).toEqual({
      CardUseNullifiedList: ["c"],
    });
  });

  it("retains initial list snapshots when the first child changes both shared tags", () => {
    const game = fixture();
    const rules = registry();
    const observe = rules.operations![1];
    rules.operations![1] = {
      ...observe,
      run: (context) => {
        const result = observe.run(context);
        if ((context.operation.data as CardEffect).to === "b") {
          context.game.cardResources!.roomTags.CardUseNullifiedList = [
            "_ALL_TARGETS",
          ];
          trickCard(context.game).tags.CardUseDisresponsiveList = [
            "_ALL_PLAYERS",
          ];
        }
        return result;
      },
    };
    dispatch(game, rules);
    expect(
      game.seen.map(({ effect, targets }) => [
        effect.to,
        effect.nullified,
        effect.disresponsive,
        targets,
      ]),
    ).toEqual([
      ["b", false, true, ["b", "d"]],
      ["c", true, false, ["d"]],
      ["d", false, false, ["d"]],
    ]);
    expect(game.cardResources!.roomTags.CardUseNullifiedList).toEqual([
      "_ALL_TARGETS",
    ]);
    expect(trickCard(game).tags.CardUseDisresponsiveList).toEqual([
      "_ALL_PLAYERS",
    ]);
  });

  it("uses the current key for later writes and final removal, leaving an earlier key behind", () => {
    const game = fixture();
    const rules = registry();
    const observe = rules.operations![1];
    rules.operations![1] = {
      ...observe,
      run: (context) => {
        const result = observe.run(context);
        if ((context.operation.data as CardEffect).to === "b")
          context.game.cardResources!.cards.trick.key = "converted-string";
        else
          expect(
            context.game.cardResources!.roomTags["targetsconverted-string"],
          ).toEqual(["d"]);
        return result;
      },
    };
    dispatch(game, rules);
    expect(game.cardResources!.roomTags).toEqual({
      CardUseNullifiedList: ["c"],
      "targetsduel-string": ["b", "d"],
    });
  });

  it("keeps the parent snapshot independent from descriptor input mutations", () => {
    const game = fixture();
    const rules = registry();
    rules.operations![0] = createCardUseOperation({
      ...resourceRules,
      effect: (data) => {
        if (data.to === "b") data.from = "d";
        return { name: "observe-effect", data };
      },
    });
    dispatch(game, rules);
    expect(game.seen.map((entry) => entry.effect.from)).toEqual([
      "d",
      "a",
      "a",
    ]);
  });

  it.each([0, 1, 2])(
    "does not repeat a pending effect or targets write after JSON reload at index %s",
    (index) => {
      let game = fixture();
      const rules = registry();
      const observe = rules.operations![1];
      rules.operations![1] = {
        ...observe,
        run: (context) => {
          if (context.continuation !== null)
            return { kind: "return", value: true };
          const result = observe.run(context);
          return context.game.seen.length === index + 1
            ? {
                kind: "prompt",
                actor: "b",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              }
            : result;
        },
      };
      let scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "b")!;
      expect(prompt).not.toBeNull();
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      game.cardResources!.roomTags["targetsduel-string"] = [
        "nested-eager-write",
      ];
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(game.seen.map((entry) => entry.effect.to)).toEqual([
        "b",
        "c",
        "d",
      ]);
      expect(game.seen.length).toBe(3);
      expect(game.cardResources!.roomTags).toEqual({
        CardUseNullifiedList: ["c"],
      });
      const after = structuredClone({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect({ game, scheduler }).toEqual(after);
    },
  );

  it("does not restore targets or flag tags around a nested use of the same reference", () => {
    const game = fixture();
    const rules = registry();
    const observe = rules.operations![1];
    rules.operations![1] = {
      ...observe,
      run: (context) => {
        if (context.continuation !== null) {
          context.game.cardResources!.roomTags.NestedTargetsAbsent = !(
            "targetsduel-string" in context.game.cardResources!.roomTags
          );
          return { kind: "return", value: true };
        }
        const result = observe.run(context);
        const effect = context.operation.data as CardEffect;
        if (effect.from === "a" && effect.to === "b") {
          context.game.cardResources!.roomTags.CardUseNullifiedList = ["d"];
          trickCard(context.game).tags.CardUseDisresponsiveList = [
            "_ALL_PLAYERS",
          ];
          return {
            kind: "operation",
            operation: {
              name: "card-use",
              data: { ...useData(), from: "c", to: ["d"] },
            },
            continuation: true,
          };
        }
        return result;
      },
    };
    dispatch(game, rules);
    expect(
      game.seen.map(({ effect, targets }) => [
        effect.from,
        effect.to,
        effect.multiple,
        effect.nullified,
        effect.disresponsive,
        targets,
      ]),
    ).toEqual([
      ["a", "b", true, false, true, ["b", "d"]],
      ["c", "d", false, true, true, []],
      ["a", "c", true, true, false, ["d"]],
      ["a", "d", true, false, false, ["d"]],
    ]);
    expect(game.cardResources!.roomTags).toEqual({
      CardUseNullifiedList: ["d"],
      NestedTargetsAbsent: true,
    });
  });

  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes eager targets on %s without cleanup or later children",
    (reason) => {
      const game = fixture();
      const rules = registry();
      const observe = rules.operations![1];
      rules.operations![1] = {
        ...observe,
        run: (context) => {
          observe.run(context);
          return { kind: "interrupt", reason };
        },
      };
      const scheduler = dispatch(game, rules);
      expect(game.seen.map((entry) => entry.effect.to)).toEqual(["b"]);
      expect(game.cardResources!.roomTags["targetsduel-string"]).toEqual([
        "b",
        "d",
      ]);
      expect(scheduler.interruption?.reason).toBe(reason);
    },
  );

  it.each([null, "b", [1]])(
    "rejects malformed room list tags before any frame or targets write: %j",
    (value) => {
      const game = fixture();
      game.cardResources!.roomTags.CardUseNullifiedList = value;
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-use", data: useData() },
          "a",
        ),
      ).toThrow("Invalid card effect lists");
      expect({ game, scheduler }).toEqual(before);
    },
  );

  it.each([null, "b", [1]])(
    "rejects malformed card list tags before any frame or targets write: %j",
    (value) => {
      const game = fixture();
      trickCard(game).tags.CardUseDisresponsiveList = value;
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-use", data: useData() },
          "a",
        ),
      ).toThrow("Invalid card effect lists");
      expect({ game, scheduler }).toEqual(before);
    },
  );

  it("preserves completed child side effects and eager tags if the reference becomes malformed", () => {
    const game = fixture();
    const rules = registry();
    const observe = rules.operations![1];
    rules.operations![1] = {
      ...observe,
      run: (context) => {
        const result = observe.run(context);
        context.game.cardResources!.cards.trick.key = "";
        return result;
      },
    };
    expect(() => dispatch(game, rules)).toThrow(
      "Invalid card resource reference",
    );
    expect(game.seen.map((entry) => entry.effect.to)).toEqual(["b"]);
    expect(game.cardResources!.roomTags["targetsduel-string"]).toEqual([
      "b",
      "d",
    ]);
  });
  it("snapshots resource lists and dispatches each original target with its remaining unnullified targets", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(
      game.seen.map(({ effect, targets }) => [
        effect.to,
        effect.multiple,
        effect.nullified,
        effect.disresponsive,
        targets,
      ]),
    ).toEqual([
      ["b", true, false, true, ["b", "d"]],
      ["c", true, true, false, ["d"]],
      ["d", true, false, false, ["d"]],
    ]);
    expect(game.cardResources!.roomTags).toEqual({
      CardUseNullifiedList: ["c"],
    });
    expect(scheduler.frames).toEqual([]);
  });
});
