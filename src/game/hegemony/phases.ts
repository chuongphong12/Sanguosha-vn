import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

const PHASES = [
  "round-start",
  "start",
  "judge",
  "draw",
  "play",
  "discard",
  "finish",
  "not-active",
  "none",
] as const;
export type Phase = (typeof PHASES)[number];
export interface PhaseQueue {
  phases: Phase[];
  states: { phase: Phase; finished: boolean }[];
  index: number;
}
export interface PhaseGame {
  seatOrder: string[];
  alive: Record<string, boolean>;
  playerPhases: Record<string, string>;
  phaseQueues: Record<string, PhaseQueue>;
}
export interface PhaseRules {
  notify: (target: string, phase: Phase) => TriggerOperation | null;
}
export function readPhase(value: TriggerData): Phase {
  if (typeof value !== "string" || !PHASES.includes(value as Phase))
    throw Error("Invalid phase");
  return value as Phase;
}
function target(game: PhaseGame, data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.target !== "string" ||
    !game.seatOrder.includes(data.target) ||
    typeof game.alive[data.target] !== "boolean"
  )
    throw Error("Invalid phase target");
  readPhase(game.playerPhases[data.target]);
  return data.target;
}
function event(
  name: string,
  player: string,
  data: TriggerData,
  continuation: TriggerData,
): OperationStep {
  return { kind: "event", event: { name, target: player, data }, continuation };
}
function chain(continuation: TriggerData): OperationStep {
  return {
    kind: "operation",
    operation: { name: "free-chain", data: null },
    continuation,
  };
}
function readQueue(game: PhaseGame, player: string): PhaseQueue {
  const queue = game.phaseQueues?.[player];
  if (
    !queue ||
    !Array.isArray(queue.phases) ||
    !Array.isArray(queue.states) ||
    !Number.isSafeInteger(queue.index) ||
    queue.index < 0 ||
    queue.states.some((state) => !state || typeof state.finished !== "boolean")
  )
    throw Error("Invalid phase queue");
  queue.phases.forEach(readPhase);
  queue.states.forEach((state) => readPhase(state.phase));
  return queue;
}
/** Returns whether native skip would permit a log; presentation is a package adapter. */
export function skipPhase(
  game: PhaseGame,
  player: string,
  phase: Phase | null,
): boolean {
  target(game, { target: player });
  const queue = readQueue(game, player);
  if (phase === null) {
    queue.states.forEach((state) => {
      state.finished = true;
    });
    return true;
  }
  readPhase(phase);
  const state = queue.states
    .slice(queue.index)
    .find((state) => state.phase === phase);
  if (state?.finished) return false;
  if (state) state.finished = true;
  return true;
}
export function insertPhase(
  game: PhaseGame,
  player: string,
  phase: Phase,
): void {
  target(game, { target: player });
  readPhase(phase);
  const queue = readQueue(game, player),
    index = queue.index + 1;
  if (index > queue.phases.length || index > queue.states.length)
    throw Error("Invalid phase insertion index");
  queue.phases.splice(index, 0, phase);
  queue.states.splice(index, 0, { phase, finished: false });
}
export function isPhaseSkipped(
  game: PhaseGame,
  player: string,
  phase: Phase,
): boolean {
  target(game, { target: player });
  readPhase(phase);
  const queue = readQueue(game, player);
  return (
    queue.states.slice(queue.index).find((state) => state.phase === phase)
      ?.finished ?? false
  );
}
export function createPhaseOperations<G extends PhaseGame>(
  rules: PhaseRules,
): OperationHandler<G>[] {
  type Execute = { target: string; stage: number; consumed: boolean };
  const execute: OperationHandler<G> = {
    name: "execute-phase",
    validate: (game, operation) => {
      target(game, operation.data);
    },
    run: ({ game, operation, continuation, child }): OperationStep => {
      const c: Execute =
        continuation === null
          ? { target: target(game, operation.data), stage: 0, consumed: false }
          : (structuredClone(continuation) as Execute);
      if (c.stage === 1 && child) c.consumed = child.consumed;
      while (true)
        switch (c.stage++) {
          case 0:
            if (game.playerPhases[c.target] === "not-active") c.stage = 7;
            return event("EventPhaseStart", c.target, null, c);
          case 1:
            return chain(c);
          case 2:
            if (!c.consumed)
              return event("EventPhaseProceeding", c.target, null, c);
            c.stage = 4;
            break;
          case 3:
            return chain(c);
          case 4:
            if (game.alive[c.target])
              return event("EventPhaseEnd", c.target, null, c);
            c.stage = 6;
            break;
          case 5:
            return chain(c);
          case 6:
          case 7:
            return { kind: "return", value: null };
          default:
            throw Error("Invalid execute-phase continuation");
        }
    },
  };
  type Change = { target: string; from: Phase; to: Phase; stage: number };
  function changeInput(game: G, data: TriggerData) {
    const player = target(game, data);
    readQueue(game, player);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw Error("Invalid phase change");
    return {
      target: player,
      from: readPhase(data.from),
      to: readPhase(data.to),
      stage: 0,
    };
  }
  const change: OperationHandler<G> = {
    name: "change-phase",
    validate: (game, operation) => {
      changeInput(game, operation.data);
    },
    run: ({ game, operation, continuation, child }): OperationStep => {
      const c: Change =
        continuation === null
          ? changeInput(game, operation.data)
          : (structuredClone(continuation) as Change);
      while (true)
        switch (c.stage++) {
          case 0:
            game.playerPhases[c.target] = "none";
            return event(
              "EventPhaseChanging",
              c.target,
              { from: c.from, to: c.to },
              c,
            );
          case 1: {
            if (child?.consumed && c.to !== "not-active") {
              game.playerPhases[c.target] = c.from;
              return { kind: "return", value: true };
            }
            game.playerPhases[c.target] = c.to;
            const notice = rules.notify(c.target, c.to);
            if (notice)
              return { kind: "operation", operation: notice, continuation: c };
            break;
          }
          case 2:
            readQueue(game, c.target).phases.shift();
            return {
              kind: "operation",
              operation: { name: "execute-phase", data: { target: c.target } },
              continuation: c,
            };
          case 3:
            return { kind: "return", value: false };
          default:
            throw Error("Invalid change-phase continuation");
        }
    },
  };
  type Play = {
    target: string;
    stage: number;
    index: number;
    data: { from: Phase; to: Phase };
    skip: boolean;
  };
  function input(game: G, data: TriggerData) {
    const player = target(game, data);
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      !Array.isArray(data.phases)
    )
      throw Error("Invalid phase sequence");
    const phases = data.phases.map(readPhase);
    readQueue(game, player);
    return { player, phases };
  }
  const play: OperationHandler<G> = {
    name: "play-phases",
    validate: (game, operation) => {
      input(game, operation.data);
    },
    run: ({ game, operation, continuation, child }): OperationStep => {
      let c: Play;
      if (continuation === null) {
        const { player, phases } = input(game, operation.data);
        if (!phases.length) phases.push(...PHASES.slice(0, 8));
        else if (!phases.includes("not-active")) phases.push("not-active");
        game.phaseQueues[player] = {
          phases,
          states: phases.map((phase) => ({ phase, finished: false })),
          index: readQueue(game, player).index,
        };
        c = {
          target: player,
          index: 0,
          stage: 0,
          data: { from: readPhase(game.playerPhases[player]), to: phases[0] },
          skip: false,
        };
      } else c = structuredClone(continuation) as Play;
      if (c.stage === 1 && child) {
        const data = child.event.data;
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw Error("Invalid phase change");
        c.data = { from: readPhase(data.from), to: readPhase(data.to) };
        c.skip = child.consumed;
      }
      if (
        c.stage === 4 &&
        child &&
        !child.consumed &&
        game.phaseQueues[c.target].phases[c.index] !== "not-active"
      ) {
        c.index++;
        c.stage = 0;
      }
      while (true) {
        const queue = game.phaseQueues[c.target];
        switch (c.stage++) {
          case 0:
            if (c.index >= queue.states.length)
              return { kind: "return", value: null };
            if (!game.alive[c.target]) {
              c.stage = 6;
              return {
                kind: "operation",
                operation: {
                  name: "change-phase",
                  data: {
                    target: c.target,
                    from: readPhase(game.playerPhases[c.target]),
                    to: "not-active",
                  },
                },
                continuation: c,
              };
            }
            queue.index = c.index;
            c.data = {
              from: readPhase(game.playerPhases[c.target]),
              to: queue.phases[c.index],
            };
            readPhase(c.data.to);
            game.playerPhases[c.target] = "none";
            return event("EventPhaseChanging", c.target, c.data, c);
          case 1:
            return chain(c);
          case 2: {
            queue.phases[c.index] = queue.states[c.index].phase = c.data.to;
            game.playerPhases[c.target] = c.data.to;
            const notice = rules.notify(c.target, c.data.to);
            if (notice)
              return { kind: "operation", operation: notice, continuation: c };
            break;
          }
          case 3:
            if (c.skip || queue.states[c.index].finished)
              return event("EventPhaseSkipping", c.target, c.data, c);
            break;
          case 4:
            return {
              kind: "operation",
              operation: { name: "execute-phase", data: { target: c.target } },
              continuation: c,
            };
          case 5:
            if (game.playerPhases[c.target] === "not-active")
              return { kind: "return", value: null };
            c.index++;
            c.stage = 0;
            break;
          case 6:
            return { kind: "return", value: null };
          default:
            throw Error("Invalid play-phase continuation");
        }
      }
    },
  };
  return [play, execute, change];
}
