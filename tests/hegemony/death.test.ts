import { describe, expect, it } from "vitest";
import {
  type Damage,
  createDamageOperation,
} from "../../src/game/hegemony/damage";
import {
  createDamageDoneOperation,
  createDamageDoneRule,
  createDamageCompleteOperation,
  createDamageCompleteRule,
} from "../../src/game/hegemony/damage-rule";
import { createEnterDyingOperation } from "../../src/game/hegemony/dying";
import {
  createPostHpReducedOperation,
  createPostHpReducedRule,
  createAskForPeachesOperation,
  createAskForPeachesRule,
  createAskForPeachesDoneOperation,
  createAskForPeachesDoneRule,
} from "../../src/game/hegemony/dying-rule";
import { createSinglePeachOperation } from "../../src/game/hegemony/peach-response";
import { createRecoveryOperation } from "../../src/game/hegemony/recovery";
import {
  createGetWinnerOperation,
  createBeforeGameOverJudgeOperation,
  createBeforeGameOverJudgeRule,
  createGameOverJudgeOperation,
  createGameOverJudgeRule,
  createGameOverOperation,
  type WinnerRules,
} from "../../src/game/hegemony/victory";
import {
  createRewardOperation,
  createBuryVictimOperation,
  createBuryVictimRule,
  type RewardRules,
} from "../../src/game/hegemony/death-rule";
import { createBuryOperation } from "../../src/game/hegemony/burial";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createKillPlayerOperation,
  type DeathGame,
} from "../../src/game/hegemony/death";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  dispatchTriggerEvent,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerEvent,
  type TriggerRegistry,
  type TriggerSkill,
} from "../../src/game/hegemony/scheduler";

type Game = DeathGame & { seen: TriggerEvent[] };
function record(data: TriggerData): Record<string, TriggerData> {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("fixture record");
  return data;
}
function friend(game: Readonly<Game>, a: string, b: string) {
  if (a === b) return true;
  const left = game.identities[a],
    right = game.identities[b];
  return (
    (left.headShown || left.deputyShown) &&
    (right.headShown || right.deputyShown) &&
    !left.role.startsWith("careerist") &&
    !right.role.startsWith("careerist") &&
    left.kingdom === right.kingdom
  );
}
function lifecycleRegistry(
  options: {
    winner?: Partial<WinnerRules<Game>>;
    reward?: Partial<RewardRules<Game>>;
  } = {},
): TriggerRegistry<Game> {
  const rules = registry(),
    showGeneral = (target: string, slot: "head" | "deputy") => ({
      name: "show-general",
      data: { target, slot },
    });
  rules.operations!.push(
    createCardMovementOperation(),
    createBuryOperation({
      throwCards: (target) => ({ name: "throw-cards", data: target }),
      clearPiles: (target) => ({ name: "clear-piles", data: target }),
      releaseGeneral: (name) => ({ name: "release-general", data: name }),
      clearLimitations: (target) => ({
        name: "clear-limitations",
        data: target,
      }),
    }),
    createBuryVictimOperation({
      bury: (target) => ({ name: "bury", data: target }),
      reward: (killer, victim) => ({
        name: "reward-punish",
        data: { killer, victim },
      }),
      notifyRole: (target, role) => ({
        name: "private-role",
        data: { target, role },
      }),
    }),
    createRewardOperation({
      isFriend: friend,
      draw: (target, count) => ({
        name: "reward-draw",
        data: { target, count },
      }),
      discard: (target) => ({ name: "punish-discard", data: target }),
      ...options.reward,
    }),
    createBeforeGameOverJudgeOperation({ showGeneral }),
    createGetWinnerOperation({
      isFriend: friend,
      willBeFriend: (g, a, b) =>
        g.identities[a].headKingdom === g.identities[b].kingdom,
      getLord: (g, kingdom) =>
        g.seatOrder.find(
          (p) =>
            g.identities[p].actualHeadLord &&
            g.identities[p].headKingdom === kingdom,
        ) ?? null,
      careerist: () => ({ name: "careerist-decision", data: null }),
      showGeneral,
      ...options.winner,
    }),
    createGameOverJudgeOperation({
      winner: () => ({ name: "get-winner", data: null }),
      over: (winner) => ({ name: "game-over", data: winner }),
    }),
    createGameOverOperation(),
    {
      name: "show-general",
      run: ({ game, operation }) => {
        const data = record(operation.data),
          target = String(data.target);
        if (data.slot === "head") {
          game.identities[target].headShown = true;
          game.identities[target].generalLord =
            game.identities[target].actualHeadLord;
        } else game.identities[target].deputyShown = true;
        game.seen.push({ name: "shown", target, data: data.slot });
        return { kind: "return", value: null };
      },
    },
    {
      name: "careerist-decision",
      run: ({ game }) => {
        game.seen.push({ name: "careerist", target: null, data: null });
        return {
          kind: "return",
          value: game.cardResources.roomTags.careeristResult ?? false,
        };
      },
    },
    {
      name: "throw-cards",
      run: ({ game, operation, continuation }) => {
        const target = String(operation.data),
          stage = continuation === null ? 0 : Number(continuation);
        if (stage === 2) return { kind: "return", value: null };
        const ids = Object.values(game.cardZones)
          .filter(
            (z) =>
              z.owner === target &&
              (stage === 0
                ? z.place === "hand" || z.place === "equip"
                : z.place === "delayed"),
          )
          .flatMap((z) => z.cards);
        return {
          kind: "operation",
          operation: {
            name: "move-cards",
            data: { moves: ids.length ? [{ ids, to: "discard" }] : [] },
          },
          continuation: stage + 1,
        };
      },
    },
    {
      name: "clear-piles",
      run: ({ game, operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const ids = Object.values(game.cardZones)
          .filter((z) => z.owner === operation.data && z.place === "special")
          .flatMap((z) => z.cards);
        return {
          kind: "operation",
          operation: {
            name: "move-cards",
            data: { moves: ids.length ? [{ ids, to: "discard" }] : [] },
          },
          continuation: true,
        };
      },
    },
    {
      name: "release-general",
      run: ({ game, operation }) => {
        game.seen.push({ name: "release", target: null, data: operation.data });
        return { kind: "return", value: null };
      },
    },
    {
      name: "clear-limitations",
      run: ({ game, operation }) => {
        game.seen.push({
          name: "limits-cleared",
          target: String(operation.data),
          data: null,
        });
        return { kind: "return", value: null };
      },
    },
    {
      name: "private-role",
      run: ({ game, operation }) => {
        game.seen.push({
          name: "private-role",
          target: String(record(operation.data).target),
          data: operation.data,
        });
        return { kind: "return", value: null };
      },
    },
    {
      name: "reward-draw",
      run: ({ game, operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const data = record(operation.data);
        game.seen.push({
          name: "draw",
          target: String(data.target),
          data: data.count,
        });
        const ids = game.cardZones.draw.cards.slice(0, Number(data.count));
        return {
          kind: "operation",
          operation: {
            name: "move-cards",
            data: { moves: ids.length ? [{ ids, to: data.target }] : [] },
          },
          continuation: true,
        };
      },
    },
    {
      name: "punish-discard",
      run: ({ game, operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const ids = Object.values(game.cardZones)
          .filter(
            (z) =>
              z.owner === operation.data &&
              (z.place === "hand" || z.place === "equip"),
          )
          .flatMap((z) => z.cards);
        game.seen.push({
          name: "punish",
          target: String(operation.data),
          data: null,
        });
        return {
          kind: "operation",
          operation: {
            name: "move-cards",
            data: { moves: ids.length ? [{ ids, to: "discard" }] : [] },
          },
          continuation: true,
        };
      },
    },
  );
  rules.skills.push(
    createBeforeGameOverJudgeRule(),
    createGameOverJudgeRule(),
    createBuryVictimRule(),
  );
  return rules;
}
function hook(
  rules: TriggerRegistry<Game>,
  name: string,
  effect: NonNullable<TriggerSkill<Game>["effect"]>,
) {
  rules.skills.push({
    id: `hook-${name}-${rules.skills.length}`,
    events: [name],
    priority: 5,
    rule: true,
    effect,
  });
}
function packet(): Damage {
  return {
    from: "c",
    to: "b",
    card: null,
    damage: 5,
    nature: "normal",
    chain: false,
    transfer: false,
    by_user: true,
    reason: "",
    flags: [],
    transfer_reason: "",
    prevented: false,
  };
}
function damageRegistry(): TriggerRegistry<Game> {
  const rules = lifecycleRegistry();
  rules.operations!.push(
    createDamageOperation(),
    createDamageDoneOperation(),
    createDamageCompleteOperation(),
    createEnterDyingOperation(),
    createPostHpReducedOperation(),
    createAskForPeachesOperation({
      hasActiveWansha: () => false,
      isProhibited: () => false,
      isLocked: () => false,
      ask: (request) => ({ name: "ask-single-peach", data: request }),
    }),
    createAskForPeachesDoneOperation({
      kill: (target, damage) => ({
        name: "kill-player",
        data: { target, damage },
      }),
    }),
    createSinglePeachOperation({
      request: (data) => ({ name: "refuse-peach", data }),
      isLimited: () => false,
      cardString: (_, card) => card.reference,
      validateResponse: () => {
        throw new Error("refusal has no validation");
      },
      use: () => {
        throw new Error("refusal has no use");
      },
      validateAfter: () => {
        throw new Error("refusal has no after");
      },
    }),
    {
      name: "refuse-peach",
      run: ({ game, operation }) => {
        game.seen.push({ name: "refused", target: null, data: operation.data });
        return { kind: "return", value: null };
      },
    },
  );
  rules.skills.push(
    createDamageDoneRule(),
    createDamageCompleteRule(),
    createPostHpReducedRule(),
    createAskForPeachesRule(),
    createAskForPeachesDoneRule(),
    {
      id: "damage-observe",
      events: [
        "Dying",
        "AskForPeaches",
        "AskForPeachesDone",
        "QuitDying",
        "DamageComplete",
      ],
      priority: 10,
      record: ({ game, event }) => {
        game.seen.push(structuredClone(event));
      },
      effect: () => ({ kind: "done", value: false }),
    },
  );
  return rules;
}
function fixture(): Game {
  const players = ["a", "b", "c"];
  return {
    seatOrder: players,
    livingPlayers: [...players],
    seats: { a: 1, b: 2, c: 3 },
    currentPlayer: "c",
    alive: { a: true, b: true, c: true },
    hp: { a: 4, b: -3, c: 4 },
    maxHp: { a: 4, b: 4, c: 4 },
    removed: { a: false, b: false, c: false },
    chained: { a: false, b: false, c: false },
    damageStack: [],
    playerMarks: { a: {}, b: { "@token": 2, hidden: 3 }, c: {} },
    playerFlags: { a: [], b: ["keep"], c: [] },
    currentdying: { a: "", b: "", c: "" },
    acquiredSkills: {
      a: { head: [], deputy: [] },
      b: { head: ["acquired-head"], deputy: ["acquired-deputy"] },
      c: { head: [], deputy: [] },
    },
    playerHistory: { a: {}, b: { Slash: 2, Analeptic: 1 }, c: {} },
    identities: Object.fromEntries(
      players.map((id) => [
        id,
        {
          head: `${id}-head`,
          deputy: `${id}-deputy`,
          headKingdom: id === "c" ? "shu" : "wei",
          kingdom: id === "c" ? "shu" : "wei",
          role: id === "c" ? "shu" : "wei",
          headShown: true,
          deputyShown: true,
          lord: false,
          generalLord: false,
          actualHeadLord: false,
        },
      ]),
    ),
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    cardZones: {
      a: { owner: "a", place: "hand", cards: [] },
      b: { owner: "b", place: "hand", cards: [1, 2] },
      be: { owner: "b", place: "equip", cards: [3] },
      bj: { owner: "b", place: "delayed", cards: [4] },
      bp: { owner: "b", place: "special", pileName: "pile", cards: [5] },
      c: { owner: "c", place: "hand", cards: [] },
      draw: { owner: null, place: "draw", cards: [6, 7, 8, 9, 10] },
      discard: { owner: null, place: "discard", cards: [] },
    },
    seen: [],
  };
}
const deathEvents = [
  "BeforeGameOverJudge",
  "HpChanged",
  "GameOverJudge",
  "Death",
  "BuryVictim",
  "DeathFinished",
];
function registry(): TriggerRegistry<Game> {
  return {
    version: "death-ce4e62b",
    operations: [createKillPlayerOperation()],
    skills: [
      {
        id: "observe",
        events: deathEvents,
        priority: 10,
        record: ({ game, event }) => {
          game.seen.push(structuredClone(event));
        },
        effect: () => ({ kind: "done", value: false }),
      },
    ],
  };
}
function run(
  game: Game,
  rules = registry(),
  name = "kill-player",
  data: TriggerData = { target: "b", damage: null },
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(scheduler, game, rules, { name, data }, "a");
  return scheduler;
}
describe("Hegemony death public dispatch", () => {
  it("rejects a supplied null kill count after burial, retaining earlier resource changes", () => {
    const game = fixture();
    game.playerMarks.c = JSON.parse('{"multi_kill_count":null}');
    game.playerFlags.c = ["NoRewardPunishFlag"];
    expect(() =>
      run(game, lifecycleRegistry(), "bury-victim", {
        target: "b",
        data: { who: "b", damage: packet() },
      }),
    ).toThrow();
    expect(game.cardZones.discard.cards).toEqual([5, 4, 3, 2, 1]);
    expect(game.playerMarks.c.multi_kill_count).toBeNull();
    expect(game.playerFlags.c).toEqual(["NoRewardPunishFlag"]);
  });
  it("terminates victory at GameOverJudge before Death, skill detachment and burial", () => {
    const game = fixture(),
      rules = registry();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    game.identities.a.headShown = false;
    game.identities.a.deputyShown = false;
    const showGeneral = (target: string, slot: "head" | "deputy") => ({
      name: "show-general",
      data: { target, slot },
    });
    rules.operations!.push(
      createBeforeGameOverJudgeOperation({ showGeneral }),
      createGetWinnerOperation({
        showGeneral,
        isFriend: (g, a, b) =>
          g.identities[a].kingdom === g.identities[b].kingdom,
        willBeFriend: () => true,
        getLord: () => null,
        careerist: () => ({ name: "unused", data: null }),
      }),
      createGameOverJudgeOperation({
        winner: () => ({ name: "get-winner", data: null }),
        over: (winner) => ({ name: "game-over", data: winner }),
      }),
      createGameOverOperation(),
      {
        name: "show-general",
        run: ({ game, operation }) => {
          if (
            !operation.data ||
            typeof operation.data !== "object" ||
            Array.isArray(operation.data) ||
            typeof operation.data.target !== "string"
          )
            throw new Error("fixture");
          if (operation.data.slot === "head")
            game.identities[operation.data.target].headShown = true;
          else game.identities[operation.data.target].deputyShown = true;
          return { kind: "return", value: null };
        },
      },
    );
    rules.skills.push(
      createBeforeGameOverJudgeRule(),
      createGameOverJudgeRule(),
    );
    const scheduler = run(game, rules);
    expect(game.gameResult).toBe("a+b");
    expect(scheduler.interruption?.reason).toBe("game-over");
    expect(game.seen.map((e) => e.name)).toEqual([
      "BeforeGameOverJudge",
      "HpChanged",
      "GameOverJudge",
    ]);
    expect(game.acquiredSkills.b.head).toEqual(["acquired-head"]);
    expect(game.cardZones.b.cards).toEqual([1, 2]);
  });
  it("checks careerist recruitment before returning a compatible multi-survivor victory", () => {
    const game = fixture(),
      rules = registry();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    rules.operations!.push(
      createGetWinnerOperation({
        isFriend: (g, a, b) =>
          g.identities[a].kingdom === g.identities[b].kingdom,
        willBeFriend: () => true,
        getLord: () => null,
        careerist: () => ({ name: "careerist-decision", data: null }),
        showGeneral: () => {
          throw new Error("already shown");
        },
      }),
      {
        name: "careerist-decision",
        run: ({ game }) => {
          game.cardResources.roomTags.careeristChecked = true;
          return { kind: "return", value: false };
        },
      },
    );
    const scheduler = run(game, rules, "get-winner", null);
    expect(game.cardResources.roomTags.careeristChecked).toBe(true);
    expect(scheduler.operationCompletion?.value).toBe("a+b");
  });
  it("reveals a sole survivor before returning its current allies including dead registered seats", () => {
    const game = fixture(),
      rules = registry();
    game.alive.b = false;
    game.alive.c = false;
    game.livingPlayers = ["a"];
    game.identities.a.headShown = false;
    game.identities.a.deputyShown = false;
    rules.operations!.push(
      createGetWinnerOperation({
        isFriend: (g, a, b) =>
          (g.identities[a].headShown || g.identities[a].deputyShown) &&
          g.identities[a].kingdom === g.identities[b].kingdom,
        willBeFriend: () => true,
        getLord: () => null,
        careerist: () => ({ name: "unexpected-careerist", data: null }),
        showGeneral: (target, slot) => ({
          name: "show-general",
          data: { target, slot, triggerEvent: false, sendLog: false },
        }),
      }),
      {
        name: "show-general",
        run: ({ game, operation }) => {
          expect(operation.data).toMatchObject({
            triggerEvent: false,
            sendLog: false,
          });
          if (
            !operation.data ||
            typeof operation.data !== "object" ||
            Array.isArray(operation.data) ||
            typeof operation.data.target !== "string"
          )
            throw new Error("fixture");
          const identity = game.identities[operation.data.target];
          if (operation.data.slot === "head") identity.headShown = true;
          else identity.deputyShown = true;
          return { kind: "return", value: null };
        },
      },
    );
    const scheduler = run(game, rules, "get-winner", null);
    expect(game.identities.a.headShown).toBe(true);
    expect(game.identities.a.deputyShown).toBe(true);
    expect(scheduler.operationCompletion?.value).toBe("a+b");
  });
  it("increments a killer mark before removing NoRewardPunishFlag and skipping reward", () => {
    const game = fixture(),
      rules = registry();
    game.playerFlags.c = ["NoRewardPunishFlag"];
    game.playerMarks.c.multi_kill_count = 1;
    rules.operations!.push(
      createBuryVictimOperation({
        bury: (target) => ({ name: "bury-adapter", data: target }),
        reward: (killer, victim) => ({
          name: "unexpected-reward",
          data: { killer, victim },
        }),
        notifyRole: (target) => ({ name: "private-role", data: target }),
      }),
      { name: "bury-adapter", run: () => ({ kind: "return", value: null }) },
    );
    run(game, rules, "bury-victim", {
      target: "b",
      data: {
        who: "b",
        damage: {
          from: "c",
          to: "b",
          card: null,
          damage: 1,
          nature: "normal",
          chain: false,
          transfer: false,
          by_user: true,
          reason: "",
          flags: [],
          transfer_reason: "",
          prevented: false,
        },
      },
    });
    expect(game.playerMarks.c.multi_kill_count).toBe(2);
    expect(game.playerFlags.c).toEqual([]);
  });
  it("draws three physical cards for a shown living exact careerist enemy killer", () => {
    const game = fixture(),
      rules = registry();
    game.identities.c.role = "careerist";
    rules.operations!.push(
      createRewardOperation({
        isFriend: (g, a, b) =>
          g.identities[a].kingdom === g.identities[b].kingdom,
        draw: (target, count) => ({
          name: "reward-draw",
          data: { target, count },
        }),
        discard: (target) => ({ name: "punish-discard", data: target }),
      }),
      createCardMovementOperation(),
      {
        name: "reward-draw",
        run: ({ operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          expect(operation.data).toEqual({ target: "c", count: 3 });
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: { moves: [{ ids: [6, 7, 8], to: "c" }] },
            },
            continuation: true,
          };
        },
      },
    );
    run(game, rules, "reward-punish", { killer: "c", victim: "b" });
    expect(game.cardZones.c.cards).toEqual([6, 7, 8]);
    expect(game.cardZones.draw.cards).toEqual([9, 10]);
  });
  it("buries resources after clearing flags and non-Analeptic history, before marks, piles and general release", () => {
    const game = fixture(),
      rules = registry();
    rules.operations!.push(
      createBuryOperation({
        throwCards: (target) => ({ name: "throw-cards", data: target }),
        clearPiles: (target) => ({ name: "clear-piles", data: target }),
        releaseGeneral: (name) => ({ name: "release-general", data: name }),
        clearLimitations: (target) => ({
          name: "clear-limitations",
          data: target,
        }),
      }),
      createCardMovementOperation(),
      {
        name: "throw-cards",
        run: ({ continuation }) => {
          if (continuation === 2) return { kind: "return", value: null };
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: {
                moves: [
                  continuation === null
                    ? { ids: [1, 2, 3], to: "discard" }
                    : { ids: [4], to: "discard" },
                ],
              },
            },
            continuation: continuation === null ? 1 : 2,
          };
        },
      },
      {
        name: "clear-piles",
        run: ({ game, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          expect(game.playerMarks.b).toEqual({});
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: { moves: [{ ids: [5], to: "discard" }] },
            },
            continuation: true,
          };
        },
      },
      {
        name: "release-general",
        run: ({ game, operation }) => {
          game.seen.push({
            name: "release",
            target: null,
            data: operation.data,
          });
          return { kind: "return", value: null };
        },
      },
      {
        name: "clear-limitations",
        run: ({ game }) => {
          game.cardResources!.roomTags.limitationsCleared = true;
          return { kind: "return", value: null };
        },
      },
    );
    rules.skills.push({
      id: "bury-resource-check",
      events: ["BeforeCardsMove"],
      priority: 10,
      record: ({ game }) => {
        expect(game.playerFlags.b).toEqual([]);
        expect(game.playerHistory.b).toEqual({ Analeptic: 1 });
      },
      effect: () => ({ kind: "done", value: false }),
    });
    run(game, rules, "bury", "b");
    expect(game.cardZones.discard.cards).toEqual([5, 4, 3, 2, 1]);
    expect(game.playerMarks.b).toEqual({});
    expect(
      game.seen.filter((e) => e.name === "release").map((e) => e.data),
    ).toEqual(["b-head", "b-deputy"]);
    expect(game.cardResources!.roomTags.limitationsCleared).toBe(true);
  });
  it("removes the victim seat, zeroes HP and dispatches death before acquired-skill detachment and burial", () => {
    const game = fixture();
    const scheduler = run(game);
    expect(game.livingPlayers).toEqual(["a", "c"]);
    expect(game.seats).toEqual({ a: 1, b: 2, c: 2 });
    expect(game.alive.b).toBe(false);
    expect(game.hp.b).toBe(0);
    expect(game.acquiredSkills.b).toEqual({ head: [], deputy: [] });
    expect(game.seen.map((e) => `${e.name}:${e.target}`)).toEqual([
      "BeforeGameOverJudge:b",
      "HpChanged:b",
      "GameOverJudge:b",
      "Death:c",
      "Death:a",
      "Death:b",
      "BuryVictim:b",
      "DeathFinished:c",
      "DeathFinished:a",
      "DeathFinished:b",
    ]);
    expect(scheduler.frames).toEqual([]);
  });
});

describe("Death snapshots, burial and reward decisions", () => {
  it.each([
    "BeforeGameOverJudge",
    "GameOverJudge",
    "Death",
    "BuryVictim",
    "DeathFinished",
  ])("ignores consumed %s while sharing death rewrites", (name) => {
    const game = fixture(),
      rules = registry();
    hook(rules, name, ({ event }) => {
      event.data = { who: "c", damage: null };
      return { kind: "done", value: true };
    });
    run(game, rules);
    expect(game.alive.b).toBe(false);
    expect(game.acquiredSkills.b).toEqual({ head: [], deputy: [] });
    expect(
      game.seen.filter((e) => e.name === "DeathFinished").map((e) => e.target),
    ).toEqual(["c", "a", "b"]);
    expect(game.seen.at(-1)?.data).toEqual({ who: "c", damage: null });
  });
  it("keeps original HP and victim identity despite pre-judge data rewrites and ignores HpChanged data", () => {
    const game = fixture(),
      rules = registry();
    hook(rules, "BeforeGameOverJudge", ({ event }) => {
      event.data = { who: "c", damage: null };
      return { kind: "done", value: false };
    });
    hook(rules, "HpChanged", ({ event }) => {
      event.data = { who: "a", damage: null };
      return { kind: "done", value: true };
    });
    run(game, rules);
    expect(game.hp).toEqual({ a: 4, b: 0, c: 4 });
    expect(game.seen.find((e) => e.name === "BuryVictim")).toMatchObject({
      target: "b",
      data: { who: "c", damage: null },
    });
  });
  it("uses the entry seat snapshot and current alive checks in both death loops", () => {
    const game = fixture(),
      rules = registry();
    hook(rules, "Death", ({ game, event }) => {
      if (event.target === "c") {
        game.currentPlayer = "a";
        game.alive.a = false;
      }
      return { kind: "done", value: false };
    });
    run(game, rules);
    expect(
      game.seen.filter((e) => e.name === "Death").map((e) => e.target),
    ).toEqual(["c", "b"]);
    expect(
      game.seen.filter((e) => e.name === "DeathFinished").map((e) => e.target),
    ).toEqual(["c", "b"]);
  });
  it("supports nested deaths without replacing the outer recipient or payload", () => {
    const game = fixture(),
      rules = registry();
    hook(rules, "Death", ({ event, continuation }) =>
      event.target === "c" &&
      record(event.data).who === "b" &&
      continuation === null
        ? {
            kind: "operation",
            operation: {
              name: "kill-player",
              data: { target: "a", damage: null },
            },
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    run(game, rules);
    expect(game.livingPlayers).toEqual(["c"]);
    expect(game.seats.c).toBe(1);
    expect(
      game.seen.filter((e) => e.name === "BuryVictim").map((e) => e.target),
    ).toEqual(["a", "b"]);
    expect(game.seen.at(-1)).toMatchObject({
      name: "DeathFinished",
      target: "b",
      data: { who: "b", damage: null },
    });
  });
  it("retains revived victim state while still detaching acquired skills and dispatching burial", () => {
    const game = fixture(),
      rules = registry();
    hook(rules, "Death", ({ game, event }) => {
      if (event.target === "b") {
        game.alive.b = true;
        game.hp.b = 2;
        game.acquiredSkills.b.head.push("late");
      }
      return { kind: "done", value: false };
    });
    run(game, rules);
    expect(game.alive.b).toBe(true);
    expect(game.hp.b).toBe(2);
    expect(game.acquiredSkills.b).toEqual({ head: [], deputy: [] });
    expect(game.seen.filter((e) => e.name === "BuryVictim")).toHaveLength(1);
  });
  it("keeps native repeated-kill behavior when the victim is absent from the living list", () => {
    const game = fixture();
    game.alive.b = false;
    game.livingPlayers = ["a", "c"];
    run(game);
    expect(game.seats).toEqual({ a: 0, b: 2, c: 2 });
    expect(
      game.seen.filter((e) => e.name === "Death").map((e) => e.target),
    ).toEqual(["c", "a"]);
  });
  it("null-current death snapshot includes initially dead registered players but skips them when dispatched", () => {
    const game = fixture();
    game.currentPlayer = null;
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    run(game);
    expect(
      game.seen.filter((e) => e.name === "Death").map((e) => e.target),
    ).toEqual(["a", "b"]);
  });
  it("preserves flags added during card burial and skips sujiang general releases", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    game.identities.b.head = "sujiang_male";
    hook(rules, "BeforeCardsMove", ({ game }) => {
      game.playerFlags.b = ["late"];
      return { kind: "done", value: false };
    });
    run(game, rules, "bury", "b");
    expect(game.playerFlags.b).toEqual(["late"]);
    expect(game.playerHistory.b).toEqual({ Analeptic: 1 });
    expect(
      game.seen.filter((e) => e.name === "release").map((e) => e.data),
    ).toEqual(["b-deputy"]);
  });
  it("reads SkipNormalDeathProcess after actual burial, before killer marks or reward", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    hook(rules, "BeforeCardsMove", ({ game }) => {
      game.cardResources.roomTags.SkipNormalDeathProcess = true;
      return { kind: "done", value: false };
    });
    run(game, rules, "bury-victim", {
      target: "b",
      data: { who: "b", damage: packet() },
    });
    expect(game.cardZones.discard.cards).toEqual([5, 4, 3, 2, 1]);
    expect(game.playerMarks.c).toEqual({});
    expect(game.seen.filter((e) => e.name === "draw")).toEqual([]);
  });
  it("updates shown lord allies including dead players, but only privately notifies hidden ones", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    game.identities.b.generalLord = true;
    game.identities.c.kingdom = "wei";
    game.identities.c.headShown = false;
    game.identities.c.deputyShown = false;
    game.alive.a = false;
    run(game, rules, "bury-victim", {
      target: "b",
      data: { who: "b", damage: null },
    });
    expect(game.identities.a.role).toBe("careerist");
    expect(game.identities.c.role).toBe("shu");
    expect(game.seen.filter((e) => e.name === "private-role")).toEqual([
      {
        name: "private-role",
        target: "c",
        data: { target: "c", role: "careerist" },
      },
    ]);
  });
  it("does not convert allies if captured death.who differs from the lord event target", () => {
    const game = fixture();
    game.identities.b.generalLord = true;
    run(game, lifecycleRegistry(), "bury-victim", {
      target: "b",
      data: { who: "c", damage: null },
    });
    expect(game.identities.a.role).toBe("wei");
  });
  it("keeps existing careerist-prefixed roles during lord burial conversion", () => {
    const game = fixture();
    game.identities.b.generalLord = true;
    game.identities.a.role = "careerist_group";
    run(game, lifecycleRegistry(), "bury-victim", {
      target: "b",
      data: { who: "b", damage: null },
    });
    expect(game.identities.a.role).toBe("careerist_group");
  });
  it.each(["dead", "hidden"])("skips reward for a %s killer", (kind) => {
    const game = fixture();
    if (kind === "dead") game.alive.c = false;
    else {
      game.identities.c.headShown = false;
      game.identities.c.deputyShown = false;
    }
    run(game, lifecycleRegistry(), "reward-punish", {
      killer: "c",
      victim: "b",
    });
    expect(game.cardZones.c.cards).toEqual([]);
  });
  it.each([
    ["shu", "c", 2],
    ["careerist_group", "c", 2],
    ["shu", null, 3],
  ] as const)(
    "counts native victim friends for role %s/current %s",
    (role, current, count) => {
      const game = fixture();
      game.alive.b = false;
      game.identities.c.role = role;
      game.currentPlayer = current;
      run(game, lifecycleRegistry(), "reward-punish", {
        killer: "c",
        victim: "b",
      });
      expect(game.seen.find((e) => e.name === "draw")?.data).toBe(count);
    },
  );
  it("punishes a friendly kill by moving hand/equipment but preserving delayed tricks and piles", () => {
    const game = fixture();
    game.identities.b.role = "wei";
    run(game, lifecycleRegistry(), "reward-punish", {
      killer: "b",
      victim: "a",
    });
    expect(game.cardZones.discard.cards).toEqual([3, 2, 1]);
    expect(game.cardZones.bj.cards).toEqual([4]);
    expect(game.cardZones.bp.cards).toEqual([5]);
  });
  it("increments a dead killer mark but does not reward it", () => {
    const game = fixture();
    game.alive.c = false;
    run(game, lifecycleRegistry(), "bury-victim", {
      target: "b",
      data: { who: "b", damage: packet() },
    });
    expect(game.playerMarks.c.multi_kill_count).toBe(1);
    expect(game.cardZones.c.cards).toEqual([]);
  });
});

describe("Native victory branches", () => {
  it("returns no winner for mutually hostile shown survivors", () => {
    const game = fixture();
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBeNull();
    expect(game.seen.filter((e) => e.name === "careerist")).toEqual([]);
  });
  it("tests mixed hidden/shown friendship in the hidden-to-shown direction", () => {
    const game = fixture();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    game.identities.a.headShown = false;
    game.identities.a.deputyShown = false;
    const scheduler = run(
      game,
      lifecycleRegistry({
        winner: { willBeFriend: (_, a, b) => a === "a" && b === "b" },
      }),
      "get-winner",
      null,
    );
    expect(scheduler.operationCompletion?.value).toBe("a+b");
    expect(
      game.seen
        .filter((e) => e.name === "shown")
        .map((e) => [e.target, e.data]),
    ).toEqual([
      ["a", "head"],
      ["a", "deputy"],
    ]);
  });
  it("blocks incompatible hidden actual-head kingdoms before careerist decisions", () => {
    const game = fixture();
    game.livingPlayers = ["a", "c"];
    game.alive.b = false;
    for (const p of ["a", "c"]) {
      game.identities[p].headShown = false;
      game.identities[p].deputyShown = false;
    }
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBeNull();
    expect(game.seen).toEqual([]);
  });
  it("blocks a wholly hidden alive majority using registration-order counts", () => {
    const game = fixture();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    game.identities.c.headKingdom = "wei";
    for (const p of game.seatOrder) {
      game.identities[p].headShown = false;
      game.identities[p].deputyShown = false;
    }
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBeNull();
    expect(game.seen).toEqual([]);
  });
  it("allows an exactly-half hidden faction and reveals it before winner collection", () => {
    const game = fixture();
    game.seatOrder.push("d");
    game.alive.c = false;
    game.alive.d = false;
    game.livingPlayers = ["a", "b"];
    game.identities.d = {
      ...game.identities.c,
      head: "d-head",
      deputy: "d-deputy",
    };
    for (const p of ["a", "b"]) {
      game.identities[p].headShown = false;
      game.identities[p].deputyShown = false;
    }
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBe("a+b");
  });
  it("preserves the native traversal point instead of checking a later total against earlier hidden survivors", () => {
    const game = fixture();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    game.identities.c.kingdom = "wei";
    game.identities.c.headKingdom = "wei";
    game.identities.c.role = "wei";
    game.identities.a.headShown = false;
    game.identities.a.deputyShown = false;
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBe("a+b+c");
  });
  it("blocks even a dead hidden player when any live lord exists", () => {
    const game = fixture();
    game.alive.b = false;
    game.livingPlayers = ["a", "c"];
    game.identities.c.kingdom = "wei";
    game.identities.c.headKingdom = "wei";
    game.identities.c.role = "wei";
    game.identities.c.actualHeadLord = true;
    game.identities.b.headShown = false;
    game.identities.b.deputyShown = false;
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBeNull();
    expect(game.seen).toEqual([]);
  });
  it("a live lord exempts its fully shown faction from majority rejection", () => {
    const game = fixture();
    game.alive.b = false;
    game.livingPlayers = ["a", "c"];
    game.identities.c.kingdom = "wei";
    game.identities.c.headKingdom = "wei";
    game.identities.c.role = "wei";
    game.identities.c.actualHeadLord = true;
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBe("a+b+c");
  });
  it("uses dead-lord +10 weighting before a hidden survivor's majority check", () => {
    const game = fixture();
    game.alive.b = false;
    game.livingPlayers = ["a", "c"];
    game.identities.b.actualHeadLord = true;
    game.identities.c.kingdom = "wei";
    game.identities.c.headKingdom = "wei";
    game.identities.c.role = "wei";
    game.identities.a.headShown = false;
    game.identities.a.deputyShown = false;
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBeNull();
    expect(game.seen).toEqual([]);
  });
  it("postpones victory when the careerist child returns true", () => {
    const game = fixture();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    game.cardResources.roomTags.careeristResult = true;
    const scheduler = run(game, lifecycleRegistry(), "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBeNull();
    expect(game.seen.filter((e) => e.name === "careerist")).toHaveLength(1);
  });
  it("does not recheck captured survivor liveness after the careerist child", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    game.identities.a.headShown = false;
    game.identities.a.deputyShown = false;
    rules.operations = rules.operations!.map((op) =>
      op.name !== "careerist-decision"
        ? op
        : {
            ...op,
            run: ({ game }) => {
              game.alive.a = false;
              game.livingPlayers = ["b"];
              return { kind: "return", value: false };
            },
          },
    );
    const scheduler = run(game, rules, "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBe("a+b");
    expect(game.identities.a.headShown).toBe(true);
    expect(game.identities.a.deputyShown).toBe(true);
  });
  it("checks current deputy visibility after the head-reveal child", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    game.alive.b = false;
    game.alive.c = false;
    game.livingPlayers = ["a"];
    game.identities.a.headShown = false;
    game.identities.a.deputyShown = false;
    rules.operations = rules.operations!.map((op) =>
      op.name !== "show-general"
        ? op
        : {
            ...op,
            run: ({ game }) => {
              game.identities.a.headShown = true;
              game.identities.a.deputyShown = true;
              return { kind: "return", value: null };
            },
          },
    );
    const scheduler = run(game, rules, "get-winner", null);
    expect(scheduler.operationCompletion?.value).toBe("a+b");
  });
  it("uses copies for friendship predicates and preserves authoritative private state", () => {
    const game = fixture();
    const scheduler = run(
      game,
      lifecycleRegistry({
        winner: {
          isFriend: (g) => {
            g.hp.a = 99;
            g.identities.a.head = "tampered";
            return true;
          },
        },
      }),
      "get-winner",
      null,
    );
    expect(scheduler.operationCompletion?.value).toBe("a+b+c");
    expect(game.hp.a).toBe(4);
    expect(game.identities.a.head).toBe("a-head");
  });
  it("distinguishes an empty nonnull winner string from no winner", () => {
    const game = fixture();
    game.alive.b = false;
    game.alive.c = false;
    game.livingPlayers = ["a"];
    const scheduler = run(
      game,
      lifecycleRegistry({ winner: { isFriend: () => false } }),
      "game-over-judge",
      { target: "b", data: null },
    );
    expect(game.gameResult).toBe("");
    expect(scheduler.interruption?.reason).toBe("game-over");
  });
  it("reveals the before-judge event recipient regardless of rewritten death.who", () => {
    const game = fixture();
    game.identities.b.headShown = false;
    game.identities.b.deputyShown = false;
    run(game, lifecycleRegistry(), "before-game-over-judge", {
      target: "b",
      data: { who: "a", damage: null },
    });
    expect(
      game.seen.filter((e) => e.name === "shown").map((e) => e.target),
    ).toEqual(["b", "b"]);
  });
});

describe("Death boundary validation and native rule guards", () => {
  it.each<[string, (game: Game) => void]>([
    [
      "duplicate living list",
      (g) => {
        g.livingPlayers = ["a", "a"];
      },
    ],
    [
      "unknown living player",
      (g) => {
        g.livingPlayers = ["unknown"];
      },
    ],
    [
      "seat underflow",
      (g) => {
        g.seats.c = -2147483648;
      },
    ],
    [
      "malformed seat",
      (g) => {
        g.seats.c = 1.5;
      },
    ],
    [
      "malformed acquired skill",
      (g) => {
        g.acquiredSkills.b = JSON.parse('{"head":null,"deputy":[]}');
      },
    ],
  ])("rejects %s before death mutation or frame allocation", (_, mutate) => {
    const game = fixture(),
      rules = registry(),
      scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    mutate(game);
    const before = JSON.stringify(game);
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "kill-player", data: { target: "b", damage: null } },
        "a",
      ),
    ).toThrow();
    expect(JSON.stringify(game)).toBe(before);
    expect(scheduler.frames).toEqual([]);
  });
  it.each<TriggerData>([
    { target: "unknown", damage: null },
    { target: null, damage: null },
    { target: "b" },
    { target: "b", damage: { damage: 1 } },
  ])("rejects malformed kill input %s", (data) => {
    const game = fixture();
    expect(() => run(game, registry(), "kill-player", data)).toThrow();
    expect(game.alive.b).toBe(true);
    expect(game.hp.b).toBe(-3);
  });
  it("rejects malformed burial history before clearing flags", () => {
    const game = fixture();
    game.playerHistory.b = JSON.parse('{"Slash":null}');
    expect(() => run(game, lifecycleRegistry(), "bury", "b")).toThrow();
    expect(game.playerFlags.b).toEqual(["keep"]);
  });
  it.each<TriggerData>(["true", null, 1])(
    "rejects supplied malformed SkipNormalDeathProcess %s after burial",
    (value) => {
      const game = fixture();
      game.cardResources.roomTags.SkipNormalDeathProcess = value;
      expect(() =>
        run(game, lifecycleRegistry(), "bury-victim", {
          target: "b",
          data: { who: "b", damage: packet() },
        }),
      ).toThrow();
      expect(game.cardZones.discard.cards).toEqual([5, 4, 3, 2, 1]);
      expect(game.playerMarks.c).toEqual({});
    },
  );
  it("rejects kill-mark signed overflow after burial without clearing a suppression flag", () => {
    const game = fixture();
    game.playerMarks.c.multi_kill_count = 2147483647;
    game.playerFlags.c = ["NoRewardPunishFlag"];
    expect(() =>
      run(game, lifecycleRegistry(), "bury-victim", {
        target: "b",
        data: { who: "b", damage: packet() },
      }),
    ).toThrow();
    expect(game.playerMarks.c.multi_kill_count).toBe(2147483647);
    expect(game.playerFlags.c).toEqual(["NoRewardPunishFlag"]);
  });
  it("rejects zero living seats before allocating a winner frame", () => {
    const game = fixture(),
      rules = lifecycleRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    game.livingPlayers = [];
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "get-winner", data: null },
        "a",
      ),
    ).toThrow();
    expect(scheduler.frames).toEqual([]);
  });
  it("rejects malformed friendship results without applying callback mutations", () => {
    const game = fixture();
    expect(() =>
      run(
        game,
        lifecycleRegistry({
          winner: {
            isFriend: (g) => {
              g.hp.b = 99;
              return JSON.parse('"bad"');
            },
          },
        }),
        "get-winner",
        null,
      ),
    ).toThrow();
    expect(game.hp.b).toBe(-3);
  });
  it("rejects malformed hidden friendship results", () => {
    const game = fixture();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    game.identities.a.headShown = false;
    game.identities.a.deputyShown = false;
    expect(() =>
      run(
        game,
        lifecycleRegistry({
          winner: { willBeFriend: () => JSON.parse("null") },
        }),
        "get-winner",
        null,
      ),
    ).toThrow();
  });
  it("rejects an unknown lord predicate result", () => {
    const game = fixture();
    game.alive.c = false;
    game.livingPlayers = ["a", "b"];
    expect(() =>
      run(
        game,
        lifecycleRegistry({ winner: { getLord: () => "unknown" } }),
        "get-winner",
        null,
      ),
    ).toThrow();
  });
  it.each<TriggerData>([null, "false", 1])(
    "rejects malformed careerist child result %s",
    (value) => {
      const game = fixture(),
        rules = lifecycleRegistry();
      game.alive.c = false;
      game.livingPlayers = ["a", "b"];
      rules.operations = rules.operations!.map((op) =>
        op.name !== "careerist-decision"
          ? op
          : { ...op, run: () => ({ kind: "return", value }) },
      );
      expect(() => run(game, rules, "get-winner", null)).toThrow();
      expect(game.gameResult).toBeUndefined();
    },
  );
  it("rejects malformed winner child result before game-over", () => {
    const game = fixture(),
      rules = lifecycleRegistry();
    rules.operations = rules.operations!.map((op) =>
      op.name !== "get-winner"
        ? op
        : { ...op, run: () => ({ kind: "return", value: 7 }) },
    );
    expect(() =>
      run(game, rules, "game-over-judge", { target: "b", data: null }),
    ).toThrow();
    expect(game.gameResult).toBeUndefined();
  });
  it.each(["BeforeGameOverJudge", "GameOverJudge", "BuryVictim"])(
    "consumes SkipGameRule before null-target malformed %s",
    (name) => {
      const game = fixture(),
        rules = lifecycleRegistry(),
        scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      game.cardResources.roomTags.SkipGameRule = true;
      expect(
        dispatchTriggerEvent(
          scheduler,
          game,
          rules,
          {
            name,
            target: null,
            data: { bad: true },
          },
          "c",
        ),
      ).toBe(true);
      expect(game.cardResources.roomTags.SkipGameRule).toBeUndefined();
      expect(scheduler.completion?.consumed).toBe(false);
    },
  );
  it.each(["before-game-over-judge", "game-over-judge", "bury-victim"])(
    "skips a standalone null-target %s before payload parsing",
    (name) => {
      const game = fixture();
      run(game, lifecycleRegistry(), name, {
        target: null,
        data: { bad: true },
      });
      expect(game.gameResult).toBeUndefined();
      expect(game.cardZones.b.cards).toEqual([1, 2]);
    },
  );
});

describe("Damage/rescue/death composition and serialized continuations", () => {
  it("successful rescue bypasses the registered actual death pipeline and preserves acquired skills/history/resources", () => {
    const game = fixture(),
      rules = damageRegistry();
    game.hp.b = 4;
    game.cardResources.cards.save = {
      kind: "virtual",
      key: "save",
      isSlash: false,
      isNDTrick: false,
      flags: [],
      tags: {},
    };
    const response = {
      reference: "save",
      card: {
        type: "basic",
        name: "peach",
        className: "Peach",
        skillName: "",
        materialIDs: [],
        flags: [],
      },
    };
    rules.operations = rules.operations!.filter(
      (op) => op.name !== "ask-single-peach",
    );
    rules.operations.push(
      createRecoveryOperation(),
      createSinglePeachOperation({
        request: (data) => ({ name: "rescue-reply", data }),
        isLimited: () => false,
        cardString: (_, card) => card.reference,
        validateResponse: (_, card) => ({
          name: "rescue-validate",
          data: card,
        }),
        use: (use) => ({ name: "rescue-use", data: use }),
        validateAfter: () => ({ name: "rescue-after", data: null }),
      }),
      {
        name: "rescue-reply",
        run: () => ({ kind: "return", value: response }),
      },
      {
        name: "rescue-validate",
        run: ({ operation }) => ({ kind: "return", value: operation.data }),
      },
      {
        name: "rescue-use",
        run: ({ operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          const data = record(operation.data);
          if (!Array.isArray(data.to) || typeof data.to[0] !== "string")
            throw new Error("fixture rescue target");
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
        },
      },
      {
        name: "rescue-after",
        run: ({ game }) => {
          game.seen.push({ name: "rescued", target: "b", data: null });
          return { kind: "return", value: null };
        },
      },
    );
    const scheduler = run(game, rules, "damage", packet());
    expect(game.alive.b).toBe(true);
    expect(game.hp.b).toBe(1);
    expect(game.acquiredSkills.b).toEqual({
      head: ["acquired-head"],
      deputy: ["acquired-deputy"],
    });
    expect(game.playerHistory.b).toEqual({ Slash: 2, Analeptic: 1 });
    expect(game.livingPlayers).toEqual(["a", "b", "c"]);
    expect(game.seats).toEqual({ a: 1, b: 2, c: 3 });
    expect(game.cardZones.b.cards).toEqual([1, 2]);
    expect(game.cardZones.be.cards).toEqual([3]);
    expect(game.cardZones.bj.cards).toEqual([4]);
    expect(game.cardZones.bp.cards).toEqual([5]);
    expect(game.cardZones.discard.cards).toEqual([]);
    expect(game.cardZones.draw.cards).toEqual([6, 7, 8, 9, 10]);
    expect(
      game.seen.filter((e) =>
        ["Death", "BuryVictim", "DeathFinished", "draw", "punish"].includes(
          e.name,
        ),
      ),
    ).toEqual([]);
    expect(game.seen.filter((e) => e.name === "rescued")).toHaveLength(2);
    expect(game.playerFlags.b).toEqual(["keep"]);
    expect(game.cardResources.roomTags.CurrentDying).toEqual([]);
    expect(game.currentdying).toEqual({ a: "", b: "", c: "" });
    expect(game.damageStack).toEqual([]);
    expect(scheduler.frames).toEqual([]);
  });
  it("runs failed Peach rescue through actual kill, burial movement, reward and damage completion", () => {
    const game = fixture();
    game.hp.b = 4;
    const scheduler = run(game, damageRegistry(), "damage", packet());
    expect(game.alive.b).toBe(false);
    expect(game.hp.b).toBe(0);
    expect(game.cardZones.discard.cards).toEqual([5, 4, 3, 2, 1]);
    expect(game.cardZones.c.cards).toEqual([6, 7]);
    expect(game.playerMarks.c.multi_kill_count).toBe(1);
    expect(game.playerHistory.b).toEqual({ Analeptic: 1 });
    expect(game.playerFlags.b).toEqual([]);
    expect(game.cardResources.roomTags.CurrentDying).toEqual([]);
    expect(game.damageStack).toEqual([]);
    expect(game.seen.filter((e) => e.name === "refused")).toHaveLength(3);
    expect(
      game.seen.filter((e) => e.name === "Death").map((e) => e.target),
    ).toEqual(["c", "a", "b"]);
    expect(
      game.seen.filter((e) => e.name === "DeathFinished").map((e) => e.target),
    ).toEqual(["c", "a", "b"]);
    expect(game.seen.at(-1)?.name).toBe("DamageComplete");
    expect(scheduler.frames).toEqual([]);
  });
  it.each([
    "BeforeGameOverJudge",
    "HpChanged",
    "GameOverJudge",
    "Death",
    "BuryVictim",
    "DeathFinished",
    "BeforeCardsMove",
    "AskForPeaches",
    "QuitDying",
  ])(
    "survives JSON reload at every %s occurrence without repeated burial/reward",
    (name) => {
      let game = fixture();
      game.hp.b = 4;
      const rules = damageRegistry();
      hook(rules, name, ({ continuation }) =>
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
      let scheduler = run(game, rules, "damage", packet()),
        pauses = 0;
      while (getTriggerPrompt(scheduler, "c")) {
        const prompt = getTriggerPrompt(scheduler, "c")!;
        const unchanged = JSON.stringify({ game, scheduler });
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "a", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(false);
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "c", {
            id: `${prompt.id}-stale`,
            choice: "continue",
          }),
        ).toBe(false);
        expect(JSON.stringify({ game, scheduler })).toBe(unchanged);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "c", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
        const after = JSON.stringify({ game, scheduler });
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "c", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(false);
        expect(JSON.stringify({ game, scheduler })).toBe(after);
        pauses++;
        if (pauses > 20) throw new Error("fixture pause loop");
      }
      expect(pauses).toBeGreaterThan(0);
      expect(game.hp.b).toBe(0);
      expect(game.alive.b).toBe(false);
      expect(game.cardZones.discard.cards).toEqual([5, 4, 3, 2, 1]);
      expect(game.cardZones.c.cards).toEqual([6, 7]);
      expect(game.playerMarks.c.multi_kill_count).toBe(1);
      expect(
        game.seen.filter((e) => e.name === "release").map((e) => e.data),
      ).toEqual(["b-head", "b-deputy"]);
      expect(game.seen.filter((e) => e.name === "draw")).toHaveLength(1);
      expect(game.currentdying).toEqual({ a: "", b: "", c: "" });
      expect(game.cardResources.roomTags.CurrentDying).toEqual([]);
      expect(game.damageStack).toEqual([]);
      expect(scheduler.frames).toEqual([]);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes eager death state at %s before skill detachment or burial",
    (reason) => {
      const game = fixture(),
        rules = damageRegistry();
      game.hp.b = 4;
      hook(rules, "Death", () => ({ kind: "interrupt", reason }));
      const scheduler = run(game, rules, "damage", packet());
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(game.alive.b).toBe(false);
      expect(game.hp.b).toBe(0);
      expect(game.livingPlayers).toEqual(["a", "c"]);
      expect(game.cardResources.roomTags.CurrentDying).toEqual(["b"]);
      expect(game.acquiredSkills.b.head).toEqual(["acquired-head"]);
      expect(game.cardZones.b.cards).toEqual([1, 2]);
      expect(game.damageStack).toHaveLength(1);
      expect(game.seen.filter((e) => e.name === "BuryVictim")).toEqual([]);
    },
  );
});
