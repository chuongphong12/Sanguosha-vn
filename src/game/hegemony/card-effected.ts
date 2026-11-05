import {
  readCardEffect,
  readRecipientFlags,
  type CardEffect,
  type CardEffectGame,
  type CardEffectRules,
} from "./card-effect";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export interface CardEffectedRules<
  G extends CardEffectGame,
> extends CardEffectRules<G> {
  /** Pure current card type lookup, independent of the supplied metadata snapshot. */
  isTrick: (game: Readonly<G>, effect: CardEffect) => boolean;
  /** Room::isCanceled child; returns a boolean, and may ask for responses. */
  cancel: (effect: CardEffect) => TriggerOperation;
  /** Native onEffect returns void. */
  onEffect: (effect: CardEffect) => TriggerOperation;
}
type Cursor = { stage: number; effect: CardEffect };

function matchesCard<G extends CardEffectGame>(
  game: G,
  effect: CardEffect,
  predicate: CardEffectRules<G>["isSlash"],
): boolean {
  const result = predicate(structuredClone(game), structuredClone(effect));
  if (typeof result !== "boolean") throw new Error("Invalid card effect kind");
  return result;
}

function recipientAlive(game: CardEffectGame, effect: CardEffect): boolean {
  const alive = game.alive[effect.to];
  if (typeof alive !== "boolean")
    throw new Error("Invalid card effect recipient alive state");
  return alive;
}

function runCardEffected<G extends CardEffectGame>(
  { game, operation, continuation, operationChild }: OperationContext<G>,
  rules: CardEffectedRules<G>,
): OperationStep {
  const cursor: Cursor =
    continuation === null
      ? { stage: 0, effect: readCardEffect(game, operation.data) }
      : (structuredClone(continuation) as Cursor);
  if (cursor.stage === 0) {
    cursor.stage++;
    if (
      !matchesCard(game, cursor.effect, rules.isSlash) &&
      cursor.effect.nullified
    )
      return { kind: "return", value: true };
    if (matchesCard(game, cursor.effect, rules.isTrick))
      return {
        kind: "operation",
        operation: rules.cancel(structuredClone(cursor.effect)),
        continuation: cursor,
      };
  }
  if (cursor.stage === 1) {
    if (operationChild) {
      if (typeof operationChild.value !== "boolean")
        throw new Error("Invalid card cancellation result");
      if (operationChild.value) {
        const flags = readRecipientFlags(game, cursor.effect.to);
        if (!flags.includes("Global_NonSkillNullify"))
          flags.push("Global_NonSkillNullify");
        return { kind: "return", value: true };
      }
    }
    cursor.stage++;
    return {
      kind: "event",
      event: {
        name: "CardEffectConfirmed",
        target: cursor.effect.to,
        data: structuredClone(cursor.effect),
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === 2) {
    cursor.stage++;
    if (
      recipientAlive(game, cursor.effect) ||
      matchesCard(game, cursor.effect, rules.isSlash)
    )
      return {
        kind: "operation",
        operation: rules.onEffect(structuredClone(cursor.effect)),
        continuation: cursor,
      };
  }
  return { kind: "return", value: false };
}

export function createCardEffectedOperation<G extends CardEffectGame>(
  rules: CardEffectedRules<G>,
): OperationHandler<G> {
  return {
    name: "card-effected",
    validate: (game, operation) => {
      const effect = readCardEffect(game, operation.data);
      readRecipientFlags(game, effect.to);
      recipientAlive(game, effect);
    },
    run: (context) => runCardEffected(context, rules),
  };
}

/** Native GameRule priority zero, after player skills in the same band. */
export function createCardEffectedRule<
  G extends CardEffectGame,
>(): TriggerSkill<G> {
  return {
    id: "game-rule-card-effected",
    events: ["CardEffected"],
    priority: 0,
    rule: true,
    effect: ({ event, operationChild }) => {
      if (!operationChild)
        return {
          kind: "operation",
          operation: { name: "card-effected", data: event.data },
          continuation: null,
        };
      if (typeof operationChild.value !== "boolean")
        throw new Error("Invalid card-effected result");
      return { kind: "done", value: operationChild.value };
    },
  };
}
