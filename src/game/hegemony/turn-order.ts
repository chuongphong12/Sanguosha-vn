import { damageRoomTags } from "./damage";
import { deathOrder, livingPlayers } from "./death";
import type { TurnStartGame } from "./turn-start";
import type { RoomLedgerGame } from "./phase-state";
import { readPhase } from "./phases";
import { readSlashAlive, readSlashInteger } from "./slash";
import type { OperationHandler, OperationStep } from "./scheduler";

export type NormalTurnState =
  { stage: "regular"; anchor: null } | { stage: "extra"; anchor: string };
export type NormalTurnGame = TurnStartGame &
  RoomLedgerGame & { turnOrder: NormalTurnState };
function current(game: NormalTurnGame) {
  const target = game.currentPlayer;
  if (target === null || !game.seatOrder.includes(target))
    throw Error("Invalid normal-turn actor");
  return target;
}
function finished(game: NormalTurnGame) {
  if (
    game.gameResult !== undefined &&
    game.gameResult !== null &&
    typeof game.gameResult !== "string"
  )
    throw Error("Invalid turn result");
  return game.gameResult !== undefined && game.gameResult !== null;
}
function validate(game: NormalTurnGame) {
  const cursor = game.turnOrder;
  if (
    !cursor ||
    (cursor.stage === "regular"
      ? cursor.anchor !== null
      : cursor.stage !== "extra" ||
        typeof cursor.anchor !== "string" ||
        !game.seatOrder.includes(cursor.anchor))
  )
    throw Error("Invalid normal-turn cursor");
  if (finished(game)) return;
  current(game);
  if (cursor.stage === "extra") extraList(game);
}
function extraList(game: NormalTurnGame) {
  const list = damageRoomTags(game).ExtraTurnList;
  if (list === undefined || list === null) return null;
  if (!Array.isArray(list) || list.some((p) => typeof p !== "string"))
    throw Error("Invalid extra-turn list");
  return list as string[];
}
/** Native findPlayer(name), including displayed head aliases and '+' alternatives. */
function extraPlayer(game: NormalTurnGame, name: string) {
  const names = name.split("+");
  return (
    livingPlayers(game).find((p) => {
      if (!readSlashAlive(game, p)) throw Error("Invalid living turn actor");
      const head = game.displayedGenerals?.[p]?.head;
      if (typeof head !== "string")
        throw Error("Invalid displayed turn general");
      return names.includes(p) || names.includes(head);
    }) ?? null
  );
}
/** getNextAlive(1, false): dead seats are skipped, removed living seats remain eligible. */
function nextAlive(game: NormalTurnGame, anchor: string) {
  const index = game.seatOrder.indexOf(anchor);
  for (let i = 1; i <= game.seatOrder.length; i++) {
    const p = game.seatOrder[(index + i) % game.seatOrder.length];
    if (readSlashAlive(game, p)) return p;
  }
  return anchor;
}
/** Trusted roots only. Each step emits at most one TurnStart; match v3 owns pumping/unwind classification. */
export function createNormalTurnOperations<
  G extends NormalTurnGame,
>(): OperationHandler<G>[] {
  type Advance = { next: string; players: string[]; index: number };
  return [
    {
      name: "normal-turn-step",
      validate: (game) => {
        validate(game);
      },
      run: ({ game, continuation }): OperationStep => {
        if (continuation === true)
          return {
            kind: "return",
            value: finished(game) ? "finished" : "turn",
          };
        let advance: Advance | null =
          continuation === null
            ? null
            : (structuredClone(continuation) as Advance);
        if (advance === null) {
          if (finished(game)) return { kind: "return", value: "finished" };
          const cursor = game.turnOrder;
          let target: string;
          if (cursor.stage === "regular") {
            target = current(game);
            game.turnOrder = { stage: "extra", anchor: target };
          } else {
            const list = extraList(game);
            if (list?.length) {
              const name = list[0];
              damageRoomTags(game).ExtraTurnList = list.slice(1);
              const player = extraPlayer(game, name);
              if (player === null)
                return { kind: "return", value: "extra-skipped" };
              target = player;
              game.currentPlayer = target;
            } else {
              if (list) delete damageRoomTags(game).ExtraTurnList;
              const next = nextAlive(game, cursor.anchor);
              advance = {
                next,
                players:
                  readSlashInteger(game.seats[next]) <=
                  readSlashInteger(game.seats[cursor.anchor])
                    ? deathOrder(game)
                    : [],
                index: 0,
              };
            }
          }
          if (advance === null)
            return {
              kind: "event",
              event: { name: "TurnStart", target: target!, data: null },
              continuation: true,
            };
        }
        while (advance.index < advance.players.length) {
          const target = advance.players[advance.index++];
          return {
            kind: "operation",
            operation: {
              name: "clear-player-marks",
              data: { target, suffix: "-round" },
            },
            continuation: advance,
          };
        }
        game.currentPlayer = advance.next;
        game.turnOrder = { stage: "regular", anchor: null };
        return { kind: "return", value: "advanced" };
      },
    },
    {
      name: "recover-normal-turn",
      validate: (game) => {
        readPhase(game.playerPhases[current(game)]);
      },
      run: ({ game, continuation }): OperationStep => {
        type Recovery = { player: string; next: string | null; stage: number };
        const c: Recovery =
          continuation === null
            ? { player: current(game), next: null, stage: 0 }
            : (structuredClone(continuation) as Recovery);
        while (true)
          switch (c.stage++) {
            case 0:
              return {
                kind: "event",
                event: { name: "TurnBroken", target: c.player, data: null },
                continuation: c,
              };
            case 1:
              c.next = nextAlive(game, c.player);
              if (readPhase(game.playerPhases[c.player]) !== "not-active")
                return {
                  kind: "operation",
                  operation: {
                    name: "phase-cleanup",
                    data: {
                      event: "EventPhaseEnd",
                      target: c.player,
                      data: null,
                    },
                  },
                  continuation: c,
                };
              c.stage = 3;
              break;
            case 2:
              return {
                kind: "operation",
                operation: {
                  name: "change-phase",
                  data: {
                    target: c.player,
                    from: readPhase(game.playerPhases[c.player]),
                    to: "not-active",
                  },
                },
                continuation: c,
              };
            case 3:
              game.currentPlayer = c.next!;
              game.turnOrder = { stage: "regular", anchor: null };
              return { kind: "return", value: "recovered" };
            default:
              throw Error("Invalid normal-turn recovery continuation");
          }
      },
    },
  ];
}
