import { expect } from "vitest";
import { drawingSetup, type DrawingGame } from "./drawing-support";
import {
  createNormalTurnOperations,
  type NormalTurnGame,
} from "../../src/game/hegemony/turn-order";
import {
  createTurnStartOperations,
  createTurnStartRule,
} from "../../src/game/hegemony/turn-start";
import { createPhaseOperations } from "../../src/game/hegemony/phases";
import {
  createPhaseCleanupOperations,
  createPhaseCleanupRule,
} from "../../src/game/hegemony/phase-cleanup";
import { createMarkCleanupOperations } from "../../src/game/hegemony/phase-state";
import { createDrawPhaseOperation } from "../../src/game/hegemony/draw-phase";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import { createAskGeneralShowOperation } from "../../src/game/hegemony/ask-general-show";
import { createShowGeneralOperation } from "../../src/game/hegemony/general";
import { createCardEffectOperation } from "../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createPlayPhaseOperation } from "../../src/game/hegemony/play-phase";
import { createCardCommandAdmission } from "../../src/game/hegemony/card-command";
import {
  createRoomUseCardOperation,
  createRoomUseCleanupOperation,
} from "../../src/game/hegemony/room-use-card";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createDiscardPhaseOperation } from "../../src/game/hegemony/discard-phase";
import { createRuleDiscardAdmission } from "../../src/game/hegemony/rule-discard";
import { createRewardTokenCostOperation } from "../../src/game/hegemony/reward-tokens";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  continueTriggerWork,
  resumeTriggerPrompt,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = DrawingGame &
  NormalTurnGame & {
    currentPlayer: string;
    engineCardFlags: Record<number, string[]>;
    interruptEvent: string | null;
    interruptReason: "turn-broken" | "stage-change" | "game-over";
  };

/** Explicit synthetic package policy; all turn/phase/admission/movement owners are real. */
export function setup() {
  const f = drawingSetup();
  const game: Game = {
    ...f.game,
    currentPlayer: "a",
    engineCardFlags: Object.fromEntries(
      Array.from({ length: 12 }, (_, id) => [id, []]),
    ),
    cardResources: f.game.cardResources!,
    faceUp: { a: true, b: true, c: true },
    phaseQueues: Object.fromEntries(
      f.game.seatOrder.map((p) => [p, { phases: [], states: [], index: 0 }]),
    ),
    playerIntMarks: { a: {}, b: {}, c: {} },
    playerStringMarks: { a: {}, b: {}, c: {} },
    cardLimitations: { a: {}, b: {}, c: {} },
    turnOrder: { stage: "regular", anchor: null },
    interruptEvent: null,
    interruptReason: "turn-broken",
  };
  game.playerPhases = { a: "not-active", b: "not-active", c: "not-active" };
  game.cardZones.a.cards = [0, 1, 2, 3];
  game.cardZones.draw.cards = [5, 6, 7, 8, 9, 10, 11];
  game.cardZones.delayed = { owner: "a", place: "delayed", cards: [4] };
  game.cardZones.table = { owner: null, place: "table", cards: [] };
  game.displayedGenerals.a = { head: "anjiang", deputy: "anjiang" };
  game.hp.a = 2;
  game.cardResources.cards.Test = {
    kind: "virtual",
    key: "test",
    isSlash: false,
    isNDTrick: false,
    flags: [],
    tags: {},
  };
  const context = (g: Readonly<Game>, actor: string) =>
    `${actor}:${g.playerMarks[actor].Global_TurnCount}`;
  const play = createCardCommandAdmission<Game, string>(
    {
      inPlay: (g, p) => g.playerPhases[p] === "play",
      contextValid: (g, r) => r.context === context(g, r.actor),
      offers: (g, r) =>
        g.cardZones[r.actor].cards.map((id) => ({
          id: `test-${id}`,
          version: "synthetic-package",
          label: `Test ${id}`,
          targetFixed: true,
          multipleVotes: false,
          entry: {
            reference: "Test",
            use: {
              from: r.actor,
              to: [],
              card: {
                type: "basic",
                name: "test",
                className: "Test",
                skillName: "",
                materialIDs: [id],
                flags: [],
              },
            },
          },
        })),
      enabled: () => true,
      skillAllowed: () => true,
      matchesPattern: () => true,
      materialAllowed: (g, r, _o, _id, zone) =>
        g.cardZones[zone].owner === r.actor &&
        g.cardZones[zone].place === "hand",
      targetFilter: () => false,
      prohibited: () => false,
      feasible: (_g, _r, entry) => entry.use.to.length === 0,
    },
    (actor) => actor,
  );
  const discard = createRuleDiscardAdmission<Game, string>(
    {
      discardZone: "discard",
      isJilei: () => false,
      focus: () => null,
    },
    (actor) => actor,
  );
  const resources = { reference: () => "Test" };
  const registry: TriggerRegistry<Game> = {
    version: "composed-turn-ce4e62b-v1",
    unwind: true,
    skills: [
      ...f.rules.skills,
      createTurnStartRule(),
      createPhaseCleanupRule(),
      createPhaseBodyRule(),
      createCardEffectedRule(),
      createCardUsedRule(),
      createCardFinishedRule(resources),
      {
        id: "composed-observer",
        rule: true,
        priority: 50,
        events: [
          "TurnStart",
          "TurnBroken",
          "EventPhaseStart",
          "EventPhaseProceeding",
          "EventPhaseEnd",
          "ChoiceMade",
          "CardFinished",
        ],
        effect: ({ game, event }) => {
          game.trace.push({
            event: event.name,
            target: event.target,
            phase:
              event.target === null ? null : game.playerPhases[event.target],
            data: event.data,
          });
          if (game.interruptEvent === event.name) {
            game.interruptEvent = null;
            return { kind: "interrupt", reason: game.interruptReason };
          }
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      ...f.rules.operations!,
      ...createNormalTurnOperations<Game>(),
      ...createTurnStartOperations<Game>({
        battleRoyal: false,
        playerCount: 3,
        notify: () => null,
      }),
      ...createPhaseOperations<Game>({ notify: () => null }),
      ...createMarkCleanupOperations({ notify: () => null }),
      ...createPhaseCleanupOperations<Game>({
        notify: () => null,
        skillExists: () => false,
        hasSkill: () => false,
        imperialCard: () => null,
      }),
      createDrawPhaseOperation(),
      ...createPhaseBodyOperations<Game>({
        tableZone: "table",
        card: (g, id) => ({
          type: "trick",
          name: g.wrappedCards![id].name,
          className: g.wrappedCards![id].className,
          skillName: "",
          materialIDs: [id],
          flags: [],
        }),
        onNullified: () => {
          throw Error("No nullified delayed package");
        },
      }),
      createAskGeneralShowOperation<Game>({
        enableLordConversion: false,
        canShow: () => true,
        lordAvailable: () => false,
        changeToLord: () => {
          throw Error("No lord package");
        },
        notify: () => null,
      }),
      createShowGeneralOperation<Game>({
        canShow: () => true,
        preshow: () => ({ name: "package-notice", data: null }),
        change: () => ({ name: "package-notice", data: null }),
        skills: () => ({ name: "package-notice", data: null }),
        notify: () => ({ name: "package-notice", data: null }),
        filter: () => ({ name: "package-notice", data: null }),
      }),
      createCardEffectOperation({ isSlash: () => false }),
      createCardEffectedOperation({
        isSlash: () => false,
        isTrick: () => true,
        cancel: () => ({ name: "package-cancel", data: null }),
        onEffect: (effect) => ({
          name: "move-cards",
          data: {
            moves: [
              {
                ids: effect.card.materialIDs,
                from: ["table"],
                to: "discard",
                open: true,
                reason: { kind: "natural-move", actor: effect.to },
              },
            ],
          },
        }),
      }),
      createPlayPhaseOperation<Game>({
        context,
        pendingSurrender: () => null,
        notify: () => null,
      }),
      play.operation,
      createRoomUseCardOperation<Game>({
        parse: (_g, entry) => entry,
        inPlay: (g, p) => g.playerPhases[p] === "play",
        limited: () => false,
        notify: () => null,
        metadata: (_g, entry) => ({
          identity: entry.reference,
          realIdentity: entry.reference,
          virtual: true,
          lua: false,
          delayed: false,
          handlingMethod: "use",
          canRecast: false,
          face: {
            name: "test",
            className: "Test",
            skillName: "",
            suit: "no-suit",
            number: 0,
          },
          showSkill: "",
        }),
        validate: (data) => ({ name: "package-validate", data }),
        onUse: ({ use }) => ({
          name: "card-on-use",
          data: { ...use, to: ["b"] },
        }),
        after: () => ({ name: "package-notice", data: null }),
      }),
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createRoomUseCleanupOperation<Game>({
        discardZone: "discard",
        physicalCards: Array.from({ length: 12 }, (_, id) => ({
          id,
          enabled: true,
        })),
        notify: () => null,
      }),
      createCardUsedOperation({
        resources,
        use: (data) => ({ name: "card-use", data }),
      }),
      createCardUseOperation({
        ...resources,
        effect: () => ({ name: "package-notice", data: null }),
      }),
      createRewardTokenCostOperation(),
      discard.operation,
      createDiscardPhaseOperation<Game>({
        maxCards: (g, p) =>
          Math.max(
            0,
            g.hp[p] + (g.playerMarks[p].Global_MaxcardsIncrease ?? 0),
          ),
        choice: (request) => ({ name: "package-token-choice", data: request }),
        notify: () => null,
      }),
      { name: "package-notice", run: () => ({ kind: "return", value: null }) },
      { name: "package-cancel", run: () => ({ kind: "return", value: false }) },
      {
        name: "package-validate",
        run: ({ operation }) => ({
          kind: "return",
          value: { entry: operation.data, validated: operation.data },
        }),
      },
      {
        name: "package-token-choice",
        run: ({ operation, continuation, answer }) => {
          const request = operation.data as { player: string; skill: string };
          if (continuation === null)
            return {
              kind: "prompt",
              actor: request.player,
              choices: ["yes", "no"],
              canCancel: false,
              continuation: true,
            };
          if (continuation === true)
            return {
              kind: "event",
              event: {
                name: "ChoiceMade",
                target: request.player,
                data: `skillChoice:${request.skill}:${answer!.choice}`,
              },
              continuation: answer!.choice,
            };
          return { kind: "return", value: continuation };
        },
      },
    ],
  };
  return {
    game,
    registry,
    play,
    discard,
    scheduler: createTriggerScheduler(game.seatOrder, registry.version),
  };
}
export type Fixture = ReturnType<typeof setup>;
export function root(f: Fixture, name = "normal-turn-step") {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name, data: null },
      f.game.currentPlayer,
    ),
  ).toBe(true);
}
export function answer(f: Fixture, choice: string | null) {
  const prompt = f.scheduler.prompt!;
  const reply = { id: prompt.id, choice };
  if (f.play.view(f.scheduler, prompt.actor))
    return f.play.submit(f.scheduler, f.game, f.registry, prompt.actor, reply);
  if (f.discard.view(f.scheduler, prompt.actor))
    return f.discard.submit(
      f.scheduler,
      f.game,
      f.registry,
      prompt.actor,
      reply,
    );
  return resumeTriggerPrompt(
    f.scheduler,
    f.game,
    f.registry,
    prompt.actor,
    reply,
  );
}
export function drain(f: Fixture, use = true, restore = false, token = "no") {
  let used = false,
    boundaries = 0;
  while (f.scheduler.prompt || f.scheduler.yielded) {
    expect(++boundaries).toBeLessThan(10000);
    if (restore) {
      f.game = JSON.parse(JSON.stringify(f.game));
      f.scheduler = JSON.parse(JSON.stringify(f.scheduler));
    }
    if (f.scheduler.yielded) {
      continueTriggerWork(f.scheduler, f.game, f.registry);
      continue;
    }
    const prompt = f.scheduler.prompt!,
      play = f.play.view(f.scheduler, prompt.actor),
      discard = f.discard.view(f.scheduler, prompt.actor);
    let choice: string | null;
    if (play) {
      const confirm = play.choices.find((c) => c.label === "Xác nhận");
      choice = confirm
        ? confirm.id
        : use && !used
          ? play.choices.find((c) => c.label.startsWith("Test "))!.id
          : null;
      if (confirm) used = true;
    } else if (discard) {
      choice = (discard.choices.find((c) => c.action === "confirm") ??
        discard.choices.find((c) => c.action === "card"))!.id;
    } else
      choice = prompt.choices.some((c) => c.id === "show_head_general")
        ? "show_head_general"
        : token;
    expect(answer(f, choice), JSON.stringify({ prompt, choice })).toBe(true);
  }
  return boundaries;
}
