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
  /** Opt in to versioned snapshots; never call the live draw adapter on read. */
  validateDrawSave?: (
    input: Readonly<FillHandSnapshot>,
    operation: Readonly<TriggerOperation>,
  ) => void;
}
export type FillHandSnapshot = ReturnType<typeof fillInput>;
export function handCount(game: DeathGame, target: string) {
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
function fillRequest(game: DeathGame, data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid fill-hand input");
  const target = dyingPlayer(game, data.target),
    count = readSlashInteger(data.count),
    reason = data.reason === undefined ? "" : data.reason;
  if (typeof reason !== "string") throw new Error("Invalid fill-hand reason");
  return { target, count, reason };
}
function fillInput(game: DeathGame, data: TriggerData) {
  const input = fillRequest(game, data),
    { target, count } = input;
  const alive = readSlashAlive(game, target);
  const held = alive ? handCount(game, target) : 0;
  return {
    ...input,
    shortfall: alive && count > held ? readSlashInteger(count - held) : 0,
  };
}
export function createFillHandCardsOperation<G extends DeathGame>(
  rules: FillHandRules,
): OperationHandler<G> {
  const validateDrawSave = rules.validateDrawSave;
  return {
    name: "fill-hand",
    ...(validateDrawSave
      ? {
          validateSave: ((game, frame, _interruption, prompt, state) => {
            const input = fillRequest(game, frame.operation.data),
              c = frame.continuation,
              child = state?.child;
            if (prompt || frame.cleanup || frame.answer !== null || frame.child)
              throw new Error("Invalid saved fill-hand boundary");
            if (c === null) {
              fillInput(game, frame.operation.data);
              if (child || frame.operationChild)
                throw new Error("Invalid initial fill-hand child");
              return;
            }
            if (
              typeof c !== "object" ||
              Array.isArray(c) ||
              Object.keys(c).length !== 4 ||
              c.target !== input.target ||
              c.count !== input.count ||
              c.reason !== input.reason ||
              typeof c.shortfall !== "number" ||
              readSlashInteger(c.shortfall) <= 0 ||
              c.shortfall > input.count
            )
              throw new Error("Invalid saved fill-hand snapshot");
            const operation =
              child?.kind === "operation"
                ? child.operation
                : frame.operationChild?.operation;
            if (
              (child && child.kind !== "operation") ||
              (!operation && !state?.abandoning)
            )
              throw new Error("Invalid saved fill-hand child");
            if (operation)
              validateDrawSave({ ...input, shortfall: c.shortfall }, operation);
          }) satisfies NonNullable<OperationHandler<G>["validateSave"]>,
          validateResult: ((game, result) => {
            fillRequest(game, result.operation.data);
            if (result.value !== null)
              throw new Error("Invalid saved fill-hand completion");
          }) satisfies NonNullable<OperationHandler<G>["validateResult"]>,
        }
      : {}),
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
        continuation: validateDrawSave ? input : true,
      };
    },
  };
}
