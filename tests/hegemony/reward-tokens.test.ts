import { describe, expect, it } from "vitest";
import type { GeneralGame } from "../../src/game/hegemony/general-identity";
import { createFillHandCardsOperation } from "../../src/game/hegemony/fill-hand";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createRecoveryOperation } from "../../src/game/hegemony/recovery";
import {
  createFreeChainOperation,
  type FreeChainGame,
} from "../../src/game/hegemony/general-rewards";
import {
  createRewardTokenUseOperation,
  createRewardTokenCostOperation,
  createRewardTokenEnabledOperation,
  createFirstShowTargetsOperation,
  type RewardTokenRules,
} from "../../src/game/hegemony/reward-tokens";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
  type OperationHandler,
} from "../../src/game/hegemony/scheduler";

type Game = GeneralGame & FreeChainGame & { seen: TriggerData[] };
function fixture(): Game {
  const players = ["a", "b", "c"];
  return {
    seatOrder: players,
    livingPlayers: [...players],
    currentPlayer: "a",
    seats: { a: 1, b: 2, c: 3 },
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
    acquiredSkills: Object.fromEntries(
      players.map((p) => [p, { head: [], deputy: [] }]),
    ),
    scenarioRoleShown: { a: false, b: false, c: false },
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
    generalCatalog: {},
    cardZones: {
      draw: { place: "draw", owner: null, cards: [1, 2, 3, 4, 5, 6] },
      discard: { place: "discard", owner: null, cards: [] },
      a: { place: "hand", owner: "a", cards: [] },
      b: { place: "hand", owner: "b", cards: [] },
      c: { place: "hand", owner: "c", cards: [] },
    },
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    seen: [],
  };
}
function registry(
  overrides: Partial<RewardTokenRules<Game>> = {},
): TriggerRegistry<Game> {
  return {
    version: "tokens-ce4e62b",
    skills: [],
    operations: [
      createRewardTokenCostOperation(),
      createRewardTokenEnabledOperation(),
      createFirstShowTargetsOperation(),
      createRewardTokenUseOperation({
        draw: (player, count, reason) => ({
          name: "draw",
          data: { player, count, reason },
        }),
        peachAvailable: () => true,
        peachLocked: () => false,
        peachProhibited: () => false,
        usePeach: (use) => ({ name: "peach", data: use }),
        choice: (request) => ({ name: "choice", data: request }),
        choosePlayer: (request) => ({ name: "choose-player", data: request }),
        indicate: (player, target) => ({
          name: "indicate",
          data: { player, target },
        }),
        publicView: (notice) => ({ name: "public-view", data: notice }),
        privateView: (notice) => ({ name: "private-view", data: notice }),
        ...overrides,
      }),
      {
        name: "draw",
        run: ({ game, operation }) => {
          game.seen.push(operation.data);
          return { kind: "return", value: null };
        },
      },
      {
        name: "choice",
        run: ({ game, operation }) => {
          game.seen.push(operation.data);
          const replies = game.cardResources.roomTags.replies;
          return {
            kind: "return",
            value: Array.isArray(replies)
              ? (replies.shift() ?? null)
              : (game.cardResources.roomTags.reply ?? "draw"),
          };
        },
      },
      {
        name: "peach",
        run: ({ game, operation }) => {
          game.seen.push(operation.data);
          return { kind: "return", value: null };
        },
      },
      createFillHandCardsOperation({
        draw: (player, count, reason) => ({
          name: "draw",
          data: { player, count, reason },
        }),
      }),
      ...["public-view", "private-view", "indicate"].map((name) => ({
        name,
        run: ({
          game,
          operation,
        }: Parameters<
          NonNullable<TriggerRegistry<Game>["operations"]>[number]["run"]
        >[0]) => {
          game.seen.push({ kind: name, data: operation.data });
          return { kind: "return" as const, value: null };
        },
      })),
      {
        name: "choose-player",
        run: ({ game, operation }) => {
          game.seen.push(operation.data);
          return {
            kind: "return",
            value: game.cardResources.roomTags.chosen ?? "a",
          };
        },
      },
    ],
  };
}
function run(
  game: Game,
  rules = registry(),
  name = "reward-token-use",
  data: TriggerData = { player: "a", token: "halfmaxhp", targets: [] },
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  expect(
    dispatchTriggerOperation(scheduler, game, rules, { name, data }, "a"),
  ).toBe(true);
  return scheduler;
}
function record(value: TriggerData): { [key: string]: TriggerData } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected record");
  return value;
}
function handler(
  rules: TriggerRegistry<Game>,
  name: string,
): OperationHandler<Game> {
  const found = rules.operations?.find((op) => op.name === name);
  if (!found) throw new Error(`Missing fixture operation ${name}`);
  return found;
}
function shown(game: Game, player: string) {
  game.identities[player].headShown = true;
  game.identities[player].deputyShown = true;
}
function check(game: Game, token: string, reason = "play", pattern = "") {
  return run(game, registry(), "reward-token-enabled", {
    player: "a",
    token,
    reason,
    pattern,
  }).operationCompletion?.value;
}
function use(
  game: Game,
  rules: TriggerRegistry<Game>,
  token: string,
  targets: string[] = [],
) {
  return run(game, rules, "reward-token-use", { player: "a", token, targets });
}
function pause(rules: TriggerRegistry<Game>, name: string) {
  const operation = handler(rules, name),
    original = operation.run;
  operation.run = (context) => {
    if (context.continuation === null)
      return {
        kind: "prompt",
        actor: "a",
        choices: ["continue"],
        canCancel: false,
        continuation: { tokenFixturePause: true },
      };
    const continued = context.continuation;
    return original({
      ...context,
      continuation:
        typeof continued === "object" &&
        !Array.isArray(continued) &&
        continued.tokenFixturePause === true
          ? null
          : continued,
    });
  };
}
function integrationRegistry(): TriggerRegistry<Game> {
  const rules = registry();
  rules.operations!.push(
    createCardMovementOperation(),
    createRecoveryOperation(),
  );
  handler(rules, "draw").run = ({ game, operation, continuation }) => {
    if (continuation !== null) return { kind: "return", value: false };
    const data = record(operation.data);
    game.seen.push(operation.data);
    return {
      kind: "operation",
      operation: {
        name: "move-cards",
        data: {
          moves: [
            {
              ids: game.cardZones.draw.cards.slice(0, Number(data.count)),
              to: data.player,
            },
          ],
        },
      },
      continuation: true,
    };
  };
  // The fixture deliberately supplies Peach's onEffect only, not full Card::onUse.
  handler(rules, "peach").run = ({ game, operation, continuation }) => {
    if (continuation !== null) return { kind: "return", value: false };
    const data = record(operation.data);
    game.seen.push(operation.data);
    if (!Array.isArray(data.to)) throw new Error("Invalid fixture Peach");
    return {
      kind: "operation",
      operation: {
        name: "recover",
        data: {
          target: data.to[0],
          data: { recover: 1, who: data.from, card: null },
        },
      },
      continuation: true,
    };
  };
  return rules;
}
describe("native reward-token package boundaries", () => {
  it("firstshow requires one hidden sibling and filters only the first other target", () => {
    const game = fixture();
    const scheduler = run(game, registry(), "firstshow-targets", {
      player: "a",
      token: "firstshow",
      targets: [],
      candidate: "b",
    });
    expect(scheduler.operationCompletion?.value).toEqual({
      filter: true,
      feasible: false,
    });
  });
  it("careerman can inspect its own hidden general without spending a firstshow token", () => {
    const game = fixture();
    game.cardZones.a.cards = [10, 11, 12, 13];
    for (const p of ["b", "c"]) {
      game.identities[p].headShown = true;
      game.identities[p].deputyShown = true;
    }
    game.cardResources.roomTags.replies = ["firstshow", "head_general"];
    run(game, registry(), "reward-token-use", {
      player: "a",
      token: "careerman",
      targets: [],
    });
    expect(game.seen).toEqual([
      {
        player: "a",
        skill: "careerman",
        target: null,
        choices: ["draw1card", "draw2cards", "peach", "firstshow"],
        allChoices: ["draw1card", "draw2cards", "peach", "firstshow"],
        prompt: "@careerman-choose",
      },
      {
        player: "a",
        candidates: ["a"],
        skill: "careerman",
        prompt: "@careerman-target",
      },
      { kind: "indicate", data: { player: "a", target: "a" } },
      {
        player: "a",
        skill: "firstshow_see",
        target: "a",
        choices: ["head_general", "deputy_general"],
        allChoices: ["head_general", "deputy_general"],
        prompt: "@firstshow-choose::a",
      },
      {
        kind: "public-view",
        data: {
          player: "a",
          target: "a",
          slot: "head_general",
          recipients: ["b", "c"],
        },
      },
      {
        kind: "private-view",
        data: {
          viewer: "a",
          target: "a",
          slot: "head_general",
          names: ["a-head"],
          reason: "firstshow",
        },
      },
    ]);
    expect(game.playerMarks.a["@firstshow"]).toBeUndefined();
  });
  it("firstshow fills first and delivers only the chosen identity privately", () => {
    const game = fixture();
    game.cardResources.roomTags.reply = "deputy_general";
    run(game, registry(), "reward-token-use", {
      player: "a",
      token: "firstshow",
      targets: ["b"],
    });
    expect(game.seen).toEqual([
      { player: "a", count: 4, reason: "firstshow" },
      {
        player: "a",
        skill: "firstshow_see",
        target: "b",
        choices: ["head_general", "deputy_general"],
        allChoices: ["head_general", "deputy_general"],
        prompt: "@firstshow-choose::b",
      },
      {
        kind: "public-view",
        data: {
          player: "a",
          target: "b",
          slot: "deputy_general",
          recipients: ["b", "c"],
        },
      },
      {
        kind: "private-view",
        data: {
          viewer: "a",
          target: "b",
          slot: "deputy_general",
          names: ["b-deputy"],
          reason: "firstshow",
        },
      },
    ]);
    expect(game.playerFlags.b).not.toContain("XianquTarget");
    expect(game.identities.b.deputyShown).toBe(false);
  });
  it("companion asks before drawing two, ignoring void draw results", () => {
    const game = fixture();
    run(game, registry(), "reward-token-use", {
      player: "a",
      token: "companion",
      targets: [],
    });
    expect(game.seen).toEqual([
      {
        player: "a",
        skill: "companion",
        target: null,
        choices: ["peach", "draw"],
        allChoices: ["peach", "draw"],
        prompt: "@companion-choose",
      },
      { player: "a", count: 2, reason: "companion" },
    ]);
  });
  it("allows compound Peach response patterns for a companion token", () => {
    const game = fixture();
    game.playerMarks.a["@companion"] = 1;
    const scheduler = run(game, registry(), "reward-token-enabled", {
      player: "a",
      token: "companion",
      reason: "response-use",
      pattern: "peach+analeptic",
    });
    expect(scheduler.operationCompletion?.value).toBe(true);
  });
  it("extraCost consumes one careerist mark independently of card use", () => {
    const game = fixture();
    game.playerMarks.a["@careerist"] = 2;
    run(game, registry(), "reward-token-cost", {
      player: "a",
      token: "careerman",
    });
    expect(game.playerMarks.a["@careerist"]).toBe(1);
    expect(game.seen).toEqual([]);
  });
  it("halfmaxhp delegates one draw with its reason after successful dispatch", () => {
    const game = fixture();
    const scheduler = run(game);
    expect(game.seen).toEqual([{ player: "a", count: 1, reason: "halfmaxhp" }]);
    expect(scheduler.operationCompletion?.value).toBe(null);
  });
});

describe("enabled and target predicates", () => {
  for (const token of ["halfmaxhp", "companion", "firstshow", "careerman"]) {
    it.each(["play", "response", "response-use", "unknown"])(
      `${token} uses native %s context`,
      (reason) => {
        const game = fixture();
        game.playerMarks.a[token === "careerman" ? "@careerist" : `@${token}`] =
          1;
        expect(check(game, token, reason, "peach")).toBe(
          reason === "play" ||
            ((token === "companion" || token === "careerman") &&
              reason !== "unknown"),
        );
      },
    );
    it.each([0, -1])(`${token} is disabled with %i marks`, (count) => {
      const game = fixture();
      game.playerMarks.a[token === "careerman" ? "@careerist" : `@${token}`] =
        count;
      expect(check(game, token)).toBe(false);
    });
  }
  it.each(["companion", "careerman"])(
    "%s respects PreventPeach and case-sensitive pattern substrings",
    (token) => {
      const game = fixture();
      game.playerMarks.a[token === "careerman" ? "@careerist" : "@companion"] =
        1;
      expect(check(game, token, "response", "Peach")).toBe(false);
      expect(check(game, token, "response", "slash")).toBe(false);
      game.playerFlags.a.push("Global_PreventPeach");
      expect(check(game, token, "response-use", "peach+analeptic")).toBe(false);
      expect(check(game, token, "play")).toBe(true);
    },
  );
  it("firstshow ignores its owner's hidden slots when its hand is full", () => {
    const game = fixture();
    game.playerMarks.a["@firstshow"] = 1;
    game.cardZones.a.cards = [10, 11, 12, 13];
    shown(game, "b");
    shown(game, "c");
    expect(check(game, "firstshow")).toBe(false);
    game.identities.b.deputyShown = false;
    expect(check(game, "firstshow")).toBe(true);
    game.displayedGenerals.b.deputy = "";
    expect(check(game, "firstshow")).toBe(false);
    game.cardZones.a.cards.pop();
    expect(check(game, "firstshow")).toBe(true);
  });
  it("scenario role knowledge does not make all general slots shown", () => {
    const game = fixture();
    game.playerMarks.a["@firstshow"] = 1;
    game.cardZones.a.cards = [10, 11, 12, 13];
    shown(game, "c");
    game.scenarioRoleShown.b = true;
    expect(check(game, "firstshow")).toBe(true);
    game.livingPlayers = ["a", "c"];
    game.alive.b = false;
    expect(check(game, "firstshow")).toBe(false);
  });
  it.each([
    { targets: [], candidate: "a", filter: false, feasible: false },
    { targets: ["b"], candidate: "c", filter: false, feasible: true },
    { targets: ["b", "c"], candidate: null, filter: false, feasible: false },
  ])(
    "firstshow target methods preserve $targets / $candidate",
    ({ targets, candidate, filter, feasible }) => {
      expect(
        run(fixture(), registry(), "firstshow-targets", {
          player: "a",
          token: "firstshow",
          targets,
          candidate,
        }).operationCompletion?.value,
      ).toEqual({ filter, feasible });
    },
  );
  it("firstshow requires no target when all living siblings are fully shown", () => {
    const game = fixture();
    shown(game, "b");
    shown(game, "c");
    expect(
      run(game, registry(), "firstshow-targets", {
        player: "a",
        token: "firstshow",
        targets: [],
        candidate: "b",
      }).operationCompletion?.value,
    ).toEqual({ filter: false, feasible: true });
  });
});

describe("cost and use remain independent native methods", () => {
  it("spends all four rewards actually delivered by the freeChain operation", () => {
    const game = fixture(),
      rules = integrationRegistry();
    shown(game, "a");
    game.displayedGenerals.a = { head: "a-head", deputy: "a-deputy" };
    game.generalCatalog["a-head"] = {
      kingdom: "careerist",
      doubleKingdom: false,
      lord: false,
    };
    game.playerMarks.a = {
      Global_GeneralShown: 1,
      HaventShowGeneral: 1,
      Global_TheFirstToShowRewarded: 1,
    };
    rules.operations!.push(
      createFreeChainOperation({
        kill: (target) => ({ name: "unused-kill", data: target }),
        companion: () => true,
        maxHp: (_game, _name, head) => (head ? 3 : 4),
      }),
    );
    run(game, rules, "free-chain", null);
    expect(game.playerMarks.a).toMatchObject({
      "@companion": 1,
      "@halfmaxhp": 1,
      "@careerist": 1,
      "@firstshow": 1,
    });
    for (const token of ["halfmaxhp", "companion", "firstshow", "careerman"]) {
      run(game, rules, "reward-token-cost", { player: "a", token });
      game.cardResources.roomTags.reply =
        token === "careerman" ? "draw2cards" : "draw";
      use(game, rules, token);
    }
    expect(game.cardZones.a.cards).toEqual([1, 2, 3, 4, 5, 6]);
    expect(game.playerMarks.a).toMatchObject({
      "@companion": 0,
      "@halfmaxhp": 0,
      "@careerist": 0,
      "@firstshow": 0,
    });
  });
  for (const token of ["halfmaxhp", "companion", "firstshow", "careerman"]) {
    it.each([0, -2, 1, 2])(`${token} clamps extraCost from %i`, (count) => {
      const game = fixture(),
        mark = token === "careerman" ? "@careerist" : `@${token}`;
      game.playerMarks.a[mark] = count;
      run(game, registry(), "reward-token-cost", { player: "a", token });
      const expected = count === 2 ? 1 : 0;
      expect(game.playerMarks.a[mark]).toBe(expected);
    });
  }
  it("does not recheck a consumed mark when use runs after extraCost", () => {
    const game = fixture(),
      rules = integrationRegistry();
    game.playerMarks.a["@halfmaxhp"] = 1;
    run(game, rules, "reward-token-cost", { player: "a", token: "halfmaxhp" });
    use(game, rules, "halfmaxhp");
    expect(game.playerMarks.a["@halfmaxhp"]).toBe(0);
    expect(game.cardZones.a.cards).toEqual([1]);
    expect(game.cardZones.draw.cards).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("Peach branches", () => {
  it.each(["companion", "careerman"])(
    "%s rescues the last current dying player before checking play availability",
    (token) => {
      const game = fixture();
      game.cardResources.roomTags.CurrentDying = ["b", "c"];
      game.playerFlags.c = ["Global_Dying"];
      use(
        game,
        registry({
          peachAvailable: () => {
            throw new Error("Must not ask play availability");
          },
        }),
        token,
      );
      expect(game.seen).toEqual([
        {
          from: "a",
          to: ["c"],
          card: {
            type: "basic",
            name: "peach",
            className: "Peach",
            skillName: `_${token}`,
            materialIDs: [],
            flags: [],
            suit: "no-suit",
            number: 0,
          },
        },
      ]);
    },
  );
  it.each(["locked", "prohibited", "not-dying", "dead", "missing"])(
    "companion falls back to play choices when rescue is %s",
    (reason) => {
      const game = fixture();
      game.cardResources.roomTags.CurrentDying = [
        reason === "missing" ? "missing" : "b",
      ];
      if (reason !== "not-dying") game.playerFlags.b.push("Global_Dying");
      if (reason === "dead") {
        game.alive.b = false;
        game.livingPlayers = ["a", "c"];
      }
      use(
        game,
        registry({
          peachAvailable: () => false,
          peachLocked: () => reason === "locked",
          peachProhibited: () => reason === "prohibited",
        }),
        "companion",
      );
      expect(game.seen).toEqual([
        { player: "a", count: 2, reason: "companion" },
      ]);
    },
  );
  it("Peach choice is not rechecked after the normalized choice child", () => {
    const game = fixture(),
      rules = registry();
    game.cardResources.roomTags.reply = "peach";
    handler(rules, "choice").run = ({ game }) => {
      game.hp.a = 4;
      game.playerFlags.a.push("Global_PreventPeach");
      return { kind: "return", value: "peach" };
    };
    use(game, rules, "companion");
    expect(record(game.seen[0]).to).toEqual(["a"]);
    expect(game.hp.a).toBe(4);
  });
  it("predicates receive isolated game and virtual Peach snapshots", () => {
    const game = fixture();
    game.cardResources.roomTags.CurrentDying = ["b"];
    game.playerFlags.b.push("Global_Dying");
    use(
      game,
      registry({
        peachLocked: (copy, _player, card) => {
          copy.playerFlags.b.length = 0;
          copy.hp.a = 99;
          card.skillName = "tampered";
          return false;
        },
        peachProhibited: (copy, _player, _target, card) => {
          expect(copy.hp.a).toBe(3);
          expect(card.skillName).toBe("_companion");
          return false;
        },
      }),
      "companion",
    );
    expect(game.hp.a).toBe(3);
    expect(game.playerFlags.b).toEqual(["Global_Dying"]);
    expect(record(record(game.seen[0]).card).skillName).toBe("_companion");
  });
  it("composes the rescue callback with actual recovery", () => {
    const game = fixture();
    game.hp.b = 0;
    game.cardResources.roomTags.CurrentDying = ["b"];
    game.playerFlags.b = ["Global_Dying"];
    use(game, integrationRegistry(), "careerman");
    expect(game.hp.b).toBe(1);
    expect(game.hp.a).toBe(3);
  });
  it.each(["draw1card", "draw2cards", "peach"])(
    "careerman executes %s",
    (answer) => {
      const game = fixture();
      game.cardResources.roomTags.reply = answer;
      use(game, integrationRegistry(), "careerman");
      expect(game.cardZones.a.cards).toEqual(
        answer === "draw1card" ? [1] : answer === "draw2cards" ? [1, 2] : [],
      );
      expect(game.hp.a).toBe(answer === "peach" ? 4 : 3);
    },
  );
});

describe("firstshow current state and private delivery", () => {
  it("fills to four through actual movement before selecting a slot", () => {
    const game = fixture();
    game.cardZones.a.cards = [10];
    game.cardResources.roomTags.reply = "head_general";
    use(game, integrationRegistry(), "firstshow", ["b"]);
    expect(game.cardZones.a.cards).toEqual([10, 1, 2, 3]);
    expect(game.cardZones.draw.cards).toEqual([4, 5, 6]);
    expect(game.seen.at(-1)).toEqual({
      kind: "private-view",
      data: {
        viewer: "a",
        target: "b",
        slot: "head_general",
        names: ["b-head"],
        reason: "firstshow",
      },
    });
  });
  it("does not inspect hidden state when it has no target", () => {
    const game = fixture();
    game.identities = {};
    game.generalNames = {};
    use(game, integrationRegistry(), "firstshow");
    expect(game.cardZones.a.cards).toEqual([1, 2, 3, 4]);
    expect(game.seen).toEqual([{ player: "a", count: 4, reason: "firstshow" }]);
  });
  it("rereads slot visibility after fill and skips an already shown target", () => {
    const game = fixture(),
      rules = registry();
    handler(rules, "draw").run = ({ game }) => {
      shown(game, "b");
      return { kind: "return", value: true };
    };
    use(game, rules, "firstshow", ["b"]);
    expect(game.seen).toEqual([]);
  });
  it("offers only head for an absent deputy and marks the AI target only during choice", () => {
    const game = fixture(),
      rules = registry();
    game.displayedGenerals.b.deputy = "";
    handler(rules, "choice").run = ({ game, operation }) => {
      expect(game.playerFlags.b).toContain("XianquTarget");
      expect(record(operation.data).choices).toEqual(["head_general"]);
      return { kind: "return", value: "head_general" };
    };
    const original = handler(rules, "public-view").run;
    handler(rules, "public-view").run = (ctx) => {
      expect(ctx.game.playerFlags.b).not.toContain("XianquTarget");
      return original(ctx);
    };
    use(game, rules, "firstshow", ["b"]);
    expect(game.playerFlags.b).toEqual([]);
  });
  it("uses the captured slot and current actual names after the public notice", () => {
    const game = fixture(),
      rules = registry();
    game.cardResources.roomTags.reply = "deputy_general";
    handler(rules, "public-view").run = ({ game, operation }) => {
      game.generalNames.b = ["changed-head", "changed-deputy"];
      game.identities.b.deputyShown = true;
      game.seen.push(operation.data);
      return { kind: "return", value: true };
    };
    use(game, rules, "firstshow", ["b"]);
    expect(game.seen.at(-1)).toEqual({
      kind: "private-view",
      data: {
        viewer: "a",
        target: "b",
        slot: "deputy_general",
        names: ["changed-deputy"],
        reason: "firstshow",
      },
    });
    expect(JSON.stringify(game.seen.slice(0, -1))).not.toContain(
      "changed-deputy",
    );
  });
  it("notifies other registered players including dead in current-first order", () => {
    const game = fixture();
    game.currentPlayer = "c";
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    game.cardResources.roomTags.reply = "head_general";
    use(game, registry(), "firstshow", ["b"]);
    expect(record(record(game.seen.at(-2)!).data).recipients).toEqual([
      "c",
      "b",
    ]);
  });
  it("careerman recollects targets after choice and only fills if all are now shown", () => {
    const game = fixture(),
      rules = integrationRegistry();
    handler(rules, "choice").run = ({ game }) => {
      for (const p of game.seatOrder) shown(game, p);
      return { kind: "return", value: "firstshow" };
    };
    use(game, rules, "careerman");
    expect(game.cardZones.a.cards).toEqual([1, 2, 3, 4]);
    expect(game.seen).toEqual([{ player: "a", count: 4, reason: "firstshow" }]);
  });
  it("careerman offers draw choices only when full, all shown, and Peach unavailable", () => {
    const game = fixture();
    game.cardZones.a.cards = [10, 11, 12, 13];
    for (const p of game.seatOrder) shown(game, p);
    game.cardResources.roomTags.reply = "draw1card";
    use(game, registry({ peachAvailable: () => false }), "careerman");
    expect(record(game.seen[0]).choices).toEqual(["draw1card", "draw2cards"]);
    expect(record(game.seen[0]).allChoices).toEqual([
      "draw1card",
      "draw2cards",
      "peach",
      "firstshow",
    ]);
  });
});

describe("continuations and interruption", () => {
  it.each([
    { token: "halfmaxhp", child: "draw" },
    { token: "companion", child: "choice" },
    { token: "companion", child: "peach" },
    { token: "firstshow", child: "fill-hand" },
    { token: "firstshow", child: "choice" },
    { token: "firstshow", child: "public-view" },
    { token: "firstshow", child: "private-view" },
    { token: "careerman", child: "choose-player" },
    { token: "careerman", child: "indicate" },
  ])(
    "reloads $token at $child without replaying cost or effects",
    ({ token, child }) => {
      let game = fixture();
      const rules = integrationRegistry(),
        mark = token === "careerman" ? "@careerist" : `@${token}`;
      game.playerMarks.a[mark] = 1;
      if (token === "firstshow")
        game.cardResources.roomTags.reply = "head_general";
      if (child === "peach") game.cardResources.roomTags.reply = "peach";
      if (token === "careerman")
        game.cardResources.roomTags.replies = ["firstshow", "head_general"];
      pause(rules, child);
      run(game, rules, "reward-token-cost", { player: "a", token });
      let scheduler = use(
        game,
        rules,
        token,
        token === "firstshow" ? ["b"] : [],
      );
      const prompt = getTriggerPrompt(scheduler, "a");
      expect(prompt).not.toBeNull();
      expect(getTriggerPrompt(scheduler, "b")).toBeNull();
      expect(getTriggerPrompt(scheduler, null)).toBeNull();
      expect(JSON.stringify(prompt)).not.toContain("b-head");
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt!.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: "stale",
          choice: "continue",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt!.id,
          choice: "invalid",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt!.id,
          choice: null,
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(
          scheduler,
          game,
          { ...rules, version: "changed" },
          "a",
          { id: prompt!.id, choice: "continue" },
        ),
      ).toBe(false);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt!.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt!.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect(scheduler.interruption).toBeNull();
      expect(scheduler.frames).toEqual([]);
      expect(scheduler.operationCompletion?.value).toBe(null);
      expect(game.playerMarks.a[mark]).toBe(0);
      if (token === "halfmaxhp") expect(game.cardZones.a.cards).toEqual([1]);
      if (token === "companion") {
        expect(game.hp.a).toBe(child === "peach" ? 4 : 3);
        expect(game.cardZones.a.cards).toEqual(child === "peach" ? [] : [1, 2]);
      }
      if (token === "firstshow" || token === "careerman") {
        expect(game.cardZones.a.cards).toEqual([1, 2, 3, 4]);
        expect(
          game.seen.filter(
            (item) =>
              typeof item === "object" &&
              item !== null &&
              !Array.isArray(item) &&
              item.kind === "private-view",
          ),
        ).toHaveLength(1);
      }
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "retains paid cost and native AI flag on %s during slot choice",
    (reason) => {
      const game = fixture(),
        rules = integrationRegistry();
      game.playerMarks.a["@firstshow"] = 1;
      handler(rules, "choice").run = () => ({ kind: "interrupt", reason });
      run(game, rules, "reward-token-cost", {
        player: "a",
        token: "firstshow",
      });
      const scheduler = use(game, rules, "firstshow", ["b"]);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.playerMarks.a["@firstshow"]).toBe(0);
      expect(game.cardZones.a.cards).toEqual([1, 2, 3, 4]);
      expect(game.playerFlags.b).toEqual(["XianquTarget"]);
      expect(game.seen).toEqual([
        { player: "a", count: 4, reason: "firstshow" },
      ]);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: "stale",
          choice: "head_general",
        }),
      ).toBe(false);
    },
  );
  it("serializes genuine normalized choice prompts and preserves the offered snapshot", () => {
    let game = fixture();
    const rules = registry();
    handler(rules, "choice").run = ({ operation, continuation, answer }) => {
      const request = record(operation.data);
      if (continuation === null)
        return {
          kind: "prompt",
          actor: String(request.player),
          choices: ["peach", "draw"],
          canCancel: false,
          continuation: true,
        };
      return { kind: "return", value: answer!.choice };
    };
    let scheduler = use(game, rules, "companion");
    const prompt = getTriggerPrompt(scheduler, "a")!;
    expect(prompt.choices.map((choice) => choice.id)).toEqual([
      "peach",
      "draw",
    ]);
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    game.hp.a = 4;
    const peachChoice = prompt.choices.find((choice) => choice.id === "peach")!;
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        id: prompt.id,
        choice: peachChoice.id,
      }),
    ).toBe(true);
    expect(record(game.seen[0]).to).toEqual(["a"]);
  });
});

describe("malformed boundaries preserve completed effects", () => {
  it.each<TriggerData>([
    null,
    [],
    {},
    { player: "missing", token: "companion", targets: [] },
    { player: "a", token: "unknown", targets: [] },
    { player: "a", token: "firstshow", targets: ["missing"] },
    { player: "a", token: "firstshow", targets: ["b", "b"] },
    { player: "a", token: "firstshow", targets: false },
  ])(
    "rejects invalid token uses before a scheduler frame or game mutation: %j",
    (data) => {
      const game = fixture(),
        before = structuredClone(game),
        rules = registry(),
        scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "reward-token-use", data },
          "a",
        ),
      ).toThrow();
      expect(scheduler.frames).toEqual([]);
      expect(game).toEqual(before);
    },
  );
  it.each([null, false, [], "invalid", "peach"])(
    "rejects unoffered normalized slot reply %j after the fill",
    (reply) => {
      const game = fixture();
      game.cardResources.roomTags.reply = reply;
      expect(() =>
        use(game, integrationRegistry(), "firstshow", ["b"]),
      ).toThrow("Invalid normalized token choice");
      expect(game.cardZones.a.cards).toEqual([1, 2, 3, 4]);
      expect(game.playerFlags.b).toEqual(["XianquTarget"]);
    },
  );
  it("rejects an unoffered normalized careerman target", () => {
    const game = fixture();
    game.cardResources.roomTags.replies = ["firstshow"];
    game.cardResources.roomTags.chosen = "missing";
    expect(() => use(game, registry(), "careerman")).toThrow(
      "Invalid normalized token target",
    );
    expect(game.seen).toHaveLength(2);
  });
  it("rejects late malformed private names only after the public notice", () => {
    const game = fixture(),
      rules = registry();
    game.cardResources.roomTags.reply = "head_general";
    handler(rules, "public-view").run = ({ game, operation }) => {
      game.generalNames.b = JSON.parse("[false]");
      game.seen.push(operation.data);
      return { kind: "return", value: null };
    };
    expect(() => use(game, rules, "firstshow", ["b"])).toThrow(
      "Invalid token actual names",
    );
    expect(game.seen).toHaveLength(3);
    expect(game.playerFlags.b).toEqual([]);
    expect(JSON.stringify(game.seen)).not.toContain("b-head");
  });
  it("rejects malformed current-dying tags before calling a Peach adapter", () => {
    const game = fixture();
    game.cardResources.roomTags.CurrentDying = [1];
    expect(() => use(game, registry(), "companion")).toThrow(
      "Invalid token CurrentDying",
    );
    expect(game.seen).toEqual([]);
  });
  it("rejects nonboolean package predicate output", () => {
    const game = fixture();
    expect(() =>
      use(
        game,
        registry({ peachAvailable: () => JSON.parse("null") }),
        "companion",
      ),
    ).toThrow("Invalid token predicate");
    expect(game.seen).toEqual([]);
  });
  it("rejects malformed mark and hand data rather than enabling a token", () => {
    const game = fixture();
    game.playerMarks.a["@firstshow"] = 1;
    game.cardZones.a.cards = JSON.parse("[null]");
    expect(() => check(game, "firstshow")).toThrow("Invalid hand cards");
    game.playerMarks.a["@firstshow"] = 1.5;
    expect(() => check(game, "firstshow")).toThrow();
  });
  it("rejects signed subtraction underflow before changing the mark", () => {
    const game = fixture();
    game.playerMarks.a["@firstshow"] = -2147483648;
    expect(() =>
      run(game, registry(), "reward-token-cost", {
        player: "a",
        token: "firstshow",
      }),
    ).toThrow();
    expect(game.playerMarks.a["@firstshow"]).toBe(-2147483648);
  });
});
