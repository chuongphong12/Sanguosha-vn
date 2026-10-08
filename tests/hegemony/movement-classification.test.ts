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
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    cardZones: {
      a: { place: "hand", owner: "a", cards: [1] },
      aEquip: { place: "equip", owner: "a", cards: [2] },
      b: { place: "hand", owner: "b", cards: [3] },
      c: { place: "hand", owner: "c", cards: [4] },
      draw: { place: "draw", owner: null, cards: [5] },
      discard: { place: "discard", owner: null, cards: [] },
      table: { place: "table", owner: null, cards: [] },
    },
    seen: {},
  };
}

function observer(game: ReturnType<typeof fixture>) {
  const registry: TriggerRegistry<typeof game> = {
    version: "classification-ce4e62b",
    operations: [createCardMovementOperation()],
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
  return registry;
}

describe("Hegemony movement packet classification", () => {
  it("merges same-owner sources and orders packets current-first before and after BeforeCardsMove", () => {
    const game = fixture();
    const registry = observer(game);
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [1], to: "b", reason: "first" },
            { ids: [4], to: "b" },
            { ids: [2], to: "b", reason: "second" },
            { ids: [3], to: "discard" },
          ],
        },
      },
      "b",
    );
    expect(game.seen.BeforeCardsMove).toMatchObject({
      moves: [
        { ids: [3], from: ["b"] },
        { ids: [4], from: ["c"] },
        {
          ids: [1, 2],
          from: ["a", "aEquip"],
          fromPlaces: ["hand", "equip"],
          reason: "first",
        },
      ],
    });
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        { ids: [3], lastHandcard: true },
        { ids: [4], lastHandcard: true },
        { ids: [1, 2], open: [false, false], lastHandcard: true },
      ],
    });
    expect(game.cardZones.b.cards).toEqual([4, 1, 2]);
  });

  it("separates Before packets by visibility before attributing the last hand card", () => {
    const game = fixture();
    game.cardZones.a.cards = [1, 6, 7];
    const registry: TriggerRegistry<typeof game> = {
      version: "classification-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "rewrite-and-observe",
          rule: true,
          priority: 0,
          events: ["BeforeCardsMove", "ConfirmMoveCards"],
          effect: ({ game, event }) => {
            if (event.target !== "b") return { kind: "done", value: false };
            if (event.name === "BeforeCardsMove") {
              event.data = {
                moves: [
                  { ids: [1], to: "b", open: false, reason: "first" },
                  { ids: [6], to: "discard", open: false, reason: "discard" },
                  { ids: [7], to: "b", open: true, reason: "second" },
                ],
              };
            } else game.seen.confirm = structuredClone(event.data);
            return { kind: "done", value: false };
          },
        },
      ],
    };
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      { name: "move-cards", data: { moves: [{ ids: [1, 6, 7], to: "b" }] } },
      "b",
    );
    expect(game.seen.confirm).toMatchObject({
      moves: [
        {
          ids: [1, 7],
          to: "b",
          open: [false, true],
          reason: "first",
          lastHandcard: true,
        },
        { ids: [6], to: "discard", lastHandcard: false },
      ],
    });
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.b.cards).toEqual([3, 1, 7]);
    expect(game.cardZones.discard.cards).toEqual([6]);
  });

  it("uses the destination actor for ownerless sources and places ownerless moves last", () => {
    const game = fixture();
    game.cardZones.table.cards = [6];
    const registry = observer(game);
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [5], to: "c" },
            { ids: [6], to: "discard" },
            { ids: [1], to: "b" },
            { ids: [3], to: "discard" },
            { ids: [4], to: "b" },
          ],
        },
      },
      "b",
    );
    expect(game.seen.BeforeCardsMove).toMatchObject({
      moves: [
        { ids: [3] },
        { ids: [5] },
        { ids: [4] },
        { ids: [1] },
        { ids: [6] },
      ],
    });
    expect(game.cardZones.c.cards).toEqual([5]);
    expect(game.cardZones.discard.cards).toEqual([6, 3]);
  });

  it("keeps draw-top and draw-bottom packets separate for the same source owner", () => {
    const game = fixture();
    game.cardZones.a.cards = [1, 6];
    const registry = observer(game);
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [1], to: "draw" },
            { ids: [6], to: "draw", bottom: true },
          ],
        },
      },
      "a",
    );
    expect(game.seen.BeforeCardsMove).toMatchObject({
      moves: [
        { ids: [1], bottom: false },
        { ids: [6], bottom: true },
      ],
    });
    expect(game.cardZones.draw.cards).toEqual([1, 5, 6]);
  });

  it("marks the last hand card across all hand storage for one owner", () => {
    const game = fixture();
    game.cardZones.aReserve = { place: "hand", owner: "a", cards: [6] };
    const registry = observer(game);
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: { moves: [{ ids: [1], to: "discard" }] },
      },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [{ ids: [1], lastHandcard: false }],
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: { moves: [{ ids: [6], to: "discard" }] },
      },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [{ ids: [6], lastHandcard: true }],
    });
  });

  it("resumes a classified packet after JSON reload without another movement", () => {
    let game = fixture();
    const registry: TriggerRegistry<typeof game> = {
      version: "classification-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "wait",
          rule: true,
          priority: 0,
          events: ["BeforeCardsMove"],
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
        {
          id: "observe-confirm",
          rule: true,
          priority: 0,
          events: ["ConfirmMoveCards"],
          effect: ({ game, event }) => {
            if (event.target === "b")
              game.seen.confirm = structuredClone(event.data);
            return { kind: "done", value: false };
          },
        },
      ],
    };
    let scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [1], to: "b" },
            { ids: [2], to: "b" },
          ],
        },
      },
      "b",
    );
    expect(game.cardZones.a.cards).toEqual([1]);
    const prompt = getTriggerPrompt(scheduler, "b")!;
    ({ scheduler, game } = JSON.parse(JSON.stringify({ scheduler, game })));
    expect(
      resumeTriggerPrompt(scheduler, game, registry, "b", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(game.seen.confirm).toMatchObject({
      moves: [{ ids: [1, 2], from: ["a", "aEquip"], lastHandcard: true }],
    });
    expect(game.cardZones.b.cards).toEqual([3, 1, 2]);
    expect(scheduler.frames).toEqual([]);
  });

  it("retains each source pile name when merging one owner's private piles", () => {
    const game = fixture();
    game.cardZones.p1 = {
      place: "special",
      owner: "a",
      pileName: "p1",
      cards: [6],
    };
    game.cardZones.p2 = {
      place: "special",
      owner: "a",
      pileName: "p2",
      cards: [7],
    };
    const registry = observer(game);
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [7], to: "b" },
            { ids: [6], to: "b" },
          ],
        },
      },
      "a",
    );
    expect(game.seen.ConfirmMoveCards).toMatchObject({
      moves: [
        {
          ids: [7, 6],
          from: ["p2", "p1"],
          fromPlaces: ["special", "special"],
          fromPileNames: ["p2", "p1"],
          originFromPileNames: ["p2", "p1"],
        },
      ],
    });
    expect(game.cardZones.b.cards).toEqual([3, 7, 6]);
  });

  it("treats movement reasons with reordered JSON fields as the same classifier", () => {
    const game = fixture();
    game.cardZones.a.cards = [1, 6, 7];
    const registry: TriggerRegistry<typeof game> = {
      version: "classification-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "rewrite-reason",
          rule: true,
          priority: 0,
          events: ["BeforeCardsMove", "ConfirmMoveCards"],
          effect: ({ game, event }) => {
            if (event.target !== "b") return { kind: "done", value: false };
            if (event.name === "BeforeCardsMove")
              event.data = {
                moves: [
                  { ids: [1], to: "b", reason: { kind: "give", actor: "a" } },
                  { ids: [6], to: "discard", reason: "discard" },
                  { ids: [7], to: "b", reason: { actor: "a", kind: "give" } },
                ],
              };
            else game.seen.confirm = structuredClone(event.data);
            return { kind: "done", value: false };
          },
        },
      ],
    };
    dispatchTriggerOperation(
      createTriggerScheduler(game.seatOrder, registry.version),
      game,
      registry,
      { name: "move-cards", data: { moves: [{ ids: [1, 6, 7], to: "b" }] } },
      "b",
    );
    expect(game.seen.confirm).toMatchObject({
      moves: [
        { ids: [1, 7], to: "b", lastHandcard: false },
        { ids: [6], to: "discard", lastHandcard: true },
      ],
    });
  });
});
