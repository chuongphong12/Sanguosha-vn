import type { DamageGame } from "./damage";
import { readSlashInteger, readSlashAlive } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";
export type HpLossNotice =
  | { kind: "lose-hp"; target: string; amount: number }
  | { kind: "hp-property"; target: string; hp: number }
  | { kind: "change-hp"; target: string; delta: number; nature: -1 };
export function createHpLossOperation<G extends DamageGame>(rules: {
  notify: (notice: HpLossNotice) => TriggerOperation | null;
}): OperationHandler<G> {
  function input(game: G, data: TriggerData) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.target !== "string" ||
      !game.seatOrder.includes(data.target)
    )
      throw Error("Invalid HP loss");
    return { target: data.target, amount: readSlashInteger(data.amount, 1) };
  }
  type Cursor = {
    target: string;
    amount: number;
    shared: TriggerData;
    stage: number;
  };
  return {
    name: "lose-hp",
    validate: (game, op) => {
      input(game, op.data);
    },
    run: ({ game, operation, continuation, child }): OperationStep => {
      let c: Cursor;
      if (continuation === null) {
        const parsed = input(game, operation.data);
        if (parsed.amount <= 0) return { kind: "return", value: null };
        if (typeof game.removed[parsed.target] !== "boolean")
          throw Error("Invalid HP loss removed state");
        if (game.removed[parsed.target] || !readSlashAlive(game, parsed.target))
          return { kind: "return", value: null };
        c = { ...parsed, shared: parsed.amount, stage: 0 };
      } else c = structuredClone(continuation) as Cursor;
      if (c.stage === 1 && child) {
        if (child.consumed) return { kind: "return", value: null };
        c.shared = structuredClone(child.event.data);
        c.amount = readSlashInteger(c.shared);
        if (c.amount <= 0) return { kind: "return", value: null };
      }
      if (c.stage === 7 && child) c.shared = structuredClone(child.event.data);
      const event = (name: string, data: TriggerData): OperationStep => ({
        kind: "event",
        event: { name, target: c.target, data },
        continuation: c,
      });
      const notice = (value: HpLossNotice): OperationStep | null => {
        const op = rules.notify(value);
        return op
          ? { kind: "operation", operation: op, continuation: c }
          : null;
      };
      while (true)
        switch (c.stage++) {
          case 0:
            return event("PreHpLost", c.shared);
          case 1: {
            const n = notice({
              kind: "lose-hp",
              target: c.target,
              amount: c.amount,
            });
            if (n) return n;
            break;
          }
          case 2:
            game.hp[c.target] = readSlashInteger(
              readSlashInteger(game.hp[c.target]) - c.amount,
            );
            {
              const n = notice({
                kind: "hp-property",
                target: c.target,
                hp: game.hp[c.target],
              });
              if (n) return n;
              break;
            }
          case 3:
            return event("HpChanged", null);
          case 4: {
            const n = notice({
              kind: "change-hp",
              target: c.target,
              delta: -c.amount,
              nature: -1,
            });
            if (n) return n;
            break;
          }
          case 5:
            c.stage = 7;
            return event("PostHpReduced", c.shared);
          case 7:
            return event("HpLost", c.shared);
          case 8:
            return { kind: "return", value: null };
          default:
            throw Error("Invalid HP loss continuation");
        }
    },
  };
}
