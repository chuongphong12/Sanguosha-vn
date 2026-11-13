import { damagePlayerTags } from "./damage";
import { ruleInput } from "./damage-rule";
import { dyingPlayer, type DyingGame } from "./dying";
import {
  readSlashAlive,
  readSlashCard,
  readSlashInteger,
  type SlashCard,
} from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

export type Recovery = {
  recover: number;
  who: string | null;
  card: SlashCard | null;
};
function readRecovery(game: DyingGame, data: TriggerData): Recovery {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid recovery data");
  return {
    ...structuredClone(data),
    recover: readSlashInteger(data.recover),
    who: data.who === null ? null : dyingPlayer(game, data.who),
    card:
      data.card === null
        ? null
        : readSlashCard(game, data.card, game.seatOrder[0]),
  };
}
function canRecover(game: DyingGame, target: string) {
  if (!readSlashAlive(game, target)) return false;
  const hp = readSlashInteger(game.hp[target]),
    max = readSlashInteger(game.maxHp?.[target]);
  if (!(hp < 0 || hp < max)) return false;
  const forbidden = damagePlayerTags(game, target).CannotRecover;
  if (forbidden !== undefined && typeof forbidden !== "boolean")
    throw new Error("Invalid CannotRecover");
  if (forbidden === true) return false;
  if (
    !Object.prototype.hasOwnProperty.call(game.removed, target) ||
    typeof game.removed[target] !== "boolean"
  )
    throw new Error("Invalid recovery removed state");
  return !game.removed[target];
}
function recoveryInput(game: DyingGame, data: TriggerData) {
  const input = ruleInput(game, data);
  if (!input) throw new Error("Recovery requires a target");
  const recovery = readRecovery(game, input.data);
  canRecover(game, input.target);
  return { target: input.target, recovery };
}
type Cursor = {
  stage: "pre" | "hp" | "done";
  target: string;
  shared: TriggerData;
};
function runRecovery<G extends DyingGame>({
  game,
  operation,
  continuation,
  child,
}: OperationContext<G>): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const input = recoveryInput(game, operation.data);
    if (!canRecover(game, input.target)) return { kind: "return", value: null };
    cursor = { stage: "pre", target: input.target, shared: input.recovery };
    return {
      kind: "event",
      event: {
        name: "PreHpRecover",
        target: cursor.target,
        data: cursor.shared,
      },
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as Cursor;
  if (cursor.stage === "pre") {
    if (child?.consumed) return { kind: "return", value: null };
    cursor.shared = structuredClone(child!.event.data);
    const recovery = readRecovery(game, cursor.shared);
    const sum = readSlashInteger(
      readSlashInteger(game.hp[cursor.target]) + recovery.recover,
    );
    game.hp[cursor.target] = Math.min(
      sum,
      readSlashInteger(game.maxHp?.[cursor.target]),
    );
    cursor.stage = "hp";
    return {
      kind: "event",
      event: { name: "HpChanged", target: cursor.target, data: null },
      continuation: cursor,
    };
  }
  if (cursor.stage === "hp") {
    cursor.stage = "done";
    return {
      kind: "event",
      event: { name: "HpRecover", target: cursor.target, data: cursor.shared },
      continuation: cursor,
    };
  }
  return { kind: "return", value: null };
}
export function createRecoveryOperation<
  G extends DyingGame,
>(): OperationHandler<G> {
  return {
    name: "recover",
    validate: (game, operation) => {
      recoveryInput(game, operation.data);
    },
    run: runRecovery,
  };
}
