import type {
  TriggerRegistry,
  TriggerScheduler,
  TriggerEvent,
  OperationResult,
} from "./scheduler";
import { actorChoices } from "./scheduler";

function requireSave(condition: unknown, detail: string): asserts condition {
  if (!condition) throw Error(`Invalid scheduler save: ${detail}`);
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function json(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  requireSave(
    typeof value === "object" && value !== null && !ancestors.has(value),
    "JSON data",
  );
  requireSave(
    Array.isArray(value) ||
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null,
    "JSON object",
  );
  requireSave(Object.getOwnPropertySymbols(value).length === 0, "JSON symbols");
  ancestors.add(value);
  for (const part of Array.isArray(value) ? value : Object.values(value))
    json(part, ancestors);
  ancestors.delete(value);
}

/** Explicit opt-in: old profiles still dispatch/resume without save hooks.
 * Codecs must be pure and cover saved inputs, cursors, cleanup and results.
 * This decodes scheduler state only; the application must validate Room first.
 */
export function createTriggerSaveCodec<G>(registry: TriggerRegistry<G>) {
  const profile = {
    ...registry,
    skills: registry.skills.map((s) => ({ ...s, events: [...s.events] })),
    operations: (registry.operations ?? []).map((op) => ({ ...op })),
  };
  requireSave(
    typeof profile.version === "string" && profile.version.length > 0,
    "registry",
  );
  requireSave(
    profile.stepBudget === undefined ||
      (Number.isSafeInteger(profile.stepBudget) && profile.stepBudget > 0),
    "step budget",
  );
  requireSave(typeof profile.validateEvent === "function", "event codec");
  requireSave(
    new Set(profile.skills.map((s) => s.id)).size === profile.skills.length &&
      profile.skills.every((s) => s.id && typeof s.validateSave === "function"),
    "skill codec coverage",
  );
  requireSave(
    new Set(profile.operations.map((op) => op.name)).size ===
      profile.operations.length &&
      profile.operations.every(
        (op) =>
          op.name &&
          typeof op.validateSave === "function" &&
          typeof op.validateResult === "function",
      ),
    "operation codec coverage",
  );

  function read(value: unknown, game: G): TriggerScheduler {
    json(value);
    requireSave(
      record(value) && value.registryVersion === profile.version,
      "registry identity",
    );
    requireSave(
      Array.isArray(value.seatOrder) &&
        value.seatOrder.length > 0 &&
        value.seatOrder.every((p) => typeof p === "string" && p.length > 0) &&
        new Set(value.seatOrder).size === value.seatOrder.length,
      "seats",
    );
    requireSave(
      Number.isSafeInteger(value.nextId) &&
        Number(value.nextId) > 0 &&
        Array.isArray(value.frames),
      "frames/nextId",
    );
    // JSON is checked first; all typed structures below are checked before codecs.
    const saved = structuredClone(value) as unknown as TriggerScheduler;
    const actor = (p: unknown) =>
      p === null || (typeof p === "string" && saved.seatOrder.includes(p));
    const allocated = new Map<number, string>();
    const serial = (v: string) => Number(v.split("-").at(-1));
    const id = (v: unknown, prefix: string) => {
      if (
        typeof v !== "string" ||
        !new RegExp(`^${prefix}-[1-9][0-9]*$`).test(v)
      )
        return false;
      const n = serial(v);
      if (
        !Number.isSafeInteger(n) ||
        n >= saved.nextId ||
        (allocated.has(n) && allocated.get(n) !== v)
      )
        return false;
      allocated.set(n, v);
      return true;
    };
    const event = (v: unknown) => {
      requireSave(
        record(v) &&
          typeof v.name === "string" &&
          v.name.length > 0 &&
          actor(v.target) &&
          "data" in v,
        "event",
      );
    };
    const operation = (v: unknown) => {
      requireSave(
        record(v) &&
          typeof v.name === "string" &&
          profile.operations.some((op) => op.name === v.name) &&
          "data" in v,
        "operation",
      );
    };
    const result = (v: unknown) => {
      requireSave(record(v) && "value" in v, "operation result");
      operation(v.operation);
    };
    const interruption = (v: unknown) => {
      requireSave(
        record(v) &&
          typeof v.reason === "string" &&
          ["turn-broken", "stage-change", "game-over"].includes(v.reason) &&
          (id(v.eventId, "operation") || id(v.eventId, "event")) &&
          (profile.unwind === true
            ? id(v.id, "interruption") &&
              serial(String(v.id)) > serial(String(v.eventId))
            : v.id === undefined),
        "interruption",
      );
    };
    let previous = 0;
    for (const frame of saved.frames) {
      requireSave(
        record(frame) &&
          (frame.kind === "operation" || frame.kind === "event") &&
          id(frame.id, frame.kind),
        "frame identity",
      );
      const serial = Number(frame.id.split("-").at(-1));
      requireSave(serial > previous, "stack allocation order");
      previous = serial;
      requireSave(
        Array.isArray(frame.actors) && frame.actors.every(actor),
        "frame actors",
      );
      requireSave(
        "continuation" in frame &&
          (frame.answer === null ||
            (record(frame.answer) &&
              (frame.answer.choice === null ||
                typeof frame.answer.choice === "string"))),
        "frame continuation/answer",
      );
      if (frame.child !== null) {
        requireSave(
          record(frame.child) && typeof frame.child.consumed === "boolean",
          "child",
        );
        event(frame.child.event);
      }
      if (frame.operationChild !== null) result(frame.operationChild);
      if (frame.kind === "operation") {
        operation(frame.operation);
        requireSave(frame.actors.length === 1, "operation actor");
        if (frame.cleanup !== undefined)
          requireSave(
            record(frame.cleanup) &&
              "normalContinuation" in frame.cleanup &&
              profile.unwind === true &&
              typeof profile.operations.find(
                (op) => op.name === frame.operation.name,
              )!.unwind === "function",
            "cleanup owner",
          );
      } else {
        event(frame.event);
        requireSave(
          frame.actors.length === saved.seatOrder.length + 1 &&
            frame.actors.at(-1) === null &&
            new Set(frame.actors).size === frame.actors.length,
          "event actors",
        );
        const start = saved.seatOrder.indexOf(frame.actors[0]!);
        requireSave(
          frame.actors
            .slice(0, -1)
            .every(
              (p, index) =>
                p === saved.seatOrder[(start + index) % saved.seatOrder.length],
            ),
          "event actor rotation",
        );
        requireSave(
          Array.isArray(frame.bands) &&
            Number.isSafeInteger(frame.band) &&
            frame.band >= 0 &&
            frame.band <= frame.bands.length &&
            Number.isSafeInteger(frame.actor) &&
            frame.actor >= 0 &&
            frame.actor < frame.actors.length &&
            typeof frame.recorded === "boolean" &&
            Number.isSafeInteger(frame.recordCursor) &&
            frame.recordCursor >= 0 &&
            ["record", "cost", "reveal", "effect"].includes(frame.stage),
          "event cursor",
        );
        requireSave(
          Array.isArray(frame.candidates) &&
            Array.isArray(frame.consumed) &&
            record(frame.consumedPrefixes),
          "event occurrences",
        );
        const slot = (v: unknown) =>
          v === null || v === "head" || v === "deputy";
        const expected = profile.skills.filter((s) =>
          s.events.includes(frame.event.name),
        );
        const seen: string[] = [];
        let priority = Infinity;
        for (const band of frame.bands) {
          requireSave(
            record(band) &&
              Number.isFinite(band.priority) &&
              band.priority < priority &&
              Array.isArray(band.skills) &&
              band.skills.length > 0,
            "event band",
          );
          priority = band.priority;
          let registration = -1;
          for (const name of band.skills) {
            const skill = expected.find((s) => s.id === name);
            requireSave(
              skill &&
                !seen.includes(name) &&
                (typeof skill.priority === "function" ||
                  skill.priority === priority),
              "event skill/priority",
            );
            const position = expected.indexOf(skill);
            requireSave(
              position > registration,
              "tied skill registration order",
            );
            registration = position;
            seen.push(name);
          }
        }
        requireSave(seen.length === expected.length, "event table coverage");
        const band = frame.bands[frame.band];
        requireSave(
          frame.recordCursor <= (band?.skills.length ?? 0) &&
            (frame.recorded
              ? frame.recordCursor === band?.skills.length &&
                frame.stage !== "record"
              : frame.selected === null && frame.stage === "record"),
          "record cursor/stage",
        );
        const occurrence = (v: unknown) => {
          requireSave(
            record(v) &&
              typeof v.skill === "string" &&
              band?.skills.includes(v.skill) &&
              actor(v.actor) &&
              actor(v.owner) &&
              actor(v.target) &&
              slot(v.slot) &&
              typeof v.occurrence === "string",
            "occurrence",
          );
          requireSave(
            v.key ===
              JSON.stringify([
                v.skill,
                v.actor,
                v.owner,
                v.slot,
                v.target,
                v.occurrence,
              ]),
            "occurrence key",
          );
          for (const flag of [
            "compulsory",
            "wake",
            "global",
            "shown",
            "equipment",
            "cardSkill",
          ])
            requireSave(
              v[flag] === undefined || typeof v[flag] === "boolean",
              "occurrence flag",
            );
          if (v.order !== undefined)
            requireSave(
              record(v.order) &&
                typeof v.order.group === "string" &&
                Number.isSafeInteger(v.order.index) &&
                Number(v.order.index) >= 0,
              "occurrence order",
            );
        };
        frame.candidates.forEach(occurrence);
        requireSave(
          new Set(frame.candidates.map((c) => c.key)).size ===
            frame.candidates.length &&
            frame.consumed.every((key) => typeof key === "string") &&
            new Set(frame.consumed).size === frame.consumed.length,
          "occurrence identities",
        );
        for (const key of frame.consumed) {
          const parts: unknown = JSON.parse(key);
          requireSave(
            Array.isArray(parts) &&
              parts.length === 6 &&
              seen.includes(parts[0]) &&
              actor(parts[1]) &&
              actor(parts[2]) &&
              slot(parts[3]) &&
              actor(parts[4]) &&
              typeof parts[5] === "string",
            "consumed key",
          );
        }
        for (const [key, index] of Object.entries(frame.consumedPrefixes)) {
          const parts: unknown = JSON.parse(key);
          requireSave(
            Array.isArray(parts) &&
              parts.length === 5 &&
              seen.includes(parts[0]) &&
              actor(parts[1]) &&
              actor(parts[2]) &&
              slot(parts[3]) &&
              typeof parts[4] === "string" &&
              Number.isSafeInteger(index) &&
              index >= 0,
            "consumed prefix",
          );
        }
        if (frame.selected !== null) {
          occurrence(frame.selected);
          requireSave(
            frame.recorded &&
              frame.selected.actor === frame.actors[frame.actor] &&
              frame.consumed.includes(frame.selected.key) &&
              frame.candidates.some((c) => c.key === frame.selected!.key),
            "selected occurrence",
          );
          const selected = frame.selected;
          const candidate = frame.candidates.find(
            (c) => c.key === selected.key,
          )!;
          requireSave(
            [
              "compulsory",
              "wake",
              "global",
              "shown",
              "equipment",
              "cardSkill",
            ].every(
              (flag) =>
                Reflect.get(candidate, flag) === Reflect.get(selected, flag),
            ) &&
              candidate.order?.group === selected.order?.group &&
              candidate.order?.index === selected.order?.index,
            "selected occurrence metadata",
          );
        } else
          requireSave(
            frame.stage === "record" ||
              frame.stage === "cost" ||
              (frame.stage === "effect" &&
                frame.recorded &&
                frame.continuation === null &&
                frame.answer === null &&
                frame.child === null &&
                frame.operationChild === null &&
                frame.consumed.length > 0 &&
                band?.skills.includes(JSON.parse(frame.consumed.at(-1)!)[0])),
            "unselected stage",
          );
        if (!band)
          requireSave(
            frame.candidates.length === 0 &&
              !frame.recorded &&
              frame.selected === null,
            "completed band",
          );
      }
    }
    for (let index = 1; index < saved.frames.length; index++) {
      const parent = saved.frames[index - 1],
        child = saved.frames[index];
      requireSave(
        child.actors[0] ===
          (child.kind === "event"
            ? (parent.actors[0] ?? saved.seatOrder[0])
            : parent.actors[0]) &&
          parent.answer === null &&
          parent.child === null &&
          parent.operationChild === null,
        "pending child context",
      );
    }
    const top = saved.frames.at(-1);
    requireSave(
      saved.yielded === undefined || typeof saved.yielded === "boolean",
      "yield marker",
    );
    requireSave(
      saved.unwind === undefined ||
        saved.unwind === null ||
        record(saved.unwind),
      "unwind marker",
    );
    requireSave(
      saved.unwindCompletion === undefined ||
        saved.unwindCompletion === null ||
        record(saved.unwindCompletion),
      "unwind completion marker",
    );
    requireSave(
      !top || saved.prompt || saved.interruption || saved.yielded,
      "paused work boundary",
    );
    if (saved.prompt !== null) {
      const prompt = saved.prompt;
      requireSave(
        record(prompt) &&
          id(prompt.id, "prompt") &&
          top &&
          prompt.frameId === top.id &&
          serial(prompt.id) > serial(top.id) &&
          typeof prompt.actor === "string" &&
          actor(prompt.actor) &&
          (prompt.kind === "step" ||
            (prompt.kind === "order" && top.kind === "event")) &&
          typeof prompt.canCancel === "boolean" &&
          Array.isArray(prompt.choices) &&
          prompt.choices.length > 0 &&
          new Set(prompt.choices.map((c) => c.id)).size ===
            prompt.choices.length,
        "prompt",
      );
      requireSave(
        prompt.choices.every(
          (c) =>
            record(c) &&
            typeof c.id === "string" &&
            typeof c.skill === "string" &&
            actor(c.owner) &&
            actor(c.target) &&
            [null, "head", "deputy"].includes(c.slot),
        ),
        "prompt choices",
      );
      requireSave(
        !saved.yielded && !saved.interruption && top.answer === null,
        "prompt boundary",
      );
      if (prompt.kind === "order" && top.kind === "event") {
        requireSave(
          top.recorded &&
            top.selected === null &&
            top.actors[top.actor] === prompt.actor,
          "order actor",
        );
        const { choices, canCancel } = actorChoices(top);
        requireSave(
          !choices.some((c) => c.global && c.compulsory) &&
            prompt.canCancel === canCancel &&
            prompt.choices.length === choices.length &&
            prompt.choices.every((choice, index) => {
              const c = choices[index];
              return (
                choice.id === c.key &&
                choice.skill === c.skill &&
                choice.owner === c.owner &&
                choice.slot === c.slot &&
                choice.target === c.target
              );
            }),
          "order choices",
        );
      } else if (top.kind === "operation")
        requireSave(
          prompt.choices.every(
            (c) =>
              c.skill === top.operation.name &&
              c.owner === null &&
              c.slot === null &&
              c.target === null,
          ),
          "operation prompt ownership",
        );
      else {
        const skill = top.recorded
          ? top.selected?.skill
          : top.bands[top.band]?.skills[top.recordCursor];
        requireSave(
          skill &&
            prompt.choices.every(
              (c) =>
                c.skill === skill &&
                c.owner === (top.selected?.owner ?? null) &&
                c.slot === (top.selected?.slot ?? null) &&
                c.target === (top.selected?.target ?? top.event.target),
            ),
          "skill prompt ownership",
        );
      }
    }
    if (saved.interruption !== null) {
      interruption(saved.interruption);
      requireSave(
        top?.id === saved.interruption.eventId && !saved.yielded,
        "interruption boundary",
      );
    }
    if (saved.unwind) {
      requireSave(record(saved.unwind) && profile.unwind === true, "unwind");
      interruption(saved.unwind.interruption);
      const cleaning = saved.frames.filter(
        (f) => f.kind === "operation" && f.cleanup,
      );
      requireSave(
        saved.unwind.boundary === null
          ? saved.prompt === null
          : typeof saved.unwind.boundary === "string" &&
              cleaning.at(-1)?.id === saved.unwind.boundary,
        "unwind boundary",
      );
    } else
      requireSave(
        saved.frames.every((f) => f.kind !== "operation" || !f.cleanup),
        "orphan cleanup",
      );
    if (saved.unwindCompletion) {
      requireSave(profile.unwind === true, "unwind completion policy");
      interruption(saved.unwindCompletion);
    }
    if (saved.completion !== null) {
      requireSave(
        record(saved.completion) &&
          id(saved.completion.eventId, "event") &&
          typeof saved.completion.consumed === "boolean",
        "completion",
      );
      event(saved.completion.event);
    }
    if (saved.operationCompletion !== null) result(saved.operationCompletion);
    const completions = [
      saved.completion,
      saved.operationCompletion,
      saved.unwindCompletion,
    ].filter(Boolean).length;
    requireSave(
      completions <= 1 &&
        (!completions ||
          (!top &&
            !saved.prompt &&
            !saved.interruption &&
            !saved.unwind &&
            !saved.yielded)),
      "completion boundary",
    );
    requireSave(
      !saved.yielded ||
        (profile.stepBudget !== undefined && (top || saved.unwind)),
      "yield boundary",
    );

    // Validation callbacks see detached copies, never candidate or caller state.
    const checkEvent = (e: TriggerEvent) =>
      profile.validateEvent!(structuredClone(game), structuredClone(e));
    const checkResult = (r: OperationResult) =>
      profile.operations.find((op) => op.name === r.operation.name)!
        .validateResult!(structuredClone(game), structuredClone(r));
    const cleanupIndex = saved.unwind?.boundary
      ? saved.frames.findIndex((frame) => frame.id === saved.unwind!.boundary)
      : -1;
    for (const [index, frame] of saved.frames.entries()) {
      const child = saved.frames[index + 1] ?? null;
      const abandoning =
        Boolean(saved.unwind) && (cleanupIndex < 0 || index < cleanupIndex);
      if (frame.child) checkEvent(frame.child.event);
      if (frame.operationChild) checkResult(frame.operationChild);
      if (frame.kind === "operation")
        profile.operations.find((op) => op.name === frame.operation.name)!
          .validateSave!(
          structuredClone(game),
          structuredClone(frame),
          structuredClone(saved.unwind?.interruption ?? null),
          frame.id === saved.prompt?.frameId
            ? structuredClone(saved.prompt)
            : null,
          { child: structuredClone(child), abandoning },
        );
      else {
        checkEvent(frame.event);
        for (const skill of frame.bands.flatMap((band) => band.skills))
          profile.skills.find((s) => s.id === skill)!.validateSave!(
            structuredClone(game),
            structuredClone(frame),
            frame.id === saved.prompt?.frameId
              ? structuredClone(saved.prompt)
              : null,
            { child: structuredClone(child), abandoning },
          );
      }
    }
    if (saved.completion) checkEvent(saved.completion.event);
    if (saved.operationCompletion) checkResult(saved.operationCompletion);
    return saved;
  }
  return { read };
}
