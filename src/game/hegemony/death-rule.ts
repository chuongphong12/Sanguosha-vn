import { allPlayers, damageRule, ruleInput } from "./damage-rule";
import { damageRoomTags } from "./damage";
import { readRecipientFlags } from "./card-effect";
import {
  deathOrder,
  readDeathIdentity,
  type DeathGame,
  type Death,
} from "./death";
import { dyingPlayer, readDying } from "./dying";
import { rescueBoolean } from "./dying-rule";
import { readSlashAlive, readSlashInteger } from "./slash";
import type {
  OperationHandler,
  OperationContext,
  OperationStep,
  TriggerSkill,
  TriggerOperation,
  TriggerData,
} from "./scheduler";

export interface DeathRelations<G extends DeathGame> {
  isFriend: (game: Readonly<G>, a: string, b: string) => boolean;
}
export interface BuryVictimRules {
  bury: (target: string) => TriggerOperation;
  reward: (killer: string, victim: string) => TriggerOperation;
  /** Hidden recipients receive a private notification, not an authoritative role change. */
  notifyRole: (target: string, role: "careerist") => TriggerOperation;
}
function buryVictimInput(game: DeathGame, data: TriggerData) {
  const input = ruleInput(game, data);
  return input
    ? { target: input.target, death: readDying(game, input.data) }
    : null;
}
type BuryCursor = {
  stage: "bury" | "reward" | "convert";
  target: string;
  death: Death;
  players: string[];
  index: number;
};
function runBuryVictim<G extends DeathGame>(
  { game, operation, continuation }: OperationContext<G>,
  rules: BuryVictimRules,
): OperationStep {
  let cursor: BuryCursor;
  if (continuation === null) {
    const input = buryVictimInput(game, operation.data);
    if (!input) return { kind: "return", value: null };
    cursor = { ...input, stage: "bury", players: [], index: 0 };
    return {
      kind: "operation",
      operation: rules.bury(cursor.target),
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as BuryCursor;
  if (cursor.stage === "bury") {
    const skip = damageRoomTags(game).SkipNormalDeathProcess;
    if (skip !== undefined && rescueBoolean(skip))
      return { kind: "return", value: null };
    const killer = cursor.death.damage?.from;
    if (killer !== undefined && killer !== null) {
      const marks = game.playerMarks?.[killer];
      if (!marks || typeof marks !== "object" || Array.isArray(marks))
        throw new Error("Invalid kill marks");
      marks.multi_kill_count = readSlashInteger(
        readSlashInteger(
          marks.multi_kill_count === undefined ? 0 : marks.multi_kill_count,
        ) + 1,
      );
      const flags = readRecipientFlags(game, killer);
      if (flags.includes("NoRewardPunishFlag"))
        game.playerFlags[killer] = flags.filter(
          (f) => f !== "NoRewardPunishFlag",
        );
      else {
        cursor.stage = "reward";
        return {
          kind: "operation",
          operation: rules.reward(killer, cursor.target),
          continuation: cursor,
        };
      }
    }
  }
  if (cursor.stage !== "convert") {
    if (
      !readDeathIdentity(game, cursor.target).generalLord ||
      cursor.target !== cursor.death.who
    )
      return { kind: "return", value: null };
    cursor.players = deathOrder(game).filter((p) => p !== cursor.target);
    cursor.stage = "convert";
  }
  while (cursor.index < cursor.players.length) {
    const target = cursor.players[cursor.index++],
      identity = readDeathIdentity(game, target);
    if (
      identity.kingdom !== readDeathIdentity(game, cursor.target).kingdom ||
      identity.role.startsWith("careerist")
    )
      continue;
    if (identity.headShown || identity.deputyShown)
      game.identities[target].role = "careerist";
    else
      return {
        kind: "operation",
        operation: rules.notifyRole(target, "careerist"),
        continuation: cursor,
      };
  }
  return { kind: "return", value: null };
}
export function createBuryVictimOperation<G extends DeathGame>(
  rules: BuryVictimRules,
): OperationHandler<G> {
  return {
    name: "bury-victim",
    validate: (game, operation) => {
      buryVictimInput(game, operation.data);
    },
    run: (context) => runBuryVictim(context, rules),
  };
}
export function createBuryVictimRule<G extends DeathGame>(): TriggerSkill<G> {
  return damageRule("BuryVictim", "bury-victim");
}
export interface RewardRules<G extends DeathGame> extends DeathRelations<G> {
  draw: (target: string, count: number) => TriggerOperation;
  discard: (target: string) => TriggerOperation;
}
function rewardInput(game: DeathGame, data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid reward input");
  const killer = dyingPlayer(game, data.killer),
    victim = dyingPlayer(game, data.victim);
  readSlashAlive(game, killer);
  return { killer, victim };
}
export function createRewardOperation<G extends DeathGame>(
  rules: RewardRules<G>,
): OperationHandler<G> {
  return {
    name: "reward-punish",
    validate: (game, operation) => {
      rewardInput(game, operation.data);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const { killer, victim } = rewardInput(game, operation.data);
      if (!readSlashAlive(game, killer)) return { kind: "return", value: null };
      const identity = readDeathIdentity(game, killer);
      if (!identity.headShown && !identity.deputyShown)
        return { kind: "return", value: null };
      if (rescueBoolean(rules.isFriend(structuredClone(game), killer, victim)))
        return {
          kind: "operation",
          operation: rules.discard(killer),
          continuation: true,
        };
      let count = 3;
      if (identity.role !== "careerist") {
        count = 1;
        const others = allPlayers(game).filter(
          (p) => p !== victim || !readSlashAlive(game, victim),
        );
        for (const player of others)
          if (
            rescueBoolean(rules.isFriend(structuredClone(game), victim, player))
          )
            count = readSlashInteger(count + 1);
      }
      return {
        kind: "operation",
        operation: rules.draw(killer, count),
        continuation: true,
      };
    },
  };
}
