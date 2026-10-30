import { readCardReference, type CardResources } from "./card-resources";
import { readRecipientFlags } from "./card-effect";
import {
  readSlashCard,
  readSlashInteger,
  readSlashAlive,
  removeQinggang,
  type SlashCard,
  type SlashGame,
  type SlashEffect,
} from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

export type Damage = {
  from: string | null;
  to: string | null;
  card: SlashCard | null;
  damage: number;
  nature: SlashEffect["nature"];
  chain: boolean;
  transfer: boolean;
  by_user: boolean;
  reason: string;
  flags: string[];
  transfer_reason: string;
  prevented: boolean;
};
/** Authoritative private damage state; not a projected player view. */
export interface DamageGame extends SlashGame {
  cardResources: CardResources;
  removed: Record<string, boolean>;
  hp: Record<string, number>;
  chained: Record<string, boolean>;
  currentPlayer: string | null;
  damageStack: Damage[];
}
export function damageRoomTags(game: DamageGame): Record<string, TriggerData> {
  const tags = game.cardResources?.roomTags;
  if (!tags || typeof tags !== "object" || Array.isArray(tags))
    throw new Error("Invalid damage room tags");
  return tags;
}
export function readDamage(game: DamageGame, value: TriggerData): Damage {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid damage data");
  for (const field of ["from", "to"])
    if (
      value[field] !== null &&
      (typeof value[field] !== "string" ||
        !game.seatOrder.includes(value[field]))
    )
      throw new Error("Invalid damage player");
  for (const field of ["chain", "transfer", "by_user", "prevented"])
    if (typeof value[field] !== "boolean")
      throw new Error("Invalid damage boolean");
  if (
    typeof value.reason !== "string" ||
    typeof value.transfer_reason !== "string" ||
    typeof value.nature !== "string" ||
    !["normal", "fire", "thunder"].includes(value.nature) ||
    !Array.isArray(value.flags) ||
    value.flags.some((flag) => typeof flag !== "string")
  )
    throw new Error("Invalid damage fields");
  const card =
    value.card === null
      ? null
      : readSlashCard(game, value.card, game.seatOrder[0]);
  const damage = readSlashInteger(value.damage);
  return { ...structuredClone(value), card, damage } as Damage;
}
export function damageRecipient(damage: Damage): string {
  if (damage.to === null) throw new Error("Damage stage requires a recipient");
  return damage.to;
}
export function damagePlayerTags(game: DamageGame, player: string) {
  const tags = game.cardResources?.playerTags;
  if (
    !tags ||
    !Object.prototype.hasOwnProperty.call(tags, player) ||
    !tags[player] ||
    typeof tags[player] !== "object" ||
    Array.isArray(tags[player])
  )
    throw new Error("Invalid damage player tags");
  return tags[player];
}
function removed(game: DamageGame, player: string) {
  if (
    !Object.prototype.hasOwnProperty.call(game.removed, player) ||
    typeof game.removed[player] !== "boolean"
  )
    throw new Error("Invalid damage removed state");
  return game.removed[player];
}
function stack(game: DamageGame) {
  if (!Array.isArray(game.damageStack)) throw new Error("Invalid damage stack");
  return game.damageStack;
}
function damageInput(game: DamageGame, value: TriggerData) {
  const damage = readDamage(game, value);
  damageRoomTags(game);
  stack(game);
  if (
    damage.to !== null &&
    readSlashAlive(game, damage.to) &&
    !removed(game, damage.to) &&
    damage.from !== null
  )
    readSlashAlive(game, damage.from);
  return damage;
}
function cleanArmor(game: DamageGame, damage: Damage) {
  if (
    damage.card !== null &&
    readCardReference(game, damage.card.reference).card.isSlash
  )
    removeQinggang(game, { to: damageRecipient(damage), slash: damage.card });
}
type DamageCursor = {
  stage: number;
  local: Damage;
  shared: TriggerData;
  entered: boolean;
};
function eventStep(
  cursor: DamageCursor,
  name: string,
  target: string | null,
  next: number,
): OperationStep {
  cursor.stage = next;
  return {
    kind: "event",
    event: { name, target, data: structuredClone(cursor.shared) },
    continuation: cursor,
  };
}
function preventedComplete(
  game: DamageGame,
  cursor: DamageCursor,
): OperationStep {
  cursor.local = readDamage(game, cursor.shared);
  cursor.local.prevented = true;
  cursor.shared = structuredClone(cursor.local);
  damageRoomTags(game).SkipGameRule = true;
  return eventStep(cursor, "DamageComplete", damageRecipient(cursor.local), 11);
}
function runDamage<G extends DamageGame>({
  game,
  operation,
  continuation,
  child,
}: OperationContext<G>): OperationStep {
  const cursor: DamageCursor =
    continuation === null
      ? {
          stage: 0,
          local: damageInput(game, operation.data),
          shared: null,
          entered: false,
        }
      : (structuredClone(continuation) as DamageCursor);
  if (child && cursor.stage !== 6)
    cursor.shared = structuredClone(child.event.data);
  if (cursor.stage === 0) {
    if (
      cursor.local.to === null ||
      !readSlashAlive(game, cursor.local.to) ||
      removed(game, cursor.local.to)
    )
      return { kind: "return", value: null };
    if (cursor.local.from !== null && !readSlashAlive(game, cursor.local.from))
      cursor.local.from = null;
    cursor.shared = structuredClone(cursor.local);
    if (!cursor.local.chain && !cursor.local.transfer)
      return eventStep(cursor, "ConfirmDamage", cursor.local.from, 1);
    cursor.stage = 1;
  }
  if (cursor.stage === 1) {
    cursor.local = readDamage(game, cursor.shared);
    return eventStep(cursor, "Predamage", cursor.local.from, 2);
  }
  if (cursor.stage === 2) {
    if (child?.consumed) {
      cleanArmor(game, cursor.local);
      return { kind: "return", value: null };
    }
    return eventStep(cursor, "DamageForseen", damageRecipient(cursor.local), 3);
  }
  if (cursor.stage === 3) {
    if (child?.consumed) {
      cleanArmor(game, cursor.local);
      return preventedComplete(game, cursor);
    }
    if (cursor.local.from !== null)
      return eventStep(cursor, "DamageCaused", cursor.local.from, 4);
    cursor.stage = 4;
  }
  if (cursor.stage === 4) {
    if (child?.consumed) {
      cleanArmor(game, cursor.local);
      return preventedComplete(game, cursor);
    }
    cursor.local = readDamage(game, cursor.shared);
    delete damagePlayerTags(game, damageRecipient(cursor.local)).TransferDamage;
    return eventStep(
      cursor,
      "DamageInflicted",
      damageRecipient(cursor.local),
      5,
    );
  }
  if (cursor.stage === 5) {
    if (child?.consumed) {
      cleanArmor(game, cursor.local);
      const transfer = damagePlayerTags(
        game,
        damageRecipient(cursor.local),
      ).TransferDamage;
      if (transfer !== undefined && transfer !== null) {
        const damage = readDamage(game, transfer);
        if (damage.to !== null) {
          cursor.stage = 6;
          return {
            kind: "operation",
            operation: { name: "damage", data: damage },
            continuation: cursor,
          };
        }
      }
      return preventedComplete(game, cursor);
    }
    cursor.entered = true;
    stack(game).push(structuredClone(cursor.local));
    damageRoomTags(game).CurrentDamageStruct = structuredClone(cursor.shared);
    return eventStep(cursor, "PreDamageDone", damageRecipient(cursor.local), 7);
  }
  if (cursor.stage === 6) return preventedComplete(game, cursor);
  if (cursor.stage === 7) {
    cleanArmor(game, cursor.local);
    return eventStep(cursor, "DamageDone", damageRecipient(cursor.local), 8);
  }
  if (cursor.stage === 8) {
    if (
      cursor.local.from !== null &&
      !readRecipientFlags(game, cursor.local.from).includes("Global_DFDebut")
    )
      return eventStep(cursor, "Damage", cursor.local.from, 9);
    cursor.stage = 9;
  }
  if (cursor.stage === 9) {
    if (
      !readRecipientFlags(game, damageRecipient(cursor.local)).includes(
        "Global_DFDebut",
      )
    )
      return eventStep(cursor, "Damaged", damageRecipient(cursor.local), 10);
    cursor.stage = 10;
  }
  if (cursor.stage === 10) {
    cursor.local = readDamage(game, cursor.shared);
    return eventStep(
      cursor,
      "DamageComplete",
      damageRecipient(cursor.local),
      11,
    );
  }
  if (cursor.entered) {
    stack(game).pop();
    const tags = damageRoomTags(game);
    if (!game.damageStack.length) delete tags.CurrentDamageStruct;
    else tags.CurrentDamageStruct = structuredClone(game.damageStack[0]);
  }
  return { kind: "return", value: null };
}
export function createDamageOperation<
  G extends DamageGame,
>(): OperationHandler<G> {
  return {
    name: "damage",
    validate: (game, operation) => {
      damageInput(game, operation.data);
    },
    run: runDamage,
    unwind: ({ game, normalContinuation, interruption }) => {
      if (normalContinuation === null || interruption.reason === "game-over")
        return { kind: "return", value: null };
      const cursor = normalContinuation as DamageCursor;
      if (
        !Number.isSafeInteger(cursor.stage) ||
        cursor.stage < 0 ||
        cursor.stage > 11
      )
        throw new Error("Invalid damage cleanup continuation");
      // ConfirmDamage/Predamage are before native Room::damage's try block.
      if (cursor.stage >= 3) {
        const tags = damageRoomTags(game);
        const pending = stack(game);
        delete tags.is_chained;
        delete tags.CurrentDamageStruct;
        pending.length = 0;
      }
      return { kind: "return", value: null };
    },
  };
}
