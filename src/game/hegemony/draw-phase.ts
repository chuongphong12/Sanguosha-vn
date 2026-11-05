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
