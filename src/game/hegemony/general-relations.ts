import { readDeathIdentity } from "./death";
import { dyingPlayer } from "./dying";
import {
  hasShownGeneral,
  seemingKingdom,
  type GeneralGame,
} from "./general-identity";
import { readSlashAlive } from "./slash";

/** Private Player::isFriendWith authority; never consumes a viewer projection. */
export function areGeneralFriends(
  game: GeneralGame,
  a: string,
  b: string,
): boolean {
  dyingPlayer(game, a);
  dyingPlayer(game, b);
  if (a === b) return true;
  if (!hasShownGeneral(game, a) || !hasShownGeneral(game, b)) return false;
  const left = readDeathIdentity(game, a),
    right = readDeathIdentity(game, b);
  if (left.role === "careerist" || right.role === "careerist") return false;
  if (left.role.startsWith("careerist") || right.role.startsWith("careerist"))
    return left.role === right.role;
  return left.kingdom === right.kingdom;
}

/** Directional native prediction for a hidden actor against a shown target. */
export function willBeGeneralFriends(
  game: GeneralGame,
  a: string,
  b: string,
): boolean {
  if (areGeneralFriends(game, a, b)) return true;
  if (!hasShownGeneral(game, b) || hasShownGeneral(game, a)) return false;
  const identity = readDeathIdentity(game, a),
    kingdom = identity.headKingdom;
  let count = 1,
    hasLord = readSlashAlive(game, a) && identity.lord;
  if (!hasLord) {
    for (const player of game.seatOrder) {
      if (player === a || seemingKingdom(game, player) !== kingdom) continue;
      const other = readDeathIdentity(game, player);
      if (readSlashAlive(game, player) && other.lord) {
        hasLord = true;
        break;
      }
      if (hasShownGeneral(game, player) && other.role !== "careerist") count++;
    }
  }
  if (!hasLord && count > game.seatOrder.length / 2) return false;
  return kingdom === seemingKingdom(game, b);
}

/** Room::getLord: displayed head, raw registration, current kingdom; not Player::getLord. */
export function generalRoomLord(
  game: GeneralGame,
  kingdom: string,
  includeDead = false,
): string | null {
  for (const player of game.seatOrder) {
    const identity = readDeathIdentity(game, player);
    if (
      identity.generalLord &&
      (includeDead || readSlashAlive(game, player)) &&
      identity.kingdom === kingdom
    )
      return player;
  }
  return null;
}
