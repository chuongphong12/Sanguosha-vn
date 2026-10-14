import type { DeathGame } from "./death";
import { dyingPlayer } from "./dying";
import { readSlashAlive, readSlashInteger } from "./slash";
import type {
  OperationHandler,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export interface FillHandRules {
  draw: (target: string, count: number, reason: string) => TriggerOperation;
}
function handCount(game: DeathGame, target: string) {
  if (
    !game.cardZones ||
    typeof game.cardZones !== "object" ||
    Array.isArray(game.cardZones)
  )
    throw new Error("Invalid hand zones");
  let count = 0;
  for (const zone of Object.values(game.cardZones)) {
    if (!zone || typeof zone !== "object") throw new Error("Invalid hand zone");
    if (zone.owner !== target || zone.place !== "hand") continue;
    if (
      !Array.isArray(zone.cards) ||
      zone.cards.some((id) => !Number.isSafeInteger(id) || id < 0)
    )
      throw new Error("Invalid hand cards");
    count = readSlashInteger(count + zone.cards.length);
  }
  return count;
}
function fillInput(game: DeathGame, data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid fill-hand input");
  const target = dyingPlayer(game, data.target),
    count = readSlashInteger(data.count),
    reason = data.reason === undefined ? "" : data.reason;
  if (typeof reason !== "string") throw new Error("Invalid fill-hand reason");
  const alive = readSlashAlive(game, target);
  const held = alive ? handCount(game, target) : 0;
  return {
    target,
    count,
    reason,
    shortfall: alive && count > held ? readSlashInteger(count - held) : 0,
  };
}
export function createFillHandCardsOperation<G extends DeathGame>(
  rules: FillHandRules,
): OperationHandler<G> {
  return {
    name: "fill-hand",
    validate: (game, operation) => {
      fillInput(game, operation.data);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const input = fillInput(game, operation.data);
      if (input.shortfall <= 0) return { kind: "return", value: null };
      return {
        kind: "operation",
        operation: rules.draw(input.target, input.shortfall, input.reason),
        continuation: true,
      };
    },
  };
}
