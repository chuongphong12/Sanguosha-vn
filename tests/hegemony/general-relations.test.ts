import { describe, expect, it } from "vitest";
import type { GeneralGame } from "../../src/game/hegemony/general-identity";
import { hasShownGeneral } from "../../src/game/hegemony/general-identity";
import {
  areGeneralFriends,
  willBeGeneralFriends,
  generalRoomLord,
} from "../../src/game/hegemony/general-relations";
import {
  createRewardOperation,
  createBuryVictimOperation,
  type RewardRules,
} from "../../src/game/hegemony/death-rule";
import {
  createGetWinnerOperation,
  type WinnerRules,
} from "../../src/game/hegemony/victory";
import {
  createShowGeneralOperation,
  createHideGeneralOperation,
} from "../../src/game/hegemony/general";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createCareeristOperation } from "../../src/game/hegemony/careerist";
import { createCareeristChoiceOperation } from "../../src/game/hegemony/careerist-choice";
import { createKillPlayerOperation } from "../../src/game/hegemony/death";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerSkill,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = GeneralGame & { granted: number; notifications: string[] };
function fixture(): Game {
  const players = ["a", "b", "c", "d"];
  return {
    seatOrder: players,
    livingPlayers: [...players],
    currentPlayer: "c",
    seats: { a: 1, b: 2, c: 3, d: 4 },
    alive: { a: true, b: true, c: true, d: true },
    hp: { a: 3, b: 3, c: 3, d: 3 },
    maxHp: { a: 4, b: 4, c: 4, d: 4 },
    removed: { a: false, b: false, c: false, d: false },
    chained: { a: false, b: false, c: false, d: false },
    damageStack: [],
    playerFlags: { a: [], b: [], c: [], d: [] },
    playerMarks: { a: {}, b: {}, c: {}, d: {} },
    currentdying: { a: "", b: "", c: "", d: "" },
    playerHistory: { a: {}, b: {}, c: {}, d: {} },
    acquiredSkills: Object.fromEntries(
      players.map((p) => [p, { head: [], deputy: [] }]),
    ),
    scenarioRoleShown: { a: false, b: false, c: false, d: false },
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
        (name) => [
          name,
          {
            kingdom: name === "anjiang" ? "god" : "wei",
            doubleKingdom: false,
            lord: false,
          },
        ],
      ),
    ),
    cardZones: {
      draw: {
        place: "draw",
        owner: null,
        cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
      discard: { place: "discard", owner: null, cards: [] },
      a: { place: "hand", owner: "a", cards: [21] },
      b: { place: "hand", owner: "b", cards: [22] },
      c: { place: "hand", owner: "c", cards: [] },
      d: { place: "hand", owner: "d", cards: [] },
      equip: { place: "equip", owner: "a", cards: [20] },
    },
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {}, c: {}, d: {} },
      roomTags: {},
    },
    granted: 0,
    notifications: [],
  };
}
function record(data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("fixture record");
  return data;
}
function rewardRegistry(
  overrides: Partial<RewardRules<Game>> = {},
): TriggerRegistry<Game> {
  return {
    version: "relations-ce4e62b",
    skills: [],
    operations: [
      createRewardOperation({
        hasShown: hasShownGeneral,
        isFriend: areGeneralFriends,
        draw: (target, count) => ({
          name: "observe-draw",
          data: { target, count },
        }),
        discard: (target) => ({ name: "observe-discard", data: target }),
        ...overrides,
      }),
      createCardMovementOperation(),
      {
        name: "observe-draw",
        run: ({ game, operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          const data = record(operation.data);
          game.granted += Number(data.count);
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
      {
        name: "observe-discard",
        run: ({ game, operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          game.granted = -1;
          const ids = Object.values(game.cardZones)
            .filter(
              (z) =>
                z.owner === operation.data &&
                (z.place === "hand" || z.place === "equip"),
            )
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
    ],
  };
}
function winnerRegistry(
  overrides: Partial<WinnerRules<Game>> = {},
): TriggerRegistry<Game> {
  const registry = rewardRegistry();
  registry.operations!.push(
    createGetWinnerOperation({
      hasShown: hasShownGeneral,
      isFriend: areGeneralFriends,
      willBeFriend: willBeGeneralFriends,
      getLord: (g, kingdom) => generalRoomLord(g, kingdom, true),
      careerist: () => ({ name: "careerist-fixture", data: null }),
      showGeneral: (target, slot) => ({
        name: "show-general",
        data: {
          target,
          head: slot === "head",
          triggerEvent: false,
          sendLog: false,
        },
      }),
      ...overrides,
    }),
    {
      name: "careerist-fixture",
      run: () => ({ kind: "return", value: false }),
    },
    createShowGeneralOperation({
      canShow: () => true,
      preshow: () => ({ name: "metadata-fixture", data: null }),
      change: (target, head, name) => ({
        name: "display-fixture",
        data: { target, head, name },
      }),
      skills: () => ({ name: "metadata-fixture", data: null }),
      notify: () => ({ name: "metadata-fixture", data: null }),
      filter: () => ({ name: "metadata-fixture", data: null }),
    }),
    createHideGeneralOperation({
      canShow: () => true,
      preshow: () => ({ name: "metadata-fixture", data: null }),
      change: (target, head, name) => ({
        name: "display-fixture",
        data: { target, head, name },
      }),
      skills: () => ({ name: "metadata-fixture", data: null }),
      notify: () => ({ name: "metadata-fixture", data: null }),
      filter: () => ({ name: "metadata-fixture", data: null }),
    }),
    { name: "metadata-fixture", run: () => ({ kind: "return", value: null }) },
    {
      name: "display-fixture",
      run: ({ game, operation }) => {
        const data = record(operation.data);
        if (data.head === true)
          game.identities[String(data.target)].generalLord =
            game.generalCatalog[String(data.name)].lord;
        return { kind: "return", value: null };
      },
    },
  );
  return registry;
}
describe("private general visibility consumers", () => {
  it("rewards a concealed careerist whose scenario identity remains shown", () => {
    const game = fixture(),
      registry = rewardRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    game.scenarioRoleShown.a = true;
    game.identities.a.role = "careerist";
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "reward-punish",
          data: { killer: "a", victim: "b" },
        },
        "c",
      ),
    ).toBe(true);
    expect(game.granted).toBe(3);
    expect(game.cardZones.a.cards).toEqual([21, 1, 2, 3]);
  });
  it("blocks victory for two concealed but scenario-shown opposing factions", () => {
    const game = fixture(),
      registry = winnerRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    game.livingPlayers = ["a", "b"];
    game.alive.c = game.alive.d = false;
    game.scenarioRoleShown.a = game.scenarioRoleShown.b = true;
    game.identities.b.kingdom = "shu";
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "get-winner", data: null },
        "c",
      ),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toBe(null);
    expect(game.identities.a.headShown).toBe(false);
  });
  it("converts a concealed scenario-shown faction member after its displayed lord dies", () => {
    const game = fixture(),
      registry = rewardRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    game.scenarioRoleShown.a = true;
    game.identities.c.generalLord = true;
    game.alive.c = false;
    registry.operations!.push(
      createBuryVictimOperation({
        hasShown: hasShownGeneral,
        bury: () => ({ name: "bury-fixture", data: null }),
        reward: () => ({ name: "unused", data: null }),
        notifyRole: (target) => ({ name: "private-role", data: target }),
      }),
      { name: "bury-fixture", run: () => ({ kind: "return", value: null }) },
      {
        name: "private-role",
        run: ({ game, operation }) => {
          game.notifications.push(String(operation.data));
          return { kind: "return", value: null };
        },
      },
    );
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "bury-victim",
          data: { target: "c", data: { who: "c", damage: null } },
        },
        "c",
      ),
    ).toBe(true);
    expect(game.identities.a.role).toBe("careerist");
    expect(game.identities.b.role).toBe("lord");
    expect(game.notifications).toEqual(["d", "b"]);
  });
  it("punishes concealed recruited allies even when their kingdoms differ", () => {
    const game = fixture(),
      registry = rewardRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    game.scenarioRoleShown.a = game.scenarioRoleShown.b = true;
    game.identities.a.role = game.identities.b.role = "careerist_a-head";
    game.identities.b.kingdom = "shu";
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "reward-punish", data: { killer: "a", victim: "b" } },
        "c",
      ),
    ).toBe(true);
    expect(game.granted).toBe(-1);
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.equip.cards).toEqual([]);
    expect([...game.cardZones.discard.cards].sort((a, b) => a - b)).toEqual([
      20, 21,
    ]);
  });
  it("does not mistake a shown flag on an absent deputy for a revealed identity", () => {
    const game = fixture(),
      registry = rewardRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, registry.version);
    game.identities.a.deputyShown = true;
    game.displayedGenerals.a.deputy = "";
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "reward-punish", data: { killer: "a", victim: "b" } },
        "c",
      ),
    ).toBe(true);
    expect(game.granted).toBe(0);
  });
});

function perform(
  game: Game,
  registry: TriggerRegistry<Game>,
  name = "get-winner",
  data: TriggerData = null,
) {
  const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
  expect(
    dispatchTriggerOperation(scheduler, game, registry, { name, data }, "c"),
  ).toBe(true);
  return scheduler;
}
function twoSurvivors(game: Game) {
  game.alive.c = game.alive.d = false;
  game.livingPlayers = ["a", "b"];
}
function hook(
  registry: TriggerRegistry<Game>,
  event: string,
  effect: NonNullable<TriggerSkill<Game>["effect"]>,
) {
  registry.skills.push({
    id: `hook-${event}`,
    events: [event],
    priority: 5,
    rule: true,
    effect,
  });
}
describe("native friendship through reward and winner dispatch", () => {
  it.each([
    ["normal same faction across roles", "lord", "renegade", "wei", "wei", -1],
    ["normal different faction", "lord", "loyalist", "wei", "shu", 1],
    ["two plain careerists", "careerist", "careerist", "wei", "wei", 3],
    [
      "plain versus recruited careerist",
      "careerist",
      "careerist_a-head",
      "wei",
      "wei",
      3,
    ],
    [
      "recruited versus plain careerist",
      "careerist_a-head",
      "careerist",
      "wei",
      "wei",
      1,
    ],
    [
      "same recruited group across kingdoms",
      "careerist_a-head",
      "careerist_a-head",
      "wei",
      "shu",
      -1,
    ],
    [
      "different recruited groups",
      "careerist_a-head",
      "careerist_b-head",
      "wei",
      "wei",
      1,
    ],
    [
      "careerist prefix without underscore",
      "careeristOther",
      "careeristOther",
      "wei",
      "shu",
      -1,
    ],
    [
      "careerist prefix versus normal faction",
      "careeristOther",
      "lord",
      "wei",
      "wei",
      1,
    ],
  ] as const)("%s", (_label, aRole, bRole, aKingdom, bKingdom, expected) => {
    const game = fixture();
    game.scenarioRoleShown.a = game.scenarioRoleShown.b = true;
    game.identities.a.role = aRole;
    game.identities.b.role = bRole;
    game.identities.a.kingdom = aKingdom;
    game.identities.b.kingdom = bKingdom;
    perform(game, rewardRegistry(), "reward-punish", {
      killer: "a",
      victim: "b",
    });
    expect(game.granted).toBe(expected);
    expect(game.cardZones.a.cards.length).toBe(
      expected === -1 ? 0 : 1 + expected,
    );
  });
  it("keeps self friendship for a plain careerist", () => {
    const game = fixture();
    game.scenarioRoleShown.a = true;
    game.identities.a.role = "careerist";
    perform(game, rewardRegistry(), "reward-punish", {
      killer: "a",
      victim: "a",
    });
    expect(game.granted).toBe(-1);
  });
  it("does not ally with an unrevealed target of the same faction", () => {
    const game = fixture();
    game.scenarioRoleShown.a = true;
    perform(game, rewardRegistry(), "reward-punish", {
      killer: "a",
      victim: "b",
    });
    expect(game.granted).toBe(1);
  });
  it.each(["head", "deputy"] as const)(
    "rewards a currently shown %s without scenario identity",
    (slot) => {
      const game = fixture();
      if (slot === "head") game.identities.a.headShown = true;
      else game.identities.a.deputyShown = true;
      game.displayedGenerals.a[slot] = `a-${slot}`;
      perform(game, rewardRegistry(), "reward-punish", {
        killer: "a",
        victim: "b",
      });
      expect(game.granted).toBe(1);
    },
  );
  it("scenario visibility wins even with no deputy and a stale deputy flag", () => {
    const game = fixture();
    game.scenarioRoleShown.a = true;
    game.identities.a.deputyShown = true;
    game.displayedGenerals.a.deputy = "";
    perform(game, rewardRegistry(), "reward-punish", {
      killer: "a",
      victim: "b",
    });
    expect(game.granted).toBe(1);
  });
  it("counts living members of the victim's recruited group for an enemy recruit", () => {
    const game = fixture();
    for (const p of game.seatOrder) game.scenarioRoleShown[p] = true;
    game.identities.a.role = "careerist_a-head";
    for (const p of ["b", "c", "d"])
      game.identities[p].role = "careerist_b-head";
    game.alive.d = false;
    game.livingPlayers = ["a", "b", "c"];
    perform(game, rewardRegistry(), "reward-punish", {
      killer: "a",
      victim: "b",
    });
    expect(game.granted).toBe(2);
    expect(game.cardZones.a.cards).toEqual([21, 1, 2]);
  });
  it("actual show and two-slot hide retains scenario identity for reward", () => {
    const game = fixture(),
      registry = winnerRegistry();
    perform(game, registry, "show-general", { target: "a" });
    perform(game, registry, "show-general", { target: "a", head: false });
    perform(game, registry, "hide-general", { target: "a" });
    perform(game, registry, "hide-general", { target: "a", head: false });
    expect(game.identities.a).toMatchObject({
      headShown: false,
      deputyShown: false,
      kingdom: "god",
      role: "careerist",
    });
    expect(game.scenarioRoleShown.a).toBe(true);
    perform(game, registry, "reward-punish", { killer: "a", victim: "b" });
    expect(game.granted).toBe(3);
  });
  it("includes deceased scenario-shown allies in the final winner list", () => {
    const game = fixture();
    twoSurvivors(game);
    game.scenarioRoleShown.a =
      game.scenarioRoleShown.b =
      game.scenarioRoleShown.c =
        true;
    for (const p of ["a", "b", "c"])
      game.identities[p].role = "careerist_a-head";
    game.identities.b.kingdom = "shu";
    game.identities.c.kingdom = "wu";
    const scheduler = perform(game, winnerRegistry());
    expect(scheduler.operationCompletion?.value).toBe("a+b+c");
    expect(game.identities.b.headShown).toBe(true);
    expect(game.identities.b.role).toBe("careerist_a-head");
  });
  it("uses scenario visibility for dead seats in the live-lord ambiguity scan", () => {
    const game = fixture();
    twoSurvivors(game);
    for (const p of game.seatOrder) game.scenarioRoleShown[p] = true;
    game.identities.a.actualHeadLord = game.identities.a.lord = true;
    game.generalCatalog["a-head"].lord = true;
    const scheduler = perform(game, winnerRegistry());
    expect(scheduler.operationCompletion?.value).toBe("a+b+c+d");
  });
  it("still postpones a live-lord decision with a never-shown dead seat", () => {
    const game = fixture();
    twoSurvivors(game);
    game.scenarioRoleShown.a = game.scenarioRoleShown.b = true;
    game.identities.a.actualHeadLord = game.identities.a.lord = true;
    game.generalCatalog["a-head"].lord = true;
    expect(perform(game, winnerRegistry()).operationCompletion?.value).toBe(
      null,
    );
  });
});

describe("directional native friendship prediction", () => {
  it.each([
    [
      "exactly half including actor",
      1,
      false,
      false,
      false,
      "lord",
      "wei",
      true,
    ],
    ["strict majority", 2, false, false, false, "lord", "wei", false],
    [
      "dead shown sibling still counts",
      2,
      true,
      false,
      false,
      "lord",
      "wei",
      false,
    ],
    [
      "living exposed lord bypasses majority",
      3,
      false,
      true,
      false,
      "lord",
      "wei",
      true,
    ],
    [
      "dead exposed lord gives no bypass",
      3,
      true,
      true,
      false,
      "lord",
      "wei",
      false,
    ],
    [
      "actor actual hidden lord bypasses majority",
      3,
      false,
      false,
      true,
      "lord",
      "wei",
      true,
    ],
    [
      "plain careerist seeming kingdom differs",
      1,
      false,
      false,
      false,
      "careerist",
      "wei",
      false,
    ],
    [
      "recruited careerist seeming kingdom differs",
      1,
      false,
      false,
      false,
      "careerist_b-head",
      "wei",
      false,
    ],
    [
      "other careerist prefix keeps faction seeming kingdom",
      1,
      false,
      false,
      false,
      "careeristOther",
      "wei",
      true,
    ],
    [
      "actual head kingdom differs",
      1,
      false,
      false,
      false,
      "lord",
      "shu",
      false,
    ],
  ] as const)(
    "%s",
    (
      _label,
      shownCount,
      deadSibling,
      siblingLord,
      ownLord,
      targetRole,
      actualKingdom,
      expected,
    ) => {
      const game = fixture(),
        predictions: boolean[] = [];
      game.currentPlayer = "a";
      game.identities.a.headKingdom = actualKingdom;
      game.generalCatalog["a-head"].kingdom = actualKingdom;
      for (const p of ["b", "c", "d"].slice(0, shownCount))
        game.scenarioRoleShown[p] = true;
      game.identities.b.role = targetRole;
      if (deadSibling) {
        game.alive.c = false;
        game.livingPlayers = ["a", "b", "d"];
      }
      if (siblingLord) {
        game.identities.c.actualHeadLord =
          game.identities.c.lord =
          game.identities.c.generalLord =
            true;
        game.identities.c.headShown = true;
        game.displayedGenerals.c.head = "c-head";
        game.generalCatalog["c-head"].lord = true;
      }
      if (ownLord) {
        game.identities.a.actualHeadLord = game.identities.a.lord = true;
        game.generalCatalog["a-head"].lord = true;
      }
      const registry = winnerRegistry({
        willBeFriend: (g, a, b) => {
          const predicted = willBeGeneralFriends(g, a, b);
          if (a === "a" && b === "b") predictions.push(predicted);
          return predicted;
        },
      });
      perform(game, registry);
      expect(predictions[0]).toBe(expected);
    },
  );
  it("never forecasts a shown nonfriend as a future ally", () => {
    const game = fixture(),
      results: boolean[] = [];
    game.currentPlayer = "a";
    game.scenarioRoleShown.a = game.scenarioRoleShown.b = true;
    game.identities.b.kingdom = "shu";
    perform(
      game,
      winnerRegistry({
        isFriend: (g, a, b) => {
          if (a === "a" && b === "b")
            results.push(willBeGeneralFriends(g, a, b));
          return areGeneralFriends(g, a, b);
        },
      }),
    );
    expect(results).toEqual([false]);
  });
});

describe("Room lord authority is distinct from Player lord authority", () => {
  it.each([false, true])(
    "raw registration lookup with includeDead=%s",
    (includeDead) => {
      const game = fixture(),
        lords: (string | null)[] = [];
      twoSurvivors(game);
      for (const p of game.seatOrder) game.scenarioRoleShown[p] = true;
      for (const p of ["c", "d"]) {
        game.identities[p].headShown = true;
        game.identities[p].actualHeadLord =
          game.identities[p].generalLord =
          game.identities[p].lord =
            true;
        game.displayedGenerals[p].head = `${p}-head`;
        game.generalCatalog[`${p}-head`].lord = true;
      }
      game.currentPlayer = "d";
      perform(
        game,
        winnerRegistry({
          getLord: (g, kingdom) => {
            const lord = generalRoomLord(g, kingdom, includeDead);
            lords.push(lord);
            return lord;
          },
        }),
      );
      expect(lords[0]).toBe(includeDead ? "c" : null);
    },
  );
  it("ignores a dead actual-hidden lord when no displayed lord exists", () => {
    const game = fixture(),
      lords: (string | null)[] = [];
    twoSurvivors(game);
    game.scenarioRoleShown.b = true;
    game.identities.c.actualHeadLord = game.identities.c.lord = true;
    game.generalCatalog["c-head"].lord = true;
    const scheduler = perform(
      game,
      winnerRegistry({
        getLord: (g, kingdom) => {
          const lord = generalRoomLord(g, kingdom, true);
          lords.push(lord);
          return lord;
        },
      }),
    );
    expect(lords[0]).toBe(null);
    expect(scheduler.operationCompletion?.value).toBe("a+b");
  });
  it("a displayed dead lord blocks a hidden actor through the native +10 count", () => {
    const game = fixture();
    twoSurvivors(game);
    game.scenarioRoleShown.b = game.scenarioRoleShown.c = true;
    game.identities.c.actualHeadLord =
      game.identities.c.generalLord =
      game.identities.c.lord =
        true;
    game.identities.c.headShown = true;
    game.displayedGenerals.c.head = "c-head";
    game.generalCatalog["c-head"].lord = true;
    expect(perform(game, winnerRegistry()).operationCompletion?.value).toBe(
      null,
    );
    expect(game.identities.a.headShown).toBe(false);
  });
});

function resumeChecked(
  game: Game,
  scheduler: ReturnType<typeof createTriggerScheduler>,
  registry: TriggerRegistry<Game>,
  actor: string,
  choice: string,
) {
  const prompt = getTriggerPrompt(scheduler, actor)!;
  expect(prompt).not.toBe(null);
  const before = JSON.stringify({ game, scheduler });
  for (const [replyActor, id, answer] of [
    [actor === "a" ? "b" : "a", prompt.id, choice],
    [actor, `${prompt.id}-old`, choice],
    [actor, prompt.id, "invalid"],
  ]) {
    expect(
      resumeTriggerPrompt(scheduler, game, registry, replyActor, {
        id,
        choice: answer,
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(before);
  }
  ({ game, scheduler } = JSON.parse(before));
  expect(
    resumeTriggerPrompt(scheduler, game, registry, actor, {
      id: prompt.id,
      choice,
    }),
  ).toBe(true);
  const after = JSON.stringify({ game, scheduler });
  expect(
    resumeTriggerPrompt(scheduler, game, registry, actor, {
      id: prompt.id,
      choice,
    }),
  ).toBe(false);
  expect(JSON.stringify({ game, scheduler })).toBe(after);
  return { game, scheduler };
}
describe("authority continuations and consuming boundaries", () => {
  it("JSON resumes native forced reveals without losing group friendship", () => {
    let game = fixture();
    twoSurvivors(game);
    game.scenarioRoleShown.a = game.scenarioRoleShown.b = true;
    game.identities.a.role = game.identities.b.role = "careerist_a-head";
    const registry = winnerRegistry();
    hook(registry, "DFDebut", ({ continuation }) =>
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
    let scheduler = perform(game, registry),
      pauses = 0;
    expect(game.identities.a.headShown).toBe(true);
    while (getTriggerPrompt(scheduler, "a")) {
      ({ game, scheduler } = resumeChecked(
        game,
        scheduler,
        registry,
        "a",
        "continue",
      ));
      if (++pauses > 4) throw new Error("fixture pause loop");
    }
    expect(pauses).toBe(4);
    expect(scheduler.operationCompletion?.value).toBe("a+b");
    expect(game.identities.b.role).toBe("careerist_a-head");
    expect(scheduler.frames).toEqual([]);
  });
  it("actual recruitment gives a hidden candidate scenario authority for later winner and punishment", () => {
    let game = fixture();
    game.identities.a.headKingdom = "careerist";
    game.generalCatalog["a-head"].kingdom = "careerist";
    game.identities.a.kingdom = "god";
    game.identities.a.role = "careerist";
    const registry = winnerRegistry({
      careerist: () => ({ name: "careerist-rule", data: null }),
    });
    registry.operations!.push(
      createKillPlayerOperation(),
      createCareeristOperation({
        hasShown: hasShownGeneral,
        showHead: (target) => ({
          name: "show-general",
          data: { target, triggerEvent: false },
        }),
      }),
      createCareeristChoiceOperation({
        request: (request) => ({ name: "ask-recruit", data: request }),
      }),
      {
        name: "ask-recruit",
        run: ({ operation, continuation, answer }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: String(record(operation.data).target),
                choices: ["no", "yes"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "return", value: answer?.choice ?? "no" },
      },
    );
    let scheduler = perform(game, registry, "careerist-rule");
    expect(game.identities.a.role).toBe("careerist_a-head");
    expect(
      getTriggerPrompt(scheduler, "c")?.choices.map((choice) => choice.id),
    ).toEqual(["no", "yes"]);
    ({ game, scheduler } = resumeChecked(
      game,
      scheduler,
      registry,
      "c",
      "yes",
    ));
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.scenarioRoleShown.c).toBe(true);
    expect(game.identities.c).toMatchObject({
      headShown: false,
      deputyShown: false,
      role: "careerist_a-head",
    });
    perform(game, registry, "reward-punish", { killer: "a", victim: "c" });
    expect(game.granted).toBe(-1);
    perform(game, registry, "kill-player", { target: "b", damage: null });
    perform(game, registry, "kill-player", { target: "d", damage: null });
    expect(game.livingPlayers).toEqual(["a", "c"]);
    expect(perform(game, registry).operationCompletion?.value).toBe("a+c");
    expect(game.identities.c.role).toBe("careerist_a-head");
  });
  it("retains shown state when winner reveal is interrupted", () => {
    const game = fixture(),
      registry = winnerRegistry();
    twoSurvivors(game);
    game.scenarioRoleShown.a = game.scenarioRoleShown.b = true;
    hook(registry, "DFDebut", () => ({
      kind: "interrupt",
      reason: "turn-broken",
    }));
    const scheduler = perform(game, registry);
    expect(scheduler.interruption?.reason).toBe("turn-broken");
    expect(game.identities.a.headShown).toBe(true);
    expect(game.identities.a.deputyShown).toBe(false);
    expect(game.identities.b.headShown).toBe(false);
  });
  it("reveals an actual careerist when an absent deputy has a stale shown flag", () => {
    const game = fixture(),
      registry = winnerRegistry();
    game.identities.a.headKingdom = "careerist";
    game.generalCatalog["a-head"].kingdom = "careerist";
    game.identities.a.role = "careerist";
    game.identities.a.kingdom = "god";
    game.identities.a.deputyShown = true;
    game.identities.a.deputy = "";
    game.generalNames.a = ["a-head"];
    game.displayedGenerals.a.deputy = "";
    registry.operations!.push(
      createCareeristOperation({
        hasShown: hasShownGeneral,
        showHead: (target) => ({
          name: "show-general",
          data: { target, triggerEvent: false },
        }),
      }),
      createCareeristChoiceOperation({
        request: () => ({ name: "accept-recruit", data: null }),
      }),
      { name: "accept-recruit", run: () => ({ kind: "return", value: "yes" }) },
    );
    expect(
      perform(game, registry, "careerist-rule").operationCompletion?.value,
    ).toBe(true);
    expect(game.identities.a.headShown).toBe(true);
    expect(game.identities.a.role).toBe("careerist_a-head");
    expect(game.scenarioRoleShown.c).toBe(true);
  });
  it("rejects a nonboolean careerist visibility getter before reveal", () => {
    const game = fixture(),
      registry = winnerRegistry();
    registry.operations!.push(
      createCareeristOperation({
        hasShown: () => JSON.parse("null"),
        showHead: () => ({ name: "unused", data: null }),
      }),
    );
    expect(() => perform(game, registry, "careerist-rule")).toThrow();
    expect(game.identities.a.headShown).toBe(false);
    expect(game.cardResources.roomTags.GlobalCareeristShow).toBeUndefined();
  });
  it("skips the careerist getter when every head is already shown", () => {
    const game = fixture(),
      registry = winnerRegistry();
    for (const p of game.seatOrder) game.identities[p].headShown = true;
    registry.operations!.push(
      createCareeristOperation({
        hasShown: () => {
          throw new Error("unconsumed getter");
        },
        showHead: () => ({ name: "unused", data: null }),
      }),
    );
    expect(
      perform(game, registry, "careerist-rule").operationCompletion?.value,
    ).toBe(false);
  });
  it("keeps careerist visibility callback mutations outside authoritative state", () => {
    const game = fixture(),
      registry = winnerRegistry();
    registry.operations!.push(
      createCareeristOperation({
        hasShown: (g) => {
          g.identities.a.headKingdom = "careerist";
          g.scenarioRoleShown.a = true;
          g.alive.a = false;
          return false;
        },
        showHead: () => ({ name: "unused", data: null }),
      }),
    );
    expect(
      perform(game, registry, "careerist-rule").operationCompletion?.value,
    ).toBe(false);
    expect(game.identities.a.headKingdom).toBe("wei");
    expect(game.scenarioRoleShown.a).toBe(false);
    expect(game.alive.a).toBe(true);
  });
  it("retains reward child effects without moving cards after an interrupted movement", () => {
    const game = fixture(),
      registry = rewardRegistry();
    game.scenarioRoleShown.a = true;
    game.identities.a.role = "careerist";
    hook(registry, "BeforeCardsMove", () => ({
      kind: "interrupt",
      reason: "turn-broken",
    }));
    const scheduler = perform(game, registry, "reward-punish", {
      killer: "a",
      victim: "b",
    });
    expect(scheduler.interruption?.reason).toBe("turn-broken");
    expect(game.granted).toBe(3);
    expect(game.cardZones.a.cards).toEqual([21]);
    expect(game.cardZones.draw.cards).toHaveLength(12);
  });
  it.each(["reward", "winner"])(
    "rejects a nonboolean %s visibility getter",
    (consumer) => {
      const game = fixture(),
        bad = () => JSON.parse("null");
      const registry =
        consumer === "reward"
          ? rewardRegistry({ hasShown: bad })
          : winnerRegistry({ hasShown: bad });
      expect(() =>
        perform(
          game,
          registry,
          consumer === "reward" ? "reward-punish" : "get-winner",
          consumer === "reward" ? { killer: "a", victim: "b" } : null,
        ),
      ).toThrow();
      expect(game.granted).toBe(0);
      expect(game.identities.a.headShown).toBe(false);
    },
  );
  it("keeps committed burial and earlier conversions when a later visibility getter is malformed", () => {
    const game = fixture(),
      registry = rewardRegistry();
    game.scenarioRoleShown.d = true;
    game.identities.c.generalLord = true;
    game.alive.c = false;
    registry.operations!.push(
      createBuryVictimOperation({
        hasShown: (g, p) =>
          p === "a" ? JSON.parse("null") : hasShownGeneral(g, p),
        bury: () => ({ name: "bury-effects", data: null }),
        reward: () => ({ name: "unused", data: null }),
        notifyRole: () => ({ name: "unused", data: null }),
      }),
      {
        name: "bury-effects",
        run: ({ game }) => {
          game.playerMarks.c.buried = 1;
          return { kind: "return", value: null };
        },
      },
    );
    expect(() =>
      perform(game, registry, "bury-victim", {
        target: "c",
        data: { who: "c", damage: null },
      }),
    ).toThrow();
    expect(game.playerMarks.c.buried).toBe(1);
    expect(game.identities.d.role).toBe("careerist");
    expect(game.identities.a.role).toBe("lord");
  });
  it("gives visibility callbacks a private copy without propagating their mutation", () => {
    const game = fixture();
    perform(
      game,
      rewardRegistry({
        hasShown: (g) => {
          g.alive.a = false;
          g.scenarioRoleShown.b = true;
          g.identities.a.role = "careerist";
          return true;
        },
      }),
      "reward-punish",
      { killer: "a", victim: "b" },
    );
    expect(game.alive.a).toBe(true);
    expect(game.scenarioRoleShown.b).toBe(false);
    expect(game.identities.a.role).toBe("lord");
    expect(game.granted).toBe(1);
  });
  it("dead killer skips malformed visibility without reward", () => {
    const game = fixture();
    game.alive.a = false;
    perform(
      game,
      rewardRegistry({
        hasShown: () => {
          throw new Error("unconsumed getter");
        },
      }),
      "reward-punish",
      { killer: "a", victim: "b" },
    );
    expect(game.granted).toBe(0);
  });
  it("sole survivor skips the multi-survivor visibility callback", () => {
    const game = fixture();
    game.livingPlayers = ["a"];
    game.alive.b = game.alive.c = game.alive.d = false;
    expect(
      perform(
        game,
        winnerRegistry({
          hasShown: () => {
            throw new Error("unconsumed getter");
          },
        }),
      ).operationCompletion?.value,
    ).toBe("a");
  });
  it.each(["null", "[]", '"wrong"'])(
    "rejects malformed scenario visibility %s at consumption",
    (invalid) => {
      const game = fixture();
      game.scenarioRoleShown.a = JSON.parse(invalid);
      expect(() =>
        perform(game, rewardRegistry(), "reward-punish", {
          killer: "a",
          victim: "b",
        }),
      ).toThrow(/scenario role/);
      expect(game.cardZones.a.cards).toEqual([21]);
    },
  );
  it("rejects malformed displayed deputy only when its shown branch is consumed", () => {
    const game = fixture();
    game.identities.a.deputyShown = true;
    game.displayedGenerals.a = JSON.parse("null");
    expect(() =>
      perform(game, rewardRegistry(), "reward-punish", {
        killer: "a",
        victim: "b",
      }),
    ).toThrow(/displayed deputy/);
    game.scenarioRoleShown.a = true;
    perform(game, rewardRegistry(), "reward-punish", {
      killer: "a",
      victim: "b",
    });
    expect(game.granted).toBe(1);
  });
});
