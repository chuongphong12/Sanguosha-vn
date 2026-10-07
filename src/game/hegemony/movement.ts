import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

export interface CardZone {
  place: "hand" | "draw" | "discard" | "table";
  owner: string | null;
  cards: number[];
}

/** Authoritative physical storage; never return this object to a player. */
export interface CardMovementGame {
  seatOrder: string[];
  alive: Record<string, boolean>;
  cardZones: Record<string, CardZone>;
}

type Move = {
  ids: number[];
  from: string[];
  to: string;
  bottom: boolean;
  reason: TriggerData;
};
type Cursor = {
  stage: number;
  actor: number;
  moves: Move[];
  data: TriggerData;
  actors: string[];
};

const EVENTS = [
  "BeforeCardsMove",
  "ConfirmMoveCards",
  "PreCardsMoveOneTime",
  "CardsMoveOneTime",
];

function livingActors(
  game: CardMovementGame,
  currentActor: string | null,
): string[] {
  const start =
    currentActor === null ? 0 : game.seatOrder.indexOf(currentActor);
  if (start < 0) throw new Error("Unknown movement actor");
  return [
    ...game.seatOrder.slice(start),
    ...game.seatOrder.slice(0, start),
  ].filter((id) => game.alive[id]);
}

function normalizeMoves(game: CardMovementGame, data: TriggerData): Move[] {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !Array.isArray(data.moves)
  )
    throw new Error("Invalid card movement");
  const seen = new Set<number>();
  return data.moves
    .map((entry) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry) ||
        !Array.isArray(entry.ids) ||
        typeof entry.to !== "string" ||
        !Object.prototype.hasOwnProperty.call(game.cardZones, entry.to) ||
        (entry.bottom !== undefined && typeof entry.bottom !== "boolean") ||
        (entry.bottom === true && game.cardZones[entry.to].place !== "draw")
      )
        throw new Error("Invalid card movement");
      if (
        entry.from !== undefined &&
        (!Array.isArray(entry.from) ||
          entry.from.length !== entry.ids.length ||
          entry.from.some((source) => typeof source !== "string"))
      )
        throw new Error("Invalid movement source");
      const ids: number[] = [];
      const from: string[] = [];
      for (const [index, id] of entry.ids.entries()) {
        if (
          typeof id !== "number" ||
          !Number.isSafeInteger(id) ||
          id < 0 ||
          seen.has(id)
        )
          throw new Error("Invalid physical card");
        seen.add(id);
        const sources = Object.entries(game.cardZones).filter(([, zone]) =>
          zone.cards.includes(id),
        );
        const count = sources.reduce(
          (count, [, zone]) =>
            count + zone.cards.filter((card) => card === id).length,
          0,
        );
        if (count !== 1) throw new Error("Invalid physical card location");
        if (Array.isArray(entry.from) && entry.from[index] !== sources[0][0])
          throw new Error("Stale card movement");
        if (sources[0][0] !== entry.to || entry.bottom === true) {
          ids.push(id);
          from.push(sources[0][0]);
        }
      }
      return {
        ids,
        from,
        to: entry.to,
        bottom: entry.bottom === true,
        reason: entry.reason ?? null,
      };
    })
    .filter((move) => move.ids.length);
}

function commitMoves(game: CardMovementGame, moves: Move[]): void {
  const current = normalizeMoves(game, { moves });
  if (JSON.stringify(current) !== JSON.stringify(moves))
    throw new Error("Stale card movement");
  const zones = structuredClone(game.cardZones);
  for (const move of moves) {
    move.ids.forEach((id, i) => {
      const cards = zones[move.from[i]].cards;
      cards.splice(cards.indexOf(id), 1);
    });
  }
  for (const move of moves) {
    const destination = zones[move.to];
    for (const id of move.ids) {
      if (
        (destination.place === "draw" && !move.bottom) ||
        destination.place === "discard"
      )
        destination.cards.unshift(id);
      else destination.cards.push(id);
    }
  }
  game.cardZones = zones;
}

function runCardMovement<G extends CardMovementGame>(
  context: OperationContext<G>,
): OperationStep {
  const { game, operation, continuation, child, currentActor } = context;
  let cursor: Cursor;
  if (continuation === null) {
    const moves = normalizeMoves(game, operation.data);
    cursor = {
      stage: 0,
      actor: 0,
      moves,
      data: { moves },
      actors: livingActors(game, currentActor),
    };
  } else {
    cursor = structuredClone(continuation) as Cursor;
    if (cursor.stage === 0 && child?.consumed)
      return { kind: "return", value: { cancelled: true, moves: [] } };
    if (child) cursor.data = child.event.data;
    cursor.actor++;
  }
  while (cursor.stage < EVENTS.length) {
    if (cursor.actor < cursor.actors.length) {
      return {
        kind: "event",
        event: {
          name: EVENTS[cursor.stage],
          target: cursor.actors[cursor.actor],
          data: cursor.data,
        },
        continuation: cursor,
      };
    }
    if (cursor.stage === 0) {
      cursor.moves = normalizeMoves(game, cursor.data);
      cursor.data = { moves: cursor.moves };
    } else if (cursor.stage === 1) {
      commitMoves(game, cursor.moves);
      cursor.data = { moves: cursor.moves };
    }
    cursor.stage++;
    cursor.actor = 0;
    cursor.actors = livingActors(game, currentActor);
  }
  return { kind: "return", value: { cancelled: false, data: cursor.data } };
}

/** Only the normalized core zones are enabled; package rewrite rules come later. */
export function createCardMovementOperation<
  G extends CardMovementGame,
>(): OperationHandler<G> {
  return {
    name: "move-cards",
    validate: (game, operation, currentActor) => {
      livingActors(game, currentActor);
      normalizeMoves(game, operation.data);
    },
    run: runCardMovement,
  };
}
