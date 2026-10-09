import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import {
  createCardMovementOperation,
  type CardMovementGame,
} from "../../src/game/hegemony/movement";

function fixture(): CardMovementGame & { seen: Record<string, TriggerData> } {
  return {
    seatOrder: ["a"],
    alive: { a: true },
    cardZones: {
      hand: { place: "hand", owner: "a", cards: [1, 2, 3, 4, 5] },
      discard: { place: "discard", owner: null, cards: [] },
      table: { place: "table", owner: null, cards: [] },
      wugu: { place: "wugu", owner: null, cards: [] },
    },
    seen: {},
  };
}

function registry(): TriggerRegistry<ReturnType<typeof fixture>> {
  return {
    version: "scenario-ce4e62b",
    operations: [
      createCardMovementOperation({
        cardClasses: {
          1: "RuleTheWorld",
          2: "Conquering",
          3: "ConsolidateCountry",
          4: "Chaos",
        },
        wuguZone: "wugu",
      }),
    ],
    skills: [
      {
        id: "observe",
        rule: true,
        priority: 0,
        events: ["BeforeCardsMove", "ConfirmMoveCards"],
        effect: ({ game, event }) => {
          game.seen[event.name] = structuredClone(event.data);
          return { kind: "done", value: false };
        },
      },
    ],
  };
}

describe("Hegemony scenario card movement", () => {
  it("reroutes four scenario classes from discard to WuGu after BeforeCardsMove", () => {
    const game = fixture();
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: {
          moves: [{ ids: [1, 2, 3, 4, 5], to: "discard", reason: "discard" }],
        },
      },
      "a",
    );
    expect(game.seen.BeforeCardsMove).toMatchObject({
      moves: [{ ids: [1, 2, 3, 4, 5], to: "discard" }],
    });
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        {
          ids: [1, 2, 3, 4],
          to: "wugu",
          toPlace: "wugu",
          reason: "discard",
          lastHandcard: false,
        },
        { ids: [5], to: "discard", reason: "discard", lastHandcard: true },
      ],
    });
    expect(game.cardZones.wugu.cards).toEqual([1, 2, 3, 4]);
    expect(game.cardZones.discard.cards).toEqual([5]);
    expect(game.cardZones.hand.cards).toEqual([]);
  });

  it("uses the destination rewritten by BeforeCardsMove, leaving other destinations alone", () => {
    const game = fixture();
    const rules = registry();
    rules.skills[0].effect = ({ event }) => {
      if (event.name === "BeforeCardsMove")
        event.data = {
          moves: [
            { ids: [1], to: "discard" },
            { ids: [2], to: "table" },
          ],
        };
      return { kind: "done", value: false };
    };
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1, 2], to: "table" }] } },
      "a",
    );
    expect(game.cardZones.wugu.cards).toEqual([1]);
    expect(game.cardZones.table.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });

  it("rejects a missing WuGu zone without moving physical cards", () => {
    const game = fixture();
    delete game.cardZones.wugu;
    const rules = registry();
    expect(() =>
      dispatchTriggerOperation(
        createTriggerScheduler(game.seatOrder, rules.version),
        game,
        rules,
        { name: "move-cards", data: { moves: [{ ids: [1], to: "discard" }] } },
        "a",
      ),
    ).toThrow("Invalid WuGu destination");
    expect(game.cardZones.hand.cards).toEqual([1, 2, 3, 4, 5]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });

  it("keeps the original discard when the generated WuGu replacement is a no-op", () => {
    const game = fixture();
    game.cardZones.hand.cards = [2, 3, 4, 5];
    game.cardZones.wugu.cards = [1];
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1], to: "discard" }] } },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [{ ids: [1], to: "discard" }],
    });
    expect(game.cardZones.wugu.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });

  it("treats distinct WuGu keys as the same native shared place", () => {
    const game = fixture();
    game.cardZones.hand.cards = [2, 3, 4, 5];
    game.cardZones.otherWugu = { place: "wugu", owner: null, cards: [1] };
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1], to: "discard" }] } },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [{ ids: [1], to: "discard" }],
    });
    expect(game.cardZones.otherWugu.cards).toEqual([]);
    expect(game.cardZones.wugu.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
});
