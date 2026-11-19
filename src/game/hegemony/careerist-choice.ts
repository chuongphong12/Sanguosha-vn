import type { CareeristGame } from "./careerist";
import { dyingPlayer } from "./dying";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export type CareeristRequest = {
  target: string;
  leader: string;
  choices: ("no" | "yes")[];
  skill: "GameRule:CareeristAdd";
  prompt: string;
  allChoices: ["yes", "no"];
};
export interface CareeristChoiceRules {
  /** Human/AI request/timeout policy; raw nonstring replies use native fallback. */
  request: (request: CareeristRequest) => TriggerOperation;
}
function choiceInput(game: CareeristGame, data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid careerist choice input");
  const target = dyingPlayer(game, data.target),
    leader = dyingPlayer(game, data.leader);
  const choices = data.choices;
  if (
    !Array.isArray(choices) ||
    choices[0] !== "no" ||
    ![1, 2].includes(choices.length) ||
    (choices.length === 2 && choices[1] !== "yes")
  )
    throw new Error("Invalid careerist choices");
  return { target, leader, choices: [...choices] as ("no" | "yes")[] };
}
type Cursor = {
  target: string;
  choices: ("no" | "yes")[];
  stage: "reply" | "choice";
  answer: string;
};
function runChoice<G extends CareeristGame>(
  { game, operation, continuation, operationChild }: OperationContext<G>,
  rules: CareeristChoiceRules,
): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const input = choiceInput(game, operation.data);
    cursor = {
      target: input.target,
      choices: input.choices,
      stage: "reply",
      answer: "",
    };
    const request: CareeristRequest = {
      ...input,
      skill: "GameRule:CareeristAdd",
      prompt: `@careerist-add:${input.leader}`,
      allChoices: ["yes", "no"],
    };
    return {
      kind: "operation",
      operation: rules.request(structuredClone(request)),
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as Cursor;
  if (cursor.stage === "reply") {
    if (!operationChild) throw new Error("Missing careerist choice reply");
    const answer =
      typeof operationChild.value === "string" ? operationChild.value : ".";
    cursor.answer = cursor.choices.some(
      (choice) =>
        choice === answer || choice.split("%")[0] === answer.split("%")[0],
    )
      ? answer
      : "no";
    cursor.stage = "choice";
    return {
      kind: "event",
      event: {
        name: "ChoiceMade",
        target: cursor.target,
        data: `skillChoice:GameRule:CareeristAdd:${cursor.answer}`,
      },
      continuation: cursor,
    };
  }
  return { kind: "return", value: cursor.answer };
}
export function createCareeristChoiceOperation<G extends CareeristGame>(
  rules: CareeristChoiceRules,
): OperationHandler<G> {
  return {
    name: "careerist-choice",
    validate: (game, operation) => {
      choiceInput(game, operation.data);
    },
    run: (context) => runChoice(context, rules),
  };
}
