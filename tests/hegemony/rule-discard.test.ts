import { describe, expect, it } from "vitest";
import { drawingSetup, type DrawingGame } from "./drawing-support";
import { createRuleDiscardAdmission } from "../../src/game/hegemony/rule-discard";
import {
  createTriggerScheduler,
  continueTriggerWork,
  dispatchTriggerOperation,
  resumeTriggerPrompt,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = DrawingGame & { blocked: number[] };
function setup(hand: number[], blocked: number[] = [], focus = false) {
  const f = drawingSetup();
  const game: Game = { ...f.game, blocked };
  game.cardZones.draw.cards = game.cardZones.draw.cards.filter(
    (id) => !hand.includes(id),
  );
  game.cardZones.a.cards = [...hand];
  const admission = createRuleDiscardAdmission<Game, string>(
    {
      discardZone: "discard",
      isJilei: (g, _target, id) => g.blocked.includes(id),
      focus: (target) =>
        focus
          ? { name: "notice", data: { kind: "discard-focus", target } }
          : null,
    },
    (actor) => actor,
  );
  const registry: TriggerRegistry<Game> = {
    version: "rule-discard-ce4e62b",
    skills: [
      {
        id: "choice-observer",
        events: ["ChoiceMade"],
        rule: true,
        priority: 20,
        effect: ({ game, event }) => {
          game.trace.push({ event: event.name, data: event.data });
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [...f.rules.operations!, admission.operation],
  };
  return {
    game,
    registry,
    admission,
    scheduler: createTriggerScheduler(game.seatOrder, registry.version),
  };
}
type Fixture = ReturnType<typeof setup>;
function start(f: Fixture, count: number) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "rule-discard", data: { target: "a", count } },
      "a",
    ),
  ).toBe(true);
}
describe("mandatory GameRule discard", () => {
  it("lets the actor confirm an empty selection after all remaining cards become protected", () => {
    const f = setup([0, 1, 2]);
    start(f, 2);
    const first = f.admission.view(f.scheduler, "a")!;
    const card = first.choices.find(
      (c) => c.action === "card" && c.cardId === 0,
    )!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: first.id,
        choice: card.id,
      }),
    ).toBe(true);
    f.game.blocked = [0, 1, 2];
    const selected = f.admission.view(f.scheduler, "a")!;
    const reset = selected.choices.find((c) => c.action === "reset")!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: selected.id,
        choice: reset.id,
      }),
    ).toBe(true);
    const empty = f.admission.view(f.scheduler, "a")!;
    expect(empty.requiredCount).toBe(0);
    const confirm = empty.choices.find((c) => c.action === "confirm")!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: empty.id,
        choice: confirm.id,
      }),
    ).toBe(true);
    expect(f.game.cardZones.a.cards).toEqual([0, 1, 2]);
    expect(f.game.cardZones.discard.cards).toEqual([]);
    expect(f.game.trace).toEqual([]);
    expect(f.scheduler.operationCompletion?.value).toBe(true);
  });
  it("does not move cards when resetting a selection after the legal hand shrinks", () => {
    const f = setup([0, 1, 2, 3]);
    start(f, 2);
    const initial = f.admission.view(f.scheduler, "a")!;
    const card0 = initial.choices.find(
      (c) => c.action === "card" && c.cardId === 0,
    )!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: initial.id,
        choice: card0.id,
      }),
    ).toBe(true);
    const partial = f.admission.view(f.scheduler, "a")!;
    f.game.blocked = [0, 2, 3];
    const reset = partial.choices.find((c) => c.action === "reset")!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: partial.id,
        choice: reset.id,
      }),
    ).toBe(true);
    expect(f.game.cardZones.a.cards).toEqual([0, 1, 2, 3]);
    expect(f.game.cardZones.discard.cards).toEqual([]);
    const fresh = f.admission.view(f.scheduler, "a")!;
    expect(fresh.selectedIds).toEqual([]);
    expect(fresh.requiredCount).toBe(1);
    const card1 = fresh.choices.find(
      (c) => c.action === "card" && c.cardId === 1,
    )!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: fresh.id,
        choice: card1.id,
      }),
    ).toBe(true);
    const ready = f.admission.view(f.scheduler, "a")!;
    const confirm = ready.choices.find((c) => c.action === "confirm")!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: ready.id,
        choice: confirm.id,
      }),
    ).toBe(true);
    expect(f.game.cardZones.discard.cards).toEqual([1]);
    expect(f.game.cardZones.a.cards).toEqual([0, 2, 3]);
  });
  it.each(["newly-protected", "dead"])(
    "revalidates an injected saved accepted answer when the actor is %s",
    (change) => {
      const f = setup([0, 1, 2]);
      start(f, 1);
      const first = f.admission.view(f.scheduler, "a")!;
      const card0 = first.choices.find(
        (c) => c.action === "card" && c.cardId === 0,
      )!;
      expect(
        f.admission.submit(f.scheduler, f.game, f.registry, "a", {
          id: first.id,
          choice: card0.id,
        }),
      ).toBe(true);
      const ready = f.admission.view(f.scheduler, "a")!;
      const confirm = ready.choices.find((c) => c.action === "confirm")!;
      // Inject the accepted-answer checkpoint; normal public resume executes the first step synchronously.
      f.registry.stepBudget = 1;
      f.scheduler = JSON.parse(JSON.stringify(f.scheduler));
      f.scheduler.frames.at(-1)!.answer = { choice: confirm.id };
      f.scheduler.prompt = null;
      f.scheduler.yielded = true;
      if (change === "newly-protected") f.game.blocked.push(0);
      else f.game.alive.a = false;
      expect(continueTriggerWork(f.scheduler, f.game, f.registry)).toBe(true);
      expect(f.game.cardZones.discard.cards).toEqual([]);
      expect(f.game.cardZones.a.cards).toEqual([0, 1, 2]);
      if (change === "dead")
        expect(f.scheduler.operationCompletion?.value).toBe(false);
      else {
        const view = f.admission.view(f.scheduler, "a")!;
        expect(view.selectedIds).toEqual([]);
        expect(
          view.choices.some((c) => c.action === "card" && c.cardId === 0),
        ).toBe(false);
      }
    },
  );
  it("retains the captured discard decision when movement is cancelled by a trigger", () => {
    const f = setup([0]);
    f.registry.skills.push({
      id: "cancel-move",
      events: ["BeforeCardsMove"],
      priority: 30,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    start(f, 1);
    expect(f.game.cardZones.a.cards).toEqual([0]);
    expect(f.game.cardZones.discard.cards).toEqual([]);
    expect(f.game.trace).toEqual([
      { event: "ChoiceMade", data: "cardDiscard:gamerule:$0" },
    ]);
    expect(f.scheduler.operationCompletion?.value).toBe(true);
  });
  it("restores the actor's partially selected hand cards in the private prompt", () => {
    const f = setup([0, 1, 2, 3]);
    start(f, 2);
    const first = f.admission.view(f.scheduler, "a")!;
    const card = first.choices.find(
      (choice) => choice.action === "card" && choice.cardId === 0,
    )!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: first.id,
        choice: card.id,
      }),
    ).toBe(true);
    f.scheduler = JSON.parse(JSON.stringify(f.scheduler));
    expect(f.admission.view(f.scheduler, "a")!.selectedIds).toEqual([0]);
    expect(f.admission.view(f.scheduler, "b")).toBeNull();
  });
  it("refuses to take a selected card from another player's hand after a yielded movement", () => {
    const f = setup([0, 1, 2]);
    f.registry.stepBudget = 1;
    start(f, 1);
    const initial = f.admission.view(f.scheduler, "a")!;
    const card0 = initial.choices.find(
      (choice) => choice.action === "card" && choice.cardId === 0,
    )!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: initial.id,
        choice: card0.id,
      }),
    ).toBe(true);
    const ready = f.admission.view(f.scheduler, "a")!;
    const confirm = ready.choices.find(
      (choice) => choice.action === "confirm",
    )!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: ready.id,
        choice: confirm.id,
      }),
    ).toBe(true);
    expect(f.scheduler.yielded).toBe(true);
    // Inject a state change forbidden by the future single-writer match owner.
    f.game.cardZones.a.cards = [1, 2];
    f.game.cardZones.b.cards = [0];
    expect(() => continueTriggerWork(f.scheduler, f.game, f.registry)).toThrow(
      "Stale card movement",
    );
    expect(f.game.cardZones.b.cards).toEqual([0]);
    expect(f.game.cardZones.discard.cards).toEqual([]);
  });
  it("moves the selected physical hand cards openly with the GameRule discard reason", () => {
    const f = setup([0]);
    f.registry.skills.push({
      id: "observe-move-reason",
      events: ["BeforeCardsMove"],
      priority: 30,
      rule: true,
      effect: ({ game, event }) => {
        if (event.target === "a")
          game.trace.push({
            event: event.name,
            data: structuredClone(event.data),
          });
        return { kind: "done", value: false };
      },
    });
    start(f, 1);
    expect(f.game.trace[0]).toMatchObject({
      event: "BeforeCardsMove",
      data: {
        moves: [
          {
            ids: [0],
            fromPlaces: ["hand"],
            toPlace: "discard",
            open: [true],
            reason: { kind: "rule-discard", actor: "a" },
          },
        ],
      },
    });
  });
  it("sends the focus notice before even an automatic all-card discard", () => {
    const f = setup([0], [], true);
    start(f, 1);
    expect(f.game.trace).toEqual([
      { kind: "discard-focus", target: "a" },
      { event: "ChoiceMade", data: "cardDiscard:gamerule:$0" },
    ]);
  });
  it("does not prompt, move or emit ChoiceMade when every card is protected", () => {
    const f = setup([0, 1], [0, 1]);
    start(f, 2);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    expect(f.game.cardZones.discard.cards).toEqual([]);
    expect(f.game.trace).toEqual([]);
    expect(f.scheduler.operationCompletion?.value).toBe(true);
  });
  it("returns false without asking when the actor is dead", () => {
    const f = setup([0, 1, 2]);
    f.game.alive.a = false;
    start(f, 1);
    expect(f.scheduler.operationCompletion?.value).toBe(false);
    expect(f.game.trace).toEqual([]);
    expect(f.game.cardZones.a.cards).toEqual([0, 1, 2]);
  });
  it("rejects wrong actors, forged fields, stale tokens and newly protected selections without mutation", () => {
    const f = setup([0, 1, 2, 3]);
    start(f, 2);
    const first = f.admission.view(f.scheduler, "a")!;
    const card0 = first.choices.find(
      (choice) => choice.action === "card" && choice.cardId === 0,
    )!;
    for (const [actor, reply] of [
      ["b", { id: first.id, choice: card0.id }],
      ["a", { id: first.id, choice: "forged" }],
      ["a", { id: first.id, choice: card0.id, actor: "a" }],
      ["a", { id: first.id, choice: null }],
    ] as const) {
      const before = structuredClone({ game: f.game, scheduler: f.scheduler });
      expect(
        f.admission.submit(f.scheduler, f.game, f.registry, actor, reply),
      ).toBe(false);
      expect({ game: f.game, scheduler: f.scheduler }).toEqual(before);
    }
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: first.id,
        choice: card0.id,
      }),
    ).toBe(true);
    const second = f.admission.view(f.scheduler, "a")!;
    const card2 = second.choices.find(
      (choice) => choice.action === "card" && choice.cardId === 2,
    )!;
    f.game.blocked.push(0);
    const before = structuredClone({ game: f.game, scheduler: f.scheduler });
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: second.id,
        choice: card2.id,
      }),
    ).toBe(false);
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: first.id,
        choice: card0.id,
      }),
    ).toBe(false);
    expect({ game: f.game, scheduler: f.scheduler }).toEqual(before);
    const reset = second.choices.find((choice) => choice.action === "reset")!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: second.id,
        choice: reset.id,
      }),
    ).toBe(true);
    expect(
      f.admission
        .view(f.scheduler, "a")!
        .choices.some(
          (choice) => choice.action === "card" && choice.cardId === 0,
        ),
    ).toBe(false);
    expect(f.game.cardZones.discard.cards).toEqual([]);
  });
  it.each([1, 7, 10000])(
    "restores timeout and a nested movement prompt under scheduler budget %s without replay",
    (budget) => {
      let f = setup([0, 1, 2, 3, 4], [1]);
      f.registry.stepBudget = budget;
      f.registry.skills.push({
        id: "movement-pause",
        events: ["BeforeCardsMove"],
        priority: 30,
        rule: true,
        effect: ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "b",
                choices: ["go"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "done", value: false },
      });
      start(f, 2);
      for (let i = 0; i < 3000 && f.scheduler.frames.length; i++) {
        f = {
          ...f,
          ...JSON.parse(
            JSON.stringify({ game: f.game, scheduler: f.scheduler }),
          ),
        };
        if (f.scheduler.yielded) {
          expect(continueTriggerWork(f.scheduler, f.game, f.registry)).toBe(
            true,
          );
          continue;
        }
        const view = f.admission.view(f.scheduler, "a");
        if (view) {
          expect(
            f.admission.timeout(f.scheduler, f.game, f.registry, view.id),
          ).toBe(true);
          continue;
        }
        const p = f.scheduler.prompt!;
        expect(p.actor).toBe("b");
        const before = structuredClone({
          game: f.game,
          scheduler: f.scheduler,
        });
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
            id: p.id,
            choice: "go",
          }),
        ).toBe(false);
        expect({ game: f.game, scheduler: f.scheduler }).toEqual(before);
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, "b", {
            id: p.id,
            choice: "go",
          }),
        ).toBe(true);
      }
      expect(f.scheduler.frames).toEqual([]);
      expect(f.game.cardZones.discard.cards).toHaveLength(2);
      expect(f.game.cardZones.a.cards).toContain(1);
      expect(
        f.game.trace.filter(
          (value) =>
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            value.event === "ChoiceMade",
        ),
      ).toHaveLength(1);
    },
  );
  it("rejects inherited reply fields without advancing the private request", () => {
    const f = setup([0, 1, 2]);
    start(f, 1);
    const view = f.admission.view(f.scheduler, "a")!;
    const reply = Object.assign(Object.create({ choice: view.choices[0].id }), {
      id: view.id,
      extra: "x",
    });
    const before = structuredClone({ game: f.game, scheduler: f.scheduler });
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", reply),
    ).toBe(false);
    expect({ game: f.game, scheduler: f.scheduler }).toEqual(before);
  });
  it("uses the saved Room RNG to discard on a trusted timeout without exposing that action to the actor", () => {
    const one = setup([0, 1, 2, 3], [1]);
    const two = setup([0, 1, 2, 3], [1]);
    start(one, 2);
    start(two, 2);
    const first = one.admission.view(one.scheduler, "a")!;
    const hidden = one.scheduler.prompt!.choices.find(
      (choice) => !first.choices.some((visible) => visible.id === choice.id),
    )!;
    expect(hidden).toBeDefined();
    const before = structuredClone({
      game: one.game,
      scheduler: one.scheduler,
    });
    expect(
      one.admission.submit(one.scheduler, one.game, one.registry, "a", {
        id: first.id,
        choice: hidden.id,
      }),
    ).toBe(false);
    expect({ game: one.game, scheduler: one.scheduler }).toEqual(before);
    const card = first.choices.find(
      (entry) => entry.action === "card" && entry.cardId === 0,
    )!;
    expect(
      one.admission.submit(one.scheduler, one.game, one.registry, "a", {
        id: first.id,
        choice: card.id,
      }),
    ).toBe(true);
    expect(
      one.admission.timeout(one.scheduler, one.game, one.registry, first.id),
    ).toBe(false);
    expect(
      one.admission.timeout(
        one.scheduler,
        one.game,
        one.registry,
        one.scheduler.prompt!.id,
      ),
    ).toBe(true);
    expect(
      two.admission.timeout(
        two.scheduler,
        two.game,
        two.registry,
        two.scheduler.prompt!.id,
      ),
    ).toBe(true);
    expect(
      one.admission.timeout(one.scheduler, one.game, one.registry, first.id),
    ).toBe(false);
    expect(one.game.cardZones.discard.cards).toEqual(
      two.game.cardZones.discard.cards,
    );
    expect(one.game.cardZones.discard.cards).toEqual([3, 2]);
    expect(one.game.cardZones.a.cards).toContain(1);
    expect(one.game.pileRandom).toEqual(two.game.pileRandom);
    expect(one.game.pileRandom.state).toBe(3031295957);
    expect(
      one.game.trace.filter(
        (x) =>
          typeof x === "object" &&
          x !== null &&
          !Array.isArray(x) &&
          x.event === "ChoiceMade",
      ),
    ).toHaveLength(1);
  });
  it("lets the authenticated actor select the required hand cards, then moves them once", () => {
    const f = setup([0, 1, 2, 3], [1]);
    start(f, 2);
    expect(f.admission.view(f.scheduler, "b")).toBeNull();
    for (const id of [0, 2]) {
      const view = f.admission.view(f.scheduler, "a")!;
      const choice = view.choices.find(
        (entry) => entry.action === "card" && entry.cardId === id,
      )!;
      expect(choice).toBeDefined();
      expect(
        f.admission.submit(f.scheduler, f.game, f.registry, "a", {
          id: view.id,
          choice: choice.id,
        }),
      ).toBe(true);
    }
    const view = f.admission.view(f.scheduler, "a")!;
    const confirm = view.choices.find((entry) => entry.action === "confirm")!;
    expect(
      f.admission.submit(f.scheduler, f.game, f.registry, "a", {
        id: view.id,
        choice: confirm.id,
      }),
    ).toBe(true);
    expect(f.game.cardZones.a.cards).toEqual([1, 3]);
    expect(f.game.cardZones.discard.cards).toEqual([2, 0]);
    expect(f.game.trace).toContainEqual({
      event: "ChoiceMade",
      data: "cardDiscard:gamerule:$0+2",
    });
    expect(f.scheduler.operationCompletion?.value).toBe(true);
  });
  it("discards all legal cards without asking when at most the required count are discardable", () => {
    const f = setup([0, 1, 2], [1]);
    start(f, 2);
    expect(f.scheduler.prompt).toBeNull();
    expect(f.game.cardZones.a.cards).toEqual([1]);
    expect(f.game.cardZones.discard.cards).toEqual([2, 0]);
    expect(f.game.trace).toContainEqual({
      event: "ChoiceMade",
      data: "cardDiscard:gamerule:$0+2",
    });
    expect(f.scheduler.operationCompletion?.value).toBe(true);
  });
});
