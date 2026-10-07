import type { GeneralSlot } from "./types";

export type TriggerData =
  | null
  | boolean
  | number
  | string
  | TriggerData[]
  | { [key: string]: TriggerData };

export interface TriggerEvent {
  name: string;
  target: string | null;
  data: TriggerData;
}

/** Stable identity is supplied by the package adapter, never by list position. */
export interface TriggerOccurrence {
  actor: string | null;
  owner: string | null;
  slot: GeneralSlot | null;
  target: string | null;
  occurrence: string;
  compulsory?: boolean;
  /** Native Wake is forced when public, but is not auto-selected as Compulsory. */
  wake?: boolean;
  global?: boolean;
  shown?: boolean;
  equipment?: boolean;
  cardSkill?: boolean;
  /** Ordered target occurrences consume the selected target and earlier alternatives. */
  order?: { group: string; index: number };
}

interface Candidate extends TriggerOccurrence {
  skill: string;
  key: string;
}

type TriggerStage = "record" | "cost" | "reveal" | "effect";

export type TriggerStep =
  | { kind: "interrupt"; reason: "turn-broken" | "stage-change" | "game-over" }
  | { kind: "done"; value: boolean }
  | { kind: "event"; event: TriggerEvent; continuation: TriggerData }
  | {
      kind: "prompt";
      actor: string;
      choices: string[];
      canCancel: boolean;
      continuation: TriggerData;
    };

interface ChildResult {
  event: TriggerEvent;
  consumed: boolean;
}

export interface TriggerContext<G> {
  game: G;
  event: TriggerEvent;
  selected: TriggerOccurrence | null;
  continuation: TriggerData;
  answer: { choice: string | null } | null;
  child: ChildResult | null;
}

export interface TriggerSkill<G> {
  id: string;
  events: string[];
  priority: number | ((event: TriggerEvent) => number);
  /** Game/scenario rules run with a null actor, after players in their band. */
  rule?: boolean;
  record?: (context: TriggerContext<G>) => void | TriggerStep;
  triggerable?: (context: TriggerContext<G>) => TriggerOccurrence[];
  cost?: (context: TriggerContext<G>) => TriggerStep;
  reveal?: (context: TriggerContext<G>) => TriggerStep;
  effect: (context: TriggerContext<G>) => TriggerStep;
}

export interface TriggerRegistry<G> {
  version: string;
  skills: TriggerSkill<G>[];
}

interface TriggerFrame {
  id: string;
  event: TriggerEvent;
  actors: (string | null)[];
  bands: { priority: number; skills: string[] }[];
  band: number;
  actor: number;
  recorded: boolean;
  recordCursor: number;
  candidates: Candidate[];
  consumed: string[];
  consumedPrefixes: Record<string, number>;
  selected: Candidate | null;
  stage: TriggerStage;
  continuation: TriggerData;
  answer: { choice: string | null } | null;
  child: ChildResult | null;
}

export interface TriggerScheduler {
  registryVersion: string;
  seatOrder: string[];
  nextId: number;
  frames: TriggerFrame[];
  prompt: TriggerPrompt | null;
  /** Frames remain available to the later operation-specific unwind pipeline. */
  interruption: {
    reason: "turn-broken" | "stage-change" | "game-over";
    eventId: string;
  } | null;
  completion: {
    eventId: string;
    event: TriggerEvent;
    consumed: boolean;
  } | null;
}

export interface TriggerPrompt {
  id: string;
  frameId: string;
  actor: string;
  kind: "order" | "step";
  choices: {
    id: string;
    skill: string;
    owner: string | null;
    slot: GeneralSlot | null;
    target: string | null;
  }[];
  canCancel: boolean;
}

export function createTriggerScheduler(
  seatOrder: string[],
  registryVersion: string,
): TriggerScheduler {
  if (
    !seatOrder.length ||
    new Set(seatOrder).size !== seatOrder.length ||
    !registryVersion
  ) {
    throw new Error("Invalid trigger scheduler configuration");
  }
  return {
    registryVersion,
    seatOrder: [...seatOrder],
    nextId: 1,
    frames: [],
    prompt: null,
    interruption: null,
    completion: null,
  };
}

function occurrenceKey(skill: string, occurrence: TriggerOccurrence): string {
  return JSON.stringify([
    skill,
    occurrence.actor,
    occurrence.owner,
    occurrence.slot,
    occurrence.target,
    occurrence.occurrence,
  ]);
}

function orderGroupKey(candidate: TriggerOccurrence, skill: string): string {
  return JSON.stringify([
    skill,
    candidate.actor,
    candidate.owner,
    candidate.slot,
    candidate.order?.group,
  ]);
}

function selectOccurrence(frame: TriggerFrame, selected: Candidate): void {
  frame.selected = selected;
  frame.consumed.push(selected.key);
  if (selected.order)
    frame.consumedPrefixes[orderGroupKey(selected, selected.skill)] =
      selected.order.index;
  frame.stage = "cost";
}

function collectCandidates<G>(
  frame: TriggerFrame,
  game: G,
  registry: TriggerRegistry<G>,
  skills: string[] = frame.bands[frame.band].skills,
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const id of skills) {
    const skill = registry.skills.find((skill) => skill.id === id)!;
    const context = {
      game,
      event: frame.event,
      selected: null,
      continuation: null,
      answer: null,
      child: null,
    };
    const occurrences = skill.rule
      ? [
          {
            actor: null,
            owner: null,
            slot: null,
            target: frame.event.target,
            occurrence: "rule",
          },
        ]
      : (skill.triggerable?.(context) ?? []);
    for (const occurrence of occurrences) {
      if (occurrence.actor !== null && !frame.actors.includes(occurrence.actor))
        throw new Error("Unknown trigger actor");
      const key = occurrenceKey(id, occurrence);
      const prefix = frame.consumedPrefixes[orderGroupKey(occurrence, id)];
      if (
        !frame.consumed.includes(key) &&
        (!occurrence.order ||
          prefix === undefined ||
          occurrence.order.index > prefix)
      )
        candidates.push({ ...structuredClone(occurrence), skill: id, key });
    }
  }
  return candidates;
}

function clearStep(frame: TriggerFrame): void {
  frame.continuation = null;
  frame.answer = null;
  frame.child = null;
}

function reconcileCandidates<G>(
  frame: TriggerFrame,
  game: G,
  registry: TriggerRegistry<G>,
): Candidate[] {
  const keys = new Set(frame.candidates.map((candidate) => candidate.key));
  return collectCandidates(frame, game, registry).filter((candidate) =>
    keys.has(candidate.key),
  );
}

function assertTriggerData(
  value: TriggerData,
  ancestors = new Set<object>(),
): void {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || ancestors.has(value))
    throw new Error("Invalid trigger data");
  const prototype = Object.getPrototypeOf(value);
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  )
    throw new Error("Invalid trigger data");
  if (Object.getOwnPropertySymbols(value).length)
    throw new Error("Invalid trigger data");
  ancestors.add(value);
  for (const entry of Array.isArray(value) ? value : Object.values(value))
    assertTriggerData(entry, ancestors);
  ancestors.delete(value);
}

function advanceActor(frame: TriggerFrame): void {
  frame.actor++;
  if (frame.actor === frame.actors.length) {
    frame.band++;
    frame.actor = 0;
    frame.recorded = false;
    frame.recordCursor = 0;
    frame.candidates = [];
    frame.stage = "record";
  }
}

function invokeTriggerHandler<G>(
  frame: TriggerFrame,
  game: G,
  handler: ((context: TriggerContext<G>) => void | TriggerStep) | undefined,
): void | TriggerStep {
  const previousData = structuredClone(frame.event.data);
  try {
    const result = handler?.({
      game,
      event: frame.event,
      selected: frame.selected,
      continuation: frame.continuation,
      answer: frame.answer,
      child: frame.child,
    });
    assertTriggerData(frame.event.data);
    return result;
  } catch (error) {
    frame.event.data = previousData;
    throw error;
  }
}

function yieldTriggerStep<G>(
  scheduler: TriggerScheduler,
  frame: TriggerFrame,
  registry: TriggerRegistry<G>,
  skill: string,
  result: TriggerStep,
): boolean {
  if (result.kind === "done") return false;
  if (result.kind === "interrupt") {
    scheduler.interruption = { reason: result.reason, eventId: frame.id };
    return true;
  }
  if (
    result.kind === "prompt" &&
    (!scheduler.seatOrder.includes(result.actor) ||
      !result.choices.length ||
      new Set(result.choices).size !== result.choices.length)
  )
    throw new Error("Invalid trigger prompt");
  assertTriggerData(result.continuation);
  frame.continuation = structuredClone(result.continuation);
  frame.answer = null;
  frame.child = null;
  if (result.kind === "event") {
    scheduler.frames.push(
      createEventFrame(scheduler, registry, result.event, frame.actors[0]),
    );
  } else {
    scheduler.prompt = {
      id: `prompt-${scheduler.nextId++}`,
      frameId: frame.id,
      actor: result.actor,
      kind: "step",
      canCancel: result.canCancel,
      choices: result.choices.map((id) => ({
        id,
        skill,
        owner: frame.selected?.owner ?? null,
        slot: frame.selected?.slot ?? null,
        target: frame.selected?.target ?? frame.event.target,
      })),
    };
  }
  return true;
}

function completeFrame(scheduler: TriggerScheduler, consumed: boolean): void {
  const frame = scheduler.frames.pop()!;
  const parent = scheduler.frames[scheduler.frames.length - 1];
  if (parent) parent.child = { event: frame.event, consumed };
  else
    scheduler.completion = { eventId: frame.id, event: frame.event, consumed };
}

function isForced(candidate: TriggerOccurrence): boolean {
  return !!(
    (candidate.compulsory || candidate.wake) &&
    (candidate.shown || candidate.global || candidate.equipment)
  );
}

function actorChoices(frame: TriggerFrame): {
  choices: Candidate[];
  canCancel: boolean;
} {
  const all = frame.candidates.filter(
    (candidate) => candidate.actor === frame.actors[frame.actor],
  );
  const nonCard = all.filter((candidate) => !candidate.cardSkill);
  const choices = (nonCard.length ? nonCard : all).filter(
    (candidate) =>
      !candidate.order ||
      !isForced(candidate) ||
      !all.some(
        (other) =>
          other.order &&
          orderGroupKey(other, other.skill) ===
            orderGroupKey(candidate, candidate.skill) &&
          other.order.index < candidate.order!.index,
      ),
  );
  return { choices, canCancel: !all.some(isForced) };
}

function runTriggers<G>(
  scheduler: TriggerScheduler,
  game: G,
  registry: TriggerRegistry<G>,
): void {
  while (
    scheduler.frames.length &&
    !scheduler.prompt &&
    !scheduler.interruption
  ) {
    const frame = scheduler.frames[scheduler.frames.length - 1];
    if (frame.band >= frame.bands.length) {
      completeFrame(scheduler, false);
      continue;
    }
    if (!frame.recorded) {
      const id = frame.bands[frame.band].skills[frame.recordCursor];
      if (id === undefined) {
        // A later record may invalidate an earlier occurrence before any cost.
        // Newly eligible occurrences enter only after an attempt, as in native.
        frame.candidates = reconcileCandidates(frame, game, registry);
        frame.recorded = true;
        frame.stage = "cost";
        continue;
      }
      const skill = registry.skills.find((skill) => skill.id === id)!;
      const result = invokeTriggerHandler(
        frame,
        game,
        !skill.rule ? skill.record : undefined,
      ) ?? { kind: "done", value: false };
      if (yieldTriggerStep(scheduler, frame, registry, id, result)) continue;
      clearStep(frame);
      frame.candidates.push(...collectCandidates(frame, game, registry, [id]));
      frame.recordCursor++;
      continue;
    }
    if (!frame.selected) {
      const { choices, canCancel } = actorChoices(frame);
      if (!choices.length) {
        advanceActor(frame);
        continue;
      }
      const global = choices.find(
        (choice) => choice.global && choice.compulsory,
      );
      if (frame.actors[frame.actor] !== null && !global) {
        scheduler.prompt = {
          id: `prompt-${scheduler.nextId++}`,
          frameId: frame.id,
          actor: frame.actors[frame.actor]!,
          kind: "order",
          choices: choices.map((choice) => ({
            id: choice.key,
            skill: choice.skill,
            owner: choice.owner,
            slot: choice.slot,
            target: choice.target,
          })),
          canCancel,
        };
        return;
      }
      selectOccurrence(frame, global ?? choices[0]);
    }
    const selected = frame.selected!;
    const skill = registry.skills.find((skill) => skill.id === selected.skill)!;
    const result = invokeTriggerHandler(frame, game, skill[frame.stage]) ?? {
      kind: "done",
      value: true,
    };
    if (yieldTriggerStep(scheduler, frame, registry, skill.id, result))
      continue;
    if (result.kind !== "done") continue;
    clearStep(frame);
    if (frame.stage === "cost" && result.value)
      frame.stage = selected.actor === null ? "effect" : "reveal";
    else if (frame.stage === "reveal") frame.stage = "effect";
    else if (frame.stage === "effect" && result.value) {
      completeFrame(scheduler, true);
    } else {
      frame.selected = null;
      frame.candidates = collectCandidates(frame, game, registry);
    }
  }
}

function createEventFrame<G>(
  scheduler: TriggerScheduler,
  registry: TriggerRegistry<G>,
  event: TriggerEvent,
  currentActor: string | null,
): TriggerFrame {
  assertTriggerData(event.data);
  const skills = registry.skills
    .filter((skill) => skill.events.includes(event.name))
    .map((skill) => ({
      skill,
      priority:
        typeof skill.priority === "function"
          ? skill.priority(event)
          : skill.priority,
    }));
  skills.sort((a, b) => b.priority - a.priority);
  if (skills.some(({ priority }) => !Number.isFinite(priority)))
    throw new Error("Invalid trigger priority");
  const bands: TriggerFrame["bands"] = [];
  for (const { skill, priority } of skills) {
    const band = bands[bands.length - 1];
    if (band?.priority === priority) band.skills.push(skill.id);
    else bands.push({ priority, skills: [skill.id] });
  }
  const start =
    currentActor === null ? 0 : scheduler.seatOrder.indexOf(currentActor);
  return {
    id: `event-${scheduler.nextId++}`,
    event: structuredClone(event),
    actors: [
      ...scheduler.seatOrder.slice(start),
      ...scheduler.seatOrder.slice(0, start),
      null,
    ],
    bands,
    band: 0,
    actor: 0,
    recorded: false,
    recordCursor: 0,
    candidates: [],
    consumed: [],
    consumedPrefixes: {},
    selected: null,
    stage: "record",
    continuation: null,
    answer: null,
    child: null,
  };
}

export function dispatchTriggerEvent<G>(
  scheduler: TriggerScheduler,
  game: G,
  registry: TriggerRegistry<G>,
  event: TriggerEvent,
  currentActor: string | null,
): boolean {
  if (
    scheduler.interruption ||
    scheduler.frames.length ||
    registry.version !== scheduler.registryVersion ||
    (currentActor !== null && !scheduler.seatOrder.includes(currentActor))
  )
    return false;
  if (
    new Set(registry.skills.map((skill) => skill.id)).size !==
    registry.skills.length
  )
    throw new Error("Duplicate trigger skill");
  scheduler.frames.push(
    createEventFrame(scheduler, registry, event, currentActor),
  );
  scheduler.completion = null;
  runTriggers(scheduler, game, registry);
  return true;
}

/** Only the expected responder receives choices; frame/event data stays private. */
export function getTriggerPrompt(
  scheduler: TriggerScheduler,
  viewer: string | null,
): TriggerPrompt | null {
  return scheduler.prompt?.actor === viewer
    ? structuredClone(scheduler.prompt)
    : null;
}

export function resumeTriggerPrompt<G>(
  scheduler: TriggerScheduler,
  game: G,
  registry: TriggerRegistry<G>,
  actor: string,
  answer: unknown,
): boolean {
  const prompt = scheduler.prompt;
  if (
    scheduler.interruption ||
    !prompt ||
    prompt.actor !== actor ||
    registry.version !== scheduler.registryVersion ||
    !answer ||
    typeof answer !== "object" ||
    !("id" in answer) ||
    answer.id !== prompt.id ||
    !("choice" in answer) ||
    (answer.choice !== null && typeof answer.choice !== "string")
  )
    return false;
  const frame = scheduler.frames[scheduler.frames.length - 1];
  if (!frame || frame.id !== prompt.frameId) return false;
  if (answer.choice === null && !prompt.canCancel) return false;
  if (
    answer.choice !== null &&
    !prompt.choices.some((choice) => choice.id === answer.choice)
  )
    return false;
  const current =
    prompt.kind === "order"
      ? actorChoices({
          ...frame,
          candidates: reconcileCandidates(frame, game, registry),
        })
      : null;
  if (answer.choice === null && current && !current.canCancel) return false;
  const selected = current?.choices.find(
    (candidate) => candidate.key === answer.choice && candidate.actor === actor,
  );
  if (prompt.kind === "order" && answer.choice !== null && !selected)
    return false;
  if (prompt.kind === "step") {
    frame.answer = { choice: answer.choice };
  } else if (answer.choice === null) {
    advanceActor(frame);
  } else {
    selectOccurrence(frame, selected!);
  }
  scheduler.prompt = null;
  runTriggers(scheduler, game, registry);
  return true;
}
