import { damageRoomTags } from "./damage";
import { damageRule, ruleInput } from "./damage-rule";
import type { GeneralGame } from "./general-identity";
import { readSlashInteger } from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export interface GeneralShownGame extends GeneralGame {
  rewardFirstShow: boolean;
  scenarioPresent: boolean;
}
export interface GeneralShownRules {
  winner: (target: string) => TriggerOperation;
  over: (winner: string) => TriggerOperation;
}
export function generalMark(game: GeneralGame, target: string, name: string) {
  const marks = game.playerMarks?.[target];
  if (!marks || typeof marks !== "object" || Array.isArray(marks))
    throw new Error("Invalid general marks");
  return readSlashInteger(marks[name], 0);
}
export function setGeneralMark(
  game: GeneralGame,
  target: string,
  name: string,
  value: number,
) {
  generalMark(game, target, name);
  game.playerMarks[target][name] = readSlashInteger(value);
}
export function addGeneralMark(
  game: GeneralGame,
  target: string,
  name: string,
  amount = 1,
) {
  setGeneralMark(
    game,
    target,
    name,
    readSlashInteger(generalMark(game, target, name) + amount),
  );
}
function queueShown(game: GeneralShownGame, target: string, data: TriggerData) {
  if (data !== null && typeof data !== "boolean")
    throw new Error("Invalid shown slot");
  addGeneralMark(
    game,
    target,
    data === true ? "Global_GeneralShown" : "Global_General2Shown",
  );
  if (typeof game.rewardFirstShow !== "boolean")
    throw new Error("Invalid first-show configuration");
  if (game.rewardFirstShow) {
    if (typeof game.scenarioPresent !== "boolean")
      throw new Error("Invalid scenario configuration");
    if (!game.scenarioPresent) {
      const tags = damageRoomTags(game);
      if (
        tags.TheFirstToShowRewarded === undefined ||
        tags.TheFirstToShowRewarded === null
      ) {
        tags.TheFirstToShowRewarded = true;
        addGeneralMark(game, target, "Global_TheFirstToShowRewarded");
      }
    }
  }
}
type Cursor = { target: string; data: TriggerData; stage: "winner" | "over" };
function runShown<G extends GeneralShownGame>(
  { game, operation, continuation, operationChild }: OperationContext<G>,
  rules: GeneralShownRules,
): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const input = ruleInput(game, operation.data);
    if (!input) return { kind: "return", value: false };
    const careerist = damageRoomTags(game).GlobalCareeristShow;
    if (
      careerist !== undefined &&
      careerist !== null &&
      typeof careerist !== "boolean"
    )
      throw new Error("Invalid GlobalCareeristShow");
    cursor = {
      target: input.target,
      data: input.data ?? null,
      stage: "winner",
    };
    if (careerist !== true)
      return {
        kind: "operation",
        operation: rules.winner(cursor.target),
        continuation: cursor,
      };
  } else {
    cursor = structuredClone(continuation) as Cursor;
    if (cursor.stage === "over") return { kind: "return", value: true };
    if (!operationChild) throw new Error("Missing reveal winner result");
    if (operationChild.value !== null) {
      if (typeof operationChild.value !== "string")
        throw new Error("Invalid reveal winner result");
      cursor.stage = "over";
      return {
        kind: "operation",
        operation: rules.over(operationChild.value),
        continuation: cursor,
      };
    }
  }
  queueShown(game, cursor.target, cursor.data);
  return { kind: "return", value: false };
}
export function createGeneralShownOperation<G extends GeneralShownGame>(
  rules: GeneralShownRules,
): OperationHandler<G> {
  return {
    name: "general-shown",
    validate: (game, operation) => {
      ruleInput(game, operation.data);
    },
    run: (context) => runShown(context, rules),
  };
}
export function createGeneralShownRule<
  G extends GeneralShownGame,
>(): TriggerSkill<G> {
  const rule = damageRule<G>("GeneralShown", "general-shown");
  return {
    ...rule,
    events: ["GeneralShown", "DFDebut"],
    effect: (context) => {
      if (context.operationChild) {
        if (typeof context.operationChild.value !== "boolean")
          throw new Error("Invalid reveal rule result");
        return { kind: "done", value: context.operationChild.value };
      }
      const step = rule.effect!(context);
      return context.event.name === "DFDebut" && step.kind === "operation"
        ? { kind: "done", value: false }
        : step;
    },
  };
}
