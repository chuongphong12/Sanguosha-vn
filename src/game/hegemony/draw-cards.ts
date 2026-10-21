import type { DrawPileGame } from "./draw-pile";
import { readSlashInteger } from "./slash";
import type { OperationHandler, OperationStep, TriggerData } from "./scheduler";

function drawInput(game: DrawPileGame, data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !Array.isArray(data.players) ||
    !Array.isArray(data.counts) ||
    !data.counts.length ||
    (data.fromUps !== undefined && !Array.isArray(data.fromUps)) ||
    (data.reason !== undefined && typeof data.reason !== "string")
  )
    throw new Error("Invalid draw-cards request");
  const players = data.players.map((player) => {
    if (typeof player !== "string" || !game.seatOrder.includes(player))
      throw new Error("Invalid draw recipient");
    return player;
  });
  const counts = data.counts.map((count) => readSlashInteger(count));
  const fromUps = (data.fromUps ?? []).map((value) => {
    if (typeof value !== "boolean") throw new Error("Invalid draw direction");
    return value;
  });
  return { players, counts, fromUps, reason: data.reason ?? "" };
}
function handZone(game: DrawPileGame, target: string) {
  const zones = Object.entries(game.cardZones).filter(
    ([, zone]) => zone.owner === target && zone.place === "hand",
  );
  if (zones.length !== 1) throw new Error("Invalid draw hand destination");
  return zones[0][0];
}

export function createDrawCardsOperation<
  G extends DrawPileGame,
>(): OperationHandler<G> {
  type Cursor = ReturnType<typeof drawInput> & {
    stage: "next" | "acquired" | "moved";
    index: number;
    target: string;
    count: number;
    moves: TriggerData[];
  };
  return {
    name: "draw-cards",
    validate: (game, operation) => {
      drawInput(game, operation.data);
    },
    run: ({ game, operation, continuation, operationChild }): OperationStep => {
      const cursor: Cursor =
        continuation === null
          ? {
              ...drawInput(game, operation.data),
              stage: "next",
              index: 0,
              target: "",
              count: 0,
              moves: [],
            }
          : (structuredClone(continuation) as Cursor);
      if (cursor.stage === "moved") return { kind: "return", value: null };
      if (cursor.stage === "acquired") {
        const ids = operationChild?.value;
        if (
          !Array.isArray(ids) ||
          ids.length !== cursor.count ||
          ids.some(
            (id) =>
              typeof id !== "number" || !Number.isSafeInteger(id) || id < 0,
          )
        )
          throw new Error("Invalid player draw result");
        cursor.moves.push({
          ids,
          to: handZone(game, cursor.target),
          open: false,
          reason: {
            kind: "draw",
            actor: cursor.target,
            skill: cursor.reason,
            eventName: "",
          },
        });
        cursor.stage = "next";
      }
      while (cursor.index < cursor.players.length) {
        const index = cursor.index++,
          target = cursor.players[index];
        if (typeof game.alive[target] !== "boolean")
          throw new Error("Invalid draw alive state");
        if (!game.alive[target] && cursor.reason !== "reform") continue;
        const count = cursor.counts[Math.min(index, cursor.counts.length - 1)];
        if (count <= 0) continue;
        cursor.target = target;
        cursor.count = count;
        cursor.stage = "acquired";
        return {
          kind: "operation",
          operation: {
            name: "get-n-cards",
            data: {
              count,
              fromUp: cursor.fromUps[index] ?? true,
              updatePileNumber: false,
            },
          },
          continuation: cursor,
        };
      }
      cursor.stage = "moved";
      return {
        kind: "operation",
        operation: {
          name: "move-cards",
          data: { moves: cursor.moves, forceVisible: false },
        },
        continuation: cursor,
      };
    },
  };
}
