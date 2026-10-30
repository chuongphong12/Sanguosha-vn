import { describe, expect, it } from "vitest";
import { drawingSetup, records } from "./drawing-support";
import { createShowGeneralOperation } from "../../src/game/hegemony/general";
import {
  createPostHpReducedOperation,
  createPostHpReducedRule,
} from "../../src/game/hegemony/dying-rule";
import {
  createPhaseOperations,
  type Phase,
} from "../../src/game/hegemony/phases";
import { createAskCardDiscardOperation } from "../../src/game/hegemony/ask-card-use";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import type { SlashCard } from "../../src/game/hegemony/slash";
import { createHpLossOperation } from "../../src/game/hegemony/hp-loss";
import { createImperialOrderEffectOperation } from "../../src/game/hegemony/imperial-order";
import {
  resumeTriggerPrompt,
  getTriggerPrompt,
} from "../../src/game/hegemony/scheduler";
import {
  createRoomSkillBatchOperation,
  hasRoomSkill,
  createRoomSkillEventOperation,
  createRoomSkillEventRule,
} from "../../src/game/hegemony/room-skills";
import {
  createPhaseCleanupOperations,
  createPhaseCleanupRule,
} from "../../src/game/hegemony/phase-cleanup";
import {
  createMarkCleanupOperations,
  type RoomLedgerGame,
  type LimitMethod,
  clearRoomCardLimitations,
  hasRoomCardLimitation,
} from "../../src/game/hegemony/phase-state";
import {
  dispatchTriggerOperation,
  dispatchTriggerEvent,
  createTriggerScheduler,
  continueTriggerWork,
  unwindTriggerInterruption,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
function setup() {
  const f = drawingSetup();
  const game = Object.assign(f.game, {
    cardResources: f.game.cardResources!,
    pauses: 0,
    equipReply: null as SlashCard | null,
    ownedSkills: Object.fromEntries(
      f.game.seatOrder.map((p) => [
        p,
        {
          head: {} as Record<string, boolean>,
          deputy: {} as Record<string, boolean>,
        },
      ]),
    ),
    playerIntMarks: Object.fromEntries(
      f.game.seatOrder.map((p) => [p, {} as Record<string, number[]>]),
    ),
    playerStringMarks: Object.fromEntries(
      f.game.seatOrder.map((p) => [p, {} as Record<string, string[]>]),
    ),
    cardLimitations: Object.fromEntries(
      f.game.seatOrder.map((p) => [
        p,
        {} as Partial<Record<LimitMethod, string[]>>,
      ]),
    ),
  }) satisfies RoomLedgerGame;
  const registry: TriggerRegistry<typeof game> = {
    ...f.rules,
    version: "phase-cleanup-ce4e62b-v1",
    skills: [
      ...f.rules.skills,
      createPhaseCleanupRule(),
      createRoomSkillEventRule(),
    ],
    operations: [
      ...f.rules.operations!,
      ...createPhaseCleanupOperations<typeof game>({
        notify: (notice) => ({ name: "notice", data: notice }),
        skillExists: (name) => ["alpha", "beta"].includes(name),
        hasSkill: hasRoomSkill,
        imperialCard: (game, id) => ({
          type: "trick",
          name: game.wrappedCards![id].name,
          className: "ImperialOrder",
          skillName: "",
          materialIDs: [id],
          flags: [],
        }),
      }),
      createRoomSkillBatchOperation({
        definitions: {
          alpha: { visible: true, limitMark: "@alpha" },
          beta: { visible: true },
        },
        isEquipSkill: () => false,
        notify: (notice) => ({ name: "notice", data: notice }),
      }),
      createRoomSkillEventOperation({
        definitions: {
          alpha: { visible: true, limitMark: "@alpha", refilter: true },
          beta: { visible: true },
        },
        isEquipSkill: () => false,
        notify: (n) => ({ name: "notice", data: n }),
        filter: (target, reset) => ({
          name: "skill-filter",
          data: { target, reset },
        }),
      }),
      {
        name: "skill-filter",
        run: ({ game, operation }) => {
          game.trace.push({ filter: operation.data });
          return { kind: "return", value: null };
        },
      },
      createHpLossOperation({ notify: (n) => ({ name: "notice", data: n }) }),
      createAskCardDiscardOperation<typeof game>({
        discardZone: "discard",
        isAI: () => false,
        request: (r) => ({ name: "equipment-reply", data: r }),
        limited: (g, p) =>
          hasRoomCardLimitation(
            g,
            p,
            "discard",
            false,
            (s) => s === "EquipCard",
          ),
        validateResponse: (_p, card) => ({
          name: "validate-equip",
          data: card,
        }),
        resolve: (_g, card) => card,
        notify: () => null,
      }),
      {
        name: "equipment-reply",
        run: ({ game }) => ({ kind: "return", value: game.equipReply }),
      },
      {
        name: "validate-equip",
        run: ({ operation }) => ({ kind: "return", value: operation.data }),
      },
      createShowGeneralOperation({
        canShow: () => true,
        preshow: () => ({ name: "general-adapter", data: null }),
        change: () => ({ name: "general-adapter", data: null }),
        skills: () => ({ name: "general-adapter", data: null }),
        notify: () => ({ name: "general-adapter", data: null }),
        filter: () => ({ name: "general-adapter", data: null }),
      }),
      { name: "general-adapter", run: () => ({ kind: "return", value: null }) },
      createImperialOrderEffectOperation({
        discardZone: "discard",
        canShow: () => false,
        candidates: () => [],
        limited: () => false,
      }),
      ...createMarkCleanupOperations({
        notify: (notice) => ({ name: "notice", data: notice }),
      }),
    ],
  };
  return {
    game,
    registry,
    scheduler: createTriggerScheduler(game.seatOrder, registry.version),
  };
}
const effect = (to = "b") => ({
  from: null,
  to,
  card: {
    type: "trick",
    name: "imperial_order",
    className: "ImperialOrder",
    skillName: "",
    materialIDs: [],
    flags: [],
  },
  multiple: false,
  nullified: false,
  disresponsive: false,
});
function equipSetup() {
  const f = setup();
  f.game.cardZones.draw.cards = f.game.cardZones.draw.cards.filter(
    (id) => id !== 1 && id !== 2,
  );
  f.game.cardZones.b.cards = [1, 2];
  for (const id of [1, 2]) {
    Object.assign(f.game.wrappedCards![id], {
      name: "armor",
      className: "Armor",
    });
    f.game.cardResources.cards[String(id)] = {
      kind: "wrapped",
      id,
      key: String(id),
      isSlash: false,
      isNDTrick: false,
    };
  }
  const originals = Object.fromEntries(
    Object.entries(f.game.wrappedCards!).map(([id, w]) => [
      id,
      {
        name: w.name,
        className: w.className,
        suit: w.suit,
        number: w.number,
        skillName: w.skillName,
      },
    ]),
  );
  f.registry.operations = f.registry.operations!.filter(
    (op) => op.name !== "imperial-order-effect" && op.name !== "move-cards",
  );
  f.registry.operations.push(
    createCardMovementOperation(undefined, undefined, undefined, undefined, {
      originals,
    }),
    createImperialOrderEffectOperation({
      discardZone: "discard",
      canShow: () => false,
      candidates: () => [1, 2],
      limited: (g, p) =>
        hasRoomCardLimitation(g, p, "discard", false, (s) => s === "EquipCard"),
    }),
  );
  return f;
}
describe("Native phase cleanup", () => {
  it.each(["batch", "event"])(
    "rejects malformed filter metadata for the skill %s owner",
    (owner) => {
      const rules = {
        definitions: JSON.parse('{"bad":{"visible":true,"refilter":"yes"}}'),
        isEquipSkill: () => false,
        notify: () => null,
        filter: () => ({ name: "skill-filter", data: null }),
      };
      expect(() =>
        owner === "batch"
          ? createRoomSkillBatchOperation(rules)
          : createRoomSkillEventOperation(rules),
      ).toThrow("Invalid skill definitions");
    },
  );
  it("takes pending ImperialOrder from real movement and consumes it only once", () => {
    const { game, registry, scheduler } = setup();
    game.scenarioRoleShown.a = true;
    game.cardZones.draw.cards = game.cardZones.draw.cards.filter(
      (id) => id !== 0,
    );
    game.cardZones.a.cards = [0];
    game.cardZones.wugu = { owner: null, place: "wugu", cards: [] };
    registry.operations = registry.operations!.filter(
      (op) => op.name !== "move-cards",
    );
    registry.operations.push(
      createCardMovementOperation(undefined, undefined, undefined, {
        cardIDs: [0],
        wuguZone: "wugu",
      }),
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "move-cards",
        data: {
          moves: [
            {
              ids: [0],
              to: "discard",
              open: true,
              reason: { kind: "throw", actor: "a" },
            },
          ],
        },
      },
      "a",
    );
    expect(game.imperialOrder).toEqual({ invoke: true, cardID: 0 });
    expect(game.cardZones.wugu.cards).toEqual([0]);
    const change = {
      name: "phase-cleanup",
      data: {
        event: "EventPhaseChanging",
        target: "a",
        data: { from: "play", to: "not-active" },
      },
    };
    dispatchTriggerOperation(scheduler, game, registry, change, "a");
    for (const actor of ["b", "c"]) {
      const p = getTriggerPrompt(scheduler, actor)!;
      resumeTriggerPrompt(scheduler, game, registry, actor, {
        id: p.id,
        choice: "cancel",
      });
    }
    expect(game.hp).toEqual({ a: 4, b: 3, c: 3 });
    dispatchTriggerOperation(scheduler, game, registry, change, "a");
    expect(game.hp).toEqual({ a: 4, b: 3, c: 3 });
    expect(game.cardZones.wugu.cards).toEqual([0]);
    expect(
      Object.values(game.cardZones)
        .flatMap((z) => z.cards)
        .sort((a, b) => a - b),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it("restores a captured fallback/RNG after JSON even if ChoiceMade moves that card elsewhere", () => {
    const f = equipSetup(),
      registry = f.registry;
    let state = { game: f.game, scheduler: f.scheduler };
    registry.skills.push({
      id: "move-fallback",
      events: ["ChoiceMade"],
      priority: 20,
      rule: true,
      effect: ({ event, continuation }) =>
        continuation === null &&
        event.data === "skillChoice:imperial_order:dis_equip"
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: { moves: [{ ids: [2], to: "c", open: true }] },
              },
              continuation: true,
            }
          : { kind: "done", value: false },
    });
    dispatchTriggerOperation(
      state.scheduler,
      state.game,
      registry,
      { name: "imperial-order-effect", data: effect() },
      "a",
    );
    const p = getTriggerPrompt(state.scheduler, "b")!;
    state = JSON.parse(JSON.stringify(state));
    expect(
      resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
        id: p.id,
        choice: "dis_equip",
      }),
    ).toBe(true);
    expect(state.game.cardZones.discard.cards).toEqual([2]);
    expect(state.game.cardZones.b.cards).toEqual([1]);
    expect(state.game.cardZones.c.cards).toEqual([]);
    expect(state.game.pileRandom.state).toBe(3663131627);
  });
  it.each([-1, 0, 1])(
    "HP loss %s leaves an initially removed or dead actor untouched",
    (amount) => {
      for (const condition of ["removed", "dead"]) {
        const { game, registry, scheduler } = setup();
        if (condition === "removed") game.removed.b = true;
        else game.alive.b = false;
        const before = JSON.stringify(game);
        dispatchTriggerOperation(
          scheduler,
          game,
          registry,
          { name: "lose-hp", data: { target: "b", amount } },
          "a",
        );
        expect(JSON.stringify(game)).toBe(before);
      }
    },
  );
  it.each(["consumed", "zero", "negative"])(
    "PreHpLost %s stops loss before HP commit",
    (mode) => {
      const { game, registry, scheduler } = setup();
      registry.skills.push({
        id: "deny-loss",
        events: ["PreHpLost"],
        priority: 20,
        rule: true,
        effect: ({ event }) => {
          event.data = mode === "consumed" ? {} : mode === "zero" ? 0 : -1;
          return { kind: "done", value: mode === "consumed" };
        },
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "lose-hp", data: { target: "b", amount: 2 } },
        "a",
      );
      expect(game.hp.b).toBe(4);
      expect(game.trace).toEqual([]);
    },
  );
  it("captures mark names per type while rechecking their live values", () => {
    const { game, registry, scheduler } = setup();
    game.playerMarks.a = { "a-phase": 1, "z-phase": 2 };
    registry.operations = registry.operations!.map((op) =>
      op.name !== "notice"
        ? op
        : {
            name: "notice",
            run: ({ game, operation }) => {
              game.trace.push(operation.data);
              if (records([operation.data])[0]?.name === "a-phase") {
                game.playerMarks.a["a-phase"] = 9;
                game.playerMarks.a["new-phase"] = 5;
                game.playerMarks.a["z-phase"] = 0;
                game.playerIntMarks.a["new-phase"] = [2];
              }
              return { kind: "return", value: null };
            },
          },
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "clear-player-marks", data: { target: "a", suffix: "-phase" } },
      "a",
    );
    expect(game.playerMarks.a).toEqual({
      "a-phase": 9,
      "z-phase": 0,
      "new-phase": 5,
    });
    expect(game.playerIntMarks.a["new-phase"]).toEqual([]);
    expect(
      records(game.trace)
        .filter((n) => n.kind === "mark")
        .map((n) => n.name),
    ).toEqual(["a-phase", "new-phase"]);
  });
  it.each(["-phase", "-turn", "-round"])(
    "clears all three typed suffix ledgers for %s",
    (suffix) => {
      const { game, registry, scheduler } = setup();
      game.playerMarks.a["x" + suffix] = 2;
      game.playerIntMarks.a["i" + suffix] = [2];
      game.playerStringMarks.a["s" + suffix] = ["two"];
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "clear-player-marks", data: { target: "a", suffix } },
        "a",
      );
      expect(game.playerMarks.a["x" + suffix]).toBe(0);
      expect(game.playerIntMarks.a["i" + suffix]).toEqual([]);
      expect(game.playerStringMarks.a["s" + suffix]).toEqual([]);
    },
  );
  it("higher-priority consumption keeps SkipGameRule pending for a later real effect", () => {
    const { game, registry, scheduler } = setup();
    game.cardResources.roomTags.SkipGameRule = true;
    registry.skills.push({
      id: "consume-phase",
      events: ["EventPhaseStart"],
      priority: 30,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      { name: "EventPhaseStart", target: "a", data: null },
      "a",
    );
    expect(game.cardResources.roomTags.SkipGameRule).toBe(true);
  });
  it("null-current native allPlayers includes dead actors when clearing Finish multi-kill marks", () => {
    const { game, registry, scheduler } = setup();
    game.currentPlayer = null;
    game.alive.c = false;
    game.playerPhases.a = "finish";
    game.playerMarks.c.multi_kill_count = 3;
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "phase-cleanup",
        data: { event: "EventPhaseEnd", target: "a", data: null },
      },
      "a",
    );
    expect(game.playerMarks.c.multi_kill_count).toBe(0);
  });
  it("connects real phase lifecycle to history, typed marks, limitations and turn cleanup", () => {
    const { game, registry, scheduler } = setup();
    const room = Object.assign(game, {
      phaseQueues: Object.fromEntries(
        game.seatOrder.map((p) => [
          p,
          {
            index: 0,
            phases: [] as Phase[],
            states: [] as { phase: Phase; finished: boolean }[],
          },
        ]),
      ),
    });
    const rules: TriggerRegistry<typeof room> = {
      ...registry,
      operations: [
        ...registry.operations!,
        ...createPhaseOperations({ notify: () => null }),
      ],
    };
    room.playerHistory.a = { Slash: 2, Analeptic: 1 };
    room.playerMarks.a = { drank: 1, "x-phase": 1, "x-turn": 1, "x-Clear": 1 };
    room.playerIntMarks.b["x-phase"] = [3];
    room.cardLimitations.a = { use: ["Slash$1"] };
    dispatchTriggerOperation(
      scheduler,
      room,
      rules,
      { name: "play-phases", data: { target: "a", phases: ["play"] } },
      "a",
    );
    expect(room.playerHistory.a).toEqual({});
    expect(room.playerMarks.a).toEqual({
      drank: 0,
      "x-phase": 0,
      "x-turn": 0,
      "x-Clear": 0,
    });
    expect(room.playerIntMarks.b["x-phase"]).toEqual([]);
    expect(room.cardLimitations.a.use).toEqual([]);
    expect(room.playerPhases.a).toBe("not-active");
  });
  it("keeps raw owned-key membership separate from activation when processing limited marks", () => {
    const { game, registry, scheduler } = setup();
    game.ownedSkills.a.head.alpha = false;
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-skill-batch", data: { target: "a", skills: ["alpha!"] } },
      "a",
    );
    expect(game.acquiredSkills.a.deputy).toEqual(["alpha"]);
    expect(game.playerMarks.a["@alpha"]).toBe(1);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-skill-batch", data: { target: "a", skills: ["-alpha!"] } },
      "a",
    );
    expect(hasRoomSkill(game, "a", "alpha")).toBe(false);
    expect(game.playerMarks.a["@alpha"]).toBe(1);
  });
  it.each([false, true])(
    "acquireOnly=%s applies only to owned removal, not acquired removal",
    (acquireOnly) => {
      const { game, registry, scheduler } = setup();
      game.ownedSkills.a.head.beta = true;
      game.acquiredSkills.a.deputy = ["beta"];
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "room-skill-batch",
          data: { target: "a", skills: ["-beta", "-beta!"], acquireOnly },
        },
        "a",
      );
      expect(game.ownedSkills.a.head.beta).toBe(acquireOnly ? true : undefined);
      expect(game.acquiredSkills.a.deputy).toEqual([]);
    },
  );
  it("routes lethal loss into the actual PostHpReduced owner and rejects a missing rescue composition", () => {
    const { game, registry, scheduler } = setup();
    game.hp.b = 1;
    registry.skills.push(createPostHpReducedRule());
    registry.operations!.push(createPostHpReducedOperation());
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "lose-hp", data: { target: "b", amount: 1 } },
        "a",
      ),
    ).toThrow("Unknown scheduler operation");
    expect(game.hp.b).toBe(0);
  });
  it("shuffles force-discard candidates even when every candidate is limited", () => {
    const { game, registry, scheduler } = equipSetup();
    game.cardLimitations.b = { discard: ["EquipCard$1"] };
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "imperial-order-effect", data: effect() },
      "a",
    );
    expect(game.pileRandom.state).toBe(3663131627);
    const p = getTriggerPrompt(scheduler, "b")!;
    expect(p.choices.map((c) => c.id)).toEqual(["cancel"]);
    resumeTriggerPrompt(scheduler, game, registry, "b", {
      id: p.id,
      choice: "cancel",
    });
    expect(game.hp.b).toBe(3);
    clearRoomCardLimitations(game, "b", true);
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "imperial-order-effect", data: effect() },
      "a",
    );
    expect(getTriggerPrompt(scheduler, "b")!.choices.map((c) => c.id)).toEqual([
      "dis_equip",
      "cancel",
    ]);
  });
  it.each(["flags", "mark", "limitations", "removed", "skill", "limited-mark"])(
    "JSON resumes at %s notice without repeating committed cleanup",
    (kind) => {
      const f = setup(),
        registry = f.registry;
      let state = { game: f.game, scheduler: f.scheduler };
      registry.stepBudget = 3;
      state.game.playerPhases.a = "not-active";
      state.game.playerFlags.a = ["x"];
      state.game.playerMarks.a.drank = 1;
      state.game.playerIntMarks.a["x-turn"] = [1];
      state.game.cardLimitations.a = { discard: ["EquipCard$1"] };
      state.game.removed.a = true;
      state.game.acquiredSkills.a.head = ["alpha"];
      state.game.playerMarks.a["@alpha"] = 1;
      state.game.cardResources.roomTags.TurnSkillsFora = ["alpha"];
      registry.operations = registry.operations!.map((op) =>
        op.name !== "notice"
          ? op
          : {
              name: "notice",
              run: ({ game, operation, continuation }) => {
                if (continuation !== null)
                  return { kind: "return", value: null };
                game.trace.push(operation.data);
                if (
                  records([operation.data])[0]?.kind === kind &&
                  game.pauses === 0
                ) {
                  game.pauses++;
                  return {
                    kind: "prompt",
                    actor: "b",
                    choices: ["go"],
                    canCancel: false,
                    continuation: true,
                  };
                }
                return { kind: "return", value: null };
              },
            },
      );
      function drain() {
        for (let i = 0; state.scheduler.yielded && i < 1000; i++) {
          state = JSON.parse(JSON.stringify(state));
          expect(
            continueTriggerWork(state.scheduler, state.game, registry),
          ).toBe(true);
        }
        expect(state.scheduler.yielded).not.toBe(true);
      }
      dispatchTriggerOperation(
        state.scheduler,
        state.game,
        registry,
        {
          name: "phase-cleanup",
          data: { event: "EventPhaseStart", target: "a", data: null },
        },
        "a",
      );
      drain();
      const prompt = getTriggerPrompt(state.scheduler, "b")!;
      expect(prompt).not.toBeNull();
      expect(getTriggerPrompt(state.scheduler, "a")).toBeNull();
      state = JSON.parse(JSON.stringify(state));
      const before = JSON.stringify(state);
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "a", {
          id: prompt.id,
          choice: "go",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
          id: prompt.id,
          choice: "bad",
        }),
      ).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
          id: prompt.id,
          choice: "go",
        }),
      ).toBe(true);
      drain();
      expect(
        resumeTriggerPrompt(state.scheduler, state.game, registry, "b", {
          id: prompt.id,
          choice: "go",
        }),
      ).toBe(false);
      expect(state.game.pauses).toBe(1);
      expect(state.game.acquiredSkills.a.head).toEqual([]);
      expect(state.game.playerMarks.a.drank).toBe(0);
      expect(state.game.playerMarks.a["@alpha"]).toBe(0);
      expect(state.game.removed.a).toBe(false);
      expect(state.game.cardLimitations.a.discard).toEqual([]);
      expect(state.scheduler.frames).toEqual([]);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "preserves eager cleanup and remaining turn-skill tag on %s during removed event",
    (reason) => {
      const { game, registry, scheduler } = setup();
      registry.unwind = true;
      game.playerPhases.a = "not-active";
      game.removed.a = true;
      game.cardResources.roomTags.TurnSkillsFora = ["alpha"];
      game.acquiredSkills.a.head = ["alpha"];
      game.playerFlags.b = ["untouched"];
      registry.skills.push({
        id: "stop-removed",
        events: ["RemoveStateChanged"],
        priority: 20,
        rule: true,
        effect: () => ({ kind: "interrupt", reason }),
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "phase-cleanup",
          data: { event: "EventPhaseStart", target: "a", data: null },
        },
        "a",
      );
      const receipt = structuredClone(scheduler.interruption!);
      expect(
        unwindTriggerInterruption(scheduler, game, registry, receipt),
      ).toBe(true);
      expect(game.removed.a).toBe(false);
      expect(game.acquiredSkills.a.head).toEqual(["alpha"]);
      expect(game.cardResources.roomTags.TurnSkillsFora).toEqual(["alpha"]);
      expect(game.playerFlags.b).toEqual(["untouched"]);
    },
  );
  it.each([false, true])(
    "ImperialOrder composes real MethodDiscard with accepted=%s and a captured fallback",
    (accepted) => {
      const { game, registry, scheduler } = equipSetup();
      if (accepted)
        game.equipReply = {
          reference: "1",
          card: {
            type: "equip",
            name: "armor",
            className: "Armor",
            skillName: "",
            materialIDs: [1],
            flags: [],
          },
        };
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        { name: "imperial-order-effect", data: effect() },
        "a",
      );
      const before = game.pileRandom.state;
      expect(before).toBe(3663131627);
      const prompt = getTriggerPrompt(scheduler, "b")!;
      expect(prompt.choices.map((c) => c.id)).toEqual(["dis_equip", "cancel"]);
      expect(
        resumeTriggerPrompt(scheduler, game, registry, "b", {
          id: prompt.id,
          choice: "dis_equip",
        }),
      ).toBe(true);
      expect(game.cardZones.discard.cards).toHaveLength(1);
      if (accepted) expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.cardZones.b.cards).toHaveLength(1);
      expect(game.hp.b).toBe(4);
      expect(game.pileRandom.state).toBe(before);
      expect(scheduler.frames).toEqual([]);
    },
  );
  it("ImperialOrder shows a real general then draws one even when ChoiceMade rewrites its payload", () => {
    const { game, registry, scheduler } = setup();
    game.displayedGenerals.b.head = "anjiang";
    registry.operations = registry.operations!.filter(
      (op) => op.name !== "imperial-order-effect",
    );
    registry.operations.push(
      createImperialOrderEffectOperation({
        discardZone: "discard",
        canShow: () => true,
        candidates: () => [],
        limited: () => false,
      }),
    );
    registry.skills.push({
      id: "rewrite-choice",
      events: ["ChoiceMade"],
      priority: 20,
      rule: true,
      effect: ({ event }) => {
        event.data = "skillChoice:imperial_order:cancel";
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "imperial-order-effect", data: effect() },
      "a",
    );
    const prompt = getTriggerPrompt(scheduler, "b")!;
    resumeTriggerPrompt(scheduler, game, registry, "b", {
      id: prompt.id,
      choice: "show_head",
    });
    expect(game.identities.b.headShown).toBe(true);
    expect(game.displayedGenerals.b.head).toBe("b-head");
    expect(game.cardZones.b.cards).toEqual([0]);
    expect(game.hp.b).toBe(4);
  });
  it("HP loss uses rewritten PreHpLost then shared PostHpReduced data without rechecking death/removed", () => {
    const { game, registry, scheduler } = setup();
    registry.skills.push({
      id: "hp-observer",
      events: ["PreHpLost", "HpChanged", "PostHpReduced", "HpLost"],
      priority: 20,
      rule: true,
      effect: ({ game, event }) => {
        if (event.name === "PreHpLost") {
          event.data = 2;
          game.alive.b = false;
          game.removed.b = true;
        }
        if (event.name === "PostHpReduced") event.data = "after";
        game.trace.push({ hpEvent: event.name, data: event.data });
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "lose-hp", data: { target: "b", amount: 1 } },
      "a",
    );
    expect(game.hp.b).toBe(2);
    expect(records(game.trace).filter((n) => n.hpEvent)).toEqual([
      { hpEvent: "PreHpLost", data: 2 },
      { hpEvent: "HpChanged", data: null },
      { hpEvent: "PostHpReduced", data: "after" },
      { hpEvent: "HpLost", data: "after" },
    ]);
  });
  it("acquired limited-skill loss clears its mark and invokes the required reset filter", () => {
    const { game, registry, scheduler } = setup();
    game.acquiredSkills.a.head = ["alpha"];
    game.playerMarks.a["@alpha"] = 1;
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "room-skill-batch", data: { target: "a", skills: ["-alpha"] } },
      "a",
    );
    expect(game.playerMarks.a["@alpha"]).toBe(0);
    expect(records(game.trace)).toContainEqual({
      filter: { target: "a", reset: true },
    });
  });
  it("owned-only detach skips hidden/equipment skills while acquired entries bypass that gate", () => {
    const { game, registry, scheduler } = setup();
    registry.skills = registry.skills.filter(
      (skill) => skill.id !== "game-rule-room-skill-event",
    );
    registry.operations = registry.operations!.filter(
      (op) => op.name !== "room-skill-batch",
    );
    registry.operations.push(
      createRoomSkillBatchOperation({
        definitions: { hidden: { visible: false }, equip: { visible: true } },
        isEquipSkill: (_g, _p, n) => n === "equip",
        notify: () => null,
      }),
    );
    game.ownedSkills.a.head = { hidden: true, equip: true };
    game.acquiredSkills.a.head = ["hidden", "equip"];
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "room-skill-batch",
        data: {
          target: "a",
          skills: ["-hidden", "-equip", "-hidden", "-equip"],
        },
      },
      "a",
    );
    expect(game.ownedSkills.a.head).toEqual({ hidden: true, equip: true });
    expect(game.acquiredSkills.a.head).toEqual([]);
  });
  it("rejects malformed removed state before treating an actor as removed", () => {
    const { game, registry, scheduler } = setup();
    const malformed = JSON.parse(JSON.stringify(game));
    malformed.removed.a = "false";
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        malformed,
        registry,
        { name: "lose-hp", data: { target: "a", amount: 1 } },
        "a",
      ),
    ).toThrow("Invalid HP loss removed state");
  });
  it("rejects foreign ImperialOrder candidates before consuming RNG", () => {
    const { game, registry, scheduler } = setup();
    registry.operations = registry.operations!.filter(
      (op) => op.name !== "imperial-order-effect",
    );
    registry.operations.push(
      createImperialOrderEffectOperation({
        discardZone: "discard",
        canShow: () => false,
        candidates: () => [1],
        limited: () => false,
      }),
    );
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        registry,
        {
          name: "imperial-order-effect",
          data: {
            from: null,
            to: "b",
            card: {
              type: "trick",
              name: "imperial_order",
              className: "ImperialOrder",
              skillName: "",
              materialIDs: [],
              flags: [],
            },
            multiple: false,
            nullified: false,
            disresponsive: false,
          },
        },
        "a",
      ),
    ).toThrow("Invalid ImperialOrder candidates");
    expect(game.pileRandom.state).toBe(1);
  });
  it("emits RemoveStateChanged before consuming turn skills when removed resets", () => {
    const { game, registry, scheduler } = setup();
    game.playerPhases.a = "not-active";
    game.removed.b = true;
    game.acquiredSkills.b.head = ["alpha"];
    registry.skills.push({
      id: "removed-listener",
      events: ["RemoveStateChanged"],
      priority: 20,
      rule: true,
      effect: ({ game, event }) => {
        expect(event.target).toBe("b");
        game.cardResources.roomTags.TurnSkillsForb = ["alpha"];
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "phase-cleanup",
        data: { event: "EventPhaseStart", target: "a", data: null },
      },
      "a",
    );
    expect(game.acquiredSkills.b.head).toEqual([]);
    expect(game.cardResources.roomTags).not.toHaveProperty("TurnSkillsForb");
  });
  it("consumes pending ImperialOrder with real null-source effects and HP loss, without treasure creation", () => {
    const { game, registry, scheduler } = setup();
    game.imperialOrder = { invoke: true, cardID: 0 };
    game.scenarioRoleShown.a = true;
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "phase-cleanup",
        data: {
          event: "EventPhaseChanging",
          target: "a",
          data: { from: "play", to: "not-active" },
        },
      },
      "a",
    );
    expect(game.imperialOrder.invoke).toBe(false);
    for (const actor of ["b", "c"]) {
      const prompt = getTriggerPrompt(scheduler, actor)!;
      expect(prompt.choices.map((x) => x.id)).toEqual(["cancel"]);
      expect(
        resumeTriggerPrompt(scheduler, game, registry, actor, {
          id: prompt.id,
          choice: "cancel",
        }),
      ).toBe(true);
    }
    expect(game.hp).toEqual({ a: 4, b: 3, c: 3 });
    expect(game.wrappedCards).not.toHaveProperty("ImperialEdict");
    expect(game.cardZones.draw.cards).toHaveLength(12);
    expect(scheduler.frames).toEqual([]);
  });
  it("removes a captured turn-skill tag before batch detach and defers loss events until all mutations finish", () => {
    const { game, registry, scheduler } = setup();
    game.playerPhases.a = "not-active";
    game.acquiredSkills.a.head = ["alpha", "beta"];
    game.cardResources.roomTags.TurnSkillsFora = ["alpha", "beta"];
    registry.skills.push({
      id: "observe-skills",
      events: ["EventLoseSkill"],
      priority: 10,
      rule: true,
      effect: ({ game, event }) => {
        expect(game.cardResources!.roomTags).not.toHaveProperty(
          "TurnSkillsFora",
        );
        expect(game.acquiredSkills.a.head).toEqual([]);
        expect(hasRoomSkill(game, "a", "alpha")).toBe(false);
        game.trace.push({ lost: event.data });
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      {
        name: "EventPhaseStart",
        target: "a",
        data: null,
      },
      "a",
    );
    expect(
      records(game.trace).filter((n) => typeof n.lost === "string"),
    ).toEqual([{ lost: "alpha:head" }, { lost: "beta:head" }]);
  });
  it("NotActive Start clears all actors in current-first order using the real phase rule", () => {
    const { game, registry, scheduler } = setup();
    game.currentPlayer = "b";
    game.playerPhases.a = "not-active";
    game.alive.c = false;
    game.playerFlags.a = ["keep-until-end"];
    game.playerFlags.c = ["dead-flag"];
    game.playerMarks.a.drank = 1;
    game.playerMarks.b["x-turn"] = 2;
    game.playerIntMarks.c["x-turn"] = [1];
    game.playerStringMarks.a["x-turn"] = ["x"];
    game.removed.b = true;
    game.cardLimitations.a = { discard: ["EquipCard$1", "Slash$0"] };
    dispatchTriggerEvent(
      scheduler,
      game,
      registry,
      {
        name: "EventPhaseStart",
        target: "a",
        data: null,
      },
      "a",
    );
    expect(game.playerFlags.a).toEqual([]);
    expect(game.playerFlags.c).toEqual([]);
    expect(game.playerMarks.a.drank).toBe(0);
    expect(game.playerMarks.b["x-turn"]).toBe(0);
    expect(game.playerIntMarks.c["x-turn"]).toEqual([]);
    expect(game.playerStringMarks.a["x-turn"]).toEqual([]);
    expect(game.removed.b).toBe(false);
    expect(game.cardLimitations.a.discard).toEqual(["Slash$0"]);
    expect(
      records(game.trace)
        .filter((n) => n.kind === "flags")
        .map((n) => n.target),
    ).toEqual(["b", "c", "a"]);
  });
  it("Changing clears only positive numeric PhaseClear/Clear marks and preserves typed ledgers", () => {
    const { game, registry, scheduler } = setup();
    game.playerMarks.b = {
      "q-PhaseClear": 1,
      "b-Clear": 2,
      "negative-Clear": -1,
      keep: 2,
    };
    game.playerIntMarks.b = { "q-PhaseClear": [1], "b-Clear": [2] };
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "phase-cleanup",
        data: {
          event: "EventPhaseChanging",
          target: "a",
          data: { from: "play", to: "not-active" },
        },
      },
      "a",
    );
    expect(game.playerMarks.b).toEqual({
      "q-PhaseClear": 0,
      "b-Clear": 0,
      "negative-Clear": -1,
      keep: 2,
    });
    expect(game.playerIntMarks.b).toEqual({
      "q-PhaseClear": [1],
      "b-Clear": [2],
    });
    expect(records(game.trace)[0]).toEqual({
      kind: "history",
      target: null,
      name: "pushPile",
      times: 1,
    });
  });
  it("direct GameRule effect consumes SkipGameRule once before touching cleanup state", () => {
    const { game, registry, scheduler } = setup();
    game.cardResources.roomTags.SkipGameRule = true;
    game.playerHistory.a = { Slash: 1 };
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "phase-cleanup",
        data: { event: "EventPhaseEnd", target: "a", data: null },
      },
      "a",
    );
    expect(game.cardResources.roomTags).not.toHaveProperty("SkipGameRule");
    expect(game.playerHistory.a).toEqual({ Slash: 1 });
    expect(game.trace).toEqual([]);
  });
  it("Finish End clears Analeptic, alive multi-kill marks and all-player typed phase marks", () => {
    const { game, registry, scheduler } = setup();
    game.playerPhases.a = "finish";
    game.alive.c = false;
    game.playerHistory.a = { Analeptic: 1, Slash: 2 };
    game.playerMarks.a.multi_kill_count = 2;
    game.playerMarks.c.multi_kill_count = 3;
    game.playerIntMarks.c["list-phase"] = [1];
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      {
        name: "phase-cleanup",
        data: { event: "EventPhaseEnd", target: "a", data: null },
      },
      "a",
    );
    expect(game.playerHistory.a).toEqual({ Slash: 2 });
    expect(game.playerMarks.a.multi_kill_count).toBe(0);
    expect(game.playerMarks.c.multi_kill_count).toBe(3);
    expect(game.playerIntMarks.c["list-phase"]).toEqual([]);
  });
  it("uses the same limitation ledger for live legality and single-turn cleanup", () => {
    const { game } = setup();
    game.cardLimitations.a = {
      discard: ["EquipCard|.|.|hand$1", "Slash$0"],
      use: ["Peach$1"],
      response: ["Jink$0"],
    };
    expect(
      hasRoomCardLimitation(
        game,
        "a",
        "discard",
        true,
        (p) => p === "EquipCard|.|.|.",
      ),
    ).toBe(true);
    expect(hasRoomCardLimitation(game, "a", "none", false, () => true)).toBe(
      false,
    );
    clearRoomCardLimitations(game, "a", true);
    expect(
      hasRoomCardLimitation(
        game,
        "a",
        "discard",
        true,
        (p) => p === "EquipCard|.|.|.",
      ),
    ).toBe(false);
    expect(
      hasRoomCardLimitation(game, "a", "discard", false, (p) => p === "Slash"),
    ).toBe(true);
    expect(game.cardLimitations.a.response).toEqual(["Jink$0"]);
    clearRoomCardLimitations(game, "a", false);
    expect(game.cardLimitations.a.discard).toEqual([]);
  });
  it("clears positive numeric and nonempty typed suffix marks in native sorted-map order", () => {
    const { game, registry, scheduler } = setup();
    game.playerMarks.a = {
      "z-phase": 2,
      "a-phase": 1,
      "negative-phase": -2,
      keep: 3,
    };
    game.playerIntMarks.a = {
      "ints-phase": [2, 4],
      "empty-phase": [],
      keep: [3],
    };
    game.playerStringMarks.a = { "strings-phase": ["x"], keep: ["keep"] };
    dispatchTriggerOperation(
      scheduler,
      game,
      registry,
      { name: "clear-player-marks", data: { target: "a", suffix: "-phase" } },
      "a",
    );
    expect(game.playerMarks.a).toEqual({
      "z-phase": 0,
      "a-phase": 0,
      "negative-phase": -2,
      keep: 3,
    });
    expect(game.playerIntMarks.a).toEqual({
      "ints-phase": [],
      "empty-phase": [],
      keep: [3],
    });
    expect(game.playerStringMarks.a).toEqual({
      "strings-phase": [],
      keep: ["keep"],
    });
    expect(
      records(game.trace)
        .filter((n) => n.kind === "mark")
        .map((n) => n.name),
    ).toEqual(["a-phase", "z-phase", "ints-phase", "strings-phase"]);
  });
});
