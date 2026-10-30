import type { DamageGame } from "./damage";
import { readSlashInteger } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";
export const LIMIT_METHODS = [
  "use",
  "response",
  "discard",
  "recast",
  "pindian",
] as const;
export type LimitMethod = (typeof LIMIT_METHODS)[number];
export interface RoomLedgerGame extends DamageGame {
  playerIntMarks: Record<string, Record<string, number[]>>;
  playerStringMarks: Record<string, Record<string, string[]>>;
  cardLimitations: Record<string, Partial<Record<LimitMethod, string[]>>>;
}
export type PhaseStateNotice =
  | {
      kind: "mark";
      target: string;
      name: string;
      type: "number" | "int" | "string";
      value: number | number[] | string[];
    }
  | { kind: "history"; target: string | null; name: string; times: number }
  | { kind: "flags"; target: string; value: "." }
  | { kind: "removed"; target: string; value: false }
  | { kind: "limitations"; target: string; singleTurn: true }
  | { kind: "log"; target: string; name: "unset-drank" | "imperial-order" };
export interface PhaseStateRules {
  notify: (notice: PhaseStateNotice) => TriggerOperation | null;
}
export function ledgerPlayer(game: RoomLedgerGame, value: TriggerData): string {
  if (typeof value !== "string" || !game.seatOrder.includes(value))
    throw Error("Invalid ledger player");
  return value;
}
function limitations(game: RoomLedgerGame, target: string) {
  ledgerPlayer(game, target);
  const ledger = game.cardLimitations?.[target];
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger))
    throw Error("Invalid card limitation ledger");
  for (const method of LIMIT_METHODS) {
    const patterns = ledger[method];
    if (
      patterns !== undefined &&
      (!Array.isArray(patterns) || patterns.some((p) => typeof p !== "string"))
    )
      throw Error("Invalid card limitation patterns");
  }
  return ledger;
}
/** Stored-pattern restrictions only; package matching, removed/BattleRoyal policy stay explicit. */
export function hasRoomCardLimitation(
  game: RoomLedgerGame,
  target: string,
  method: LimitMethod | "none",
  isHandcard: boolean,
  matches: (pattern: string) => boolean,
): boolean {
  if (method === "none") return false;
  if (!LIMIT_METHODS.includes(method) || typeof isHandcard !== "boolean")
    throw Error("Invalid limitation method");
  return (limitations(game, target)[method] ?? []).some((pattern) => {
    pattern = pattern.split("$")[0];
    if (isHandcard) pattern = pattern.replace(/hand/g, ".");
    const result = matches(pattern);
    if (typeof result !== "boolean") throw Error("Invalid limitation matcher");
    return result;
  });
}
export function clearRoomCardLimitations(
  game: RoomLedgerGame,
  target: string,
  singleTurn: boolean,
): void {
  if (typeof singleTurn !== "boolean")
    throw Error("Invalid limitation duration");
  const ledger = limitations(game, target);
  for (const method of LIMIT_METHODS)
    ledger[method] = (ledger[method] ?? []).filter(
      (p) => singleTurn && !p.endsWith("$1"),
    );
}
function markLedger(game: RoomLedgerGame, target: string, type: number) {
  const ledger =
    type === 0
      ? game.playerMarks?.[target]
      : type === 1
        ? game.playerIntMarks?.[target]
        : game.playerStringMarks?.[target];
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger))
    throw Error("Invalid typed mark ledger");
  return ledger;
}
export function createMarkCleanupOperations<G extends RoomLedgerGame>(
  rules: PhaseStateRules,
): OperationHandler<G>[] {
  function input(game: G, data: TriggerData) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.suffix !== "string"
    )
      throw Error("Invalid mark cleanup");
    const target = ledgerPlayer(game, data.target);
    return { target, suffix: data.suffix };
  }
  return [false, true].map((numericOnly) => ({
    name: numericOnly ? "clear-numeric-marks" : "clear-player-marks",
    validate: (game, operation) => {
      const { target } = input(game, operation.data);
      for (let i = 0; i < (numericOnly ? 1 : 3); i++)
        markLedger(game, target, i);
    },
    run: ({ game, operation, continuation }): OperationStep => {
      type Cursor = {
        target: string;
        suffix: string;
        type: number;
        names: string[] | null;
        index: number;
      };
      const c: Cursor =
        continuation === null
          ? { ...input(game, operation.data), type: 0, names: null, index: 0 }
          : (structuredClone(continuation) as Cursor);
      while (c.type < (numericOnly ? 1 : 3)) {
        const ledger = markLedger(game, c.target, c.type);
        if (c.names === null) {
          c.names = Object.keys(ledger).sort();
          c.index = 0;
        }
        while (c.index < c.names.length) {
          const name = c.names[c.index++];
          if (!name.endsWith(c.suffix)) continue;
          let value: number | number[] | string[];
          if (c.type === 0) {
            if (readSlashInteger(ledger[name], 0) <= 0) continue;
            game.playerMarks[c.target][name] = value = 0;
          } else {
            const old = ledger[name] ?? [];
            if (
              !Array.isArray(old) ||
              old.some((v) =>
                c.type === 1 ? !Number.isInteger(v) : typeof v !== "string",
              )
            )
              throw Error("Invalid typed mark value");
            if (c.type === 1) old.forEach((v) => readSlashInteger(v));
            if (!old.length) continue;
            if (c.type === 1) game.playerIntMarks[c.target][name] = [];
            else game.playerStringMarks[c.target][name] = [];
            value = [];
          }
          const notice = rules.notify({
            kind: "mark",
            target: c.target,
            name,
            type: c.type === 0 ? "number" : c.type === 1 ? "int" : "string",
            value,
          });
          if (notice)
            return { kind: "operation", operation: notice, continuation: c };
        }
        c.type++;
        c.names = null;
      }
      return { kind: "return", value: null };
    },
  }));
}
