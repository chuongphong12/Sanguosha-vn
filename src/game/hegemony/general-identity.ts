import type { CareeristGame } from "./careerist";
import { readDeathIdentity } from "./death";
import { deathOrder } from "./death";
import { damageRoomTags } from "./damage";
import { readSlashAlive } from "./slash";

/** Private native actual names, displayed names and normalized general metadata. */
export interface GeneralGame extends CareeristGame {
  generalNames: Record<string, string[]>;
  displayedGenerals: Record<string, { head: string; deputy: string }>;
  generalCatalog: Record<
    string,
    { kingdom: string; doubleKingdom: boolean; lord: boolean }
  >;
}
function mappedRole(kingdom: string) {
  switch (kingdom) {
    case "wei":
      return "lord";
    case "shu":
      return "loyalist";
    case "wu":
      return "rebel";
    case "qun":
      return "renegade";
    case "god":
      return "careerist";
    default:
      return kingdom;
  }
}
export function generalDefinition(game: GeneralGame, name: string) {
  const definition = game.generalCatalog?.[name];
  if (
    !definition ||
    typeof definition !== "object" ||
    Array.isArray(definition) ||
    typeof definition.kingdom !== "string" ||
    typeof definition.doubleKingdom !== "boolean" ||
    typeof definition.lord !== "boolean"
  )
    throw new Error("Invalid general definition");
  return structuredClone(definition);
}
export function hasShownGeneral(game: GeneralGame, target: string) {
  const properties = game.scenarioRoleShown;
  if (
    !properties ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  )
    throw new Error("Invalid scenario role properties");
  const role = properties[target];
  if (role !== undefined && typeof role !== "boolean")
    throw new Error("Invalid scenario role shown");
  const identity = readDeathIdentity(game, target);
  return role === true || identity.headShown || identity.deputyShown;
}
function seemingKingdom(game: GeneralGame, target: string) {
  if (!hasShownGeneral(game, target)) return "";
  const identity = readDeathIdentity(game, target);
  return identity.role === "careerist" || identity.role.startsWith("careerist_")
    ? identity.role
    : identity.kingdom;
}
function playerLord(game: GeneralGame, target: string, includeDead: boolean) {
  const identity = readDeathIdentity(game, target);
  if (identity.actualHeadLord) return target;
  const players = game.seatOrder.filter(
    (p) => p !== target && (includeDead || readSlashAlive(game, p)),
  );
  players.push(target);
  return (
    players.find((p) => {
      const other = readDeathIdentity(game, p);
      return other.generalLord && other.kingdom === identity.kingdom;
    }) ?? null
  );
}
function firstRole(game: GeneralGame, target: string, kingdom: string) {
  let role = mappedRole(kingdom);
  const quanjia = damageRoomTags(game).GlobalQuanjiaShow;
  if (quanjia !== undefined && quanjia !== null && typeof quanjia !== "boolean")
    throw new Error("Invalid GlobalQuanjiaShow");
  if (quanjia === true) return role;
  let count = 1;
  const identity = readDeathIdentity(game, target);
  let hasLord = readSlashAlive(game, target) && identity.generalLord;
  if (!hasLord) {
    for (const player of deathOrder(game).filter((p) => p !== target)) {
      if (seemingKingdom(game, player) !== kingdom) continue;
      const other = readDeathIdentity(game, player);
      if (other.generalLord) {
        hasLord = true;
        break;
      }
      if (hasShownGeneral(game, player) && other.role !== "careerist") count++;
    }
  }
  const lord = hasLord ? playerLord(game, target, true) : null;
  if (hasLord && lord === null)
    throw new Error("Missing revealed faction lord");
  if (
    (!hasLord && count > game.seatOrder.length / 2) ||
    (lord !== null && !readSlashAlive(game, lord))
  )
    role = "careerist";
  return role;
}
/** Internal lifecycle authority, not a client command or projection. */
export function applyShownGeneralIdentity(
  game: GeneralGame,
  target: string,
  head: boolean,
  first: boolean,
) {
  const identity = readDeathIdentity(game, target);
  if (
    head &&
    generalDefinition(game, game.displayedGenerals[target].head).kingdom ===
      "careerist"
  ) {
    game.identities[target].kingdom = "careerist";
    if (!identity.role.startsWith("careerist"))
      game.identities[target].role = "careerist";
  } else if (first) {
    let kingdom = identity.kingdom;
    if (!head && kingdom === "") {
      const deputy = generalDefinition(
        game,
        game.displayedGenerals[target].deputy,
      );
      kingdom = deputy.doubleKingdom
        ? generalDefinition(game, game.displayedGenerals[target].head).kingdom
        : deputy.kingdom;
    }
    game.identities[target].kingdom = kingdom;
    game.identities[target].role = firstRole(game, target, kingdom);
  }
  game.identities[target].lord = playerLord(game, target, false) === target;
  if (head && game.identities[target].lord) {
    const kingdom = game.identities[target].kingdom;
    for (const player of game.seatOrder) {
      const other = readDeathIdentity(game, player);
      if (other.kingdom === kingdom && other.role === "careerist")
        game.identities[player].role = mappedRole(kingdom);
    }
  }
}
export function applyHiddenGeneralIdentity(
  game: GeneralGame,
  target: string,
  head: boolean,
) {
  const identity = readDeathIdentity(game, target);
  if (!(head ? identity.deputyShown : identity.headShown)) {
    game.identities[target].kingdom = "god";
    game.identities[target].role = mappedRole("god");
  }
  game.identities[target].lord = playerLord(game, target, false) === target;
}
