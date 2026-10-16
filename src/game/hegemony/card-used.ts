import { readExecutionCardUse, type CardUse } from "./card-on-use";
import {
  prepareJink,
  prepareEffectResources,
  readEffectUse,
  readResourceCard,
  restoreJink,
  type CardResourceGame,
  type CardUseResourceRules,
} from "./card-resources";
import type { CardMovementGame } from "./movement";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerOperation,
  TriggerSkill,
  TriggerData,
} from "./scheduler";

export interface CardUsedRules {
  resources?: CardUseResourceRules;
  /** Native pre-action takes a const use and returns void. */
  preAction?: (use: CardUse) => TriggerOperation | null;
  /** Native Card::use is void; its child return never replaces CardUse data. */
  use: (use: CardUse) => TriggerOperation;
}
type IndexedUse = CardUse & { index?: number };
type Cursor = {
  stage: number;
  use: IndexedUse;
  targets: string[];
  from: string;
  index: number;
  jinkBackup: TriggerData[];
};

function runCardUsed<G extends CardResourceGame>(
  { game, operation, continuation, child }: OperationContext<G>,
  rules: CardUsedRules,
): OperationStep {
  const cursor: Cursor =
    continuation === null
      ? {
          stage: -1,
          use: readExecutionCardUse(game, operation.data),
          targets: [],
          from: "",
          index: 0,
          jinkBackup: [],
        }
      : (structuredClone(continuation) as Cursor);
  if (child) cursor.use = readExecutionCardUse(game, child.event.data);
  while (cursor.stage < 8) {
    let name: string;
    let target: string;
    switch (cursor.stage) {
      case -1: {
        cursor.stage++;
        const preAction = rules.preAction?.(structuredClone(cursor.use));
        if (!preAction) continue;
        return {
          kind: "operation",
          operation: preAction,
          continuation: cursor,
        };
      }
      case 0:
        cursor.stage++;
        if (!cursor.use.to.length) continue;
        name = "TargetChoosing";
        target = cursor.use.from;
        break;
      case 1:
        cursor.targets = [...cursor.use.to];
        cursor.index = 0;
        cursor.stage++;
        continue;
      case 2:
        if (!cursor.use.to.length || cursor.index === cursor.targets.length) {
          cursor.stage++;
          continue;
        }
        target = cursor.targets[cursor.index++];
        if (!cursor.use.to.includes(target)) continue;
        name = "TargetConfirming";
        break;
      case 3:
        if (rules.resources)
          cursor.jinkBackup = prepareJink(game, cursor.use, rules.resources);
        // Native local card_use stays fixed throughout Record/Chosen/Confirmed.
        cursor.targets = [...cursor.use.to];
        cursor.from = cursor.use.from;
        cursor.index = 0;
        cursor.stage++;
        if (!cursor.targets.length) continue;
        name = "TargetRecord";
        target = cursor.from;
        break;
      case 4:
      case 5:
        if (cursor.index === cursor.targets.length) {
          cursor.stage++;
          cursor.index = 0;
          continue;
        }
        name = cursor.stage === 4 ? "TargetChosen" : "TargetConfirmed";
        target =
          cursor.stage === 4 ? cursor.from : cursor.targets[cursor.index];
        cursor.use = { ...cursor.use, index: cursor.index++ };
        break;
      case 6:
        cursor.stage++;
        if (rules.resources)
          cursor.use = prepareEffectResources(
            game,
            cursor.use,
            rules.resources,
          );
        return {
          kind: "operation",
          operation: rules.use(structuredClone(cursor.use)),
          continuation: cursor,
        };
      default:
        cursor.stage++;
        if (rules.resources)
          restoreJink(game, cursor.use, cursor.jinkBackup, rules.resources);
        continue;
    }
    return {
      kind: "event",
      event: { name, target, data: cursor.use },
      continuation: cursor,
    };
  }
  return { kind: "return", value: { data: cursor.use } };
}

/** Target dispatch with optional normal-path resources; effects belong to adapters. */
export function createCardUsedOperation<G extends CardResourceGame>(
  rules: CardUsedRules,
): OperationHandler<G> {
  return {
    name: "card-used",
    validate: (game, operation) => {
      const use = readExecutionCardUse(game, operation.data);
      if (rules.resources) {
        readResourceCard(game, use, rules.resources);
        readEffectUse(use);
      }
    },
    run: (context) => runCardUsed(context, rules),
  };
}

/** Runs at native GameRule priority zero, after players in that band. */
export function createCardUsedRule<
  G extends CardMovementGame,
>(): TriggerSkill<G> {
  return {
    id: "game-rule-card-used",
    events: ["CardUsed"],
    priority: 0,
    rule: true,
    effect: ({ game, event, operationChild }) => {
      if (!operationChild)
        return {
          kind: "operation",
          operation: { name: "card-used", data: event.data },
          continuation: null,
        };
      const result = operationChild.value as { data: CardUse };
      event.data = readExecutionCardUse(game, result.data);
      return { kind: "done", value: false };
    },
  };
}
