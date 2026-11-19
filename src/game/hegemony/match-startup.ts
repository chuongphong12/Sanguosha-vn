import type { HegemonyRoom } from "./match-room";
import {
  dispatchTriggerEvent,
  dispatchTriggerOperation,
  type TriggerRegistry,
  type TriggerScheduler,
} from "./scheduler";

export type MatchStartup =
  | { stage: "winner"; waiting: boolean }
  | { stage: "global"; waiting: boolean }
  | { stage: "over"; winner: string; waiting: boolean }
  | { stage: "players"; index: number; waiting: boolean }
  | { stage: "complete" };

export interface StartupMatch {
  room: HegemonyRoom;
  scheduler: TriggerScheduler;
  startup: MatchStartup;
}

/** Two immutable executable tables; only the application's persisted cursor changes. */
export function createMatchStartup(
  global: TriggerRegistry<HegemonyRoom>,
  full: TriggerRegistry<HegemonyRoom>,
  hasPlayerStartup: (room: Readonly<HegemonyRoom>, player: string) => boolean,
) {
  function registry(startup: MatchStartup) {
    return startup.stage === "players" || startup.stage === "complete"
      ? full
      : global;
  }

  function validate(match: StartupMatch) {
    const cursor = match.startup;
    if (
      !cursor ||
      !["winner", "global", "players", "over", "complete"].includes(
        cursor.stage,
      ) ||
      (cursor.stage !== "complete" && typeof cursor.waiting !== "boolean") ||
      (cursor.stage === "players" &&
        (!Number.isSafeInteger(cursor.index) ||
          cursor.index < 0 ||
          cursor.index > match.room.seatOrder.length)) ||
      (cursor.stage === "over" && typeof cursor.winner !== "string") ||
      !match.scheduler ||
      match.scheduler.registryVersion !== registry(cursor).version
    )
      throw new Error("Invalid match startup cursor/registry");
    if (
      !Array.isArray(match.scheduler.frames) ||
      (cursor.stage !== "complete" &&
        !cursor.waiting &&
        (match.scheduler.frames.length ||
          match.scheduler.prompt ||
          match.scheduler.interruption)) ||
      (cursor.stage === "complete" &&
        (match.scheduler.frames.length ||
          match.scheduler.prompt ||
          match.scheduler.interruption))
    )
      throw new Error("Invalid match startup boundary");
    const root = match.scheduler.frames[0];
    if (match.scheduler.prompt && !root)
      throw new Error("Invalid match startup root");
    if (root && cursor.stage !== "complete") {
      const operation = cursor.stage === "winner" ? "get-winner" : "game-over";
      const target =
        cursor.stage === "global"
          ? null
          : cursor.stage === "players"
            ? match.room.seatOrder[cursor.index]
            : null;
      if (
        cursor.stage === "winner" || cursor.stage === "over"
          ? root.kind !== "operation" || root.operation.name !== operation
          : root.kind !== "event" ||
            root.event.name !== "GameStart" ||
            root.event.target !== target
      )
        throw new Error("Invalid match startup root");
    }
  }

  function advance(match: StartupMatch) {
    validate(match);
    while (true) {
      const { room, scheduler, startup: cursor } = match;
      if (
        room.gameResult !== null ||
        scheduler.interruption ||
        scheduler.prompt ||
        scheduler.frames.length ||
        cursor.stage === "complete"
      )
        return;
      if (cursor.waiting) {
        if (cursor.stage === "winner") {
          const result = scheduler.operationCompletion;
          if (
            result?.operation.name !== "get-winner" ||
            (result.value !== null && typeof result.value !== "string")
          )
            throw new Error("Invalid initial winner completion");
          match.startup =
            result.value === null
              ? { stage: "global", waiting: false }
              : { stage: "over", winner: result.value, waiting: false };
        } else if (cursor.stage === "global" || cursor.stage === "players") {
          const event = scheduler.completion?.event;
          const target =
            cursor.stage === "global" ? null : room.seatOrder[cursor.index];
          if (event?.name !== "GameStart" || event.target !== target)
            throw new Error("Invalid match startup event completion");
          if (cursor.stage === "global") {
            // The global root is fully idle. Retain nextId and all Room facts.
            match.startup = { stage: "players", index: 0, waiting: false };
            scheduler.registryVersion = full.version;
          } else
            match.startup = {
              stage: "players",
              index: cursor.index + 1,
              waiting: false,
            };
        } else throw new Error("Initial game-over must interrupt");
        continue;
      }
      if (cursor.stage === "players") {
        if (cursor.index === room.seatOrder.length) {
          match.startup = { stage: "complete" };
          return;
        }
        const eligible = hasPlayerStartup(
          structuredClone(room),
          room.seatOrder[cursor.index],
        );
        if (typeof eligible !== "boolean")
          throw new Error("Invalid player startup eligibility");
        if (!eligible) {
          cursor.index++;
          continue;
        }
      }
      cursor.waiting = true;
      const table = registry(cursor);
      const accepted =
        cursor.stage === "winner" || cursor.stage === "over"
          ? dispatchTriggerOperation(
              scheduler,
              room,
              table,
              {
                name: cursor.stage === "winner" ? "get-winner" : "game-over",
                data: cursor.stage === "winner" ? null : cursor.winner,
              },
              room.currentPlayer,
            )
          : dispatchTriggerEvent(
              scheduler,
              room,
              table,
              {
                name: "GameStart",
                target:
                  cursor.stage === "global"
                    ? null
                    : room.seatOrder[cursor.index],
                data: null,
              },
              room.currentPlayer,
            );
      if (!accepted) throw new Error("Cannot dispatch match startup stage");
    }
  }

  return { registry, validate, advance };
}
