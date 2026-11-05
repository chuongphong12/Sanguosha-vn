import {
  readDrawPiles,
  shufflePileCards,
  type DrawPileGame,
} from "./draw-pile";
import { luckHandZone, type LuckTransferRules } from "./luck-transfer";
import { readSlashInteger } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerOperation,
} from "./scheduler";

export type LuckCardNotice =
  | { kind: "luck-pause" }
  | { kind: "luck-focus"; players: string[]; round: number }
  | { kind: "luck-log"; target: string }
  | { kind: "update-pile"; count: number };
export interface LuckCardRules<G extends DrawPileGame> {
  piles: Pick<
    LuckTransferRules<G>,
    "drawZone" | "reservedZone" | "discardZone" | "transitZone"
  >;
  limit: (game: Readonly<G>) => number;
  usesAI: (game: Readonly<G>, target: string) => boolean;
  /** Trusted all-send/common-deadline collection; result maps player to ready/payload. */
  request: (players: string[], round: number) => TriggerOperation;
  notify: (notice: LuckCardNotice) => TriggerOperation | null;
}
export function createLuckCardOperation<G extends DrawPileGame>(
  rules: LuckCardRules<G>,
): OperationHandler<G> {
  type Cursor = {
    stage: number;
    round: number;
    players: string[];
    index: number;
    counts: number[];
  };
  return {
    name: "luck-card",
    validate: (_game, operation) => {
      if (operation.data !== null) throw new Error("Invalid luck-card request");
    },
    run: ({ game, continuation, operationChild }): OperationStep => {
      const cursor: Cursor =
        continuation === null
          ? { stage: 0, round: 0, players: [], index: 0, counts: [] }
          : (structuredClone(continuation) as Cursor);
      while (true)
        switch (cursor.stage) {
          case 0: {
            cursor.stage = 1;
            const next = rules.notify({ kind: "luck-pause" });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 1:
            cursor.players = game.seatOrder.filter((target) => {
              const usesAI = rules.usesAI(structuredClone(game), target);
              if (typeof usesAI !== "boolean")
                throw new Error("Invalid luck AI authority");
              return !usesAI;
            });
            cursor.stage = 2;
            break;
          case 2: {
            if (
              !cursor.players.length ||
              cursor.round >=
                readSlashInteger(rules.limit(structuredClone(game)))
            )
              return { kind: "return", value: null };
            cursor.round++;
            cursor.stage = 3;
            const next = rules.notify({
              kind: "luck-focus",
              players: [...cursor.players],
              round: cursor.round,
            });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 3:
            cursor.stage = 4;
            return {
              kind: "operation",
              operation: rules.request([...cursor.players], cursor.round),
              continuation: cursor,
            };
          case 4: {
            const replies = operationChild?.value;
            if (
              !replies ||
              typeof replies !== "object" ||
              Array.isArray(replies)
            )
              throw new Error("Invalid luck request-round result");
            cursor.players = cursor.players.filter((target) => {
              const reply = replies[target];
              return (
                reply !== null &&
                typeof reply === "object" &&
                !Array.isArray(reply) &&
                reply.ready === true &&
                reply.payload === true
              );
            });
            if (!cursor.players.length) return { kind: "return", value: null };
            cursor.index = 0;
            cursor.counts = [];
            cursor.stage = 5;
            break;
          }
          case 5: {
            if (cursor.index === cursor.players.length) {
              cursor.index = 0;
              cursor.stage = 6;
              break;
            }
            const target = cursor.players[cursor.index++],
              next = rules.notify({ kind: "luck-log", target });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 6: {
            if (cursor.index === cursor.players.length) {
              cursor.stage = 8;
              break;
            }
            const target = cursor.players[cursor.index],
              ids = [
                ...game.cardZones[
                  luckHandZone(game, target, rules.piles.transitZone)
                ].cards,
              ];
            cursor.counts[cursor.index] = ids.length;
            cursor.stage = 7;
            return {
              kind: "operation",
              operation: {
                name: "luck-transfer",
                data: { direction: "return", target, ids },
              },
              continuation: cursor,
            };
          }
          case 7:
            cursor.index++;
            cursor.stage = 6;
            break;
          case 8:
            shufflePileCards(game, readDrawPiles(game, rules.piles).draw.cards);
            cursor.index = 0;
            cursor.stage = 9;
            break;
          case 9:
            if (cursor.index === cursor.players.length) {
              cursor.stage = 12;
              break;
            }
            cursor.stage = 10;
            return {
              kind: "operation",
              operation: {
                name: "get-n-cards",
                data: {
                  count: cursor.counts[cursor.index],
                  updatePileNumber: false,
                },
              },
              continuation: cursor,
            };
          case 10: {
            const value = operationChild?.value;
            if (
              !Array.isArray(value) ||
              value.length !== cursor.counts[cursor.index]
            )
              throw new Error("Invalid luck redeal result");
            const ids = value.map((id) => {
              if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0)
                throw new Error("Invalid luck redeal card");
              return id;
            });
            cursor.stage = 11;
            return {
              kind: "operation",
              operation: {
                name: "luck-transfer",
                data: {
                  direction: "redeal",
                  target: cursor.players[cursor.index],
                  ids,
                },
              },
              continuation: cursor,
            };
          }
          case 11:
            cursor.index++;
            cursor.stage = 9;
            break;
          case 12: {
            cursor.stage = 2;
            const next = rules.notify({
              kind: "update-pile",
              count: readDrawPiles(game, rules.piles).draw.cards.length,
            });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          default:
            throw new Error("Invalid luck-card continuation");
        }
    },
  };
}
