import { describe, expect, it } from "vitest";
import {
  createHegemonyMatch,
  type MatchContent,
  type HegemonyMatch,
} from "../../src/game/hegemony/match";
import {
  handoffMatchTurn,
  type BattleRoom,
  type BattleHandoff,
} from "../../src/game/hegemony/match-handoff";
import { createMatchTurn } from "../../src/game/hegemony/match-turn";
import { createNormalTurnOperations } from "../../src/game/hegemony/turn-order";
import {
  createTurnStartOperations,
  createTurnStartRule,
} from "../../src/game/hegemony/turn-start";
import { createPhaseOperations } from "../../src/game/hegemony/phases";
import {
  createPhaseCleanupOperations,
  createPhaseCleanupRule,
} from "../../src/game/hegemony/phase-cleanup";
import {
  createMarkCleanupOperations,
  hasRoomCardLimitation,
} from "../../src/game/hegemony/phase-state";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import { createDrawPhaseOperation } from "../../src/game/hegemony/draw-phase";
import { createDrawCardsOperation } from "../../src/game/hegemony/draw-cards";
import {
  createDrawCardOperation,
  createGetNCardsOperation,
  createSwapPileOperation,
} from "../../src/game/hegemony/draw-pile";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createFreeChainOperation } from "../../src/game/hegemony/general-rewards";
import { createAskGeneralShowOperation } from "../../src/game/hegemony/ask-general-show";
import { createShowGeneralOperation } from "../../src/game/hegemony/general";
import { createPlayPhaseOperation } from "../../src/game/hegemony/play-phase";
import { createCardCommandAdmission } from "../../src/game/hegemony/card-command";
import { createDiscardPhaseOperation } from "../../src/game/hegemony/discard-phase";
import { createRuleDiscardAdmission } from "../../src/game/hegemony/rule-discard";
import {
  resumeTriggerPrompt,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

function setup(count = 2, pauseStartup = false) {
  const players = Array.from({ length: count }, (_, i) => String(i));
  const content: MatchContent = {
    version: "INTERNAL-handoff-content-v1",
    companions: [],
    generals: players.flatMap((p) => [
      { id: `${p}-head`, kingdoms: ["wei"], headMaxHp: 3, deputyMaxHp: 3 },
      { id: `${p}-deputy`, kingdoms: ["wei"], headMaxHp: 3, deputyMaxHp: 3 },
    ]),
    cards: Array.from({ length: count * 4 + 8 }, (_, i) => ({
      id: 100 + i * 3,
      face: {
        name: "jink",
        className: "Jink",
        suit: "heart",
        number: (i % 13) + 1,
        skillName: "",
      },
      isSlash: false,
      isNDTrick: false,
    })),
  };
  const module = createHegemonyMatch({
    content,
    registryVersion: "INTERNAL-handoff-startup-v1",
    startup: {
      settings: {
        image: false,
        viewDeputy: false,
        mode: "hegemony",
        luckLimit: 0,
      },
      visibleSkills: () => [],
      hasLordSkill: () => false,
      globalSkills: [],
      hasPlayerStartup: () => pauseStartup,
      winner: {
        showGeneral: () => {
          throw Error("No startup reveal fixture");
        },
        careerist: () => {
          throw Error("No startup careerist fixture");
        },
      },
    },
    skills: pauseStartup
      ? [
          {
            id: "fixture-player-startup",
            events: ["GameStart"],
            priority: 20,
            rule: true,
            effect: ({ event, operationChild }) =>
              operationChild
                ? { kind: "done", value: false }
                : {
                    kind: "operation",
                    operation: {
                      name: "fixture-startup-pause",
                      data: event.target,
                    },
                    continuation: true,
                  },
          },
        ]
      : [],
    operations: pauseStartup
      ? [
          {
            name: "fixture-startup-pause",
            run: ({ operation, continuation }) => {
              if (typeof operation.data !== "string")
                throw Error("Expected player startup");
              return continuation === null
                ? {
                    kind: "prompt",
                    actor: operation.data,
                    choices: ["ack"],
                    canCancel: false,
                    continuation: true,
                  }
                : { kind: "return", value: null };
            },
          },
        ]
      : [],
  });
  let state = module.create({
    offers: Object.fromEntries(
      players.map((p) => [p, [`${p}-head`, `${p}-deputy`]]),
    ),
    drawPile: content.cards.map((c) => c.id),
    randomState: 37,
  });
  for (const actor of players) {
    const next = module.apply(state, actor, {
      kind: "choose-pair",
      choice: { head: `${actor}-head`, deputy: `${actor}-deputy` },
    });
    if (!next) throw Error("Pair rejected");
    state = next;
  }
  if (state.phase !== "room") throw Error("Missing prepared Room");
  const piles = {
    drawZone: "draw",
    reservedZone: "reserved",
    discardZone: "discard",
    notify: () => null,
  };
  const play = createCardCommandAdmission<BattleRoom, string>(
    {
      inPlay: (g, p) => g.playerPhases[p] === "play",
      contextValid: () => true,
      offers: () => [],
      enabled: () => false,
      skillAllowed: () => false,
      matchesPattern: () => false,
      materialAllowed: () => false,
      targetFilter: () => false,
      prohibited: () => false,
      feasible: () => false,
    },
    (actor) => actor,
  );
  const discard = createRuleDiscardAdmission<BattleRoom, string>(
    { discardZone: "discard", isJilei: () => false, focus: () => null },
    (actor) => actor,
  );
  const registry: TriggerRegistry<BattleRoom> = {
    version: "INTERNAL-handoff-battle-v1",
    unwind: true,
    stepBudget: 7,
    skills: [
      createTurnStartRule(),
      createPhaseCleanupRule(),
      createPhaseBodyRule(),
    ],
    operations: [
      ...createNormalTurnOperations<BattleRoom>(),
      ...createTurnStartOperations<BattleRoom>({
        battleRoyal: false,
        playerCount: count,
        notify: () => null,
      }),
      ...createPhaseOperations<BattleRoom>({ notify: () => null }),
      ...createMarkCleanupOperations({ notify: () => null }),
      ...createPhaseCleanupOperations<BattleRoom>({
        notify: () => null,
        skillExists: () => false,
        hasSkill: () => false,
        imperialCard: () => null,
      }),
      ...createPhaseBodyOperations<BattleRoom>({
        tableZone: "table",
        card: () => {
          throw Error("Empty Judge fixture");
        },
        onNullified: () => {
          throw Error("Empty Judge fixture");
        },
      }),
      createDrawPhaseOperation(),
      createDrawCardsOperation(),
      createGetNCardsOperation(piles),
      createDrawCardOperation(piles),
      createSwapPileOperation(piles),
      createCardMovementOperation(),
      createFreeChainOperation<BattleRoom>({
        kill: () => {
          throw Error("No free-chain death fixture");
        },
        companion: () => false,
        maxHp: (g, p) => g.maxHp[p],
      }),
      createAskGeneralShowOperation<BattleRoom>({
        enableLordConversion: false,
        canShow: () => true,
        lordAvailable: () => false,
        changeToLord: () => {
          throw Error("No lord fixture");
        },
        notify: () => null,
      }),
      createShowGeneralOperation<BattleRoom>({
        canShow: () => true,
        preshow: () => ({ name: "fixture-general-hook", data: null }),
        change: () => ({ name: "fixture-general-hook", data: null }),
        skills: () => ({ name: "fixture-general-hook", data: null }),
        notify: () => ({ name: "fixture-general-hook", data: null }),
        filter: () => ({ name: "fixture-general-hook", data: null }),
      }),
      {
        name: "fixture-general-hook",
        run: () => ({ kind: "return", value: null }),
      },
      createPlayPhaseOperation<BattleRoom>({
        context: () => "handoff-turn",
        pendingSurrender: () => null,
        notify: () => null,
      }),
      play.operation,
      createDiscardPhaseOperation<BattleRoom>({
        maxCards: (g, p) => Math.max(0, g.hp[p]),
        choice: () => {
          throw Error("No reward-token fixture");
        },
        notify: () => null,
      }),
      discard.operation,
    ],
  };
  return { module, prepared: state, content, players, registry, play, discard };
}
function finishTurn(
  f: ReturnType<typeof setup>,
  initial: BattleHandoff,
  restore = false,
) {
  const owner = createMatchTurn(f.registry);
  let battle = initial,
    steps = 0;
  if (
    (battle.turn.stage === "normal" || battle.turn.stage === "recovery") &&
    !battle.turn.waiting
  )
    expect(owner.advance(battle)).toBe(true);
  while (
    (battle.turn.stage === "normal" || battle.turn.stage === "recovery") &&
    battle.turn.waiting
  ) {
    expect(++steps).toBeLessThan(10000);
    if (restore) {
      battle = JSON.parse(JSON.stringify(battle));
      owner.validate(battle);
    }
    const p = battle.scheduler.prompt;
    if (!p) {
      expect(owner.advance(battle)).toBe(true);
      continue;
    }
    const play = f.play.view(battle.scheduler, p.actor),
      discard = f.discard.view(battle.scheduler, p.actor);
    const choice = play
      ? null
      : discard
        ? (discard.choices.find((c) => c.action === "confirm") ??
            discard.choices.find((c) => c.action === "card"))!.id
        : "cancel";
    const reply = { id: p.id, choice };
    const accepted = play
      ? f.play.submit(battle.scheduler, battle.room, f.registry, p.actor, reply)
      : discard
        ? f.discard.submit(
            battle.scheduler,
            battle.room,
            f.registry,
            p.actor,
            reply,
          )
        : resumeTriggerPrompt(
            battle.scheduler,
            battle.room,
            f.registry,
            p.actor,
            reply,
          );
    expect(accepted).toBe(true);
  }
  return battle;
}

describe("startup to battle handoff", () => {
  it("consumes an actual prepared Room once, without dealing again or allocating scheduler IDs", () => {
    const f = setup(),
      room = f.prepared.room,
      scheduler = f.prepared.scheduler,
      nextId = scheduler.nextId;
    const cards = structuredClone(room.cardZones),
      random = structuredClone(room.pileRandom);
    const battle = handoffMatchTurn(
      f.prepared,
      f.registry,
      f.content.cards.map((c) => c.id),
    );
    expect(battle.schemaVersion).toBe("hegemony-match-v3");
    expect(battle.phase).toBe("battle");
    expect(battle.room).toBe(room);
    expect(battle.scheduler).toBe(scheduler);
    expect(battle.room.cardZones).toEqual(cards);
    expect(battle.room.pileRandom).toEqual(random);
    expect(battle.scheduler.nextId).toBe(nextId);
    expect(battle.scheduler.registryVersion).toBe(f.registry.version);
    expect(battle.scheduler.completion).toBeNull();
    expect(battle.turn).toEqual({ stage: "normal", waiting: false });
    expect(battle.room.faceUp).toEqual({ "0": true, "1": true });
    expect(battle.room.engineCardFlags[100]).toEqual([]);
    createMatchTurn(f.registry).validate(battle);
  });
  it("preserves trusted startup ledgers and a face-down actor rather than resetting their facts", () => {
    const f = setup();
    const existing = {
      faceUp: { "0": false, "1": true },
      playerIntMarks: { "0": { keep: [7] }, "1": {} },
      playerStringMarks: { "0": { keep: ["x"] }, "1": {} },
      cardLimitations: { "0": { use: ["limit"] }, "1": {} },
      engineCardFlags: Object.fromEntries(
        f.content.cards.map((c) => [
          c.id,
          c.id === 100 ? ["startup-flag"] : [],
        ]),
      ),
      phaseQueues: {
        "0": { phases: [], states: [], index: 0 },
        "1": { phases: [], states: [], index: 0 },
      },
      turnOrder: { stage: "regular" as const, anchor: null },
    };
    Object.assign(f.prepared.room, existing);
    const battle = handoffMatchTurn(
      f.prepared,
      f.registry,
      f.content.cards.map((c) => c.id),
    );
    expect(battle.room.faceUp).toBe(existing.faceUp);
    expect(battle.room.playerIntMarks).toBe(existing.playerIntMarks);
    expect(battle.room.playerStringMarks).toBe(existing.playerStringMarks);
    expect(battle.room.cardLimitations).toBe(existing.cardLimitations);
    expect(battle.room.engineCardFlags).toBe(existing.engineCardFlags);
    expect(battle.room.phaseQueues).toBe(existing.phaseQueues);
    expect(battle.room.turnOrder).toBe(existing.turnOrder);
    const cards = structuredClone(battle.room.cardZones);
    const result = finishTurn(f, battle, true);
    expect(result.room.faceUp["0"]).toBe(true);
    expect(result.room.cardZones).toEqual(cards);
    expect(result.room.playerMarks["0"].Global_RoundCount).toBeUndefined();
    expect(result.room.playerIntMarks["0"].keep).toEqual([7]);
    expect(result.room.engineCardFlags[100]).toEqual(["startup-flag"]);
  });
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
    "starts a real first turn after public paired setup/dealing with %i seats",
    (count) => {
      const f = setup(count);
      expect(f.module.view(f.prepared, "0").stage).toBe("prepared");
      const battle = handoffMatchTurn(
        f.prepared,
        f.registry,
        f.content.cards.map((c) => c.id),
      );
      const result = finishTurn(f, battle, true);
      expect(result.turn).toEqual({ stage: "normal", waiting: false });
      expect(result.room.playerMarks["0"].Global_TurnCount).toBe(1);
      expect(result.room.playerPhases["0"]).toBe("not-active");
      expect(result.room.cardZones["hand:0"].cards).toEqual([
        109,
        100 + 12 * count,
        103 + 12 * count,
      ]);
      expect(result.room.cardZones.discard.cards).toEqual([106, 103, 100]);
      expect(result.room.cardZones.draw.cards).toHaveLength(6);
      for (const p of f.players.slice(1))
        expect(result.room.cardZones[`hand:${p}`].cards).toHaveLength(4);
      expect(
        Object.values(result.room.cardZones)
          .flatMap((z) => z.cards)
          .sort((a, b) => a - b),
      ).toEqual(f.content.cards.map((c) => c.id));
    },
  );
  it.each([
    "starting",
    "table",
    "prompt",
    "interruption",
    "yield",
    "unwind",
    "unwind-completion",
    "result",
    "completion",
    "actor",
    "identity",
    "phase",
    "inventory",
    "wrapper",
    "face-map",
    "turn-cursor",
    "int-marks",
    "string-marks",
    "limitations",
    "engine-flags",
    "phase-queue",
  ] as const)(
    "rejects the invalid %s boundary without changing the candidate",
    (kind) => {
      const f = setup(),
        saved = JSON.parse(JSON.stringify(f.prepared));
      if (kind === "starting")
        saved.startup = { stage: "players", index: 0, waiting: true };
      if (kind === "table") saved.scheduler.registryVersion = "foreign-startup";
      if (kind === "prompt")
        saved.scheduler.prompt = {
          id: "prompt-1",
          frameId: "event-1",
          actor: "0",
          choices: [],
          canCancel: false,
          kind: "step",
        };
      if (kind === "interruption")
        saved.scheduler.interruption = {
          id: "interruption-1",
          eventId: "event-1",
          reason: "turn-broken",
        };
      if (kind === "yield") saved.scheduler.yielded = true;
      if (kind === "unwind")
        saved.scheduler.unwind = {
          interruption: {
            id: "interruption-1",
            eventId: "event-1",
            reason: "turn-broken",
          },
          boundary: null,
        };
      if (kind === "unwind-completion")
        saved.scheduler.unwindCompletion = {
          id: "interruption-1",
          eventId: "event-1",
          reason: "turn-broken",
        };
      if (kind === "result") saved.room.gameResult = "0";
      if (kind === "completion")
        saved.scheduler.completion.event.name = "EventPhaseEnd";
      if (kind === "actor") saved.room.currentPlayer = null;
      if (kind === "identity") saved.scheduler.nextId = 0;
      if (kind === "phase") saved.room.playerPhases["0"] = "play";
      if (kind === "inventory") saved.room.cardZones["hand:0"].cards.push(100);
      if (kind === "wrapper") delete saved.room.wrappedCards[100];
      if (kind === "face-map") saved.room.faceUp = { "0": false };
      if (kind === "turn-cursor")
        saved.room.turnOrder = { stage: "extra", anchor: "0" };
      if (kind === "int-marks")
        saved.room.playerIntMarks = { "0": { bad: ["text"] }, "1": {} };
      if (kind === "string-marks")
        saved.room.playerStringMarks = { "0": { bad: [1] }, "1": {} };
      if (kind === "limitations")
        saved.room.cardLimitations = { "0": { unknown: ["x"] }, "1": {} };
      if (kind === "engine-flags") saved.room.engineCardFlags = {};
      if (kind === "phase-queue")
        saved.room.phaseQueues = {
          "0": {
            phases: ["unknown"],
            states: [{ phase: "unknown", finished: false }],
            index: 0,
          },
          "1": { phases: [], states: [], index: 0 },
        };
      const snapshot = JSON.stringify(saved);
      expect(() =>
        handoffMatchTurn(
          saved,
          f.registry,
          f.content.cards.map((c) => c.id),
        ),
      ).toThrow();
      expect(JSON.stringify(saved)).toBe(snapshot);
    },
  );
  it.each([
    "duplicate",
    "negative",
    "missing",
    "unbounded",
    "freeze",
    "no-rule",
    "double-draw",
    "reuse-global",
    "reuse-full",
  ] as const)(
    "rejects %s profile/catalog configuration before handoff",
    (kind) => {
      const f = setup(),
        ids = f.content.cards.map((c) => c.id);
      if (kind === "duplicate") ids.push(ids[0]);
      if (kind === "negative") ids.push(-1);
      if (kind === "missing") ids.shift();
      if (kind === "unbounded") delete f.registry.stepBudget;
      if (kind === "freeze") f.registry.unwind = false;
      if (kind === "reuse-global")
        f.registry.version = `${f.prepared.registryVersion}:startup-global`;
      if (kind === "reuse-full")
        f.registry.version = `${f.prepared.registryVersion}:startup-full`;
      if (kind === "no-rule")
        f.registry.skills = f.registry.skills.filter(
          (s) => s.id !== "game-rule-turn-start",
        );
      if (kind === "double-draw")
        f.registry.skills.push({
          id: "game-rule-draw-phase",
          events: ["EventPhaseProceeding"],
          priority: 0,
          rule: true,
          effect: () => ({ kind: "done", value: false }),
        });
      const snapshot = JSON.stringify(f.prepared);
      expect(() => handoffMatchTurn(f.prepared, f.registry, ids)).toThrow();
      expect(JSON.stringify(f.prepared)).toBe(snapshot);
    },
  );
  it("rejects a repeated handoff and retains the new single owner table", () => {
    const f = setup();
    const battle = handoffMatchTurn(
      f.prepared,
      f.registry,
      f.content.cards.map((c) => c.id),
    );
    const snapshot = JSON.stringify(battle);
    expect(() =>
      handoffMatchTurn(
        f.prepared,
        f.registry,
        f.content.cards.map((c) => c.id),
      ),
    ).toThrow();
    expect(JSON.stringify(battle)).toBe(snapshot);
    expect(() => f.module.view(f.prepared, "0")).toThrow();
  });
  it("initializes catalogue flags for disabled physical IDs that are absent from Room zones", () => {
    const f = setup();
    const battle = handoffMatchTurn(f.prepared, f.registry, [
      ...f.content.cards.map((c) => c.id),
      99999,
    ]);
    expect(battle.room.engineCardFlags[99999]).toEqual([]);
    expect(
      Object.values(battle.room.cardZones).flatMap((z) => z.cards),
    ).not.toContain(99999);
  });
  it.each([1, 10000])(
    "keeps the first turn resumable after handoff with budget %i",
    (budget) => {
      const f = setup();
      f.registry.stepBudget = budget;
      const battle = handoffMatchTurn(
        f.prepared,
        f.registry,
        f.content.cards.map((c) => c.id),
      );
      expect(battle.battleSettings.stepBudget).toBe(budget);
      const result = finishTurn(f, battle, true);
      expect(result.room.cardZones["hand:0"].cards).toEqual([109, 124, 127]);
      expect(result.room.playerMarks["0"].Global_TurnCount).toBe(1);
      expect(result.room.pileRandom.state).toBe(37);
      expect(result.scheduler.nextId).toBeGreaterThan(battle.scheduler.nextId);
    },
  );
  it("does not hand off a real pending player-startup prompt, then transfers after all startups complete", () => {
    const f = setup(2, true);
    const initial = JSON.stringify(f.prepared);
    expect(f.module.view(f.prepared, "0").stage).toBe("starting");
    expect(() =>
      handoffMatchTurn(
        f.prepared,
        f.registry,
        f.content.cards.map((c) => c.id),
      ),
    ).toThrow();
    expect(JSON.stringify(f.prepared)).toBe(initial);
    let state: HegemonyMatch = f.prepared,
      answers = 0;
    while (state.phase === "room" && state.scheduler.prompt) {
      const prompt = state.scheduler.prompt;
      const next = f.module.apply(state, prompt.actor, {
        kind: "answer",
        id: prompt.id,
        choice: "ack",
      });
      if (!next) throw Error("Startup reply rejected");
      state = next;
      answers++;
    }
    expect(answers).toBe(2);
    if (state.phase !== "room") throw Error("Expected startup Room");
    const nextId = state.scheduler.nextId;
    const battle = handoffMatchTurn(
      state,
      f.registry,
      f.content.cards.map((c) => c.id),
    );
    expect(battle.scheduler.nextId).toBe(nextId);
    for (const p of f.players)
      expect(battle.room.cardZones[`hand:${p}`].cards).toHaveLength(4);
    expect(battle.room.cardZones.draw.cards).toHaveLength(8);
  });
  it("copies the supplied catalogue identity instead of retaining a mutable configuration array", () => {
    const f = setup(),
      ids = f.content.cards.map((c) => c.id);
    const battle = handoffMatchTurn(f.prepared, f.registry, ids);
    ids.push(99999);
    expect(battle.battleSettings.physicalIds).not.toContain(99999);
    expect(battle.room.engineCardFlags[99999]).toBeUndefined();
  });
  it("preserves an absent optional limitation value accepted by the real limitation authority", () => {
    const f = setup();
    const limitations = { "0": { use: undefined }, "1": {} };
    Object.assign(f.prepared.room, { cardLimitations: limitations });
    const battle = handoffMatchTurn(
      f.prepared,
      f.registry,
      f.content.cards.map((c) => c.id),
    );
    expect(battle.room.cardLimitations).toBe(limitations);
    expect(
      hasRoomCardLimitation(battle.room, "0", "use", true, () => true),
    ).toBe(false);
  });
  it("executes the offered RoundStart reveal through the real show-general owner after handoff", () => {
    const f = setup();
    f.registry.stepBudget = 10000;
    const battle = handoffMatchTurn(
      f.prepared,
      f.registry,
      f.content.cards.map((c) => c.id),
    );
    expect(createMatchTurn(f.registry).advance(battle)).toBe(true);
    const prompt = battle.scheduler.prompt!;
    expect(prompt.choices.map((c) => c.id)).toContain("show_head_general");
    expect(
      resumeTriggerPrompt(battle.scheduler, battle.room, f.registry, "0", {
        id: prompt.id,
        choice: "show_head_general",
      }),
    ).toBe(true);
    expect(battle.room.identities["0"].headShown).toBe(true);
    const result = finishTurn(f, battle, true);
    expect(result.room.playerPhases["0"]).toBe("not-active");
  });
});
