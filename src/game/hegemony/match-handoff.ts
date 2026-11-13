import type { HegemonyMatch, HegemonyRoom } from "./match";
import type { NormalTurnGame } from "./turn-order";
import { createMatchTurn, type TurnMatch } from "./match-turn";
import type { TriggerRegistry } from "./scheduler";
import { createTurnStartRule } from "./turn-start";
import { createPhaseCleanupRule } from "./phase-cleanup";
import { createPhaseBodyRule } from "./phase-bodies";
import { LIMIT_METHODS } from "./phase-state";
import { readPhase } from "./phases";
import { readSlashInteger } from "./slash";

export type BattleRoom = HegemonyRoom &
  NormalTurnGame & {
    currentPlayer: string;
    engineCardFlags: Record<number, string[]>;
  };
type RoomMatch = Extract<HegemonyMatch, { phase: "room" }>;
export type BattleHandoff = Omit<
  RoomMatch,
  "schemaVersion" | "phase" | "room" | "scheduler" | "startup"
> &
  TurnMatch<BattleRoom> & {
    schemaVersion: "hegemony-match-v3";
    phase: "battle";
    startup: { stage: "complete" };
    battleSettings: {
      registryVersion: string;
      stepBudget: number;
      physicalIds: number[];
    };
  };

/** Consumes a validated, idle startup candidate. Full v3 restore/routing remain separate. */
export function handoffMatchTurn(
  prepared: RoomMatch,
  registry: TriggerRegistry<BattleRoom>,
  physicalIds: readonly number[],
): BattleHandoff {
  const owner = createMatchTurn(registry);
  const ids = [...physicalIds],
    skills = registry.skills.map((s) => s.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !Number.isSafeInteger(id) || id < 0) ||
    new Set(skills).size !== skills.length ||
    skills.includes("game-rule-draw-phase")
  )
    throw Error("Invalid battle handoff catalogue/table");
  for (const expected of [
    createTurnStartRule(),
    createPhaseCleanupRule(),
    createPhaseBodyRule(),
  ]) {
    const actual = registry.skills.find((s) => s.id === expected.id);
    if (
      !actual ||
      actual.rule !== true ||
      actual.priority !== 0 ||
      expected.events.some((event) => !actual.events.includes(event))
    )
      throw Error("Missing battle core rule");
  }
  const { room: source, scheduler } = prepared;
  if (
    prepared.schemaVersion !== "hegemony-match-v2" ||
    prepared.phase !== "room" ||
    "setup" in prepared ||
    "deck" in prepared ||
    "turn" in prepared ||
    prepared.rulesVersion !== "hegemony-ce4e62b" ||
    !prepared.contentVersion ||
    !prepared.registryVersion ||
    prepared.startup.stage !== "complete" ||
    !source ||
    source.gameResult !== null ||
    !scheduler ||
    scheduler.registryVersion !== `${prepared.registryVersion}:startup-full` ||
    registry.version === scheduler.registryVersion ||
    registry.version === `${prepared.registryVersion}:startup-global` ||
    !Array.isArray(scheduler.frames) ||
    scheduler.frames.length ||
    scheduler.prompt ||
    scheduler.interruption ||
    scheduler.unwind ||
    scheduler.yielded ||
    scheduler.unwindCompletion ||
    scheduler.operationCompletion
  )
    throw Error("Invalid startup handoff boundary");
  const players = source.seatOrder,
    currentPlayer = source.currentPlayer;
  if (
    !Array.isArray(players) ||
    players.length < 2 ||
    players.length > 10 ||
    players.some((p) => typeof p !== "string" || !p) ||
    new Set(players).size !== players.length ||
    typeof currentPlayer !== "string" ||
    !players.includes(currentPlayer) ||
    players.some((p) => source.playerPhases[p] !== "not-active")
  )
    throw Error("Invalid startup handoff actors/phases");
  const completion = scheduler.completion;
  if (
    !completion ||
    completion.event.name !== "GameStart" ||
    (completion.event.target !== null &&
      !players.includes(completion.event.target)) ||
    typeof completion.consumed !== "boolean" ||
    !/^event-[1-9][0-9]*$/.test(completion.eventId) ||
    Number(completion.eventId.slice(6)) >= scheduler.nextId
  )
    throw Error("Invalid startup handoff completion");
  const physical = Object.values(source.cardZones).flatMap((z) => z.cards),
    wrapped = source.wrappedCards;
  if (
    !wrapped ||
    new Set(physical).size !== physical.length ||
    physical.some((id) => !ids.includes(id) || !wrapped[id]) ||
    Object.keys(wrapped).some(
      (key) => String(Number(key)) !== key || !ids.includes(Number(key)),
    )
  )
    throw Error("Invalid startup handoff inventory");
  const perSeat = <T>(value: () => T) =>
    Object.fromEntries(prepared.room.seatOrder.map((p) => [p, value()]));
  const prior: HegemonyRoom & Partial<Omit<BattleRoom, keyof HegemonyRoom>> =
    prepared.room;
  const additions = {
    currentPlayer,
    faceUp: prior.faceUp === undefined ? perSeat(() => true) : prior.faceUp,
    phaseQueues:
      prior.phaseQueues === undefined
        ? perSeat(() => ({ phases: [], states: [], index: 0 }))
        : prior.phaseQueues,
    playerIntMarks:
      prior.playerIntMarks === undefined
        ? perSeat(() => ({}))
        : prior.playerIntMarks,
    playerStringMarks:
      prior.playerStringMarks === undefined
        ? perSeat(() => ({}))
        : prior.playerStringMarks,
    cardLimitations:
      prior.cardLimitations === undefined
        ? perSeat(() => ({}))
        : prior.cardLimitations,
    turnOrder:
      prior.turnOrder === undefined
        ? { stage: "regular" as const, anchor: null }
        : prior.turnOrder,
    engineCardFlags:
      prior.engineCardFlags === undefined
        ? Object.fromEntries(ids.map((id) => [id, [] as string[]]))
        : prior.engineCardFlags,
  };
  function record(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function seatMap(value: unknown, valid: (v: unknown) => boolean) {
    return (
      record(value) &&
      Object.keys(value).length === players.length &&
      players.every(
        (p) =>
          Object.prototype.hasOwnProperty.call(value, p) && valid(value[p]),
      )
    );
  }
  const strings = (value: unknown) =>
    Array.isArray(value) && value.every((v) => typeof v === "string");
  if (
    !seatMap(additions.faceUp, (v) => typeof v === "boolean") ||
    !seatMap(
      additions.playerIntMarks,
      (v) =>
        record(v) &&
        Object.values(v).every(
          (a) => Array.isArray(a) && a.every((n) => readSlashInteger(n) === n),
        ),
    ) ||
    !seatMap(
      additions.playerStringMarks,
      (v) => record(v) && Object.values(v).every(strings),
    ) ||
    !seatMap(
      additions.cardLimitations,
      (v) =>
        record(v) &&
        Object.keys(v).every(
          (key) =>
            LIMIT_METHODS.some((method) => method === key) &&
            (v[key] === undefined || strings(v[key])),
        ),
    ) ||
    !seatMap(additions.phaseQueues, (v) => {
      if (
        !record(v) ||
        !Array.isArray(v.phases) ||
        !Array.isArray(v.states) ||
        !Number.isSafeInteger(v.index) ||
        typeof v.index !== "number" ||
        v.index < 0 ||
        v.index > v.phases.length ||
        v.states.length !== v.phases.length
      )
        return false;
      v.phases.forEach(readPhase);
      return v.states.every((s) => {
        if (
          !record(s) ||
          typeof s.finished !== "boolean" ||
          typeof s.phase !== "string"
        )
          return false;
        readPhase(s.phase);
        return true;
      });
    }) ||
    !record(additions.turnOrder) ||
    additions.turnOrder.stage !== "regular" ||
    additions.turnOrder.anchor !== null ||
    !record(additions.engineCardFlags) ||
    Object.keys(additions.engineCardFlags).length !== ids.length ||
    ids.some((id) => !strings(additions.engineCardFlags[id]))
  )
    throw Error("Invalid startup battle ledgers");
  const candidate: BattleHandoff = {
    schemaVersion: "hegemony-match-v3",
    phase: "battle",
    rulesVersion: prepared.rulesVersion,
    contentVersion: prepared.contentVersion,
    registryVersion: prepared.registryVersion,
    startupSettings: structuredClone(prepared.startupSettings),
    startupGlobals: [...prepared.startupGlobals],
    startup: { stage: "complete" },
    battleSettings: {
      registryVersion: registry.version,
      stepBudget: registry.stepBudget!,
      physicalIds: [...ids],
    },
    room: { ...source, ...additions },
    scheduler: {
      ...scheduler,
      registryVersion: registry.version,
      completion: null,
      operationCompletion: null,
    },
    turn: { stage: "normal", waiting: false },
  };
  owner.validate(candidate);
  const room = Object.assign(source, additions);
  scheduler.registryVersion = registry.version;
  scheduler.completion = null;
  scheduler.operationCompletion = null;
  return { ...candidate, room, scheduler };
}
