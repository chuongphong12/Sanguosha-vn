const MIN_PLAYERS = 4;
const MAX_PLAYERS = 10;

/** The rules only support 4-10 seats; anything else must not reach the engine. */
export function parseLocalPlayerCount(
  raw: string | number | null | undefined,
): number {
  const parsed = typeof raw === "number" ? raw : parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) return MIN_PLAYERS;
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, parsed));
}
