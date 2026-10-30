import { readDrawPiles, type DrawPileGame } from "./draw-pile";
import {
  prepareWrappedCards,
  validateWrappedCards,
  type WrappedCardRules,
} from "./wrapped-cards";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export interface LuckMoveNotice {
  kind: "luck-move";
  direction: "return" | "redeal";
  phase: "lose" | "get";
  target: string;
  ids: number[];
  privateTo: string | null;
  reason: TriggerData;
}
export interface LuckTransferRules<G extends DrawPileGame> {
  drawZone: string;
  reservedZone: string;
  discardZone: string;
  /** Private in-flight native mapping, excluded from available pile/hand inventories. */
  transitZone: string;
  wrapped: WrappedCardRules<G>;
  notify: (notice: LuckMoveNotice) => TriggerOperation | null;
}
export function luckHandZone(
  game: DrawPileGame,
  target: string,
  transitZone: string,
) {
  const zones = Object.entries(game.cardZones).filter(
    ([key, zone]) =>
      key !== transitZone && zone.place === "hand" && zone.owner === target,
  );
  if (zones.length !== 1) throw new Error("Invalid luck hand inventory");
  return zones[0][0];
}
function transferInput<G extends DrawPileGame>(
  game: G,
  data: TriggerData,
  rules: LuckTransferRules<G>,
) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    (data.direction !== "return" && data.direction !== "redeal") ||
    typeof data.target !== "string" ||
    !game.seatOrder.includes(data.target) ||
    !Array.isArray(data.ids) ||
    data.ids.some(
      (id) => typeof id !== "number" || !Number.isSafeInteger(id) || id < 0,
    ) ||
    new Set(data.ids).size !== data.ids.length
  )
    throw new Error("Invalid luck transfer");
  const ids = data.ids as number[];
  const direction: "return" | "redeal" = data.direction;
  readDrawPiles(game, rules);
  const transit = game.cardZones[rules.transitZone];
  if (
    new Set([
      rules.drawZone,
      rules.reservedZone,
      rules.discardZone,
      rules.transitZone,
    ]).size !== 4 ||
    !transit ||
    transit.place !== "table" ||
    transit.owner !== null ||
    !Array.isArray(transit.cards) ||
    transit.cards.length
  )
    throw new Error("Invalid luck transit zone");
  const hand = luckHandZone(game, data.target, rules.transitZone);
  const from = data.direction === "return" ? hand : rules.reservedZone;
  if (
    data.direction === "return" &&
    (game.cardZones[hand].cards.length !== ids.length ||
      ids.some((id, index) => game.cardZones[hand].cards[index] !== id))
  )
    throw new Error("Luck return requires the current whole hand");
  for (const id of ids) {
    const locations = Object.entries(game.cardZones).filter(([, zone]) =>
      zone.cards.includes(id),
    );
    if (
      locations.length !== 1 ||
      locations[0][0] !== from ||
      game.cardZones[from].cards.filter((card) => card === id).length !== 1
    )
      throw new Error("Invalid luck card source");
  }
  validateWrappedCards(game, ids, rules.wrapped);
  return {
    direction,
    target: data.target,
    ids: [...ids],
    from,
    to: data.direction === "return" ? rules.drawZone : hand,
  };
}
export function createLuckTransferOperation<G extends DrawPileGame>(
  rules: LuckTransferRules<G>,
): OperationHandler<G> {
  type Cursor = { stage: number; input: ReturnType<typeof transferInput<G>> };
  return {
    name: "luck-transfer",
    validate: (game, operation) => {
      transferInput(game, operation.data, rules);
    },
    run: ({ game, operation, continuation }): OperationStep => {
      const cursor: Cursor =
        continuation === null
          ? { stage: 0, input: transferInput(game, operation.data, rules) }
          : (structuredClone(continuation) as Cursor);
      const { direction, target, ids, from, to } = cursor.input;
      while (true)
        switch (cursor.stage++) {
          case 0:
          case 2: {
            const next = rules.notify({
              kind: "luck-move",
              direction,
              phase: cursor.stage === 1 ? "lose" : "get",
              target,
              ids: [...ids],
              privateTo: direction === "return" ? target : null,
              reason:
                direction === "return"
                  ? {
                      kind: "put",
                      actor: target,
                      skill: "luck_card",
                      eventName: "",
                    }
                  : { kind: "unknown", actor: "", skill: "", eventName: "" },
            });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 1: {
            const removed = structuredClone(game.cardZones),
              chosen = new Set(ids);
            if (ids.some((id) => !removed[from].cards.includes(id)))
              throw new Error("Luck source changed during delivery");
            removed[from].cards = removed[from].cards.filter(
              (id) => !chosen.has(id),
            );
            if (ids.length)
              game.wrappedCards = prepareWrappedCards(
                game,
                [{ ids, from: ids.map(() => from), to }],
                removed,
                rules.wrapped,
                false,
                "manual",
              );
            const destination = game.cardZones[to];
            removed[rules.transitZone] = {
              place: destination.place,
              owner: destination.owner,
              cards: [...ids],
            };
            game.cardZones = removed;
            break;
          }
          case 3: {
            const transit = game.cardZones[rules.transitZone];
            if (
              transit.cards.length !== ids.length ||
              ids.some((id, index) => transit.cards[index] !== id)
            )
              throw new Error("Luck transit changed during delivery");
            if (direction === "return")
              for (const id of ids) game.cardZones[to].cards.unshift(id);
            else game.cardZones[to].cards.push(...ids);
            game.cardZones[rules.transitZone] = {
              place: "table",
              owner: null,
              cards: [],
            };
            return { kind: "return", value: null };
          }
          default:
            throw new Error("Invalid luck transfer continuation");
        }
    },
  };
}
