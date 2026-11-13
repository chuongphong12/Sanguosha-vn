import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createCardOnUseOperation,
  type CardUse,
} from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import {
  createCardFinishedRule,
  type CardResourceGame,
  type CardResources,
} from "../../src/game/hegemony/card-resources";

type ResourceUse = CardUse & {
  card: CardUse["card"] & { reference: string };
  nullified_list?: string[];
  disresponsive_list?: string[];
};
type Game = CardResourceGame & {
  seen: { event: string; data: TriggerData; resources: CardResources }[];
};
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    cardZones: {
      hand: { owner: "a", place: "hand", cards: [1] },
      table: { owner: null, place: "table", cards: [] },
      discard: { owner: null, place: "discard", cards: [] },
    },
    cardResources: {
      roomTags: {},
      playerTags: { a: {}, b: {}, c: {} },
      cards: {
        slash: {
          kind: "virtual",
          key: "slash-string",
          isSlash: true,
          isNDTrick: false,
          flags: [],
          tags: {},
        },
        trick: {
          kind: "virtual",
          key: "trick-string",
          isSlash: false,
          isNDTrick: true,
          flags: [],
          tags: {},
        },
      },
    },
    seen: [],
  };
}
function useData(): ResourceUse {
  return {
    from: "a",
    to: ["b", "c"],
    card: {
      type: "basic",
      name: "slash",
      className: "Slash",
      skillName: "",
      materialIDs: [1],
      flags: [],
      reference: "slash",
    },
  };
}
const resourceRules = {
  reference: (use: CardUse) => (use as ResourceUse).card.reference,
};
function registry(): TriggerRegistry<Game> {
  return {
    version: "card-resources-ce4e62b",
    operations: [
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardMovementOperation(),
      createCardUsedOperation({
        resources: resourceRules,
        use: (data) => ({ name: "apply-use", data }),
      }),
      {
        name: "apply-use",
        run: ({ game, operation }) => {
          game.seen.push({
            event: "apply-use",
            data: structuredClone(operation.data),
            resources: structuredClone(game.cardResources!),
          });
          return { kind: "return", value: null };
        },
      },
    ],
    skills: [
      createCardUsedRule(),
      createCardFinishedRule(resourceRules),
      {
        id: "observe-resources",
        rule: true,
        priority: 1,
        events: [
          "TargetRecord",
          "TargetChosen",
          "TargetConfirmed",
          "CardFinished",
        ],
        effect: ({ game, event }) => {
          game.seen.push({
            event: event.name,
            data: structuredClone(event.data),
            resources: structuredClone(game.cardResources!),
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

function wrappedFixture(modified: boolean): Game {
  const game = fixture();
  game.wrappedCards = {
    1: {
      name: "slash",
      className: "Slash",
      suit: "club",
      number: 7,
      skillName: "",
      modified,
      flags: ["used", "visible"],
      tags: { keep: "card-tag" },
    },
  };
  game.cardResources!.cards.slash = {
    kind: "wrapped",
    id: 1,
    key: "1",
    isSlash: true,
    isNDTrick: false,
  };
  return game;
}
function dispatchFinish(
  game: Game,
  rules = registry(),
  data: TriggerData = useData(),
) {
  rules.operations!.push({
    name: "finish-only",
    run: ({ operation, continuation }) =>
      continuation === null
        ? {
            kind: "event",
            event: { name: "CardFinished", target: "a", data: operation.data },
            continuation: "finished",
          }
        : { kind: "return", value: null },
  });
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(
    scheduler,
    game,
    rules,
    { name: "finish-only", data },
    "b",
  );
  return scheduler;
}

describe("Hegemony GameRule normal card-use resources", () => {
  it("composes wrapped resource cleanup with the existing forced-visible material lifecycle", () => {
    const game = wrappedFixture(false);
    game.wrappedCards![1].flags = ["GlobalCardUseDisresponsive"];
    const original = {
      name: "slash",
      className: "Slash",
      suit: "club",
      number: 7,
      skillName: "",
    };
    const rules = registry();
    rules.operations![1] = createCardMovementOperation(
      undefined,
      undefined,
      undefined,
      undefined,
      { originals: { 1: original } },
    );
    rules.skills.push({
      id: "after-wrapped-finish",
      rule: true,
      priority: -1,
      events: ["CardFinished"],
      effect: ({ game }) => {
        expect(game.wrappedCards![1].flags).toEqual([]);
        expect(game.wrappedCards![1].modified).toBe(true);
        expect(game.cardResources!.playerTags.a).toEqual({});
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(game.wrappedCards![1]).toEqual({
      ...original,
      modified: true,
      flags: [],
      tags: { keep: "card-tag", CardUseDisresponsiveList: ["_ALL_PLAYERS"] },
    });
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it.each([
    "TargetRecord",
    "TargetChosen",
    "TargetConfirmed",
    "apply-use",
    "before-finish",
    "after-finish",
  ])(
    "preserves resources and nonempty backup through JSON reload at %s",
    (at) => {
      const initial = () => {
        const game = fixture();
        game.cardResources!.playerTags.a["Jink_slash-string"] = [3];
        const card = game.cardResources!.cards.slash;
        if (card.kind !== "virtual") throw new Error("Expected virtual card");
        card.flags = ["GlobalCardUseNullified"];
        return game;
      };
      const baseline = initial();
      dispatch(baseline);
      let game = initial();
      const rules = registry();
      if (at === "apply-use") {
        const apply = rules.operations![3];
        rules.operations![3] = {
          ...apply,
          run: (context) =>
            context.continuation === null
              ? {
                  kind: "prompt",
                  actor: "c",
                  choices: ["continue"],
                  canCancel: false,
                  continuation: "waiting",
                }
              : apply.run(context),
        };
      } else {
        const eventName = at.endsWith("finish") ? "CardFinished" : at;
        rules.skills.push({
          id: "pause-resources",
          rule: true,
          priority: at === "before-finish" ? 2 : at === "after-finish" ? -1 : 0,
          events: [eventName],
          effect: ({ event, continuation }) => {
            const index = (event.data as { index?: number }).index;
            const first =
              eventName === "TargetChosen" || eventName === "TargetConfirmed"
                ? index === 0
                : true;
            return first && continuation === null
              ? {
                  kind: "prompt",
                  actor: "c",
                  choices: ["continue"],
                  canCancel: false,
                  continuation: "waiting",
                }
              : { kind: "done", value: false };
          },
        });
      }
      let scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "c")!;
      expect(prompt).not.toBeNull();
      expect(game.cardZones.table.cards).toEqual([1]);
      expect(getTriggerPrompt(scheduler, "a")).toBeNull();
      if (at === "before-finish")
        expect(game.cardResources!.playerTags.a["Jink_slash-string"]).toEqual([
          3,
        ]);
      if (at === "after-finish")
        expect(game.cardResources!.playerTags.a).toEqual({});
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(game).toEqual(baseline);
      expect(scheduler.frames).toEqual([]);
      const finished = JSON.stringify({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(finished);
    },
  );
  it.each(["shared-reference", "distinct-same-string"])(
    "keeps native nested-use tag behavior with %s",
    (mode) => {
      const game = fixture();
      game.cardResources!.playerTags.a["Jink_slash-string"] = [3];
      game.cardResources!.cards.otherSlash = structuredClone(
        game.cardResources!.cards.slash,
      );
      const rules = registry();
      const apply = rules.operations![3];
      rules.operations![3] = {
        ...apply,
        run: (context) => {
          const data = context.operation.data as ResourceUse & {
            nested?: boolean;
          };
          return !data.nested && context.continuation === null
            ? {
                kind: "operation",
                operation: {
                  name: "card-on-use",
                  data: {
                    ...useData(),
                    to: ["c"],
                    card: {
                      ...useData().card,
                      materialIDs: [],
                      reference:
                        mode === "shared-reference" ? "slash" : "otherSlash",
                    },
                    nullified_list: ["c"],
                    disresponsive_list: ["c"],
                    nested: true,
                  },
                },
                continuation: "nested-finished",
              }
            : apply.run(context);
        },
      };
      const scheduler = dispatch(game, rules, {
        ...useData(),
        nullified_list: ["b"],
        disresponsive_list: ["b"],
      });
      const effects = game.seen.filter((entry) => entry.event === "apply-use");
      expect(effects).toHaveLength(2);
      expect(
        effects[1].resources.playerTags.a["Jink_slash-string"],
      ).toBeUndefined();
      expect(
        game.seen
          .filter((entry) => entry.event === "CardFinished")
          .map((entry) => entry.resources.playerTags.a["Jink_slash-string"]),
      ).toEqual([[1, 1], [3]]);
      const outer = game.cardResources!.cards.slash;
      const inner = game.cardResources!.cards.otherSlash;
      if (outer.kind !== "virtual" || inner.kind !== "virtual")
        throw new Error("Expected virtual cards");
      expect(outer.tags.CardUseDisresponsiveList).toEqual(
        mode === "shared-reference" ? ["c"] : ["b"],
      );
      if (mode === "distinct-same-string")
        expect(inner.tags.CardUseDisresponsiveList).toEqual(["c"]);
      expect(game.cardResources!.roomTags.CardUseNullifiedList).toEqual(["c"]);
      expect(game.cardResources!.playerTags.a).toEqual({});
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(scheduler.frames).toEqual([]);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes eager resources without fabricated unwind on %s",
    (reason) => {
      const game = fixture();
      game.cardResources!.playerTags.a["Jink_slash-string"] = [3];
      const rules = registry();
      rules.operations![3] = {
        name: "apply-use",
        run: () => ({ kind: "interrupt", reason }),
      };
      const scheduler = dispatch(game, rules);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.cardResources!.playerTags.a["Jink_slash-string"]).toEqual([
        1, 1,
      ]);
      expect(game.cardResources!.roomTags.CardUseNullifiedList).toEqual([]);
      expect(game.cardZones.table.cards).toEqual([1]);
      expect(game.cardZones.discard.cards).toEqual([]);
      expect(game.seen.some((entry) => entry.event === "CardFinished")).toBe(
        false,
      );
      expect(JSON.parse(JSON.stringify({ game, scheduler }))).toEqual({
        game,
        scheduler,
      });
    },
  );
  it("isolates pure reference mapping from persisted use data", () => {
    const game = fixture();
    const rules = registry();
    rules.operations![2] = createCardUsedOperation({
      resources: {
        reference: (use) => {
          use.to = [];
          return "slash";
        },
      },
      use: (data) => ({ name: "apply-use", data }),
    });
    dispatch(game, rules);
    expect(game.seen[0].resources.playerTags.a["Jink_slash-string"]).toEqual([
      1, 1,
    ]);
    expect(
      (
        game.seen.find((entry) => entry.event === "apply-use")
          ?.data as ResourceUse
      ).to,
    ).toEqual(["b", "c"]);
  });
  const invalidResources: Array<[string, (game: Game) => void]> = [
    [
      "missing ledger",
      (game) => {
        game.cardResources = undefined;
      },
    ],
    [
      "missing source tags",
      (game) => {
        delete game.cardResources!.playerTags.a;
      },
    ],
    [
      "unknown reference",
      (game) => {
        delete game.cardResources!.cards.slash;
      },
    ],
    [
      "empty card key",
      (game) => {
        game.cardResources!.cards.slash.key = "";
      },
    ],
    [
      "wrong kind",
      (game) => {
        Object.assign(game.cardResources!.cards.slash, { kind: "unknown" });
      },
    ],
    [
      "invalid ancestry",
      (game) => {
        Object.assign(game.cardResources!.cards.slash, { isSlash: "yes" });
      },
    ],
    [
      "invalid flags",
      (game) => {
        Object.assign(game.cardResources!.cards.slash, { flags: [1] });
      },
    ],
    [
      "invalid tags",
      (game) => {
        Object.assign(game.cardResources!.cards.slash, { tags: null });
      },
    ],
    [
      "missing wrapper",
      (game) => {
        game.cardResources!.cards.slash = {
          kind: "wrapped",
          id: 1,
          key: "1",
          isSlash: true,
          isNDTrick: false,
        };
      },
    ],
    [
      "negative wrapper ID",
      (game) => {
        Object.assign(game.cardResources!.cards.slash, {
          kind: "wrapped",
          id: -1,
          key: "-1",
        });
      },
    ],
  ];
  it.each(invalidResources)(
    "rejects %s without allocating a frame or mutating resource state",
    (_, mutate) => {
      const game = fixture();
      mutate(game);
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = JSON.stringify({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-used", data: useData() },
          "b",
        ),
      ).toThrow(/Invalid/);
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    },
  );
  it("rejects a wrapped reference whose native string key differs from its physical ID", () => {
    const game = wrappedFixture(false);
    game.cardResources!.cards.slash.key = "not-1";
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = JSON.stringify({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-used", data: useData() },
        "b",
      ),
    ).toThrow("Invalid wrapped card reference");
    expect(JSON.stringify({ game, scheduler })).toBe(before);
  });
  it.each([false, true])(
    "clears wrapped flags without changing modified=%s or face/tags",
    (modified) => {
      const game = wrappedFixture(modified);
      game.cardResources!.playerTags.a.Jink_1 = [2];
      dispatchFinish(game);
      expect(game.wrappedCards![1]).toEqual({
        name: "slash",
        className: "Slash",
        suit: "club",
        number: 7,
        skillName: "",
        modified,
        flags: [],
        tags: { keep: "card-tag" },
      });
      expect(game.cardResources!.playerTags.a).toEqual({});
    },
  );
  it("uses shared wrapped flags/tags during use without a copied resource face", () => {
    const game = wrappedFixture(false);
    game.wrappedCards![1].flags = ["GlobalCardUseDisresponsive"];
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-used", data: useData() },
      "b",
    );
    expect(game.wrappedCards![1].tags.CardUseDisresponsiveList).toEqual([
      "_ALL_PLAYERS",
    ]);
    expect(game.wrappedCards![1].modified).toBe(false);
    expect(scheduler.operationCompletion?.value).toEqual({
      data: {
        ...useData(),
        index: 1,
        nullified_list: [],
        disresponsive_list: ["_ALL_PLAYERS"],
      },
    });
  });
  it("retains HegNullification tags for a delayed trick while clearing its flags", () => {
    const game = fixture();
    game.cardResources!.cards.trick.isNDTrick = false;
    const card = game.cardResources!.cards.trick;
    if (card.kind !== "virtual") throw new Error("Expected virtual card");
    card.flags = ["temporary"];
    game.cardResources!.roomTags["trick-stringHegNullificationTargets"] = ["c"];
    dispatchFinish(game, registry(), {
      ...useData(),
      card: {
        ...useData().card,
        type: "trick",
        name: "indulgence",
        className: "Indulgence",
        reference: "trick",
      },
    });
    expect(card.flags).toEqual([]);
    expect(game.cardResources!.roomTags).toEqual({
      "trick-stringHegNullificationTargets": ["c"],
    });
  });
  it("allows CardFinished consumption before GameRule while fallback discard still occurs", () => {
    const game = fixture();
    game.cardResources!.playerTags.a["Jink_slash-string"] = [3];
    const card = game.cardResources!.cards.slash;
    if (card.kind !== "virtual") throw new Error("Expected virtual card");
    card.flags = ["temporary"];
    const rules = registry();
    rules.skills.push({
      id: "consume-finished",
      rule: true,
      priority: 2,
      events: ["CardFinished"],
      effect: () => ({ kind: "done", value: true }),
    });
    dispatch(game, rules);
    expect(card.flags).toEqual(["temporary"]);
    expect(game.cardResources!.playerTags.a["Jink_slash-string"]).toEqual([3]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it("cleans only the source/reference rewritten by a higher-priority CardFinished handler", () => {
    const game = fixture();
    const original = game.cardResources!.cards.slash;
    const final = game.cardResources!.cards.trick;
    if (original.kind !== "virtual" || final.kind !== "virtual")
      throw new Error("Expected virtual cards");
    original.flags = ["original"];
    final.flags = ["final"];
    game.cardResources!.roomTags["trick-stringHegNullificationTargets"] = ["b"];
    game.cardResources!.playerTags.a["Jink_slash-string"] = [3];
    const rules = registry();
    rules.skills.push({
      id: "replace-finished",
      rule: true,
      priority: 2,
      events: ["CardFinished"],
      effect: ({ event }) => {
        const data = event.data as ResourceUse;
        event.data = {
          ...data,
          from: "b",
          card: {
            ...data.card,
            type: "trick",
            name: "duel",
            className: "Duel",
            reference: "trick",
          },
        };
        return { kind: "done", value: false };
      },
    });
    dispatchFinish(game, rules);
    expect(original.flags).toEqual(["original"]);
    expect(final.flags).toEqual([]);
    expect(game.cardResources!.roomTags).toEqual({});
    expect(game.cardResources!.playerTags.a["Jink_slash-string"]).toEqual([3]);
  });
  it("removes Slash Jink even when the source is deceased", () => {
    const game = fixture();
    game.alive.a = false;
    game.cardResources!.playerTags.a["Jink_slash-string"] = [2];
    dispatchFinish(game);
    expect(game.cardResources!.playerTags.a).toEqual({});
  });
  it.each([undefined, null, [], "not-a-list", 2, {}, false])(
    "does not restore an empty or non-list Jink backup: %j",
    (previous) => {
      const game = fixture();
      if (previous !== undefined)
        game.cardResources!.playerTags.a["Jink_slash-string"] = previous;
      const rules = registry();
      const apply = rules.operations![3];
      rules.operations![3] = {
        ...apply,
        run: (context) => {
          context.game.cardResources!.playerTags.a["Jink_slash-string"] = [4];
          return apply.run(context);
        },
      };
      dispatch(game, rules);
      expect(game.seen[0].resources.playerTags.a["Jink_slash-string"]).toEqual([
        1, 1,
      ]);
      expect(
        game.seen.at(-1)?.resources.playerTags.a["Jink_slash-string"],
      ).toEqual([4]);
      expect(game.cardResources!.playerTags.a).toEqual({});
    },
  );
  it("prepares and restores zero-target Slash even though Record is skipped", () => {
    const game = fixture();
    game.cardResources!.playerTags.a["Jink_slash-string"] = [
      2,
      "native-variant",
    ];
    dispatch(game, registry(), { ...useData(), to: [] });
    expect(game.seen.map((entry) => entry.event)).toEqual([
      "apply-use",
      "CardFinished",
    ]);
    expect(game.seen[0].resources.playerTags.a["Jink_slash-string"]).toEqual(
      [],
    );
    expect(game.seen[1].resources.playerTags.a["Jink_slash-string"]).toEqual([
      2,
      "native-variant",
    ]);
    expect(game.cardResources!.playerTags.a).toEqual({});
  });
  it("leaves a non-Slash Jink tag alone and defaults effect lists to empty", () => {
    const game = fixture();
    game.cardResources!.playerTags.a["Jink_trick-string"] = [3];
    dispatch(game, registry(), {
      ...useData(),
      card: { ...useData().card, reference: "trick" },
    });
    expect(game.seen[0].resources.playerTags.a["Jink_trick-string"]).toEqual([
      3,
    ]);
    expect(game.cardResources!.playerTags.a["Jink_trick-string"]).toEqual([3]);
    expect(
      game.seen.find((entry) => entry.event === "apply-use")?.data,
    ).toEqual({
      ...useData(),
      card: { ...useData().card, reference: "trick" },
      index: 1,
      nullified_list: [],
      disresponsive_list: [],
    });
  });
  it("initializes Jink from the source and targets after confirmation", () => {
    const game = fixture();
    game.cardResources!.playerTags.a["Jink_slash-string"] = [7];
    const rules = registry();
    rules.skills.push({
      id: "confirm-rewrite",
      rule: true,
      priority: 0,
      events: ["TargetConfirming"],
      effect: ({ event }) => {
        event.data = { ...(event.data as ResourceUse), from: "c", to: ["c"] };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(game.seen[0].resources.playerTags.c["Jink_slash-string"]).toEqual([
      1,
    ]);
    expect(game.cardResources!.playerTags.a["Jink_slash-string"]).toEqual([7]);
    expect(game.cardResources!.playerTags.c).toEqual({});
  });
  it("restores a nonempty backup to the final source/card even if it became a non-Slash", () => {
    const game = fixture();
    game.cardResources!.playerTags.a["Jink_slash-string"] = [3];
    const rules = registry();
    rules.skills.push({
      id: "record-rewrite",
      rule: true,
      priority: 0,
      events: ["TargetRecord"],
      effect: ({ event }) => {
        const data = event.data as ResourceUse;
        event.data = {
          ...data,
          from: "b",
          to: [],
          card: {
            ...data.card,
            type: "trick",
            name: "duel",
            className: "Duel",
            reference: "trick",
          },
        };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(
      game.seen.at(-1)?.resources.playerTags.b["Jink_trick-string"],
    ).toEqual([3]);
    expect(game.cardResources!.playerTags.b["Jink_trick-string"]).toEqual([3]);
    expect(game.cardResources!.playerTags.a["Jink_slash-string"]).toEqual([
      1, 1,
    ]);
  });
  it("uses the reference's current string key after the use child returns", () => {
    const game = fixture();
    game.cardResources!.playerTags.a["Jink_slash-string"] = [3];
    const rules = registry();
    const apply = rules.operations![3];
    rules.operations![3] = {
      ...apply,
      run: (context) => {
        context.game.cardResources!.cards.slash.key = "changed-key";
        return apply.run(context);
      },
    };
    dispatch(game, rules);
    expect(
      game.seen.at(-1)?.resources.playerTags.a["Jink_changed-key"],
    ).toEqual([3]);
    expect(game.cardResources!.playerTags.a).toEqual({
      "Jink_slash-string": [1, 1],
    });
  });
  it.each(["GlobalCardUseNullified", "GlobalCardUseDisresponsive"])(
    "reads %s added during final confirmation",
    (flag) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "late-flag",
        rule: true,
        priority: 0,
        events: ["TargetConfirmed"],
        effect: ({ game, event }) => {
          if (event.target === "c") {
            const card = game.cardResources!.cards.slash;
            if (card.kind !== "virtual")
              throw new Error("Expected virtual card");
            card.flags.push(flag);
            event.data = {
              ...(event.data as ResourceUse),
              nullified_list: ["c"],
              disresponsive_list: ["b"],
            };
          }
          return { kind: "done", value: false };
        },
      });
      dispatch(game, rules);
      expect(
        game.seen.find((entry) => entry.event === "apply-use")?.data,
      ).toEqual({
        ...useData(),
        index: 1,
        nullified_list:
          flag === "GlobalCardUseNullified" ? ["c", "_ALL_TARGETS"] : ["c"],
        disresponsive_list:
          flag === "GlobalCardUseDisresponsive" ? ["b", "_ALL_PLAYERS"] : ["b"],
      });
    },
  );
  it.each(["nullified_list", "disresponsive_list"])(
    "rejects non-string entries in %s atomically in standalone preflight",
    (field) => {
      const game = fixture();
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = JSON.stringify({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-used", data: { ...useData(), [field]: [1] } },
          "b",
        ),
      ).toThrow("Invalid card effect lists");
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    },
  );
  it("preserves eager Jink and prior effect tags when a later list rewrite is malformed", () => {
    const game = fixture();
    game.cardResources!.roomTags.CardUseNullifiedList = ["old"];
    const card = game.cardResources!.cards.slash;
    if (card.kind !== "virtual") throw new Error("Expected virtual card");
    card.tags.CardUseDisresponsiveList = ["old"];
    const rules = registry();
    rules.skills.push({
      id: "bad-list",
      rule: true,
      priority: 0,
      events: ["TargetRecord"],
      effect: ({ event }) => {
        event.data = {
          ...(event.data as ResourceUse),
          disresponsive_list: null,
        };
        return { kind: "done", value: false };
      },
    });
    expect(() => dispatch(game, rules)).toThrow("Invalid card effect lists");
    expect(game.cardResources!.playerTags.a["Jink_slash-string"]).toEqual([
      1, 1,
    ]);
    expect(game.cardResources!.roomTags.CardUseNullifiedList).toEqual(["old"]);
    expect(card.tags.CardUseDisresponsiveList).toEqual(["old"]);
    expect(game.cardZones.table.cards).toEqual([1]);
  });
  it.each(["nullified_list", "disresponsive_list"])(
    "rejects explicit null %s before allocating a standalone frame",
    (field) => {
      const game = fixture();
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = JSON.stringify({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-used", data: { ...useData(), [field]: null } },
          "b",
        ),
      ).toThrow("Invalid card effect lists");
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    },
  );
  it("clears final card flags and ND-trick HegNullification tags while retaining unrelated and effect tags", () => {
    const game = fixture();
    const card = game.cardResources!.cards.trick;
    if (card.kind !== "virtual") throw new Error("Expected virtual card");
    card.flags = ["GlobalCardUseNullified", "other-flag"];
    card.tags.keep = "card-tag";
    game.cardResources!.roomTags = {
      "trick-stringHegNullificationTargets": ["b"],
      keep: "room-tag",
    };
    game.cardResources!.playerTags.a["Jink_slash-string"] = [2];
    const rules = registry();
    rules.skills.push({
      id: "after-finished",
      rule: true,
      priority: -1,
      events: ["CardFinished"],
      effect: ({ game, event }) => {
        game.seen.push({
          event: "after-finished",
          data: event.data,
          resources: structuredClone(game.cardResources!),
        });
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, {
      ...useData(),
      card: {
        ...useData().card,
        type: "trick",
        name: "duel",
        className: "Duel",
        reference: "trick",
      },
    });
    expect(card.flags).toEqual([]);
    expect(card.tags).toEqual({
      keep: "card-tag",
      CardUseDisresponsiveList: [],
    });
    expect(game.cardResources!.roomTags).toEqual({
      keep: "room-tag",
      CardUseNullifiedList: ["_ALL_TARGETS"],
    });
    expect(game.cardResources!.playerTags.a["Jink_slash-string"]).toEqual([2]);
    expect(
      (game.seen.at(-2)?.resources.cards.trick as { flags: string[] }).flags,
    ).toEqual(["GlobalCardUseNullified", "other-flag"]);
    expect(
      (game.seen.at(-1)?.resources.cards.trick as { flags: string[] }).flags,
    ).toEqual([]);
  });
  it("reads live global flags, appends native sentinels without deduplication and writes effect tags", () => {
    const game = fixture();
    const card = game.cardResources!.cards.slash;
    if (card.kind !== "virtual") throw new Error("Expected virtual card");
    card.flags = ["GlobalCardUseNullified", "GlobalCardUseDisresponsive"];
    const scheduler = dispatch(game, registry(), {
      ...useData(),
      nullified_list: ["_ALL_TARGETS", "b"],
      disresponsive_list: ["_ALL_PLAYERS"],
    });
    const expected = {
      ...useData(),
      index: 1,
      nullified_list: ["_ALL_TARGETS", "b", "_ALL_TARGETS"],
      disresponsive_list: ["_ALL_PLAYERS", "_ALL_PLAYERS"],
    };
    expect(
      game.seen.find((entry) => entry.event === "apply-use")?.data,
    ).toEqual(expected);
    expect(game.cardResources!.roomTags.CardUseNullifiedList).toEqual([
      "_ALL_TARGETS",
      "b",
      "_ALL_TARGETS",
    ]);
    expect(card.tags.CardUseDisresponsiveList).toEqual([
      "_ALL_PLAYERS",
      "_ALL_PLAYERS",
    ]);
    expect(scheduler.operationCompletion?.value).toEqual({ data: expected });
  });
  it("initializes Slash Jink before Record and restores a nonempty backup before CardFinished", () => {
    const game = fixture();
    game.cardResources!.playerTags.a["Jink_slash-string"] = [3];
    const rules = registry();
    const apply = rules.operations![3];
    rules.operations![3] = {
      ...apply,
      run: (context) => {
        const result = apply.run(context);
        context.game.cardResources!.playerTags.a["Jink_slash-string"] = [4];
        return result;
      },
    };
    dispatch(game, rules);
    expect(game.seen[0].resources.playerTags.a["Jink_slash-string"]).toEqual([
      1, 1,
    ]);
    expect(
      game.seen.find((entry) => entry.event === "apply-use")?.resources
        .playerTags.a["Jink_slash-string"],
    ).toEqual([1, 1]);
    expect(
      game.seen.at(-1)?.resources.playerTags.a["Jink_slash-string"],
    ).toEqual([3]);
  });
});
