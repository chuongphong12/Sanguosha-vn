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
import {
  createCardOnUseOperation,
  type CardUse,
} from "../../src/game/hegemony/card-on-use";

function fixture(): CardMovementGame & {
  seen: {
    event: string;
    table: number[];
    hand: number[];
    targets: TriggerData;
  }[];
} {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    cardZones: {
      aHand: { place: "hand", owner: "a", cards: [1, 2] },
      bHand: { place: "hand", owner: "b", cards: [] },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    seen: [],
  };
}
type Game = ReturnType<typeof fixture>;
function useData(): CardUse {
  return {
    from: "a",
    to: ["c", "b"],
    card: {
      type: "basic",
      name: "slash",
      className: "Slash",
      skillName: "",
      materialIDs: [1],
      flags: [],
    },
  };
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "on-use-ce4e62b",
    operations: [
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardMovementOperation(),
    ],
    skills: [
      {
        id: "observe-on-use",
        rule: true,
        priority: 0,
        events: ["PreCardUsed", "TargetSelected", "CardUsed", "CardFinished"],
        effect: ({ game, event }) => {
          if (
            !event.data ||
            typeof event.data !== "object" ||
            Array.isArray(event.data)
          )
            throw new Error("Expected use payload");
          game.seen.push({
            event: event.name,
            table: [...game.cardZones.table.cards],
            hand: [...game.cardZones.aHand.cards],
            targets: structuredClone(event.data.to),
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

describe("Hegemony normalized Card::onUse lifecycle", () => {
  it.each([
    ["foreign source", { ...useData(), from: "outside" }],
    ["foreign target", { ...useData(), to: ["outside"] }],
    ["duplicate target", { ...useData(), to: ["b", "b"] }],
    [
      "skill card",
      { ...useData(), card: { ...useData().card, type: "skill" } },
    ],
    ["empty name", { ...useData(), card: { ...useData().card, name: "" } }],
    [
      "duplicate material",
      { ...useData(), card: { ...useData().card, materialIDs: [1, 1] } },
    ],
    [
      "negative material",
      { ...useData(), card: { ...useData().card, materialIDs: [-1] } },
    ],
    [
      "fractional material",
      { ...useData(), card: { ...useData().card, materialIDs: [1.5] } },
    ],
    [
      "missing material",
      { ...useData(), card: { ...useData().card, materialIDs: [99] } },
    ],
    [
      "invalid flags",
      { ...useData(), card: { ...useData().card, flags: [7] } },
    ],
  ])("rejects %s atomically", (_label, data) => {
    const game = fixture();
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = JSON.stringify({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-on-use", data },
        "b",
      ),
    ).toThrow();
    expect(JSON.stringify({ game, scheduler })).toBe(before);
  });

  it("rejects duplicate physical locations before recording events", () => {
    const game = fixture();
    game.cardZones.bHand.cards = [1];
    expect(() => dispatch(game)).toThrow("Invalid card use material location");
    expect(game.seen).toEqual([]);
    expect(game.cardZones.aHand.cards).toEqual([1, 2]);
  });

  it.each([
    { tableZone: "missing", discardZone: "discard" },
    { tableZone: "aHand", discardZone: "discard" },
    { tableZone: "table", discardZone: "table" },
  ])(
    "rejects invalid shared destination configuration %j in preflight",
    (config) => {
      const game = fixture();
      const rules = registry();
      rules.operations![0] = createCardOnUseOperation(config);
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = JSON.stringify({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-on-use", data: useData() },
          "b",
        ),
      ).toThrow("Invalid card use destination");
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    },
  );

  it("rejects malformed rewritten Pre payloads before any material movement", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "invalid-pre",
      rule: true,
      priority: 1,
      events: ["PreCardUsed"],
      effect: ({ event }) => {
        event.data = {
          ...useData(),
          card: { ...useData().card, type: "skill" },
        };
        return { kind: "done", value: false };
      },
    });
    expect(() => dispatch(game, rules)).toThrow("Invalid card use");
    expect(game.cardZones.aHand.cards).toEqual([1, 2]);
    expect(game.cardZones.table.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });

  it("runs a nested use to completion before the outer CardFinished and cleanup", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "nested-use",
      rule: true,
      priority: -1,
      events: ["CardUsed"],
      effect: ({ event, continuation }) => {
        const use = event.data as CardUse;
        return use.card.name === "slash" && continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "card-on-use",
                data: {
                  ...useData(),
                  to: ["b"],
                  card: {
                    ...useData().card,
                    name: "peach",
                    className: "Peach",
                    materialIDs: [2],
                  },
                },
              },
              continuation: "nested-finished",
            }
          : { kind: "done", value: false };
      },
    });
    const scheduler = dispatch(game, rules);
    expect(
      game.seen.map((entry) => ({ event: entry.event, table: entry.table })),
    ).toEqual([
      { event: "PreCardUsed", table: [] },
      { event: "TargetSelected", table: [1] },
      { event: "CardUsed", table: [1] },
      { event: "PreCardUsed", table: [1] },
      { event: "TargetSelected", table: [1, 2] },
      { event: "CardUsed", table: [1, 2] },
      { event: "CardFinished", table: [1, 2] },
      { event: "CardFinished", table: [1] },
    ]);
    expect(game.cardZones.discard.cards).toEqual([1, 2]);
    expect(game.cardZones.table.cards).toEqual([]);
    expect(scheduler.frames).toEqual([]);
  });

  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes parents on %s without pretending normal CardFinished/unwind ran",
    (reason) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "interrupt",
        rule: true,
        priority: -1,
        events: ["CardUsed"],
        effect: () => ({ kind: "interrupt", reason }),
      });
      const scheduler = dispatch(game, rules);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.seen.map((entry) => entry.event)).toEqual([
        "PreCardUsed",
        "TargetSelected",
        "CardUsed",
      ]);
      expect(game.cardZones.table.cards).toEqual([1]);
      expect(game.cardZones.discard.cards).toEqual([]);
      expect(scheduler.operationCompletion).toBeNull();
      expect(scheduler.frames.length).toBeGreaterThan(0);
    },
  );

  it("uses the ImperialOrder USE ancestry exception during normal cleanup", () => {
    const game = fixture();
    game.cardZones.wugu = { place: "wugu", owner: null, cards: [] };
    const rules = registry();
    rules.operations![1] = createCardMovementOperation(
      undefined,
      undefined,
      undefined,
      { cardIDs: [1], wuguZone: "wugu" },
    );
    dispatch(game, rules, {
      ...useData(),
      card: {
        ...useData().card,
        type: "trick",
        name: "imperial_order",
        className: "ImperialOrder",
      },
    });
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.wugu.cards).toEqual([]);
    expect(game.imperialOrder).toBeUndefined();
  });

  it("reloads a cleanup movement prompt and returns without repeating CardFinished", () => {
    let game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "pause-cleanup",
      rule: true,
      priority: 1,
      events: ["ConfirmMoveCards"],
      effect: ({ event, continuation }) => {
        const data = event.data as { moves: { toPlace: string }[] };
        return event.target === "b" &&
          data.moves[0].toPlace === "discard" &&
          continuation === null
          ? {
              kind: "prompt",
              actor: "a",
              choices: ["continue"],
              canCancel: false,
              continuation: "waiting",
            }
          : { kind: "done", value: false };
      },
    });
    let scheduler = dispatch(game, rules);
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.seen.at(-1)?.event).toBe("CardFinished");
    const prompt = getTriggerPrompt(scheduler, "a")!;
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.seen.map((entry) => entry.event)).toEqual([
      "PreCardUsed",
      "TargetSelected",
      "CardUsed",
      "CardFinished",
    ]);
    expect(scheduler.frames).toEqual([]);
    const finished = JSON.stringify({ game, scheduler });
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(finished);
  });

  it("keeps the original disable flag when Pre replaces the normalized card", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "replace-card",
      rule: true,
      priority: 1,
      events: ["PreCardUsed"],
      effect: ({ event }) => {
        const use = event.data as CardUse;
        use.card = {
          ...use.card,
          name: "peach",
          className: "Peach",
          materialIDs: [2],
          flags: [],
        };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, {
      ...useData(),
      card: { ...useData().card, flags: ["slashDisableExtraTarget"] },
    });
    expect(game.seen.map((entry) => entry.event)).toEqual([
      "PreCardUsed",
      "CardUsed",
      "CardFinished",
    ]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });

  it("resolves original material locations after a nested Pre movement", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "pre-transfer",
      rule: true,
      priority: -1,
      events: ["PreCardUsed"],
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: { moves: [{ ids: [1], to: "bHand" }] },
              },
              continuation: "transferred",
            }
          : { kind: "done", value: false },
    });
    dispatch(game, rules);
    expect(game.cardZones.bHand.cards).toEqual([]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });

  it("preserves ordered virtual materials through table and prepend-discard movement", () => {
    const game = fixture();
    dispatch(game, registry(), {
      ...useData(),
      card: { ...useData().card, materialIDs: [2, 1] },
    });
    expect(game.seen.at(-1)?.table).toEqual([2, 1]);
    expect(game.cardZones.discard.cards).toEqual([1, 2]);
  });

  it("preserves converted wrapped metadata on table and resets it only during cleanup", () => {
    const game = fixture();
    const original = {
      name: "slash",
      className: "Slash",
      suit: "spade",
      number: 7,
      skillName: "",
    };
    game.wrappedCards = {
      1: {
        ...original,
        name: "peach",
        className: "Peach",
        suit: "heart",
        skillName: "conversion",
        modified: true,
        flags: ["kept"],
        tags: {},
      },
    };
    const rules = registry();
    rules.operations![1] = createCardMovementOperation(
      undefined,
      undefined,
      undefined,
      undefined,
      { originals: { 1: original } },
    );
    let atFinish: TriggerData = null;
    rules.skills.push({
      id: "wrapped-finish",
      rule: true,
      priority: 0,
      events: ["CardFinished"],
      effect: ({ game }) => {
        const card = game.wrappedCards![1];
        atFinish = { name: card.name, suit: card.suit };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, {
      ...useData(),
      card: {
        ...useData().card,
        name: "peach",
        className: "Peach",
        skillName: "conversion",
      },
    });
    expect(atFinish).toEqual({ name: "peach", suit: "heart" });
    expect(game.wrappedCards?.[1]).toEqual({
      ...original,
      modified: true,
      flags: ["kept"],
      tags: {},
    });
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it("rejects malformed use data before allocating a frame or recording an event", () => {
    const game = fixture();
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = JSON.stringify({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-on-use", data: null },
        "b",
      ),
    ).toThrow("Invalid card use");
    expect(JSON.stringify({ game, scheduler })).toBe(before);
  });
  it("places materials between PreCardUsed and CardUsed, then finishes before fallback discard", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(game.seen).toEqual([
      { event: "PreCardUsed", table: [], hand: [1, 2], targets: ["b", "c"] },
      { event: "TargetSelected", table: [1], hand: [2], targets: ["b", "c"] },
      { event: "CardUsed", table: [1], hand: [2], targets: ["b", "c"] },
      { event: "CardFinished", table: [1], hand: [2], targets: ["b", "c"] },
    ]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.table.cards).toEqual([]);
    expect(scheduler.frames).toEqual([]);
  });

  it("sorts initial targets from the current actor rather than the card source", () => {
    const game = fixture();
    dispatch(game, registry(), {
      ...useData(),
      to: ["a", "c"],
      card: {
        ...useData().card,
        type: "trick",
        name: "amazing_grace",
        className: "AmazingGrace",
      },
    });
    expect(game.seen[0].targets).toEqual(["c", "a"]);
    expect(game.seen.at(-1)?.targets).toEqual(["c", "a"]);
  });

  it("keeps original materials/source and post-Pre reason separate from later event rewrites", () => {
    const game = fixture();
    const rules = registry();
    const reasons: TriggerData[] = [];
    rules.skills.push({
      id: "rewrite-use",
      rule: true,
      priority: 1,
      events: [
        "PreCardUsed",
        "TargetSelected",
        "CardUsed",
        "CardFinished",
        "BeforeCardsMove",
      ],
      effect: ({ event }) => {
        if (event.name === "BeforeCardsMove") {
          const data = event.data as { moves: { reason: TriggerData }[] };
          if (event.target === "b")
            reasons.push(structuredClone(data.moves[0].reason));
        } else {
          const use = event.data as CardUse;
          if (event.name === "PreCardUsed") {
            use.from = "b";
            use.to = ["c"];
            use.card = {
              ...use.card,
              name: "peach",
              className: "Peach",
              skillName: "conversion",
              materialIDs: [2],
            };
          } else if (event.name === "TargetSelected") use.to = ["a", "c"];
          else if (event.name === "CardUsed") use.to = ["a"];
          else use.to = [];
          expect(event.target).toBe("a");
        }
        return { kind: "done", value: false };
      },
    });
    const scheduler = dispatch(game, rules);
    const afterPre = {
      ...useData(),
      from: "b",
      to: ["c"],
      card: {
        ...useData().card,
        name: "peach",
        className: "Peach",
        skillName: "conversion",
        materialIDs: [2],
      },
    };
    expect(reasons).toEqual([
      {
        kind: "use",
        actor: "a",
        skill: "conversion",
        event: "",
        target: "c",
        use: { ...afterPre, cardClass: "Peach" },
      },
      {
        kind: "use",
        actor: "a",
        skill: "",
        event: "slash",
        target: "c",
        use: { ...afterPre, cardClass: "Peach" },
      },
    ]);
    expect(game.cardZones.aHand.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.seen.map((entry) => entry.targets)).toEqual([
      ["c"],
      ["a", "c"],
      ["a"],
      [],
    ]);
    expect(scheduler.operationCompletion?.value).toEqual({
      data: { ...afterPre, to: [] },
    });
  });

  it("allows CardFinished to claim material and discards only remaining original table IDs", () => {
    const game = fixture();
    game.cardZones.table.cards = [3];
    const rules = registry();
    rules.skills.push({
      id: "claim-finished",
      rule: true,
      priority: -1,
      events: ["CardFinished"],
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: { moves: [{ ids: [1], to: "bHand" }] },
              },
              continuation: "claimed",
            }
          : { kind: "done", value: false },
    });
    dispatch(game, rules, {
      ...useData(),
      card: { ...useData().card, materialIDs: [1, 2] },
    });
    expect(game.seen.at(-1)?.table).toEqual([3, 1, 2]);
    expect(game.cardZones.bHand.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
    expect(game.cardZones.table.cards).toEqual([3]);
  });

  it("cleans original materials in another table zone by physical place", () => {
    const game = fixture();
    game.cardZones.otherTable = { place: "table", owner: null, cards: [] };
    const rules = registry();
    rules.skills.push({
      id: "relocate-table",
      rule: true,
      priority: -1,
      events: ["CardUsed"],
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: { moves: [{ ids: [1], to: "otherTable" }] },
              },
              continuation: "relocated",
            }
          : { kind: "done", value: false },
    });
    dispatch(game, rules);
    expect(game.cardZones.otherTable.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });

  it.each(["PreCardUsed", "TargetSelected", "CardUsed", "CardFinished"])(
    "continues normal finish and cleanup when %s is consumed",
    (name) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "consume",
        rule: true,
        priority: -1,
        events: [name],
        effect: () => ({ kind: "done", value: true }),
      });
      dispatch(game, rules);
      expect(game.seen.map((entry) => entry.event)).toEqual([
        "PreCardUsed",
        "TargetSelected",
        "CardUsed",
        "CardFinished",
      ]);
      expect(game.cardZones.discard.cards).toEqual([1]);
    },
  );

  it("finishes without discarding material when its put movement is cancelled", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "cancel-put",
      rule: true,
      priority: 1,
      events: ["BeforeCardsMove"],
      effect: () => ({ kind: "done", value: true }),
    });
    dispatch(game, rules);
    expect(game.seen.map((entry) => entry.event)).toEqual([
      "PreCardUsed",
      "TargetSelected",
      "CardUsed",
      "CardFinished",
    ]);
    expect(game.cardZones.aHand.cards).toEqual([1, 2]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });

  it("supports a zero-material virtual use and still dispatches empty put notifications", () => {
    const game = fixture();
    const rules = registry();
    const emptyMoves: TriggerData[] = [];
    rules.skills.push({
      id: "empty-put",
      rule: true,
      priority: 0,
      events: ["BeforeCardsMove"],
      effect: ({ event }) => {
        if (event.target === "b") emptyMoves.push(structuredClone(event.data));
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, {
      ...useData(),
      to: [],
      card: { ...useData().card, materialIDs: [] },
    });
    expect(emptyMoves).toEqual([{ moves: [] }]);
    expect(game.seen.map((entry) => entry.event)).toEqual([
      "PreCardUsed",
      "TargetSelected",
      "CardUsed",
      "CardFinished",
    ]);
    expect(game.cardZones.aHand.cards).toEqual([1, 2]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });

  it("skips only TargetSelected for the original normalized disable-extra-target flag", () => {
    const game = fixture();
    dispatch(game, registry(), {
      ...useData(),
      card: { ...useData().card, flags: ["slashDisableExtraTarget"] },
    });
    expect(game.seen.map((entry) => entry.event)).toEqual([
      "PreCardUsed",
      "CardUsed",
      "CardFinished",
    ]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });

  it.each([
    "PreCardUsed",
    "TargetSelected",
    "CardUsed",
    "CardFinished",
    "ConfirmMoveCards",
  ])(
    "resumes %s after JSON reload without repeating the use or its cleanup",
    (name) => {
      let game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "pause",
        rule: true,
        priority: -1,
        events: [name],
        effect: ({ event, continuation }) =>
          continuation === null &&
          (name !== "ConfirmMoveCards" || event.target === "b")
            ? {
                kind: "prompt",
                actor: "a",
                choices: ["continue"],
                canCancel: false,
                continuation: "paused",
              }
            : { kind: "done", value: false },
      });
      let scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "a")!;
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      const before = JSON.stringify({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(before);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      // Confirm also occurs during cleanup: finish that independent prompt.
      const cleanupPrompt = getTriggerPrompt(scheduler, "a");
      if (cleanupPrompt)
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "a", {
            id: cleanupPrompt.id,
            choice: "continue",
          }),
        ).toBe(true);
      const finished = JSON.stringify({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(finished);
      expect(game.seen.map((entry) => entry.event)).toEqual([
        "PreCardUsed",
        "TargetSelected",
        "CardUsed",
        "CardFinished",
      ]);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(scheduler.frames).toEqual([]);
    },
  );
});
