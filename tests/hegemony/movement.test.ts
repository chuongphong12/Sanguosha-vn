import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  dispatchTriggerEvent,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import {
  createCardMovementOperation,
  type CardMovementGame,
} from "../../src/game/hegemony/movement";

function fixture(): CardMovementGame & { trace: string[] } {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: false },
    cardZones: {
      a: { place: "hand", owner: "a", cards: [1, 2] },
      b: { place: "hand", owner: "b", cards: [3] },
      draw: { place: "draw", owner: null, cards: [4, 5] },
      discard: { place: "discard", owner: null, cards: [] },
      table: { place: "table", owner: null, cards: [] },
    },
    trace: [],
  };
}

describe("Hegemony movement dispatch and resume", () => {
  it("keeps source hints aligned when same-zone no-ops precede moved cards", () => {
    const game = fixture();
    const registry: TriggerRegistry<typeof game> = {
      version: "movement-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [],
    };
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      {
        name: "move-cards",
        data: { moves: [{ ids: [1, 3], from: ["a", "b"], to: "a" }] },
      },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([1, 2, 3]);
    expect(game.cardZones.b.cards).toEqual([]);
  });
  it("removes every source before adding destinations in a hand exchange", () => {
    const game = fixture();
    const registry: TriggerRegistry<typeof game> = {
      version: "movement-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [],
    };
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [1], to: "b" },
            { ids: [3], to: "a" },
          ],
        },
      },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([2, 3]);
    expect(game.cardZones.b.cards).toEqual([1]);
  });
  it("appends draw-bottom moves in input order, including reordering the same draw pile", () => {
    const game = fixture();
    const registry: TriggerRegistry<typeof game> = {
      version: "movement-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [],
    };
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: { moves: [{ ids: [1, 2], to: "draw", bottom: true }] },
      },
      "a",
    );
    expect(game.cardZones.draw.cards).toEqual([4, 5, 1, 2]);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: { moves: [{ ids: [4], to: "draw", bottom: true }] },
      },
      "a",
    );
    expect(game.cardZones.draw.cards).toEqual([5, 1, 2, 4]);
  });
  it.each([
    ["BeforeCardsMove", "turn-broken"],
    ["BeforeCardsMove", "stage-change"],
    ["BeforeCardsMove", "game-over"],
    ["CardsMoveOneTime", "turn-broken"],
    ["CardsMoveOneTime", "stage-change"],
    ["CardsMoveOneTime", "game-over"],
  ] as const)(
    "freezes interrupted movement at %s for %s without replay",
    (eventName, reason) => {
      const game = fixture();
      const registry: TriggerRegistry<typeof game> = {
        version: "movement-ce4e62b",
        operations: [createCardMovementOperation()],
        skills: [
          {
            id: "interrupt",
            rule: true,
            priority: 0,
            events: [eventName],
            effect: () => ({ kind: "interrupt", reason }),
          },
        ],
      };
      const scheduler = createTriggerScheduler(
        game.seatOrder,
        registry.version,
      );
      const operation = {
        name: "move-cards",
        data: { moves: [{ ids: [1], to: "table" }] },
      };
      dispatchTriggerOperation(scheduler, game, registry, operation, "a");
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.cardZones.a.cards).toEqual(
        eventName === "BeforeCardsMove" ? [1, 2] : [2],
      );
      expect(game.cardZones.table.cards).toEqual(
        eventName === "BeforeCardsMove" ? [] : [1],
      );
      expect(scheduler.frames).toHaveLength(2);
      const frozen = JSON.stringify({ scheduler, game });
      expect(
        dispatchTriggerOperation(scheduler, game, registry, operation, "a"),
      ).toBe(false);
      expect(JSON.stringify({ scheduler, game })).toBe(frozen);
    },
  );
  it.each([
    { moves: [{ ids: [1, 1], to: "table" }] },
    {
      moves: [
        { ids: [1], to: "table" },
        { ids: [1], to: "b" },
      ],
    },
    { moves: [{ ids: [99], to: "table" }] },
    { moves: [{ ids: [1], to: "missing" }] },
    { moves: [{ ids: [-1], to: "table" }] },
    { moves: [{ ids: [1.5], to: "table" }] },
    { moves: [{ ids: [1], to: "__proto__" }] },
  ])(
    "rejects malformed movement before retaining frames or changing storage: %j",
    (data) => {
      const game = fixture();
      const registry: TriggerRegistry<typeof game> = {
        version: "movement-ce4e62b",
        operations: [createCardMovementOperation()],
        skills: [],
      };
      const scheduler = createTriggerScheduler(
        game.seatOrder,
        registry.version,
      );
      const before = JSON.stringify({ scheduler, game });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          registry,
          { name: "move-cards", data },
          "a",
        ),
      ).toThrow();
      expect(JSON.stringify({ scheduler, game })).toBe(before);
    },
  );
  it("rejects a card duplicated inside the same source zone", () => {
    const game = fixture();
    game.cardZones.a.cards = [1, 1, 2];
    const registry: TriggerRegistry<typeof game> = {
      version: "movement-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [],
    };
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "move-cards",
          data: { moves: [{ ids: [1], to: "table" }] },
        },
        "a",
      ),
    ).toThrow("Invalid physical card location");
    expect(game.cardZones.a.cards).toEqual([1, 1, 2]);
  });
  it.each(["BeforeCardsMove", "ConfirmMoveCards"])(
    "rejects a stale source after a nested %s movement without another debit",
    (eventName) => {
      const game = fixture();
      const registry: TriggerRegistry<typeof game> = {
        version: "movement-ce4e62b",
        operations: [createCardMovementOperation()],
        skills: [
          {
            id: "nested-confirm",
            rule: true,
            priority: 0,
            events: [eventName],
            effect: ({ continuation, event }) => {
              const data = event.data;
              const discard =
                data !== null &&
                typeof data === "object" &&
                !Array.isArray(data) &&
                Array.isArray(data.moves) &&
                data.moves.some(
                  (move) =>
                    move !== null &&
                    typeof move === "object" &&
                    !Array.isArray(move) &&
                    move.to === "discard",
                );
              return continuation === null && event.target === "b" && discard
                ? {
                    kind: "operation",
                    operation: {
                      name: "move-cards",
                      data: { moves: [{ ids: [1], to: "b" }] },
                    },
                    continuation: "moved",
                  }
                : { kind: "done", value: false };
            },
          },
        ],
      };
      expect(() =>
        dispatchTriggerOperation(
          createTriggerScheduler(game.seatOrder, registry.version),
          game,
          registry,
          {
            name: "move-cards",
            data: { moves: [{ ids: [1, 2], to: "discard" }] },
          },
          "b",
        ),
      ).toThrow("Stale card movement");
      expect(game.cardZones.a.cards).toEqual([2]);
      expect(game.cardZones.b.cards).toEqual([3, 1]);
      expect(game.cardZones.discard.cards).toEqual([]);
    },
  );
  it.each([
    "BeforeCardsMove",
    "ConfirmMoveCards",
    "PreCardsMoveOneTime",
    "CardsMoveOneTime",
  ])(
    "only consumption of BeforeCardsMove cancels the entire move (%s)",
    (consumedEvent) => {
      const game = fixture();
      const registry: TriggerRegistry<typeof game> = {
        version: "movement-ce4e62b",
        operations: [createCardMovementOperation()],
        skills: [
          {
            id: "consume",
            rule: true,
            priority: 0,
            events: [
              "BeforeCardsMove",
              "ConfirmMoveCards",
              "PreCardsMoveOneTime",
              "CardsMoveOneTime",
            ],
            effect: ({ game, event }) => {
              game.trace.push(`${event.name}:${event.target}`);
              return { kind: "done", value: event.name === consumedEvent };
            },
          },
        ],
      };
      const scheduler = createTriggerScheduler(
        game.seatOrder,
        registry.version,
      );
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "move-cards",
          data: { moves: [{ ids: [1], to: "table" }] },
        },
        "b",
      );
      if (consumedEvent === "BeforeCardsMove") {
        expect(game.cardZones.a.cards).toEqual([1, 2]);
        expect(game.trace).toEqual(["BeforeCardsMove:b"]);
        expect(scheduler.operationCompletion?.value).toEqual({
          cancelled: true,
          moves: [],
        });
      } else {
        expect(game.cardZones.table.cards).toEqual([1]);
        expect(game.trace).toHaveLength(8);
        expect(scheduler.operationCompletion?.value).toMatchObject({
          cancelled: false,
        });
      }
    },
  );
  it("commits Before rewrites, discards Confirm rewrites, and returns post-event data", () => {
    const game = fixture();
    const registry: TriggerRegistry<typeof game> = {
      version: "movement-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "rewrite",
          rule: true,
          priority: 0,
          events: [
            "BeforeCardsMove",
            "ConfirmMoveCards",
            "PreCardsMoveOneTime",
            "CardsMoveOneTime",
          ],
          effect: ({ game, event }) => {
            if (event.name === "BeforeCardsMove" && event.target === "b")
              event.data = {
                moves: [{ ids: [2], to: "b", reason: "transfer" }],
              };
            if (event.name === "ConfirmMoveCards" && event.target === "b")
              event.data = { moves: [{ ids: [3], to: "discard" }] };
            if (event.name === "ConfirmMoveCards" && event.target === "a")
              game.trace.push(JSON.stringify(event.data));
            if (event.name === "PreCardsMoveOneTime" && event.target === "b")
              event.data = "post-rewrite";
            if (event.name === "CardsMoveOneTime")
              game.trace.push(JSON.stringify(event.data));
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: { moves: [{ ids: [1], to: "table" }] },
      },
      "b",
    );
    expect(game.cardZones.a.cards).toEqual([1]);
    expect(game.cardZones.b.cards).toEqual([3, 2]);
    expect(game.cardZones.discard.cards).toEqual([]);
    expect(game.trace).toEqual([
      '{"moves":[{"ids":[3],"to":"discard"}]}',
      '"post-rewrite"',
      '"post-rewrite"',
    ]);
    expect(scheduler.operationCompletion?.value).toEqual({
      cancelled: false,
      data: "post-rewrite",
    });
  });
  it("takes a new living-player snapshot for each event stage", () => {
    const game = fixture();
    const registry: TriggerRegistry<typeof game> = {
      version: "movement-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "life-change",
          rule: true,
          priority: 0,
          events: ["BeforeCardsMove", "ConfirmMoveCards"],
          effect: ({ game, event }) => {
            game.trace.push(`${event.name}:${event.target}`);
            if (event.name === "BeforeCardsMove" && event.target === "b") {
              game.alive.a = false;
              game.alive.c = true;
            }
            return { kind: "done", value: false };
          },
        },
      ],
    };
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      {
        name: "move-cards",
        data: { moves: [{ ids: [1], to: "table" }] },
      },
      "b",
    );
    expect(game.trace).toEqual([
      "BeforeCardsMove:b",
      "BeforeCardsMove:a",
      "ConfirmMoveCards:b",
      "ConfirmMoveCards:c",
    ]);
  });
  it("resumes a nested cost before and after commit without paying twice", () => {
    let game = { ...fixture(), effects: 0 };
    const registry: TriggerRegistry<typeof game> = {
      version: "movement-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "paid-skill",
          events: ["Use"],
          priority: 0,
          triggerable: () => [
            {
              actor: "a",
              owner: "a",
              slot: "head",
              target: "b",
              occurrence: "one",
              global: true,
              compulsory: true,
            },
          ],
          cost: ({ continuation, operationChild }) =>
            continuation === null
              ? {
                  kind: "operation",
                  operation: {
                    name: "move-cards",
                    data: {
                      moves: [{ ids: [1], to: "table", reason: "cost" }],
                    },
                  },
                  continuation: "payment",
                }
              : {
                  kind: "done",
                  value: operationChild?.operation.name === "move-cards",
                },
          effect: ({ game }) => {
            game.effects++;
            return { kind: "done", value: false };
          },
        },
        {
          id: "wait",
          rule: true,
          priority: 0,
          events: ["BeforeCardsMove", "CardsMoveOneTime"],
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
        },
      ],
    };
    let scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "Use", target: "a", data: null },
      "b",
    );
    expect(game.cardZones.a.cards).toEqual([1, 2]);
    expect(game.effects).toBe(0);
    expect(getTriggerPrompt(scheduler, "a")).toBeNull();
    const before = getTriggerPrompt(scheduler, "b")!;
    const frozen = JSON.stringify({ scheduler, game });
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "a", {
        id: before.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(JSON.stringify({ scheduler, game })).toBe(frozen);
    ({ scheduler, game } = JSON.parse(frozen));
    resumeTriggerPrompt(scheduler, game, registry, "b", {
      id: before.id,
      choice: "continue",
    });
    expect(game.cardZones.a.cards).toEqual([2]);
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.effects).toBe(0);
    const after = getTriggerPrompt(scheduler, "b")!;
    expect(after.id).not.toBe(before.id);
    ({ scheduler, game } = JSON.parse(JSON.stringify({ scheduler, game })));
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: before.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: after.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.effects).toBe(1);
    expect(scheduler.frames).toEqual([]);
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: after.id,
        choice: "continue",
      }),
    ).toBe(false);
  });
  it("runs native current-first living-player events around one batch commit", () => {
    const game = fixture();
    const registry: TriggerRegistry<typeof game> = {
      version: "movement-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "observer",
          rule: true,
          priority: 0,
          events: [
            "BeforeCardsMove",
            "ConfirmMoveCards",
            "PreCardsMoveOneTime",
            "CardsMoveOneTime",
          ],
          effect: ({ game, event }) => {
            game.trace.push(
              `${event.name}:${event.target}:${game.cardZones.a.cards.join(",")}`,
            );
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "move-cards",
          data: { moves: [{ ids: [1, 2], to: "discard", reason: "discard" }] },
        },
        "b",
      ),
    ).toBe(true);
    expect(game.trace).toEqual([
      "BeforeCardsMove:b:1,2",
      "BeforeCardsMove:a:1,2",
      "ConfirmMoveCards:b:1,2",
      "ConfirmMoveCards:a:1,2",
      "PreCardsMoveOneTime:b:",
      "PreCardsMoveOneTime:a:",
      "CardsMoveOneTime:b:",
      "CardsMoveOneTime:a:",
    ]);
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([2, 1]);
    expect(scheduler.operationCompletion?.value).toMatchObject({
      cancelled: false,
    });
    expect(scheduler.frames).toEqual([]);
  });
});
