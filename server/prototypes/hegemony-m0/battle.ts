/** Bounded fixture composition: one plain Slash, physical Jink, no full turn/packages. */
import {
  createCardCommandAdmission,
  type CardCommandGame,
} from "../../../src/game/hegemony/card-command";
import { createRoomUseCardOperation } from "../../../src/game/hegemony/room-use-card";
import {
  createAskCardUseOperation,
  type AskCardUseRequest,
} from "../../../src/game/hegemony/ask-card-use";
import {
  createCardOnUseOperation,
  type CardUse,
} from "../../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../../src/game/hegemony/card-use";
import { createCardFinishedRule } from "../../../src/game/hegemony/card-resources";
import { createCardEffectOperation } from "../../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../../src/game/hegemony/card-effected";
import {
  createSlashOnUseOperation,
  createSlashOnEffectOperation,
  createSlashEffectOperation,
  createSlashResultOperation,
  createJinkEffectOperation,
  type SlashCard,
} from "../../../src/game/hegemony/slash";
import {
  createSlashEffectedOperation,
  createSlashEffectedRule,
  createSlashProceedOperation,
  createSlashProceedRule,
} from "../../../src/game/hegemony/slash-response";
import {
  createDamageOperation,
  type DamageGame,
} from "../../../src/game/hegemony/damage";
import {
  createSlashHitOperation,
  createSlashHitRule,
  createDamageDoneOperation,
  createDamageDoneRule,
  createDamageCompleteOperation,
  createDamageCompleteRule,
} from "../../../src/game/hegemony/damage-rule";
import {
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerRegistry,
  type TriggerData,
  type OperationHandler,
} from "../../../src/game/hegemony/scheduler";
import type { Engine } from "./engine";

export type BattleState = DamageGame & CardCommandGame & { outcomes: string[] };
export const reference = (id: number) => `fixture:${id}`;
export function fixtureCard(id: number): SlashCard {
  const slash = id % 2 === 0;
  return {
    reference: reference(id),
    card: {
      type: "basic",
      name: slash ? "slash" : "jink",
      className: slash ? "Slash" : "Jink",
      skillName: "",
      materialIDs: [id],
      flags: [],
    },
  };
}
const resources = {
  reference: (use: Pick<CardUse, "card">) => reference(use.card.materialIDs[0]),
};
const inPlay = (game: Readonly<Engine>, actor: string) =>
  game.currentPlayer === actor && !game.playerHistory[actor].Slash;
export const admission = createCardCommandAdmission<Engine, string>(
  {
    inPlay,
    contextValid: (_game, request) =>
      request.reason === "play" && request.context === "fixture-play",
    offers: (game, request) =>
      game.cardZones[request.actor].cards
        .filter((id) => fixtureCard(id).card.className === "Slash")
        .map((id) => ({
          id: reference(id),
          version: "physical-v1",
          label: "Sát",
          entry: {
            reference: reference(id),
            use: { from: request.actor, to: [], card: fixtureCard(id).card },
          },
          targetFixed: false,
          multipleVotes: false,
        })),
    enabled: (game, request) => inPlay(game, request.actor),
    skillAllowed: (_game, _request, offer) =>
      offer.entry.use.card.skillName === "",
    matchesPattern: (_game, request, offer) =>
      request.pattern === "slash" && offer.entry.use.card.className === "Slash",
    materialAllowed: (game, request, _offer, _id, zone) =>
      game.cardZones[zone].owner === request.actor &&
      game.cardZones[zone].place === "hand",
    targetFilter: (game, _request, entry, target) =>
      game.alive[target] &&
      target !== entry.use.from &&
      entry.use.to.length === 0,
    prohibited: () => false, // Only two living fixture seats: distance is always one; no skills/equipment.
    feasible: (_game, _request, entry) => entry.use.to.length === 1,
  },
  (actor) => actor,
);

const ownsJink = (game: Readonly<Engine>, actor: string, id: number) =>
  Number.isSafeInteger(id) &&
  id >= 0 &&
  id < 8 &&
  game.cardZones[actor]?.cards.includes(id) &&
  fixtureCard(id).card.className === "Jink";
const requestJink: OperationHandler<Engine> = {
  name: "fixture-request-jink",
  run: ({ game, operation, continuation, answer }) => {
    const request = (continuation ?? operation.data) as AskCardUseRequest;
    if (answer) {
      if (answer.choice === null || answer.choice === "decline")
        return { kind: "return", value: null };
      const id = Number(answer.choice.replace(/^jink:/, ""));
      if (!ownsJink(game, request.actor, id))
        throw new Error("Invalid fixture Jink");
      return { kind: "return", value: fixtureCard(id) };
    }
    return {
      kind: "prompt",
      actor: request.actor,
      canCancel: true,
      choices: [
        ...game.cardZones[request.actor].cards
          .filter((id) => ownsJink(game, request.actor, id))
          .map((id) => `jink:${id}`),
        "decline",
      ],
      continuation: request,
    };
  },
};

export const battleRules: {
  skills: TriggerRegistry<Engine>["skills"];
  operations: OperationHandler<Engine>[];
} = {
  skills: [
    createCardUsedRule(),
    createCardFinishedRule(resources),
    createCardEffectedRule(),
    createSlashEffectedRule(),
    createSlashProceedRule(),
    createSlashHitRule(),
    createDamageDoneRule(),
    createDamageCompleteRule(),
    {
      id: "fixture-public-outcomes",
      events: ["SlashHit", "SlashMissed"],
      priority: 10,
      record: ({ game, event }) => {
        game.outcomes.push(event.name);
      },
      effect: () => ({ kind: "done", value: false }),
    },
  ],
  operations: [
    admission.operation,
    createRoomUseCardOperation({
      parse: (_game, entry) => entry,
      inPlay,
      validate: (data) => ({ name: "fixture-validate-use", data }),
      onUse: ({ use }) => ({ name: "slash-on-use", data: use }),
      after: () => ({ name: "fixture-no-skill", data: null }),
      limited: () => false,
      notify: () => null,
      metadata: (_game, entry) => ({
        identity: entry.reference,
        realIdentity: entry.reference,
        virtual: false,
        lua: false,
        delayed: false,
        handlingMethod: "use",
        canRecast: false,
        face: {
          name: entry.use.card.name,
          className: entry.use.card.className,
          skillName: "",
          suit: "spade",
          number: 1,
        },
        showSkill: "",
      }),
    }),
    {
      name: "fixture-validate-use",
      run: ({ operation }) => ({
        kind: "return",
        value: { entry: operation.data, validated: operation.data },
      }),
    },
    { name: "fixture-no-skill", run: () => ({ kind: "return", value: null }) },
    createSlashOnUseOperation({ ...resources, repeatSlashCause: () => null }),
    createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
    createCardUsedOperation({
      resources,
      use: (data) => ({ name: "card-use", data }),
    }),
    createCardUseOperation({
      ...resources,
      effect: (data) => ({ name: "card-effect", data }),
    }),
    createCardEffectOperation({
      isSlash: (_game, effect) => effect.card.className === "Slash",
    }),
    createCardEffectedOperation({
      isSlash: (_game, effect) => effect.card.className === "Slash",
      isTrick: () => false,
      cancel: () => {
        throw new Error("No tricks in fixture");
      },
      onEffect: (data) => ({ name: "slash-on-effect", data }),
    }),
    createSlashOnEffectOperation({ ...resources, nature: () => "normal" }),
    createSlashEffectOperation(),
    createSlashResultOperation(),
    createSlashEffectedOperation(),
    createSlashProceedOperation({
      ask: (request) => ({
        name: "ask-card-use",
        data: {
          actor: request.target,
          pattern: request.pattern,
          prompt: request.prompt,
          data: request.data,
          to: request.source,
          skillName: "",
          isProvision: false,
        },
      }),
    }),
    createAskCardUseOperation({
      tableZone: "table",
      discardZone: "discard",
      isAI: () => false,
      request: (data) => ({ name: "fixture-request-jink", data }),
      limited: () => false,
      validateResponse: (actor, card) => ({
        name: "fixture-validate-jink",
        data: { actor, card },
      }),
      resolve: (_game, card) => card,
      notify: () => null,
      reveal: () => ({ name: "fixture-no-skill", data: null }),
      moveReason: (_game, actor) => ({ kind: "use", actor }),
      validateAfter: () => ({ name: "fixture-no-skill", data: null }),
    }),
    requestJink,
    {
      name: "fixture-validate-jink",
      run: ({ game, operation }) => {
        const input = operation.data as { actor: string; card: SlashCard };
        const id = input.card.card.materialIDs[0];
        return {
          kind: "return",
          value: ownsJink(game, input.actor, id) ? fixtureCard(id) : null,
        };
      },
    },
    createJinkEffectOperation({
      isJink: (_game, card) => card.card.className === "Jink",
    }),
    createSlashHitOperation(),
    createDamageOperation(),
    createDamageDoneOperation(),
    createDamageCompleteOperation(),
  ],
};

/** Only the prompt owner receives opaque choices, never the scheduler frame/operation data. */
export function battlePrompt(engine: Engine, actor: string) {
  const play = admission.view(engine.scheduler, actor);
  if (play) return { ...play, kind: "play" as const };
  const prompt = getTriggerPrompt(engine.scheduler, actor);
  const frame = engine.scheduler.frames.at(-1);
  if (
    !prompt ||
    frame?.kind !== "operation" ||
    frame.operation.name !== requestJink.name
  )
    return null;
  return {
    id: prompt.id,
    kind: "response" as const,
    canCancel: prompt.canCancel,
    choices: prompt.choices.map(({ id }) => ({
      id,
      label: id === "decline" ? "Không dùng Thiểm" : "Thiểm",
    })),
  };
}
export function answerBattle(
  engine: Engine,
  registry: TriggerRegistry<Engine>,
  actor: string,
  answer: { id: string; choice: string | null },
) {
  if (admission.view(engine.scheduler, actor))
    return admission.submit(engine.scheduler, engine, registry, actor, answer);
  if (!battlePrompt(engine, actor)) return false;
  return resumeTriggerPrompt(engine.scheduler, engine, registry, actor, answer);
}
export function playRequest(actor: string): TriggerData {
  return {
    actor,
    reason: "play",
    context: "fixture-play",
    pattern: "slash",
    prompt: "fixture-play",
    method: "use",
    addHistory: true,
    canCancel: true,
  };
}
