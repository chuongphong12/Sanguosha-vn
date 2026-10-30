import {
  readSlashAlive,
  readSlashCard,
  readSlashEffect,
  type SlashCard,
  type SlashEffect,
  type SlashGame,
} from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export type JinkRequest = {
  target: string;
  source: string;
  pattern: "jink";
  method: "use";
  prompt: string;
  data: SlashEffect;
};
export interface SlashProceedRules {
  /** askForCard adapter owns parsing, availability, materials and response-use lifecycle. */
  ask: (request: JinkRequest) => TriggerOperation;
}
type ProceedCursor = {
  stage: "ask" | "response" | "effective" | "finished";
  effect: SlashEffect;
  remaining: number;
  jink: SlashCard | null;
};
function proceedInput(game: SlashGame, data: TriggerData) {
  const effect = readSlashEffect(game, data);
  if (effect.from === null) throw new Error("SlashProceed requires a source");
  readSlashAlive(game, effect.to);
  return effect;
}
function runProceed<G extends SlashGame>(
  { game, operation, continuation, operationChild }: OperationContext<G>,
  rules: SlashProceedRules,
): OperationStep {
  const cursor: ProceedCursor =
    continuation === null
      ? {
          stage: "ask",
          effect: proceedInput(game, operation.data),
          remaining: 0,
          jink: null,
        }
      : (structuredClone(continuation) as ProceedCursor);
  if (continuation === null) {
    if (!readSlashAlive(game, cursor.effect.to))
      return { kind: "return", value: false };
    cursor.remaining = cursor.effect.jink_num;
  }
  if (cursor.stage === "finished") return { kind: "return", value: false };
  if (cursor.stage === "response") {
    if (!operationChild) throw new Error("Missing Jink response");
    cursor.jink =
      operationChild.value === null
        ? null
        : readSlashCard(game, operationChild.value, cursor.effect.to);
    cursor.stage = "effective";
    return {
      kind: "operation",
      operation: {
        name: "jink-effect",
        data: { user: cursor.effect.to, jink: cursor.jink },
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "effective") {
    if (typeof operationChild?.value !== "boolean")
      throw new Error("Invalid Jink effect result");
    if (!operationChild.value) {
      cursor.jink = null;
      cursor.remaining = 0;
    } else cursor.remaining--;
    cursor.stage = "ask";
  }
  if (cursor.remaining <= 0) {
    cursor.stage = "finished";
    return {
      kind: "operation",
      operation: {
        name: "slash-result",
        data: { effect: cursor.effect, jink: cursor.jink },
      },
      continuation: cursor,
    };
  }
  const prompt =
    cursor.effect.jink_num === 1
      ? `slash-jink:${cursor.effect.from}`
      : `@multi-jink${cursor.remaining === cursor.effect.jink_num ? "-start" : ""}:${cursor.effect.from}::${cursor.remaining}`;
  cursor.stage = "response";
  return {
    kind: "operation",
    operation: rules.ask(
      structuredClone({
        target: cursor.effect.to,
        source: cursor.effect.from!,
        pattern: "jink",
        method: "use",
        prompt,
        data: cursor.effect,
      }),
    ),
    continuation: cursor,
  };
}
export function createSlashProceedOperation<G extends SlashGame>(
  rules: SlashProceedRules,
): OperationHandler<G> {
  return {
    name: "slash-proceed",
    validate: (game, operation) => {
      proceedInput(game, operation.data);
    },
    run: (context) => runProceed(context, rules),
  };
}
export function createSlashEffectedOperation<
  G extends SlashGame,
>(): OperationHandler<G> {
  return {
    name: "slash-effected",
    validate: (game, operation) => {
      readSlashEffect(game, operation.data);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: false };
      const effect = readSlashEffect(game, operation.data);
      if (effect.nullified) return { kind: "return", value: true };
      if (effect.jink_num > 0)
        return {
          kind: "event",
          event: { name: "SlashProceed", target: effect.from, data: effect },
          continuation: true,
        };
      return {
        kind: "operation",
        operation: { name: "slash-result", data: { effect, jink: null } },
        continuation: true,
      };
    },
  };
}
function slashRule<G extends SlashGame>(
  event: "SlashEffected" | "SlashProceed",
  operation: "slash-effected" | "slash-proceed",
): TriggerSkill<G> {
  return {
    id: `game-rule-${operation}`,
    events: [event],
    priority: 0,
    rule: true,
    effect: ({ event, operationChild }) => {
      if (!operationChild)
        return {
          kind: "operation",
          operation: { name: operation, data: event.data },
          continuation: null,
        };
      if (typeof operationChild.value !== "boolean")
        throw new Error(`Invalid ${operation} result`);
      return { kind: "done", value: operationChild.value };
    },
  };
}
export function createSlashEffectedRule<
  G extends SlashGame,
>(): TriggerSkill<G> {
  return slashRule("SlashEffected", "slash-effected");
}
export function createSlashProceedRule<G extends SlashGame>(): TriggerSkill<G> {
  return slashRule("SlashProceed", "slash-proceed");
}
