import type { CardMovementGame, CardZone } from "./movement";
import type { TriggerData } from "./scheduler";

export interface CardFace {
  name: string;
  className: string;
  suit: string;
  number: number;
  skillName: string;
}
export interface WrappedCard extends CardFace {
  modified: boolean;
  flags: string[];
  tags: Record<string, TriggerData>;
}
export interface CardFilterBatchContext<G> {
  /** Private snapshot with source inventories removed; no destination adds yet. */
  game: Readonly<G>;
  owner: string;
  mappings: Readonly<Record<number, string>>;
}
export interface CardFilterContext<G> extends CardFilterBatchContext<G> {
  id: number;
}
/** Pure synchronous package predicates/transforms; never serialized in state. */
export interface WrappedCardFilter<G> {
  matches: (
    context: CardFilterContext<G>,
    card: Readonly<WrappedCard>,
  ) => boolean;
  transform: (
    context: CardFilterContext<G>,
    card: Readonly<WrappedCard>,
  ) => CardFace;
}
export interface WrappedCardRules<G extends CardMovementGame> {
  originals: Readonly<Record<number, CardFace>>;
  /** Supply already-eligible filters in the pinned package's native order. */
  filters?: (
    context: CardFilterBatchContext<G>,
  ) => readonly WrappedCardFilter<G>[];
}
interface WrappedMove {
  ids: number[];
  from: string[];
  to: string;
}

function validFace(face: CardFace | undefined): face is CardFace {
  return Boolean(
    face &&
    typeof face.name === "string" &&
    face.name &&
    typeof face.className === "string" &&
    face.className &&
    typeof face.suit === "string" &&
    face.suit &&
    Number.isSafeInteger(face.number) &&
    typeof face.skillName === "string",
  );
}

function replaceFace(
  card: WrappedCard,
  face: CardFace,
  modified: boolean,
): WrappedCard {
  if (!validFace(face)) throw new Error("Invalid card face");
  return {
    ...card,
    name: face.name,
    className: face.className,
    suit: face.suit,
    number: face.number,
    skillName: face.skillName,
    modified,
  };
}

export function validateWrappedCards<G extends CardMovementGame>(
  game: G,
  ids: number[],
  rules: WrappedCardRules<G>,
): void {
  for (const id of ids) {
    const card = game.wrappedCards?.[id];
    if (!card || !rules.originals[id])
      throw new Error("Missing wrapped card metadata");
    if (!validFace(card) || !validFace(rules.originals[id]))
      throw new Error("Invalid card face");
    if (
      typeof card.modified !== "boolean" ||
      !Array.isArray(card.flags) ||
      card.flags.some((flag) => typeof flag !== "string") ||
      card.tags === null ||
      typeof card.tags !== "object" ||
      Array.isArray(card.tags)
    )
      throw new Error("Invalid wrapped card metadata");
  }
}

/** Derive metadata on a private copy; physical storage is committed by movement. */
export function prepareWrappedCards<G extends CardMovementGame>(
  game: G,
  moves: WrappedMove[],
  removedZones: Record<string, CardZone>,
  rules: WrappedCardRules<G>,
  forceVisible: boolean,
): Record<number, WrappedCard> {
  validateWrappedCards(
    game,
    moves.flatMap((move) => move.ids),
    rules,
  );
  const cards = structuredClone(game.wrappedCards!);
  for (const move of moves) {
    if (game.cardZones[move.to].place !== "discard") continue;
    for (const id of move.ids) {
      if (cards[id].modified)
        cards[id] = replaceFace(cards[id], rules.originals[id], false);
    }
  }
  const snapshot = structuredClone(game);
  snapshot.cardZones = structuredClone(removedZones);
  snapshot.wrappedCards = cards;
  const mappings: Record<number, string> = {};
  for (const [key, zone] of Object.entries(game.cardZones))
    for (const id of zone.cards) mappings[id] = key;
  for (const move of moves) for (const id of move.ids) mappings[id] = move.to;
  for (const move of moves) {
    const destination = game.cardZones[move.to];
    if (
      game.cardZones[move.from[0]].owner !== null &&
      destination.place === "delayed"
    ) {
      for (const id of move.ids) {
        const face = rules.originals[id];
        if (cards[id].suit !== face.suit || cards[id].number !== face.number)
          cards[id] = {
            ...cards[id],
            suit: face.suit,
            number: face.number,
            modified: true,
          };
      }
      continue;
    }
    if (
      destination.owner === null ||
      !["hand", "equip", "judge", "special"].includes(destination.place)
    )
      continue;
    // Native refilter resets the entire packet before selecting eligible skills.
    for (const id of move.ids)
      if (cards[id].modified)
        cards[id] = replaceFace(cards[id], rules.originals[id], false);
    const batch = { game: snapshot, owner: destination.owner, mappings };
    const filters = rules.filters?.(batch) ?? [];
    for (const id of move.ids) {
      const context = { ...batch, id };
      for (let pass = 0; pass < filters.length; pass++) {
        let converged = true;
        for (const filter of filters) {
          if (!filter.matches(context, cards[id])) continue;
          const face = filter.transform(context, cards[id]);
          cards[id] = replaceFace(cards[id], face, true);
          converged = false;
        }
        if (converged) break;
      }
    }
  }
  for (const move of moves) {
    for (const id of move.ids) {
      const card = cards[id];
      card.flags = card.flags.filter((flag) => flag !== "visible");
      if (forceVisible && game.cardZones[move.to].place === "hand")
        card.flags.push("visible");
      // Native WrappedCard::setFlags marks modified even when clearing a flag.
      card.modified = true;
      if (game.cardZones[move.to].place === "delayed") {
        card.suit = rules.originals[id].suit;
        card.number = rules.originals[id].number;
      }
    }
  }
  return cards;
}
