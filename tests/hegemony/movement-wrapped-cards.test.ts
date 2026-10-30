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
import type {
  CardFace,
  WrappedCard,
  WrappedCardRules,
} from "../../src/game/hegemony/wrapped-cards";

const original: CardFace = {
  name: "slash",
  className: "Slash",
  suit: "spade",
  number: 7,
  skillName: "",
};
function fixture(): CardMovementGame & {
  seen: Record<string, Record<number, WrappedCard> | null>;
} {
  return {
    seatOrder: ["a", "b"],
    alive: { a: true, b: true },
    cardZones: {
      aHand: { place: "hand", owner: "a", cards: [1, 2] },
      bHand: { place: "hand", owner: "b", cards: [] },
      bEquip: { place: "equip", owner: "b", cards: [] },
      bDelayed: { place: "delayed", owner: "b", cards: [] },
      bJudge: { place: "judge", owner: "b", cards: [] },
      bPile: { place: "special", owner: "b", pileName: "test", cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
      table: { place: "table", owner: null, cards: [] },
      draw: { place: "draw", owner: null, cards: [] },
      wugu: { place: "wugu", owner: null, cards: [] },
    },
    wrappedCards: {
      1: {
        ...original,
        name: "peach",
        className: "Peach",
        suit: "heart",
        number: 9,
        skillName: "conversion",
        modified: true,
        flags: ["visible", "kept"],
        tags: { kept: 42 },
      },
      2: { ...original, modified: false, flags: [], tags: {} },
    },
    seen: {},
  };
}
type Game = ReturnType<typeof fixture>;
function registry(
  wrappedRules: WrappedCardRules<Game> = {
    originals: { 1: original, 2: original },
  },
): TriggerRegistry<Game> {
  return {
    version: "wrapped-ce4e62b",
    operations: [
      createCardMovementOperation(
        undefined,
        undefined,
        undefined,
        undefined,
        wrappedRules,
      ),
    ],
    skills: [
      {
        id: "observe",
        rule: true,
        priority: 0,
        events: [
          "BeforeCardsMove",
          "ConfirmMoveCards",
          "PreCardsMoveOneTime",
          "CardsMoveOneTime",
        ],
        effect: ({ game, event }) => {
          game.seen[event.name] = structuredClone(game.wrappedCards ?? null);
          return { kind: "done", value: false };
        },
      },
    ],
  };
}
function dispatch(
  game: Game,
  rules: TriggerRegistry<Game>,
  moves: TriggerData[],
  forceVisible = false,
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(
    scheduler,
    game,
    rules,
    { name: "move-cards", data: { moves, forceVisible } },
    "a",
  );
  return scheduler;
}
describe("Hegemony wrapped card movement", () => {
  it("resets a modified discard face while retaining flags/tags and applying the final visibility flag", () => {
    const game = fixture();
    const before = structuredClone(game.wrappedCards);
    dispatch(game, registry(), [{ ids: [1], to: "discard" }]);
    expect(game.seen.ConfirmMoveCards).toEqual(before);
    expect(game.wrappedCards?.[1]).toEqual({
      ...original,
      modified: true,
      flags: ["kept"],
      tags: { kept: 42 },
    });
    expect(game.seen.PreCardsMoveOneTime).toEqual(game.wrappedCards);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
  });
  it("restores only the original suit/number on a converted delayed trick", () => {
    const game = fixture();
    dispatch(game, registry(), [{ ids: [1], to: "bDelayed" }]);
    expect(game.wrappedCards?.[1]).toEqual({
      ...original,
      name: "peach",
      className: "Peach",
      skillName: "conversion",
      modified: true,
      flags: ["kept"],
      tags: { kept: 42 },
    });
    expect(game.cardZones.bDelayed.cards).toEqual([1]);
  });
  it("refilters for the recipient after loss reset and remapping, before adding destination inventory", () => {
    const game = fixture();
    dispatch(
      game,
      registry({
        originals: { 1: original, 2: original },
        filters: () => [
          {
            matches: (context, card) =>
              context.owner === "b" &&
              context.mappings[1] === "bHand" &&
              context.mappings[2] === "aHand" &&
              !context.game.cardZones.aHand.cards.includes(1) &&
              context.game.cardZones.bHand.cards.length === 0 &&
              card.suit === "spade" &&
              !card.modified,
            transform: () => ({
              ...original,
              suit: "heart",
              skillName: "hongyan",
            }),
          },
        ],
      }),
      [{ ids: [1], to: "bHand" }],
    );
    expect(game.wrappedCards?.[1]).toEqual({
      ...original,
      suit: "heart",
      skillName: "hongyan",
      modified: true,
      flags: ["kept"],
      tags: { kept: 42 },
    });
    expect(game.cardZones.bHand.cards).toEqual([1]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
  });
  it("rejects an invalid filter result without committing physical or wrapped storage", () => {
    const game = fixture();
    const before = structuredClone({
      zones: game.cardZones,
      cards: game.wrappedCards,
    });
    const rules = registry({
      originals: { 1: original, 2: original },
      filters: () => [
        {
          matches: () => true,
          transform: () => ({ ...original, number: NaN }),
        },
      ],
    });
    expect(() => dispatch(game, rules, [{ ids: [1], to: "bHand" }])).toThrow(
      "Invalid card face",
    );
    expect({ zones: game.cardZones, cards: game.wrappedCards }).toEqual(before);
  });

  it.each(["bHand", "bEquip", "bJudge", "bPile"])(
    "resets modified metadata when entering %s even with no eligible filters",
    (to) => {
      const game = fixture();
      dispatch(game, registry(), [{ ids: [1], to }]);
      expect(game.wrappedCards?.[1]).toEqual({
        ...original,
        modified: true,
        flags: ["kept"],
        tags: { kept: 42 },
      });
    },
  );

  it.each(["table", "draw", "wugu"])(
    "retains the converted face entering %s and does not apply recipient filters",
    (to) => {
      const game = fixture();
      const before = structuredClone(game.wrappedCards![1]);
      dispatch(
        game,
        registry({
          originals: { 1: original, 2: original },
          filters: () => {
            throw new Error("Unexpected recipient filter");
          },
        }),
        [{ ids: [1], to }],
      );
      expect(game.wrappedCards?.[1]).toEqual({ ...before, flags: ["kept"] });
    },
  );

  it("does not reset an unmodified face merely because it differs from the original", () => {
    const game = fixture();
    game.wrappedCards![1].modified = false;
    dispatch(game, registry(), [{ ids: [1], to: "discard" }]);
    expect(game.wrappedCards?.[1]).toMatchObject({
      name: "peach",
      suit: "heart",
      number: 9,
      modified: true,
    });
  });

  it("restores suit/number for a delayed trick with no source player and skips recipient filtering", () => {
    const game = fixture();
    game.cardZones.aHand.cards = [2];
    game.cardZones.table.cards = [1];
    dispatch(
      game,
      registry({
        originals: { 1: original, 2: original },
        filters: () => {
          throw new Error("Unexpected delayed filter");
        },
      }),
      [{ ids: [1], to: "bDelayed" }],
    );
    expect(game.wrappedCards?.[1]).toMatchObject({
      name: "peach",
      suit: "spade",
      number: 7,
      skillName: "conversion",
    });
  });

  it.each([
    { forceVisible: false, open: true, to: "bHand", flags: ["kept"] },
    {
      forceVisible: true,
      open: false,
      to: "bHand",
      flags: ["kept", "visible"],
    },
    { forceVisible: true, open: true, to: "bEquip", flags: ["kept"] },
  ])(
    "sets visible from forceVisible=$forceVisible and destination=$to, independently of open=$open",
    ({ forceVisible, open, to, flags }) => {
      const game = fixture();
      dispatch(game, registry(), [{ ids: [1], to, open }], forceVisible);
      expect(game.wrappedCards?.[1].flags).toEqual(flags);
    },
  );

  it("sees all loss resets and all destination mappings before the first recipient filter", () => {
    const game = fixture();
    game.wrappedCards![2] = { ...game.wrappedCards![1] };
    dispatch(
      game,
      registry({
        originals: { 1: original, 2: original },
        filters: () => [
          {
            matches: (context) =>
              context.game.wrappedCards?.[2].name === "slash" &&
              context.game.wrappedCards[2].modified === false &&
              context.mappings[2] === "discard" &&
              context.game.cardZones.aHand.cards.length === 0 &&
              context.game.cardZones.discard.cards.length === 0,
            transform: () => ({
              ...original,
              suit: "diamond",
              skillName: "after-all-losses",
            }),
          },
        ],
      }),
      [
        { ids: [1], to: "bHand" },
        { ids: [2], to: "discard" },
      ],
    );
    expect(game.wrappedCards?.[1]).toMatchObject({
      suit: "diamond",
      skillName: "after-all-losses",
    });
    expect(game.wrappedCards?.[2]).toMatchObject(original);
  });

  it("resets the entire packet before eligible filter selection", () => {
    const game = fixture();
    game.wrappedCards![2] = { ...game.wrappedCards![1] };
    dispatch(
      game,
      registry({
        originals: { 1: original, 2: original },
        filters: ({ game }) =>
          game.wrappedCards?.[1].modified === false &&
          game.wrappedCards[2].modified === false
            ? [
                {
                  matches: () => true,
                  transform: () => ({
                    ...original,
                    suit: "club",
                    skillName: "packet-reset",
                  }),
                },
              ]
            : [],
      }),
      [{ ids: [1, 2], to: "bHand" }],
    );
    expect(game.wrappedCards?.[1]).toMatchObject({
      suit: "club",
      skillName: "packet-reset",
    });
    expect(game.wrappedCards?.[2]).toMatchObject({
      suit: "club",
      skillName: "packet-reset",
    });
  });

  it.each([false, true])(
    "preserves rewritten packet boundaries through merged notifications (reload: %s)",
    (reload) => {
      let game = fixture();
      game.wrappedCards![2] = structuredClone(game.wrappedCards![1]);
      const rules = registry({
        originals: { 1: original, 2: original },
        filters: ({ game }) => [
          {
            matches: () => true,
            transform: ({ id }) => ({
              ...original,
              suit:
                id === 1 && game.wrappedCards?.[2].name === "peach"
                  ? "club"
                  : id === 2 && game.wrappedCards?.[1].suit === "club"
                    ? "diamond"
                    : "heart",
            }),
          },
        ],
      });
      rules.skills.push({
        id: "split-packets",
        rule: true,
        priority: 1,
        events: ["BeforeCardsMove"],
        effect: ({ event }) => {
          event.data = {
            moves: [
              { ids: [1], to: "bHand", reason: "first" },
              { ids: [2], to: "bHand", reason: "second" },
            ],
          };
          return { kind: "done", value: false };
        },
      });
      if (reload)
        rules.skills.push({
          id: "pause-packets",
          rule: true,
          priority: 1,
          events: ["ConfirmMoveCards"],
          effect: ({ event, continuation }) =>
            event.target === "b" && continuation === null
              ? {
                  kind: "prompt",
                  actor: "b",
                  choices: ["continue"],
                  canCancel: false,
                  continuation: "waiting",
                }
              : { kind: "done", value: false },
        });
      let scheduler = dispatch(game, rules, [{ ids: [1, 2], to: "bHand" }]);
      if (reload) {
        const prompt = getTriggerPrompt(scheduler, "b")!;
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
      }
      expect(game.wrappedCards?.[1].suit).toBe("club");
      expect(game.wrappedCards?.[2].suit).toBe("diamond");
      expect(game.cardZones.bHand.cards).toEqual([1, 2]);
    },
  );

  it("orders recipient filtering by source action order after a Before rewrite", () => {
    const game = fixture();
    game.cardZones.aHand.cards = [1];
    game.cardZones.bHand.cards = [2];
    game.wrappedCards![2] = structuredClone(game.wrappedCards![1]);
    const rules = registry({
      originals: { 1: original, 2: original },
      filters: ({ game }) => [
        {
          matches: () => true,
          transform: ({ id }) => ({
            ...original,
            suit:
              id === 1 && game.wrappedCards?.[2].name === "peach"
                ? "club"
                : id === 2 && game.wrappedCards?.[1].suit === "club"
                  ? "diamond"
                  : "heart",
          }),
        },
      ],
    });
    rules.skills.push({
      id: "reverse-owners",
      rule: true,
      priority: 1,
      events: ["BeforeCardsMove"],
      effect: ({ event }) => {
        event.data = {
          moves: [
            { ids: [2], to: "aHand" },
            { ids: [1], to: "bHand" },
          ],
        };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, [{ ids: [1], to: "bHand" }]);
    expect(game.wrappedCards?.[1].suit).toBe("club");
    expect(game.wrappedCards?.[2].suit).toBe("diamond");
    expect(game.cardZones.aHand.cards).toEqual([2]);
    expect(game.cardZones.bHand.cards).toEqual([1]);
  });

  it("repeats eligible filters in supplied order, bounded by their count", () => {
    const game = fixture();
    dispatch(
      game,
      registry({
        originals: { 1: original, 2: original },
        filters: () => [
          {
            matches: (_, card) => card.suit === "spade",
            transform: (_, card) => ({ ...card, suit: "club" }),
          },
          {
            matches: (_, card) => card.suit === "heart",
            transform: (_, card) => ({ ...card, suit: "diamond" }),
          },
          {
            matches: (_, card) => card.suit === "club",
            transform: (_, card) => ({ ...card, suit: "heart" }),
          },
        ],
      }),
      [{ ids: [2], to: "bHand" }],
    );
    expect(game.wrappedCards?.[2].suit).toBe("diamond");
  });

  it("terminates a non-converging single filter after one pass", () => {
    const game = fixture();
    dispatch(
      game,
      registry({
        originals: { 1: original, 2: original },
        filters: () => [
          {
            matches: () => true,
            transform: (_, card) => ({ ...card, number: card.number + 1 }),
          },
        ],
      }),
      [{ ids: [2], to: "bHand" }],
    );
    expect(game.wrappedCards?.[2].number).toBe(8);
  });

  it("stops when no filter matches and still applies the final visible flag", () => {
    const game = fixture();
    dispatch(
      game,
      registry({
        originals: { 1: original, 2: original },
        filters: () => [
          {
            matches: () => false,
            transform: () => {
              throw new Error("Unexpected transform");
            },
          },
        ],
      }),
      [{ ids: [2], to: "bHand" }],
      true,
    );
    expect(game.wrappedCards?.[2]).toEqual({
      ...original,
      modified: true,
      flags: ["visible"],
      tags: {},
    });
  });

  it("refilters for a dead destination player because on-get has no living-only lookup", () => {
    const game = fixture();
    game.alive.b = false;
    dispatch(
      game,
      registry({
        originals: { 1: original, 2: original },
        filters: ({ owner }) =>
          owner === "b"
            ? [
                {
                  matches: () => true,
                  transform: () => ({ ...original, suit: "club" }),
                },
              ]
            : [],
      }),
      [{ ids: [1], to: "bHand" }],
    );
    expect(game.wrappedCards?.[1].suit).toBe("club");
  });

  it.each(["missing-wrapper", "missing-original", "invalid-face"])(
    "rejects %s during pure preflight without allocating a frame",
    (variant) => {
      const game = fixture();
      const originals = { 1: { ...original }, 2: original };
      if (variant === "missing-wrapper") delete game.wrappedCards![1];
      else if (variant === "missing-original") {
        const rules = registry({ originals: { 2: original } });
        const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
        const before = JSON.stringify({ game, scheduler });
        expect(() =>
          dispatchTriggerOperation(
            scheduler,
            game,
            rules,
            {
              name: "move-cards",
              data: { moves: [{ ids: [1], to: "discard" }] },
            },
            "a",
          ),
        ).toThrow("Missing wrapped card metadata");
        expect(JSON.stringify({ game, scheduler })).toBe(before);
        return;
      } else originals[1].number = NaN;
      const rules = registry({ originals });
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = JSON.stringify({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          {
            name: "move-cards",
            data: { moves: [{ ids: [1], to: "discard" }] },
          },
          "a",
        ),
      ).toThrow();
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    },
  );

  it("rejects malformed forceVisible during preflight", () => {
    const game = fixture();
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = JSON.stringify({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "move-cards",
          data: { moves: [{ ids: [1], to: "bHand" }], forceVisible: "yes" },
        },
        "a",
      ),
    ).toThrow("Invalid forced movement visibility");
    expect(JSON.stringify({ game, scheduler })).toBe(before);
  });

  it("does not apply wrapped updates to cancelled Before moves or same-zone no-ops", () => {
    const game = fixture();
    const rules = registry();
    const before = structuredClone({
      zones: game.cardZones,
      cards: game.wrappedCards,
    });
    dispatch(game, rules, [{ ids: [1], to: "aHand" }]);
    expect({ zones: game.cardZones, cards: game.wrappedCards }).toEqual(before);
    rules.skills.push({
      id: "cancel",
      rule: true,
      priority: 1,
      events: ["BeforeCardsMove"],
      effect: () => ({ kind: "done", value: true }),
    });
    dispatch(game, rules, [{ ids: [1], to: "discard" }]);
    expect({ zones: game.cardZones, cards: game.wrappedCards }).toEqual(before);
  });

  it("uses the destination rewritten by BeforeCardsMove", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "rewrite",
      rule: true,
      priority: 1,
      events: ["BeforeCardsMove"],
      effect: ({ event }) => {
        event.data = { moves: [{ ids: [1], to: "table" }] };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, [{ ids: [1], to: "discard" }]);
    expect(game.wrappedCards?.[1]).toMatchObject({
      name: "peach",
      suit: "heart",
      number: 9,
    });
    expect(game.cardZones.table.cards).toEqual([1]);
  });

  it("retains legacy behavior when wrapped rules are not registered", () => {
    const game = fixture();
    const rules = registry();
    rules.operations = [createCardMovementOperation()];
    const before = structuredClone(game.wrappedCards);
    dispatch(game, rules, [{ ids: [1], to: "discard" }]);
    expect(game.wrappedCards).toEqual(before);
  });

  it("commits wrapped metadata once after a Confirm prompt and JSON reload", () => {
    let game = fixture();
    const before = structuredClone({
      zones: game.cardZones,
      cards: game.wrappedCards,
    });
    const rules = registry();
    rules.skills.push({
      id: "pause",
      rule: true,
      priority: 1,
      events: ["ConfirmMoveCards"],
      effect: ({ event, continuation }) =>
        event.target === "b" && continuation === null
          ? {
              kind: "prompt",
              actor: "b",
              choices: ["continue"],
              canCancel: false,
              continuation: "waiting",
            }
          : { kind: "done", value: false },
    });
    let scheduler = dispatch(game, rules, [{ ids: [1], to: "bHand" }], true);
    expect({ zones: game.cardZones, cards: game.wrappedCards }).toEqual(before);
    const prompt = getTriggerPrompt(scheduler, "b")!;
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect({ zones: game.cardZones, cards: game.wrappedCards }).toEqual(before);
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(game.wrappedCards?.[1]).toEqual({
      ...original,
      modified: true,
      flags: ["kept", "visible"],
      tags: { kept: 42 },
    });
    const committed = JSON.stringify({ game, scheduler });
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(committed);
  });

  it("preserves a nested Confirm movement and its wrapped update when the outer commit is stale", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "nested",
      rule: true,
      priority: 1,
      events: ["ConfirmMoveCards"],
      effect: ({ event, continuation }) =>
        event.target === "b" &&
        continuation === null &&
        JSON.stringify(event.data).includes('"to":"discard"')
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: { moves: [{ ids: [1], to: "table" }] },
              },
              continuation: "moved",
            }
          : { kind: "done", value: false },
    });
    expect(() => dispatch(game, rules, [{ ids: [1], to: "discard" }])).toThrow(
      "Stale card movement",
    );
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([]);
    expect(game.wrappedCards?.[1]).toMatchObject({
      name: "peach",
      suit: "heart",
      number: 9,
      flags: ["kept"],
    });
  });

  it("keeps physical and wrapped storage unchanged when a later packet's filter throws", () => {
    const game = fixture();
    const before = structuredClone({
      zones: game.cardZones,
      cards: game.wrappedCards,
    });
    const rules = registry({
      originals: { 1: original, 2: original },
      filters: () => [
        {
          matches: () => true,
          transform: () => {
            throw new Error("Bad package filter");
          },
        },
      ],
    });
    expect(() =>
      dispatch(game, rules, [
        { ids: [1], to: "discard" },
        { ids: [2], to: "bHand" },
      ]),
    ).toThrow("Bad package filter");
    expect({ zones: game.cardZones, cards: game.wrappedCards }).toEqual(before);
  });

  it("uses final package diversion before applying discard lose hooks", () => {
    const game = fixture();
    const face = {
      ...original,
      name: "imperial_order",
      className: "ImperialOrder",
    };
    game.wrappedCards![1] = {
      ...game.wrappedCards![1],
      name: face.name,
      className: face.className,
    };
    const rules = registry();
    rules.operations = [
      createCardMovementOperation(
        undefined,
        undefined,
        undefined,
        { cardIDs: [1], wuguZone: "wugu" },
        { originals: { 1: face, 2: original } },
      ),
    ];
    dispatch(game, rules, [{ ids: [1], to: "discard" }]);
    expect(game.cardZones.wugu.cards).toEqual([1]);
    expect(game.wrappedCards?.[1]).toMatchObject({
      name: "imperial_order",
      suit: "heart",
      number: 9,
      skillName: "conversion",
    });
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
  });
});
