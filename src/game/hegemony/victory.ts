import {
  deathOrder,
  livingPlayers,
  readDeathIdentity,
  type DeathGame,
} from "./death";
import type { DeathRelations } from "./death-rule";
import { rescueBoolean } from "./dying-rule";
import { dyingPlayer } from "./dying";
import { damageRule, ruleInput } from "./damage-rule";
import { readSlashAlive, readSlashInteger } from "./slash";
import type { GeneralSlot } from "./types";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export interface DeathRevealRules {
  /** Adapter must use showGeneral(slot, trigger_event=false, sendLog=false). */
  showGeneral: (target: string, slot: GeneralSlot) => TriggerOperation;
}
export interface GameOverJudgeRules {
  winner: () => TriggerOperation;
  over: (winner: string) => TriggerOperation;
}
export function createBeforeGameOverJudgeOperation<G extends DeathGame>(
  rules: DeathRevealRules,
): OperationHandler<G> {
  return {
    name: "before-game-over-judge",
    validate: (game, operation) => {
      ruleInput(game, operation.data);
    },
    run: ({ game, operation, continuation }) => {
      const input = ruleInput(game, operation.data);
      if (!input) return { kind: "return", value: null };
      let index = continuation === null ? 0 : Number(continuation);
      while (index < 2) {
        const slot: GeneralSlot = index++ === 0 ? "head" : "deputy",
          identity = readDeathIdentity(game, input.target);
        if (!(slot === "head" ? identity.headShown : identity.deputyShown))
          return {
            kind: "operation",
            operation: rules.showGeneral(input.target, slot),
            continuation: index,
          };
      }
      return { kind: "return", value: null };
    },
  };
}
export function createBeforeGameOverJudgeRule<
  G extends DeathGame,
>(): TriggerSkill<G> {
  return damageRule("BeforeGameOverJudge", "before-game-over-judge");
}
export function createGameOverJudgeOperation<G extends DeathGame>(
  rules: GameOverJudgeRules,
): OperationHandler<G> {
  return {
    name: "game-over-judge",
    validate: (game, operation) => {
      ruleInput(game, operation.data);
    },
    run: ({ game, operation, continuation, operationChild }) => {
      if (continuation === 2) return { kind: "return", value: true };
      if (continuation === null) {
        if (!ruleInput(game, operation.data))
          return { kind: "return", value: false };
        return {
          kind: "operation",
          operation: rules.winner(),
          continuation: 1,
        };
      }
      const winner = operationChild?.value;
      if (winner === null) return { kind: "return", value: false };
      if (typeof winner !== "string") throw new Error("Invalid winner result");
      return {
        kind: "operation",
        operation: rules.over(winner),
        continuation: 2,
      };
    },
  };
}
export function createGameOverJudgeRule<
  G extends DeathGame,
>(): TriggerSkill<G> {
  const rule = damageRule<G>("GameOverJudge", "game-over-judge");
  return {
    ...rule,
    effect: (context) =>
      context.operationChild
        ? { kind: "done", value: rescueBoolean(context.operationChild.value) }
        : rule.effect!(context),
  };
}
export function createGameOverOperation<
  G extends DeathGame,
>(): OperationHandler<G> {
  return {
    name: "game-over",
    validate: (_, operation) => {
      if (typeof operation.data !== "string")
        throw new Error("Invalid game-over winner");
    },
    run: ({ game, operation }) => {
      if (typeof operation.data !== "string")
        throw new Error("Invalid game-over winner");
      game.gameResult = operation.data;
      return { kind: "interrupt", reason: "game-over" };
    },
  };
}
export interface WinnerRules<G extends DeathGame>
  extends DeathRelations<G>, DeathRevealRules {
  willBeFriend: (game: Readonly<G>, a: string, b: string) => boolean;
  getLord: (game: Readonly<G>, kingdom: string) => string | null;
  /** Owns native doCareeristRule/recruitment; a true result postpones victory. */
  careerist: () => TriggerOperation;
}
function winnerPlayers(game: DeathGame) {
  const living = livingPlayers(game),
    players = deathOrder(game).filter((p) => living.includes(p));
  if (!players.length)
    throw new Error("Winner decision requires living players");
  return players;
}
type Cursor = {
  stage: "reveal" | "careerist";
  players: string[];
  index: number;
  slot: GeneralSlot;
};
function canWin<G extends DeathGame>(
  game: G,
  players: string[],
  rules: WinnerRules<G>,
) {
  for (const a of players)
    for (const b of players) {
      const left = readDeathIdentity(game, a),
        right = readDeathIdentity(game, b);
      const shownA = rescueBoolean(rules.hasShown(structuredClone(game), a)),
        shownB = rescueBoolean(rules.hasShown(structuredClone(game), b));
      if (
        shownA &&
        shownB &&
        !rescueBoolean(rules.isFriend(structuredClone(game), a, b))
      )
        return false;
      if (
        shownA &&
        !shownB &&
        !rescueBoolean(rules.willBeFriend(structuredClone(game), b, a))
      )
        return false;
      if (
        !shownA &&
        shownB &&
        !rescueBoolean(rules.willBeFriend(structuredClone(game), a, b))
      )
        return false;
      if (!shownA && !shownB && left.headKingdom !== right.headKingdom)
        return false;
    }
  const lords = new Set<string>(),
    kingdoms = new Map<string, number>();
  for (const player of game.seatOrder) {
    const identity = readDeathIdentity(game, player);
    if (
      (identity.lord || identity.actualHeadLord) &&
      readSlashAlive(game, player)
    )
      lords.add(identity.headKingdom);
  }
  for (const player of game.seatOrder) {
    const identity = readDeathIdentity(game, player),
      shown = rescueBoolean(rules.hasShown(structuredClone(game), player));
    if (!shown && lords.size) return false;
    const kingdom = shown ? identity.kingdom : identity.headKingdom;
    if (lords.has(kingdom)) continue;
    const lord = rules.getLord(structuredClone(game), kingdom);
    if (lord !== null) dyingPlayer(game, lord);
    const count = readSlashInteger(
      (kingdoms.get(kingdom) ?? 0) +
        (lord !== null && !readSlashAlive(game, lord) ? 10 : 1),
    );
    kingdoms.set(kingdom, count);
    if (
      readSlashAlive(game, player) &&
      !shown &&
      count > game.seatOrder.length / 2
    )
      return false;
  }
  return true;
}
function runWinner<G extends DeathGame>(
  { game, continuation, operationChild }: OperationContext<G>,
  rules: WinnerRules<G>,
): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const players = winnerPlayers(game);
    cursor = { stage: "reveal", players, index: 0, slot: "head" };
    if (players.length > 1) {
      if (!canWin(game, players, rules)) return { kind: "return", value: null };
      cursor.stage = "careerist";
      return {
        kind: "operation",
        operation: rules.careerist(),
        continuation: cursor,
      };
    }
  } else cursor = structuredClone(continuation) as Cursor;
  if (cursor.stage === "careerist") {
    if (rescueBoolean(operationChild?.value))
      return { kind: "return", value: null };
    cursor.stage = "reveal";
  }
  while (cursor.index < cursor.players.length) {
    const target = cursor.players[cursor.index],
      slot = cursor.slot,
      identity = readDeathIdentity(game, target);
    if (slot === "head") cursor.slot = "deputy";
    else {
      cursor.slot = "head";
      cursor.index++;
    }
    if (!(slot === "head" ? identity.headShown : identity.deputyShown))
      return {
        kind: "operation",
        operation: rules.showGeneral(target, slot),
        continuation: cursor,
      };
  }
  const first = cursor.players[0],
    winners: string[] = [];
  for (const player of game.seatOrder)
    if (rescueBoolean(rules.isFriend(structuredClone(game), first, player)))
      winners.push(player);
  return { kind: "return", value: winners.join("+") };
}
export function createGetWinnerOperation<G extends DeathGame>(
  rules: WinnerRules<G>,
): OperationHandler<G> {
  return {
    name: "get-winner",
    validate: (game) => {
      winnerPlayers(game);
    },
    run: (context) => runWinner(context, rules),
  };
}
