import type { FreeChainGame } from "./general-rewards";
import { damageRule, ruleInput } from "./damage-rule";
import { generalMark } from "./general-rule";
import { readRecipientFlags } from "./card-effect";
import { readSlashInteger } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerSkill,
} from "./scheduler";

export interface DrawPhaseGame extends FreeChainGame {
  /** Private current phase authority; only the exact normalized draw phase is handled here. */
  playerPhases: Record<string, string>;
}
function phaseInput(game: DrawPhaseGame, data: TriggerData) {
  const input = ruleInput(game, data);
  if (input === null) return null;
  const phase = game.playerPhases?.[input.target];
  if (typeof phase !== "string")
    throw new Error("Invalid draw phase authority");
  if (phase !== "draw") return null;
  readRecipientFlags(game, input.target);
  const bonus = readSlashInteger(
    generalMark(game, input.target, "JieyueExtraDraw") * 3,
  );
  return { target: input.target, count: readSlashInteger(2 + bonus) };
}
export function createDrawPhaseOperation<
  G extends DrawPhaseGame,
>(): OperationHandler<G> {
  type Cursor = {
    stage: number;
    target: string;
    shared: TriggerData;
    count: number;
  };
  return {
    name: "draw-phase",
    validateSave: (game, frame, _interruption, prompt, state) => {
      const input = ruleInput(game, frame.operation.data),
        c = frame.continuation,
        child = state?.child;
      if (prompt || frame.answer !== null || frame.cleanup)
        throw new Error("Invalid saved Draw-phase boundary");
      if (c === null) {
        phaseInput(game, frame.operation.data);
        if (child || frame.child || frame.operationChild)
          throw new Error("Invalid initial Draw-phase child");
        return;
      }
      if (
        !input ||
        typeof c !== "object" ||
        Array.isArray(c) ||
        Object.keys(c).length !== 4 ||
        typeof c.stage !== "number" ||
        !Number.isInteger(c.stage) ||
        c.stage < 1 ||
        c.stage > 6 ||
        c.target !== input.target ||
        !("shared" in c)
      )
        throw new Error("Invalid saved Draw-phase cursor");
      if (c.stage <= 2) {
        if (c.count !== 0) throw new Error("Invalid uncaptured draw count");
        if (
          c.stage === 1 &&
          readSlashInteger(readSlashInteger(c.shared) - 2) % 3 !== 0
        )
          throw new Error("Invalid initial draw count");
      } else if (
        readSlashInteger(c.count) !== c.shared ||
        (c.stage === 3 && Number(c.count) <= 0)
      )
        throw new Error("Invalid captured draw count");
      if (c.stage === 1 || c.stage === 5) {
        const event =
          child?.kind === "event" ? child.event : frame.child?.event;
        if (
          frame.operationChild ||
          (child && child.kind !== "event") ||
          (!event && !state?.abandoning) ||
          (event &&
            (event.name !==
              (c.stage === 1 ? "DrawNCards" : "AfterDrawNCards") ||
              event.target !== c.target))
        )
          throw new Error("Invalid Draw-phase event child");
      } else {
        const next =
          child?.kind === "operation"
            ? child.operation
            : frame.operationChild?.operation;
        if (
          frame.child ||
          (child && child.kind !== "operation") ||
          (!next && !state?.abandoning)
        )
          throw new Error("Invalid Draw-phase operation child");
        if (next && c.stage !== 3) {
          if (next.name !== "free-chain" || next.data !== null)
            throw new Error("Invalid Draw-phase drain");
        } else if (next) {
          const d = next.data;
          if (
            next.name !== "draw-cards" ||
            !d ||
            typeof d !== "object" ||
            Array.isArray(d) ||
            Object.keys(d).length !== 3 ||
            JSON.stringify(d.players) !== JSON.stringify([c.target]) ||
            JSON.stringify(d.counts) !== JSON.stringify([c.count]) ||
            d.reason !== ""
          )
            throw new Error("Invalid Draw-phase transfer");
        }
      }
    },
    validateResult: (game, result) => {
      ruleInput(game, result.operation.data);
      if (result.value !== null)
        throw new Error("Invalid Draw-phase completion");
    },
    validate: (game, operation) => {
      phaseInput(game, operation.data);
    },
    run: ({ game, operation, continuation, child }): OperationStep => {
      let cursor: Cursor;
      if (continuation === null) {
        const input = phaseInput(game, operation.data);
        if (!input) return { kind: "return", value: null };
        game.playerFlags[input.target] = readRecipientFlags(
          game,
          input.target,
        ).filter((flag) => flag !== "Global_FirstRound");
        cursor = {
          stage: 0,
          target: input.target,
          shared: input.count,
          count: 0,
        };
      } else cursor = structuredClone(continuation) as Cursor;
      if (child && cursor.stage === 1)
        cursor.shared = structuredClone(child.event.data);
      while (true)
        switch (cursor.stage++) {
          case 0:
            return {
              kind: "event",
              event: {
                name: "DrawNCards",
                target: cursor.target,
                data: cursor.shared,
              },
              continuation: cursor,
            };
          case 1:
            return {
              kind: "operation",
              operation: { name: "free-chain", data: null },
              continuation: cursor,
            };
          case 2:
            cursor.count = readSlashInteger(cursor.shared);
            if (cursor.count > 0)
              return {
                kind: "operation",
                operation: {
                  name: "draw-cards",
                  data: {
                    players: [cursor.target],
                    counts: [cursor.count],
                    reason: "",
                  },
                },
                continuation: cursor,
              };
            break;
          case 3:
            return {
              kind: "operation",
              operation: { name: "free-chain", data: null },
              continuation: cursor,
            };
          case 4:
            return {
              kind: "event",
              event: {
                name: "AfterDrawNCards",
                target: cursor.target,
                data: cursor.count,
              },
              continuation: cursor,
            };
          case 5:
            return {
              kind: "operation",
              operation: { name: "free-chain", data: null },
              continuation: cursor,
            };
          case 6:
            return { kind: "return", value: null };
          default:
            throw new Error("Invalid Draw-phase continuation");
        }
    },
  };
}
export function createDrawPhaseRule<
  G extends DrawPhaseGame,
>(): TriggerSkill<G> {
  return damageRule("EventPhaseProceeding", "draw-phase");
}
