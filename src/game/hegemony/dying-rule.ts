import { readRecipientFlags } from "./card-effect";
import { damageRule, ruleInput } from "./damage-rule";
import { readDamage, type Damage } from "./damage";
import { dyingPlayer, readDying, type Dying, type DyingGame } from "./dying";
import { readSlashAlive, readSlashCard, readSlashInteger } from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export type PeachRequest = { saver: string; who: string };
export interface RescueRules<G extends DyingGame> {
  /** Current shown Wansha + alive + non-NotActive phase, resolved by the package adapter. */
  hasActiveWansha: (game: Readonly<G>, current: string) => boolean;
  isProhibited: (game: Readonly<G>, saver: string, who: string) => boolean;
  isLocked: (game: Readonly<G>, saver: string) => boolean;
  ask: (request: PeachRequest) => TriggerOperation;
}
export interface RescueDoneRules {
  /** Owns killPlayer/death/burial; this checkpoint does not implement that pipeline. */
  kill: (target: string, damage: Damage | null) => TriggerOperation;
}
export function rescueBoolean(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new Error("Invalid rescue predicate result");
  return value;
}
export function createPostHpReducedOperation<
  G extends DyingGame,
>(): OperationHandler<G> {
  return {
    name: "post-hp-reduced",
    validate: (game, operation) => {
      const input = ruleInput(game, operation.data);
      if (input) readSlashInteger(game.hp[input.target]);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const input = ruleInput(game, operation.data);
      if (!input || readSlashInteger(game.hp[input.target]) > 0)
        return { kind: "return", value: null };
      const data = input.data;
      // JSON has no QVariant metatype: damage/nature identify this adapter's damage payload.
      const damage =
        data !== null &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        (Object.prototype.hasOwnProperty.call(data, "damage") ||
          Object.prototype.hasOwnProperty.call(data, "nature"))
          ? readDamage(game, data)
          : null;
      return {
        kind: "operation",
        operation: {
          name: "enter-dying",
          data: { target: input.target, damage },
        },
        continuation: true,
      };
    },
  };
}
export function createPostHpReducedRule<
  G extends DyingGame,
>(): TriggerSkill<G> {
  return damageRule("PostHpReduced", "post-hp-reduced");
}
type AskCursor = { saver: string; local: Dying };
function askInput(game: DyingGame, data: Parameters<typeof ruleInput>[1]) {
  const input = ruleInput(game, data);
  if (!input) return null;
  const dying = readDying(game, input.data);
  dyingPlayer(game, game.currentPlayer);
  readRecipientFlags(game, input.target);
  readSlashInteger(game.hp[dying.who]);
  return { saver: input.target, local: dying };
}
function runAsk<G extends DyingGame>(
  context: OperationContext<G>,
  rules: RescueRules<G>,
): OperationStep {
  const { game, operation, continuation, operationChild } = context;
  let cursor: AskCursor;
  if (continuation === null) {
    const input = askInput(game, operation.data);
    if (!input) return { kind: "return", value: null };
    cursor = input;
    const current = dyingPlayer(game, game.currentPlayer);
    if (
      rescueBoolean(rules.hasActiveWansha(structuredClone(game), current)) &&
      cursor.saver !== cursor.local.who &&
      cursor.saver !== current
    )
      return { kind: "return", value: null };
    if (readRecipientFlags(game, cursor.saver).includes("CannotHelp"))
      return { kind: "return", value: null };
  } else {
    cursor = structuredClone(continuation) as AskCursor;
    if (operationChild?.value === null) return { kind: "return", value: null };
    readSlashCard(game, operationChild!.value, cursor.saver);
  }
  if (readSlashInteger(game.hp[cursor.local.who]) > 0)
    return { kind: "return", value: null };
  if (
    rescueBoolean(
      rules.isProhibited(structuredClone(game), cursor.saver, cursor.local.who),
    ) ||
    rescueBoolean(rules.isLocked(structuredClone(game), cursor.saver))
  )
    return { kind: "return", value: null };
  if (!readSlashAlive(game, cursor.local.who))
    return { kind: "return", value: null };
  return {
    kind: "operation",
    operation: rules.ask({ saver: cursor.saver, who: cursor.local.who }),
    continuation: cursor,
  };
}
export function createAskForPeachesOperation<G extends DyingGame>(
  rules: RescueRules<G>,
): OperationHandler<G> {
  return {
    name: "ask-for-peaches",
    validate: (game, operation) => {
      askInput(game, operation.data);
    },
    run: (context) => runAsk(context, rules),
  };
}
export function createAskForPeachesRule<
  G extends DyingGame,
>(): TriggerSkill<G> {
  return damageRule("AskForPeaches", "ask-for-peaches");
}
export function createAskForPeachesDoneOperation<G extends DyingGame>(
  rules: RescueDoneRules,
): OperationHandler<G> {
  return {
    name: "ask-for-peaches-done",
    validate: (game, operation) => {
      const input = ruleInput(game, operation.data);
      if (input) readSlashInteger(game.hp[input.target]);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const input = ruleInput(game, operation.data);
      if (!input) return { kind: "return", value: null };
      for (const player of game.seatOrder) {
        const flags = readRecipientFlags(game, player);
        if (flags.includes("CannotHelp")) {
          game.playerFlags[player] = flags.filter(
            (flag) => flag !== "CannotHelp",
          );
          break;
        }
      }
      if (
        readSlashInteger(game.hp[input.target]) <= 0 &&
        readSlashAlive(game, input.target)
      ) {
        const dying = readDying(game, input.data);
        return {
          kind: "operation",
          operation: rules.kill(input.target, structuredClone(dying.damage)),
          continuation: true,
        };
      }
      return { kind: "return", value: null };
    },
  };
}
export function createAskForPeachesDoneRule<
  G extends DyingGame,
>(): TriggerSkill<G> {
  return damageRule("AskForPeachesDone", "ask-for-peaches-done");
}
