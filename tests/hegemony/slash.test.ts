import { describe, expect, it } from "vitest";
import {
  createSlashOnEffectOperation,
  createSlashEffectOperation,
  createSlashResultOperation,
  createSlashOnUseOperation,
  createJinkEffectOperation,
  type SlashGame,
  type SlashEffect,
} from "../../src/game/hegemony/slash";
import type { CardEffect } from "../../src/game/hegemony/card-effect";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = SlashGame & { observed: TriggerData[] };
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    playerFlags: { a: [], b: [], c: [] },
    playerMarks: { a: {}, b: {}, c: {} },
    cardZones: {},
    cardResources: {
      cards: {
        slash: {
          kind: "virtual",
          key: "slash-key",
          isSlash: true,
          isNDTrick: false,
          flags: [],
          tags: { drank: 2 },
        },
      },
      playerTags: {
        a: { "Jink_slash-key": [2, 1] },
        b: { Qinggang: ["slash-key", "slash-key", "other"] },
        c: {},
      },
      roomTags: {},
    },
    observed: [],
  };
}
function effect(): CardEffect {
  return {
    from: "a",
    to: "b",
    card: {
      type: "basic",
      name: "slash",
      className: "Slash",
      skillName: "",
      materialIDs: [],
      flags: [],
    },
    multiple: true,
    nullified: false,
    disresponsive: false,
  };
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "slash-ce4e62b",
    skills: [
      {
        id: "observe",
        events: ["SlashEffected"],
        priority: 10,
        record: ({ game, event }) => {
          game.observed.push(structuredClone(event.data));
        },
        effect: () => ({ kind: "done", value: false }),
      },
    ],
    operations: [
      createSlashOnEffectOperation({
        reference: () => "slash",
        nature: () => "fire",
      }),
      createSlashEffectOperation(),
    ],
  };
}
function dispatch(
  game: Game,
  rules = registry(),
  name = "slash-on-effect",
  data: TriggerData = effect(),
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(scheduler, game, rules, { name, data }, "a");
  return scheduler;
}
describe("Hegemony Slash normalized wrappers", () => {
  it("shares wrapped storage and freezes eager Slash preparation across JSON pause", () => {
    let game = fixture();
    game.wrappedCards = {
      1: {
        name: "slash",
        className: "Slash",
        skillName: "",
        suit: "club",
        number: 7,
        modified: true,
        flags: ["existing"],
        tags: { keep: true },
      },
    };
    game.cardResources!.cards.slash = {
      kind: "wrapped",
      id: 1,
      key: "1",
      isSlash: true,
      isNDTrick: false,
    };
    game.playerFlags.a = [
      "slashDisableExtraTarget",
      "SlashAssignee",
      "slashTargetFix",
    ];
    game.playerMarks.a.drank = 2;
    const rules = registry();
    rules.operations!.push(
      createSlashOnUseOperation({
        reference: () => "slash",
        repeatSlashCause: () => null,
      }),
      {
        name: "card-on-use",
        run: ({ game, operation, continuation }) => {
          if (continuation === null)
            return {
              kind: "prompt",
              actor: "a",
              choices: ["continue"],
              canCancel: false,
              continuation: true,
            };
          game.observed.push(operation.data);
          return { kind: "return", value: null };
        },
      },
    );
    let scheduler = dispatch(game, rules, "slash-on-use", {
      from: "a",
      to: ["b"],
      card: effect().card,
    });
    const prompt = getTriggerPrompt(scheduler, "a")!;
    expect(prompt).not.toBeNull();
    expect(game.playerFlags.a).toEqual([]);
    expect(game.playerMarks.a.drank).toBe(0);
    expect(game.wrappedCards![1]).toMatchObject({
      flags: ["existing", "slashDisableExtraTarget", "drank"],
      tags: { keep: true, drank: 2 },
    });
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(game.observed).toMatchObject([
      { card: { flags: ["existing", "slashDisableExtraTarget", "drank"] } },
    ]);
    expect(scheduler.frames).toEqual([]);
    expect(game.cardResources!.cards.slash).toEqual({
      kind: "wrapped",
      id: 1,
      key: "1",
      isSlash: true,
      isNDTrick: false,
    });
    const before = structuredClone(game);
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(game).toEqual(before);
  });
  it.each([null, 1.5, 2147483648])(
    "preflights malformed drank marks without changing flags/storage: %j",
    (drank) => {
      const game = fixture();
      Object.assign(game.playerMarks.a, { drank });
      game.playerFlags.a = ["slashNoDistanceLimit"];
      const rules = registry();
      rules.operations!.push(
        createSlashOnUseOperation({
          reference: () => "slash",
          repeatSlashCause: () => null,
        }),
      );
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          {
            name: "slash-on-use",
            data: { from: "a", to: [], card: effect().card },
          },
          "a",
        ),
      ).toThrow("integer");
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it("rejects malformed ResponseNegated before allocating a Jink frame", () => {
    const game = fixture();
    Object.assign(game.cardResources!.cards.slash, {
      tags: { ResponseNegated: 1 },
    });
    const rules = registry();
    rules.operations!.push(createJinkEffectOperation({ isJink: () => true }));
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = structuredClone({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "jink-effect",
          data: {
            user: "b",
            jink: { reference: "slash", card: effect().card },
          },
        },
        "a",
      ),
    ).toThrow("ResponseNegated");
    expect({ game, scheduler }).toEqual(before);
  });
  it.each([null, [1], "slash-key"])(
    "rejects malformed Qinggang at the nested Room boundary without rolling back eager Jink consumption: %j",
    (value) => {
      const game = fixture();
      game.cardResources!.playerTags.b.Qinggang = value;
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "slash-on-effect", data: effect() },
          "a",
        ),
      ).toThrow("Qinggang");
      // onEffect already took one Jink before the nested Room preflight failed.
      expect(game.cardResources!.playerTags.a["Jink_slash-key"]).toEqual([1]);
      expect(before.scheduler.nextId).toBeLessThan(scheduler.nextId);
    },
  );
  it.each([0, -1, 1, 2147483647])(
    "consumes signed Jink counts even when disresponsive: %s",
    (count) => {
      const game = fixture();
      game.cardResources!.playerTags.a["Jink_slash-key"] = [count];
      delete (
        game.cardResources!.cards.slash as { tags: Record<string, TriggerData> }
      ).tags.drank;
      const data = effect();
      data.disresponsive = true;
      dispatch(game, registry(), "slash-on-effect", data);
      expect(game.cardResources!.playerTags.a).not.toHaveProperty(
        "Jink_slash-key",
      );
      expect(game.observed).toMatchObject([{ jink_num: 0, drank: 0 }]);
    },
  );
  it.each([[], [null], [1.5], [2147483648], "1"])(
    "rejects unsupported Jink requirements before any operation state: %j",
    (list) => {
      const game = fixture();
      game.cardResources!.playerTags.a["Jink_slash-key"] = list;
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "slash-on-effect", data: effect() },
          "a",
        ),
      ).toThrow();
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it.each([null, "paoxiao", "paoxiao_xh", "crossbow"] as const)(
    "clears repeated Slash only for a resolved cause: %s",
    (cause) => {
      const game = fixture();
      game.playerFlags.a = ["slashTargetFixToOne", "Global_MoreSlashInOneTurn"];
      game.playerFlags.b = ["SlashAssignee"];
      game.playerMarks.a.drank = -1;
      const rules = registry();
      rules.operations!.push(
        createSlashOnUseOperation({
          reference: () => "slash",
          repeatSlashCause: () => cause,
        }),
        { name: "card-on-use", run: () => ({ kind: "return", value: null }) },
      );
      dispatch(game, rules, "slash-on-use", {
        from: "a",
        to: [],
        card: effect().card,
      });
      expect(game.playerFlags.a).toEqual(
        cause === null
          ? ["slashTargetFixToOne", "Global_MoreSlashInOneTurn"]
          : ["slashTargetFixToOne"],
      );
      expect(game.playerFlags.b).toEqual(["SlashAssignee"]);
      expect(game.playerMarks.a.drank).toBe(-1);
      expect(game.cardResources!.cards.slash).toMatchObject({
        flags: [],
        tags: { drank: 2 },
      });
    },
  );
  it("keeps adapters pure and does not resolve repeat causes without its flag", () => {
    const game = fixture();
    const original = structuredClone(game);
    const rules = registry();
    rules.operations!.push(
      createSlashOnUseOperation({
        reference: (use) => {
          use.from = "c";
          return "slash";
        },
        repeatSlashCause: () => {
          throw new Error("unused");
        },
      }),
      { name: "card-on-use", run: () => ({ kind: "return", value: null }) },
    );
    dispatch(game, rules, "slash-on-use", {
      from: "a",
      to: [],
      card: effect().card,
    });
    expect(game).toEqual(original);
  });
  it.each([true, false])(
    "uses current original key for consumed cleanup, leaving rewritten recipient alone: %s",
    (consumed) => {
      const game = fixture();
      game.alive.b = false;
      game.cardResources!.playerTags.b.Qinggang = [
        "changed",
        "changed",
        "slash-key",
      ];
      const rules = registry();
      rules.skills.push({
        id: "rewrite",
        events: ["SlashEffected"],
        priority: 0,
        rule: true,
        effect: ({ game, event }) => {
          game.cardResources!.cards.slash.key = "changed";
          event.data = { to: "c" };
          return { kind: "done", value: consumed };
        },
      });
      dispatch(game, rules);
      expect(game.observed).toMatchObject([{ to: "b" }]);
      expect(game.cardResources!.playerTags.b.Qinggang).toEqual(
        consumed
          ? ["changed", "slash-key"]
          : ["changed", "changed", "slash-key"],
      );
      expect(game.cardResources!.playerTags.c).toEqual({});
    },
  );
  it.each([null, "slash"])(
    "gates hits by current alive while nullable-source misses still emit: %s",
    (reference) => {
      const game = fixture();
      game.alive.b = false;
      const rules = registry();
      rules.operations!.push(createSlashResultOperation());
      rules.skills.push({
        id: "observe-result",
        events: ["SlashHit", "SlashMissed"],
        priority: 10,
        record: ({ game, event }) => {
          game.observed.push({
            name: event.name,
            target: event.target,
            data: structuredClone(event.data),
          });
        },
        effect: () => ({ kind: "done", value: false }),
      });
      const data: SlashEffect = {
        from: null,
        to: "b",
        slash: null,
        jink: null,
        jink_num: 1,
        drank: 0,
        nature: "normal",
        nullified: false,
      };
      dispatch(game, rules, "slash-result", {
        effect: data,
        jink: reference === null ? null : { reference, card: effect().card },
      });
      expect(game.observed).toEqual(
        reference === null
          ? []
          : [
              {
                name: "SlashMissed",
                target: null,
                data: { ...data, jink: { reference, card: effect().card } },
              },
            ],
      );
      expect(game.cardResources!.playerTags.b.Qinggang).toEqual([
        "slash-key",
        "slash-key",
        "other",
      ]);
    },
  );
  it.each([
    { user: null, jink: { reference: "missing" } },
    { user: "unknown", jink: null },
  ])("short circuits null Jink/user without resources: %j", (data) => {
    const game = fixture();
    delete game.cardResources;
    const rules = registry();
    rules.operations!.push(
      createJinkEffectOperation({
        isJink: () => {
          throw new Error("unused");
        },
      }),
    );
    expect(
      dispatch(game, rules, "jink-effect", data).operationCompletion?.value,
    ).toBe(false);
  });
  it("checks ancestry before ResponseNegated and omits the JinkEffect event when negated", () => {
    const game = fixture();
    (
      game.cardResources!.cards.slash as { tags: Record<string, TriggerData> }
    ).tags.ResponseNegated = true;
    const rules = registry();
    rules.operations!.push(
      createJinkEffectOperation({
        isJink: (copy, card) => {
          copy.playerFlags.b.push("leak");
          card.reference = "missing";
          return true;
        },
      }),
    );
    const data = {
      user: "b",
      jink: { reference: "slash", card: effect().card },
    };
    expect(
      dispatch(game, rules, "jink-effect", data).operationCompletion?.value,
    ).toBe(false);
    expect(game.observed).toEqual([]);
    expect(game.playerFlags.b).toEqual([]);
    rules.operations = rules.operations!.filter(
      (operation) => operation.name !== "jink-effect",
    );
    rules.operations.push(createJinkEffectOperation({ isJink: () => false }));
    expect(() => dispatch(game, rules, "jink-effect", data)).toThrow(
      "ancestry",
    );
  });
  it("prepares flags, living assignees and drank before the common onUse child", () => {
    const game = fixture();
    game.alive.c = false;
    game.playerFlags.a = [
      "slashTargetFix",
      "slashTargetFixToOne",
      "slashNoDistanceLimit",
      "slashDisableExtraTarget",
      "Global_MoreSlashInOneTurn",
      "keep",
    ];
    game.playerFlags.b = ["SlashAssignee"];
    game.playerFlags.c = ["SlashAssignee"];
    game.playerMarks.a.drank = 3;
    const rules = registry();
    rules.operations!.push(
      createSlashOnUseOperation({
        reference: () => "slash",
        repeatSlashCause: () => "crossbow",
      }),
      {
        name: "card-on-use",
        run: ({ game, operation }) => {
          game.observed.push(operation.data);
          return { kind: "return", value: null };
        },
      },
    );
    dispatch(game, rules, "slash-on-use", {
      from: "a",
      to: ["b"],
      card: effect().card,
    });
    expect(game.playerFlags).toEqual({
      a: ["keep"],
      b: [],
      c: ["SlashAssignee"],
    });
    expect(game.playerMarks.a.drank).toBe(0);
    expect(game.cardResources!.cards.slash).toMatchObject({
      flags: ["slashNoDistanceLimit", "slashDisableExtraTarget", "drank"],
      tags: { drank: 3 },
    });
    expect(game.observed).toMatchObject([
      {
        card: {
          flags: ["slashNoDistanceLimit", "slashDisableExtraTarget", "drank"],
        },
      },
    ]);
  });
  it.each([false, true])(
    "uses JinkEffect consumption as the response result: %s",
    (consumed) => {
      const game = fixture();
      const rules = registry();
      rules.operations!.push(createJinkEffectOperation({ isJink: () => true }));
      rules.skills.push({
        id: "jink",
        events: ["JinkEffect"],
        priority: 0,
        rule: true,
        effect: ({ event }) => {
          event.data = null;
          return { kind: "done", value: consumed };
        },
      });
      const scheduler = dispatch(game, rules, "jink-effect", {
        user: "b",
        jink: { reference: "slash", card: effect().card },
      });
      expect(scheduler.operationCompletion?.value).toBe(!consumed);
    },
  );
  it("cleans original recipient flags and one original current-key Qinggang entry after a consumed rewrite", () => {
    const game = fixture();
    game.playerFlags.b = ["Global_NonSkillNullify", "keep"];
    const rules = registry();
    rules.skills.push({
      id: "consume",
      events: ["SlashEffected"],
      priority: 0,
      rule: true,
      effect: ({ event }) => {
        event.data = null;
        return { kind: "done", value: true };
      },
    });
    dispatch(game, rules);
    expect(game.playerFlags.b).toEqual(["keep"]);
    expect(game.cardResources!.playerTags.b.Qinggang).toEqual([
      "slash-key",
      "other",
    ]);
  });
  it.each([null, "jink"])(
    "emits hit/miss at the source and cleans armor only for a miss: %s",
    (reference) => {
      const game = fixture();
      game.cardResources!.cards.jink = {
        kind: "virtual",
        key: "jink-key",
        isSlash: false,
        isNDTrick: false,
        flags: [],
        tags: {},
      };
      const slashEffect: SlashEffect = {
        from: "a",
        to: "b",
        slash: { reference: "slash", card: effect().card },
        jink: null,
        jink_num: 1,
        drank: 0,
        nature: "normal",
        nullified: false,
      };
      const rules = registry();
      rules.operations!.push(createSlashResultOperation());
      rules.skills.push({
        id: "result-observe",
        events: ["SlashHit", "SlashMissed"],
        priority: 10,
        record: ({ game, event }) => {
          game.observed.push({
            name: event.name,
            target: event.target,
            data: event.data,
          });
        },
        effect: () => ({ kind: "done", value: false }),
      });
      dispatch(game, rules, "slash-result", {
        effect: slashEffect,
        jink:
          reference === null
            ? null
            : {
                reference,
                card: { ...effect().card, name: "jink", className: "Jink" },
              },
      });
      expect(game.observed).toMatchObject([
        {
          name: reference === null ? "SlashHit" : "SlashMissed",
          target: "a",
          data: {
            to: "b",
            jink: reference === null ? null : { reference: "jink" },
          },
        },
      ]);
      expect(game.cardResources!.playerTags.b.Qinggang).toEqual(
        reference === null
          ? ["slash-key", "slash-key", "other"]
          : ["slash-key", "other"],
      );
    },
  );
  it("takes exactly one source Jink requirement and constructs the Slash effect before Room dispatch", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(scheduler.operationCompletion?.value).toBeNull();
    expect(game.cardResources!.playerTags.a["Jink_slash-key"]).toEqual([1]);
    expect(game.observed).toMatchObject([
      {
        from: "a",
        to: "b",
        jink_num: 2,
        drank: 2,
        nature: "fire",
        nullified: false,
        jink: null,
        slash: { reference: "slash", card: { name: "slash" } },
      },
    ]);
  });
});
