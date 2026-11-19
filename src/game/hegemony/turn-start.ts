import { damageRoomTags } from "./damage";
import { readRecipientFlags } from "./card-effect";
import { hasShownGeneral, type GeneralGame } from "./general-identity";
import { livingPlayers } from "./death";
import { areGeneralFriends } from "./general-relations";
import type { PhaseGame } from "./phases";
import { generalMark } from "./general-rule";
import { readSlashAlive, readSlashInteger } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export type TurnStartGame = GeneralGame &
  PhaseGame & { faceUp: Record<string, boolean> };
export type TurnNotice =
  | {
      kind: "flag";
      target: string;
      name: "Global_FirstRound";
      enabled: boolean;
    }
  | { kind: "separator" }
  | { kind: "mark"; target: string; name: string; value: number }
  | { kind: "face-up"; target: string; value: boolean }
  | { kind: "turn-over"; target: string; faceUp: boolean }
  | { kind: "battle-lightbox" | "battle-log" | "battle-start" }
  | { kind: "hand-counts"; players: { target: string; count: number }[] };
export interface TurnStartRules {
  battleRoyal: boolean;
  playerCount: number;
  notify: (notice: TurnNotice) => TriggerOperation | null;
}
export function createTurnStartRule<
  G extends TurnStartGame,
>(): TriggerSkill<G> {
  return {
    id: "game-rule-turn-start",
    events: ["TurnStart"],
    rule: true,
    priority: 0,
    effect: ({ operationChild }) =>
      operationChild
        ? { kind: "done", value: false }
        : {
            kind: "operation",
            operation: { name: "turn-start", data: null },
            continuation: true,
          },
  };
}
export function createTurnStartOperations<G extends TurnStartGame>(
  rules: TurnStartRules,
): OperationHandler<G>[] {
  const battleRoyal = rules.battleRoyal,
    playerCount = rules.playerCount,
    presentation = rules.notify;
  if (
    typeof battleRoyal !== "boolean" ||
    !Number.isSafeInteger(playerCount) ||
    playerCount < 2 ||
    playerCount > 10 ||
    typeof presentation !== "function"
  )
    throw Error("Invalid TurnStart rules");
  function tag(game: G, name: string) {
    const value = damageRoomTags(game)[name];
    if (value !== undefined && value !== null && typeof value !== "boolean")
      throw Error("Invalid turn tag");
    return value === true;
  }
  function current(game: G) {
    const target = game.currentPlayer;
    if (
      target === null ||
      !game.seatOrder.includes(target) ||
      typeof game.faceUp?.[target] !== "boolean"
    )
      throw Error("Invalid turn actor");
    return target;
  }
  function notify(value: TurnNotice, c: TriggerData): OperationStep | null {
    const operation = presentation(value);
    return operation ? { kind: "operation", operation, continuation: c } : null;
  }
  type Cursor = { target: string; stage: number };
  return [
    {
      name: "turn-start",
      validate: (game) => {
        if (!tag(game, "SkipGameRule")) current(game);
      },
      run: ({ game, continuation }): OperationStep => {
        if (continuation === null && tag(game, "SkipGameRule")) {
          delete damageRoomTags(game).SkipGameRule;
          return { kind: "return", value: false };
        }
        const c: Cursor =
          continuation === null
            ? { target: current(game), stage: 0 }
            : (structuredClone(continuation) as Cursor);
        while (true)
          switch (c.stage++) {
            case 0: {
              const tags = damageRoomTags(game);
              if (tag(game, "FirstRound")) {
                tags.FirstRound = false;
                const flags = readRecipientFlags(game, c.target);
                if (!flags.includes("Global_FirstRound"))
                  flags.push("Global_FirstRound");
                game.playerFlags[c.target] = flags;
                const step = notify(
                  {
                    kind: "flag",
                    target: c.target,
                    name: "Global_FirstRound",
                    enabled: true,
                  },
                  c,
                );
                if (step) return step;
              }
              break;
            }
            case 1: {
              const step = notify({ kind: "separator" }, c);
              if (step) return step;
              break;
            }
            case 2: {
              const value = readSlashInteger(
                generalMark(game, c.target, "Global_TurnCount") + 1,
              );
              game.playerMarks[c.target].Global_TurnCount = value;
              const step = notify(
                {
                  kind: "mark",
                  target: c.target,
                  name: "Global_TurnCount",
                  value,
                },
                c,
              );
              if (step) return step;
              break;
            }
            case 3: {
              const players = game.seatOrder.map((target) => ({
                target,
                count: Object.values(game.cardZones)
                  .filter((z) => z.owner === target && z.place === "hand")
                  .reduce((count, z) => count + z.cards.length, 0),
              }));
              const step = notify({ kind: "hand-counts", players }, c);
              if (step) return step;
              break;
            }
            case 4: {
              if (battleRoyal && !tag(game, "BattleRoyalMode")) {
                const players = livingPlayers(game);
                if (
                  players.length < (playerCount > 7 ? 5 : 4) &&
                  !players.some(
                    (p, i) =>
                      hasShownGeneral(game, p) &&
                      players
                        .slice(i + 1)
                        .some(
                          (q) =>
                            hasShownGeneral(game, q) &&
                            areGeneralFriends(game, p, q),
                        ),
                  )
                ) {
                  c.stage = 10;
                  return {
                    kind: "operation",
                    operation: { name: "enter-battle-royal", data: null },
                    continuation: c,
                  };
                }
              }
              c.stage = 10;
              break;
            }
            case 10: {
              c.stage = 5;
              if (typeof game.faceUp[c.target] !== "boolean")
                throw Error("Invalid face-up state");
              if (!game.faceUp[c.target]) {
                game.playerFlags[c.target] = readRecipientFlags(
                  game,
                  c.target,
                ).filter((f) => f !== "Global_FirstRound");
                c.stage = 7;
                const step = notify(
                  {
                    kind: "flag",
                    target: c.target,
                    name: "Global_FirstRound",
                    enabled: false,
                  },
                  c,
                );
                if (step) return step;
                break;
              }
              if (!readSlashAlive(game, c.target))
                return { kind: "return", value: false };
              const value = readSlashInteger(
                generalMark(game, c.target, "Global_RoundCount") + 1,
              );
              game.playerMarks[c.target].Global_RoundCount = value;
              const step = notify(
                {
                  kind: "mark",
                  target: c.target,
                  name: "Global_RoundCount",
                  value,
                },
                c,
              );
              if (step) return step;
              break;
            }
            case 5:
              return {
                kind: "operation",
                operation: {
                  name: "play-phases",
                  data: { target: c.target, phases: [] },
                },
                continuation: c,
              };
            case 6:
              return { kind: "return", value: false };
            case 7:
              return {
                kind: "operation",
                operation: { name: "turn-over", data: { target: c.target } },
                continuation: c,
              };
            case 8:
              return {
                kind: "operation",
                operation: { name: "free-chain", data: null },
                continuation: c,
              };
            case 9:
              return { kind: "return", value: false };
            default:
              throw Error("Invalid TurnStart continuation");
          }
      },
    },
    {
      name: "enter-battle-royal",
      run: ({ game, continuation }): OperationStep => {
        type Battle = { stage: number; players: string[]; index: number };
        if (continuation === null && tag(game, "BattleRoyalMode"))
          return { kind: "return", value: null };
        const c: Battle =
          continuation === null
            ? { stage: 0, players: [], index: 0 }
            : (structuredClone(continuation) as Battle);
        while (true)
          switch (c.stage++) {
            case 0: {
              const step = notify({ kind: "battle-lightbox" }, c);
              if (step) return step;
              break;
            }
            case 1: {
              const step = notify({ kind: "battle-log" }, c);
              if (step) return step;
              break;
            }
            case 2: {
              damageRoomTags(game).BattleRoyalMode = true;
              const step = notify({ kind: "battle-start" }, c);
              if (step) return step;
              break;
            }
            case 3:
              c.players = livingPlayers(game);
              break;
            case 4: {
              while (c.index < c.players.length) {
                const target = c.players[c.index++];
                generalMark(game, target, "GlobalBattleRoyalMode");
                game.playerMarks[target].GlobalBattleRoyalMode = 1;
                const step = notify(
                  {
                    kind: "mark",
                    target,
                    name: "GlobalBattleRoyalMode",
                    value: 1,
                  },
                  c,
                );
                if (step) {
                  c.stage = 4;
                  return step;
                }
              }
              return { kind: "return", value: null };
            }
            default:
              throw Error("Invalid BattleRoyal continuation");
          }
      },
    },
    {
      name: "turn-over",
      validate: (game, op) => {
        turnOverTarget(game, op.data);
      },
      run: ({ game, operation, continuation }): OperationStep => {
        const c: Cursor =
          continuation === null
            ? { target: turnOverTarget(game, operation.data), stage: 0 }
            : (structuredClone(continuation) as Cursor);
        while (true)
          switch (c.stage++) {
            case 0: {
              game.faceUp[c.target] = !game.faceUp[c.target];
              const step = notify(
                {
                  kind: "face-up",
                  target: c.target,
                  value: game.faceUp[c.target],
                },
                c,
              );
              if (step) return step;
              break;
            }
            case 1: {
              const step = notify(
                {
                  kind: "turn-over",
                  target: c.target,
                  faceUp: game.faceUp[c.target],
                },
                c,
              );
              if (step) return step;
              break;
            }
            case 2:
              return {
                kind: "event",
                event: { name: "TurnedOver", target: c.target, data: null },
                continuation: c,
              };
            case 3:
              return { kind: "return", value: null };
            default:
              throw Error("Invalid turn-over continuation");
          }
      },
    },
  ];
}
function turnOverTarget(game: TurnStartGame, data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.target !== "string" ||
    !game.seatOrder.includes(data.target) ||
    typeof game.faceUp?.[data.target] !== "boolean"
  )
    throw Error("Invalid turn-over target");
  return data.target;
}
