import { describe, expect, it } from "vitest";
import {
  createSkillCardOnUseOperation,
  createSkillCardExtraCostOperation,
  type SkillCardUse,
  type SkillCardOnUseRules,
} from "../../src/game/hegemony/skill-card-on-use";
import type { GeneralGame } from "../../src/game/hegemony/general-identity";
import {
  createRewardTokenCostOperation,
  createRewardTokenUseOperation,
} from "../../src/game/hegemony/reward-tokens";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  type TriggerRegistry,
  type TriggerData,
  getTriggerPrompt,
  resumeTriggerPrompt,
} from "../../src/game/hegemony/scheduler";

type Game = GeneralGame & { seen: string[]; details: TriggerData[] };
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    playerFlags: { a: [], b: [], c: [] },
    livingPlayers: ["a", "b", "c"],
    currentPlayer: "a",
    seats: { a: 1, b: 2, c: 3 },
    hp: { a: 3, b: 3, c: 3 },
    maxHp: { a: 4, b: 4, c: 4 },
    removed: { a: false, b: false, c: false },
    chained: { a: false, b: false, c: false },
    damageStack: [],
    playerMarks: { a: {}, b: {}, c: {} },
    currentdying: { a: "", b: "", c: "" },
    playerHistory: { a: {}, b: {}, c: {} },
    acquiredSkills: {
      a: { head: [], deputy: [] },
      b: { head: [], deputy: [] },
      c: { head: [], deputy: [] },
    },
    scenarioRoleShown: { a: false, b: false, c: false },
    identities: Object.fromEntries(
      ["a", "b", "c"].map((p) => [
        p,
        {
          head: `${p}-head`,
          deputy: `${p}-deputy`,
          headKingdom: "wei",
          kingdom: "wei",
          role: "lord",
          headShown: false,
          deputyShown: false,
          lord: false,
          generalLord: false,
          actualHeadLord: false,
        },
      ]),
    ),
    generalNames: {
      a: ["secret-a-head", "secret-a-deputy"],
      b: ["secret-b-head", "secret-b-deputy"],
      c: ["secret-c-head", "secret-c-deputy"],
    },
    displayedGenerals: {
      a: { head: "anjiang", deputy: "anjiang" },
      b: { head: "anjiang", deputy: "anjiang" },
      c: { head: "anjiang", deputy: "anjiang" },
    },
    generalCatalog: {},
    cardZones: {
      a: { place: "hand", owner: "a", cards: [1, 2] },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
      draw: { place: "draw", owner: null, cards: [3, 4, 5] },
    },
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    seen: [],
    details: [],
  };
}
function useData(): SkillCardUse {
  return {
    from: "a",
    to: ["c", "b"],
    card: {
      type: "skill",
      name: "halfmaxhp_card",
      className: "HalfMaxHpCard",
      skillName: "halfmaxhp",
      materialIDs: [],
      flags: [],
      skillPosition: "",
      showSkill: "",
      willThrow: true,
    },
  };
}
function registry(
  overrides: Partial<SkillCardOnUseRules<Game>> = {},
): TriggerRegistry<Game> {
  return {
    version: "skill-on-use-ce4e62b",
    operations: [
      createSkillCardOnUseOperation({
        tableZone: "table",
        discardZone: "discard",
        extraCost: (use) => ({ name: "cost", data: use }),
        showSkill: (request) => ({ name: "show", data: request }),
        afterShow: (request) => ({ name: "after-show", data: request }),
        notifyUse: (request) => ({ name: "log", data: request }),
        generalName: () => "private-general",
        cardState: (_game, card) => ({
          flags: card.flags,
          materialIDs: card.materialIDs,
        }),
        ...overrides,
      }),
      createCardMovementOperation(),
      ...["cost", "show", "after-show", "log"].map((name) => ({
        name,
        run: ({
          game,
          operation,
        }: {
          game: Game;
          operation: { data: TriggerData };
        }) => {
          game.seen.push(name);
          game.details.push({
            name,
            data: structuredClone(operation.data),
            flags: structuredClone(game.playerFlags),
            tags: structuredClone(game.cardResources!.roomTags),
          });
          return { kind: "return" as const, value: null };
        },
      })),
    ],
    skills: [
      {
        id: "observe",
        rule: true,
        priority: 0,
        events: ["PreCardUsed", "TargetSelected", "CardUsed", "CardFinished"],
        effect: ({ game, event }) => {
          game.seen.push(event.name);
          game.details.push({
            name: event.name,
            data: structuredClone(event.data),
            flags: structuredClone(game.playerFlags),
            tags: structuredClone(game.cardResources!.roomTags),
            table: [...game.cardZones.table.cards],
          });
          return { kind: "done", value: false };
        },
      },
    ],
  };
}
function dispatch(game: Game, rules = registry(), data = useData()) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  expect(
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "skill-card-on-use", data },
      "b",
    ),
  ).toBe(true);
  return scheduler;
}

describe("Hegemony isolated SkillCard onUse", () => {
  it("keeps extraCost and reveal inside the native event envelope", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(scheduler.frames).toEqual([]);
    expect(game.seen).toEqual([
      "log",
      "PreCardUsed",
      "cost",
      "show",
      "after-show",
      "TargetSelected",
      "CardUsed",
      "CardFinished",
    ]);
  });

  it("sorts initial targets, tracks the original position and brackets cost/reveal flags", () => {
    const game = fixture();
    const data = useData();
    data.card.skillPosition = "left";
    dispatch(game, registry(), data);
    expect(game.details[1]).toMatchObject({
      name: "PreCardUsed",
      data: { to: ["b", "c"] },
      tags: { halfmaxhpa: ["left"] },
      flags: { a: [] },
    });
    expect(game.details[2]).toMatchObject({
      name: "cost",
      flags: { a: ["HuanshenSkillChecking"] },
    });
    expect(game.details[3]).toMatchObject({
      name: "show",
      flags: { a: ["HuanshenSkillChecking"] },
    });
    expect(game.details[4]).toMatchObject({
      name: "after-show",
      flags: { a: [] },
    });
    expect(game.cardResources!.roomTags.halfmaxhpa).toEqual([]);
  });

  it("keeps after-Pre cost/reveal and cleanup separate from later shared rewrites", () => {
    const game = fixture();
    game.cardResources!.roomTags.othera = ["right"];
    const data = useData();
    data.card.materialIDs = [1];
    data.card.skillPosition = "left";
    const rules = registry({
      extraCost: () => ({
        name: "move-cards",
        data: { moves: [{ ids: [1], to: "table", open: true, reason: {} }] },
      }),
    });
    rules.skills.push({
      id: "rewrite",
      rule: true,
      priority: 1,
      events: ["PreCardUsed", "CardFinished"],
      effect: ({ event }) => {
        event.data =
          event.name === "PreCardUsed"
            ? {
                ...data,
                from: "b",
                to: ["c"],
                card: {
                  ...data.card,
                  skillName: "other",
                  skillPosition: "right",
                  showSkill: "reveal-other",
                },
              }
            : {
                ...data,
                from: "c",
                to: ["b"],
                card: { ...data.card, materialIDs: [2], skillPosition: "" },
              };
        return { kind: "done", value: false };
      },
    });
    const scheduler = dispatch(game, rules, data);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.a.cards).toEqual([2]);
    expect(
      game.details.find(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          !Array.isArray(entry) &&
          entry.name === "show",
      ),
    ).toMatchObject({
      data: { player: "a", skill: "reveal-other", position: "right" },
      flags: { a: [], b: ["HuanshenSkillChecking"] },
    });
    expect(game.cardResources!.roomTags).toMatchObject({
      halfmaxhpa: ["left"],
      othera: [],
    });
    expect(scheduler.operationCompletion!.value).toMatchObject({
      data: { from: "c", to: ["b"] },
    });
  });

  it("uses original captured materials for a post-Pre non-Skill card instead of charging extraCost", () => {
    const game = fixture();
    const data = useData();
    data.card.materialIDs = [1];
    const rules = registry();
    rules.skills.push({
      id: "change-card",
      priority: 1,
      rule: true,
      events: ["PreCardUsed"],
      effect: ({ event }) => {
        event.data = {
          ...data,
          card: {
            ...data.card,
            type: "basic",
            name: "peach",
            className: "Peach",
            materialIDs: [2],
          },
        };
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules, data);
    expect(game.seen).not.toContain("cost");
    expect(game.details).toContainEqual(
      expect.objectContaining({ name: "TargetSelected", table: [1] }),
    );
    expect(game.cardZones.a.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });

  it("reads the original card's current flag when deciding TargetSelected", () => {
    const game = fixture();
    const rules = registry({
      cardState: (current, card) => ({
        materialIDs: card.materialIDs,
        flags: current.seen.includes("show") ? ["slashDisableExtraTarget"] : [],
      }),
    });
    dispatch(game, rules);
    expect(game.seen).not.toContain("TargetSelected");
    expect(game.seen).toContain("CardUsed");
  });

  it.each([true, false])(
    "default extraCost discards physical materials only when willThrow=%s",
    (willThrow) => {
      const game = fixture();
      const data = useData();
      data.card.materialIDs = [1];
      data.card.willThrow = willThrow;
      const rules = registry({
        extraCost: (use) => ({ name: "skill-card-extra-cost", data: use }),
      });
      rules.operations!.push(
        createSkillCardExtraCostOperation({
          discardZone: "discard",
          generalName: () => "private-general",
        }),
      );
      dispatch(game, rules, data);
      expect(game.cardZones.discard.cards).toEqual(willThrow ? [1] : []);
      expect(game.cardZones.a.cards).toEqual(willThrow ? [2] : [1, 2]);
      expect(game.details).toContainEqual(
        expect.objectContaining({ name: "CardUsed", table: [] }),
      );
    },
  );

  it.each([
    ["unknown source", { ...useData(), from: "outside" }],
    ["duplicate targets", { ...useData(), to: ["b", "b"] }],
    [
      "non-Skill entry",
      { ...useData(), card: { ...useData().card, type: "basic" } },
    ],
    [
      "bad material",
      { ...useData(), card: { ...useData().card, materialIDs: [-1] } },
    ],
    [
      "duplicate materials",
      { ...useData(), card: { ...useData().card, materialIDs: [1, 1] } },
    ],
    [
      "missing material",
      { ...useData(), card: { ...useData().card, materialIDs: [99] } },
    ],
    [
      "invalid cost flag",
      { ...useData(), card: { ...useData().card, willThrow: null } },
    ],
    [
      "invalid position",
      { ...useData(), card: { ...useData().card, skillPosition: 3 } },
    ],
    [
      "invalid flag",
      { ...useData(), card: { ...useData().card, flags: [false] } },
    ],
    ["null", null],
  ])("rejects %s before any envelope side effect", (_label, data) => {
    const game = fixture();
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = JSON.stringify({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "skill-card-on-use", data },
        "a",
      ),
    ).toThrow();
    expect(JSON.stringify({ game, scheduler })).toBe(before);
  });

  it.each(["halfmaxhp", "companion", "firstshow", "careerman"])(
    "composes the actual %s token cost without using the default discard cost",
    (token) => {
      const game = fixture();
      const mark = token === "careerman" ? "@careerist" : `@${token}`;
      game.playerMarks.a[mark] = 1;
      const data = useData();
      data.card.skillName = token;
      const rules = registry({
        extraCost: (use) => ({
          name: "reward-token-cost",
          data: { player: use.from, token: use.card.skillName },
        }),
      });
      rules.operations!.push(createRewardTokenCostOperation());
      dispatch(game, rules, data);
      expect(game.playerMarks.a[mark]).toBe(0);
      expect(game.cardZones.a.cards).toEqual([1, 2]);
      expect(game.cardZones.discard.cards).toEqual([]);
    },
  );

  it("reaches actual HalfMaxHp use and movement through a named fixture CardUsed adapter", () => {
    const game = fixture();
    game.playerMarks.a["@halfmaxhp"] = 1;
    const rules = registry({
      extraCost: (use) => ({
        name: "reward-token-cost",
        data: { player: use.from, token: "halfmaxhp" },
      }),
    });
    const unavailable = () => {
      throw new Error("Unexercised reward adapter");
    };
    rules.operations!.push(
      createRewardTokenCostOperation(),
      createRewardTokenUseOperation({
        draw: (player, count, reason) => ({
          name: "draw-fixture",
          data: { player, count, reason },
        }),
        peachAvailable: () => false,
        peachLocked: () => false,
        peachProhibited: () => false,
        usePeach: unavailable,
        choice: unavailable,
        choosePlayer: unavailable,
        indicate: unavailable,
        publicView: unavailable,
        privateView: unavailable,
      }),
      {
        name: "draw-fixture",
        run: ({ game, operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          const data = record(operation.data);
          if (typeof data.count !== "number" || typeof data.player !== "string")
            throw new Error("Invalid draw fixture");
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: {
                moves: [
                  {
                    ids: game.cardZones.draw.cards.slice(0, data.count),
                    to: data.player,
                    open: false,
                    reason: { kind: "draw", skill: data.reason },
                  },
                ],
              },
            },
            continuation: true,
          };
        },
      },
    );
    rules.skills.push({
      id: "fixture-token-use",
      rule: true,
      priority: -1,
      events: ["CardUsed"],
      effect: ({ event, operationChild }) => {
        if (operationChild) return { kind: "done", value: false };
        const use = record(event.data);
        return {
          kind: "operation",
          operation: {
            name: "reward-token-use",
            data: { player: use.from, token: "halfmaxhp", targets: use.to },
          },
          continuation: null,
        };
      },
    });
    const scheduler = dispatch(game, rules);
    expect(game.playerMarks.a["@halfmaxhp"]).toBe(0);
    expect(game.cardZones.a.cards).toEqual([1, 2, 3]);
    expect(game.cardZones.draw.cards).toEqual([4, 5]);
    expect(scheduler.frames).toEqual([]);
    expect(JSON.stringify(scheduler.operationCompletion)).not.toContain(
      "secret-",
    );
  });

  it.each(["log", "cost", "show", "after-show"])(
    "reloads during %s without repeating a completed boundary",
    (name) => {
      let game = fixture();
      const rules = registry();
      const operation = rules.operations!.find((entry) => entry.name === name)!;
      const run = operation.run;
      operation.run = (context) =>
        context.continuation === null
          ? {
              kind: "prompt",
              actor: "a",
              choices: ["proceed"],
              canCancel: false,
              continuation: true,
            }
          : run({ ...context, continuation: null });
      let scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "a")!;
      expect(getTriggerPrompt(scheduler, "b")).toBeNull();
      expect(JSON.stringify(prompt)).not.toContain("secret-");
      const answer = { id: prompt.id, choice: prompt.choices[0].id };
      const before = JSON.stringify({ game, scheduler });
      expect(resumeTriggerPrompt(scheduler, game, rules, "b", answer)).toBe(
        false,
      );
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          ...answer,
          id: "stale",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          ...answer,
          choice: "invalid",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          ...answer,
          choice: null,
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(
          scheduler,
          game,
          { ...rules, version: "wrong" },
          "a",
          answer,
        ),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(before);
      game = JSON.parse(JSON.stringify(game));
      scheduler = JSON.parse(JSON.stringify(scheduler));
      expect(resumeTriggerPrompt(scheduler, game, rules, "a", answer)).toBe(
        true,
      );
      expect(scheduler.frames).toEqual([]);
      expect(game.seen.filter((entry) => entry === name)).toHaveLength(1);
      const completed = JSON.stringify({ game, scheduler });
      expect(resumeTriggerPrompt(scheduler, game, rules, "a", answer)).toBe(
        false,
      );
      expect(JSON.stringify({ game, scheduler })).toBe(completed);
    },
  );

  it.each(["PreCardUsed", "TargetSelected", "CardUsed", "CardFinished"])(
    "reloads a nested %s event and still pays only once",
    (eventName) => {
      let game = fixture();
      game.playerMarks.a["@halfmaxhp"] = 2;
      const rules = registry({
        extraCost: (use) => ({
          name: "reward-token-cost",
          data: { player: use.from, token: "halfmaxhp" },
        }),
      });
      rules.operations!.push(createRewardTokenCostOperation());
      rules.skills.push({
        id: "pause-event",
        rule: true,
        priority: 2,
        events: [eventName],
        effect: ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "a",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "done", value: false },
      });
      let scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "a")!;
      game = JSON.parse(JSON.stringify(game));
      scheduler = JSON.parse(JSON.stringify(scheduler));
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: prompt.choices[0].id,
        }),
      ).toBe(true);
      expect(game.playerMarks.a["@halfmaxhp"]).toBe(1);
      expect(scheduler.frames).toEqual([]);
    },
  );

  it.each(["PreCardUsed", "TargetSelected", "CardUsed", "CardFinished"])(
    "consuming %s ends that event but not the outer envelope",
    (eventName) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "consume-event",
        rule: true,
        priority: 1,
        events: [eventName],
        effect: () => ({ kind: "done", value: true }),
      });
      const scheduler = dispatch(game, rules);
      expect(game.seen).not.toContain(eventName);
      expect(game.seen).toContain("cost");
      expect(game.seen).toContain("show");
      expect(game.cardZones.a.cards).toEqual([1, 2]);
      expect(scheduler.frames).toEqual([]);
      if (eventName !== "CardFinished")
        expect(game.seen).toContain("CardFinished");
    },
  );

  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "preserves paid cost, flags and position when reveal interrupts with %s",
    (reason) => {
      const game = fixture();
      game.playerMarks.a["@halfmaxhp"] = 1;
      const rules = registry({
        extraCost: (use) => ({
          name: "reward-token-cost",
          data: { player: use.from, token: "halfmaxhp" },
        }),
      });
      rules.operations!.push(createRewardTokenCostOperation());
      rules.operations!.find((op) => op.name === "show")!.run = () => ({
        kind: "interrupt",
        reason,
      });
      const data = useData();
      data.card.skillPosition = "left";
      const scheduler = dispatch(game, rules, data);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.playerMarks.a["@halfmaxhp"]).toBe(0);
      expect(game.playerFlags.a).toEqual(["HuanshenSkillChecking"]);
      expect(game.cardResources!.roomTags.halfmaxhpa).toEqual(["left"]);
      expect(game.seen).not.toContain("CardFinished");
    },
  );

  it("nests a complete onUse before the outer CardUsed and preserves the position stack", () => {
    const game = fixture();
    const rules = registry({
      afterShow: ({ use }) => ({
        name: use.card.name === "nested" ? "after-show" : "nested",
        data: null,
      }),
    });
    rules.operations!.push({
      name: "nested",
      run: ({ continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const use = useData();
        use.card.name = "nested";
        use.card.skillPosition = "left";
        return {
          kind: "operation",
          operation: { name: "skill-card-on-use", data: use },
          continuation: true,
        };
      },
    });
    const use = useData();
    use.card.skillPosition = "left";
    const scheduler = dispatch(game, rules, use);
    expect(scheduler.frames).toEqual([]);
    expect(game.seen.filter((entry) => entry === "cost")).toHaveLength(2);
    expect(game.cardResources!.roomTags.halfmaxhpa).toEqual([]);
    expect(
      game.details
        .filter((entry) => record(entry).name === "CardUsed")
        .map((entry) => record(record(record(entry).data).card).name),
    ).toEqual(["nested", "halfmaxhp_card"]);
  });

  it("leaves materials claimed during CardFinished out of fallback discard", () => {
    const game = fixture();
    game.cardZones.a.cards = [2];
    game.cardZones.table.cards = [1];
    const use = useData();
    use.card.materialIDs = [1];
    const rules = registry();
    rules.skills.push({
      id: "claim",
      rule: true,
      priority: 1,
      events: ["CardFinished"],
      effect: ({ operationChild }) =>
        operationChild
          ? { kind: "done", value: false }
          : {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  moves: [{ ids: [1], to: "a", open: false, reason: {} }],
                },
              },
              continuation: null,
            },
    });
    dispatch(game, rules, use);
    expect(game.cardZones.a.cards).toEqual([2, 1]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });

  it("uses the original card's current materials when falling back after CardFinished", () => {
    const game = fixture();
    game.cardZones.a.cards = [];
    game.cardZones.table.cards = [1, 2];
    const use = useData();
    use.card.materialIDs = [1];
    const rules = registry({
      cardState: (current, card) => ({
        flags: card.flags,
        materialIDs: current.seen.includes("CardFinished")
          ? [2]
          : card.materialIDs,
      }),
    });
    dispatch(game, rules, use);
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
  });

  it("does not let void child return values replace shared use data", () => {
    const game = fixture();
    const rules = registry();
    for (const name of ["cost", "show", "after-show", "log"]) {
      rules.operations!.find((op) => op.name === name)!.run = () => ({
        kind: "return",
        value: { data: { ...useData(), from: "c" } },
      });
    }
    const scheduler = dispatch(game, rules);
    expect(scheduler.operationCompletion!.value).toMatchObject({
      data: { from: "a", to: ["b", "c"] },
    });
  });

  it("rejects malformed post-Pre event data before cost, retaining the earlier log", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "bad-rewrite",
      priority: 1,
      rule: true,
      events: ["PreCardUsed"],
      effect: ({ event }) => {
        event.data = { ...useData(), from: "outside" };
        return { kind: "done", value: false };
      },
    });
    expect(() => dispatch(game, rules)).toThrow("Invalid SkillCard use");
    expect(game.seen).toContain("log");
    expect(game.seen).not.toContain("cost");
  });

  it("rejects a malformed late card-state adapter without rolling back a paid token", () => {
    const game = fixture();
    game.playerMarks.a["@halfmaxhp"] = 1;
    const rules = registry({
      extraCost: (use) => ({
        name: "reward-token-cost",
        data: { player: use.from, token: "halfmaxhp" },
      }),
      cardState: (current, card) => ({
        flags: card.flags,
        materialIDs: current.seen.includes("CardFinished")
          ? [NaN]
          : card.materialIDs,
      }),
    });
    rules.operations!.push(createRewardTokenCostOperation());
    expect(() => dispatch(game, rules)).toThrow("Invalid SkillCard state");
    expect(game.playerMarks.a["@halfmaxhp"]).toBe(0);
    expect(game.seen).toContain("CardFinished");
  });

  it("isolates pure card/metadata callbacks and mutable descriptor arguments", () => {
    const game = fixture();
    const use = useData();
    use.card.skillPosition = "left";
    use.card.materialIDs = [1];
    const rules = registry({
      cardState: (copy, card) => {
        copy.hp.a = -100;
        copy.cardZones.a.cards = [];
        return { flags: card.flags, materialIDs: card.materialIDs };
      },
      notifyUse: ({ use }) => {
        use.from = "c";
        return { name: "log", data: null };
      },
      extraCost: (use) => {
        use.from = "c";
        return { name: "cost", data: null };
      },
    });
    const scheduler = dispatch(game, rules, use);
    expect(game.hp.a).toBe(3);
    expect(game.cardZones.a.cards).toEqual([1, 2]);
    expect(scheduler.operationCompletion!.value).toMatchObject({
      data: { from: "a" },
    });
  });

  it.each(["table", "discard"])(
    "rejects invalid %s destination in preflight",
    (zone) => {
      const game = fixture();
      game.cardZones[zone].owner = "a";
      expect(() => dispatch(game)).toThrow("Invalid SkillCard destination");
      expect(game.seen).toEqual([]);
    },
  );

  it("rejects an unknown action-order actor and duplicate physical storage atomically", () => {
    const game = fixture();
    const rules = registry();
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "skill-card-on-use", data: useData() },
        "outside",
      ),
    ).toBe(false);
    const use = useData();
    use.card.materialIDs = [1];
    game.cardZones.table.cards = [1];
    expect(() => dispatch(game, rules, use)).toThrow(
      "Invalid SkillCard material location",
    );
    expect(scheduler.frames).toEqual([]);
    expect(game.seen).toEqual([]);
  });

  it.each(["cost", "cleanup"])(
    "reloads an actual %s movement before committing exactly once",
    (boundary) => {
      let game = fixture();
      const use = useData();
      use.card.materialIDs = [1];
      use.card.skillPosition = "left";
      if (boundary === "cleanup") {
        game.cardZones.a.cards = [2];
        game.cardZones.table.cards = [1];
      }
      const rules = registry({
        extraCost: (data) =>
          boundary === "cost" ? { name: "skill-card-extra-cost", data } : null,
      });
      rules.operations!.push(
        createSkillCardExtraCostOperation({
          discardZone: "discard",
          generalName: () => "private-general",
        }),
      );
      rules.skills.push({
        id: "pause-move",
        priority: 2,
        rule: true,
        events: ["BeforeCardsMove"],
        effect: ({ continuation, event }) =>
          continuation === null && event.target === "a"
            ? {
                kind: "prompt",
                actor: "a",
                choices: ["finish"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "done", value: false },
      });
      let scheduler = dispatch(game, rules, use);
      const prompt = getTriggerPrompt(scheduler, "a")!;
      expect(game.cardZones.discard.cards).toEqual([]);
      game = JSON.parse(JSON.stringify(game));
      scheduler = JSON.parse(JSON.stringify(scheduler));
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: prompt.choices[0].id,
        }),
      ).toBe(true);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.cardZones.a.cards).toEqual([2]);
      expect(game.cardResources!.roomTags.halfmaxhpa).toEqual([]);
      expect(game.seen.filter((entry) => entry === "show")).toHaveLength(1);
      expect(scheduler.frames).toEqual([]);
      expect(JSON.stringify(scheduler.operationCompletion)).not.toContain(
        "private-general",
      );
    },
  );
});

function record(data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Expected fixture record");
  return data;
}
