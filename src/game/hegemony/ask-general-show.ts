import { readDeathIdentity } from "./death";
import { allPlayers } from "./damage-rule";
import type { GeneralGame } from "./general-identity";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export interface GeneralShowRules<G extends GeneralGame> {
  enableLordConversion: boolean;
  canShow: (game: G, target: string, head: boolean) => boolean;
  lordAvailable: (game: Readonly<G>, target: string, name: string) => boolean;
  changeToLord: (target: string) => TriggerOperation;
  notify: (notice: {
    kind: "reveal";
    target: string;
    head: string;
    deputy: string;
  }) => TriggerOperation | null;
}
function input(game: GeneralGame, data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.target !== "string" ||
    !game.seatOrder.includes(data.target) ||
    typeof data.reason !== "string" ||
    typeof data.change !== "boolean"
  )
    throw Error("Invalid general-show request");
  return { target: data.target, reason: data.reason, change: data.change };
}
function shown(game: GeneralGame, target: string) {
  const identity = readDeathIdentity(game, target),
    names = game.displayedGenerals?.[target];
  if (
    !names ||
    typeof names.head !== "string" ||
    typeof names.deputy !== "string"
  )
    throw Error("Invalid displayed general names");
  return {
    head: identity.headShown,
    deputy: identity.deputyShown,
    all: identity.headShown && (names.deputy === "" || identity.deputyShown),
  };
}
/** RoundStart policy: head/deputy/both allowed and cancellation offered. */
export function createAskGeneralShowOperation<G extends GeneralGame>(
  rules: GeneralShowRules<G>,
): OperationHandler<G> {
  const { enableLordConversion, canShow, lordAvailable, changeToLord, notify } =
    rules;
  if (
    typeof enableLordConversion !== "boolean" ||
    [canShow, lordAvailable, changeToLord, notify].some(
      (fn) => typeof fn !== "function",
    )
  )
    throw Error("Invalid general-show rules");
  type Cursor = {
    target: string;
    reason: string;
    change: boolean;
    stage: number;
    choices: string[];
    choice: string | null;
    changeLord: boolean;
    lordChoice: string | null;
  };
  return {
    name: "ask-general-show",
    validate: (game, op) => {
      input(game, op.data);
    },
    run: ({ game, operation, continuation, answer }): OperationStep => {
      let c: Cursor;
      if (continuation === null) {
        const request = input(game, operation.data),
          state = shown(game, request.target);
        if (state.all) return { kind: "return", value: false };
        const head = canShow(structuredClone(game), request.target, true),
          deputy = canShow(structuredClone(game), request.target, false);
        if (typeof head !== "boolean" || typeof deputy !== "boolean")
          throw Error("Invalid show eligibility");
        const choices: string[] = [];
        if (head && !state.head) choices.push("show_head_general");
        if (deputy && !state.deputy) choices.push("show_deputy_general");
        if (head && deputy) choices.push("show_both_generals");
        choices.push("cancel");
        let changeLord = false;
        if (request.change && enableLordConversion && !state.head) {
          const actual = game.generalNames?.[request.target]?.[0];
          if (typeof actual !== "string" || !actual)
            throw Error("Invalid actual head general");
          const duplicate = allPlayers(game).some((p) => {
            if (p === request.target) return false;
            const other = game.generalNames?.[p]?.[0];
            if (typeof other !== "string" || !other)
              throw Error("Invalid actual head general");
            return other === actual;
          });
          if (!duplicate) {
            const available = lordAvailable(
              structuredClone(game),
              request.target,
              "lord_" + actual,
            );
            if (typeof available !== "boolean")
              throw Error("Invalid lord availability");
            changeLord = available;
          }
        }
        c = {
          ...request,
          stage: 0,
          choices,
          choice: null,
          changeLord,
          lordChoice: null,
        };
      } else c = structuredClone(continuation) as Cursor;
      while (true)
        switch (c.stage++) {
          case 0:
            return {
              kind: "prompt",
              actor: c.target,
              choices: c.choices,
              canCancel: false,
              continuation: c,
            };
          case 1:
            if (!answer || !c.choices.includes(answer.choice ?? ""))
              throw Error("Invalid general-show answer");
            c.choice = answer.choice;
            return {
              kind: "event",
              event: {
                name: "ChoiceMade",
                target: c.target,
                data: `skillChoice:${c.reason}:${c.choice}`,
              },
              continuation: c,
            };
          case 2:
            if (c.choice === "cancel") return { kind: "return", value: false };
            if (
              (c.choice === "show_head_general" ||
                c.choice === "show_both_generals") &&
              !shown(game, c.target).head
            ) {
              c.stage = c.changeLord ? 6 : 9;
            }
            break;
          case 3:
            if (
              (c.choice === "show_deputy_general" ||
                c.choice === "show_both_generals") &&
              !shown(game, c.target).deputy
            )
              return {
                kind: "operation",
                operation: {
                  name: "show-general",
                  data: {
                    target: c.target,
                    head: false,
                    triggerEvent: true,
                    sendLog: false,
                    ignoreRule: true,
                  },
                },
                continuation: c,
              };
            break;
          case 4: {
            const names = game.displayedGenerals[c.target];
            const operation = notify({
              kind: "reveal",
              target: c.target,
              head: names.head,
              deputy: names.deputy,
            });
            if (operation)
              return { kind: "operation", operation, continuation: c };
            break;
          }
          case 5:
            return { kind: "return", value: true };
          case 6:
            return {
              kind: "prompt",
              actor: c.target,
              choices: ["yes", "no"],
              canCancel: false,
              continuation: c,
            };
          case 7:
            if (!answer || !["yes", "no"].includes(answer.choice ?? ""))
              throw Error("Invalid lord-conversion answer");
            c.lordChoice = answer.choice;
            return {
              kind: "event",
              event: {
                name: "ChoiceMade",
                target: c.target,
                data: `skillChoice:changetolord:${c.lordChoice}`,
              },
              continuation: c,
            };
          case 8:
            if (c.lordChoice === "yes")
              return {
                kind: "operation",
                operation: changeToLord(c.target),
                continuation: c,
              };
            break;
          case 9:
            c.stage = 3;
            return {
              kind: "operation",
              operation: {
                name: "show-general",
                data: {
                  target: c.target,
                  head: true,
                  triggerEvent: true,
                  sendLog: false,
                  ignoreRule: true,
                },
              },
              continuation: c,
            };
          default:
            throw Error("Invalid general-show continuation");
        }
    },
  };
}
