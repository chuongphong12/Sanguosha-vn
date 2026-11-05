import type { NormalTurnGame } from "./turn-order";
import {
  dispatchTriggerOperation,
  continueTriggerWork,
  unwindTriggerInterruption,
  type TriggerInterruption,
  type TriggerRegistry,
  type TriggerScheduler,
} from "./scheduler";

export type MatchTurn =
  | { stage: "normal" | "recovery"; waiting: boolean }
  | {
      stage: "fault";
      reason: "stage-change" | "game-over-without-result";
      interruption: TriggerInterruption;
    }
  | { stage: "finished" };
export interface TurnMatch<G extends NormalTurnGame> {
  room: G;
  scheduler: TriggerScheduler;
  turn: MatchTurn;
}

/** Trusted application owner; actor commands and save validation belong to match-v3. */
export function createMatchTurn<G extends NormalTurnGame>(
  registry: TriggerRegistry<G>,
) {
  const names = registry.operations?.map((op) => op.name) ?? [];
  if (
    !registry.version ||
    registry.unwind !== true ||
    !Number.isSafeInteger(registry.stepBudget) ||
    registry.stepBudget! < 1 ||
    new Set(names).size !== names.length ||
    !names.includes("normal-turn-step") ||
    !names.includes("recover-normal-turn")
  )
    throw Error("Invalid match turn profile");
  function interruption(value: TriggerInterruption | null | undefined) {
    return (
      value &&
      typeof value.id === "string" &&
      value.id.length > 0 &&
      typeof value.eventId === "string" &&
      value.eventId.length > 0 &&
      ["turn-broken", "stage-change", "game-over"].includes(value.reason)
    );
  }
  function validate(match: TurnMatch<G>) {
    const { room, scheduler, turn } = match;
    if (
      !room ||
      !scheduler ||
      !turn ||
      scheduler.registryVersion !== registry.version ||
      JSON.stringify(room.seatOrder) !== JSON.stringify(scheduler.seatOrder) ||
      !Number.isSafeInteger(scheduler.nextId) ||
      scheduler.nextId < 1 ||
      !Array.isArray(scheduler.frames) ||
      (room.gameResult !== null && typeof room.gameResult !== "string")
    )
      throw Error("Invalid match turn registry/state");
    const ids = scheduler.frames.map((f) => f.id);
    if (
      new Set(ids).size !== ids.length ||
      scheduler.frames.some(
        (f) =>
          typeof f.id !== "string" ||
          !new RegExp(`^${f.kind}-[1-9][0-9]*$`).test(f.id) ||
          Number(f.id.split("-").at(-1)) >= scheduler.nextId ||
          (f.kind !== "operation" && f.kind !== "event"),
      )
    )
      throw Error("Invalid match turn frame identity");
    const active =
      scheduler.frames.length > 0 ||
      scheduler.prompt ||
      scheduler.interruption ||
      scheduler.unwind ||
      scheduler.yielded;
    if (turn.stage === "finished" || turn.stage === "fault") {
      if (
        active ||
        scheduler.unwindCompletion ||
        scheduler.operationCompletion ||
        scheduler.completion ||
        (turn.stage === "finished"
          ? typeof room.gameResult !== "string"
          : !interruption(turn.interruption) ||
            (turn.reason === "stage-change"
              ? turn.interruption.reason !== "stage-change"
              : turn.reason !== "game-over-without-result" ||
                turn.interruption.reason !== "game-over" ||
                room.gameResult !== null))
      )
        throw Error("Invalid stopped match turn");
      return;
    }
    if (
      (turn.stage !== "normal" && turn.stage !== "recovery") ||
      typeof turn.waiting !== "boolean"
    )
      throw Error("Invalid match turn cursor");
    if (!turn.waiting) {
      if (
        active ||
        scheduler.operationCompletion ||
        scheduler.completion ||
        scheduler.unwindCompletion
      )
        throw Error("Invalid idle match turn");
      return;
    }
    const root = scheduler.frames[0],
      name =
        turn.stage === "normal" ? "normal-turn-step" : "recover-normal-turn";
    if (root) {
      if (
        root.kind !== "operation" ||
        root.operation.name !== name ||
        root.operation.data !== null ||
        scheduler.operationCompletion ||
        scheduler.unwindCompletion ||
        (!scheduler.prompt && !scheduler.yielded && !scheduler.interruption) ||
        (scheduler.prompt && (scheduler.yielded || scheduler.interruption))
      )
        throw Error("Invalid match turn root/boundary");
      if (
        scheduler.prompt &&
        (scheduler.prompt.frameId !== scheduler.frames.at(-1)?.id ||
          !room.seatOrder.includes(scheduler.prompt.actor))
      )
        throw Error("Invalid match turn prompt");
      if (
        scheduler.interruption &&
        (!interruption(scheduler.interruption) ||
          scheduler.interruption.eventId !== scheduler.frames.at(-1)?.id)
      )
        throw Error("Invalid match turn interruption");
      return;
    }
    // Budget-one unwind may pop the last frame before publishing its completion.
    if (
      scheduler.yielded &&
      scheduler.unwind?.boundary === null &&
      interruption(scheduler.unwind.interruption) &&
      !scheduler.prompt &&
      !scheduler.interruption &&
      !scheduler.operationCompletion &&
      !scheduler.unwindCompletion &&
      !scheduler.completion
    )
      return;
    if (active) throw Error("Invalid empty match turn stack");
    if (scheduler.unwindCompletion) {
      if (
        !interruption(scheduler.unwindCompletion) ||
        scheduler.operationCompletion ||
        scheduler.completion
      )
        throw Error("Invalid match turn unwind completion");
    } else {
      const result = scheduler.operationCompletion;
      if (
        !result ||
        result.operation.name !== name ||
        result.operation.data !== null ||
        (turn.stage === "normal"
          ? typeof result.value !== "string" ||
            !["turn", "advanced", "extra-skipped", "finished"].includes(
              result.value,
            ) ||
            (result.value === "finished" && room.gameResult === null)
          : result.value !== "recovered")
      )
        throw Error("Invalid match turn completion");
    }
  }
  function requireProgress(accepted: boolean): boolean {
    if (!accepted) throw Error("Cannot drive match turn");
    return true;
  }
  function advance(match: TurnMatch<G>): boolean {
    validate(match);
    const { room, scheduler, turn } = match;
    if (turn.stage !== "normal" && turn.stage !== "recovery") return false;
    if (scheduler.interruption)
      return requireProgress(
        unwindTriggerInterruption(
          scheduler,
          room,
          registry,
          structuredClone(scheduler.interruption),
        ),
      );
    if (scheduler.yielded)
      return requireProgress(continueTriggerWork(scheduler, room, registry));
    if (scheduler.prompt || scheduler.frames.length) return false;
    if (scheduler.unwindCompletion) {
      const interruption = structuredClone(scheduler.unwindCompletion);
      scheduler.unwindCompletion = null;
      scheduler.operationCompletion = null;
      scheduler.completion = null;
      match.turn =
        interruption.reason === "turn-broken"
          ? { stage: "recovery", waiting: false }
          : interruption.reason === "game-over" && room.gameResult !== null
            ? { stage: "finished" }
            : {
                stage: "fault",
                reason:
                  interruption.reason === "stage-change"
                    ? "stage-change"
                    : "game-over-without-result",
                interruption,
              };
      return true;
    }
    if (turn.waiting) {
      if (
        scheduler.operationCompletion?.operation.name !==
        (turn.stage === "normal" ? "normal-turn-step" : "recover-normal-turn")
      )
        throw Error("Invalid turn completion");
      scheduler.operationCompletion = null;
      scheduler.completion = null;
      match.turn =
        room.gameResult === null
          ? { stage: "normal", waiting: false }
          : { stage: "finished" };
      return true;
    }
    if (room.gameResult !== null) {
      match.turn = { stage: "finished" };
      return true;
    }
    turn.waiting = true;
    return requireProgress(
      dispatchTriggerOperation(
        scheduler,
        room,
        registry,
        {
          name:
            turn.stage === "normal"
              ? "normal-turn-step"
              : "recover-normal-turn",
          data: null,
        },
        room.currentPlayer,
      ),
    );
  }
  return { validate, advance };
}
