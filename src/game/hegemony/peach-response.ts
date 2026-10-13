import { readCardReference } from "./card-resources";
import type { CardUse } from "./card-on-use";
import { dyingPlayer, type DyingGame } from "./dying";
import { rescueBoolean, type PeachRequest } from "./dying-rule";
import { readSlashCard, readSlashInteger, type SlashCard } from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export interface SinglePeachRules<G extends DyingGame> {
  /** Owns human/AI parse, timeout and transport; null means native no-card branch. */
  request: (request: PeachRequest & { needed: number }) => TriggerOperation;
  isLimited: (game: Readonly<G>, saver: string, card: SlashCard) => boolean;
  validateResponse: (saver: string, card: SlashCard) => TriggerOperation;
  cardString: (game: Readonly<G>, card: SlashCard) => string;
  use: (use: CardUse, addHistory: false) => TriggerOperation;
  validateAfter: (saver: string, original: SlashCard) => TriggerOperation;
}
function requestInput(game: DyingGame, value: TriggerData): PeachRequest {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid single Peach request");
  const request = {
    saver: dyingPlayer(game, value.saver),
    who: dyingPlayer(game, value.who),
  };
  needed(game, request.who);
  return request;
}
function needed(game: DyingGame, who: string) {
  return readSlashInteger(1 - readSlashInteger(game.hp[who]));
}
type Cursor = {
  stage: "reply" | "validate" | "choice" | "used" | "after";
  request: PeachRequest;
  original: SlashCard | null;
  validated: SlashCard | null;
};
function runSingle<G extends DyingGame>(
  { game, operation, continuation, operationChild }: OperationContext<G>,
  rules: SinglePeachRules<G>,
): OperationStep {
  const cursor: Cursor =
    continuation === null
      ? {
          stage: "reply",
          request: requestInput(game, operation.data),
          original: null,
          validated: null,
        }
      : (structuredClone(continuation) as Cursor);
  if (continuation === null) {
    game.currentCardUseReason = "response-use";
    return {
      kind: "operation",
      operation: rules.request({
        ...cursor.request,
        needed: needed(game, cursor.request.who),
      }),
      continuation: cursor,
    };
  }
  if (cursor.stage === "reply") {
    if (operationChild!.value !== null) {
      cursor.original = readSlashCard(
        game,
        operationChild!.value,
        cursor.request.saver,
      );
      if (
        !rescueBoolean(
          rules.isLimited(
            structuredClone(game),
            cursor.request.saver,
            structuredClone(cursor.original),
          ),
        )
      ) {
        cursor.stage = "validate";
        return {
          kind: "operation",
          operation: rules.validateResponse(
            cursor.request.saver,
            structuredClone(cursor.original),
          ),
          continuation: cursor,
        };
      }
    }
    cursor.stage = "choice";
    return {
      kind: "event",
      event: {
        name: "ChoiceMade",
        target: cursor.request.saver,
        data: `peach:${cursor.request.who}:${needed(game, cursor.request.who)}:`,
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "validate") {
    if (operationChild!.value === null) {
      cursor.stage = "reply";
      cursor.original = null;
      game.currentCardUseReason = "response-use";
      return {
        kind: "operation",
        operation: rules.request({
          ...cursor.request,
          needed: needed(game, cursor.request.who),
        }),
        continuation: cursor,
      };
    }
    cursor.validated = readSlashCard(
      game,
      operationChild!.value,
      cursor.request.saver,
    );
    const encoded = rules.cardString(
      structuredClone(game),
      structuredClone(cursor.validated),
    );
    if (typeof encoded !== "string")
      throw new Error("Invalid Peach card string");
    cursor.stage = "choice";
    return {
      kind: "event",
      event: {
        name: "ChoiceMade",
        target: cursor.request.saver,
        data: `peach:${cursor.request.who}:${needed(game, cursor.request.who)}:${encoded}`,
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "choice") {
    if (cursor.validated === null) return { kind: "return", value: null };
    const { storage } = readCardReference(game, cursor.validated.reference);
    if (!storage.flags.includes("UsedBySecondWay"))
      storage.flags.push("UsedBySecondWay");
    cursor.validated.card.flags = [...storage.flags];
    cursor.stage = "used";
    return {
      kind: "operation",
      operation: rules.use(
        {
          from: cursor.request.saver,
          to: [cursor.request.who],
          card: structuredClone(cursor.validated.card),
        },
        false,
      ),
      continuation: cursor,
    };
  }
  if (cursor.stage === "used") {
    cursor.stage = "after";
    return {
      kind: "operation",
      operation: rules.validateAfter(
        cursor.request.saver,
        structuredClone(cursor.original!),
      ),
      continuation: cursor,
    };
  }
  return { kind: "return", value: cursor.validated };
}
export function createSinglePeachOperation<G extends DyingGame>(
  rules: SinglePeachRules<G>,
): OperationHandler<G> {
  return {
    name: "ask-single-peach",
    validate: (game, operation) => {
      requestInput(game, operation.data);
    },
    run: (context) => runSingle(context, rules),
  };
}
