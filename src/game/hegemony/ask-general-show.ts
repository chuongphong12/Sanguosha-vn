import { readDeathIdentity } from "./death";
import { allPlayers } from "./damage-rule";
import type { GeneralGame } from "./general-identity";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export type GeneralRevealNotice = {
  kind: "reveal";
  target: string;
  head: string;
  deputy: string;
};
export interface GeneralShowSaveRules {
  /** Pure contracts for the profile's mapped child operations; never invoke live adapters. */
  validateLord: (target: string, operation: Readonly<TriggerOperation>) => void;
  validateNotice: (
    notice: Readonly<GeneralRevealNotice>,
    operation: Readonly<TriggerOperation>,
  ) => void;
}
export interface GeneralShowRules<G extends GeneralGame> {
  /** Opt-in saved question contract; the profile must version its policy semantics. */
  save?: GeneralShowSaveRules;
  enableLordConversion: boolean;
  canShow: (game: G, target: string, head: boolean) => boolean;
  lordAvailable: (game: Readonly<G>, target: string, name: string) => boolean;
  changeToLord: (target: string) => TriggerOperation;
  notify: (notice: GeneralRevealNotice) => TriggerOperation | null;
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
  const {
    enableLordConversion,
    canShow,
    lordAvailable,
    changeToLord,
    notify,
    save,
  } = rules;
  if (
    typeof enableLordConversion !== "boolean" ||
    [canShow, lordAvailable, changeToLord, notify].some(
      (fn) => typeof fn !== "function",
    ) ||
    (save !== undefined &&
      (!save ||
        typeof save !== "object" ||
        Array.isArray(save) ||
        typeof save.validateLord !== "function" ||
        typeof save.validateNotice !== "function"))
  )
    throw Error("Invalid general-show rules");
  const recovery =
    save === undefined
      ? null
      : {
          validateLord: save.validateLord,
          validateNotice: save.validateNotice,
        };
  type Cursor = {
    target: string;
    reason: string;
    change: boolean;
    stage: number;
    choices: string[];
    choice: string | null;
    changeLord: boolean;
    lordChoice: string | null;
    notice?: GeneralRevealNotice;
  };
  const saveHooks: Pick<
    OperationHandler<G>,
    "validateSave" | "validateResult"
  > = recovery
    ? {
        validateSave: (game, frame, _interruption, prompt, state) => {
          const request = input(game, frame.operation.data),
            c = frame.continuation;
          if (frame.cleanup) throw Error("Invalid general-show cleanup");
          if (c === null) {
            if (
              prompt ||
              frame.answer ||
              frame.child ||
              frame.operationChild ||
              state?.child
            )
              throw Error("Invalid initial general-show work");
            return;
          }
          if (
            !c ||
            typeof c !== "object" ||
            Array.isArray(c) ||
            c.target !== request.target ||
            c.reason !== request.reason ||
            c.change !== request.change ||
            typeof c.stage !== "number" ||
            ![1, 2, 3, 4, 5, 7, 8, 9].includes(c.stage) ||
            Object.keys(c).length !== (c.stage === 5 ? 9 : 8) ||
            !Array.isArray(c.choices) ||
            ![
              ["cancel"],
              ["show_head_general", "cancel"],
              ["show_deputy_general", "cancel"],
              ["show_head_general", "show_both_generals", "cancel"],
              ["show_deputy_general", "show_both_generals", "cancel"],
              [
                "show_head_general",
                "show_deputy_general",
                "show_both_generals",
                "cancel",
              ],
            ].some(
              (choices) =>
                JSON.stringify(choices) === JSON.stringify(c.choices),
            ) ||
            (c.choice !== null &&
              (typeof c.choice !== "string" ||
                !c.choices.includes(c.choice))) ||
            typeof c.changeLord !== "boolean" ||
            (c.changeLord && (!request.change || !enableLordConversion)) ||
            (c.changeLord &&
              c.choices.includes("show_both_generals") &&
              !c.choices.includes("show_head_general")) ||
            (c.lordChoice !== null &&
              c.lordChoice !== "yes" &&
              c.lordChoice !== "no")
          )
            throw Error("Invalid general-show cursor");
          const head =
            c.choice === "show_head_general" ||
            c.choice === "show_both_generals";
          const deputy =
            c.choice === "show_deputy_general" ||
            c.choice === "show_both_generals";
          if (
            (c.lordChoice !== null && (!c.changeLord || !head)) ||
            (c.stage === 1
              ? c.choice !== null || c.lordChoice !== null
              : c.choice === null) ||
            (c.stage === 2 && c.lordChoice !== null) ||
            (![1, 2].includes(c.stage) && c.choice === "cancel") ||
            ([7, 8, 9].includes(c.stage) && (!head || !c.changeLord)) ||
            (c.stage === 7 && c.lordChoice !== null) ||
            (c.stage === 8 && c.lordChoice === null) ||
            (c.stage === 9 && c.lordChoice !== "yes") ||
            (c.stage === 3 &&
              (!head || (c.changeLord && c.lordChoice === null))) ||
            (c.stage === 4 && !deputy)
          )
            throw Error("Invalid general-show decision");
          let notice: GeneralRevealNotice | null = null;
          if (c.stage === 5) {
            const n = c.notice;
            if (
              !n ||
              typeof n !== "object" ||
              Array.isArray(n) ||
              Object.keys(n).length !== 4 ||
              n.kind !== "reveal" ||
              n.target !== request.target ||
              typeof n.head !== "string" ||
              typeof n.deputy !== "string"
            )
              throw Error("Invalid captured reveal notice");
            notice = {
              kind: "reveal",
              target: request.target,
              head: n.head,
              deputy: n.deputy,
            };
          }
          if (c.stage === 1 || c.stage === 7) {
            const choices = c.stage === 1 ? c.choices : ["yes", "no"];
            if (
              frame.child ||
              frame.operationChild ||
              state?.child ||
              (prompt &&
                (prompt.actor !== request.target ||
                  prompt.canCancel ||
                  JSON.stringify(prompt.choices.map((choice) => choice.id)) !==
                    JSON.stringify(choices))) ||
              (frame.answer && !choices.includes(frame.answer.choice)) ||
              (!prompt && !frame.answer && !state?.abandoning)
            )
              throw Error("Invalid general-show prompt");
            return;
          }
          if (prompt || frame.answer)
            throw Error("Unexpected general-show answer");
          const queued = state?.child;
          if (c.stage === 2 || c.stage === 8) {
            if (frame.operationChild || (queued && queued.kind !== "event"))
              throw Error("Invalid general-show event child");
            const event =
              queued?.kind === "event" ? queued.event : frame.child?.event;
            if (!event) {
              if (!state?.abandoning) throw Error("Missing ChoiceMade child");
            } else if (
              event.name !== "ChoiceMade" ||
              event.target !== request.target
            )
              throw Error("Invalid ChoiceMade child");
            return;
          }
          if (frame.child || (queued && queued.kind !== "operation"))
            throw Error("Invalid general-show operation child");
          const pending =
            queued?.kind === "operation"
              ? queued.operation
              : frame.operationChild?.operation;
          if (!pending) {
            if (!state?.abandoning)
              throw Error("Missing general-show operation");
            return;
          }
          if (c.stage === 9)
            recovery.validateLord(request.target, structuredClone(pending));
          else if (c.stage === 5 && notice)
            recovery.validateNotice(
              structuredClone(notice),
              structuredClone(pending),
            );
          else {
            const d = pending.data;
            if (
              pending.name !== "show-general" ||
              !d ||
              typeof d !== "object" ||
              Array.isArray(d) ||
              Object.keys(d).length !== 5 ||
              d.target !== request.target ||
              d.head !== (c.stage === 3) ||
              d.triggerEvent !== true ||
              d.sendLog !== false ||
              d.ignoreRule !== true
            )
              throw Error("Invalid show-general child");
          }
        },
        validateResult: (game, result) => {
          input(game, result.operation.data);
          if (typeof result.value !== "boolean")
            throw Error("Invalid general-show result");
        },
      }
    : {};
  return {
    name: "ask-general-show",
    ...saveHooks,
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
            const notice: GeneralRevealNotice = {
              kind: "reveal",
              target: c.target,
              head: names.head,
              deputy: names.deputy,
            };
            const captured = recovery ? structuredClone(notice) : null;
            const operation = notify(notice);
            if (operation) {
              if (captured) c.notice = captured;
              return { kind: "operation", operation, continuation: c };
            }
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
