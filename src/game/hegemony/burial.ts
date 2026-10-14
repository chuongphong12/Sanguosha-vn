import { readRecipientFlags } from "./card-effect";
import { readDeathIdentity, type DeathGame } from "./death";
import { dyingPlayer } from "./dying";
import { readSlashInteger } from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerOperation,
  TriggerData,
} from "./scheduler";

export interface BurialRules {
  throwCards: (target: string) => TriggerOperation;
  clearPiles: (target: string) => TriggerOperation;
  releaseGeneral: (name: string) => TriggerOperation;
  clearLimitations: (target: string) => TriggerOperation;
}
function counters(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid burial counters");
  for (const count of Object.values(value)) readSlashInteger(count);
  return value as Record<string, number>;
}
function buryInput(game: DeathGame, value: TriggerData) {
  const target = dyingPlayer(game, value);
  readRecipientFlags(game, target);
  counters(game.playerHistory?.[target]);
  return target;
}
type Cursor = {
  target: string;
  stage: "cards" | "piles" | "generals" | "limits";
  names: string[];
  index: number;
};
function runBury<G extends DeathGame>(
  context: OperationContext<G>,
  rules: BurialRules,
): OperationStep {
  const { game, operation, continuation } = context;
  let cursor: Cursor;
  if (continuation === null) {
    const target = buryInput(game, operation.data);
    game.playerFlags[target] = [];
    for (const name of Object.keys(game.playerHistory[target]))
      if (name !== "Analeptic") delete game.playerHistory[target][name];
    cursor = { target, stage: "cards", names: [], index: 0 };
    return {
      kind: "operation",
      operation: rules.throwCards(target),
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as Cursor;
  if (cursor.stage === "cards") {
    counters(game.playerMarks?.[cursor.target]);
    game.playerMarks[cursor.target] = {};
    cursor.stage = "piles";
    return {
      kind: "operation",
      operation: rules.clearPiles(cursor.target),
      continuation: cursor,
    };
  }
  if (cursor.stage === "piles") {
    const identity = readDeathIdentity(game, cursor.target);
    cursor.names = [identity.head, identity.deputy];
    cursor.stage = "generals";
  }
  if (cursor.stage === "generals") {
    while (cursor.index < cursor.names.length) {
      const name = cursor.names[cursor.index++];
      if (!name.includes("sujiang"))
        return {
          kind: "operation",
          operation: rules.releaseGeneral(name),
          continuation: cursor,
        };
    }
    cursor.stage = "limits";
    return {
      kind: "operation",
      operation: rules.clearLimitations(cursor.target),
      continuation: cursor,
    };
  }
  return { kind: "return", value: null };
}
export function createBuryOperation<G extends DeathGame>(
  rules: BurialRules,
): OperationHandler<G> {
  return {
    name: "bury",
    validate: (game, operation) => {
      buryInput(game, operation.data);
    },
    run: (context) => runBury(context, rules),
  };
}
