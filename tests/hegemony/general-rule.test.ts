import { describe, expect, it } from "vitest";
import { hasShownGeneral } from "../../src/game/hegemony/general-identity";
import {
  createGeneralShownOperation,
  createGeneralShownRule,
  type GeneralShownGame,
} from "../../src/game/hegemony/general-rule";
import {
  createGameOverOperation,
  createGetWinnerOperation,
} from "../../src/game/hegemony/victory";
import {
  createFreeChainOperation,
  type FreeChainGame,
  type FreeChainRules,
} from "../../src/game/hegemony/general-rewards";
import {
  createTriggerScheduler,
  dispatchTriggerEvent,
  dispatchTriggerOperation,
  type TriggerData,
  type TriggerEvent,
  type TriggerRegistry,
  type TriggerSkill,
  getTriggerPrompt,
  resumeTriggerPrompt,
} from "../../src/game/hegemony/scheduler";
import { createKillPlayerOperation } from "../../src/game/hegemony/death";
import {
  createShowGeneralOperation,
  createHideGeneralOperation,
  type GeneralRules,
} from "../../src/game/hegemony/general";
import { createCareeristOperation } from "../../src/game/hegemony/careerist";

type Game = GeneralShownGame & FreeChainGame & { seen: TriggerEvent[] };
function fixture(): Game {
  const players = ["a", "b", "c"];
  return {
    seatOrder: players,
    livingPlayers: [...players],
    seats: { a: 1, b: 2, c: 3 },
    currentPlayer: "c",
    alive: { a: true, b: true, c: true },
    hp: { a: 3, b: 3, c: 3 },
    maxHp: { a: 4, b: 4, c: 4 },
    removed: { a: false, b: false, c: false },
    chained: { a: false, b: false, c: false },
    damageStack: [],
    playerFlags: { a: [], b: [], c: [] },
    playerMarks: { a: {}, b: {}, c: {} },
    currentdying: { a: "", b: "", c: "" },
    playerHistory: { a: {}, b: {}, c: {} },
    acquiredSkills: {
      a: { head: [], deputy: [] },
      b: { head: [], deputy: [] },
      c: { head: [], deputy: [] },
    },
    scenarioRoleShown: { a: false, b: false, c: false },
    rewardFirstShow: true,
    scenarioPresent: false,
    surrenderPlayer: null,
    bianhuaChoice: { a: null, b: null, c: null },
    identities: Object.fromEntries(
      players.map((p) => [
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
    generalNames: Object.fromEntries(
      players.map((p) => [p, [`${p}-head`, `${p}-deputy`]]),
    ),
    displayedGenerals: Object.fromEntries(
      players.map((p) => [p, { head: "anjiang", deputy: "anjiang" }]),
    ),
    generalCatalog: Object.fromEntries(
      ["anjiang", ...players.flatMap((p) => [`${p}-head`, `${p}-deputy`])].map(
        (n) => [
          n,
          {
            kingdom: n === "anjiang" ? "god" : "wei",
            doubleKingdom: false,
            lord: false,
          },
        ],
      ),
    ),
    cardZones: {
      draw: { place: "draw", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    seen: [],
  };
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "general-rule-ce4e62b",
    skills: [createGeneralShownRule()],
    operations: [
      createGeneralShownOperation({
        winner: (target) => ({ name: "fixture-winner", data: target }),
        over: (winner) => ({ name: "game-over", data: winner }),
      }),
      createGameOverOperation(),
      {
        name: "fixture-winner",
        run: ({ game, operation }) => {
          game.seen.push({
            name: "winner",
            target: String(operation.data),
            data: null,
          });
          return {
            kind: "return",
            value: game.cardResources.roomTags.winnerResult ?? null,
          };
        },
      },
    ],
  };
}
function event(
  game: Game,
  rules = registry(),
  name = "GeneralShown",
  target: string | null = "a",
  data: TriggerData = true,
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  expect(
    dispatchTriggerEvent(scheduler, game, rules, { name, target, data }, "c"),
  ).toBe(true);
  return scheduler;
}
function rewardRegistry(
  overrides: Partial<FreeChainRules<Game>> = {},
): TriggerRegistry<Game> {
  const rules = registry();
  const rewards: FreeChainRules<Game> = {
    kill: (target) => ({ name: "kill-player", data: { target, damage: null } }),
    companion: (_game, left, right) =>
      left === "a-head" && right === "a-deputy",
    maxHp: (_game, _name, head) => (head ? 3 : 4),
    ...overrides,
  };
  rules.operations!.push(
    createFreeChainOperation(rewards),
    createKillPlayerOperation(),
  );
  rules.skills.push({
    id: "observe-showed",
    events: ["GeneralShowed"],
    priority: 10,
    record: ({ game, event }) => {
      game.seen.push(structuredClone(event));
    },
    effect: () => ({ kind: "done", value: false }),
  });
  return rules;
}
function operation(
  game: Game,
  rules: TriggerRegistry<Game>,
  name = "free-chain",
  data: TriggerData = null,
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  expect(
    dispatchTriggerOperation(scheduler, game, rules, { name, data }, "c"),
  ).toBe(true);
  return scheduler;
}
function hook(
  rules: TriggerRegistry<Game>,
  name: string,
  effect: TriggerSkill<Game>["effect"],
  priority = 5,
) {
  rules.skills.push({
    id: `hook-${name}`,
    events: [name],
    priority,
    rule: true,
    effect,
  });
}
function ready(game: Game, target = "a") {
  game.identities[target].headShown = game.identities[target].deputyShown =
    true;
  game.displayedGenerals[target] = {
    head: `${target}-head`,
    deputy: `${target}-deputy`,
  };
}
function winnerHook(
  rules: TriggerRegistry<Game>,
  change: (game: Game) => void,
) {
  const handler = rules.operations!.find((op) => op.name === "fixture-winner")!,
    original = handler.run;
  handler.run = (ctx) => {
    change(ctx.game);
    return original(ctx);
  };
}
function lifecycleRegistry(actualWinner = false): TriggerRegistry<Game> {
  const rules = rewardRegistry();
  const adapters: GeneralRules<Game> = {
    canShow: () => true,
    preshow: (target, head, enabled) => ({
      name: "lifecycle-sideeffect",
      data: { target, stage: `preshow:${head}:${enabled}` },
    }),
    change: (target, head, name) => ({
      name: "lifecycle-change",
      data: { target, head, name },
    }),
    skills: (target, head, shown) => ({
      name: "lifecycle-sideeffect",
      data: { target, stage: `skills:${head}:${shown}` },
    }),
    notify: (target, head, shown, sendLog) => ({
      name: "lifecycle-sideeffect",
      data: { target, stage: `notify:${head}:${shown}:${sendLog}` },
    }),
    filter: (target) => ({ name: "lifecycle-filter", data: target }),
  };
  rules.operations!.push(
    createShowGeneralOperation(adapters),
    createHideGeneralOperation(adapters),
    {
      name: "lifecycle-sideeffect",
      run: () => ({ kind: "return", value: null }),
    },
    {
      name: "lifecycle-filter",
      run: ({ game, operation }) => {
        game.seen.push({
          name: "filter",
          target: String(operation.data),
          data: null,
        });
        return { kind: "return", value: null };
      },
    },
    {
      name: "lifecycle-change",
      run: ({ operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const data = operation.data;
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new Error("fixture change");
        return {
          kind: "operation",
          operation: { name: "lifecycle-filter", data: data.target },
          continuation: true,
        };
      },
    },
    createCareeristOperation({
      hasShown: hasShownGeneral,
      showHead: (target) => ({
        name: "show-general",
        data: { target, triggerEvent: false },
      }),
    }),
  );
  if (actualWinner) {
    rules.operations = rules.operations!.map((op) =>
      op.name === "general-shown"
        ? createGeneralShownOperation({
            winner: () => ({ name: "get-winner", data: null }),
            over: (winner) => ({ name: "game-over", data: winner }),
          })
        : op,
    );
    rules.operations.push(
      createGetWinnerOperation({
        hasShown: hasShownGeneral,
        isFriend: (_g, a, b) => a === b,
        willBeFriend: () => false,
        getLord: () => null,
        careerist: () => ({ name: "careerist-rule", data: null }),
        showGeneral: (target, slot) => ({
          name: "show-general",
          data: {
            target,
            head: slot === "head",
            triggerEvent: false,
            sendLog: false,
          },
        }),
      }),
    );
  }
  return rules;
}
function settle(
  game: Game,
  scheduler: ReturnType<typeof createTriggerScheduler>,
  rules: TriggerRegistry<Game>,
  actor: string,
) {
  let pauses = 0;
  while (getTriggerPrompt(scheduler, actor)) {
    const prompt = getTriggerPrompt(scheduler, actor)!,
      before = JSON.stringify({ game, scheduler });
    for (const [who, id, choice] of [
      ["b", prompt.id, "continue"],
      [actor, `${prompt.id}-old`, "continue"],
      [actor, prompt.id, "bad"],
    ]) {
      expect(
        resumeTriggerPrompt(scheduler, game, rules, who, { id, choice }),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    }
    ({ game, scheduler } = JSON.parse(before));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, actor, {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    const after = JSON.stringify({ game, scheduler });
    expect(
      resumeTriggerPrompt(scheduler, game, rules, actor, {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(after);
    if (++pauses > 12) throw new Error("fixture pause loop");
  }
  expect(pauses).toBeGreaterThan(0);
  return { game, scheduler };
}
function pauseOperation(
  rules: TriggerRegistry<Game>,
  name: string,
  actor: string,
) {
  const handler = rules.operations!.find((op) => op.name === name)!,
    original = handler.run;
  handler.run = (ctx) => {
    if (ctx.continuation === null)
      return {
        kind: "prompt",
        actor,
        choices: ["continue"],
        canCancel: false,
        continuation: { resume: true },
      };
    const c = ctx.continuation;
    if (c && typeof c === "object" && !Array.isArray(c) && c.resume === true)
      return original({ ...ctx, continuation: null });
    return original(ctx);
  };
}
describe("GeneralShown native GameRule through public dispatch", () => {
  it("DFDebut consumes SkipGameRule before its empty native branch", () => {
    const game = fixture();
    game.cardResources.roomTags.SkipGameRule = true;
    event(game, registry(), "DFDebut", null, null);
    expect(game.cardResources.roomTags.SkipGameRule).toBeUndefined();
    expect(game.playerMarks.a).toEqual({});
    expect(game.seen).toEqual([]);
  });
  it("checks winner before queuing original head and first-show rewards", () => {
    const game = fixture();
    const scheduler = event(game);
    expect(game.seen).toEqual([{ name: "winner", target: "a", data: null }]);
    expect(game.playerMarks.a).toEqual({
      Global_GeneralShown: 1,
      Global_TheFirstToShowRewarded: 1,
    });
    expect(game.cardResources.roomTags.TheFirstToShowRewarded).toBe(true);
    expect(scheduler.frames).toEqual([]);
  });
});
describe("GeneralShown source branches", () => {
  it.each(["a", ""])(
    "terminal winner %j stops before any reward or slot parsing",
    (winner) => {
      const game = fixture();
      game.cardResources.roomTags.winnerResult = winner;
      const scheduler = event(
        game,
        registry(),
        "GeneralShown",
        "a",
        "malformed-slot",
      );
      expect(scheduler.interruption?.reason).toBe("game-over");
      expect(game.gameResult).toBe(winner);
      expect(game.playerMarks.a).toEqual({});
      expect(
        game.cardResources.roomTags.TheFirstToShowRewarded,
      ).toBeUndefined();
    },
  );
  it("skips winner inside GlobalCareeristShow but still queues reward", () => {
    const game = fixture();
    game.cardResources.roomTags.GlobalCareeristShow = true;
    event(game, registry(), "GeneralShown", "a", false);
    expect(game.seen).toEqual([]);
    expect(game.playerMarks.a).toEqual({
      Global_General2Shown: 1,
      Global_TheFirstToShowRewarded: 1,
    });
  });
  it.each<TriggerData>([true, false, 0, "claimed", {}, null])(
    "only native null first-show tag permits claiming (%j)",
    (tag) => {
      const game = fixture();
      game.cardResources.roomTags.TheFirstToShowRewarded = tag;
      event(game);
      expect(game.playerMarks.a.Global_TheFirstToShowRewarded ?? 0).toBe(
        tag === null ? 1 : 0,
      );
      expect(game.cardResources.roomTags.TheFirstToShowRewarded).toEqual(
        tag === null ? true : tag,
      );
    },
  );
  it("awards first-show ownership only once across distinct players", () => {
    const game = fixture();
    event(game);
    event(game, registry(), "GeneralShown", "b", false);
    expect(game.playerMarks.a.Global_TheFirstToShowRewarded).toBe(1);
    expect(game.playerMarks.b).toEqual({ Global_General2Shown: 1 });
  });
  it.each<[boolean, boolean]>([
    [false, false],
    [true, true],
  ])("disables first-show for reward=%s/scenario=%s", (reward, scenario) => {
    const game = fixture();
    game.rewardFirstShow = reward;
    game.scenarioPresent = scenario;
    event(game);
    expect(game.playerMarks.a).toEqual({ Global_GeneralShown: 1 });
  });
  it("reads current reward configuration after winner child and does not recheck alive", () => {
    const game = fixture(),
      rules = registry();
    winnerHook(rules, (g) => {
      g.rewardFirstShow = false;
      g.alive.a = false;
    });
    event(game, rules);
    expect(game.playerMarks.a).toEqual({ Global_GeneralShown: 1 });
    expect(game.alive.a).toBe(false);
  });
  it("normalizes null shown slot to deputy", () => {
    const game = fixture();
    event(game, registry(), "GeneralShown", "a", null);
    expect(game.playerMarks.a.Global_General2Shown).toBe(1);
  });
  it("uses higher-priority event rewrite at GameRule entry", () => {
    const game = fixture(),
      rules = registry();
    hook(rules, "GeneralShown", ({ event }) => {
      event.data = false;
      return { kind: "done", value: false };
    });
    event(game, rules);
    expect(game.playerMarks.a.Global_General2Shown).toBe(1);
    expect(game.playerMarks.a.Global_GeneralShown).toBeUndefined();
  });
  it("SkipGameRule clears before null-target handling and bypasses malformed slot", () => {
    const game = fixture();
    game.cardResources.roomTags.SkipGameRule = true;
    event(game, registry(), "GeneralShown", null, "bad");
    expect(game.cardResources.roomTags.SkipGameRule).toBeUndefined();
    expect(game.seen).toEqual([]);
  });
  it("GeneralHidden does not register GameRule or consume its skip tag", () => {
    const game = fixture();
    game.cardResources.roomTags.SkipGameRule = true;
    event(game, registry(), "GeneralHidden");
    expect(game.cardResources.roomTags.SkipGameRule).toBe(true);
    expect(game.playerMarks.a).toEqual({});
  });
  it("DFDebut never evaluates winner, config or malformed marks", () => {
    const game = fixture();
    game.rewardFirstShow = null as unknown as boolean;
    game.playerMarks.a = null as unknown as Record<string, number>;
    event(game, registry(), "DFDebut", "a", "opaque");
    expect(game.seen).toEqual([]);
  });
  it("normal over adapter returns true and consumes later rule effects", () => {
    const game = fixture(),
      rules = registry();
    game.cardResources.roomTags.winnerResult = "a";
    rules.operations = rules.operations!.map((op) =>
      op.name === "game-over"
        ? {
            name: "game-over",
            run: ({ game, operation }) => {
              game.gameResult = String(operation.data);
              return { kind: "return", value: null };
            },
          }
        : op,
    );
    hook(
      rules,
      "GeneralShown",
      () => {
        throw new Error("late rule must be consumed");
      },
      -1,
    );
    const scheduler = event(game, rules);
    expect(scheduler.completion?.consumed).toBe(true);
    expect(game.playerMarks.a).toEqual({});
  });
});
describe("deferred reveal reward drain through public operation dispatch", () => {
  it("coalesces queued slots and grants source companion/half-HP/first-show tokens", () => {
    const game = fixture();
    game.identities.a.headShown = game.identities.a.deputyShown = true;
    game.displayedGenerals.a = { head: "a-head", deputy: "a-deputy" };
    game.playerMarks.a = {
      Global_GeneralShown: 3,
      Global_General2Shown: 2,
      HaventShowGeneral: 1,
      HaventShowGeneral2: 1,
      Global_TheFirstToShowRewarded: 1,
    };
    const scheduler = operation(game, rewardRegistry());
    expect(game.seen).toEqual([
      { name: "GeneralShowed", target: "a", data: ["head", "deputy"] },
    ]);
    expect(game.playerMarks.a).toEqual({
      Global_GeneralShown: 0,
      Global_General2Shown: 0,
      Global_hasShownAllGenerals: 1,
      HaventShowGeneral: 0,
      HaventShowGeneral2: 0,
      Global_TheFirstToShowRewarded: 0,
      "@companion": 1,
      "@halfmaxhp": 1,
      "@firstshow": 1,
    });
    expect(scheduler.frames).toEqual([]);
  });
});
describe("reveal rule integration with actual engine operations", () => {
  it("actual head and deputy show enqueue rewards that only free-chain converts", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    game.playerMarks.a = { HaventShowGeneral: 1, HaventShowGeneral2: 1 };
    operation(game, rules, "show-general", { target: "a" });
    operation(game, rules, "show-general", { target: "a", head: false });
    expect(game.playerMarks.a["@firstshow"]).toBeUndefined();
    expect(game.playerMarks.a.Global_GeneralShown).toBe(1);
    expect(game.playerMarks.a.Global_General2Shown).toBe(1);
    operation(game, rules);
    expect(game.playerMarks.a["@firstshow"]).toBe(1);
    expect(game.playerMarks.a["@companion"]).toBe(1);
    expect(game.playerMarks.a["@halfmaxhp"]).toBe(1);
    expect(game.seen.filter((e) => e.name === "GeneralShowed")).toEqual([
      { name: "GeneralShowed", target: "a", data: ["head", "deputy"] },
    ]);
  });
  it("actual DFDebut reveal does not enqueue GeneralShowed or rewards", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    operation(game, rules, "show-general", {
      target: "a",
      triggerEvent: false,
    });
    operation(game, rules);
    expect(game.identities.a.headShown).toBe(true);
    expect(game.playerMarks.a).toEqual({});
    expect(
      game.seen.some((e) => e.name === "GeneralShowed" || e.name === "winner"),
    ).toBe(false);
  });
  it("actual conceal preserves pending reveal but rewards use current hidden head", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    game.playerMarks.a.HaventShowGeneral = 1;
    operation(game, rules, "show-general", { target: "a" });
    operation(game, rules, "hide-general", { target: "a" });
    operation(game, rules);
    expect(game.identities.a.headShown).toBe(false);
    expect(game.playerMarks.a.HaventShowGeneral).toBe(0);
    expect(game.playerMarks.a["@firstshow"]).toBe(1);
    expect(game.playerMarks.a["@careerist"]).toBeUndefined();
    expect(game.playerMarks.a.Global_hasShownAllGenerals).toBeUndefined();
  });
  it("actual sole-survivor winner reveals deputy with DFDebut before terminal interrupts root", () => {
    const game = fixture(),
      rules = lifecycleRegistry(true);
    game.alive.b = game.alive.c = false;
    game.livingPlayers = ["a"];
    const scheduler = operation(game, rules, "show-general", { target: "a" });
    expect(game.identities.a).toMatchObject({
      headShown: true,
      deputyShown: true,
    });
    expect(game.gameResult).toBe("a");
    expect(scheduler.interruption?.reason).toBe("game-over");
    expect(game.playerMarks.a).toEqual({});
    expect(game.cardResources.roomTags.TheFirstToShowRewarded).toBeUndefined();
    expect(game.seen.filter((e) => e.name === "filter")).toHaveLength(3);
  });
});
describe("reveal rule serialized continuation and malformed boundaries", () => {
  it("round-trips a winner child and rejects wrong/stale/invalid/replayed replies", () => {
    const game = fixture(),
      rules = registry();
    pauseOperation(rules, "fixture-winner", "c");
    const scheduler = event(game, rules);
    expect(game.playerMarks.a).toEqual({});
    const restored = settle(game, scheduler, rules, "c");
    expect(restored.game.playerMarks.a).toEqual({
      Global_GeneralShown: 1,
      Global_TheFirstToShowRewarded: 1,
    });
    expect(restored.scheduler.frames).toEqual([]);
  });
  it("round-trips GeneralShowed after eager clearing and awards tokens exactly once", () => {
    const game = fixture(),
      rules = rewardRegistry();
    ready(game);
    game.playerMarks.a = {
      Global_GeneralShown: 2,
      Global_General2Shown: 1,
      Global_TheFirstToShowRewarded: 1,
    };
    hook(rules, "GeneralShowed", ({ continuation }) =>
      continuation === null
        ? {
            kind: "prompt",
            actor: "c",
            choices: ["continue"],
            canCancel: false,
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    const scheduler = operation(game, rules);
    expect(game.playerMarks.a.Global_GeneralShown).toBe(0);
    expect(game.playerMarks.a["@companion"]).toBeUndefined();
    const restored = settle(game, scheduler, rules, "c");
    expect(restored.game.playerMarks.a["@companion"]).toBe(1);
    expect(restored.game.playerMarks.a["@halfmaxhp"]).toBe(1);
    expect(restored.game.playerMarks.a["@firstshow"]).toBe(1);
    expect(restored.scheduler.frames).toEqual([]);
  });
  it("round-trips actual surrender death before free-chain reads pending queue", () => {
    const game = fixture(),
      rules = rewardRegistry();
    game.surrenderPlayer = "a";
    game.playerMarks.a.Global_GeneralShown = 1;
    hook(rules, "BeforeGameOverJudge", ({ continuation }) =>
      continuation === null
        ? {
            kind: "prompt",
            actor: "c",
            choices: ["continue"],
            canCancel: false,
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    const scheduler = operation(game, rules);
    expect(game.alive.a).toBe(false);
    expect(game.playerMarks.a.Global_GeneralShown).toBe(1);
    const restored = settle(game, scheduler, rules, "c");
    expect(restored.game.playerMarks.a.Global_GeneralShown).toBe(0);
    expect(restored.game.alive.a).toBe(false);
    expect(restored.scheduler.frames).toEqual([]);
  });
  it("round-trips DFDebut inside real winner reveal before terminal interrupts", () => {
    const game = fixture(),
      rules = lifecycleRegistry(true);
    game.alive.b = game.alive.c = false;
    game.livingPlayers = ["a"];
    hook(rules, "DFDebut", ({ continuation }) =>
      continuation === null
        ? {
            kind: "prompt",
            actor: "a",
            choices: ["continue"],
            canCancel: false,
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    const restored = settle(
      game,
      operation(game, rules, "show-general", { target: "a" }),
      rules,
      "a",
    );
    expect(restored.game.gameResult).toBe("a");
    expect(restored.scheduler.interruption?.reason).toBe("game-over");
    expect(restored.game.playerMarks.a).toEqual({});
  });
  it("interrupted winner retains prior child effects but never enqueues reward", () => {
    const game = fixture(),
      rules = registry();
    rules.operations!.find((op) => op.name === "fixture-winner")!.run = ({
      game,
    }) => {
      game.hp.a = 1;
      return { kind: "interrupt", reason: "turn-broken" };
    };
    const scheduler = event(game, rules);
    expect(game.hp.a).toBe(1);
    expect(game.playerMarks.a).toEqual({});
    expect(scheduler.interruption?.reason).toBe("turn-broken");
  });
  it("interrupted GeneralShowed retains clears and later-seat queues without awarding", () => {
    const game = fixture(),
      rules = rewardRegistry();
    ready(game);
    game.playerMarks.a = {
      Global_GeneralShown: 1,
      Global_TheFirstToShowRewarded: 1,
    };
    game.playerMarks.b.Global_GeneralShown = 1;
    hook(rules, "GeneralShowed", () => ({
      kind: "interrupt",
      reason: "stage-change",
    }));
    const scheduler = operation(game, rules);
    expect(game.playerMarks.a.Global_GeneralShown).toBe(0);
    expect(game.playerMarks.a.Global_TheFirstToShowRewarded).toBe(1);
    expect(game.playerMarks.a["@companion"]).toBeUndefined();
    expect(game.playerMarks.b.Global_GeneralShown).toBe(1);
    expect(scheduler.interruption?.reason).toBe("stage-change");
  });
  it.each<TriggerData>([false, 2, {}])(
    "rejects nonstring nonnull winner %j without reward",
    (value) => {
      const game = fixture();
      game.cardResources.roomTags.winnerResult = value;
      expect(() => event(game)).toThrow("Invalid reveal winner result");
      expect(game.playerMarks.a).toEqual({});
    },
  );
  it("rejects malformed shown slot after winner effects", () => {
    const game = fixture();
    expect(() => event(game, registry(), "GeneralShown", "a", {})).toThrow(
      "Invalid shown slot",
    );
    expect(game.seen).toHaveLength(1);
    expect(game.playerMarks.a).toEqual({});
  });
  it("disabled reward avoids unused malformed scenario config", () => {
    const game = fixture();
    game.rewardFirstShow = false;
    game.scenarioPresent = null as unknown as boolean;
    event(game);
    expect(game.playerMarks.a).toEqual({ Global_GeneralShown: 1 });
  });
  it("late malformed reward configuration retains queued head", () => {
    const game = fixture();
    game.rewardFirstShow = null as unknown as boolean;
    expect(() => event(game)).toThrow("Invalid first-show configuration");
    expect(game.playerMarks.a.Global_GeneralShown).toBe(1);
  });
  it("pending first-show overflow retains claimed room tag and prior slot mark", () => {
    const game = fixture();
    game.playerMarks.a.Global_TheFirstToShowRewarded = 2147483647;
    expect(() => event(game)).toThrow();
    expect(game.playerMarks.a.Global_GeneralShown).toBe(1);
    expect(game.cardResources.roomTags.TheFirstToShowRewarded).toBe(true);
    expect(game.playerMarks.a.Global_TheFirstToShowRewarded).toBe(2147483647);
  });
  it("slot-mark overflow rejects before claiming first-show", () => {
    const game = fixture();
    game.playerMarks.a.Global_GeneralShown = 2147483647;
    expect(() => event(game)).toThrow();
    expect(game.playerMarks.a.Global_GeneralShown).toBe(2147483647);
    expect(game.cardResources.roomTags.TheFirstToShowRewarded).toBeUndefined();
  });
  it("malformed deputy queue preserves the earlier eager head clear", () => {
    const game = fixture();
    game.playerMarks.a = { Global_GeneralShown: 1, Global_General2Shown: 0.5 };
    expect(() => operation(game, rewardRegistry())).toThrow();
    expect(game.playerMarks.a.Global_GeneralShown).toBe(0);
    expect(game.playerMarks.a.Global_General2Shown).toBe(0.5);
    expect(game.seen).toEqual([]);
  });
  it("HP sum overflow preserves all-shown and earlier companion mark", () => {
    const game = fixture();
    ready(game);
    game.playerMarks.a.Global_GeneralShown = 1;
    expect(() =>
      operation(game, rewardRegistry({ maxHp: () => 2147483647 })),
    ).toThrow();
    expect(game.playerMarks.a.Global_hasShownAllGenerals).toBe(1);
    expect(game.playerMarks.a["@companion"]).toBe(1);
    expect(game.playerMarks.a["@halfmaxhp"]).toBeUndefined();
  });
  it("rejects malformed companion after committing all-shown guard", () => {
    const game = fixture();
    ready(game);
    game.playerMarks.a.Global_GeneralShown = 1;
    expect(() =>
      operation(
        game,
        rewardRegistry({ companion: () => null as unknown as boolean }),
      ),
    ).toThrow("Invalid companion predicate");
    expect(game.playerMarks.a.Global_hasShownAllGenerals).toBe(1);
  });
  it("rejects malformed Bianhua choice after committing first companion", () => {
    const game = fixture();
    ready(game);
    game.playerMarks.a.Global_GeneralShown = 1;
    game.bianhuaChoice.a = 2 as unknown as string;
    expect(() => operation(game, rewardRegistry())).toThrow(
      "Invalid bianhua choice",
    );
    expect(game.playerMarks.a["@companion"]).toBe(1);
  });
  it("rejects malformed Bianhua property table at its reward consuming boundary", () => {
    const game = fixture();
    ready(game);
    game.playerMarks.a.Global_GeneralShown = 1;
    game.bianhuaChoice = [] as unknown as Game["bianhuaChoice"];
    expect(() => operation(game, rewardRegistry())).toThrow(
      "Invalid bianhua properties",
    );
    expect(game.playerMarks.a["@companion"]).toBe(1);
  });
});
describe("extra reward consuming boundaries", () => {
  it("rereads surrender after processing a live queued seat", () => {
    const game = fixture(),
      rules = rewardRegistry();
    game.playerMarks.b.Global_GeneralShown =
      game.playerMarks.c.Global_GeneralShown = 1;
    hook(rules, "GeneralShowed", ({ game, event }) => {
      if (event.target === "b") game.surrenderPlayer = "c";
      return { kind: "done", value: false };
    });
    operation(game, rules);
    expect(game.alive.c).toBe(false);
    expect(game.playerMarks.c.Global_GeneralShown).toBe(0);
    expect(game.seen.map((e) => e.target)).toEqual(["b"]);
  });
  it("uses current displayed head and intrinsic HP after GeneralShowed effects", () => {
    const game = fixture(),
      rules = rewardRegistry({
        maxHp: (_g, name, head) => (head ? (name === "b-head" ? 4 : 3) : 4),
      });
    ready(game);
    game.playerMarks.a = { Global_GeneralShown: 1, HaventShowGeneral: 1 };
    hook(rules, "GeneralShowed", ({ game }) => {
      game.displayedGenerals.a.head = "b-head";
      game.generalCatalog["b-head"].kingdom = "careerist";
      return { kind: "done", value: false };
    });
    operation(game, rules);
    expect(game.playerMarks.a["@careerist"]).toBe(1);
    expect(game.playerMarks.a["@companion"]).toBeUndefined();
    expect(game.playerMarks.a["@halfmaxhp"]).toBeUndefined();
  });
  it("negative queues do not clear or evaluate unused alive/identity state", () => {
    const game = fixture();
    game.playerMarks.a = { Global_GeneralShown: -1, Global_General2Shown: -2 };
    game.alive.a = null as unknown as boolean;
    operation(game, rewardRegistry());
    expect(game.playerMarks.a).toEqual({
      Global_GeneralShown: -1,
      Global_General2Shown: -2,
    });
    expect(game.seen).toEqual([]);
  });
  it("rejects unknown surrender recipient before queue mutation", () => {
    const game = fixture();
    game.surrenderPlayer = "ghost";
    game.playerMarks.a.Global_GeneralShown = 1;
    const before = structuredClone(game);
    expect(() => operation(game, rewardRegistry())).toThrow();
    expect(game).toEqual(before);
  });
  it.each([null, 0.5, 2147483648])(
    "invalid intrinsic HP %j retains earlier paired effects",
    (value) => {
      const game = fixture();
      ready(game);
      game.playerMarks.a.Global_GeneralShown = 1;
      expect(() =>
        operation(game, rewardRegistry({ maxHp: () => value as number })),
      ).toThrow();
      expect(game.playerMarks.a.Global_hasShownAllGenerals).toBe(1);
      expect(game.playerMarks.a["@companion"]).toBe(1);
    },
  );
});
describe("native deferred reward ordering and current state", () => {
  it("uses raw registration rather than current action order", () => {
    const game = fixture();
    for (const p of game.seatOrder) game.playerMarks[p].Global_GeneralShown = 1;
    operation(game, rewardRegistry());
    expect(game.seen.map((e) => e.target)).toEqual(["a", "b", "c"]);
  });
  it("clears dead queues without GeneralShowed or token grants", () => {
    const game = fixture();
    game.alive.a = false;
    game.playerMarks.a = {
      Global_GeneralShown: 2,
      Global_General2Shown: 1,
      Global_TheFirstToShowRewarded: 1,
    };
    operation(game, rewardRegistry());
    expect(game.playerMarks.a).toEqual({
      Global_GeneralShown: 0,
      Global_General2Shown: 0,
      Global_TheFirstToShowRewarded: 1,
    });
    expect(game.seen).toEqual([]);
  });
  it("performs actual surrender death before clearing its pending reveals", () => {
    const game = fixture();
    game.surrenderPlayer = "a";
    game.playerMarks.a.Global_GeneralShown = 1;
    game.acquiredSkills.a.head = ["fixture-skill"];
    operation(game, rewardRegistry());
    expect(game.alive.a).toBe(false);
    expect(game.livingPlayers).toEqual(["b", "c"]);
    expect(game.acquiredSkills.a.head).toEqual([]);
    expect(game.playerMarks.a.Global_GeneralShown).toBe(0);
    expect(game.seen).toEqual([]);
  });
  it("awards companion twice through distinct native directional checks", () => {
    const game = fixture();
    ready(game);
    game.bianhuaChoice.a = "other";
    game.playerMarks.a.Global_GeneralShown = 1;
    operation(
      game,
      rewardRegistry({
        companion: (_g, left, right) =>
          (left === "a-head" && right === "a-deputy") ||
          (left === "a-deputy" && right === "other"),
      }),
    );
    expect(game.playerMarks.a["@companion"]).toBe(2);
  });
  it.each<[number, number, number]>([
    [3, 4, 1],
    [4, 4, 0],
    [-3, 0, 0],
    [0, 1, 1],
  ])("intrinsic HP %s+%s produces half token %s", (head, deputy, expected) => {
    const game = fixture();
    ready(game);
    game.maxHp.a = 99;
    game.playerMarks.a.Global_GeneralShown = 1;
    operation(
      game,
      rewardRegistry({ maxHp: (_g, _n, h) => (h ? head : deputy) }),
    );
    expect(game.playerMarks.a["@halfmaxhp"] ?? 0).toBe(expected);
    expect(game.maxHp.a).toBe(99);
  });
  it.each(["head", "deputy", "absent"] as const)(
    "skips paired metadata for %s sujiang/absent deputy",
    (slot) => {
      const game = fixture();
      ready(game);
      game.playerMarks.a.Global_GeneralShown = 1;
      if (slot === "absent") {
        game.displayedGenerals.a.deputy = "";
        game.identities.a.deputyShown = false;
      } else game.displayedGenerals.a[slot] = "custom_sujiang_variant";
      operation(
        game,
        rewardRegistry({
          companion: () => {
            throw new Error("companion must not run");
          },
          maxHp: () => {
            throw new Error("HP must not run");
          },
        }),
      );
      expect(game.playerMarks.a.Global_hasShownAllGenerals).toBe(1);
      expect(game.playerMarks.a["@companion"]).toBeUndefined();
    },
  );
  it.each([1, -1])(
    "nonzero all-shown mark %s blocks paired rewards",
    (mark) => {
      const game = fixture();
      ready(game);
      game.playerMarks.a = {
        Global_GeneralShown: 1,
        Global_hasShownAllGenerals: mark,
      };
      operation(
        game,
        rewardRegistry({
          companion: () => {
            throw new Error("must not run");
          },
        }),
      );
      expect(game.playerMarks.a.Global_hasShownAllGenerals).toBe(mark);
      expect(game.playerMarks.a["@companion"]).toBeUndefined();
    },
  );
  it("new reveal does not grant all-shown tokens again", () => {
    const game = fixture(),
      rules = rewardRegistry();
    ready(game);
    game.playerMarks.a.Global_GeneralShown = 1;
    operation(game, rules);
    game.playerMarks.a.Global_General2Shown = 1;
    operation(game, rules);
    expect(game.playerMarks.a["@companion"]).toBe(1);
    expect(game.playerMarks.a["@halfmaxhp"]).toBe(1);
  });
  it("removes only one Havent/pending-first mark per coalesced reveal", () => {
    const game = fixture();
    ready(game);
    game.generalCatalog["a-head"].kingdom = "careerist";
    game.playerMarks.a = {
      Global_GeneralShown: 4,
      Global_General2Shown: 3,
      HaventShowGeneral: 2,
      HaventShowGeneral2: 2,
      Global_TheFirstToShowRewarded: 2,
    };
    operation(game, rewardRegistry());
    expect(game.playerMarks.a.HaventShowGeneral).toBe(1);
    expect(game.playerMarks.a.HaventShowGeneral2).toBe(1);
    expect(game.playerMarks.a.Global_TheFirstToShowRewarded).toBe(1);
    expect(game.playerMarks.a["@careerist"]).toBe(1);
    expect(game.playerMarks.a["@firstshow"]).toBe(1);
  });
  it("actual death during GeneralShowed skips pair bonus but keeps captured conversions", () => {
    const game = fixture(),
      rules = rewardRegistry();
    ready(game);
    game.generalCatalog["a-head"].kingdom = "careerist";
    game.playerMarks.a = {
      Global_GeneralShown: 1,
      HaventShowGeneral: 1,
      Global_TheFirstToShowRewarded: 1,
    };
    hook(rules, "GeneralShowed", ({ event, continuation }) =>
      continuation === null
        ? {
            kind: "operation",
            operation: {
              name: "kill-player",
              data: { target: event.target, damage: null },
            },
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    operation(game, rules);
    expect(game.alive.a).toBe(false);
    expect(game.playerMarks.a.Global_hasShownAllGenerals).toBeUndefined();
    expect(game.playerMarks.a["@careerist"]).toBe(1);
    expect(game.playerMarks.a["@firstshow"]).toBe(1);
  });
  it("uses captured slots despite consumed/rewritten GeneralShowed", () => {
    const game = fixture(),
      rules = rewardRegistry();
    game.playerMarks.a = {
      Global_GeneralShown: 1,
      HaventShowGeneral: 1,
      HaventShowGeneral2: 1,
    };
    hook(rules, "GeneralShowed", ({ event }) => {
      event.data = ["deputy"];
      return { kind: "done", value: true };
    });
    operation(game, rules);
    expect(game.playerMarks.a.HaventShowGeneral).toBe(0);
    expect(game.playerMarks.a.HaventShowGeneral2).toBe(1);
  });
  it("restarts at registration beginning when a later seat requeues an earlier one", () => {
    const game = fixture(),
      rules = rewardRegistry();
    game.playerMarks.b.Global_GeneralShown =
      game.playerMarks.c.Global_GeneralShown = 1;
    hook(rules, "GeneralShowed", ({ game, event }) => {
      if (event.target === "b") game.playerMarks.a.Global_GeneralShown = 1;
      return { kind: "done", value: false };
    });
    operation(game, rules);
    expect(game.seen.map((e) => e.target)).toEqual(["b", "a", "c"]);
  });
  it("nested drain consumes requeued deputy and later seats before original head finishes", () => {
    const game = fixture(),
      rules = rewardRegistry();
    ready(game);
    game.playerMarks.a = {
      Global_GeneralShown: 1,
      HaventShowGeneral: 1,
      HaventShowGeneral2: 1,
      Global_TheFirstToShowRewarded: 1,
    };
    game.playerMarks.b.Global_GeneralShown = 1;
    hook(rules, "GeneralShowed", ({ game, event, continuation }) => {
      if (
        event.target !== "a" ||
        continuation !== null ||
        game.cardResources.roomTags.nested === true
      )
        return { kind: "done", value: false };
      game.cardResources.roomTags.nested = true;
      game.playerMarks.a.Global_General2Shown = 1;
      return {
        kind: "operation",
        operation: { name: "free-chain", data: null },
        continuation: true,
      };
    });
    operation(game, rules);
    expect(game.seen.map((e) => [e.target, e.data])).toEqual([
      ["a", ["head"]],
      ["a", ["deputy"]],
      ["b", ["head"]],
    ]);
    expect(game.playerMarks.a["@companion"]).toBe(1);
    expect(game.playerMarks.a["@firstshow"]).toBe(1);
    expect(game.playerMarks.a.HaventShowGeneral).toBe(0);
    expect(game.playerMarks.a.HaventShowGeneral2).toBe(0);
  });
  it("pure metadata cannot mutate authoritative reward state", () => {
    const game = fixture();
    ready(game);
    game.playerMarks.a.Global_GeneralShown = 1;
    operation(
      game,
      rewardRegistry({
        companion: (copy) => {
          copy.playerMarks.a["@companion"] = 90;
          return false;
        },
        maxHp: (copy) => {
          copy.hp.a = -100;
          return 4;
        },
      }),
    );
    expect(game.playerMarks.a["@companion"]).toBeUndefined();
    expect(game.hp.a).toBe(3);
    expect(game.playerMarks.a["@halfmaxhp"]).toBeUndefined();
  });
});
