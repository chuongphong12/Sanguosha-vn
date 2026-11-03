import { describe, expect, it } from "vitest";
import { drawingSetup, type DrawingGame } from "./drawing-support";
import {
  createDiscardPhaseOperation,
  type DiscardPhaseGame,
} from "../../src/game/hegemony/discard-phase";
import { createRuleDiscardAdmission } from "../../src/game/hegemony/rule-discard";
import { createRewardTokenCostOperation } from "../../src/game/hegemony/reward-tokens";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import { createPhaseOperations } from "../../src/game/hegemony/phases";
import {
  createTriggerScheduler,
  continueTriggerWork,
  dispatchTriggerOperation,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  type TriggerData,
  type TriggerRegistry,
  type OperationStep,
} from "../../src/game/hegemony/scheduler";

type Game = DrawingGame &
  DiscardPhaseGame & {
    blocked: number[];
    notices: TriggerData[];
    pauseNotices: boolean;
  };
function setup(hand: number[]) {
  const f = drawingSetup();
  const game: Game = {
    ...f.game,
    phaseQueues: {},
    blocked: [],
    notices: [],
    pauseNotices: false,
  };
  game.playerPhases.a = "discard";
  game.cardZones.draw.cards = game.cardZones.draw.cards.filter(
    (id) => !hand.includes(id),
  );
  game.cardZones.a.cards = [...hand];
  game.cardZones.table = { place: "table", owner: null, cards: [] };
  const admission = createRuleDiscardAdmission<Game, string>(
    {
      discardZone: "discard",
      isJilei: (g, _target, id) => g.blocked.includes(id),
      focus: () => null,
    },
    (actor) => actor,
  );
  const registry: TriggerRegistry<Game> = {
    version: "discard-phase-ce4e62b",
    skills: [
      createPhaseBodyRule(),
      {
        id: "discard-observer",
        events: ["ChoiceMade"],
        priority: 20,
        rule: true,
        effect: ({ game, event }) => {
          game.trace.push(event.data);
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      ...f.rules.operations!,
      ...createPhaseOperations<Game>({ notify: () => null }),
      ...createPhaseBodyOperations<Game>({
        tableZone: "table",
        card: () => {
          throw Error("No Judge fixture");
        },
        onNullified: () => {
          throw Error("No Judge fixture");
        },
      }),
      createRewardTokenCostOperation(),
      admission.operation,
      createDiscardPhaseOperation<Game>({
        maxCards: (g, target) =>
          Math.max(
            0,
            g.hp[target] + (g.playerMarks[target].Global_MaxcardsIncrease ?? 0),
          ),
        choice: (request) => ({ name: "token-choice-fixture", data: request }),
        notify: (notice) => ({ name: "token-notice-fixture", data: notice }),
      }),
      {
        name: "token-notice-fixture",
        run: ({ game, operation, continuation }): OperationStep => {
          if (continuation === null) {
            game.notices.push(operation.data);
            if (game.pauseNotices)
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
      {
        name: "token-choice-fixture",
        run: ({ operation, continuation, answer }): OperationStep => {
          const request = operation.data;
          if (
            !request ||
            typeof request !== "object" ||
            Array.isArray(request) ||
            typeof request.player !== "string" ||
            typeof request.skill !== "string"
          )
            throw Error("Invalid fixture choice");
          if (continuation === null)
            return {
              kind: "prompt",
              actor: request.player,
              choices: ["yes", "no"],
              canCancel: false,
              continuation: { stage: "answered" },
            };
          const c = continuation as { stage: string; choice?: string };
          if (c.stage === "answered")
            return {
              kind: "event",
              event: {
                name: "ChoiceMade",
                target: request.player,
                data: `skillChoice:${request.skill}:${answer!.choice}`,
              },
              continuation: { stage: "done", choice: answer!.choice! },
            };
          return { kind: "return", value: c.choice! };
        },
      },
    ],
  };
  return {
    game,
    registry,
    admission,
    scheduler: createTriggerScheduler(game.seatOrder, registry.version),
  };
}
type Fixture = ReturnType<typeof setup>;
function start(f: Fixture) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "discard-phase", data: { target: "a", data: null } },
      "a",
    ),
  ).toBe(true);
}
function answer(f: Fixture, choice: "yes" | "no") {
  const p = f.scheduler.prompt!;
  expect(
    resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
      id: p.id,
      choice,
    }),
  ).toBe(true);
}
function discard(f: Fixture, ids: number[]) {
  for (const id of ids) {
    const view = f.admission.view(f.scheduler, "a")!;
    const choice = view.choices.find(
      (c) => c.action === "card" && c.cardId === id,
    )!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: view.id,
        choice: choice.id,
      }),
    ).toBe(true);
  }
  const view = f.admission.view(f.scheduler, "a")!;
  const confirm = view.choices.find((choice) => choice.action === "confirm")!;
  expect(
    f.admission.submit(f.scheduler, f.game, f.registry, "a", {
      id: view.id,
      choice: confirm.id,
    }),
  ).toBe(true);
}
describe("Discard phase body", () => {
  it.each([1, 7, 10000])(
    "restores choices, mark notices and mandatory selection under scheduler budget %s",
    (budget) => {
      let f = setup([0, 1, 2, 3, 4, 5, 6, 7]);
      f.game.hp.a = 3;
      f.game.playerMarks.a["@halfmaxhp"] = 1;
      f.game.playerMarks.a["@careerist"] = 1;
      f.game.pauseNotices = true;
      f.registry.stepBudget = budget;
      start(f);
      let choiceCount = 0;
      for (let i = 0; i < 5000 && f.scheduler.frames.length; i++) {
        f = {
          ...f,
          ...JSON.parse(
            JSON.stringify({ game: f.game, scheduler: f.scheduler }),
          ),
        };
        if (f.scheduler.yielded) {
          expect(continueTriggerWork(f.scheduler, f.game, f.registry)).toBe(
            true,
          );
          continue;
        }
        const selection = f.admission.view(f.scheduler, "a");
        if (selection) {
          const next =
            selection.choices.find(
              (c) => c.action === "card" && c.cardId === 0,
            ) ?? selection.choices.find((c) => c.action === "confirm")!;
          expect(
            f.admission.submit(f.scheduler, f.game, f.registry, "a", {
              id: selection.id,
              choice: next.id,
            }),
          ).toBe(true);
          continue;
        }
        const p = f.scheduler.prompt!;
        const option = p.actor === "a" ? (choiceCount++, "yes") : "go";
        const before = structuredClone({
          game: f.game,
          scheduler: f.scheduler,
        });
        expect(
          resumeTriggerPrompt(
            f.scheduler,
            f.game,
            f.registry,
            p.actor === "a" ? "b" : "a",
            { id: p.id, choice: option },
          ),
        ).toBe(false);
        expect({ game: f.game, scheduler: f.scheduler }).toEqual(before);
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, p.actor, {
            id: p.id,
            choice: option,
          }),
        ).toBe(true);
      }
      expect(f.scheduler.frames).toEqual([]);
      expect(choiceCount).toBe(2);
      expect(f.game.playerMarks.a["@halfmaxhp"]).toBe(0);
      expect(f.game.playerMarks.a["@careerist"]).toBe(0);
      expect(f.game.playerMarks.a.Global_MaxcardsIncrease).toBe(4);
      expect(f.game.cardZones.discard.cards).toEqual([0]);
      expect(f.game.notices).toHaveLength(10);
      expect(f.game.trace).toEqual([
        "skillChoice:halfmaxhp:yes",
        "skillChoice:careerman:yes",
        "cardDiscard:gamerule:$0",
      ]);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "abandons the pending token choice on %s without spending the mark",
    (reason) => {
      const f = setup([0, 1, 2, 3, 4]);
      f.game.hp.a = 3;
      f.game.playerMarks.a["@halfmaxhp"] = 1;
      f.registry.unwind = true;
      f.registry.skills.push({
        id: "interrupt-choice",
        events: ["ChoiceMade"],
        priority: 30,
        rule: true,
        effect: () => ({ kind: "interrupt", reason }),
      });
      start(f);
      answer(f, "yes");
      expect(f.scheduler.interruption?.reason).toBe(reason);
      expect(
        unwindTriggerInterruption(
          f.scheduler,
          f.game,
          f.registry,
          f.scheduler.interruption!,
        ),
      ).toBe(true);
      expect(f.scheduler.frames).toEqual([]);
      expect(f.game.playerMarks.a["@halfmaxhp"]).toBe(1);
      expect(f.game.playerMarks.a.Global_MaxcardsIncrease).toBeUndefined();
      expect(f.game.notices).toEqual([]);
      expect(f.game.cardZones.a.cards).toHaveLength(5);
    },
  );
  it("keeps movement committed when interrupted before discard ChoiceMade", () => {
    const f = setup([0, 1]);
    f.game.hp.a = 1;
    f.game.blocked = [1];
    f.registry.unwind = true;
    f.registry.skills.push({
      id: "interrupt-after-move",
      events: ["CardsMoveOneTime"],
      priority: 30,
      rule: true,
      effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
    });
    start(f);
    expect(f.scheduler.interruption?.reason).toBe("turn-broken");
    expect(f.game.cardZones.discard.cards).toEqual([0]);
    expect(
      unwindTriggerInterruption(
        f.scheduler,
        f.game,
        f.registry,
        f.scheduler.interruption!,
      ),
    ).toBe(true);
    expect(f.game.cardZones.a.cards).toEqual([1]);
    expect(f.game.trace).toEqual([]);
  });
  it("offers both tokens in native order and discards only the remaining excess", () => {
    const f = setup([0, 1, 2, 3, 4, 5, 6, 7]);
    f.game.hp.a = 3;
    f.game.playerMarks.a["@halfmaxhp"] = 1;
    f.game.playerMarks.a["@careerist"] = 1;
    start(f);
    answer(f, "yes");
    answer(f, "yes");
    discard(f, [0]);
    expect(f.game.playerMarks.a["@halfmaxhp"]).toBe(0);
    expect(f.game.playerMarks.a["@careerist"]).toBe(0);
    expect(f.game.playerMarks.a.Global_MaxcardsIncrease).toBe(4);
    expect(f.game.cardZones.a.cards).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(f.game.cardZones.discard.cards).toEqual([0]);
    expect(f.game.trace).toEqual([
      "skillChoice:halfmaxhp:yes",
      "skillChoice:careerman:yes",
      "cardDiscard:gamerule:$0",
    ]);
    expect(f.game.notices).toHaveLength(10);
    expect(f.scheduler.frames).toEqual([]);
  });
  it("keeps declined tokens and permits selecting only discardable cards", () => {
    const f = setup([0, 1, 2, 3, 4]);
    f.game.hp.a = 3;
    f.game.blocked = [1];
    f.game.playerMarks.a["@halfmaxhp"] = 1;
    f.game.playerMarks.a["@careerist"] = 1;
    start(f);
    answer(f, "no");
    answer(f, "no");
    expect(
      f.admission
        .view(f.scheduler, "a")!
        .choices.some((c) => c.action === "card" && c.cardId === 1),
    ).toBe(false);
    discard(f, [0, 2]);
    expect(f.game.playerMarks.a["@halfmaxhp"]).toBe(1);
    expect(f.game.playerMarks.a["@careerist"]).toBe(1);
    expect(f.game.playerMarks.a.Global_MaxcardsIncrease).toBeUndefined();
    expect(f.game.cardZones.a.cards).toEqual([1, 3, 4]);
    expect(f.game.cardZones.discard.cards).toEqual([2, 0]);
    expect(f.game.notices).toEqual([]);
  });
  it("uses the accepted choice even if ChoiceMade consumes the event and removes the token", () => {
    const f = setup([0, 1, 2, 3, 4]);
    f.game.hp.a = 3;
    f.game.playerMarks.a["@halfmaxhp"] = 1;
    f.registry.skills.push({
      id: "consume-choice",
      events: ["ChoiceMade"],
      priority: 30,
      rule: true,
      effect: ({ game, event }) => {
        game.playerMarks.a["@halfmaxhp"] = 0;
        event.data = "rewritten";
        return { kind: "done", value: true };
      },
    });
    start(f);
    answer(f, "yes");
    expect(f.scheduler.frames).toEqual([]);
    expect(f.game.playerMarks.a.Global_MaxcardsIncrease).toBe(2);
    expect(
      f.game.notices.filter(
        (n) =>
          typeof n === "object" &&
          n !== null &&
          !Array.isArray(n) &&
          n.kind === "mark",
      ),
    ).toEqual([
      { kind: "mark", target: "a", name: "Global_MaxcardsIncrease", value: 2 },
    ]);
  });
  it("rechecks current hand limit after the first choice before offering the second token", () => {
    const f = setup([0, 1, 2, 3, 4, 5, 6]);
    f.game.hp.a = 3;
    f.game.playerMarks.a["@halfmaxhp"] = 1;
    f.game.playerMarks.a["@careerist"] = 1;
    f.registry.skills.push({
      id: "change-hp",
      events: ["ChoiceMade"],
      priority: 30,
      rule: true,
      effect: ({ game }) => {
        game.hp.a = 5;
        return { kind: "done", value: false };
      },
    });
    start(f);
    answer(f, "yes");
    expect(f.scheduler.frames).toEqual([]);
    expect(f.game.playerMarks.a["@careerist"]).toBe(1);
    expect(f.game.cardZones.a.cards).toHaveLength(7);
    expect(f.game.trace).toEqual(["skillChoice:halfmaxhp:yes"]);
  });
  it("runs through execute-phase and completes EventPhaseEnd after mandatory discard", () => {
    const f = setup([0, 1, 2, 3, 4]);
    f.game.hp.a = 4;
    f.registry.skills.push({
      id: "phase-observer",
      events: ["EventPhaseStart", "EventPhaseEnd"],
      priority: 30,
      rule: true,
      effect: ({ game, event }) => {
        game.trace.push(event.name);
        return { kind: "done", value: false };
      },
    });
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.registry,
        { name: "execute-phase", data: { target: "a" } },
        "a",
      ),
    ).toBe(true);
    discard(f, [0]);
    expect(f.game.trace).toEqual([
      "EventPhaseStart",
      "cardDiscard:gamerule:$0",
      "EventPhaseEnd",
    ]);
  });
  it("spends halfmaxhp to raise the live limit and skips the careerist offer when no cards remain over limit", () => {
    const f = setup([0, 1, 2, 3, 4]);
    f.game.hp.a = 3;
    f.game.playerMarks.a["@halfmaxhp"] = 1;
    f.game.playerMarks.a["@careerist"] = 1;
    start(f);
    answer(f, "yes");
    expect(f.scheduler.frames).toEqual([]);
    expect(f.game.playerMarks.a["@halfmaxhp"]).toBe(0);
    expect(f.game.playerMarks.a["@careerist"]).toBe(1);
    expect(f.game.playerMarks.a.Global_MaxcardsIncrease).toBe(2);
    expect(f.game.cardZones.a.cards).toEqual([0, 1, 2, 3, 4]);
    expect(f.game.trace).toEqual(["skillChoice:halfmaxhp:yes"]);
    expect(f.game.notices).toEqual([
      { kind: "invoke-log", target: "a", skill: "halfmaxhp" },
      { kind: "invoke-audio", target: "a", skill: "halfmaxhp" },
      { kind: "invoke-skill", target: "a", skill: "halfmaxhp" },
      { kind: "mark", target: "a", name: "@halfmaxhp", value: 0 },
      { kind: "mark", target: "a", name: "Global_MaxcardsIncrease", value: 2 },
    ]);
  });
});
