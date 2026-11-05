import {
  readCardEffect,
  type CardEffect,
  type CardEffectGame,
} from "./card-effect";
import { readCardReference } from "./card-resources";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export interface CardCancellationRules<G extends CardEffectGame> {
  /** Pure package mapping to stable card identity, not its mutable toString key. */
  reference: (effect: CardEffect) => string;
  isCancelable: (game: Readonly<G>, effect: CardEffect) => boolean;
  /** Current authoritative Player::isFriendWith, including self and reveal state. */
  isFriend: (game: Readonly<G>, player: string, target: string) => boolean;
  /** Initial positive ask; the response/counter protocol belongs to this child. */
  ask: (effect: CardEffect) => TriggerOperation;
}
type Cursor = { effect: CardEffect; reference: string; targets: string[] };

function readCancellationInput<G extends CardEffectGame>(
  game: G,
  data: TriggerData,
  rules: CardCancellationRules<G>,
): Cursor | null {
  const effect = readCardEffect(game, data);
  const cancelable = rules.isCancelable(
    structuredClone(game),
    structuredClone(effect),
  );
  if (typeof cancelable !== "boolean")
    throw new Error("Invalid card cancelability");
  if (!cancelable) return null;
  const reference = rules.reference(structuredClone(effect));
  const { ledger, card } = readCardReference(game, reference);
  const supplied = ledger.roomTags[`${card.key}HegNullificationTargets`];
  const targets = supplied === undefined ? [] : supplied;
  if (!Array.isArray(targets) || targets.some((id) => typeof id !== "string"))
    throw new Error("Invalid HegNullificationTargets");
  return { effect, reference, targets: [...targets] as string[] };
}

function runCardCancellation<G extends CardEffectGame>(
  { game, operation, continuation, operationChild }: OperationContext<G>,
  rules: CardCancellationRules<G>,
): OperationStep {
  if (continuation === null) {
    const cursor = readCancellationInput(game, operation.data, rules);
    if (!cursor) return { kind: "return", value: false };
    const { effect, reference, targets } = cursor;
    if (targets.includes(effect.to)) return { kind: "return", value: true };
    const { ledger } = readCardReference(game, reference);
    Object.assign(ledger.roomTags, {
      HegNullificationValid: false,
      NullifyingTarget: effect.to,
      NullifyingSource: effect.from,
      NullifyingCard: reference,
      NullifyingTimes: 0,
    });
    return {
      kind: "operation",
      operation: rules.ask(structuredClone(effect)),
      continuation: cursor,
    };
  }
  if (typeof operationChild?.value !== "boolean")
    throw new Error("Invalid nullification ask result");
  const cursor = structuredClone(continuation) as Cursor;
  const { ledger, card } = readCardReference(game, cursor.reference);
  const supplied = ledger.roomTags.HegNullificationValid;
  const valid = supplied === undefined ? false : supplied;
  if (typeof valid !== "boolean")
    throw new Error("Invalid HegNullificationValid");
  if (valid && card.isNDTrick) {
    for (const player of game.seatOrder) {
      const alive = game.alive[player];
      if (typeof alive !== "boolean")
        throw new Error("Invalid nullification player alive state");
      if (!alive) continue;
      const friend = rules.isFriend(
        structuredClone(game),
        player,
        cursor.effect.to,
      );
      if (typeof friend !== "boolean")
        throw new Error("Invalid nullification friendship");
      if (friend) cursor.targets.push(player);
    }
    ledger.roomTags[`${card.key}HegNullificationTargets`] = cursor.targets;
  }
  return { kind: "return", value: operationChild.value };
}

/** Room::isCanceled caller/state contract, not a playable Nullification responder. */
export function createCardCancellationOperation<G extends CardEffectGame>(
  rules: CardCancellationRules<G>,
): OperationHandler<G> {
  return {
    name: "card-cancellation",
    validate: (game, operation) => {
      readCancellationInput(game, operation.data, rules);
    },
    run: (context) => runCardCancellation(context, rules),
  };
}
