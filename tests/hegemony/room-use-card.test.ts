import { describe, expect, it } from "vitest";
import {
  createRoomUseCardOperation,
  type RoomUseGame,
  type RoomCardUse,
  type RoomUseRules,
} from "../../src/game/hegemony/room-use-card";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = RoomUseGame & { trace: unknown[]; phase: string };
function fixture(): Game {
  return {
    seatOrder: ["a", "b"],
    alive: { a: true, b: true },
    playerFlags: { a: [], b: [] },
    playerHistory: { a: {}, b: {} },
    phase: "play",
    cardZones: {
      hand: { place: "hand", owner: "a", cards: [1] },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    cardResources: {
      cards: {
        Test: {
          kind: "virtual",
          key: "test",
          isSlash: false,
          isNDTrick: false,
          flags: [],
          tags: {},
        },
      },
      playerTags: { a: {}, b: {} },
      roomTags: {},
    },
    trace: [],
  };
}
function entry(): RoomCardUse {
  return {
    reference: "Test",
    use: {
      from: "a",
      to: [],
      card: {
        type: "basic",
        name: "test",
        className: "Test",
        skillName: "",
        flags: [],
        materialIDs: [1],
      },
    },
  };
}
const resources = { reference: () => "Test" };
function registry(
  overrides: Partial<RoomUseRules<Game>> = {},
): TriggerRegistry<Game> {
  return {
    version: "room-use-ce4e62b",
    skills: [createCardUsedRule(), createCardFinishedRule(resources)],
    operations: [
      createRoomUseCardOperation({
        metadata: (_game, value) => ({
          identity: value.reference,
          realIdentity: value.reference,
          virtual: true,
          lua: false,
          delayed: false,
          handlingMethod: "use",
          canRecast: false,
          face: {
            name: value.use.card.name,
            className: value.use.card.className,
            skillName: value.use.card.skillName,
            suit: "no-suit",
            number: 0,
          },
          showSkill: "",
        }),
        limited: () => false,
        notify: () => null,
        parse: (_game, value) => value,
        inPlay: (game) => game.phase === "play",
        validate: (data) => ({ name: "validate-fixture", data }),
        onUse: ({ use }) => ({ name: "card-on-use", data: use }),
        after: (data) => ({ name: "after-fixture", data }),
        ...overrides,
      }),
      {
        name: "validate-fixture",
        run: ({ operation }) => ({
          kind: "return",
          value: { entry: operation.data, validated: operation.data },
        }),
      },
      {
        name: "after-fixture",
        run: ({ game, operation }) => {
          game.trace.push(operation.data);
          return { kind: "return", value: null };
        },
      },
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardMovementOperation(),
      createCardUsedOperation({
        resources,
        use: (data) => ({ name: "card-use", data }),
      }),
      createCardUseOperation({
        ...resources,
        effect: (data) => ({ name: "unused-effect", data }),
      }),
    ],
  };
}
describe("Room useCard normal path", () => {
  it.each([
    ["empty", [], false],
    ["hand", [1], true],
    ["mixed", [1, 3], false],
    ["foreign", [2], false],
  ] as const)(
    "computes %s hand provenance without using it as an admission gate",
    (_name, ids, expected) => {
      const game = fixture();
      game.cardZones.foreign = { place: "hand", owner: "b", cards: [2] };
      game.cardZones.equipment = { place: "equip", owner: "a", cards: [3] };
      const data = entry();
      data.use.card.materialIDs = [...ids];
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "room-use-card", data },
        "a",
      );
      expect(scheduler.operationCompletion?.value).toBe(true);
      expect(game.trace[0]).toMatchObject({ use: { m_isHandcard: expected } });
    },
  );
  it("recurses with default addHistory true even when the outer caller disables history", () => {
    const game = fixture();
    game.cardResources!.cards.Converted = {
      kind: "virtual",
      key: "converted",
      isSlash: false,
      isNDTrick: false,
      flags: [],
      tags: {},
    };
    const rules = registry({
      validate: (data) => ({ name: "convert-success", data }),
    });
    const resources = {
      reference: (use: RoomCardUse["use"]) => use.card.className,
    };
    rules.operations = rules.operations!.filter(
      (op) => !["card-used", "card-use"].includes(op.name),
    );
    rules.operations.push(
      createCardUsedOperation({
        resources,
        use: (data) => ({ name: "card-use", data }),
      }),
      createCardUseOperation({
        ...resources,
        effect: (data) => ({ name: "unused", data }),
      }),
      {
        name: "convert-success",
        run: ({ operation }) => {
          const local = operation.data as RoomCardUse;
          if (local.reference === "Converted") local.use.from = "b";
          const validated = structuredClone(local);
          if (local.reference === "Test") {
            validated.reference = "Converted";
            validated.use.card.className = "Converted";
          }
          return { kind: "return", value: { entry: local, validated } };
        },
      },
    );
    rules.skills = [createCardUsedRule(), createCardFinishedRule(resources)];
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "room-use-card", data: { ...entry(), addHistory: false } },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.playerHistory).toEqual({ a: {}, b: { Converted: 1 } });
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.trace).toMatchObject([
      { reference: "Converted", use: { from: "b" } },
      {
        reference: "Test",
        use: { from: "a", card: { className: "Converted" } },
      },
    ]);
  });
  it("keeps wrapper after arguments while actual nested use and late events change local onUse data", () => {
    const game = fixture();
    game.cardZones.foreign = { place: "hand", owner: "b", cards: [2] };
    game.cardResources!.cards.Inner = {
      kind: "virtual",
      key: "inner",
      isSlash: false,
      isNDTrick: false,
      flags: [],
      tags: {},
    };
    const rules = registry({
      onUse: (data) => ({
        name: data.reference === "Test" ? "outer-nested" : "card-on-use",
        data: data.use,
      }),
    });
    const resources = {
      reference: (use: RoomCardUse["use"]) => use.card.className,
    };
    rules.operations = rules.operations!.filter(
      (op) => !["card-used", "card-use"].includes(op.name),
    );
    rules.operations.push(
      createCardUsedOperation({
        resources,
        use: (data) => ({ name: "card-use", data }),
      }),
      createCardUseOperation({
        ...resources,
        effect: (data) => ({ name: "unused", data }),
      }),
      {
        name: "outer-nested",
        run: ({ operation, continuation }) => {
          if (continuation === null)
            return {
              kind: "operation",
              operation: { name: "card-on-use", data: operation.data },
              continuation: "outer-used",
            };
          if (continuation === "outer-used") {
            const inner = entry();
            inner.reference = "Inner";
            inner.use.from = "b";
            inner.use.card.className = "Inner";
            inner.use.card.materialIDs = [2];
            return {
              kind: "operation",
              operation: { name: "room-use-card", data: inner },
              continuation: "inner-used",
            };
          }
          return { kind: "return", value: { from: "b" } };
        },
      },
    );
    rules.skills = [
      createCardUsedRule(),
      createCardFinishedRule(resources),
      {
        id: "late-use-rewrite",
        events: ["CardUsed"],
        priority: 5,
        rule: true,
        effect: ({ event }) => {
          (event.data as RoomCardUse["use"]).from = "b";
          return { kind: "done", value: false };
        },
      },
    ];
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "room-use-card", data: entry() },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.trace).toMatchObject([
      { reference: "Inner", use: { from: "b" } },
      { reference: "Test", use: { from: "a", to: [] } },
    ]);
    expect(game.playerHistory).toEqual({ a: { Test: 1 }, b: { Inner: 1 } });
    expect(game.cardZones.discard.cards).toEqual([2, 1]);
  });
  it.each(["validate", "notice", "onUse", "after"] as const)(
    "survives JSON reload while %s is paused without duplicating history, cost or hooks",
    (pause) => {
      let game = fixture();
      const rules = registry({
        validate: (data) => ({
          name: pause === "validate" ? "pause-validate" : "validate-fixture",
          data,
        }),
        notify:
          pause === "notice"
            ? (data) => ({ name: "pause-notice", data })
            : () => null,
        onUse: ({ use }) => ({
          name: pause === "onUse" ? "pause-on-use" : "card-on-use",
          data: use,
        }),
        after: (data) => ({
          name: pause === "after" ? "pause-after" : "after-fixture",
          data,
        }),
      });
      for (const name of [
        "pause-validate",
        "pause-notice",
        "pause-on-use",
        "pause-after",
      ])
        rules.operations!.push({
          name,
          run: ({ operation, continuation }) => {
            if (continuation === null)
              return {
                kind: "prompt",
                actor: "a",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              };
            if (name === "pause-on-use")
              return continuation === true
                ? {
                    kind: "operation",
                    operation: { name: "card-on-use", data: operation.data },
                    continuation: "used",
                  }
                : { kind: "return", value: null };
            if (name === "pause-after")
              return continuation === true
                ? {
                    kind: "operation",
                    operation: { name: "after-fixture", data: operation.data },
                    continuation: "after",
                  }
                : { kind: "return", value: null };
            return {
              kind: "return",
              value:
                name === "pause-validate"
                  ? { entry: operation.data, validated: operation.data }
                  : null,
            };
          },
        });
      let scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "room-use-card", data: entry() },
        "a",
      );
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      expect(getTriggerPrompt(scheduler, "b")).toBeNull();
      const prompt = getTriggerPrompt(scheduler, "a")!;
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
      expect(scheduler.operationCompletion?.value).toBe(true);
      expect(game.playerHistory.a.Test).toBe(1);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.trace).toHaveLength(1);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "keeps eager changes and freezes after %s rather than claiming native unwind",
    (reason) => {
      const game = fixture();
      const rules = registry({
        onUse: () => ({ name: "interrupt-use", data: null }),
      });
      rules.operations!.push({
        name: "interrupt-use",
        run: ({ game }) => {
          game.cardZones.hand.cards = [];
          game.cardZones.table.cards = [1];
          return { kind: "interrupt", reason };
        },
      });
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "room-use-card", data: entry() },
        "a",
      );
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(game.playerHistory.a.Test).toBe(1);
      expect(game.cardZones.table.cards).toEqual([1]);
      expect(game.trace).toEqual([]);
    },
  );
  it("compares explicit real identity rather than serialized descriptor equality", () => {
    const game = fixture();
    game.cardResources!.cards.Real = {
      kind: "virtual",
      key: "real",
      isSlash: false,
      isNDTrick: false,
      flags: [],
      tags: {},
    };
    const rules = registry({
      metadata: (_game, value) => ({
        identity: value.reference === "Test" ? "wrapper" : "real",
        realIdentity: "real",
        virtual: true,
        lua: false,
        delayed: false,
        handlingMethod: "use",
        canRecast: false,
        face: {
          name: "test",
          className: "Test",
          skillName: "",
          suit: "no-suit",
          number: 0,
        },
        showSkill: "",
      }),
      validate: (data) => ({ name: "return-real", data }),
    });
    rules.operations!.push({
      name: "return-real",
      run: ({ game, operation }) => {
        game.trace.push("validated-once");
        const local = operation.data as RoomCardUse;
        return {
          kind: "return",
          value: { entry: local, validated: { ...local, reference: "Real" } },
        };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "room-use-card", data: entry() },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.trace).toHaveLength(2);
    expect(game.playerHistory.a.Test).toBe(1);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it.each([true, false])(
    "allows recast through a handling limit and preserves hand provenance (%s)",
    (inHand) => {
      const game = fixture();
      if (!inHand) game.cardZones.hand.place = "equip";
      const rules = registry({
        metadata: (_game, value) => ({
          identity: value.reference,
          realIdentity: value.reference,
          virtual: true,
          lua: true,
          delayed: false,
          handlingMethod: "use",
          canRecast: true,
          face: {
            name: "test",
            className: "Test",
            skillName: "",
            suit: "no-suit",
            number: 0,
          },
          showSkill: "",
        }),
        limited: (_game, _entry, method) => method === "use",
      });
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "room-use-card", data: entry() },
        "a",
      );
      expect(scheduler.operationCompletion?.value).toBe(true);
      expect(game.playerHistory.a["#test"]).toBe(1);
      expect(game.trace[0]).toMatchObject({
        use: { m_isHandcard: inHand, m_addHistory: true },
      });
    },
  );
  it("uses signed pre-validation Slash history outside Play and resets a physical wrapper", () => {
    const game = fixture();
    game.phase = "finish";
    game.playerHistory.a = { Slash: -1, FireSlash: 2, ThunderSlash: 0 };
    game.cardResources!.cards.Test = {
      kind: "wrapped",
      key: "1",
      id: 1,
      isSlash: true,
      isNDTrick: false,
    };
    game.wrappedCards = {
      1: {
        name: "slash",
        className: "Slash",
        suit: "spade",
        number: 7,
        skillName: "",
        modified: false,
        flags: [],
        tags: {},
      },
    };
    const rules = registry({
      metadata: (game, value) => ({
        identity: value.reference,
        realIdentity: value.reference,
        lua: false,
        delayed: false,
        handlingMethod: "use",
        canRecast: false,
        face: game.wrappedCards![1],
        showSkill: "",
        virtual: false,
      }),
      notify: (data) => ({ name: "notice", data }),
    });
    rules.operations!.push({
      name: "notice",
      run: ({ game, operation }) => {
        game.trace.push(operation.data);
        return { kind: "return", value: null };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "room-use-card", data: entry() },
      "a",
    );
    expect(game.playerFlags.a).toEqual(["Global_MoreSlashInOneTurn"]);
    expect(game.playerHistory.a).toEqual({
      Slash: -1,
      FireSlash: 2,
      ThunderSlash: 0,
    });
    expect(game.trace[0]).toEqual({ kind: "reset", id: 1 });
  });
  it("takes over a physical delayed-trick face before update and assigns showSkill afterward", () => {
    const game = fixture();
    const richerFace = {
      name: "indulgence",
      className: "Indulgence",
      skillName: "qixi",
      suit: "spade",
      number: 7,
      flags: ["clone"],
      tags: { clone: true },
      showSkill: "qixi",
    };
    game.wrappedCards = {
      1: {
        name: "slash",
        className: "Slash",
        suit: "spade",
        number: 7,
        skillName: "",
        modified: false,
        flags: ["physical"],
        tags: { keep: true },
      },
    };
    const rules = registry({
      metadata: (_game, value) => ({
        identity: value.reference,
        realIdentity: value.reference,
        virtual: true,
        lua: false,
        delayed: true,
        handlingMethod: "use",
        canRecast: false,
        face: richerFace,
        showSkill: "qixi",
      }),
      notify: (data) => ({ name: "notice", data }),
    });
    rules.operations!.push({
      name: "notice",
      run: ({ game, operation }) => {
        game.trace.push({
          notice: operation.data,
          wrapped: structuredClone(game.wrappedCards![1]),
        });
        return { kind: "return", value: null };
      },
    });
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "room-use-card", data: entry() },
      "a",
    );
    expect(game.wrappedCards[1]).toMatchObject({
      name: "indulgence",
      className: "Indulgence",
      modified: true,
      flags: ["physical"],
      tags: { keep: true },
      showSkill: "qixi",
    });
    expect(game.trace).toEqual([
      expect.objectContaining({
        notice: { kind: "history", player: "a", key: "Test" },
      }),
      {
        notice: { kind: "update", id: 1 },
        wrapped: expect.not.objectContaining({ showSkill: "qixi" }),
      },
      expect.objectContaining({ reference: "Test" }),
    ]);
  });
  it("applies parsed flags, replaces tags, computes provenance and denies handling/recast before validation", () => {
    const game = fixture();
    game.cardResources!.cards.Parsed = {
      kind: "virtual",
      key: "parsed",
      isSlash: false,
      isNDTrick: false,
      flags: ["parsed"],
      tags: { obsolete: true },
    };
    const source = game.cardResources!.cards.Test;
    if (source.kind === "virtual") {
      source.flags = ["incoming"];
      source.tags = { copy: [1] };
    }
    const rules = registry({
      parse: (_game, data) => ({ ...data, reference: "Parsed" }),
      limited: () => true,
    });
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "room-use-card", data: entry() },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(game.cardResources!.cards.Parsed).toMatchObject({
      flags: ["parsed", "incoming"],
      tags: { copy: [1] },
    });
    expect(game.trace).toEqual([]);
    expect(game.playerHistory.a).toEqual({});
  });
  it.each([true, false])(
    "runs outer after despite inner false, including equal-looking descriptors (%s)",
    (equalDescriptor) => {
      const game = fixture();
      game.cardResources!.cards.Converted = {
        kind: "virtual",
        key: "converted",
        isSlash: false,
        isNDTrick: false,
        flags: [],
        tags: {},
      };
      const rules = registry({
        validate: (data) => ({ name: "convert", data }),
      });
      rules.operations!.push({
        name: "convert",
        run: ({ game, operation }) => {
          const local = structuredClone(operation.data) as RoomCardUse;
          if (local.reference === "Converted") {
            game.trace.push("inner-denial");
            return { kind: "return", value: null };
          }
          const validated = structuredClone(local);
          validated.reference = "Converted";
          if (!equalDescriptor) validated.use.card.className = "Converted";
          return { kind: "return", value: { entry: local, validated } };
        },
      });
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "room-use-card", data: { ...entry(), addHistory: false } },
        "a",
      );
      expect(scheduler.operationCompletion?.value).toBe(true);
      expect(game.trace).toEqual([
        "inner-denial",
        expect.objectContaining({
          reference: "Test",
          use: expect.objectContaining({
            card: expect.objectContaining({
              className: equalDescriptor ? "Test" : "Converted",
            }),
          }),
        }),
      ]);
      expect(game.playerHistory.a).toEqual({});
      expect(game.cardZones.hand.cards).toEqual([1]);
    },
  );
  it("captures the original key but records the validated actor and returned skill", () => {
    const game = fixture();
    const rules = registry();
    rules.operations!.push({
      name: "change-actor",
      run: ({ operation }) => {
        const local = structuredClone(operation.data) as RoomCardUse;
        local.use.from = "b";
        local.use.card.className = "Changed";
        const validated = structuredClone(local);
        validated.use.card.skillName = "_converted";
        return { kind: "return", value: { entry: local, validated } };
      },
    });
    const altered = registry({
      validate: (data) => ({ name: "change-actor", data }),
    });
    altered.operations!.push(rules.operations!.at(-1)!);
    const scheduler = createTriggerScheduler(game.seatOrder, altered.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      altered,
      { name: "room-use-card", data: entry() },
      "a",
    );
    expect(game.playerHistory.a).toEqual({});
    expect(game.playerHistory.b).toEqual({
      Test: 1,
      ViewAsSkill_convertedCard: 1,
    });
  });
  it("retains eager validation changes on null without paying history or cost", () => {
    const game = fixture();
    const rules = registry();
    rules.operations!.push({
      name: "reveal-deny",
      run: ({ game }) => {
        game.trace.push("revealed");
        return { kind: "return", value: null };
      },
    });
    rules.operations![0] = createRoomUseCardOperation({
      metadata: (_game, value) => ({
        identity: value.reference,
        realIdentity: value.reference,
        virtual: true,
        lua: false,
        delayed: false,
        handlingMethod: "use",
        canRecast: false,
        face: {
          name: "test",
          className: "Test",
          skillName: "",
          suit: "no-suit",
          number: 0,
        },
        showSkill: "",
      }),
      limited: () => false,
      notify: () => null,
      parse: (_game, data) => data,
      inPlay: () => true,
      validate: () => ({ name: "reveal-deny", data: null }),
      onUse: ({ use }) => ({ name: "card-on-use", data: use }),
      after: (data) => ({ name: "after-fixture", data }),
    });
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "room-use-card", data: entry() },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(game.trace).toEqual(["revealed"]);
    expect(game.playerHistory.a).toEqual({});
    expect(game.cardZones.hand.cards).toEqual([1]);
  });
  it("records actual history and composes real onUse, GameRule, movement and cleanup", () => {
    const game = fixture();
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "room-use-card", data: entry() },
        "a",
      ),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.playerHistory.a.Test).toBe(1);
    expect(game.cardZones.hand.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.trace).toHaveLength(1);
  });
});
