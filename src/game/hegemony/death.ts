import { readDamage, type Damage } from "./damage";
import { allPlayers } from "./damage-rule";
import { dyingPlayer, type DyingGame, type Dying } from "./dying";
import { readSlashAlive, readSlashInteger } from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

/** Private native identity facts, supplied by the general/identity adapter. */
export type DeathIdentity = {
  head: string;
  deputy: string;
  headKingdom: string;
  kingdom: string;
  role: string;
  headShown: boolean;
  deputyShown: boolean;
  lord: boolean;
  generalLord: boolean;
  actualHeadLord: boolean;
};
export interface DeathGame extends DyingGame {
  /** Native m_alivePlayers is separate from fixed registration order. */
  livingPlayers: string[];
  seats: Record<string, number>;
  acquiredSkills: Record<string, { head: string[]; deputy: string[] }>;
  playerHistory: Record<string, Record<string, number>>;
  identities: Record<string, DeathIdentity>;
  gameResult?: string | null;
}
export type Death = Dying;

/** Native getAllPlayers(true), including deceased seats. */
export function deathOrder(game: DeathGame): string[] {
  if (game.currentPlayer === null) return [...game.seatOrder];
  const index = game.seatOrder.indexOf(dyingPlayer(game, game.currentPlayer));
  return [...game.seatOrder.slice(index), ...game.seatOrder.slice(0, index)];
}

export function readDeathIdentity(
  game: DeathGame,
  target: string,
): DeathIdentity {
  const identity = game.identities?.[dyingPlayer(game, target)];
  if (
    !identity ||
    typeof identity !== "object" ||
    Array.isArray(identity) ||
    [
      identity.head,
      identity.deputy,
      identity.headKingdom,
      identity.kingdom,
      identity.role,
    ].some((v) => typeof v !== "string") ||
    [
      identity.headShown,
      identity.deputyShown,
      identity.lord,
      identity.generalLord,
      identity.actualHeadLord,
    ].some((v) => typeof v !== "boolean")
  )
    throw new Error("Invalid death identity");
  return structuredClone(identity);
}

function acquired(game: DeathGame, target: string) {
  const skills = game.acquiredSkills?.[target];
  if (
    !skills ||
    !Array.isArray(skills.head) ||
    !Array.isArray(skills.deputy) ||
    [...skills.head, ...skills.deputy].some((s) => typeof s !== "string")
  )
    throw new Error("Invalid acquired skills");
  return skills;
}
export function livingPlayers(game: DeathGame): string[] {
  const players = game.livingPlayers;
  if (
    !Array.isArray(players) ||
    new Set(players).size !== players.length ||
    players.some((p) => typeof p !== "string" || !game.seatOrder.includes(p))
  )
    throw new Error("Invalid living player list");
  return [...players];
}
function killInput(game: DeathGame, data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid killPlayer input");
  const target = dyingPlayer(game, data.target);
  const damage: Damage | null =
    data.damage === null ? null : readDamage(game, data.damage);
  acquired(game, target);
  readSlashAlive(game, target);
  readSlashInteger(game.hp[target]);
  allPlayers(game);
  const players = livingPlayers(game),
    index = players.indexOf(target);
  for (const player of players.slice(index + 1))
    readSlashInteger(readSlashInteger(game.seats?.[player]) - 1);
  return { target, damage, players, index };
}
type Cursor = {
  stage: "before" | "hp" | "judge" | "death" | "finished";
  target: string;
  shared: TriggerData;
  players: string[];
  index: number;
};
function runKill<G extends DeathGame>({
  game,
  operation,
  continuation,
  child,
}: OperationContext<G>): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const input = killInput(game, operation.data),
      players = allPlayers(game);
    game.alive[input.target] = false;
    for (const player of input.players.slice(input.index + 1))
      game.seats[player]--;
    if (input.index >= 0) input.players.splice(input.index, 1);
    game.livingPlayers = input.players;
    cursor = {
      stage: "before",
      target: input.target,
      shared: { who: input.target, damage: input.damage },
      players,
      index: 0,
    };
    return {
      kind: "event",
      event: {
        name: "BeforeGameOverJudge",
        target: cursor.target,
        data: cursor.shared,
      },
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as Cursor;
  if (child && cursor.stage !== "hp")
    cursor.shared = structuredClone(child.event.data);
  if (cursor.stage === "before") {
    game.hp[cursor.target] = 0;
    cursor.stage = "hp";
    return {
      kind: "event",
      event: { name: "HpChanged", target: cursor.target, data: null },
      continuation: cursor,
    };
  }
  if (cursor.stage === "hp") {
    cursor.stage = "judge";
    return {
      kind: "event",
      event: {
        name: "GameOverJudge",
        target: cursor.target,
        data: cursor.shared,
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "judge") cursor.stage = "death";
  if (cursor.stage === "death" || cursor.stage === "finished") {
    while (cursor.index < cursor.players.length) {
      const target = cursor.players[cursor.index++];
      if (readSlashAlive(game, target) || target === cursor.target)
        return {
          kind: "event",
          event: {
            name: cursor.stage === "death" ? "Death" : "DeathFinished",
            target,
            data: cursor.shared,
          },
          continuation: cursor,
        };
    }
    if (cursor.stage === "death") {
      acquired(game, cursor.target);
      game.acquiredSkills[cursor.target] = { head: [], deputy: [] };
      cursor.stage = "finished";
      cursor.index = 0;
      return {
        kind: "event",
        event: {
          name: "BuryVictim",
          target: cursor.target,
          data: cursor.shared,
        },
        continuation: cursor,
      };
    }
  }
  return { kind: "return", value: null };
}
export function createKillPlayerOperation<
  G extends DeathGame,
>(): OperationHandler<G> {
  return {
    name: "kill-player",
    validate: (game, operation) => {
      killInput(game, operation.data);
    },
    run: runKill,
  };
}
