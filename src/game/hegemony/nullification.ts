import {
  readCardEffect,
  type CardEffect,
  type CardEffectGame,
} from "./card-effect";
import { readCardReference } from "./card-resources";
import { readExecutionCardUse, type CardUse } from "./card-on-use";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export type NullificationCard = { reference: string; card: CardUse["card"] };
type AskTarget = { effect: CardEffect; reference: string };
export type NullificationAsk = AskTarget & {
  positive: boolean;
  origin: AskTarget;
};
export type NullificationRace = {
  ask: NullificationAsk;
  humans: string[];
  ais: string[];
};
export interface NullificationGame extends CardEffectGame {
  /** Private RoomState reason, left at response-use just as in the native caller. */
  currentCardUseReason?: "play" | "response" | "response-use";
}
export interface NullificationRules<G extends NullificationGame> {
  tableZone: string;
  discardZone: string;
  /** Resolved package hasNullification; discovery/transient Huashen flags are adapter-owned. */
  hasNullification: (game: Readonly<G>, player: string) => boolean;
  isOnline: (game: Readonly<G>, player: string) => boolean;
  isNullification: (game: Readonly<G>, reference: string) => boolean;
  isHegNullification: (game: Readonly<G>, reference: string) => boolean;
  identity: (
    game: Readonly<G>,
    player: string,
  ) => { careerist: boolean; shown: boolean; kingdom: string };
  isCancelable: (
    game: Readonly<G>,
    effect: CardEffect,
    reference: string,
  ) => boolean;
  /** Owns native human/AI race, parse acceptance, AI use limits, randomness and timeout. */
  race: (request: NullificationRace) => TriggerOperation;
  validateResponse: (
    player: string,
    response: NullificationCard,
  ) => TriggerOperation;
  reveal: (player: string, response: NullificationCard) => TriggerOperation;
  validateAfter: (
    player: string,
    original: NullificationCard,
    use: CardUse,
  ) => TriggerOperation;
  moveReason: (
    game: Readonly<G>,
    player: string,
    response: NullificationCard,
  ) => TriggerData;
}
type Cursor = {
  stage:
    | "eligibility"
    | "race"
    | "validate"
    | "retry"
    | "choice"
    | "heg-decision"
    | "accepted"
    | "pre"
    | "table"
    | "reveal"
    | "used"
    | "decision"
    | "counter"
    | "finish"
    | "finished"
    | "discard"
    | "after";
  ask: NullificationAsk;
  players: string[];
  index: number;
  humans: string[];
  ais: string[];
  data: TriggerData;
  disresponsive: string[];
  player: string | null;
  original: NullificationCard | null;
  response: NullificationCard | null;
  afterPre: CardUse | null;
  result: boolean;
  heg: boolean;
  all: boolean;
};
function bool(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new Error("Invalid nullification predicate");
  return value;
}
function strings(value: TriggerData | undefined): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string"))
    throw new Error("Invalid nullification list");
  return [...value] as string[];
}
function readAsk(game: NullificationGame, data: TriggerData): NullificationAsk {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.reference !== "string" ||
    typeof data.positive !== "boolean"
  )
    throw new Error("Invalid nullification ask");
  const effect = readCardEffect(game, data.effect);
  readCardReference(game, data.reference);
  const target = { effect, reference: data.reference };
  let origin = target;
  if (data.origin !== undefined) {
    const supplied = data.origin;
    if (
      !supplied ||
      typeof supplied !== "object" ||
      Array.isArray(supplied) ||
      typeof supplied.reference !== "string"
    )
      throw new Error("Invalid nullification origin");
    origin = {
      effect: readCardEffect(game, supplied.effect),
      reference: supplied.reference,
    };
    readCardReference(game, origin.reference);
  }
  return {
    ...target,
    positive: data.positive,
    origin: structuredClone(origin),
  };
}
function readResponse(
  game: NullificationGame,
  data: TriggerData,
  player: string,
): NullificationCard {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.reference !== "string"
  )
    throw new Error("Invalid nullification response");
  const use = readExecutionCardUse(game, {
    from: player,
    to: [],
    card: data.card,
  });
  readCardReference(game, data.reference);
  return { reference: data.reference, card: use.card };
}
function materialMove<G extends NullificationGame>(
  game: G,
  cursor: Cursor,
  rules: NullificationRules<G>,
  cleanup: boolean,
): TriggerOperation | null {
  const response = cursor.response!;
  const ids = response.card.materialIDs.filter(
    (id) =>
      !cleanup ||
      Object.values(game.cardZones).some(
        (zone) => zone.place === "table" && zone.cards.includes(id),
      ),
  );
  if (!ids.length) return null;
  const reason = structuredClone(
    rules.moveReason(
      structuredClone(game),
      cursor.player!,
      structuredClone(response),
    ),
  );
  return {
    name: "move-cards",
    data: {
      moves: cleanup
        ? [{ ids, to: rules.discardZone, open: true, reason }]
        : ids.map((id) => ({
            ids: [id],
            to: rules.tableZone,
            open: true,
            reason,
          })),
      forceVisible: true,
    },
  };
}
function hegEligible<G extends NullificationGame>(
  game: G,
  cursor: Cursor,
  rules: NullificationRules<G>,
): boolean {
  if (
    !bool(
      rules.isHegNullification(
        structuredClone(game),
        cursor.response!.reference,
      ),
    ) ||
    bool(rules.isNullification(structuredClone(game), cursor.ask.reference)) ||
    !readCardReference(game, cursor.ask.reference).card.isNDTrick
  )
    return false;
  const identity = (player: string) => {
    if (!game.seatOrder.includes(player))
      throw new Error("Unknown nullification target");
    const value = structuredClone(
      rules.identity(structuredClone(game), player),
    );
    if (
      !value ||
      typeof value.careerist !== "boolean" ||
      typeof value.shown !== "boolean" ||
      typeof value.kingdom !== "string"
    )
      throw new Error("Invalid nullification identity");
    return value;
  };
  const target = identity(cursor.ask.effect.to);
  if (target.careerist || !target.shown) return false;
  const { ledger, card } = readCardReference(game, cursor.ask.reference);
  const original = strings(ledger.roomTags[`targets${card.key}`]);
  const remaining = [...original];
  const removeOne = (id: string) => {
    const index = remaining.indexOf(id);
    if (index !== -1) remaining.splice(index, 1);
  };
  removeOne(cursor.ask.effect.to);
  for (const player of original)
    if (original.indexOf(player) < original.indexOf(cursor.ask.effect.to))
      removeOne(player);
  return remaining.some((player) => {
    const other = identity(player);
    return !other.careerist && other.shown && other.kingdom === target.kingdom;
  });
}
function runNullification<G extends NullificationGame>(
  {
    game,
    operation,
    continuation,
    child,
    operationChild,
    answer,
  }: OperationContext<G>,
  rules: NullificationRules<G>,
): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const ask = readAsk(game, operation.data);
    const { storage } = readCardReference(game, ask.reference);
    const players = game.seatOrder.filter((player) => bool(game.alive[player]));
    cursor = {
      stage: "eligibility",
      ask,
      players,
      index: 0,
      humans: [],
      ais: [],
      data: {
        ...ask.effect,
        multiple: false,
        nullified: false,
        disresponsive: false,
      },
      disresponsive: strings(storage.tags.CardUseDisresponsiveList),
      player: null,
      original: null,
      response: null,
      afterPre: null,
      result: false,
      heg: false,
      all: false,
    };
    game.currentCardUseReason = "response-use";
  } else cursor = structuredClone(continuation) as Cursor;
  if (cursor.stage === "eligibility" && child) {
    cursor.data = structuredClone(child.event.data);
    if (!child.consumed) {
      const player = cursor.players[cursor.index - 1];
      (bool(rules.isOnline(structuredClone(game), player))
        ? cursor.humans
        : cursor.ais
      ).push(player);
    }
  }
  while (
    cursor.stage === "eligibility" &&
    cursor.index < cursor.players.length
  ) {
    const player = cursor.players[cursor.index++];
    if (!bool(rules.hasNullification(structuredClone(game), player))) continue;
    if (
      cursor.disresponsive.includes(player) ||
      cursor.disresponsive.includes("_ALL_PLAYERS")
    )
      continue;
    return {
      kind: "event",
      event: { name: "TrickCardCanceling", target: player, data: cursor.data },
      continuation: cursor,
    };
  }
  if (cursor.stage === "eligibility") {
    cursor.stage = "race";
    return {
      kind: "operation",
      operation: rules.race(
        structuredClone({
          ask: cursor.ask,
          humans: cursor.humans,
          ais: cursor.ais,
        }),
      ),
      continuation: cursor,
    };
  }
  if (cursor.stage === "race") {
    const reply = operationChild?.value;
    if (reply === null) return { kind: "return", value: false };
    if (
      !reply ||
      typeof reply !== "object" ||
      Array.isArray(reply) ||
      typeof reply.player !== "string" ||
      ![...cursor.humans, ...cursor.ais].includes(reply.player)
    )
      throw new Error("Invalid nullification race winner");
    cursor.player = reply.player;
    cursor.original = readResponse(game, reply.response, reply.player);
    cursor.stage = "validate";
    return {
      kind: "operation",
      operation: rules.validateResponse(
        cursor.player,
        structuredClone(cursor.original),
      ),
      continuation: cursor,
    };
  }
  if (cursor.stage === "retry")
    return { kind: "return", value: bool(operationChild?.value) };
  if (cursor.stage === "validate") {
    if (operationChild?.value === null) {
      cursor.stage = "retry";
      return {
        kind: "operation",
        operation: { name: "ask-nullification", data: cursor.ask },
        continuation: cursor,
      };
    }
    cursor.response = readResponse(
      game,
      operationChild?.value ?? null,
      cursor.player!,
    );
    cursor.heg = hegEligible(game, cursor, rules);
    cursor.stage = "accepted";
    if (cursor.heg) {
      cursor.stage = "choice";
      return {
        kind: "prompt",
        actor: cursor.player!,
        choices: ["single", "all"],
        canCancel: false,
        continuation: cursor,
      };
    }
  }
  if (cursor.stage === "choice") {
    cursor.all = answer?.choice === "all";
    cursor.stage = "heg-decision";
    return {
      kind: "event",
      event: {
        name: "ChoiceMade",
        target: cursor.player,
        data: `skillChoice:heg_nullification:${cursor.all ? "all" : "single"}`,
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "heg-decision") {
    cursor.stage = "accepted";
  }
  if (cursor.stage === "accepted") {
    readCardReference(
      game,
      cursor.ask.reference,
    ).ledger.roomTags.NullificatonType = cursor.heg;
    const ids = cursor.response!.card.materialIDs;
    cursor.data = {
      from: cursor.player!,
      to: [],
      card: structuredClone(cursor.response!.card),
      isHandcard:
        ids.length > 0 &&
        ids.every((id) =>
          Object.values(game.cardZones).some(
            (zone) =>
              zone.owner === cursor.player &&
              zone.place === "hand" &&
              zone.cards.includes(id),
          ),
        ),
    };
    cursor.stage = "pre";
    return {
      kind: "event",
      event: { name: "PreCardUsed", target: cursor.player, data: cursor.data },
      continuation: cursor,
    };
  }
  if (cursor.stage === "pre") {
    cursor.afterPre = readExecutionCardUse(game, child!.event.data);
    cursor.data = structuredClone(cursor.afterPre);
    cursor.stage = "table";
    const movement = materialMove(game, cursor, rules, false);
    if (movement)
      return { kind: "operation", operation: movement, continuation: cursor };
  }
  if (cursor.stage === "table") {
    cursor.stage = "reveal";
    return {
      kind: "operation",
      operation: rules.reveal(
        cursor.player!,
        structuredClone(cursor.response!),
      ),
      continuation: cursor,
    };
  }
  if (cursor.stage === "reveal") {
    cursor.stage = "used";
    return {
      kind: "event",
      event: { name: "CardUsed", target: cursor.player, data: cursor.data },
      continuation: cursor,
    };
  }
  if (cursor.stage === "used") {
    cursor.data = structuredClone(child!.event.data);
    cursor.result = !child!.consumed;
    if (cursor.result) {
      const use = readExecutionCardUse(game, cursor.data);
      cursor.result = !strings(
        (use as CardUse & { nullified_list?: TriggerData }).nullified_list,
      ).includes("_ALL_TARGETS");
    }
    cursor.stage = "decision";
    return {
      kind: "event",
      event: {
        name: "ChoiceMade",
        target: cursor.player,
        data: `Nullification:${cursor.ask.effect.card.className}:${cursor.ask.effect.to}:${cursor.ask.positive ? "true" : "false"}`,
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "decision") {
    const ledger = readCardReference(game, cursor.ask.reference).ledger;
    const supplied = ledger.roomTags.NullifyingTimes;
    const count = supplied === undefined ? 0 : supplied;
    if (
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      count === Number.MAX_SAFE_INTEGER
    )
      throw new Error("Invalid NullifyingTimes");
    ledger.roomTags.NullifyingTimes = count + 1;
    cursor.stage = "finish";
    const check: CardEffect = {
      from: null,
      to: cursor.player!,
      card: structuredClone(cursor.response!.card),
      multiple: false,
      nullified: false,
      disresponsive: false,
    };
    if (
      cursor.result &&
      bool(
        rules.isCancelable(
          structuredClone(game),
          structuredClone(check),
          cursor.response!.reference,
        ),
      )
    ) {
      cursor.stage = "counter";
      return {
        kind: "operation",
        operation: {
          name: "ask-nullification",
          data: {
            effect: {
              ...check,
              from: cursor.player!,
              to: cursor.ask.effect.to,
            },
            reference: cursor.response!.reference,
            positive: !cursor.ask.positive,
            origin: cursor.ask.origin,
          },
        },
        continuation: cursor,
      };
    }
  }
  if (cursor.stage === "counter") {
    cursor.result = !bool(operationChild?.value);
    cursor.stage = "finish";
  }
  if (cursor.stage === "finish") {
    cursor.stage = "finished";
    return {
      kind: "event",
      event: { name: "CardFinished", target: cursor.player, data: cursor.data },
      continuation: cursor,
    };
  }
  if (cursor.stage === "finished") {
    cursor.stage = "discard";
    const movement = materialMove(game, cursor, rules, true);
    if (movement)
      return { kind: "operation", operation: movement, continuation: cursor };
  }
  if (cursor.stage === "discard") {
    cursor.stage = "after";
    return {
      kind: "operation",
      operation: rules.validateAfter(
        cursor.player!,
        structuredClone(cursor.original!),
        structuredClone(cursor.afterPre!),
      ),
      continuation: cursor,
    };
  }
  const ledger = readCardReference(game, cursor.ask.reference).ledger;
  delete ledger.roomTags.NullificatonType;
  if (cursor.heg && cursor.all && cursor.result)
    ledger.roomTags.HegNullificationValid = true;
  return { kind: "return", value: cursor.result };
}

/** Normalized Room::_askForNullification; production content/race adapters are not registered. */
export function createNullificationOperation<G extends NullificationGame>(
  rules: NullificationRules<G>,
): OperationHandler<G> {
  return {
    name: "ask-nullification",
    validate: (game, operation) => {
      const ask = readAsk(game, operation.data);
      strings(
        readCardReference(game, ask.reference).storage.tags
          .CardUseDisresponsiveList,
      );
      for (const player of game.seatOrder) bool(game.alive[player]);
      for (const [key, place] of [
        [rules.tableZone, "table"],
        [rules.discardZone, "discard"],
      ]) {
        const zone = game.cardZones[key];
        if (
          !zone ||
          zone.place !== place ||
          zone.owner !== null ||
          !Array.isArray(zone.cards)
        )
          throw new Error("Invalid nullification destination");
      }
    },
    run: (context) => runNullification(context, rules),
  };
}
