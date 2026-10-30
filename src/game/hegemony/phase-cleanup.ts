import { damageRoomTags } from "./damage";
import { allPlayers } from "./damage-rule";
import { deathOrder } from "./death";
import { hasShownGeneral, type GeneralGame } from "./general-identity";
import { readPhase } from "./phases";
import { readSlashInteger } from "./slash";
import { readRecipientFlags, type CardEffect } from "./card-effect";
import {
  ledgerPlayer,
  clearRoomCardLimitations,
  type RoomLedgerGame,
  type PhaseStateRules,
  type PhaseStateNotice,
} from "./phase-state";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerSkill,
} from "./scheduler";
export type PhaseCleanupGame = GeneralGame &
  RoomLedgerGame & { playerPhases: Record<string, string> };
export interface PhaseCleanupRules<
  G extends PhaseCleanupGame,
> extends PhaseStateRules {
  skillExists: (name: string) => boolean;
  /** Native hasSkill(name, true), with live package/global/ViewHas policy supplied explicitly. */
  hasSkill: (game: Readonly<G>, target: string, name: string) => boolean;
  imperialCard: (game: Readonly<G>, id: number) => CardEffect["card"] | null;
}
function history(game: PhaseCleanupGame, target: string, name: string) {
  const ledger = game.playerHistory?.[target];
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger))
    throw Error("Invalid phase history");
  if (name === ".") for (const key of Object.keys(ledger)) delete ledger[key];
  else delete ledger[name];
}
const EVENTS = ["EventPhaseStart", "EventPhaseEnd", "EventPhaseChanging"];
function input(game: PhaseCleanupGame, data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.event !== "string" ||
    !EVENTS.includes(data.event)
  )
    throw Error("Invalid phase rule input");
  const tags = damageRoomTags(game);
  if (tags.SkipGameRule !== undefined && typeof tags.SkipGameRule !== "boolean")
    throw Error("Invalid SkipGameRule");
  if (tags.SkipGameRule === true || data.target === null) return null;
  const target = ledgerPlayer(game, data.target);
  readPhase(game.playerPhases[target]);
  return { event: data.event, target, data: data.data ?? null };
}
export function createPhaseCleanupRule<
  G extends PhaseCleanupGame,
>(): TriggerSkill<G> {
  return {
    id: "game-rule-phase-cleanup",
    events: EVENTS,
    priority: 0,
    rule: true,
    effect: ({ event, operationChild }) =>
      operationChild
        ? { kind: "done", value: false }
        : {
            kind: "operation",
            operation: {
              name: "phase-cleanup",
              data: {
                event: event.name,
                target: event.target,
                data: event.data,
              },
            },
            continuation: true,
          },
  };
}
export function createPhaseCleanupOperations<G extends PhaseCleanupGame>(
  rules: PhaseCleanupRules<G>,
): OperationHandler<G>[] {
  function notice(
    value: PhaseStateNotice,
    c: TriggerData,
  ): OperationStep | null {
    const op = rules.notify(value);
    return op ? { kind: "operation", operation: op, continuation: c } : null;
  }
  function marks(
    target: string,
    suffix: string,
    numeric: boolean,
    c: TriggerData,
  ): OperationStep {
    return {
      kind: "operation",
      operation: {
        name: numeric ? "clear-numeric-marks" : "clear-player-marks",
        data: { target, suffix },
      },
      continuation: c,
    };
  }
  type Cursor = {
    target: string;
    data: TriggerData;
    stage: number;
    players: string[];
    index: number;
    card: CardEffect["card"] | null;
    removedChanged?: boolean;
  };
  function cursor(game: G, data: TriggerData): Cursor {
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw Error("Invalid phase cleanup input");
    return {
      target: ledgerPlayer(game, data.target),
      data: structuredClone(data.data ?? null),
      stage: 0,
      players: [],
      index: 0,
      card: null,
    };
  }
  const root: OperationHandler<G> = {
    name: "phase-cleanup",
    validate: (game, op) => {
      input(game, op.data);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: false };
      const parsed = input(game, operation.data),
        tags = damageRoomTags(game);
      if (tags.SkipGameRule === true) delete tags.SkipGameRule;
      if (!parsed) return { kind: "return", value: false };
      const name =
        parsed.event === "EventPhaseChanging"
          ? "phase-changing-cleanup"
          : parsed.event === "EventPhaseEnd"
            ? "phase-end-cleanup"
            : "phase-start-cleanup";
      return {
        kind: "operation",
        operation: { name, data: { target: parsed.target, data: parsed.data } },
        continuation: true,
      };
    },
  };
  const changing: OperationHandler<G> = {
    name: "phase-changing-cleanup",
    run: ({ game, operation, continuation }): OperationStep => {
      const c =
        continuation === null
          ? cursor(game, operation.data)
          : (structuredClone(continuation) as Cursor);
      while (true)
        switch (c.stage++) {
          case 0: {
            const n = notice(
              { kind: "history", target: null, name: "pushPile", times: 1 },
              c,
            );
            if (n) return n;
            break;
          }
          case 1:
            c.players = deathOrder(game);
            c.index = 0;
            break;
          case 2:
            if (c.index < c.players.length) {
              c.stage = 2;
              return marks(c.players[c.index++], "-PhaseClear", true, c);
            }
            break;
          case 3: {
            if (!c.data || typeof c.data !== "object" || Array.isArray(c.data))
              throw Error("Invalid phase change data");
            const to = readPhase(c.data.to);
            if (to === "not-active") {
              c.players = deathOrder(game);
              c.index = 0;
              break;
            }
            c.stage = 9;
            if (to === "play" || to === "start") {
              const name = to === "play" ? "." : "Analeptic";
              history(game, c.target, name);
              const n = notice(
                {
                  kind: "history",
                  target: c.target,
                  name,
                  times: to === "play" ? 1 : 0,
                },
                c,
              );
              if (n) return n;
            }
            break;
          }
          case 4:
            if (c.index < c.players.length) {
              c.stage = 4;
              return marks(c.players[c.index++], "-Clear", true, c);
            }
            break;
          case 5: {
            const pending = game.imperialOrder;
            if (pending === undefined || pending.invoke === false) {
              c.stage = 9;
              break;
            }
            if (
              typeof pending.invoke !== "boolean" ||
              !Number.isSafeInteger(pending.cardID) ||
              pending.cardID < 0
            )
              throw Error("Invalid ImperialOrder state");
            pending.invoke = false;
            const n = notice(
              { kind: "log", target: c.target, name: "imperial-order" },
              c,
            );
            if (n) return n;
            break;
          }
          case 6: {
            c.card = game.imperialOrder
              ? structuredClone(
                  rules.imperialCard(
                    structuredClone(game),
                    game.imperialOrder.cardID,
                  ),
                )
              : null;
            if (c.card === null) {
              c.stage = 9;
              break;
            }
            c.players = allPlayers(game);
            c.index = 0;
            break;
          }
          case 7:
            while (c.index < c.players.length) {
              const target = c.players[c.index++];
              if (hasShownGeneral(game, target)) continue;
              c.stage = 7;
              return {
                kind: "operation",
                operation: {
                  name: "imperial-order-effect",
                  data: {
                    from: null,
                    to: target,
                    card: c.card,
                    multiple: false,
                    nullified: false,
                    disresponsive: false,
                  },
                },
                continuation: c,
              };
            }
            // Approved no-treasure policy: never synthesize/reinsert ImperialEdict here.
            return { kind: "return", value: null };
          case 9:
            return { kind: "return", value: null };
          default:
            throw Error("Invalid phase-changing continuation");
        }
    },
  };
  const end: OperationHandler<G> = {
    name: "phase-end-cleanup",
    run: ({ game, operation, continuation }): OperationStep => {
      const c =
        continuation === null
          ? cursor(game, operation.data)
          : (structuredClone(continuation) as Cursor);
      while (true)
        switch (c.stage++) {
          case 0:
            if (game.playerPhases[c.target] === "play") {
              history(game, c.target, ".");
              const n = notice(
                { kind: "history", target: c.target, name: ".", times: 1 },
                c,
              );
              if (n) return n;
            }
            break;
          case 1:
            if (game.playerPhases[c.target] === "finish") {
              history(game, c.target, "Analeptic");
              const n = notice(
                {
                  kind: "history",
                  target: c.target,
                  name: "Analeptic",
                  times: 0,
                },
                c,
              );
              if (n) return n;
            } else c.stage = 4;
            break;
          case 2:
            c.players = allPlayers(game);
            c.index = 0;
            break;
          case 3:
            if (c.index < c.players.length) {
              const target = c.players[c.index++];
              c.stage = 3;
              game.playerMarks[target].multi_kill_count = 0;
              const n = notice(
                {
                  kind: "mark",
                  target,
                  name: "multi_kill_count",
                  type: "number",
                  value: 0,
                },
                c,
              );
              if (n) return n;
            } else c.stage = 4;
            break;
          case 4:
            c.players = deathOrder(game);
            c.index = 0;
            break;
          case 5:
            if (c.index < c.players.length) {
              c.stage = 5;
              return marks(c.players[c.index++], "-phase", false, c);
            }
            return { kind: "return", value: null };
          default:
            throw Error("Invalid phase-end continuation");
        }
    },
  };
  const start: OperationHandler<G> = {
    name: "phase-start-cleanup",
    run: ({ game, operation, continuation }): OperationStep => {
      const c =
        continuation === null
          ? cursor(game, operation.data)
          : (structuredClone(continuation) as Cursor);
      while (true)
        switch (c.stage++) {
          case 0:
            if (game.playerPhases[c.target] !== "not-active")
              return { kind: "return", value: null };
            c.players = deathOrder(game);
            c.index = 0;
            break;
          case 1: {
            if (c.index === c.players.length)
              return { kind: "return", value: null };
            const target = c.players[c.index];
            readRecipientFlags(game, target);
            game.playerFlags[target] = [];
            const n = notice({ kind: "flags", target, value: "." }, c);
            if (n) return n;
            break;
          }
          case 2: {
            const target = c.players[c.index];
            if (readSlashInteger(game.playerMarks[target].drank, 0) > 0) {
              const n = notice({ kind: "log", target, name: "unset-drank" }, c);
              if (n) return n;
            } else c.stage = 4;
            break;
          }
          case 3: {
            const target = c.players[c.index];
            game.playerMarks[target].drank = 0;
            const n = notice(
              { kind: "mark", target, name: "drank", type: "number", value: 0 },
              c,
            );
            if (n) return n;
            break;
          }
          case 4:
            return marks(c.players[c.index], "-turn", false, c);
          case 5: {
            const target = c.players[c.index];
            clearRoomCardLimitations(game, target, true);
            const n = notice(
              { kind: "limitations", target, singleTurn: true },
              c,
            );
            if (n) return n;
            break;
          }
          case 6: {
            const target = c.players[c.index];
            if (typeof game.removed[target] !== "boolean")
              throw Error("Invalid phase removed state");
            c.removedChanged = game.removed[target];
            if (c.removedChanged) {
              game.removed[target] = false;
              const n = notice({ kind: "removed", target, value: false }, c);
              if (n) return n;
            }
            break;
          }
          case 7:
            if (c.removedChanged)
              return {
                kind: "event",
                event: {
                  name: "RemoveStateChanged",
                  target: c.players[c.index],
                  data: null,
                },
                continuation: c,
              };
            break;
          case 8: {
            const target = c.players[c.index],
              tags = damageRoomTags(game),
              key = "TurnSkillsFor" + target,
              list = tags[key] ?? [];
            if (
              !Array.isArray(list) ||
              list.some((name) => typeof name !== "string")
            )
              throw Error("Invalid turn skill list");
            delete tags[key];
            const skills: string[] = [];
            for (const name of list) {
              const exists = rules.skillExists(name as string);
              if (typeof exists !== "boolean")
                throw Error("Invalid skill metadata");
              if (!exists) continue;
              const has = rules.hasSkill(
                structuredClone(game),
                target,
                name as string,
              );
              if (typeof has !== "boolean")
                throw Error("Invalid skill ownership predicate");
              if (has) skills.push("-" + name);
            }
            if (skills.length)
              return {
                kind: "operation",
                operation: {
                  name: "room-skill-batch",
                  data: { target, skills, acquireOnly: false },
                },
                continuation: c,
              };
            break;
          }
          case 9:
            c.index++;
            c.stage = 1;
            break;
          default:
            throw Error("Invalid phase-start continuation");
        }
    },
  };
  return [root, changing, end, start];
}
