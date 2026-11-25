import type { GeneralSlot, HegemonyPlayer, HegemonyState } from "./types";

function isReadyIdentitySlot(
  state: HegemonyState,
  playerID: string,
  slot: unknown,
): slot is GeneralSlot {
  return (
    state.status === "ready" &&
    state.seatOrder.includes(playerID) &&
    (slot === "head" || slot === "deputy")
  );
}

function hasShownGeneral(player: HegemonyPlayer): boolean {
  return player.head.shown || player.deputy.shown;
}

function seemingKingdom(player: HegemonyPlayer): string | null {
  if (!hasShownGeneral(player)) return null;
  return player.alliance?.kind === "careerist"
    ? (player.alliance.group ?? "careerist")
    : player.kingdom;
}

function exposedLord(state: HegemonyState, kingdom: string, except: string) {
  return state.seatOrder
    .map((id) => state.players[id])
    .find(
      (p) =>
        p.id !== except &&
        p.head.shown &&
        state.generals[p.head.id!].lord &&
        seemingKingdom(p) === kingdom,
    );
}

function factionSizeAfterReveal(
  state: HegemonyState,
  actor: string,
  kingdom: string,
): number {
  return (
    1 +
    state.seatOrder.filter((id) => {
      const other = state.players[id];
      return (
        id !== actor &&
        seemingKingdom(other) === kingdom &&
        !(other.alliance?.kind === "careerist" && other.alliance.group === null)
      );
    }).length
  );
}

/** Domain mutation only; the scheduler must dispatch GeneralShown afterward. */
export function revealHegemonyGeneral(
  state: HegemonyState,
  playerID: string,
  slot: unknown,
): boolean {
  if (!isReadyIdentitySlot(state, playerID, slot)) return false;
  const player = state.players[playerID];
  if (!player[slot].id || player[slot].shown) return false;
  const first = !hasShownGeneral(player);
  player[slot].shown = true;
  const head = state.generals[player.head.id!];
  if (slot === "head" && head.kingdoms[0] === "careerist") {
    player.kingdom = "careerist";
    if (player.alliance?.kind !== "careerist")
      player.alliance = { kind: "careerist", group: null };
  } else if (first) {
    player.kingdom = player.kingdom ?? player.initialKingdom;
    const kingdom = player.kingdom!;
    const ownLord = player.head.shown && head.lord;
    const lord = exposedLord(state, kingdom, playerID);
    const hasLord = (player.alive && ownLord) || !!lord;
    const factionSize = factionSizeAfterReveal(state, playerID, kingdom);
    // Include dead exposed lords and original room size, as native showGeneral does.
    const deadLord = head.lord ? !player.alive : lord && !lord.alive;
    player.alliance =
      (!hasLord && factionSize > state.seatOrder.length / 2) ||
      (hasLord && deadLord)
        ? { kind: "careerist", group: null }
        : { kind: "faction", kingdom };
  }
  if (slot === "head" && head.lord) {
    for (const other of Object.values(state.players)) {
      if (
        other.kingdom === player.kingdom &&
        other.alliance?.kind === "careerist" &&
        other.alliance.group === null
      )
        other.alliance = { kind: "faction", kingdom: player.kingdom! };
    }
  }
  return true;
}

/** Rule-driven concealment, not an unrestricted player command. */
export function concealHegemonyGeneral(
  state: HegemonyState,
  playerID: string,
  slot: unknown,
): boolean {
  if (!isReadyIdentitySlot(state, playerID, slot)) return false;
  const player = state.players[playerID];
  if (!player[slot].shown) return false;
  player[slot].shown = false;
  if (!hasShownGeneral(player)) {
    // hideGeneral resets native kingdom to god; original IDs stay private.
    player.kingdom = "god";
    player.alliance = { kind: "faction", kingdom: "god" };
  }
  return true;
}

export function areHegemonyFriends(
  state: HegemonyState,
  actor: string,
  target: string,
): boolean {
  if (!state.seatOrder.includes(actor) || !state.seatOrder.includes(target))
    return false;
  if (actor === target) return true;
  const a = state.players[actor];
  const b = state.players[target];
  if (!hasShownGeneral(a) || !hasShownGeneral(b)) return false;
  if (a.alliance?.kind === "careerist" || b.alliance?.kind === "careerist")
    return (
      a.alliance?.kind === "careerist" &&
      b.alliance?.kind === "careerist" &&
      a.alliance.group !== null &&
      a.alliance.group === b.alliance.group
    );
  return (
    a.alliance?.kind === "faction" &&
    b.alliance?.kind === "faction" &&
    a.kingdom === b.kingdom
  );
}

/** Authoritative native prediction; not a substitute for a bot's public knowledge. */
export function willBeHegemonyFriend(
  state: HegemonyState,
  actor: string,
  target: string,
): boolean {
  if (!state.seatOrder.includes(actor) || !state.seatOrder.includes(target))
    return false;
  if (areHegemonyFriends(state, actor, target)) return true;
  const player = state.players[actor];
  if (
    hasShownGeneral(player) ||
    !hasShownGeneral(state.players[target]) ||
    !player.head.id
  )
    return false;
  const head = state.generals[player.head.id];
  // Native predicts using the actual head's primary kingdom, not the chosen intersection.
  const kingdom = head.kingdoms[0];
  const hasLivingLord =
    (player.alive && head.lord) ||
    state.seatOrder.some((id) => {
      const other = state.players[id];
      return (
        id !== actor &&
        other.alive &&
        seemingKingdom(other) === kingdom &&
        !!other.head.id &&
        state.generals[other.head.id].lord
      );
    });
  if (
    !hasLivingLord &&
    factionSizeAfterReveal(state, actor, kingdom) > state.seatOrder.length / 2
  )
    return false;
  return kingdom === seemingKingdom(state.players[target]);
}
