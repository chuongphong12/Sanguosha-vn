import { describe, expect, it } from "vitest";
import {
  createSlashHitOperation,
  createSlashHitRule,
  createDamageDoneOperation,
  createDamageDoneRule,
  createDamageCompleteOperation,
  createDamageCompleteRule,
} from "../../src/game/hegemony/damage-rule";
import {
  createDamageOperation,
  type DamageGame,
  type Damage,
} from "../../src/game/hegemony/damage";
import type { SlashCard, SlashEffect } from "../../src/game/hegemony/slash";
import {
  createSlashOnUseOperation,
  createSlashOnEffectOperation,
  createSlashEffectOperation,
  createSlashResultOperation,
} from "../../src/game/hegemony/slash";
import {
  createSlashEffectedOperation,
  createSlashEffectedRule,
} from "../../src/game/hegemony/slash-response";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardEffectOperation } from "../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerSkill,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = DamageGame & {
  seen: { name: string; target: string | null; data: TriggerData }[];
};
function card(): SlashCard {
  return {
    reference: "slash",
    card: {
      type: "basic",
      name: "slash",
      className: "Slash",
      skillName: "",
      materialIDs: [],
      flags: [],
    },
  };
}
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    removed: { a: false, b: false, c: false },
    hp: { a: 10, b: 10, c: 10 },
    chained: { a: false, b: false, c: false },
    currentPlayer: "a",
    damageStack: [],
    playerMarks: { a: {}, b: {}, c: {} },
    playerFlags: { a: [], b: [], c: [] },
    cardZones: {},
    cardResources: {
      cards: {
        slash: {
          kind: "virtual",
          key: "slash-key",
          isSlash: true,
          isNDTrick: false,
          flags: [],
          tags: { addcardinality: 2, AddDamage_List: ["b", "c", "b"] },
        },
      },
      playerTags: { a: {}, b: { Qinggang: ["slash-key", "slash-key"] }, c: {} },
      roomTags: {},
    },
    seen: [],
  };
}
function slashEffect(): SlashEffect {
  return {
    from: "a",
    to: "b",
    slash: card(),
    jink: null,
    jink_num: 0,
    drank: 3,
    nature: "fire",
    nullified: false,
  };
}
function packet(): Damage {
  return {
    from: "a",
    to: "b",
    card: card(),
    damage: 2,
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
function dispatch(
  game: Game,
  rules: TriggerRegistry<Game>,
  name: string,
  data: TriggerData,
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(scheduler, game, rules, { name, data }, "a");
  return scheduler;
}
const damageEvents = [
  "ConfirmDamage",
  "Predamage",
  "DamageForseen",
  "DamageCaused",
  "DamageInflicted",
  "PreDamageDone",
  "DamageDone",
  "Damage",
  "Damaged",
  "DamageComplete",
];
function registry(): TriggerRegistry<Game> {
  return {
    version: "damage-ce4e62b",
    operations: [createDamageOperation()],
    skills: [
      {
        id: "observe",
        events: damageEvents,
        priority: 10,
        record: ({ game, event }) => {
          game.seen.push(structuredClone(event));
        },
        effect: () => ({ kind: "done", value: false }),
      },
    ],
  };
}
function completeRegistry(): TriggerRegistry<Game> {
  const rules = registry();
  rules.operations!.push(
    createDamageDoneOperation(),
    createDamageCompleteOperation(),
    createSlashHitOperation(),
  );
  rules.skills.push(
    createDamageDoneRule(),
    createDamageCompleteRule(),
    createSlashHitRule(),
    {
      id: "observe-extra",
      events: ["HpChanged", "ChainStateChanged", "PostHpReduced", "DFDebut"],
      priority: 10,
      record: ({ game, event }) => {
        game.seen.push(structuredClone(event));
      },
      effect: () => ({ kind: "done", value: false }),
    },
  );
  return rules;
}
describe("Hegemony normalized damage", () => {
  it("fans elemental damage out in current order and processes current debut flags after nested completion", () => {
    const game = fixture();
    game.currentPlayer = "c";
    game.chained = { a: true, b: true, c: true };
    game.playerFlags.a = ["Global_DFDebut"];
    game.playerFlags.c = ["Global_DFDebut"];
    dispatch(game, completeRegistry(), "damage", {
      ...packet(),
      nature: "fire",
      transfer: true,
      transfer_reason: "redirected",
      flags: ["keep"],
    });
    expect(game.hp).toEqual({ a: 8, b: 8, c: 8 });
    expect(game.chained).toEqual({ a: false, b: false, c: false });
    expect(game.cardResources.roomTags.is_chained).toBe(0);
    expect(
      game.seen.filter((event) => event.name === "DamageDone"),
    ).toMatchObject([
      { target: "b", data: { chain: false, transfer: true, flags: ["keep"] } },
      {
        target: "c",
        data: { chain: true, transfer: false, transfer_reason: "", flags: [] },
      },
      {
        target: "a",
        data: { chain: true, transfer: false, transfer_reason: "", flags: [] },
      },
    ]);
    expect(
      game.seen
        .filter((event) => event.name === "DFDebut")
        .map((event) => event.target),
    ).toEqual(["c", "a"]);
    expect(game.playerFlags.a).toEqual([]);
    expect(game.playerFlags.c).toEqual([]);
    expect(game.damageStack).toEqual([]);
  });
  it("applies latest damage to the event recipient, with HpChanged, elemental unchain and shared PostHpReduced", () => {
    const game = fixture();
    game.alive.a = false;
    game.chained.b = true;
    const rules = registry();
    rules.operations!.push(createDamageDoneOperation());
    rules.skills.push(createDamageDoneRule(), {
      id: "observe-hp",
      events: ["HpChanged", "ChainStateChanged", "PostHpReduced"],
      priority: 10,
      record: ({ game, event }) => {
        game.seen.push(structuredClone(event));
      },
      effect: () => ({ kind: "done", value: false }),
    });
    const scheduler = dispatch(game, rules, "damage-done", {
      target: "b",
      data: { ...packet(), to: "c", nature: "fire" },
    });
    expect(game.hp).toEqual({ a: 10, b: 8, c: 10 });
    expect(game.chained.b).toBe(false);
    expect(game.cardResources.roomTags.is_chained).toBe(1);
    expect(game.seen).toEqual([
      { name: "HpChanged", target: "b", data: null },
      { name: "ChainStateChanged", target: "b", data: null },
      {
        name: "PostHpReduced",
        target: "b",
        data: { ...packet(), to: "c", nature: "fire", from: null },
      },
    ]);
    expect(scheduler.operationCompletion?.value).toEqual({
      data: { ...packet(), to: "c", nature: "fire", from: null },
    });
  });
  it.each(["Predamage", "DamageForseen", "DamageCaused", "DamageInflicted"])(
    "stops normal damage and handles completion at native prevention boundary: %s",
    (name) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "prevent",
        events: [name],
        priority: 0,
        rule: true,
        effect: () => ({ kind: "done", value: true }),
      });
      dispatch(game, rules, "damage", packet());
      expect(game.seen.map((event) => event.name)).toEqual([
        ...damageEvents.slice(0, damageEvents.indexOf(name) + 1),
        ...(name === "Predamage" ? [] : ["DamageComplete"]),
      ]);
      expect(game.seen.at(-1)?.data).toMatchObject({
        prevented: name !== "Predamage",
      });
      expect(game.cardResources.playerTags.b.Qinggang).toEqual(["slash-key"]);
      expect(game.damageStack).toEqual([]);
      expect(game.cardResources.roomTags.SkipGameRule).toBe(
        name === "Predamage" ? undefined : true,
      );
    },
  );
  it("clears stale transfer before Inflicted, then runs a new transfer before prevented parent completion", () => {
    const game = fixture();
    game.cardResources.playerTags.b.TransferDamage = { ...packet(), to: "a" };
    const rules = registry();
    rules.skills.push({
      id: "transfer",
      events: ["DamageInflicted"],
      priority: 0,
      rule: true,
      effect: ({ game, event }) => {
        if (event.target !== "b") return { kind: "done", value: false };
        expect(game.cardResources.playerTags.b).not.toHaveProperty(
          "TransferDamage",
        );
        game.cardResources.playerTags.b.TransferDamage = {
          ...packet(),
          to: "c",
          transfer: true,
        };
        return { kind: "done", value: true };
      },
    });
    dispatch(game, rules, "damage", packet());
    expect(
      game.seen
        .filter((event) => event.name === "DamageDone")
        .map((event) => event.target),
    ).toEqual(["c"]);
    expect(
      game.seen.filter((event) => event.name === "DamageComplete"),
    ).toMatchObject([
      { target: "c", data: { prevented: false, transfer: true } },
      { target: "b", data: { prevented: true, transfer: false } },
    ]);
    expect(game.damageStack).toEqual([]);
  });
  it("dispatches the Room damage sequence with eager current tag and stack, then cleans normal completion", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "check-stack",
      events: ["PreDamageDone", "DamageComplete"],
      priority: 5,
      rule: true,
      effect: ({ game }) => {
        expect(game.damageStack).toEqual([packet()]);
        expect(game.cardResources.roomTags.CurrentDamageStruct).toEqual(
          packet(),
        );
        return { kind: "done", value: false };
      },
    });
    expect(
      dispatch(game, rules, "damage", packet()).operationCompletion?.value,
    ).toBeNull();
    expect(game.seen.map((event) => [event.name, event.target])).toEqual([
      ["ConfirmDamage", "a"],
      ["Predamage", "a"],
      ["DamageForseen", "b"],
      ["DamageCaused", "a"],
      ["DamageInflicted", "b"],
      ["PreDamageDone", "b"],
      ["DamageDone", "b"],
      ["Damage", "a"],
      ["Damaged", "b"],
      ["DamageComplete", "b"],
    ]);
    expect(game.cardResources.playerTags.b.Qinggang).toEqual(["slash-key"]);
    expect(game.damageStack).toEqual([]);
    expect(game.cardResources.roomTags).not.toHaveProperty(
      "CurrentDamageStruct",
    );
    expect(game.hp.b).toBe(10);
  });
  it("constructs source-derived Slash damage using current cardinality, drank and duplicate target bonuses", () => {
    const game = fixture();
    const rules: TriggerRegistry<Game> = {
      version: "damage-ce4e62b",
      skills: [createSlashHitRule()],
      operations: [
        createSlashHitOperation(),
        {
          name: "damage",
          run: ({ game, operation }) => {
            game.seen.push({
              name: "packet",
              target: null,
              data: operation.data,
            });
            return { kind: "return", value: null };
          },
        },
      ],
    };
    dispatch(game, rules, "slash-hit", { target: "a", data: slashEffect() });
    expect(game.seen).toEqual([
      {
        name: "packet",
        target: null,
        data: { ...packet(), damage: 8, nature: "fire" },
      },
    ]);
  });
});

function hook(
  rules: TriggerRegistry<Game>,
  name: string,
  effect: TriggerSkill<Game>["effect"],
) {
  rules.skills.push({
    id: `hook-${name}`,
    events: [name],
    priority: 5,
    rule: true,
    effect,
  });
}
describe("SlashHit signed arithmetic", () => {
  it.each([-2, -1])(
    "rejects intermediate underflow even when later bonuses recover the final range: %s",
    (drank) => {
      const game = fixture(),
        rules = completeRegistry(),
        scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const slash = game.cardResources.cards.slash;
      if (slash.kind !== "virtual")
        throw new Error("Expected fixture virtual Slash");
      slash.tags.addcardinality = -2147483648;
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          {
            name: "slash-hit",
            data: { target: "a", data: { ...slashEffect(), drank } },
          },
          "a",
        ),
      ).toThrow();
      expect({ game, scheduler }).toEqual(before);
    },
  );
});
describe("Damage snapshots and normalized boundaries", () => {
  it.each([
    [0, 10],
    [-2, 12],
    [12, -2],
  ])(
    "subtracts signed damage without clamping HP: %s",
    (damage, expectedHP) => {
      const game = fixture();
      dispatch(game, completeRegistry(), "damage", { ...packet(), damage });
      expect(game.hp.b).toBe(expectedHP);
      expect(game.seen.filter((e) => e.name === "HpChanged")).toHaveLength(1);
    },
  );
  it.each(["null", "dead", "removed"])(
    "skips an initial %s recipient without cleanup",
    (state) => {
      const game = fixture();
      const data = packet();
      if (state === "null") data.to = null;
      else if (state === "dead") game.alive.b = false;
      else game.removed.b = true;
      dispatch(game, completeRegistry(), "damage", data);
      expect(game.seen).toEqual([]);
      expect(game.cardResources.playerTags.b.Qinggang).toHaveLength(2);
    },
  );
  it("normalizes an initially dead source and omits DamageCaused and Damage", () => {
    const game = fixture();
    game.alive.a = false;
    dispatch(game, completeRegistry(), "damage", packet());
    expect(game.hp.b).toBe(8);
    expect(
      game.seen.some((e) => e.name === "DamageCaused" || e.name === "Damage"),
    ).toBe(false);
    expect(game.seen[0]).toMatchObject({ target: null, data: { from: null } });
  });
  it("ignores Confirm consumption and refreshes its rewritten local snapshot", () => {
    const game = fixture(),
      rules = completeRegistry();
    hook(rules, "ConfirmDamage", ({ event }) => {
      event.data = { ...packet(), to: "c", damage: 3 };
      return { kind: "done", value: true };
    });
    dispatch(game, rules, "damage", packet());
    expect(game.hp).toEqual({ a: 10, b: 10, c: 7 });
    expect(game.seen.find((e) => e.name === "DamageForseen")?.target).toBe("c");
  });
  it("keeps pre-Inflicted stack/recipient while CurrentDamageStruct and latest completion reflect rewrites", () => {
    const game = fixture(),
      rules = completeRegistry();
    hook(rules, "DamageInflicted", ({ event }) => {
      event.data = { ...packet(), to: "c", damage: 4 };
      return { kind: "done", value: false };
    });
    hook(rules, "PreDamageDone", ({ game, event }) => {
      expect(game.damageStack).toEqual([packet()]);
      expect(game.cardResources.roomTags.CurrentDamageStruct).toEqual({
        ...packet(),
        to: "c",
        damage: 4,
      });
      expect(event.target).toBe("b");
      return { kind: "done", value: true };
    });
    dispatch(game, rules, "damage", packet());
    expect(game.hp).toEqual({ a: 10, b: 6, c: 10 });
    expect(game.seen.find((e) => e.name === "DamageComplete")?.target).toBe(
      "c",
    );
  });
  it.each(["Predamage", "DamageForseen", "DamageCaused"])(
    "uses local cleanup and latest prevented completion after a consumed %s rewrite",
    (name) => {
      const game = fixture(),
        rules = completeRegistry();
      hook(rules, name, ({ event }) => {
        event.data = { ...packet(), to: "c" };
        return { kind: "done", value: true };
      });
      dispatch(game, rules, "damage", packet());
      expect(game.cardResources.playerTags.b.Qinggang).toHaveLength(1);
      expect(game.hp.b).toBe(10);
      expect(
        game.seen.filter((e) => e.name === "DamageComplete"),
      ).toMatchObject(
        name === "Predamage"
          ? []
          : [{ target: "c", data: { prevented: true } }],
      );
      expect(game.cardResources.roomTags).not.toHaveProperty("SkipGameRule");
    },
  );
  it("keeps the Room source after death while DamageDone clears it in shared data", () => {
    const game = fixture(),
      rules = completeRegistry();
    hook(rules, "PreDamageDone", ({ game }) => {
      game.alive.a = false;
      return { kind: "done", value: false };
    });
    dispatch(game, rules, "damage", packet());
    expect(game.seen.find((e) => e.name === "Damage")).toMatchObject({
      target: "a",
      data: { from: null },
    });
  });
  it("propagates PostHpReduced rewrites but ignores HpChanged data rewrites", () => {
    const game = fixture(),
      rules = completeRegistry();
    hook(rules, "HpChanged", ({ event }) => {
      event.data = null;
      return { kind: "done", value: true };
    });
    hook(rules, "PostHpReduced", ({ event }) => {
      event.data = { ...packet(), to: "c", damage: 7 };
      return { kind: "done", value: true };
    });
    dispatch(game, rules, "damage", packet());
    expect(game.hp.b).toBe(8);
    expect(game.seen.find((e) => e.name === "DamageComplete")).toMatchObject({
      target: "c",
      data: { damage: 7 },
    });
  });
  it.each([true, false])(
    "checks elemental chained state after HpChanged: %s",
    (value) => {
      const game = fixture(),
        rules = completeRegistry();
      game.chained.b = !value;
      hook(rules, "HpChanged", ({ game }) => {
        game.chained.b = value;
        return { kind: "done", value: false };
      });
      dispatch(game, rules, "damage-done", {
        target: "b",
        data: { ...packet(), nature: "thunder" },
      });
      expect(game.chained.b).toBe(false);
      expect(
        game.seen.filter((e) => e.name === "ChainStateChanged"),
      ).toHaveLength(value ? 1 : 0);
      expect(game.cardResources.roomTags.is_chained).toBe(
        value ? 1 : undefined,
      );
    },
  );
  it("cleans the current Slash key and ancestry at the cleanup boundary", () => {
    const game = fixture(),
      rules = completeRegistry();
    hook(rules, "PreDamageDone", ({ game }) => {
      game.cardResources.cards.slash.key = "changed";
      game.cardResources.playerTags.b.Qinggang = [
        "slash-key",
        "changed",
        "changed",
      ];
      return { kind: "done", value: false };
    });
    dispatch(game, rules, "damage", packet());
    expect(game.cardResources.playerTags.b.Qinggang).toEqual([
      "slash-key",
      "changed",
    ]);
  });
  it.each([null, { ...packet(), to: null }])(
    "skips absent transfer recipients after consumed Inflicted",
    (transfer) => {
      const game = fixture(),
        rules = completeRegistry();
      hook(rules, "DamageInflicted", ({ game }) => {
        game.cardResources.playerTags.b.TransferDamage = transfer;
        return { kind: "done", value: true };
      });
      dispatch(game, rules, "damage", packet());
      expect(game.hp).toEqual({ a: 10, b: 10, c: 10 });
      expect(game.seen.filter((e) => e.name === "DamageComplete")).toHaveLength(
        1,
      );
    },
  );
  it("restores the oldest remaining snapshot after three nested damages", () => {
    const game = fixture(),
      rules = completeRegistry();
    rules.skills.push({
      id: "nested",
      events: ["PreDamageDone"],
      priority: 5,
      rule: true,
      effect: ({ game, event, continuation }) => {
        const data = event.data as Damage;
        if (continuation !== null) {
          expect(game.cardResources.roomTags.CurrentDamageStruct).toEqual({
            ...packet(),
            reason: "outer",
          });
          return { kind: "done", value: false };
        }
        if (data.reason === "deep") return { kind: "done", value: false };
        return {
          kind: "operation",
          operation: {
            name: "damage",
            data: {
              ...packet(),
              to: data.reason === "outer" ? "c" : "a",
              reason: data.reason === "outer" ? "middle" : "deep",
            },
          },
          continuation: true,
        };
      },
    });
    dispatch(game, rules, "damage", { ...packet(), reason: "outer" });
    expect(game.hp).toEqual({ a: 8, b: 8, c: 8 });
    expect(game.damageStack).toEqual([]);
    expect(game.cardResources.roomTags).not.toHaveProperty(
      "CurrentDamageStruct",
    );
  });
  it.each([
    "from",
    "to",
    "damage",
    "nature",
    "chain",
    "transfer",
    "by_user",
    "prevented",
    "reason",
    "flags",
    "transfer_reason",
    "card",
  ])("rejects malformed %s before allocating a damage frame", (field) => {
    const game = fixture(),
      rules = completeRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = structuredClone({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "damage", data: { ...packet(), [field]: { invalid: true } } },
        "a",
      ),
    ).toThrow();
    expect({ game, scheduler }).toEqual(before);
  });
});

describe("Damage chain and debut snapshots", () => {
  it.each(["normal", "chain", "prevented"])(
    "does not fan out for %s completion",
    (mode) => {
      const game = fixture();
      game.chained.c = true;
      game.cardResources.roomTags.is_chained = 1;
      dispatch(game, completeRegistry(), "damage-complete", {
        target: "b",
        data: {
          ...packet(),
          nature: mode === "normal" ? "normal" : "fire",
          chain: mode === "chain",
          prevented: mode === "prevented",
        },
      });
      expect(game.hp.c).toBe(10);
      expect(game.cardResources.roomTags.is_chained).toBe(1);
    },
  );
  it("retains the living chain snapshot, checks late chains/removal, and takes a fresh debut order", () => {
    const game = fixture(),
      rules = completeRegistry();
    game.currentPlayer = "c";
    game.alive.a = false;
    game.chained = { a: true, b: false, c: true };
    game.cardResources.roomTags.is_chained = 1;
    hook(rules, "PreDamageDone", ({ game }) => {
      game.alive.a = true;
      game.chained.b = true;
      game.removed.b = true;
      game.currentPlayer = "b";
      game.playerFlags.a = ["Global_DFDebut"];
      return { kind: "done", value: false };
    });
    dispatch(game, rules, "damage-complete", {
      target: "b",
      data: { ...packet(), nature: "fire" },
    });
    expect(game.hp).toEqual({ a: 10, b: 10, c: 8 });
    expect(game.chained.a).toBe(true);
    expect(
      game.seen.filter((e) => e.name === "DFDebut").map((e) => e.target),
    ).toEqual(["a"]);
  });
  it("with null current includes dead seats and clears debut flags before each fixed-snapshot event", () => {
    const game = fixture(),
      rules = completeRegistry();
    game.currentPlayer = null;
    game.alive.a = false;
    game.playerFlags.a = ["Global_DFDebut"];
    game.playerFlags.b = ["Global_DFDebut"];
    hook(rules, "DFDebut", ({ game, event }) => {
      expect(game.playerFlags[event.target!]).not.toContain("Global_DFDebut");
      if (event.target === "a") {
        game.alive.b = false;
        game.playerFlags.c = ["Global_DFDebut"];
      }
      event.data = { ignored: true };
      return { kind: "done", value: true };
    });
    dispatch(game, rules, "damage-complete", { target: "b", data: packet() });
    expect(
      game.seen.filter((e) => e.name === "DFDebut").map((e) => e.target),
    ).toEqual(["a", "b", "c"]);
  });
  it.each(["slash-hit", "damage-done", "damage-complete"])(
    "skips global null target before payload parsing: %s",
    (name) => {
      const game = fixture();
      expect(
        dispatch(game, completeRegistry(), name, { target: null, data: null })
          .operationCompletion?.value,
      ).toBeNull();
      expect(game.seen).toEqual([]);
    },
  );
  it.each(["SlashHit", "DamageDone", "DamageComplete"])(
    "consumes SkipGameRule before parsing %s",
    (name) => {
      const game = fixture(),
        rules = completeRegistry();
      game.cardResources.roomTags.SkipGameRule = true;
      rules.operations!.push({
        name: "emit",
        run: ({ continuation }) =>
          continuation === null
            ? {
                kind: "event",
                event: { name, target: "b", data: null },
                continuation: true,
              }
            : { kind: "return", value: null },
      });
      dispatch(game, rules, "emit", null);
      expect(game.cardResources.roomTags).not.toHaveProperty("SkipGameRule");
      expect(game.hp.b).toBe(10);
    },
  );
});

describe("Damage serialized continuations", () => {
  it.each([
    ...damageEvents,
    "HpChanged",
    "ChainStateChanged",
    "PostHpReduced",
    "DFDebut",
  ])("resumes once after JSON reload at %s", (name) => {
    let game = fixture();
    game.chained = { a: true, b: true, c: true };
    game.playerFlags.c = ["Global_DFDebut"];
    const rules = completeRegistry();
    hook(rules, name, ({ continuation }) =>
      continuation === null
        ? {
            kind: "prompt",
            actor: "b",
            choices: ["continue"],
            canCancel: false,
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    let scheduler = dispatch(game, rules, "damage", {
      ...packet(),
      nature: "fire",
    });
    let iterations = 0;
    while (getTriggerPrompt(scheduler, "b")) {
      const prompt = getTriggerPrompt(scheduler, "b")!;
      const before = structuredClone({ game, scheduler });
      for (const actor of ["a", "b"]) {
        expect(
          resumeTriggerPrompt(scheduler, game, rules, actor, {
            id: actor === "a" ? prompt.id : "stale",
            choice: "continue",
          }),
        ).toBe(false);
        expect({ game, scheduler }).toEqual(before);
      }
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      const after = structuredClone({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect({ game, scheduler }).toEqual(after);
      if (++iterations > 10) throw new Error("Unexpected loop");
    }
    expect(iterations).toBeGreaterThan(0);
    expect(game.hp).toEqual({ a: 8, b: 8, c: 8 });
    expect(game.damageStack).toEqual([]);
    expect(scheduler.frames).toEqual([]);
    expect(game.seen.filter((e) => e.name === "DamageDone")).toHaveLength(3);
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "preserves eager stack, HP and tags after %s",
    (reason) => {
      const game = fixture(),
        rules = completeRegistry();
      hook(rules, "PostHpReduced", () => ({ kind: "interrupt", reason }));
      const scheduler = dispatch(game, rules, "damage", {
        ...packet(),
        nature: "fire",
      });
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(game.hp.b).toBe(8);
      expect(game.damageStack).toHaveLength(1);
      expect(game.cardResources.roomTags.CurrentDamageStruct).toEqual({
        ...packet(),
        nature: "fire",
      });
      expect(game.seen.some((e) => e.name === "DamageComplete")).toBe(false);
    },
  );
});

describe("Damage integration and late validation", () => {
  it.each([null, "HpChanged", "DamageComplete", "CardFinished"])(
    "composes material use, Slash without Jink, damage, HP and final cleanup: %s",
    (pause) => {
      let game = fixture();
      game.playerMarks.a.drank = 3;
      const slash = game.cardResources.cards.slash;
      if (slash.kind !== "virtual")
        throw new Error("Expected fixture virtual Slash");
      slash.tags = {};
      game.cardResources.playerTags.a["Jink_slash-key"] = [0];
      game.cardZones = {
        hand: { owner: "a", place: "hand", cards: [1] },
        table: { owner: null, place: "table", cards: [] },
        discard: { owner: null, place: "discard", cards: [] },
      };
      const rules = completeRegistry(),
        resources = { reference: () => "slash" };
      rules.operations!.push(
        createCardMovementOperation(),
        createSlashOnUseOperation({
          ...resources,
          repeatSlashCause: () => null,
        }),
        createCardOnUseOperation({
          tableZone: "table",
          discardZone: "discard",
        }),
        createCardUsedOperation({
          resources,
          use: (data) => ({ name: "card-use", data }),
        }),
        createCardUseOperation({
          ...resources,
          effect: (data) => ({ name: "card-effect", data }),
        }),
        createCardEffectOperation({ isSlash: () => true }),
        createCardEffectedOperation({
          isSlash: () => true,
          isTrick: () => false,
          cancel: () => {
            throw new Error("unused");
          },
          onEffect: (data) => ({ name: "slash-on-effect", data }),
        }),
        createSlashOnEffectOperation({ ...resources, nature: () => "fire" }),
        createSlashEffectOperation(),
        createSlashResultOperation(),
        createSlashEffectedOperation(),
      );
      rules.skills.push(
        createCardUsedRule(),
        createCardEffectedRule(),
        createCardFinishedRule(resources),
        createSlashEffectedRule(),
        {
          id: "observe-finish",
          events: ["CardFinished", "SlashHit"],
          priority: 10,
          record: ({ game, event }) => {
            game.seen.push(structuredClone(event));
          },
          effect: () => ({ kind: "done", value: false }),
        },
      );
      if (pause)
        hook(rules, pause, ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "b",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "done", value: false },
        );
      let scheduler = dispatch(game, rules, "slash-on-use", {
        from: "a",
        to: ["b"],
        card: { ...card().card, materialIDs: [1] },
        disresponsive_list: ["b"],
      });
      if (pause) {
        const prompt = getTriggerPrompt(scheduler, "b")!;
        expect(prompt).not.toBeNull();
        expect(game.cardZones.table.cards).toEqual([1]);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
      }
      expect(game.hp).toEqual({ a: 10, b: 6, c: 10 });
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.cardZones.table.cards).toEqual([]);
      expect(game.playerMarks.a.drank).toBe(0);
      expect(game.damageStack).toEqual([]);
      expect(scheduler.frames).toEqual([]);
      expect(game.seen.filter((e) => e.name === "CardFinished")).toHaveLength(
        1,
      );
      expect(game.seen.filter((e) => e.name === "SlashHit")).toHaveLength(1);
    },
  );
  it("runs player priority-zero rewrites before the damage GameRule", () => {
    const game = fixture(),
      rules = completeRegistry();
    rules.operations!.push({
      name: "emit",
      run: ({ continuation }) =>
        continuation === null
          ? {
              kind: "event",
              event: { name: "DamageDone", target: "b", data: packet() },
              continuation: true,
            }
          : { kind: "return", value: null },
    });
    rules.skills.push({
      id: "player-zero",
      events: ["DamageDone"],
      priority: 0,
      triggerable: () => [
        {
          actor: "b",
          owner: "b",
          slot: null,
          target: "b",
          occurrence: "adjust",
          compulsory: true,
          shown: true,
        },
      ],
      effect: ({ event }) => {
        event.data = { ...packet(), damage: 5 };
        return { kind: "done", value: false };
      },
    });
    const scheduler = dispatch(game, rules, "emit", null);
    const prompt = getTriggerPrompt(scheduler, "b")!;
    expect(prompt.kind).toBe("order");
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      }),
    ).toBe(true);
    expect(game.hp.b).toBe(5);
  });
  it("ignores terminal Complete payload rewrites while unwinding the Room stack", () => {
    const game = fixture(),
      rules = registry();
    hook(rules, "DamageComplete", ({ event }) => {
      event.data = null;
      return { kind: "done", value: true };
    });
    expect(
      dispatch(game, rules, "damage", packet()).operationCompletion?.value,
    ).toBeNull();
    expect(game.damageStack).toEqual([]);
  });
  it.each(["transfer", "chain"])(
    "resumes nested %s damage after JSON reload",
    (mode) => {
      let game = fixture();
      game.chained.c = mode === "chain";
      game.chained.b = mode === "chain";
      const rules = completeRegistry();
      if (mode === "transfer")
        hook(rules, "DamageInflicted", ({ game, event }) => {
          if (event.target !== "b") return { kind: "done", value: false };
          game.cardResources.playerTags.b.TransferDamage = {
            ...packet(),
            to: "c",
            transfer: true,
          };
          return { kind: "done", value: true };
        });
      hook(rules, "PostHpReduced", ({ event, continuation }) =>
        event.target === "c" && continuation === null
          ? {
              kind: "prompt",
              actor: "b",
              choices: ["continue"],
              canCancel: false,
              continuation: true,
            }
          : { kind: "done", value: false },
      );
      let scheduler = dispatch(game, rules, "damage", {
        ...packet(),
        nature: "fire",
      });
      const prompt = getTriggerPrompt(scheduler, "b")!;
      expect(prompt).not.toBeNull();
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(game.hp.c).toBe(8);
      expect(game.hp.b).toBe(mode === "chain" ? 8 : 10);
      expect(game.damageStack).toEqual([]);
      expect(scheduler.frames).toEqual([]);
    },
  );
  it.each(["normal", "fire", "thunder"])(
    "accepts a null damage card for %s",
    (nature) => {
      const game = fixture();
      dispatch(game, completeRegistry(), "damage", {
        ...packet(),
        card: null,
        nature,
      });
      expect(game.hp.b).toBe(8);
      expect(game.cardResources.playerTags.b.Qinggang).toHaveLength(2);
    },
  );
  it.each(["overflow", "tags", "list", "card"])(
    "rejects invalid SlashHit %s before frame allocation",
    (mode) => {
      const game = fixture(),
        rules = completeRegistry(),
        scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      let data: TriggerData = slashEffect();
      const slash = game.cardResources.cards.slash;
      if (slash.kind !== "virtual")
        throw new Error("Expected fixture virtual Slash");
      if (mode === "overflow") slash.tags.addcardinality = 2147483647;
      if (mode === "tags") slash.tags.addcardinality = "invalid";
      if (mode === "list") slash.tags.AddDamage_List = [false];
      if (mode === "card") data = { ...slashEffect(), slash: null };
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "slash-hit", data: { target: "a", data } },
          "a",
        ),
      ).toThrow();
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it("retains eager armor cleanup when a late transfer packet is malformed", () => {
    const game = fixture(),
      rules = completeRegistry();
    hook(rules, "DamageInflicted", ({ game }) => {
      game.cardResources.playerTags.b.TransferDamage = { invalid: true };
      return { kind: "done", value: true };
    });
    expect(() => dispatch(game, rules, "damage", packet())).toThrow(
      "Invalid damage player",
    );
    expect(game.cardResources.playerTags.b.Qinggang).toHaveLength(1);
    expect(game.hp.b).toBe(10);
  });
  it("rejects HP overflow before a standalone DamageDone frame", () => {
    const game = fixture(),
      rules = completeRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    game.hp.b = -2147483648;
    const before = structuredClone({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "damage-done", data: { target: "b", data: packet() } },
        "a",
      ),
    ).toThrow();
    expect({ game, scheduler }).toEqual(before);
  });
  it("rejects elemental fanout without current before decrementing its counter", () => {
    const game = fixture(),
      rules = completeRegistry(),
      scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    game.currentPlayer = null;
    game.cardResources.roomTags.is_chained = 1;
    const before = structuredClone({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "damage-complete",
          data: { target: "b", data: { ...packet(), nature: "fire" } },
        },
        "a",
      ),
    ).toThrow("current player");
    expect({ game, scheduler }).toEqual(before);
  });
});
