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

function metadataGame(): CardMovementGame & {
  seen: Record<string, TriggerData>;
} {
  return {
    seatOrder: ["a", "b"],
    alive: { a: true, b: true },
    cardZones: {
      a: { place: "hand", owner: "a", cards: [1, 2] },
      b: { place: "hand", owner: "b", cards: [] },
      table: { place: "table", owner: null, cards: [] },
      draw: { place: "draw", owner: null, cards: [3] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    seen: {},
  };
}

describe("Hegemony native movement metadata", () => {
  it("reclassifies origin destination and preserves per-card visibility after a Before rewrite", () => {
    const game = metadataGame();
    const registry: TriggerRegistry<typeof game> = {
      version: "metadata-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "rewrite-target",
          rule: true,
          priority: 0,
          events: [
            "BeforeCardsMove",
            "ConfirmMoveCards",
            "PreCardsMoveOneTime",
          ],
          effect: ({ game, event }) => {
            if (event.target !== "a") return { kind: "done", value: false };
            if (event.name === "BeforeCardsMove") {
              game.seen.before = structuredClone(event.data);
              const data = event.data;
              if (
                data &&
                typeof data === "object" &&
                !Array.isArray(data) &&
                Array.isArray(data.moves)
              ) {
                const move = data.moves[0];
                if (move && typeof move === "object" && !Array.isArray(move))
                  move.to = "table";
              }
            } else game.seen[event.name] = structuredClone(event.data);
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
        data: {
          moves: [
            {
              ids: [1, 2],
              to: "b",
              open: [true, false],
              reason: { kind: "transfer" },
            },
          ],
        },
      },
      "a",
    );
    const before = game.seen.before;
    const confirmed = game.seen.ConfirmMoveCards;
    const after = game.seen.PreCardsMoveOneTime;
    expect(before).toMatchObject({
      moves: [
        {
          ids: [1, 2],
          from: ["a", "a"],
          fromPlaces: ["hand", "hand"],
          to: "b",
          toPlace: "hand",
          originFrom: ["a", "a"],
          originTo: "b",
          originToPlace: "hand",
          open: [true, false],
          lastHandcard: false,
        },
      ],
    });
    expect(confirmed).toMatchObject({
      moves: [
        {
          to: "table",
          toPlace: "table",
          originTo: "table",
          originToPlace: "table",
          open: [true, false],
          lastHandcard: true,
          reason: { kind: "transfer" },
        },
      ],
    });
    expect(after).toEqual(confirmed);
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.table.cards).toEqual([1, 2]);
  });

  it("tracks equip, delayed, judge, special-pile and WuGu storage through public dispatch", () => {
    const game = metadataGame();
    game.cardZones.equip = { place: "equip", owner: "a", cards: [] };
    game.cardZones.delayed = { place: "delayed", owner: "b", cards: [] };
    game.cardZones.judge = { place: "judge", owner: "b", cards: [] };
    game.cardZones.private = {
      place: "special",
      owner: "b",
      pileName: "archive",
      cards: [],
    };
    game.cardZones.wugu = { place: "wugu", owner: null, cards: [] };
    const registry: TriggerRegistry<typeof game> = {
      version: "metadata-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "observe",
          rule: true,
          priority: 0,
          events: ["ConfirmMoveCards"],
          effect: ({ game, event }) => {
            if (event.target === "a")
              game.seen.last = structuredClone(event.data);
            return { kind: "done", value: false };
          },
        },
      ],
    };
    const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    const move = (ids: number[], to: string) =>
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "move-cards",
          data: { moves: [{ ids, to }] },
        },
        "a",
      );
    move([1], "equip");
    expect(game.cardZones.equip.cards).toEqual([1]);
    expect(game.seen.last).toMatchObject({
      moves: [{ fromPlaces: ["hand"], toPlace: "equip" }],
    });
    move([1], "delayed");
    expect(game.cardZones.delayed.cards).toEqual([1]);
    expect(game.seen.last).toMatchObject({
      moves: [{ fromPlaces: ["equip"], toPlace: "delayed" }],
    });
    move([1], "judge");
    expect(game.cardZones.judge.cards).toEqual([1]);
    move([1], "private");
    expect(game.seen.last).toMatchObject({
      moves: [{ toPlace: "special", toPileName: "archive" }],
    });
    move([1], "wugu");
    expect(game.seen.last).toMatchObject({
      moves: [
        {
          fromPlaces: ["special"],
          fromPileNames: ["archive"],
          toPlace: "wugu",
        },
      ],
    });
    move([1], "b");
    expect(game.cardZones.b.cards).toEqual([1]);
    expect(game.cardZones.wugu.cards).toEqual([]);
  });

  it("rejects misaligned visibility metadata before changing storage", () => {
    const game = metadataGame();
    const registry: TriggerRegistry<typeof game> = {
      version: "metadata-ce4e62b",
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
          data: { moves: [{ ids: [1, 2], to: "b", open: [true] }] },
        },
        "a",
      ),
    ).toThrow("Invalid movement visibility");
    expect(game.cardZones.a.cards).toEqual([1, 2]);
    expect(scheduler.frames).toEqual([]);
  });

  it("keeps per-card metadata aligned after a same-zone no-op and marks only the final hand-loss packet", () => {
    const game = metadataGame();
    const registry: TriggerRegistry<typeof game> = {
      version: "metadata-ce4e62b",
      operations: [createCardMovementOperation()],
      skills: [
        {
          id: "observe",
          rule: true,
          priority: 0,
          events: ["ConfirmMoveCards"],
          effect: ({ game, event }) => {
            if (event.target === "a")
              game.seen.last = structuredClone(event.data);
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
        data: { moves: [{ ids: [1, 3], to: "a", open: [false, true] }] },
      },
      "a",
    );
    expect(game.seen.last).toMatchObject({
      moves: [
        {
          ids: [3],
          from: ["draw"],
          fromPlaces: ["draw"],
          originFrom: ["draw"],
          open: [true],
          lastHandcard: false,
        },
      ],
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: { moves: [{ ids: [3], to: "table" }] },
      },
      "a",
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: {
          moves: [
            { ids: [1], to: "table" },
            { ids: [2], to: "discard" },
          ],
        },
      },
      "a",
    );
    expect(game.seen.last).toMatchObject({
      moves: [
        { ids: [1], lastHandcard: false },
        { ids: [2], lastHandcard: true },
      ],
    });
  });

  it("rejects a nameless private pile before dispatch", () => {
    const game = metadataGame();
    game.cardZones.private = { place: "special", owner: "a", cards: [] };
    const registry: TriggerRegistry<typeof game> = {
      version: "metadata-ce4e62b",
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
          data: { moves: [{ ids: [1], to: "private" }] },
        },
        "a",
      ),
    ).toThrow("Invalid card movement");
    expect(game.cardZones.a.cards).toEqual([1, 2]);
    expect(scheduler.frames).toEqual([]);
  });
});
