import { readCardUse, type CardUse } from "./card-on-use";
import {
  readEffectUse,
  readResourceCard,
  type CardResourceGame,
  type CardUseResourceRules,
} from "./card-resources";
import type { CardEffect } from "./card-effect";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export interface CardUseEffectRules extends CardUseResourceRules {
  /** Pure descriptor factory; the effect child result is ignored. */
  effect: (effect: CardEffect) => TriggerOperation;
}
type Cursor = {
  use: CardUse;
  index: number;
  nullified: string[];
  disresponsive: string[];
};
function readUseResources(
  game: CardResourceGame,
  data: TriggerData,
  rules: CardUseEffectRules,
): Cursor {
  const use = readCardUse(game, data);
  const { ledger, storage } = readResourceCard(game, use, rules);
  const taggedUse = {
    ...use,
    nullified_list: ledger.roomTags.CardUseNullifiedList,
    disresponsive_list: storage.tags.CardUseDisresponsiveList,
  };
  const lists = readEffectUse(taggedUse);
  return {
    use,
    index: 0,
    nullified: lists.nullified_list,
    disresponsive: lists.disresponsive_list,
  };
}
function runCardUse<G extends CardResourceGame>(
  { game, operation, continuation }: OperationContext<G>,
  rules: CardUseEffectRules,
): OperationStep {
  const cursor: Cursor =
    continuation === null
      ? readUseResources(game, operation.data, rules)
      : (structuredClone(continuation) as Cursor);
  const { ledger, card } = readResourceCard(game, cursor.use, rules);
  const key = `targets${card.key}`;
  if (cursor.index === cursor.use.to.length) {
    delete ledger.roomTags[key];
    return { kind: "return", value: null };
  }
  const allNullified = cursor.nullified.includes("_ALL_TARGETS");
  const target = cursor.use.to[cursor.index];
  ledger.roomTags[key] = cursor.use.to
    .slice(cursor.index)
    .filter((id) => !allNullified && !cursor.nullified.includes(id));
  const effect: CardEffect = {
    card: structuredClone(cursor.use.card),
    from: cursor.use.from,
    to: target,
    multiple: cursor.use.to.length > 1,
    nullified: allNullified || cursor.nullified.includes(target),
    disresponsive:
      cursor.disresponsive.includes("_ALL_PLAYERS") ||
      cursor.disresponsive.includes(target),
  };
  cursor.index++;
  return {
    kind: "operation",
    operation: rules.effect(structuredClone(effect)),
    continuation: cursor,
  };
}

/** Common Card::use only; overridden package use methods remain external. */
export function createCardUseOperation<G extends CardResourceGame>(
  rules: CardUseEffectRules,
): OperationHandler<G> {
  return {
    name: "card-use",
    validate: (game, operation) => {
      readUseResources(game, operation.data, rules);
    },
    run: (context) => runCardUse(context, rules),
  };
}
