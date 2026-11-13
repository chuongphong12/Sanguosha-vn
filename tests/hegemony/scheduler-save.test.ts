import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  dispatchTriggerEvent,
  continueTriggerWork,
  unwindTriggerInterruption,
  resumeTriggerPrompt,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import { createTriggerSaveCodec } from "../../src/game/hegemony/scheduler-save";

function fixture() {
  const game = { paid: 0, answered: 0 };
  const registry: TriggerRegistry<typeof game> = {
    version: "save-fixture-v1",
    skills: [],
    validateEvent: (_game, event) => {
      if (event.name !== "Fixture" || event.data !== null)
        throw Error("Invalid fixture event");
    },
    operations: [
      {
        name: "ask",
        validateSave: (_game, frame, _interruption, prompt) => {
          if (
            frame.operation.data !== null ||
            ![null, "paid"].includes(frame.continuation as string | null)
          )
            throw Error("Invalid ask cursor");
          if (
            prompt &&
            (prompt.actor !== "a" ||
              prompt.canCancel ||
              prompt.choices.length !== 1 ||
              prompt.choices[0].id !== "yes")
          )
            throw Error("Invalid ask prompt");
        },
        validateResult: (_game, result) => {
          if (result.operation.data !== null || result.value !== "yes")
            throw Error("Invalid ask result");
        },
        run: ({ game, continuation, answer }) => {
          if (continuation === null) {
            game.paid++;
            return {
              kind: "prompt",
              actor: "a",
              choices: ["yes"],
              canCancel: false,
              continuation: "paid",
            };
          }
          game.answered++;
          return { kind: "return", value: answer!.choice };
        },
      },
    ],
  };
  const scheduler = createTriggerScheduler(["a", "b"], registry.version);
  dispatchTriggerOperation(
    scheduler,
    game,
    registry,
    { name: "ask", data: null },
    "a",
  );
  return { game, registry, scheduler };
}

function eventFixture() {
  const game = { effects: 0 };
  const registry: TriggerRegistry<typeof game> = {
    version: "event-save-v1",
    skills: [
      {
        id: "skill",
        events: ["Fixture"],
        priority: 2,
        validateSave: (_game, frame, prompt) => {
          if (frame.continuation !== null && frame.continuation !== "paid")
            throw Error("Invalid skill cursor");
          if (
            prompt?.kind === "step" &&
            (prompt.actor !== "a" ||
              prompt.canCancel ||
              prompt.choices.length !== 1 ||
              prompt.choices[0].id !== "ack")
          )
            throw Error("Invalid skill prompt");
        },
        triggerable: () => [
          {
            actor: "a",
            owner: "a",
            slot: "head",
            target: "b",
            occurrence: "first",
          },
        ],
        effect: ({ game, continuation }) => {
          if (continuation === null)
            return {
              kind: "prompt",
              actor: "a",
              choices: ["ack"],
              canCancel: false,
              continuation: "paid",
            };
          game.effects++;
          return { kind: "done", value: false };
        },
      },
    ],
    validateEvent: (_game, event) => {
      if (event.name !== "Fixture" || event.data !== null)
        throw Error("Invalid event");
    },
  };
  const scheduler = createTriggerScheduler(["a", "b"], registry.version);
  dispatchTriggerEvent(
    scheduler,
    game,
    registry,
    { name: "Fixture", target: "b", data: null },
    "a",
  );
  return { game, registry, scheduler };
}

describe("opt-in scheduler save decoding", () => {
  it("rejects an unwind completion in a profile that never opted into unwind", () => {
    const f = fixture();
    const saved = createTriggerScheduler(["a", "b"], f.registry.version);
    saved.nextId = 2;
    saved.unwindCompletion = { reason: "turn-broken", eventId: "operation-1" };
    expect(() =>
      createTriggerSaveCodec(f.registry).read(saved, f.game),
    ).toThrow();
  });
  it.each(["interruption", "unwind", "unwindCompletion"])(
    "rejects coerced %s reason before continuation",
    (field) => {
      const f = fixture();
      f.registry.unwind = true;
      f.registry.stepBudget = 1;
      const saved = structuredClone(f.scheduler);
      saved.prompt = null;
      saved.nextId = 4;
      const bad = {
        id: "interruption-3",
        eventId: "operation-1",
        reason: ["turn-broken"],
      };
      if (field === "interruption") Object.assign(saved, { interruption: bad });
      if (field === "unwind")
        Object.assign(saved, {
          unwind: { interruption: bad, boundary: null },
          yielded: true,
        });
      if (field === "unwindCompletion")
        Object.assign(saved, { frames: [], unwindCompletion: bad });
      expect(() =>
        createTriggerSaveCodec(f.registry).read(saved, f.game),
      ).toThrow();
    },
  );
  it.each(["child-actor", "parent-answer", "parent-child", "parent-result"])(
    "rejects nested stack corruption %s",
    (kind) => {
      const f = fixture();
      f.registry.stepBudget = 1;
      f.registry.operations!.push({
        name: "outer",
        validateSave: (_g, frame) => {
          if (![null, true].includes(frame.continuation as boolean | null))
            throw Error("Invalid outer cursor");
        },
        validateResult: (_g, result) => {
          if (result.value !== null) throw Error("Invalid outer result");
        },
        run: () => ({
          kind: "operation",
          operation: { name: "ask", data: null },
          continuation: true,
        }),
      });
      const saved = createTriggerScheduler(["a", "b"], f.registry.version);
      dispatchTriggerOperation(
        saved,
        f.game,
        f.registry,
        { name: "outer", data: null },
        "a",
      );
      const codec = createTriggerSaveCodec(f.registry);
      expect(
        codec.read(JSON.parse(JSON.stringify(saved)), f.game).frames,
      ).toHaveLength(2);
      if (kind === "child-actor") saved.frames[1].actors = ["b"];
      if (kind === "parent-answer") saved.frames[0].answer = { choice: "yes" };
      if (kind === "parent-child")
        saved.frames[0].child = {
          event: { name: "Fixture", target: null, data: null },
          consumed: false,
        };
      if (kind === "parent-result")
        saved.frames[0].operationChild = {
          operation: { name: "ask", data: null },
          value: "yes",
        };
      expect(() => codec.read(saved, f.game)).toThrow();
    },
  );
  it.each(["seat-rotation", "tied-skill-order"])(
    "preserves runtime %s on yielded events",
    (kind) => {
      const f = eventFixture();
      f.registry.stepBudget = 1;
      f.registry.skills.push({ ...f.registry.skills[0], id: "second" });
      const saved = createTriggerScheduler(["a", "b", "c"], f.registry.version);
      dispatchTriggerEvent(
        saved,
        f.game,
        f.registry,
        { name: "Fixture", target: "b", data: null },
        "b",
      );
      const codec = createTriggerSaveCodec(f.registry);
      expect(
        codec.read(JSON.parse(JSON.stringify(saved)), f.game).yielded,
      ).toBe(true);
      const frame = saved.frames[0];
      if (frame.kind !== "event") throw Error("Expected event");
      if (kind === "seat-rotation") frame.actors = ["b", "a", "c", null];
      else frame.bands[0].skills.reverse();
      expect(() => codec.read(saved, f.game)).toThrow();
    },
  );
  it.each([
    "event-codec",
    "result-codec",
    "skill-codec",
    "duplicate-operation",
    "duplicate-skill",
    "budget",
  ])("requires complete profile %s", (kind) => {
    const f = fixture();
    if (kind === "event-codec") delete f.registry.validateEvent;
    if (kind === "result-codec")
      delete f.registry.operations![0].validateResult;
    if (kind === "skill-codec")
      f.registry.skills = [
        {
          id: "legacy",
          events: ["Fixture"],
          priority: 0,
          effect: () => ({ kind: "done", value: false }),
        },
      ];
    if (kind === "duplicate-operation")
      f.registry.operations!.push(f.registry.operations![0]);
    if (kind === "duplicate-skill") {
      const skill: TriggerRegistry<typeof f.game>["skills"][number] = {
        id: "duplicate",
        events: ["Fixture"],
        priority: 0,
        validateSave: () => undefined,
        effect: () => ({ kind: "done", value: false }),
      };
      f.registry.skills = [skill, skill];
    }
    if (kind === "budget") f.registry.stepBudget = 0;
    expect(() => createTriggerSaveCodec(f.registry)).toThrow();
  });

  it("accepts equivalent JSON object key ordering in order prompts", () => {
    const f = eventFixture(),
      saved = structuredClone(f.scheduler),
      choice = saved.prompt!.choices[0];
    saved.prompt!.choices[0] = {
      target: choice.target,
      slot: choice.slot,
      owner: choice.owner,
      skill: choice.skill,
      id: choice.id,
    };
    expect(
      createTriggerSaveCodec(f.registry).read(saved, f.game).prompt?.id,
    ).toBe(f.scheduler.prompt!.id);
  });

  it.each([
    "selected-flags",
    "skill-prompt-actor",
    "skill-prompt-choice",
    "step-skill",
    "orphan-answer",
    "unwind-id",
    "completion-under-prompt",
  ])("rejects cross-field corruption %s", (kind) => {
    const f = eventFixture();
    const order = f.scheduler.prompt!;
    resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
      id: order.id,
      choice: order.choices[0].id,
    });
    const saved = structuredClone(f.scheduler),
      frame = saved.frames[0];
    if (frame.kind !== "event") throw Error("Expected skill frame");
    if (kind === "selected-flags")
      frame.selected = { ...frame.selected!, compulsory: true };
    if (kind === "step-skill") saved.prompt!.choices[0].skill = "missing";
    if (kind === "skill-prompt-actor") saved.prompt!.actor = "b";
    if (kind === "skill-prompt-choice") saved.prompt!.choices[0].id = "forged";
    if (kind === "orphan-answer") frame.answer = { choice: "ack" };
    if (kind === "unwind-id")
      Object.assign(saved, {
        unwind: {
          boundary: null,
          interruption: {
            id: "interruption-9999",
            eventId: frame.id,
            reason: "turn-broken",
          },
        },
      });
    if (kind === "completion-under-prompt")
      saved.completion = {
        eventId: frame.id,
        event: frame.event,
        consumed: false,
      };
    expect(() =>
      createTriggerSaveCodec(f.registry).read(saved, f.game),
    ).toThrow();
  });
  it.each([1, 2, 7, 10000])(
    "preserves nested work, cleanup prompts and unwind completion across JSON at budget %i",
    (stepBudget) => {
      const game = { paid: 0, cleaned: 0 };
      const registry: TriggerRegistry<typeof game> = {
        version: `unwind-save-${stepBudget}`,
        unwind: true,
        stepBudget,
        skills: [],
        validateEvent: () => {
          throw Error("No fixture events");
        },
        operations: [
          {
            name: "owner",
            validateSave: (_game, frame, interruption) => {
              if (
                frame.operation.data !== null ||
                ![null, "paid", "cleaning"].includes(
                  frame.continuation as string | null,
                )
              )
                throw Error("Invalid owner cursor");
              if (
                frame.cleanup &&
                (frame.cleanup.normalContinuation !== "paid" ||
                  interruption?.reason !== "turn-broken")
              )
                throw Error("Invalid cleanup cursor");
            },
            validateResult: (_game, result) => {
              if (result.value !== null) throw Error("Invalid owner result");
            },
            run: ({ game }) => {
              game.paid++;
              return {
                kind: "operation",
                operation: { name: "break", data: null },
                continuation: "paid",
              };
            },
            unwind: ({ game, continuation }) => {
              if (continuation === null)
                return {
                  kind: "prompt",
                  actor: "a",
                  choices: ["ack"],
                  canCancel: false,
                  continuation: "cleaning",
                };
              game.cleaned++;
              return { kind: "return", value: null };
            },
          },
          {
            name: "break",
            validateSave: (_game, frame) => {
              if (frame.operation.data !== null || frame.continuation !== null)
                throw Error("Invalid break cursor");
            },
            validateResult: () => {
              throw Error("Break cannot return");
            },
            run: () => ({ kind: "interrupt", reason: "turn-broken" }),
          },
        ],
      };
      const codec = createTriggerSaveCodec(registry);
      let scheduler = createTriggerScheduler(["a", "b"], registry.version);
      expect(
        dispatchTriggerOperation(
          scheduler,
          game,
          registry,
          { name: "owner", data: null },
          "a",
        ),
      ).toBe(true);
      let prompts = 0,
        steps = 0;
      while (!scheduler.unwindCompletion) {
        expect(++steps).toBeLessThan(100);
        scheduler = codec.read(JSON.parse(JSON.stringify(scheduler)), game);
        if (scheduler.interruption)
          expect(
            unwindTriggerInterruption(
              scheduler,
              game,
              registry,
              scheduler.interruption,
            ),
          ).toBe(true);
        else if (scheduler.yielded)
          expect(continueTriggerWork(scheduler, game, registry)).toBe(true);
        else {
          prompts++;
          expect(
            resumeTriggerPrompt(scheduler, game, registry, "a", {
              id: scheduler.prompt!.id,
              choice: "ack",
            }),
          ).toBe(true);
        }
      }
      expect(
        codec.read(JSON.parse(JSON.stringify(scheduler)), game).unwindCompletion
          ?.reason,
      ).toBe("turn-broken");
      expect(game).toEqual({ paid: 1, cleaned: 1 });
      expect(prompts).toBe(1);
    },
  );

  it.each([
    "unwind-false",
    "unwind-empty",
    "completion-false",
    "yield-without-work",
    "unmarked-work",
  ])("rejects invalid optional boundary %s", (kind) => {
    const f = fixture();
    const saved = structuredClone(f.scheduler);
    if (kind === "unwind-false") Object.assign(saved, { unwind: false });
    if (kind === "unwind-empty") Object.assign(saved, { unwind: {} });
    if (kind === "completion-false")
      Object.assign(saved, { unwindCompletion: false });
    if (kind === "yield-without-work")
      Object.assign(saved, { prompt: null, frames: [], yielded: true });
    if (kind === "unmarked-work") saved.prompt = null;
    expect(() =>
      createTriggerSaveCodec(f.registry).read(saved, f.game),
    ).toThrow();
  });

  it("isolates save validators and snapshots the profile instead of giving them writable candidate state", () => {
    const f = fixture();
    const validateSave = f.registry.operations![0].validateSave!;
    f.registry.operations![0].validateSave = (
      game,
      frame,
      interruption,
      prompt,
    ) => {
      validateSave(game, frame, interruption, prompt);
      Object.assign(game, { paid: 999 });
      Object.assign(frame, { continuation: "forged" });
    };
    const codec = createTriggerSaveCodec(f.registry);
    f.registry.version = "mutated";
    f.registry.operations![0].name = "mutated";
    const saved = codec.read(f.scheduler, f.game);
    expect(f.game).toEqual({ paid: 1, answered: 0 });
    expect(saved.frames[0].continuation).toBe("paid");
    saved.prompt!.choices[0].id = "mutated";
    expect(f.scheduler.prompt!.choices[0].id).toBe("yes");
  });
  it("restores trigger ordering, a skill prompt and completed event without executing a skill during decoding", () => {
    const f = eventFixture(),
      codec = createTriggerSaveCodec(f.registry);
    let saved = codec.read(JSON.parse(JSON.stringify(f.scheduler)), f.game);
    const order = saved.prompt!;
    expect(
      resumeTriggerPrompt(saved, f.game, f.registry, "a", {
        id: order.id,
        choice: order.choices[0].id,
      }),
    ).toBe(true);
    saved = codec.read(JSON.parse(JSON.stringify(saved)), f.game);
    expect(f.game.effects).toBe(0);
    expect(
      resumeTriggerPrompt(saved, f.game, f.registry, "a", {
        id: saved.prompt!.id,
        choice: "ack",
      }),
    ).toBe(true);
    expect(
      codec.read(JSON.parse(JSON.stringify(saved)), f.game).completion
        ?.consumed,
    ).toBe(false);
    expect(f.game.effects).toBe(1);
  });

  it.each([
    "band",
    "missing-skill",
    "duplicate-skill",
    "priority",
    "record-cursor",
    "stage",
    "candidate-key",
    "candidate-owner",
    "candidate-slot",
    "selected",
    "consumed",
    "prefix",
    "order-actor",
    "order-choice",
    "order-cancel",
    "actors-order",
  ])("rejects corrupt trigger %s", (kind) => {
    const f = eventFixture(),
      saved = structuredClone(f.scheduler),
      frame = saved.frames[0];
    if (frame.kind !== "event") throw Error("Expected event fixture");
    if (kind === "band") frame.band = 99;
    if (kind === "missing-skill") frame.bands = [];
    if (kind === "duplicate-skill") frame.bands[0].skills.push("skill");
    if (kind === "priority") frame.bands[0].priority = -99;
    if (kind === "record-cursor") frame.recordCursor = 99;
    if (kind === "stage") frame.stage = "effect";
    if (kind === "candidate-key") frame.candidates[0].key = "forged";
    if (kind === "candidate-owner") frame.candidates[0].owner = "stranger";
    if (kind === "candidate-slot")
      Object.assign(frame.candidates[0], { slot: "treasure" });
    if (kind === "selected") frame.selected = frame.candidates[0];
    if (kind === "consumed") frame.consumed = ["forged"];
    if (kind === "prefix") frame.consumedPrefixes.fake = -1;
    if (kind === "order-actor") saved.prompt!.actor = "b";
    if (kind === "order-choice") saved.prompt!.choices[0].id = "forged";
    if (kind === "order-cancel") saved.prompt!.canCancel = false;
    if (kind === "actors-order") frame.actors = ["b", "a", null];
    expect(() =>
      createTriggerSaveCodec(f.registry).read(saved, f.game),
    ).toThrow();
    expect(f.game.effects).toBe(0);
  });
  it.each([
    "registry",
    "seat",
    "duplicate-seat",
    "next-id",
    "frame-id",
    "actor",
    "prompt-frame",
    "prompt-actor",
    "prompt-other-seat",
    "prompt-forged-choice",
    "prompt-forged-cancel",
    "prompt-choice",
    "prompt-id",
    "prompt-kind",
    "prompt-cancel",
    "prompt-reused-serial",
    "prompt-yield",
    "unknown-operation",
    "cursor",
    "answer",
    "child",
    "result",
    "cycle",
    "non-json",
  ])(
    "rejects corrupt %s before execution and leaves the input untouched",
    (kind) => {
      const f = fixture();
      const saved = structuredClone(f.scheduler);
      const frame = saved.frames[0];
      if (kind === "registry") saved.registryVersion = "other";
      if (kind === "seat") saved.seatOrder = [];
      if (kind === "duplicate-seat") saved.seatOrder.push("a");
      if (kind === "next-id") saved.nextId = 1;
      if (kind === "frame-id") frame.id = "operation-999";
      if (kind === "actor") frame.actors = ["stranger"];
      if (kind === "prompt-frame") saved.prompt!.frameId = "operation-99";
      if (kind === "prompt-actor") saved.prompt!.actor = "stranger";
      if (kind === "prompt-other-seat") saved.prompt!.actor = "b";
      if (kind === "prompt-forged-choice")
        saved.prompt!.choices[0].id = "forged";
      if (kind === "prompt-forged-cancel") saved.prompt!.canCancel = true;
      if (kind === "prompt-choice")
        saved.prompt!.choices.push(saved.prompt!.choices[0]);
      if (kind === "prompt-id") saved.prompt!.id = frame.id;
      if (kind === "prompt-reused-serial") saved.prompt!.id = "prompt-1";
      if (kind === "prompt-kind") saved.prompt!.kind = "order";
      if (kind === "prompt-cancel")
        Object.assign(saved.prompt!, { canCancel: 1 });
      if (kind === "prompt-yield") saved.yielded = true;
      if (kind === "unknown-operation" && frame.kind === "operation")
        frame.operation.name = "missing";
      if (kind === "cursor") frame.continuation = "not-paid";
      if (kind === "answer") frame.answer = { choice: "unoffered" };
      if (kind === "child")
        frame.child = {
          event: { name: "Unknown", target: "a", data: null },
          consumed: false,
        };
      if (kind === "result")
        frame.operationChild = {
          operation: { name: "ask", data: null },
          value: "wrong",
        };
      if (kind === "cycle") Object.assign(saved, { recursive: saved });
      if (kind === "non-json") frame.continuation = Number.NaN;
      const before = structuredClone(saved);
      expect(() =>
        createTriggerSaveCodec(f.registry).read(saved, f.game),
      ).toThrow();
      expect(saved).toEqual(before);
      expect(f.game).toEqual({ paid: 1, answered: 0 });
    },
  );

  it("requires explicit codec coverage instead of trusting legacy operation validators", () => {
    const f = fixture();
    delete f.registry.operations![0].validateSave;
    expect(() => createTriggerSaveCodec(f.registry)).toThrow("codec");
  });

  it("restores a paused prompt without running or replaying its paid operation", () => {
    const f = fixture();
    const codec = createTriggerSaveCodec(f.registry);
    const saved = JSON.parse(JSON.stringify(f.scheduler));
    const restored = codec.read(saved, f.game);
    expect(f.game).toEqual({ paid: 1, answered: 0 });
    expect(restored).toEqual(f.scheduler);
    expect(restored).not.toBe(saved);
    expect(
      resumeTriggerPrompt(restored, f.game, f.registry, "a", {
        id: restored.prompt!.id,
        choice: "yes",
      }),
    ).toBe(true);
    expect(f.game).toEqual({ paid: 1, answered: 1 });
    expect(
      codec.read(JSON.parse(JSON.stringify(restored)), f.game),
    ).toMatchObject({ operationCompletion: { value: "yes" } });
    expect(f.scheduler.prompt).not.toBeNull();
  });
});
