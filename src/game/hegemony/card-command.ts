import type { RoomCardUse, RoomUseGame } from "./room-use-card";
import { readExecutionCardUse } from "./card-on-use";
import { readCardReference } from "./card-resources";
import {
  resumeTriggerPrompt,
  type OperationHandler,
  type OperationStep,
  type TriggerRegistry,
  type TriggerScheduler,
} from "./scheduler";

export type CardUseRequest = {
  actor: string;
  reason: "play" | "response-use";
  context: string;
  pattern: string;
  prompt: string;
  method: string;
  addHistory: boolean;
  canCancel: boolean;
};
export type CardCommandOffer = {
  id: string;
  version: string;
  label: string;
  entry: RoomCardUse;
  targetFixed: boolean;
  multipleVotes: boolean;
};
export interface CardCommandGame extends RoomUseGame {
  currentPlayer: string;
  currentCardUseReason?: "play" | "response" | "response-use";
  currentCardUsePattern?: string;
}
export interface CardCommandRules<G extends CardCommandGame> {
  inPlay: (game: Readonly<G>, actor: string) => boolean;
  contextValid: (game: Readonly<G>, request: CardUseRequest) => boolean;
  offers: (game: Readonly<G>, request: CardUseRequest) => CardCommandOffer[];
  enabled: (
    game: Readonly<G>,
    request: CardUseRequest,
    offer: CardCommandOffer,
  ) => boolean;
  skillAllowed: (
    game: Readonly<G>,
    request: CardUseRequest,
    offer: CardCommandOffer,
  ) => boolean;
  matchesPattern: (
    game: Readonly<G>,
    request: CardUseRequest,
    offer: CardCommandOffer,
  ) => boolean;
  materialAllowed: (
    game: Readonly<G>,
    request: CardUseRequest,
    offer: CardCommandOffer,
    id: number,
    zone: string,
  ) => boolean;
  targetFilter: (
    game: Readonly<G>,
    request: CardUseRequest,
    use: RoomCardUse,
    candidate: string,
  ) => boolean;
  prohibited: (
    game: Readonly<G>,
    request: CardUseRequest,
    use: RoomCardUse,
    candidate: string,
  ) => boolean;
  feasible: (
    game: Readonly<G>,
    request: CardUseRequest,
    use: RoomCardUse,
  ) => boolean;
}
type ChoiceAction = { label: string } & (
  | { action: "card"; offer: CardCommandOffer }
  | { action: "confirm" | "back" | "decline" }
  | { action: "target"; target: string }
);
type Choice = ChoiceAction & { id: string };
type Cursor = {
  request: CardUseRequest;
  stage: "activate" | "choose" | "execute" | "used" | "cancelled";
  selected: CardCommandOffer | null;
  targets: string[];
  generation: number;
  choices: Choice[];
};
function readRequest(game: CardCommandGame, value: unknown): CardUseRequest {
  const data = value as Partial<CardUseRequest> | null;
  if (
    !data ||
    !game.seatOrder.includes(data.actor ?? "") ||
    !["play", "response-use"].includes(data.reason ?? "") ||
    ![data.context, data.pattern, data.prompt, data.method].every(
      (part) => typeof part === "string",
    ) ||
    typeof data.addHistory !== "boolean" ||
    typeof data.canCancel !== "boolean" ||
    data.method === "response"
  )
    throw new Error("Invalid card-use request");
  return structuredClone(data) as CardUseRequest;
}
function selectedUse(cursor: Cursor): RoomCardUse {
  const entry = structuredClone(cursor.selected!.entry);
  entry.use.to = [...cursor.targets];
  return entry;
}
function privatePrompt(scheduler: TriggerScheduler) {
  const prompt = scheduler.prompt;
  const frame = scheduler.frames.at(-1);
  if (
    scheduler.interruption ||
    !prompt ||
    prompt.kind !== "step" ||
    !frame ||
    frame.id !== prompt.frameId ||
    frame.kind !== "operation" ||
    frame.operation.name !== "card-use-request" ||
    !frame.continuation
  )
    return null;
  return { prompt, cursor: frame.continuation as Cursor };
}
export function createCardCommandAdmission<G extends CardCommandGame, Auth>(
  rules: CardCommandRules<G>,
  authenticate: (context: Auth) => string | null,
) {
  function contextValid(game: G, request: CardUseRequest): boolean {
    return Boolean(
      game.alive[request.actor] &&
      (request.reason !== "play" ||
        (game.currentPlayer === request.actor &&
          rules.inPlay(structuredClone(game), request.actor))) &&
      rules.contextValid(structuredClone(game), structuredClone(request)),
    );
  }
  function eligible(
    game: G,
    request: CardUseRequest,
    offer: CardCommandOffer,
  ): boolean {
    if (
      !offer.id ||
      !offer.version ||
      typeof offer.label !== "string" ||
      typeof offer.targetFixed !== "boolean" ||
      offer.multipleVotes !== false ||
      offer.entry.use.from !== request.actor ||
      offer.entry.use.to.length !== 0
    )
      return false;
    readExecutionCardUse(game, offer.entry.use);
    readCardReference(game, offer.entry.reference);
    const check = (predicate: CardCommandRules<G>["enabled"]) =>
      predicate(
        structuredClone(game),
        structuredClone(request),
        structuredClone(offer),
      );
    if (
      !check(rules.enabled) ||
      !check(rules.skillAllowed) ||
      !check(rules.matchesPattern)
    )
      return false;
    return offer.entry.use.card.materialIDs.every((id) => {
      const locations = Object.entries(game.cardZones).filter(([, zone]) =>
        zone.cards.includes(id),
      );
      return (
        locations.length === 1 &&
        locations[0][1].cards.filter((card) => card === id).length === 1 &&
        rules.materialAllowed(
          structuredClone(game),
          structuredClone(request),
          structuredClone(offer),
          id,
          locations[0][0],
        )
      );
    });
  }
  function offers(game: G, request: CardUseRequest) {
    const entries = rules.offers(
      structuredClone(game),
      structuredClone(request),
    );
    if (new Set(entries.map((offer) => offer.id)).size !== entries.length)
      throw new Error("Duplicate card offer");
    return entries.filter((offer) => eligible(game, request, offer));
  }
  function currentOffer(
    game: G,
    cursor: Cursor,
    offer: CardCommandOffer,
  ): boolean {
    return offers(game, cursor.request).some(
      (current) => JSON.stringify(current) === JSON.stringify(offer),
    );
  }
  function targetsValid(
    game: G,
    cursor: Cursor,
    targets: string[],
    final: boolean,
  ): boolean {
    if (
      !cursor.selected ||
      (cursor.selected.targetFixed && targets.length > 0) ||
      new Set(targets).size !== targets.length
    )
      return false;
    const entry = structuredClone(cursor.selected.entry);
    for (const target of targets) {
      if (
        !game.seatOrder.includes(target) ||
        !rules.targetFilter(
          structuredClone(game),
          structuredClone(cursor.request),
          structuredClone(entry),
          target,
        ) ||
        rules.prohibited(
          structuredClone(game),
          structuredClone(cursor.request),
          structuredClone(entry),
          target,
        )
      )
        return false;
      entry.use.to.push(target);
    }
    return (
      !final ||
      rules.feasible(
        structuredClone(game),
        structuredClone(cursor.request),
        entry,
      )
    );
  }
  function prompt(game: G, cursor: Cursor): OperationStep {
    cursor.generation++;
    cursor.choices = [];
    const add = (choice: ChoiceAction) =>
      cursor.choices.push({
        ...choice,
        id: `choice:${cursor.generation}:${cursor.choices.length}`,
      });
    if (!cursor.selected) {
      for (const offer of offers(game, cursor.request))
        add({
          action: "card",
          label: offer.label,
          offer: structuredClone(offer),
        });
    } else {
      if (targetsValid(game, cursor, cursor.targets, true))
        add({ action: "confirm", label: "Xác nhận" });
      if (!cursor.selected.targetFixed)
        for (const target of game.seatOrder)
          if (targetsValid(game, cursor, [...cursor.targets, target], false))
            add({ action: "target", label: target, target });
      add({ action: "back", label: "Chọn lại bài" });
    }
    if (!cursor.choices.length) {
      if (!cursor.request.canCancel)
        return { kind: "return", value: { status: "unavailable" } };
      add({ action: "decline", label: "Không dùng bài" });
    }
    return {
      kind: "prompt",
      actor: cursor.request.actor,
      canCancel: cursor.request.canCancel,
      choices: cursor.choices.map((choice) => choice.id),
      continuation: cursor,
    };
  }
  const operation: OperationHandler<G> = {
    name: "card-use-request",
    validate: (game, operation) => {
      readRequest(game, operation.data);
    },
    run: ({ game, operation, continuation, answer, operationChild }) => {
      const cursor: Cursor =
        continuation === null
          ? {
              request: readRequest(game, operation.data),
              stage: "activate",
              selected: null,
              targets: [],
              choices: [],
              generation: 0,
            }
          : (structuredClone(continuation) as Cursor);
      if (cursor.stage === "cancelled")
        return { kind: "return", value: { status: "cancelled" } };
      if (cursor.stage === "used") {
        if (operationChild?.value === true)
          return { kind: "return", value: { status: "used" } };
        cursor.stage = "choose";
        cursor.selected = null;
        cursor.targets = [];
      }
      if (!contextValid(game, cursor.request))
        return { kind: "return", value: { status: "invalidated" } };
      if (cursor.stage === "activate") {
        cursor.stage = "choose";
        if (cursor.request.reason === "play")
          return {
            kind: "event",
            event: {
              name: "PlayCard",
              target: cursor.request.actor,
              data: null,
            },
            continuation: cursor,
          };
      }
      if (cursor.stage === "execute") {
        if (
          !currentOffer(game, cursor, cursor.selected!) ||
          !targetsValid(game, cursor, cursor.targets, true)
        ) {
          cursor.stage = "choose";
          cursor.selected = null;
          cursor.targets = [];
          return prompt(game, cursor);
        }
        cursor.stage = "used";
        return {
          kind: "operation",
          operation: {
            name: "room-use-card",
            data: {
              ...selectedUse(cursor),
              addHistory: cursor.request.addHistory,
            },
          },
          continuation: cursor,
        };
      }
      if (answer) {
        const choice = cursor.choices.find(
          (choice) => choice.id === answer.choice,
        );
        if (answer.choice === null || choice?.action === "decline") {
          cursor.stage = "cancelled";
          if (cursor.request.reason === "response-use")
            return {
              kind: "event",
              event: {
                name: "ChoiceMade",
                target: cursor.request.actor,
                data: `cardUsed:${cursor.request.pattern}:${cursor.request.prompt}:nil`,
              },
              continuation: cursor,
            };
          return { kind: "return", value: { status: "cancelled" } };
        }
        if (!choice) throw new Error("Invalid admitted choice");
        if (choice.action === "card")
          cursor.selected = structuredClone(choice.offer);
        if (choice.action === "back") {
          cursor.selected = null;
          cursor.targets = [];
        }
        if (choice.action === "target") cursor.targets.push(choice.target);
        if (choice.action === "confirm") {
          cursor.stage = "execute";
          return {
            kind: "event",
            event: {
              name: "ChoiceMade",
              target: cursor.request.actor,
              data: selectedUse(cursor).use,
            },
            continuation: cursor,
          };
        }
      }
      game.currentCardUseReason = cursor.request.reason;
      game.currentCardUsePattern = cursor.request.pattern;
      return prompt(game, cursor);
    },
  };
  return {
    operation,
    view: (
      scheduler: TriggerScheduler,
      auth: Auth,
    ): {
      id: string;
      choices: { id: string; label: string }[];
      canCancel: boolean;
    } | null => {
      const state = privatePrompt(scheduler);
      if (!state || authenticate(auth) !== state.prompt.actor) return null;
      return {
        id: state.prompt.id,
        choices: state.cursor.choices.map(({ id, label }) => ({ id, label })),
        canCancel: state.prompt.canCancel,
      };
    },
    submit: (
      scheduler: TriggerScheduler,
      game: G,
      registry: TriggerRegistry<G>,
      auth: Auth,
      reply: unknown,
    ): boolean => {
      const state = privatePrompt(scheduler);
      const actor = authenticate(auth);
      if (!state || !actor || state.prompt.actor !== actor) return false;
      if (
        !reply ||
        typeof reply !== "object" ||
        Array.isArray(reply) ||
        Object.keys(reply).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(reply, "id") ||
        !Object.prototype.hasOwnProperty.call(reply, "choice")
      )
        return false;
      if (!contextValid(game, state.cursor.request)) return false;
      const choice = state.cursor.choices.find(
        (choice) => choice.id === (reply as { choice: unknown }).choice,
      );
      // Discarding intent needs a live request, but cannot spend an invalid offer.
      if (
        (reply as { choice: unknown }).choice === null ||
        choice?.action === "back" ||
        choice?.action === "decline"
      )
        return resumeTriggerPrompt(scheduler, game, registry, actor, reply);
      if (
        choice?.action === "card" &&
        !currentOffer(game, state.cursor, choice.offer)
      )
        return false;
      if (
        state.cursor.selected &&
        !currentOffer(game, state.cursor, state.cursor.selected)
      )
        return false;
      if (
        state.cursor.selected &&
        !targetsValid(game, state.cursor, state.cursor.targets, false)
      )
        return false;
      if (
        choice?.action === "target" &&
        !targetsValid(
          game,
          state.cursor,
          [...state.cursor.targets, choice.target],
          false,
        )
      )
        return false;
      if (
        choice?.action === "confirm" &&
        !targetsValid(game, state.cursor, state.cursor.targets, true)
      )
        return false;
      return resumeTriggerPrompt(scheduler, game, registry, actor, reply);
    },
  };
}
