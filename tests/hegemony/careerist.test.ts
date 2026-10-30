import { describe, expect, it } from "vitest";
import {
  createGetWinnerOperation,
  createGameOverJudgeOperation,
  createGameOverOperation,
} from "../../src/game/hegemony/victory";
import { createFillHandCardsOperation } from "../../src/game/hegemony/fill-hand";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createRecoveryOperation } from "../../src/game/hegemony/recovery";
import { createCareeristChoiceOperation } from "../../src/game/hegemony/careerist-choice";
import {
  createCareeristOperation,
  type CareeristGame,
} from "../../src/game/hegemony/careerist";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  type TriggerData,
  type TriggerEvent,
  type TriggerRegistry,
  type TriggerSkill,
  getTriggerPrompt,
  resumeTriggerPrompt,
} from "../../src/game/hegemony/scheduler";

type Game = CareeristGame & { seen: TriggerEvent[] };
function fixture(): Game {
  const players = ["a", "b", "c"];
  return {
    seatOrder: players,
    livingPlayers: [...players],
    seats: { a: 1, b: 2, c: 3 },
    currentPlayer: "c",
    alive: { a: true, b: true, c: true },
    hp: { a: 3, b: 2, c: 2 },
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
    identities: Object.fromEntries(
      players.map((p) => [
        p,
        {
          head: `${p}-head`,
          deputy: `${p}-deputy`,
          headKingdom: p === "a" ? "careerist" : "wei",
          kingdom: p === "a" ? "god" : "wei",
          role: p === "a" ? "god" : "wei",
          headShown: p !== "a",
          deputyShown: false,
          lord: false,
          generalLord: false,
          actualHeadLord: false,
        },
      ]),
    ),
    cardZones: {
      a: { place: "hand", owner: "a", cards: [] },
      b: { place: "hand", owner: "b", cards: [1] },
      c: { place: "hand", owner: "c", cards: [2, 3] },
      draw: { place: "draw", owner: null, cards: [4, 5, 6, 7, 8, 9, 10] },
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
function record(data: TriggerData): Record<string, TriggerData> {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("fixture record");
  return data;
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "careerist-ce4e62b",
    skills: [],
    operations: [
      createCareeristOperation({
        hasShown: (g, p) => {
          const scenarioShown = g.scenarioRoleShown?.[p];
          if (scenarioShown !== undefined && typeof scenarioShown !== "boolean")
            throw new Error("Invalid scenario role shown");
          return (
            scenarioShown === true ||
            g.identities[p].headShown ||
            g.identities[p].deputyShown
          );
        },
        showHead: (target) => ({
          name: "show-careerist",
          data: {
            target,
            triggerEvent: false,
            sendLog: true,
            ignoreRule: true,
          },
        }),
      }),
      {
        name: "show-careerist",
        run: ({ game, operation }) => {
          const data = record(operation.data),
            target = String(data.target);
          expect(game.cardResources.roomTags.GlobalCareeristShow).toBe(true);
          expect(data).toMatchObject({
            triggerEvent: false,
            sendLog: true,
            ignoreRule: true,
          });
          game.identities[target].headShown = true;
          game.seen.push({ name: "careerist-shown", target, data: null });
          return { kind: "return", value: null };
        },
      },
    ],
  };
}
function run(
  game: Game,
  rules = registry(),
  name = "careerist-rule",
  data: TriggerData = null,
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  expect(
    dispatchTriggerOperation(scheduler, game, rules, { name, data }, "c"),
  ).toBe(true);
  return scheduler;
}
function fullRegistry(): TriggerRegistry<Game> {
  const rules = registry();
  rules.operations!.push(
    createCareeristChoiceOperation({
      request: (request) => ({ name: "reply-choice", data: request }),
    }),
    createFillHandCardsOperation({
      draw: (target, count, reason) => ({
        name: "draw-bonus",
        data: { target, count, reason },
      }),
    }),
    createRecoveryOperation(),
    createCardMovementOperation(),
    {
      name: "reply-choice",
      run: ({ game, operation }) => {
        game.seen.push({
          name: "request",
          target: String(record(operation.data).target),
          data: operation.data,
        });
        const replies = game.cardResources.roomTags.replies;
        return {
          kind: "return",
          value: Array.isArray(replies) ? (replies.shift() ?? null) : null,
        };
      },
    },
    {
      name: "draw-bonus",
      run: ({ game, operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const data = record(operation.data);
        game.seen.push({
          name: "draw",
          target: String(data.target),
          data: data.count,
        });
        return {
          kind: "operation",
          operation: {
            name: "move-cards",
            data: {
              moves: [
                {
                  ids: game.cardZones.draw.cards.slice(0, Number(data.count)),
                  to: data.target,
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
    id: "observe-bonus",
    priority: 10,
    events: ["ChoiceMade", "PreHpRecover", "HpChanged", "HpRecover"],
    record: ({ game, event }) => {
      game.seen.push(structuredClone(event));
    },
    effect: () => ({ kind: "done", value: false }),
  });
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
describe("Careerist forced reveal and recruitment", () => {
  it("gives a decliner the real hand-fill/recovery bonus before the next candidate accepts", () => {
    const game = fixture();
    game.cardResources.roomTags.replies = ["no", "yes"];
    const scheduler = run(game, fullRegistry());
    expect(game.cardZones.c.cards).toEqual([2, 3, 4, 5]);
    expect(game.hp.c).toBe(3);
    expect(game.identities.c.role).toBe("wei");
    expect(game.cardZones.b.cards).toEqual([1]);
    expect(game.hp.b).toBe(2);
    expect(game.identities.b.role).toBe("careerist_a-head");
    expect(game.scenarioRoleShown.b).toBe(true);
    expect(
      game.seen.filter((e) => e.name === "request").map((e) => e.target),
    ).toEqual(["c", "b"]);
    expect(game.seen.filter((e) => e.name === "PreHpRecover")).toEqual([
      {
        name: "PreHpRecover",
        target: "c",
        data: { recover: 1, who: null, card: null },
      },
    ]);
    expect(scheduler.operationCompletion?.value).toBe(true);
  });
  it("does not subtract a minimum signed fill count when the hand is already above it", () => {
    const game = fixture();
    expect(() =>
      run(game, fullRegistry(), "fill-hand", {
        target: "b",
        count: -2147483648,
      }),
    ).not.toThrow();
    expect(game.cardZones.b.cards).toEqual([1]);
    expect(game.cardZones.draw.cards).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });
  it("recruits the first agreeing current-order candidate and leaves other candidates without bonus", () => {
    const game = fixture();
    game.cardResources.roomTags.replies = ["yes"];
    const scheduler = run(game, fullRegistry());
    expect(game.identities.c.role).toBe("careerist_a-head");
    expect(game.scenarioRoleShown.c).toBe(true);
    expect(game.identities.b.role).toBe("wei");
    expect(game.hp).toEqual({ a: 3, b: 2, c: 2 });
    expect(game.cardZones.draw.cards).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(
      game.seen.filter((e) => e.name === "request").map((e) => e.target),
    ).toEqual(["c"]);
    expect(scheduler.operationCompletion?.value).toBe(true);
  });
  it("fills the current hand shortfall using real physical movement without replacing existing cards", () => {
    const game = fixture(),
      rules = registry();
    rules.operations!.push(
      createFillHandCardsOperation({
        draw: (target, count, reason) => ({
          name: "draw-shortfall",
          data: { target, count, reason },
        }),
      }),
      createCardMovementOperation(),
      {
        name: "draw-shortfall",
        run: ({ operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          expect(operation.data).toEqual({ target: "c", count: 2, reason: "" });
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: { moves: [{ ids: [4, 5], to: "c" }] },
            },
            continuation: true,
          };
        },
      },
    );
    run(game, rules, "fill-hand", { target: "c", count: 4 });
    expect(game.cardZones.c.cards).toEqual([2, 3, 4, 5]);
    expect(game.cardZones.draw.cards).toEqual([6, 7, 8, 9, 10]);
  });
  it("preserves accepted percent-prefix replies and emits ChoiceMade before returning the captured answer", () => {
    const game = fixture(),
      rules = registry();
    rules.operations!.push(
      createCareeristChoiceOperation({
        request: (request) => ({ name: "choice-reply", data: request }),
      }),
      {
        name: "choice-reply",
        run: ({ operation }) => {
          expect(operation.data).toMatchObject({
            target: "b",
            leader: "a",
            choices: ["no", "yes"],
            skill: "GameRule:CareeristAdd",
            prompt: "@careerist-add:a",
            allChoices: ["yes", "no"],
          });
          return { kind: "return", value: "yes%metadata" };
        },
      },
    );
    rules.skills.push({
      id: "choice-observe",
      events: ["ChoiceMade"],
      priority: 10,
      record: ({ game, event }) => {
        game.seen.push(structuredClone(event));
      },
      effect: () => ({ kind: "done", value: false }),
    });
    rules.skills.push({
      id: "choice-rewrite",
      events: ["ChoiceMade"],
      priority: 5,
      rule: true,
      effect: ({ event }) => {
        event.data = "tampered";
        return { kind: "done", value: true };
      },
    });
    const scheduler = run(game, rules, "careerist-choice", {
      target: "b",
      leader: "a",
      choices: ["no", "yes"],
    });
    expect(game.seen).toEqual([
      {
        name: "ChoiceMade",
        target: "b",
        data: "skillChoice:GameRule:CareeristAdd:yes%metadata",
      },
    ]);
    expect(scheduler.operationCompletion?.value).toBe("yes%metadata");
  });
  it("forces the hidden careerist head with its tag, assigns a group and postpones victory without recruitment for two members", () => {
    const game = fixture();
    game.livingPlayers = ["a", "b"];
    game.alive.c = false;
    const scheduler = run(game);
    expect(game.identities.a.headShown).toBe(true);
    expect(game.identities.a.role).toBe("careerist_a-head");
    expect(game.cardResources.roomTags.GlobalCareeristShow).toBe(false);
    expect(game.scenarioRoleShown).toEqual({ a: false, b: false, c: false });
    expect(game.seen).toEqual([
      { name: "careerist-shown", target: "a", data: null },
    ]);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(scheduler.frames).toEqual([]);
  });
});

describe("Current careerist/recruit eligibility and native replies", () => {
  it("returns false for an empty living snapshot without modifying a preexisting tag", () => {
    const game = fixture();
    game.livingPlayers = [];
    game.cardResources.roomTags.GlobalCareeristShow = true;
    const scheduler = run(game);
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(game.cardResources.roomTags.GlobalCareeristShow).toBe(true);
  });
  it.each(["shown-head", "plain-seeming-careerist", "normal-head"])(
    "skips %s",
    (kind) => {
      const game = fixture();
      if (kind === "shown-head") game.identities.a.headShown = true;
      if (kind === "plain-seeming-careerist") {
        game.identities.a.deputyShown = true;
        game.identities.a.role = "careerist";
      }
      if (kind === "normal-head") game.identities.a.headKingdom = "wei";
      const scheduler = run(game);
      expect(scheduler.operationCompletion?.value).toBe(false);
      expect(game.seen).toEqual([]);
    },
  );
  it("does not treat a grouped seeming careerist as exact plain careerist", () => {
    const game = fixture();
    game.identities.a.role = "careerist_old";
    game.identities.a.deputyShown = true;
    game.livingPlayers = ["a"];
    const scheduler = run(game);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.identities.a.role).toBe("careerist_a-head");
  });
  it("hidden plain role alone does not suppress a careerist forced reveal", () => {
    const game = fixture();
    game.identities.a.role = "careerist";
    game.livingPlayers = ["a"];
    expect(run(game).operationCompletion?.value).toBe(true);
    expect(game.identities.a.headShown).toBe(true);
  });
  it("skips careerist-prefixed and current lord candidates without giving bonus", () => {
    const game = fixture();
    game.identities.c.role = "careerist_other";
    game.identities.b.lord = true;
    const scheduler = run(game, fullRegistry());
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.seen.filter((e) => e.name === "request")).toEqual([]);
    expect(game.hp.c).toBe(2);
    expect(game.hp.b).toBe(2);
  });
  it("skips an actual hidden-head lord through the coherent Player::isLord fact", () => {
    const game = fixture();
    game.identities.c.actualHeadLord = true;
    game.identities.c.lord = true;
    game.identities.c.headShown = false;
    game.cardResources.roomTags.replies = ["yes"];
    run(game, fullRegistry());
    expect(game.identities.c.role).toBe("wei");
    expect(game.scenarioRoleShown.c).toBe(false);
    expect(game.identities.b.role).toBe("careerist_a-head");
    expect(
      game.seen.filter((e) => e.name === "request").map((e) => e.target),
    ).toEqual(["b"]);
  });
  it("asks a careerist-head candidate only no and normalizes an unsupported yes to refusal", () => {
    const game = fixture();
    game.identities.c.headKingdom = "careerist";
    game.cardResources.roomTags.replies = ["yes", "yes"];
    run(game, fullRegistry());
    expect(
      record(game.seen.find((e) => e.name === "request")!.data).choices,
    ).toEqual(["no"]);
    expect(game.hp.c).toBe(3);
    expect(game.identities.b.role).toBe("careerist_a-head");
    expect(game.seen.find((e) => e.name === "ChoiceMade")?.data).toBe(
      "skillChoice:GameRule:CareeristAdd:no",
    );
  });
  it.each<TriggerData>([null, 1, true, {}, ".", "cancel", "unknown"])(
    "normalizes raw reply %s to no before bonus",
    (reply) => {
      const game = fixture();
      game.cardResources.roomTags.replies = [reply, "yes"];
      run(game, fullRegistry());
      expect(game.hp.c).toBe(3);
      expect(game.identities.b.role).toBe("careerist_a-head");
      expect(game.seen.find((e) => e.name === "ChoiceMade")?.data).toBe(
        "skillChoice:GameRule:CareeristAdd:no",
      );
    },
  );
  it.each(["yes%metadata", "no%metadata"])(
    "preserves %s but gives refusal bonus because it is not exact yes",
    (reply) => {
      const game = fixture();
      game.cardResources.roomTags.replies = [reply, "yes"];
      run(game, fullRegistry());
      expect(game.hp.c).toBe(3);
      expect(game.identities.c.role).toBe("wei");
      expect(game.identities.b.role).toBe("careerist_a-head");
      expect(game.seen.find((e) => e.name === "ChoiceMade")?.data).toBe(
        `skillChoice:GameRule:CareeristAdd:${reply}`,
      );
    },
  );
  it("recruits despite candidate death/role/kingdom changes during ChoiceMade", () => {
    const game = fixture(),
      rules = fullRegistry();
    game.cardResources.roomTags.replies = ["yes"];
    hook(rules, "ChoiceMade", ({ game }) => {
      game.alive.c = false;
      game.livingPlayers = ["a", "b"];
      game.identities.c.role = "careerist_late";
      game.identities.c.headKingdom = "careerist";
      return { kind: "done", value: true };
    });
    run(game, rules);
    expect(game.identities.c.role).toBe("careerist_a-head");
    expect(game.scenarioRoleShown.c).toBe(true);
    expect(game.alive.c).toBe(false);
  });
  it("retains snapshot length and candidates after a decliner dies during ChoiceMade", () => {
    const game = fixture(),
      rules = fullRegistry();
    game.cardResources.roomTags.replies = ["no", "yes"];
    hook(rules, "ChoiceMade", ({ game, event }) => {
      if (event.target === "c") {
        game.alive.c = false;
        game.livingPlayers = ["a", "b"];
      }
      return { kind: "done", value: false };
    });
    run(game, rules);
    expect(game.hp.c).toBe(2);
    expect(game.cardZones.c.cards).toEqual([2, 3]);
    expect(game.identities.b.role).toBe("careerist_a-head");
  });
  it("uses the actual name after show, even when the leader died during show", () => {
    const game = fixture(),
      rules = fullRegistry();
    game.cardResources.roomTags.replies = ["yes"];
    rules.operations = rules.operations!.map((op) =>
      op.name !== "show-careerist"
        ? op
        : {
            ...op,
            run: ({ game }) => {
              game.identities.a.headShown = true;
              game.identities.a.head = "replacement";
              game.alive.a = false;
              game.livingPlayers = ["b", "c"];
              return { kind: "return", value: null };
            },
          },
    );
    expect(run(game, rules).operationCompletion?.value).toBe(true);
    expect(game.identities.a.role).toBe("careerist_replacement");
    expect(game.identities.c.role).toBe("careerist_replacement");
  });
  it("retains the group name captured after show across later choice mutations", () => {
    const game = fixture(),
      rules = fullRegistry();
    game.cardResources.roomTags.replies = ["yes"];
    hook(rules, "ChoiceMade", ({ game }) => {
      game.identities.a.head = "late-head";
      return { kind: "done", value: false };
    });
    run(game, rules);
    expect(game.identities.c.role).toBe("careerist_a-head");
  });
  it("returns false on a later call once the careerist head is shown", () => {
    const game = fixture();
    game.cardResources.roomTags.replies = ["yes"];
    const rules = fullRegistry();
    run(game, rules);
    expect(run(game, rules).operationCompletion?.value).toBe(false);
    expect(game.seen.filter((e) => e.name === "careerist-shown")).toHaveLength(
      1,
    );
  });
  it("gives all decliners fill to four and one recovery, without giving the leader a bonus", () => {
    const game = fixture();
    game.cardResources.roomTags.replies = ["no", "no"];
    run(game, fullRegistry());
    expect(game.cardZones.c.cards).toEqual([2, 3, 4, 5]);
    expect(game.cardZones.b.cards).toEqual([1, 6, 7, 8]);
    expect(game.hp).toEqual({ a: 3, b: 3, c: 3 });
    expect(game.cardZones.a.cards).toEqual([]);
  });
  it("preserves excess hand cards while still recovering a decliner", () => {
    const game = fixture();
    game.cardZones.c.cards = [2, 3, 4, 5, 6];
    game.cardZones.draw.cards = [7, 8, 9, 10];
    game.cardResources.roomTags.replies = ["no", "yes"];
    run(game, fullRegistry());
    expect(game.cardZones.c.cards).toEqual([2, 3, 4, 5, 6]);
    expect(game.hp.c).toBe(3);
    expect(game.seen.filter((e) => e.name === "draw")).toEqual([]);
  });
  it("fills a decliner but respects CannotRecover at the real recovery boundary", () => {
    const game = fixture();
    game.cardResources.playerTags.c.CannotRecover = true;
    game.cardResources.roomTags.replies = ["no", "yes"];
    run(game, fullRegistry());
    expect(game.cardZones.c.cards).toEqual([2, 3, 4, 5]);
    expect(game.hp.c).toBe(2);
  });
});

describe("Careerist snapshots, validation and serialized integration", () => {
  it("processes multiple leaders from the same snapshot with separate group names", () => {
    const game = fixture();
    game.identities.b.headKingdom = "careerist";
    game.identities.b.headShown = false;
    game.cardResources.roomTags.replies = ["yes"];
    run(game, fullRegistry());
    expect(game.identities.a.role).toBe("careerist_a-head");
    expect(game.identities.b.role).toBe("careerist_b-head");
    expect(game.identities.c.role).toBe("careerist_a-head");
    expect(
      game.seen
        .filter((e) => e.name === "careerist-shown")
        .map((e) => e.target),
    ).toEqual(["a", "b"]);
  });
  it("handles null current with registration-order recruitment", () => {
    const game = fixture();
    game.currentPlayer = null;
    game.cardResources.roomTags.replies = ["yes"];
    run(game, fullRegistry());
    expect(game.identities.b.role).toBe("careerist_a-head");
    expect(game.identities.c.role).toBe("wei");
  });
  it("retains outer captured acceptance after nested careerist processing in ChoiceMade", () => {
    const game = fixture(),
      rules = fullRegistry();
    game.identities.b.headKingdom = "careerist";
    game.identities.b.headShown = false;
    game.cardResources.roomTags.replies = ["yes", "yes"];
    hook(rules, "ChoiceMade", ({ game, event, continuation }) => {
      if (
        event.data !== "skillChoice:GameRule:CareeristAdd:yes" ||
        continuation !== null ||
        game.cardResources.roomTags.nested === true
      )
        return { kind: "done", value: false };
      game.cardResources.roomTags.nested = true;
      return {
        kind: "operation",
        operation: { name: "careerist-rule", data: null },
        continuation: true,
      };
    });
    run(game, rules);
    expect(game.identities.b.role).toBe("careerist_b-head");
    expect(game.identities.c.role).toBe("careerist_a-head");
    expect(game.cardResources.roomTags.GlobalCareeristShow).toBe(false);
  });
  it.each<[string, (g: Game) => void]>([
    [
      "duplicate living players",
      (g) => {
        g.livingPlayers = ["a", "a"];
      },
    ],
    [
      "unknown current",
      (g) => {
        g.currentPlayer = "unknown";
      },
    ],
  ])("rejects %s before allocating a careerist frame", (_, mutate) => {
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
        { name: "careerist-rule", data: null },
        "c",
      ),
    ).toThrow();
    expect(scheduler.frames).toEqual([]);
    expect(JSON.stringify(game)).toBe(before);
  });
  it.each<TriggerData>([
    { target: "unknown", leader: "a", choices: ["no"] },
    { target: "b", leader: "a", choices: [] },
    { target: "b", leader: "a", choices: ["yes", "no"] },
    { target: "b", leader: "a", choices: ["no", "yes", "no"] },
  ])("rejects malformed choices %s before requesting", (data) => {
    const game = fixture();
    expect(() => run(game, fullRegistry(), "careerist-choice", data)).toThrow();
    expect(game.seen).toEqual([]);
  });
  it.each<TriggerData>([
    { target: "b", count: 4, reason: null },
    { target: "b", count: 1.5 },
    { target: "b", count: 2147483648 },
  ])("rejects malformed fill input %s without moving cards", (data) => {
    const game = fixture();
    expect(() => run(game, fullRegistry(), "fill-hand", data)).toThrow();
    expect(game.cardZones.b.cards).toEqual([1]);
  });
  it("dead fill skips malformed hand storage", () => {
    const game = fixture();
    game.alive.b = false;
    game.cardZones.b.cards = JSON.parse("null");
    expect(() =>
      run(game, fullRegistry(), "fill-hand", { target: "b", count: 4 }),
    ).not.toThrow();
    expect(game.seen.filter((e) => e.name === "draw")).toEqual([]);
  });
  it("rejects malformed scenario visibility after ChoiceMade while retaining forced reveal/group", () => {
    const game = fixture();
    game.cardResources.roomTags.replies = ["yes"];
    game.scenarioRoleShown.c = JSON.parse("null");
    expect(() => run(game, fullRegistry())).toThrow();
    expect(game.identities.a.role).toBe("careerist_a-head");
    expect(game.identities.c.role).toBe("wei");
    expect(game.scenarioRoleShown.c).toBeNull();
    expect(game.cardResources.roomTags.GlobalCareeristShow).toBe(false);
  });
  it("get-winner postpones after real recruitment, then a later judge terminates with current group allies", () => {
    const game = fixture(),
      rules = fullRegistry();
    game.cardResources.roomTags.replies = ["yes"];
    rules.operations!.push(
      createGetWinnerOperation({
        hasShown: (g, p) =>
          g.scenarioRoleShown[p] ||
          g.identities[p].headShown ||
          g.identities[p].deputyShown,
        isFriend: (g, a, b) =>
          a === b || g.identities[a].role === g.identities[b].role,
        willBeFriend: () => true,
        getLord: () => null,
        careerist: () => ({ name: "careerist-rule", data: null }),
        showGeneral: (target, slot) => ({
          name: "victory-show",
          data: { target, slot },
        }),
      }),
      createGameOverJudgeOperation({
        winner: () => ({ name: "get-winner", data: null }),
        over: (winner) => ({ name: "game-over", data: winner }),
      }),
      createGameOverOperation(),
      {
        name: "victory-show",
        run: ({ game, operation }) => {
          const data = record(operation.data),
            target = String(data.target);
          if (data.slot === "head") game.identities[target].headShown = true;
          else game.identities[target].deputyShown = true;
          return { kind: "return", value: null };
        },
      },
    );
    expect(
      run(game, rules, "get-winner").operationCompletion?.value,
    ).toBeNull();
    expect(game.gameResult).toBeUndefined();
    expect(game.identities.c.role).toBe("careerist_a-head");
    game.alive.b = false;
    game.livingPlayers = ["a", "c"];
    const end = run(game, rules, "game-over-judge", {
      target: "b",
      data: null,
    });
    expect(end.interruption?.reason).toBe("game-over");
    expect(game.gameResult).toBe("a+c");
  });
  it.each([
    "ChoiceMade",
    "PreHpRecover",
    "HpChanged",
    "HpRecover",
    "BeforeCardsMove",
  ])("resumes JSON at %s with exactly-once bonus and acceptance", (name) => {
    let game = fixture();
    game.cardResources.roomTags.replies = ["no", "yes"];
    const rules = fullRegistry();
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
    let scheduler = run(game, rules),
      pauses = 0;
    while (getTriggerPrompt(scheduler, "c")) {
      const prompt = getTriggerPrompt(scheduler, "c")!,
        before = JSON.stringify({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: prompt.id + "-old",
          choice: "continue",
        }),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(before);
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
      if (++pauses > 12) throw new Error("pause fixture loop");
    }
    expect(pauses).toBeGreaterThan(0);
    expect(game.cardZones.c.cards).toEqual([2, 3, 4, 5]);
    expect(game.hp.c).toBe(3);
    expect(game.identities.b.role).toBe("careerist_a-head");
    expect(game.scenarioRoleShown.b).toBe(true);
    expect(game.seen.filter((e) => e.name === "draw")).toHaveLength(1);
    expect(scheduler.frames).toEqual([]);
  });
  it.each(["show-careerist", "reply-choice", "draw-bonus"])(
    "resumes a serialized %s child once",
    (name) => {
      let game = fixture();
      game.cardResources.roomTags.replies = ["no", "yes"];
      const rules = fullRegistry(),
        original = rules.operations!.find((op) => op.name === name)!;
      rules.operations = rules.operations!.map((op) =>
        op !== original
          ? op
          : {
              ...op,
              run: (ctx) =>
                ctx.continuation === null
                  ? {
                      kind: "prompt",
                      actor: String(record(ctx.operation.data).target),
                      choices: ["continue"],
                      canCancel: false,
                      continuation: { resume: true },
                    }
                  : original.run({
                      ...ctx,
                      continuation:
                        typeof ctx.continuation === "object" &&
                        ctx.continuation !== null &&
                        !Array.isArray(ctx.continuation) &&
                        ctx.continuation.resume === true
                          ? null
                          : ctx.continuation,
                    }),
            },
      );
      let scheduler = run(game, rules),
        pauses = 0;
      while (scheduler.prompt) {
        const actor = scheduler.prompt.actor,
          prompt = getTriggerPrompt(scheduler, actor)!;
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, actor, {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
        if (++pauses > 6) throw new Error("child loop");
      }
      expect(game.hp.c).toBe(3);
      expect(game.cardZones.c.cards).toEqual([2, 3, 4, 5]);
      expect(game.identities.b.role).toBe("careerist_a-head");
      expect(
        game.seen.filter((e) => e.name === "careerist-shown"),
      ).toHaveLength(1);
      expect(game.seen.filter((e) => e.name === "draw")).toHaveLength(1);
      expect(scheduler.frames).toEqual([]);
    },
  );
  it.each(["stage-change", "turn-broken", "game-over"] as const)(
    "freezes eager reveal state at %s without fabricated tag cleanup",
    (reason) => {
      const game = fixture(),
        rules = registry();
      rules.operations = rules.operations!.map((op) =>
        op.name !== "show-careerist"
          ? op
          : { ...op, run: () => ({ kind: "interrupt", reason }) },
      );
      const scheduler = run(game, rules);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.cardResources.roomTags.GlobalCareeristShow).toBe(true);
      expect(game.identities.a.role).toBe("god");
      expect(game.scenarioRoleShown.c).toBe(false);
      expect(scheduler.frames.length).toBeGreaterThan(0);
    },
  );
});
