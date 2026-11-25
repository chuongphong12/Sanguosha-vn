import {
  damageRoomTags,
  readDamage,
  type Damage,
  type DamageGame,
} from "./damage";
import { allPlayers } from "./damage-rule";
import { readRecipientFlags } from "./card-effect";
import { readSlashInteger, readSlashAlive } from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

export interface DyingGame extends DamageGame {
  maxHp: Record<string, number>;
  /** Private saver property, independent of the shared CurrentDying room tag. */
  currentdying: Record<string, string>;
  currentCardUseReason?: "play" | "response" | "response-use";
}
export type Dying = { who: string; damage: Damage | null };
export function dyingPlayer(
  game: DyingGame,
  value: TriggerData | undefined,
): string {
  if (typeof value !== "string" || !game.seatOrder.includes(value))
    throw new Error("Invalid dying player");
  return value;
}
export function readDying(game: DyingGame, value: TriggerData): Dying {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid dying data");
  return {
    who: dyingPlayer(game, value.who),
    damage: value.damage === null ? null : readDamage(game, value.damage),
  };
}
function currentDying(game: DyingGame): string[] {
  const value = damageRoomTags(game).CurrentDying;
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((p) => typeof p !== "string"))
    throw new Error("Invalid CurrentDying");
  return [...value] as string[];
}
function saverProperty(game: DyingGame, player: string): string {
  if (
    !game.currentdying ||
    typeof game.currentdying !== "object" ||
    Array.isArray(game.currentdying)
  )
    throw new Error("Invalid currentdying properties");
  const value = game.currentdying[player];
  if (value === undefined) return "";
  if (typeof value !== "string")
    throw new Error("Invalid currentdying property");
  return value;
}
function enterInput(game: DyingGame, value: TriggerData) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid enterDying input");
  const target = dyingPlayer(game, value.target);
  const damage = value.damage === null ? null : readDamage(game, value.damage);
  currentDying(game);
  readRecipientFlags(game, target);
  allPlayers(game);
  readSlashAlive(game, target);
  readSlashInteger(game.hp[target]);
  return { target, damage };
}
type EnterCursor = {
  stage: "dying" | "rescue" | "restore" | "done" | "quit" | "returned";
  target: string;
  shared: TriggerData;
  players: string[];
  index: number;
  saver: string | null;
  previous: string;
};
function runEnter<G extends DyingGame>({
  game,
  operation,
  continuation,
  child,
}: OperationContext<G>): OperationStep {
  let cursor: EnterCursor;
  if (continuation === null) {
    const input = enterInput(game, operation.data);
    const flags = readRecipientFlags(game, input.target);
    if (!flags.includes("Global_Dying"))
      game.playerFlags[input.target] = [...flags, "Global_Dying"];
    damageRoomTags(game).CurrentDying = [...currentDying(game), input.target];
    cursor = {
      stage: "dying",
      target: input.target,
      shared: { who: input.target, damage: input.damage },
      players: allPlayers(game),
      index: 0,
      saver: null,
      previous: "",
    };
  } else cursor = structuredClone(continuation) as EnterCursor;
  if (child) cursor.shared = structuredClone(child.event.data);
  if (cursor.stage === "dying") {
    if (child?.consumed) cursor.index = cursor.players.length;
    if (cursor.index < cursor.players.length)
      return {
        kind: "event",
        event: {
          name: "Dying",
          target: cursor.players[cursor.index++],
          data: cursor.shared,
        },
        continuation: cursor,
      };
    if (
      readSlashAlive(game, cursor.target) &&
      readSlashInteger(game.hp[cursor.target]) <= 0
    ) {
      cursor.stage = "rescue";
      cursor.players = allPlayers(game);
      cursor.index = 0;
    } else {
      if (readSlashAlive(game, cursor.target))
        game.playerFlags[cursor.target] = readRecipientFlags(
          game,
          cursor.target,
        ).filter((f) => f !== "Global_Dying");
      cursor.stage = "quit";
    }
  }
  if (cursor.stage === "restore") {
    game.currentdying[cursor.saver!] = cursor.previous;
    cursor.stage = "rescue";
  }
  if (cursor.stage === "rescue") {
    if (
      cursor.index < cursor.players.length &&
      readSlashInteger(game.hp[cursor.target]) <= 0 &&
      readSlashAlive(game, cursor.target)
    ) {
      cursor.saver = cursor.players[cursor.index++];
      cursor.previous = saverProperty(game, cursor.saver);
      game.currentdying[cursor.saver] = cursor.target;
      cursor.stage = "restore";
      return {
        kind: "event",
        event: {
          name: "AskForPeaches",
          target: cursor.saver,
          data: cursor.shared,
        },
        continuation: cursor,
      };
    }
    cursor.stage = "done";
    return {
      kind: "event",
      event: {
        name: "AskForPeachesDone",
        target: cursor.target,
        data: cursor.shared,
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "done") {
    game.playerFlags[cursor.target] = readRecipientFlags(
      game,
      cursor.target,
    ).filter((f) => f !== "Global_Dying");
    cursor.stage = "quit";
  }
  if (cursor.stage === "quit") {
    const dying = currentDying(game),
      index = dying.indexOf(cursor.target);
    if (index >= 0) dying.splice(index, 1);
    damageRoomTags(game).CurrentDying = dying;
    cursor.stage = "returned";
    return {
      kind: "event",
      event: { name: "QuitDying", target: cursor.target, data: cursor.shared },
      continuation: cursor,
    };
  }
  return { kind: "return", value: null };
}
export function createEnterDyingOperation<
  G extends DyingGame,
>(): OperationHandler<G> {
  return {
    name: "enter-dying",
    validate: (game, operation) => {
      enterInput(game, operation.data);
    },
    run: runEnter,
  };
}
