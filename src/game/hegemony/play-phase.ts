import type { CardCommandGame } from "./card-command";
import type { PhaseBodyGame } from "./phase-bodies";
import type { PhaseStateNotice } from "./phase-state";
import { ruleInput } from "./damage-rule";
import { readSlashAlive } from "./slash";
import { readRecipientFlags } from "./card-effect";
import { readPhase } from "./phases";
import type {
  OperationHandler,
  OperationStep,
  TriggerOperation,
} from "./scheduler";

export type PlayPhaseGame = PhaseBodyGame & CardCommandGame;
export interface PlayPhaseRules<G extends PlayPhaseGame> {
  context: (game: Readonly<G>, target: string) => string;
  pendingSurrender: (
    game: Readonly<G>,
    target: string,
  ) => TriggerOperation | null;
  notify: (
    notice: Extract<PhaseStateNotice, { kind: "history" }>,
  ) => TriggerOperation | null;
}
export function createPlayPhaseOperation<G extends PlayPhaseGame>(
  rules: PlayPhaseRules<G>,
): OperationHandler<G> {
  const { context, pendingSurrender, notify } = rules;
  if (
    [context, pendingSurrender, notify].some((fn) => typeof fn !== "function")
  )
    throw Error("Invalid Play phase rules");
  return {
    name: "play-phase",
    validate: (game, op) => {
      ruleInput(game, op.data);
    },
    run: ({ game, operation, continuation, operationChild }): OperationStep => {
      type Cursor = { target: string; stage: number };
      let c: Cursor;
      if (continuation === null) {
        const input = ruleInput(game, operation.data);
        if (!input) return { kind: "return", value: null };
        c = { target: input.target, stage: 0 };
      } else c = structuredClone(continuation) as Cursor;
      while (true)
        switch (c.stage++) {
          case 0: {
            if (!readSlashAlive(game, c.target))
              return { kind: "return", value: null };
            const surrender = pendingSurrender(structuredClone(game), c.target);
            if (surrender)
              return {
                kind: "operation",
                operation: surrender,
                continuation: c,
              };
            break;
          }
          case 1: {
            const flags = readRecipientFlags(game, c.target);
            if (flags.includes("Global_PlayPhaseTerminated")) {
              game.playerFlags[c.target] = flags.filter(
                (f) => f !== "Global_PlayPhaseTerminated",
              );
              return { kind: "return", value: null };
            }
            if (readPhase(game.playerPhases[c.target]) !== "play")
              return { kind: "return", value: null };
            const notice = notify({
              kind: "history",
              target: null,
              name: "pushPile",
              times: 1,
            });
            if (notice)
              return { kind: "operation", operation: notice, continuation: c };
            break;
          }
          case 2: {
            const epoch = context(structuredClone(game), c.target);
            if (typeof epoch !== "string")
              throw Error("Invalid Play request context");
            return {
              kind: "operation",
              operation: {
                name: "card-use-request",
                data: {
                  actor: c.target,
                  reason: "play",
                  context: epoch,
                  pattern: "",
                  prompt: c.target,
                  method: "use",
                  addHistory: true,
                  canCancel: true,
                  returnOnRoomFailure: true,
                },
              },
              continuation: c,
            };
          }
          case 3: {
            const result = operationChild?.value;
            if (!result || typeof result !== "object" || Array.isArray(result))
              throw Error("Invalid Play request result");
            if (
              ["cancelled", "invalidated", "unavailable"].includes(
                String(result.status),
              )
            )
              return { kind: "return", value: null };
            if (result.status !== "used" && result.status !== "rejected")
              throw Error("Invalid Play request status");
            return {
              kind: "operation",
              operation: { name: "free-chain", data: null },
              continuation: c,
            };
          }
          case 4:
            c.stage = 0;
            break;
          default:
            throw Error("Invalid Play phase continuation");
        }
    },
  };
}
