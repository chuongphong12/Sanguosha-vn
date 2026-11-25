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
      aHand: { place: "hand", owner: "a", cards: [6] },
      bHand: { place: "hand", owner: "b", cards: [] },
      aEquip: { place: "equip", owner: "a", cards: [5] },
      bEquip: { place: "equip", owner: "b", cards: [3, 4, 2] },
      table: { place: "table", owner: null, cards: [1] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    seen: {},
  };
}

function registry(): TriggerRegistry<ReturnType<typeof fixture>> {
  return {
    version: "six-dragons-ce4e62b",
    operations: [
      createCardMovementOperation(undefined, {
        horses: {
          1: "six-dragons",
          2: "defensive",
          3: "offensive",
          5: "offensive",
          6: "defensive",
        },
        discardZone: "discard",
      }),
    ],
    skills: [
      {
        id: "observe",
        rule: true,
        priority: 0,
        events: ["BeforeCardsMove", "ConfirmMoveCards"],
        effect: ({ game, event }) => {
          if (event.target === "b")
            game.seen[event.name] = structuredClone(event.data);
          return { kind: "done", value: false };
        },
      },
    ],
  };
}

describe("Hegemony SixDragons movement", () => {
  it.each(["discard", "otherDiscard"])(
    "keeps an incoming horse from %s when generated discard is a shared-place no-op",
    (source) => {
      const game = fixture();
      game.cardZones.table.cards = [];
      game.cardZones.aHand.cards = [];
      game.cardZones.bEquip.cards = [4, 1];
      game.cardZones[source] = { place: "discard", owner: null, cards: [6] };
      const rules = registry();
      dispatchTriggerOperation(
        createTriggerScheduler(game.seatOrder, rules.version),
        game,
        rules,
        {
          name: "move-cards",
          data: { moves: [{ ids: [6], to: "bEquip", reason: "obtain" }] },
        },
        "b",
      );
      expect(game.seen.ConfirmMoveCards).toMatchObject({
        moves: [{ ids: [6], to: "bEquip", reason: "obtain" }],
      });
      expect(game.cardZones.bEquip.cards).toEqual([4, 1, 6]);
      expect(game.cardZones[source].cards).toEqual([]);
      expect(game.cardZones.discard.cards).toEqual([]);
    },
  );

  it("discards the recipient's equipped horses in native slot order before adding SixDragons", () => {
    const game = fixture();
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: { moves: [{ ids: [1], to: "bEquip", reason: "give" }] },
      },
      "b",
    );
    expect(game.seen.BeforeCardsMove).toMatchObject({
      moves: [{ ids: [1], to: "bEquip" }],
    });
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        {
          ids: [2, 3],
          from: ["bEquip", "bEquip"],
          to: "discard",
          reason: { kind: "put", actor: "b", skill: "SixDragons" },
        },
        { ids: [1], to: "bEquip", reason: "give" },
      ],
    });
    expect(game.cardZones.bEquip.cards).toEqual([4, 1]);
    expect(game.cardZones.aEquip.cards).toEqual([5]);
    expect(game.cardZones.discard.cards).toEqual([3, 2]);
  });

  it("redirects an incoming horse to discard when the recipient already has SixDragons", () => {
    const game = fixture();
    game.cardZones.table.cards = [];
    game.cardZones.bEquip.cards = [4, 1];
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: { moves: [{ ids: [6], to: "bEquip", reason: "transfer" }] },
      },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        {
          ids: [6],
          to: "discard",
          reason: { kind: "put", actor: "b", skill: "SixDragons" },
          lastHandcard: true,
        },
      ],
    });
    expect(game.cardZones.bEquip.cards).toEqual([4, 1]);
    expect(game.cardZones.aHand.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([6]);
  });

  it("checks the equipped snapshot even when SixDragons is leaving in the same batch", () => {
    const game = fixture();
    game.cardZones.table.cards = [];
    game.cardZones.bEquip.cards = [4, 1];
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [1], to: "aHand" },
            { ids: [6], to: "bEquip" },
          ],
        },
      },
      "a",
    );
    expect(game.cardZones.bEquip.cards).toEqual([4]);
    expect(game.cardZones.aHand.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([6]);
  });

  it("overrides an equipped horse's proposed transfer when SixDragons is arriving", () => {
    const game = fixture();
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [2], to: "aHand" },
            { ids: [1], to: "bEquip" },
          ],
        },
      },
      "b",
    );
    expect(game.cardZones.aHand.cards).toEqual([6]);
    expect(game.cardZones.bEquip.cards).toEqual([4, 1]);
    expect(game.cardZones.discard.cards).toEqual([3, 2]);
  });

  it("does not treat simultaneously incoming SixDragons as already equipped", () => {
    const game = fixture();
    game.cardZones.bEquip.cards = [4];
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1, 6], to: "bEquip" }] } },
      "a",
    );
    expect(game.cardZones.bEquip.cards).toEqual([4, 6, 1]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });

  it("uses the destination rewritten by BeforeCardsMove instead of the original equip request", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "redirect",
      rule: true,
      priority: 1,
      events: ["BeforeCardsMove"],
      effect: ({ event }) => {
        if (event.target === "b")
          event.data = { moves: [{ ids: [1], to: "bHand" }] };
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
      "b",
    );
    expect(game.cardZones.bHand.cards).toEqual([1]);
    expect(game.cardZones.bEquip.cards).toEqual([3, 4, 2]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });

  it("resumes a Confirm prompt after JSON reload and commits horse removal exactly once", () => {
    let game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "pause-confirm",
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
    let scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
      "b",
    );
    expect(game.cardZones.bEquip.cards).toEqual([3, 4, 2]);
    expect(game.cardZones.discard.cards).toEqual([]);
    const prompt = getTriggerPrompt(scheduler, "b")!;
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(game.cardZones.bEquip.cards).toEqual([4, 1]);
    expect(game.cardZones.discard.cards).toEqual([3, 2]);
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(game.cardZones.discard.cards).toEqual([3, 2]);
  });

  it.each(["missing", "wrong-place"])(
    "rejects a %s discard zone without moving cards",
    (variant) => {
      const game = fixture();
      if (variant === "missing") delete game.cardZones.discard;
      else game.cardZones.discard.place = "table";
      const zones = structuredClone(game.cardZones);
      const rules = registry();
      expect(() =>
        dispatchTriggerOperation(
          createTriggerScheduler(game.seatOrder, rules.version),
          game,
          rules,
          { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
          "b",
        ),
      ).toThrow("Invalid SixDragons discard destination");
      expect(game.cardZones).toEqual(zones);
    },
  );

  it("rejects a generated horse removal made stale by a nested Confirm movement", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "nested-horse-transfer",
      rule: true,
      priority: 1,
      events: ["ConfirmMoveCards"],
      effect: ({ event, continuation }) =>
        event.target === "b" &&
        continuation === null &&
        JSON.stringify(event.data).includes('"SixDragons"')
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: { moves: [{ ids: [2], to: "aHand", reason: "nested" }] },
              },
              continuation: "moved",
            }
          : { kind: "done", value: false },
    });
    expect(() =>
      dispatchTriggerOperation(
        createTriggerScheduler(game.seatOrder, rules.version),
        game,
        rules,
        { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
        "b",
      ),
    ).toThrow("Stale card movement");
    expect(game.cardZones.aHand.cards).toEqual([6, 2]);
    expect(game.cardZones.bEquip.cards).toEqual([3, 4]);
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });
});
