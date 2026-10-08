import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

const PLACES = [
  "hand",
  "equip",
  "delayed",
  "judge",
  "special",
  "draw",
  "discard",
  "table",
  "wugu",
] as const;
type CardPlace = (typeof PLACES)[number];

export interface CardZone {
  place: CardPlace;
  owner: string | null;
  cards: number[];
  pileName?: string;
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
  fromPlaces: CardZone["place"][];
  fromPileNames: string[];
  to: string;
  toPlace: CardZone["place"];
  toPileName: string;
  originFrom: string[];
  originTo: string;
  originFromPlaces: CardZone["place"][];
  originToPlace: CardZone["place"];
  originFromPileNames: string[];
  originToPileName: string;
  open: boolean[];
  lastHandcard: boolean;
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
function validZone(game: CardMovementGame, zone: CardZone): boolean {
  return (
    PLACES.includes(zone.place) &&
    Array.isArray(zone.cards) &&
    (zone.pileName === undefined || typeof zone.pileName === "string") &&
    (zone.place !== "special" || Boolean(zone.pileName)) &&
    (["hand", "equip", "delayed", "judge", "special"].includes(zone.place)
      ? typeof zone.owner === "string" && game.seatOrder.includes(zone.owner)
      : zone.owner === null)
  );
}

function actionOrder(
  game: CardMovementGame,
  currentActor: string | null,
): string[] {
  const start =
    currentActor === null ? 0 : game.seatOrder.indexOf(currentActor);
  if (start < 0) throw new Error("Unknown movement actor");
  return [...game.seatOrder.slice(start), ...game.seatOrder.slice(0, start)];
}

function livingActors(
  game: CardMovementGame,
  currentActor: string | null,
): string[] {
  return actionOrder(game, currentActor).filter((id) => game.alive[id]);
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
        !validZone(game, game.cardZones[entry.to]) ||
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
      if (
        entry.open !== undefined &&
        typeof entry.open !== "boolean" &&
        (!Array.isArray(entry.open) ||
          entry.open.length !== entry.ids.length ||
          entry.open.some((value) => typeof value !== "boolean"))
      )
        throw new Error("Invalid movement visibility");
      if (
        entry.lastHandcard !== undefined &&
        typeof entry.lastHandcard !== "boolean"
      )
        throw new Error("Invalid movement metadata");
      const ids: number[] = [];
      const from: string[] = [];
      const fromPlaces: CardZone["place"][] = [];
      const fromPileNames: string[] = [];
      const originFrom: string[] = [];
      const originFromPlaces: CardZone["place"][] = [];
      const originFromPileNames: string[] = [];
      const open: boolean[] = [];
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
        if (!validZone(game, sources[0][1]))
          throw new Error("Invalid movement source zone");
        if (Array.isArray(entry.from) && entry.from[index] !== sources[0][0])
          throw new Error("Stale card movement");
        if (sources[0][0] !== entry.to || entry.bottom === true) {
          ids.push(id);
          from.push(sources[0][0]);
          fromPlaces.push(sources[0][1].place);
          fromPileNames.push(sources[0][1].pileName ?? "");
          originFrom.push(sources[0][0]);
          originFromPlaces.push(sources[0][1].place);
          originFromPileNames.push(sources[0][1].pileName ?? "");
          open.push(
            Array.isArray(entry.open)
              ? (entry.open[index] as boolean)
              : entry.open === true,
          );
        }
      }
      return {
        ids,
        from,
        fromPlaces,
        fromPileNames,
        to: entry.to,
        toPlace: game.cardZones[entry.to].place,
        toPileName: game.cardZones[entry.to].pileName ?? "",
        originFrom,
        originTo: entry.to,
        originFromPlaces,
        originToPlace: game.cardZones[entry.to].place,
        originFromPileNames,
        originToPileName: game.cardZones[entry.to].pileName ?? "",
        open,
        lastHandcard: entry.lastHandcard === true,
        bottom: entry.bottom === true,
        reason: entry.reason ?? null,
      };
    })
    .filter((move) => move.ids.length);
}

const CARD_FIELDS = [
  "ids",
  "from",
  "fromPlaces",
  "fromPileNames",
  "originFrom",
  "originFromPlaces",
  "originFromPileNames",
  "open",
] as const;

function oneCardMove(move: Move, index: number): Move {
  const result = structuredClone(move);
  for (const field of CARD_FIELDS)
    (result[field] as (number | string | boolean)[]) = [move[field][index]];
  return result;
}

function appendCard(group: Move, move: Move, index: number): void {
  for (const field of CARD_FIELDS)
    (group[field] as (number | string | boolean)[]).push(move[field][index]);
  group.lastHandcard ||= move.lastHandcard;
}

function reasonKey(value: TriggerData): string {
  if (Array.isArray(value)) return `[${value.map(reasonKey).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${reasonKey(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

function groupCards(
  moves: Move[],
  classify: (move: Move, index: number) => string,
): Move[] {
  const groups = new Map<string, Move>();
  for (const move of moves) {
    move.ids.forEach((_, index) => {
      const key = classify(move, index);
      const group = groups.get(key);
      if (group) appendCard(group, move, index);
      else groups.set(key, oneCardMove(move, index));
    });
  }
  return [...groups.values()];
}

function separateMoves(game: CardMovementGame, moves: Move[]): Move[] {
  return groupCards(moves, (move, index) => {
    const source = game.cardZones[move.from[index]];
    return JSON.stringify([
      source.owner,
      source.place,
      source.pileName ?? "",
      move.to,
      move.bottom,
      move.open[index],
      reasonKey(move.reason),
      move.lastHandcard,
    ]);
  });
}

function mergeMoves(
  game: CardMovementGame,
  moves: Move[],
  currentActor: string | null,
): Move[] {
  const groups = groupCards(moves, (move, index) => {
    const owner = game.cardZones[move.from[index]].owner;
    return JSON.stringify([owner, move.to, move.bottom]);
  });
  const order = actionOrder(game, currentActor);
  return groups.sort((a, b) => {
    const actor = (move: Move) =>
      game.cardZones[move.from[0]].owner ?? game.cardZones[move.to].owner;
    const index = (move: Move) => {
      const owner = actor(move);
      return owner === null ? Infinity : order.indexOf(owner);
    };
    return index(a) - index(b);
  });
}

function markLastHandcards(game: CardMovementGame, moves: Move[]): void {
  const remaining = new Map<string, Set<number>>();
  for (const zone of Object.values(game.cardZones)) {
    if (zone.place !== "hand" || zone.owner === null) continue;
    const cards = remaining.get(zone.owner) ?? new Set<number>();
    zone.cards.forEach((id) => cards.add(id));
    remaining.set(zone.owner, cards);
  }
  for (const move of moves) {
    let lastHandcard = false;
    move.from.forEach((source, index) => {
      const owner = game.cardZones[source].owner;
      const cards = owner === null ? undefined : remaining.get(owner);
      if (!cards?.size) return;
      cards.delete(move.ids[index]);
      if (cards.size === 0) lastHandcard = true;
    });
    move.lastHandcard = lastHandcard;
  }
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
    const moves = mergeMoves(
      game,
      normalizeMoves(game, operation.data),
      currentActor,
    );
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
      const separated = separateMoves(game, normalizeMoves(game, cursor.data));
      markLastHandcards(game, separated);
      cursor.moves = mergeMoves(game, separated, currentActor);
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

/** Physical zones and metadata only; package card effects come later. */
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
