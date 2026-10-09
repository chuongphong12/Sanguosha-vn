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

function fixture(): CardMovementGame & { seen: Record<string, TriggerData> } {
  return {
    seatOrder: ["a", "b"],
    alive: { a: true, b: true },
    cardZones: {
      aHand: { place: "hand", owner: "a", cards: [1, 2] },
      bHand: { place: "hand", owner: "b", cards: [3] },
      discard: { place: "discard", owner: null, cards: [] },
      wugu: { place: "wugu", owner: null, cards: [] },
      table: { place: "table", owner: null, cards: [] },
    },
    seen: {},
  };
}

function registry(): TriggerRegistry<ReturnType<typeof fixture>> {
  return {
    version: "imperial-order-ce4e62b",
    operations: [
      createCardMovementOperation(undefined, undefined, undefined, {
        cardIDs: [1, 3],
        wuguZone: "wugu",
      }),
    ],
    skills: [
      {
        id: "observe",
        rule: true,
        priority: 0,
        events: ["BeforeCardsMove", "ConfirmMoveCards", "CardsMoveOneTime"],
        effect: ({ game, event }) => {
          game.seen[event.name] = structuredClone(event.data);
          game.seen[`${event.name}-order`] = structuredClone(
            game.imperialOrder ?? null,
          );
          return { kind: "done", value: false };
        },
      },
    ],
  };
}

function dispatch(
  game: ReturnType<typeof fixture>,
  rules: TriggerRegistry<ReturnType<typeof fixture>>,
  moves: TriggerData[],
  currentActor = "a",
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(
    scheduler,
    game,
    rules,
    { name: "move-cards", data: { moves } },
    currentActor,
  );
  return scheduler;
}

describe("Hegemony ImperialOrder movement", () => {
  it("diverts a discarded ImperialOrder before Confirm and preserves the remaining discard", () => {
    const game = fixture();
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: { moves: [{ ids: [1, 2], to: "discard", reason: "throw" }] },
      },
      "a",
    );
    expect(game.seen["BeforeCardsMove-order"]).toBeNull();
    expect(game.seen["ConfirmMoveCards-order"]).toEqual({
      invoke: true,
      cardID: 1,
    });
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        {
          ids: [1],
          from: ["aHand"],
          to: "wugu",
          toPlace: "wugu",
          originTo: "wugu",
          reason: "throw",
          lastHandcard: false,
        },
        { ids: [2], to: "discard", reason: "throw", lastHandcard: true },
      ],
    });
    expect(game.cardZones.wugu.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
    expect(game.cardZones.aHand.cards).toEqual([]);
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
  });

  it("lets USE of a virtual ImperialOrder reach discard without scheduling an invocation", () => {
    const game = fixture();
    const rules = registry();
    delete game.cardZones.wugu;
    dispatch(game, rules, [
      {
        ids: [1],
        to: "discard",
        reason: {
          kind: "use",
          use: { cardClass: "ImperialOrder", physicalID: null },
        },
      },
    ]);
    expect(game.imperialOrder).toBeUndefined();
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [{ ids: [1], to: "discard", reason: { kind: "use" } }],
    });
  });

  it.each<TriggerData>([
    null,
    "use",
    { kind: "use" },
    { kind: "use", use: null },
    { kind: "use", use: { cardClass: "Slash" } },
    { kind: "use", use: [] },
    { kind: "use", use: "ImperialOrder" },
    { kind: "throw", use: { cardClass: "ImperialOrder" } },
    { kind: "let-use", use: { cardClass: "ImperialOrder" } },
  ])(
    "diverts when the complete native USE exception is absent: %j",
    (reason) => {
      const game = fixture();
      dispatch(game, registry(), [{ ids: [1], to: "discard", reason }]);
      expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
      expect(game.cardZones.wugu.cards).toEqual([1]);
      expect(game.seen.ConfirmMoveCards).toMatchObject({
        moves: [{ ids: [1], to: "wugu", reason }],
      });
    },
  );

  it.each(["table", "bHand", "wugu"])(
    "does not schedule ImperialOrder for a direct %s destination",
    (to) => {
      const game = fixture();
      dispatch(game, registry(), [{ ids: [1], to }]);
      expect(game.imperialOrder).toBeUndefined();
      expect(game.cardZones[to].cards).toContain(1);
    },
  );

  it("keeps existing pending tags during unrelated and used-ImperialOrder moves", () => {
    const game = fixture();
    game.imperialOrder = { invoke: true, cardID: 3 };
    dispatch(game, registry(), [
      {
        ids: [1, 2],
        to: "discard",
        reason: { kind: "use", use: { cardClass: "ImperialOrder" } },
      },
    ]);
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 3 });
    expect(game.cardZones.discard.cards).toEqual([2, 1]);
  });

  it("uses the last eligible card in normalized current-first move order, rather than a queue", () => {
    const game = fixture();
    dispatch(
      game,
      registry(),
      [
        { ids: [1], to: "discard" },
        { ids: [3], to: "discard" },
      ],
      "b",
    );
    expect(game.cardZones.wugu.cards).toEqual([3, 1]);
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
  });

  it.each(["wugu", "otherWugu"])(
    "sets pending tags even when the generated replacement from %s is a no-op",
    (source) => {
      const game = fixture();
      game.cardZones.aHand.cards = [2];
      game.cardZones[source] = { place: "wugu", owner: null, cards: [1] };
      dispatch(game, registry(), [
        { ids: [1], to: "discard", reason: "throw" },
      ]);
      expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
      expect(game.cardZones[source].cards).toEqual([]);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.seen.ConfirmMoveCards).toMatchObject({
        moves: [{ ids: [1], to: "discard", reason: "throw" }],
      });
    },
  );

  it("leaves legacy movement unchanged when ImperialOrder metadata is absent", () => {
    const game = fixture();
    const rules = registry();
    rules.operations = [createCardMovementOperation()];
    dispatch(game, rules, [{ ids: [1], to: "discard" }]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.imperialOrder).toBeUndefined();
  });

  it.each(["missing", "wrong-place", "wrong-owner"])(
    "rejects a %s WuGu destination before physical commit",
    (variant) => {
      const game = fixture();
      if (variant === "missing") delete game.cardZones.wugu;
      else if (variant === "wrong-place") game.cardZones.wugu.place = "table";
      else game.cardZones.wugu.owner = "a";
      const zones = structuredClone(game.cardZones);
      expect(() =>
        dispatch(game, registry(), [{ ids: [1], to: "discard" }]),
      ).toThrow("Invalid WuGu destination");
      expect(game.cardZones).toEqual(zones);
    },
  );

  it.each(["to-discard", "away-from-discard", "change-use"])(
    "uses the final BeforeCardsMove rewrite: %s",
    (variant) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "rewrite",
        rule: true,
        priority: 1,
        events: ["BeforeCardsMove"],
        effect: ({ event }) => {
          event.data = {
            moves: [
              {
                ids: [1],
                to: variant === "away-from-discard" ? "table" : "discard",
                reason:
                  variant === "change-use"
                    ? { kind: "use", use: { cardClass: "ImperialOrder" } }
                    : "throw",
              },
            ],
          };
          return { kind: "done", value: false };
        },
      });
      dispatch(game, rules, [
        { ids: [1], to: variant === "to-discard" ? "table" : "discard" },
      ]);
      expect(game.imperialOrder).toEqual(
        variant === "to-discard" ? { invoke: true, cardID: 1 } : undefined,
      );
      expect(game.cardZones.wugu.cards).toEqual(
        variant === "to-discard" ? [1] : [],
      );
      expect(
        game.cardZones[variant === "away-from-discard" ? "table" : "discard"]
          .cards,
      ).toEqual(variant === "to-discard" ? [] : [1]);
    },
  );

  it("does not set pending state if BeforeCardsMove consumes the movement", () => {
    const game = fixture();
    const zones = structuredClone(game.cardZones);
    const rules = registry();
    rules.skills.push({
      id: "cancel",
      rule: true,
      priority: 1,
      events: ["BeforeCardsMove"],
      effect: () => ({ kind: "done", value: true }),
    });
    dispatch(game, rules, [{ ids: [1], to: "discard" }]);
    expect(game.imperialOrder).toBeUndefined();
    expect(game.cardZones).toEqual(zones);
    expect(game.seen.ConfirmMoveCards).toBeUndefined();
  });

  it("retains serialized pending state during a Confirm prompt and commits once after reload", () => {
    let game = fixture();
    const zones = structuredClone(game.cardZones);
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
    let scheduler = dispatch(game, rules, [{ ids: [1], to: "discard" }]);
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
    expect(game.cardZones).toEqual(zones);
    const prompt = getTriggerPrompt(scheduler, "b")!;
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(game.cardZones).toEqual(zones);
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(game.cardZones.wugu.cards).toEqual([1]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(game.cardZones.wugu.cards).toEqual([1]);
  });

  it("preserves nested tags and physical movement when a Confirm child makes the parent stale", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "nested",
      rule: true,
      priority: 1,
      events: ["ConfirmMoveCards"],
      effect: ({ game, event, continuation }) =>
        event.target === "a" &&
        continuation === null &&
        game.imperialOrder?.cardID === 1
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  moves: [
                    { ids: [1], to: "table" },
                    { ids: [3], to: "discard" },
                  ],
                },
              },
              continuation: "child-finished",
            }
          : { kind: "done", value: false },
    });
    expect(() => dispatch(game, rules, [{ ids: [1], to: "discard" }])).toThrow(
      "Stale card movement",
    );
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 3 });
    expect(game.cardZones.wugu.cards).toEqual([3]);
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
    expect(game.cardZones.bHand.cards).toEqual([]);
  });

  it("keeps rewritten physical moves and tags despite Confirm consumption and data changes", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "confirm-change",
      rule: true,
      priority: 1,
      events: ["ConfirmMoveCards"],
      effect: ({ event }) => {
        event.data = { moves: [] };
        return { kind: "done", value: true };
      },
    });
    dispatch(game, rules, [{ ids: [1], to: "discard" }]);
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
    expect(game.cardZones.wugu.cards).toEqual([1]);
    expect(game.seen.CardsMoveOneTime).toMatchObject({
      moves: [{ ids: [1], to: "wugu" }],
    });
  });

  it("composes all four package rewrites, retaining mixed discard card order and last-hand metadata", () => {
    const game = fixture();
    game.cardZones.aHand.cards = [2, 1, 4, 5, 6];
    game.cardZones.bEquip = { place: "equip", owner: "b", cards: [7] };
    game.cardZones.bEdict = {
      place: "special",
      owner: "b",
      cards: [],
      pileName: "ImperialEdict",
    };
    const rules = registry();
    rules.operations = [
      createCardMovementOperation(
        { cardClasses: { 2: "Chaos" }, wuguZone: "wugu" },
        {
          horses: { 5: "six-dragons", 7: "defensive" },
          discardZone: "discard",
        },
        { cardIDs: [4], pileZones: { b: "bEdict" } },
        { cardIDs: [1, 3], wuguZone: "wugu" },
      ),
    ];
    dispatch(game, rules, [
      { ids: [2, 1, 6], to: "discard", reason: "throw", open: true },
      { ids: [4, 5], to: "bEquip", reason: "give" },
    ]);
    expect(game.cardZones.wugu.cards).toEqual([2, 1]);
    expect(game.cardZones.bEquip.cards).toEqual([5]);
    expect(game.cardZones.bEdict.cards).toEqual([4]);
    expect(game.cardZones.aHand.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([7, 6]);
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 1 });
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        { ids: [2, 1], to: "wugu", reason: "throw", open: [true, true] },
        { ids: [4], to: "bEdict", lastHandcard: false },
        { ids: [6], to: "discard", reason: "throw", lastHandcard: false },
        { ids: [5], to: "bEquip", lastHandcard: true },
        { ids: [7], to: "discard" },
      ],
    });
  });
});
