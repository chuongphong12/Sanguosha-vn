import type { PhaseBodyGame } from "./phase-bodies";
import type { TokenChoice } from "./reward-tokens";
import { ruleInput } from "./damage-rule";
import { handCount } from "./fill-hand";
import { addGeneralMark, generalMark } from "./general-rule";
import { readSlashInteger } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerOperation,
} from "./scheduler";
export type DiscardPhaseGame = PhaseBodyGame;
export type DiscardPhaseNotice =
  | {
      kind: "invoke-log" | "invoke-audio" | "invoke-skill";
      target: string;
      skill: "halfmaxhp" | "careerman";
    }
  | { kind: "mark"; target: string; name: string; value: number };
export interface DiscardPhaseRules<G extends DiscardPhaseGame> {
  maxCards: (game: Readonly<G>, target: string) => number;
  /** Normalized askForChoice child owns ChoiceMade and transport fallback. */
  choice: (request: TokenChoice) => TriggerOperation;
  notify: (notice: DiscardPhaseNotice) => TriggerOperation | null;
}
export function createDiscardPhaseOperation<G extends DiscardPhaseGame>(
  rules: DiscardPhaseRules<G>,
): OperationHandler<G> {
  function excess(game: G, target: string) {
    const maximum = readSlashInteger(
      rules.maxCards(structuredClone(game), target),
    );
    if (maximum < 0) throw Error("Invalid maximum hand size");
    return readSlashInteger(handCount(game, target) - maximum);
  }
  return {
    name: "discard-phase",
    validate: (game, operation) => {
      ruleInput(game, operation.data);
    },
    run: ({ game, operation, continuation, operationChild }): OperationStep => {
      type Cursor = {
        target: string;
        index: number;
        stage: number;
        changed: boolean;
      };
      let c: Cursor;
      if (continuation === null) {
        const input = ruleInput(game, operation.data);
        if (!input) return { kind: "return", value: null };
        c = { target: input.target, index: 0, stage: 0, changed: false };
      } else c = structuredClone(continuation) as Cursor;
      while (c.index < 2) {
        const skill = c.index === 0 ? "halfmaxhp" : "careerman";
        const mark = c.index === 0 ? "@halfmaxhp" : "@careerist";
        switch (c.stage++) {
          case 0:
            if (
              excess(game, c.target) <= 0 ||
              generalMark(game, c.target, mark) <= 0
            ) {
              c.index++;
              c.stage = 0;
              break;
            }
            return {
              kind: "operation",
              operation: rules.choice({
                player: c.target,
                skill,
                target: null,
                choices: ["yes", "no"],
                allChoices: ["yes", "no"],
                prompt: `@${skill}-use`,
              }),
              continuation: c,
            };
          case 1:
            if (
              operationChild?.value !== "yes" &&
              operationChild?.value !== "no"
            )
              throw Error("Invalid discard token choice");
            if (operationChild.value === "no") {
              c.index++;
              c.stage = 0;
            }
            break;
          case 2:
          case 3:
          case 4: {
            const kind =
              c.stage === 3
                ? "invoke-log"
                : c.stage === 4
                  ? "invoke-audio"
                  : "invoke-skill";
            const next = rules.notify({ kind, target: c.target, skill });
            if (next)
              return { kind: "operation", operation: next, continuation: c };
            break;
          }
          case 5:
            c.changed = generalMark(game, c.target, mark) !== 0;
            return {
              kind: "operation",
              operation: {
                name: "reward-token-cost",
                data: { player: c.target, token: skill },
              },
              continuation: c,
            };
          case 6: {
            if (!c.changed) break;
            const next = rules.notify({
              kind: "mark",
              target: c.target,
              name: mark,
              value: generalMark(game, c.target, mark),
            });
            if (next)
              return { kind: "operation", operation: next, continuation: c };
            break;
          }
          case 7: {
            addGeneralMark(game, c.target, "Global_MaxcardsIncrease", 2);
            const next = rules.notify({
              kind: "mark",
              target: c.target,
              name: "Global_MaxcardsIncrease",
              value: generalMark(game, c.target, "Global_MaxcardsIncrease"),
            });
            if (next)
              return { kind: "operation", operation: next, continuation: c };
            break;
          }
          case 8:
            c.index++;
            c.stage = 0;
            break;
          default:
            throw Error("Invalid discard phase continuation");
        }
      }
      if (c.stage === 10) return { kind: "return", value: null };
      const count = excess(game, c.target);
      if (count <= 0) return { kind: "return", value: null };
      c.stage = 10;
      return {
        kind: "operation",
        operation: { name: "rule-discard", data: { target: c.target, count } },
        continuation: c,
      };
    },
  };
}
