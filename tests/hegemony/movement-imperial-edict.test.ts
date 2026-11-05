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
      bEquip: { place: "equip", owner: "b", cards: [3] },
      aEdict: {
        place: "special",
        owner: "a",
        cards: [],
        pileName: "ImperialEdict",
      },
      bEdict: {
        place: "special",
        owner: "b",
        cards: [4],
        pileName: "ImperialEdict",
      },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
      wugu: { place: "wugu", owner: null, cards: [] },
    },
    seen: {},
  };
}

function registry(): TriggerRegistry<ReturnType<typeof fixture>> {
  return {
    version: "imperial-edict-ce4e62b",
    operations: [
      createCardMovementOperation(undefined, undefined, {
        cardIDs: [1],
        pileZones: { a: "aEdict", b: "bEdict" },
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
          return { kind: "done", value: false };
        },
      },
    ],
  };
}

describe("Hegemony ImperialEdict movement", () => {
  it.each(["already dead", "dies during BeforeCardsMove"])(
    "keeps the original equip request when the recipient %s, without requiring a pile",
    (variant) => {
      const game = fixture();
      delete game.cardZones.bEdict;
      if (variant === "already dead") game.alive.b = false;
      const rules = registry();
      if (variant === "dies during BeforeCardsMove")
        rules.skills.push({
          id: "recipient-dies",
          rule: true,
          priority: 1,
          events: ["BeforeCardsMove"],
          effect: ({ game }) => {
            game.alive.b = false;
            return { kind: "done", value: false };
          },
        });
      dispatchTriggerOperation(
        createTriggerScheduler(game.seatOrder, rules.version),
        game,
        rules,
        {
          name: "move-cards",
          data: {
            moves: [{ ids: [1], to: "bEquip", reason: "transfer", open: true }],
          },
        },
        "a",
      );
      expect(game.seen.ConfirmMoveCards).toMatchObject({
        moves: [{ ids: [1], to: "bEquip", reason: "transfer", open: [true] }],
      });
      expect(game.cardZones.bEquip.cards).toEqual([3, 1]);
      expect(game.cardZones.aHand.cards).toEqual([2]);
      expect(game.cardZones.bEdict).toBeUndefined();
    },
  );

  it("redirects ImperialEdict entering equip to the recipient's named pile before Confirm", () => {
    const game = fixture();
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: {
          moves: [{ ids: [1, 2], to: "bEquip", reason: "give", open: true }],
        },
      },
      "a",
    );
    expect(game.seen.BeforeCardsMove).toMatchObject({
      moves: [{ ids: [1, 2], to: "bEquip", reason: "give" }],
    });
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        {
          ids: [1],
          from: ["aHand"],
          to: "bEdict",
          toPlace: "special",
          toPileName: "ImperialEdict",
          originTo: "bEdict",
          originToPlace: "special",
          originToPileName: "ImperialEdict",
          open: [false],
          reason: null,
          lastHandcard: false,
        },
        {
          ids: [2],
          to: "bEquip",
          reason: "give",
          open: [true],
          lastHandcard: true,
        },
      ],
    });
    expect(game.seen.CardsMoveOneTime).toEqual(game.seen.ConfirmMoveCards);
    expect(game.cardZones.bEdict.cards).toEqual([4, 1]);
    expect(game.cardZones.bEquip.cards).toEqual([3, 2]);
    expect(game.cardZones.aHand.cards).toEqual([]);
  });

  it.each(["bEdict", "otherPile"])(
    "keeps the original equip movement when the generated same-owner special move from %s is a no-op",
    (source) => {
      const game = fixture();
      game.cardZones.aHand.cards = [2];
      if (source === "bEdict") game.cardZones.bEdict.cards.push(1);
      else
        game.cardZones[source] = {
          place: "special",
          owner: "b",
          cards: [1],
          pileName: "other",
        };
      const rules = registry();
      dispatchTriggerOperation(
        createTriggerScheduler(game.seatOrder, rules.version),
        game,
        rules,
        {
          name: "move-cards",
          data: {
            moves: [{ ids: [1], to: "bEquip", reason: "transfer", open: true }],
          },
        },
        "b",
      );
      expect(game.seen.ConfirmMoveCards).toMatchObject({
        moves: [
          {
            ids: [1],
            from: [source],
            to: "bEquip",
            reason: "transfer",
            open: [true],
          },
        ],
      });
      expect(game.cardZones.bEquip.cards).toEqual([3, 1]);
      expect(game.cardZones.bEdict.cards).toEqual([4]);
      expect(game.cardZones[source].cards).not.toContain(1);
    },
  );

  it("moves an ImperialEdict from another owner's special pile into the recipient's pile", () => {
    const game = fixture();
    game.cardZones.aHand.cards = [2];
    game.cardZones.aEdict.cards = [1];
    const rules = registry();
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        {
          ids: [1],
          from: ["aEdict"],
          fromPileNames: ["ImperialEdict"],
          to: "bEdict",
          reason: null,
        },
      ],
    });
    expect(game.cardZones.aEdict.cards).toEqual([]);
    expect(game.cardZones.bEdict.cards).toEqual([4, 1]);
    expect(game.cardZones.bEquip.cards).toEqual([3]);
  });

  it("still applies SixDragons while skipping ImperialEdict routing for a dead recipient", () => {
    const game = fixture();
    game.alive.b = false;
    delete game.cardZones.bEdict;
    game.cardZones.bEquip.cards.push(6, 7);
    game.cardZones.table.cards = [5];
    const rules = registry();
    rules.operations![0] = createCardMovementOperation(
      undefined,
      {
        horses: { 5: "six-dragons", 6: "defensive", 7: "offensive" },
        discardZone: "discard",
      },
      { cardIDs: [1], pileZones: { a: "aEdict", b: "bEdict" } },
    );
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: { moves: [{ ids: [1, 5], to: "bEquip", reason: "give" }] },
      },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        { ids: [1], to: "bEquip", reason: "give" },
        {
          ids: [6, 7],
          to: "discard",
          reason: { kind: "put", actor: "b", skill: "SixDragons" },
        },
        { ids: [5], to: "bEquip", reason: "give" },
      ],
    });
    expect(game.cardZones.bEquip.cards).toEqual([3, 1, 5]);
    expect(game.cardZones.bEdict).toBeUndefined();
    expect(game.cardZones.discard.cards).toEqual([7, 6]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
  });

  it.each(["table", "discard", "bEdict"])(
    "leaves direct moves to %s unchanged",
    (destination) => {
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
              { ids: [1], to: destination, reason: "direct", open: true },
            ],
          },
        },
        "a",
      );
      expect(game.seen.ConfirmMoveCards).toMatchObject({
        moves: [{ ids: [1], to: destination, reason: "direct", open: [true] }],
      });
      expect(game.cardZones[destination].cards).toContain(1);
      expect(game.cardZones.bEquip.cards).toEqual([3]);
    },
  );

  it("uses the recipient selected by BeforeCardsMove", () => {
    const game = fixture();
    game.cardZones.aEquip = { place: "equip", owner: "a", cards: [] };
    const rules = registry();
    rules.skills.push({
      id: "change-recipient",
      rule: true,
      priority: 1,
      events: ["BeforeCardsMove"],
      effect: ({ event }) => {
        if (event.target === "b")
          event.data = { moves: [{ ids: [1], to: "aEquip" }] };
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [{ ids: [1], to: "aEdict" }],
    });
    expect(game.cardZones.aEdict.cards).toEqual([1]);
    expect(game.cardZones.bEdict.cards).toEqual([4]);
    expect(game.cardZones.aEquip.cards).toEqual([]);
  });

  it.each(["missing", "wrong-owner", "wrong-place", "wrong-name"])(
    "rejects a %s ImperialEdict pile before physical commit",
    (variant) => {
      const game = fixture();
      if (variant === "missing") delete game.cardZones.bEdict;
      else if (variant === "wrong-owner") game.cardZones.bEdict.owner = "a";
      else if (variant === "wrong-place") game.cardZones.bEdict.place = "equip";
      else game.cardZones.bEdict.pileName = "other";
      const zones = structuredClone(game.cardZones);
      const rules = registry();
      expect(() =>
        dispatchTriggerOperation(
          createTriggerScheduler(game.seatOrder, rules.version),
          game,
          rules,
          { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
          "a",
        ),
      ).toThrow("Invalid ImperialEdict pile destination");
      expect(game.cardZones).toEqual(zones);
    },
  );

  it("does not create pile membership when BeforeCardsMove consumes the movement", () => {
    const game = fixture();
    delete game.cardZones.bEdict;
    const zones = structuredClone(game.cardZones);
    const rules = registry();
    rules.skills.push({
      id: "cancel",
      rule: true,
      priority: 1,
      events: ["BeforeCardsMove"],
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
      "a",
    );
    expect(game.cardZones).toEqual(zones);
    expect(game.seen.ConfirmMoveCards).toBeUndefined();
  });

  it("commits pile membership exactly once after a Confirm prompt and JSON reload", () => {
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
    let scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "move-cards", data: { moves: [{ ids: [1], to: "bEquip" }] } },
      "a",
    );
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
    expect(game.cardZones.aHand.cards).toEqual([2]);
    expect(game.cardZones.bEdict.cards).toEqual([4, 1]);
    expect(game.cardZones.bEquip.cards).toEqual([3]);
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(game.cardZones.bEdict.cards).toEqual([4, 1]);
  });

  it("preserves a nested Confirm transfer and rejects the stale outer pile movement", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "nested-transfer",
      rule: true,
      priority: 1,
      events: ["ConfirmMoveCards"],
      effect: ({ event, continuation }) =>
        event.target === "b" &&
        continuation === null &&
        JSON.stringify(event.data).includes('"to":"bEdict"')
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: { moves: [{ ids: [1], to: "discard" }] },
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
        "a",
      ),
    ).toThrow("Stale card movement");
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
    expect(game.cardZones.bEdict.cards).toEqual([4]);
    expect(game.cardZones.bEquip.cards).toEqual([3]);
  });

  it("composes scenario diversion, ImperialEdict and SixDragons in one movement batch", () => {
    const game = fixture();
    game.cardZones.aHand.cards.push(8);
    game.cardZones.bEquip.cards.push(6, 7);
    game.cardZones.table.cards = [5];
    const rules = registry();
    rules.operations![0] = createCardMovementOperation(
      { cardClasses: { 8: "RuleTheWorld" }, wuguZone: "wugu" },
      {
        horses: { 5: "six-dragons", 6: "defensive", 7: "offensive" },
        discardZone: "discard",
      },
      { cardIDs: [1], pileZones: { a: "aEdict", b: "bEdict" } },
    );
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, rules.version),
      game,
      rules,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [8], to: "discard", reason: "scenario" },
            { ids: [1, 2, 5], to: "bEquip", reason: "give" },
          ],
        },
      },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        { ids: [8], to: "wugu", reason: "scenario" },
        { ids: [1], to: "bEdict", reason: null },
        { ids: [2], to: "bEquip", reason: "give", lastHandcard: true },
        {
          ids: [6, 7],
          to: "discard",
          reason: { kind: "put", actor: "b", skill: "SixDragons" },
        },
        { ids: [5], to: "bEquip", reason: "give" },
      ],
    });
    expect(game.cardZones.wugu.cards).toEqual([8]);
    expect(game.cardZones.bEdict.cards).toEqual([4, 1]);
    expect(game.cardZones.bEquip.cards).toEqual([3, 2, 5]);
    expect(game.cardZones.discard.cards).toEqual([7, 6]);
    expect(game.cardZones.aHand.cards).toEqual([]);
  });
});
