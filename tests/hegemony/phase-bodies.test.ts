import { describe, expect, it } from "vitest";
import { drawingSetup, records } from "./drawing-support";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import { createAskGeneralShowOperation } from "../../src/game/hegemony/ask-general-show";
import { createShowGeneralOperation } from "../../src/game/hegemony/general";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createCardEffectOperation } from "../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createDrawPhaseOperation } from "../../src/game/hegemony/draw-phase";
import { createPhaseOperations } from "../../src/game/hegemony/phases";
import {
  createTriggerScheduler,
  dispatchTriggerEvent,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  continueTriggerWork,
  unwindTriggerInterruption,
  type TriggerRegistry,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";

function setup() {
  const f = drawingSetup();
  const game = Object.assign(f.game, {
    cardResources: f.game.cardResources!,
    phaseQueues: Object.fromEntries(
      f.game.seatOrder.map((p) => [p, { phases: [], states: [], index: 0 }]),
    ),
    allowed: { head: true, deputy: true },
    lordAvailable: false,
    nullified: false,
    pauses: false,
  });
  game.displayedGenerals.a = { head: "anjiang", deputy: "anjiang" };
  game.cardZones.table = { owner: null, place: "table", cards: [] };
  game.cardZones.delayed = { owner: "a", place: "delayed", cards: [] };
  const canShow = (g: typeof game, _p: string, head: boolean) =>
    head ? g.allowed.head : g.allowed.deputy;
  const registry: TriggerRegistry<typeof game> = {
    version: "phase-bodies-ce4e62b-v1",
    unwind: true,
    skills: [
      ...f.rules.skills,
      createPhaseBodyRule(),
      createCardEffectedRule(),
      {
        id: "body-observe",
        priority: 20,
        rule: true,
        events: [
          "ChoiceMade",
          "GeneralShown",
          "CardEffect",
          "CardEffected",
          "PostCardEffected",
        ],
        effect: ({ game, event }) => {
          game.trace.push({
            event: event.name,
            target: event.target,
            data: structuredClone(event.data),
          });
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      ...f.rules.operations!.filter((o) => o.name !== "move-cards"),
      createCardMovementOperation(),
      ...createPhaseBodyOperations<typeof game>({
        tableZone: "table",
        card: (g, id) => ({
          type: "trick",
          name: g.wrappedCards![id].name,
          className: g.wrappedCards![id].className,
          skillName: "",
          materialIDs: [id],
          flags: [],
        }),
        onNullified: (target, id) => ({
          name: "nullified-trick",
          data: { target, id },
        }),
      }),
      createAskGeneralShowOperation<typeof game>({
        enableLordConversion: true,
        canShow,
        lordAvailable: (g) => g.lordAvailable,
        changeToLord: (target) => ({
          name: "lord-conversion",
          data: { target },
        }),
        notify: (n) => ({ name: "body-notice", data: n }),
      }),
      createShowGeneralOperation<typeof game>({
        canShow,
        preshow: () => ({ name: "adapter", data: null }),
        change: () => ({ name: "adapter", data: null }),
        skills: () => ({ name: "adapter", data: null }),
        notify: () => ({ name: "adapter", data: null }),
        filter: () => ({ name: "adapter", data: null }),
      }),
      ...createPhaseOperations<typeof game>({ notify: () => null }),
      createDrawPhaseOperation(),
      createCardEffectOperation({ isSlash: () => false }),
      createCardEffectedOperation({
        isSlash: () => false,
        isTrick: () => true,
        cancel: () => ({ name: "cancel-trick", data: null }),
        onEffect: (effect) => ({ name: "delayed-body", data: effect }),
      }),
      {
        name: "adapter",
        run: ({ game, continuation }) =>
          game.pauses && continuation === null
            ? {
                kind: "prompt",
                actor: "b",
                choices: ["go"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "return", value: null },
      },
      {
        name: "lord-conversion",
        run: ({ game, operation }) => {
          game.trace.push({ lord: operation.data });
          return { kind: "return", value: null };
        },
      },
      {
        name: "body-notice",
        run: ({ game, operation, continuation }) => {
          if (continuation === null) {
            game.trace.push({ notice: operation.data });
            if (game.pauses)
              return {
                kind: "prompt",
                actor: "a",
                choices: ["go"],
                canCancel: false,
                continuation: true,
              };
          }
          return { kind: "return", value: null };
        },
      },
      {
        name: "cancel-trick",
        run: ({ game }) => ({ kind: "return", value: game.nullified }),
      },
      {
        name: "delayed-body",
        run: ({ game, operation }) => {
          game.trace.push({ effect: operation.data });
          return { kind: "return", value: null };
        },
      },
      {
        name: "nullified-trick",
        run: ({ game, operation }) => {
          game.trace.push({ nullified: operation.data });
          return { kind: "return", value: null };
        },
      },
    ],
  };
  return {
    game,
    registry,
    scheduler: createTriggerScheduler(game.seatOrder, registry.version),
  };
}
function proceed(f: ReturnType<typeof setup>, phase: string) {
  f.game.playerPhases.a = phase;
  return dispatchTriggerEvent(
    f.scheduler,
    f.game,
    f.registry,
    { name: "EventPhaseProceeding", target: "a", data: null },
    "a",
  );
}
function answer(f: ReturnType<typeof setup>, choice: string) {
  const prompt = getTriggerPrompt(f.scheduler, "a")!;
  return resumeTriggerPrompt(f.scheduler, f.game, f.registry, "a", {
    id: prompt.id,
    choice,
  });
}
function delayed(f: ReturnType<typeof setup>) {
  f.game.cardZones.draw.cards = f.game.cardZones.draw.cards.filter(
    (id) => id > 1,
  );
  f.game.cardZones.delayed.cards = [0, 1];
  Object.assign(f.game.wrappedCards![0], {
    name: "indulgence",
    className: "Indulgence",
  });
  Object.assign(f.game.wrappedCards![1], {
    name: "lightning",
    className: "Lightning",
  });
}
describe("GameRule phase bodies", () => {
  it("uses native ignoreRule=true for an accepted reveal after ChoiceMade changes disableShow", () => {
    const f = setup();
    f.registry.skills.unshift({
      id: "late-disable",
      events: ["ChoiceMade"],
      priority: 100,
      rule: true,
      effect: ({ game }) => {
        game.allowed = { head: false, deputy: false };
        return { kind: "done", value: false };
      },
    });
    proceed(f, "round-start");
    answer(f, "show_both_generals");
    expect(f.game.identities.a.headShown).toBe(true);
    expect(f.game.identities.a.deputyShown).toBe(true);
  });
  it("enters RoundStart through execute-phase while a consumed Start gates Proceeding", () => {
    const f = setup();
    f.game.playerPhases.a = "round-start";
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "execute-phase", data: { target: "a" } },
      "a",
    );
    expect(answer(f, "show_head_general")).toBe(true);
    expect(f.game.identities.a.headShown).toBe(true);
    expect(f.scheduler.frames).toEqual([]);
    f.registry.skills.unshift({
      id: "skip-proceed",
      events: ["EventPhaseStart"],
      priority: 100,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.registry,
      { name: "execute-phase", data: { target: "a" } },
      "a",
    );
    expect(f.scheduler.prompt).toBeNull();
    expect(f.game.identities.a.deputyShown).toBe(false);
  });
  it("does not abort the captured Judge loop merely because the live phase changes", () => {
    const f = setup();
    delayed(f);
    f.registry.operations = f.registry.operations!.filter(
      (o) => o.name !== "delayed-body",
    );
    f.registry.operations.push({
      name: "delayed-body",
      run: ({ game }) => {
        game.playerPhases.a = "finish";
        return { kind: "return", value: null };
      },
    });
    proceed(f, "judge");
    expect(f.game.cardZones.table.cards).toEqual([1, 0]);
    expect(f.game.playerPhases.a).toBe("finish");
  });
  it.each([true, false])(
    "returns without a move for an empty/dead Judge (%s)",
    (empty) => {
      const f = setup();
      if (!empty) {
        delayed(f);
        f.game.alive.a = false;
      }
      proceed(f, "judge");
      expect(f.game.cardZones.table.cards).toEqual([]);
      expect(f.scheduler.frames).toEqual([]);
    },
  );
  it.each([1, 7, 10000])(
    "resumes both reveals, lord choice and nested presentation with JSON/budget %i",
    (budget) => {
      const f = setup();
      f.registry.stepBudget = budget;
      f.game.pauses = true;
      f.game.lordAvailable = true;
      f.game.playerMarks.a.HaventShowGeneral = 1;
      f.game.playerMarks.a.Global_RoundCount = 1;
      proceed(f, "round-start");
      let count = 0;
      while (f.scheduler.frames.length) {
        const state = JSON.parse(
          JSON.stringify({ game: f.game, scheduler: f.scheduler }),
        );
        f.game = state.game;
        f.scheduler = state.scheduler;
        expect(++count).toBeLessThan(2000);
        if (f.scheduler.yielded) {
          expect(continueTriggerWork(f.scheduler, f.game, f.registry)).toBe(
            true,
          );
          continue;
        }
        const actor = f.scheduler.prompt!.actor,
          prompt = getTriggerPrompt(f.scheduler, actor)!;
        const choice = prompt.choices.some((c) => c.id === "show_both_generals")
          ? "show_both_generals"
          : prompt.choices.some((c) => c.id === "yes")
            ? "yes"
            : "go";
        const before = JSON.stringify({ game: f.game, scheduler: f.scheduler });
        expect(
          resumeTriggerPrompt(
            f.scheduler,
            f.game,
            f.registry,
            actor === "a" ? "b" : "a",
            { id: prompt.id, choice },
          ),
        ).toBe(false);
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, actor, {
            id: prompt.id,
            choice: "unoffered",
          }),
        ).toBe(false);
        expect(JSON.stringify({ game: f.game, scheduler: f.scheduler })).toBe(
          before,
        );
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, actor, {
            id: prompt.id,
            choice,
          }),
        ).toBe(true);
        expect(
          resumeTriggerPrompt(f.scheduler, f.game, f.registry, actor, {
            id: prompt.id,
            choice,
          }),
        ).toBe(false);
      }
      expect(
        f.game.identities.a.headShown && f.game.identities.a.deputyShown,
      ).toBe(true);
      expect(
        records(f.game.trace)
          .filter((x) => x.event === "GeneralShown")
          .map((x) => x.data),
      ).toEqual([true, false]);
      expect(
        records(f.game.trace).filter((x) => x.event === "ChoiceMade"),
      ).toHaveLength(2);
      expect(records(f.game.trace).filter((x) => "lord" in x)).toHaveLength(1);
      expect(records(f.game.trace).filter((x) => "notice" in x)).toHaveLength(
        1,
      );
    },
  );
  it("resumes real cancellation and onNullified movement without replaying after JSON", () => {
    const f = setup();
    delayed(f);
    f.game.nullified = true;
    f.registry.stepBudget = 1;
    f.registry.operations = f.registry.operations!.filter(
      (o) => o.name !== "nullified-trick",
    );
    f.registry.operations.push({
      name: "nullified-trick",
      run: ({ game, operation, continuation }) => {
        const data = operation.data as { target: string; id: number };
        if (continuation === null) {
          game.trace.push({ nullified: data });
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: { moves: [{ ids: [data.id], to: "discard" }] },
            },
            continuation: true,
          };
        }
        if (continuation === true)
          return {
            kind: "prompt",
            actor: "b",
            choices: ["go"],
            canCancel: false,
            continuation: "done",
          };
        return { kind: "return", value: null };
      },
    });
    proceed(f, "judge");
    let count = 0;
    while (f.scheduler.frames.length) {
      const state = JSON.parse(
        JSON.stringify({ game: f.game, scheduler: f.scheduler }),
      );
      f.game = state.game;
      f.scheduler = state.scheduler;
      expect(++count).toBeLessThan(2000);
      if (f.scheduler.yielded) {
        continueTriggerWork(f.scheduler, f.game, f.registry);
        continue;
      }
      const prompt = getTriggerPrompt(f.scheduler, "b")!;
      expect(prompt).not.toBeNull();
      expect(
        resumeTriggerPrompt(f.scheduler, f.game, f.registry, "b", {
          id: prompt.id,
          choice: "go",
        }),
      ).toBe(true);
    }
    expect(f.game.cardZones.table.cards).toEqual([]);
    expect(f.game.cardZones.discard.cards).toEqual([0, 1]);
    expect(records(f.game.trace).filter((x) => "nullified" in x)).toHaveLength(
      2,
    );
  });
  it("fails explicitly for a missing card-effect child after retaining the real table move", () => {
    const f = setup();
    delayed(f);
    f.registry.operations = f.registry.operations!.filter(
      (o) => o.name !== "card-effect",
    );
    expect(() => proceed(f, "judge")).toThrow("Unknown scheduler operation");
    expect(f.game.cardZones.table.cards).toEqual([1]);
    expect(f.game.cardZones.delayed.cards).toEqual([0]);
  });
  it("honors null-target/consumed/SkipGameRule entry without touching reveal state", () => {
    const f = setup();
    f.game.cardResources.roomTags.SkipGameRule = true;
    dispatchTriggerEvent(
      f.scheduler,
      f.game,
      f.registry,
      { name: "EventPhaseProceeding", target: null, data: null },
      null,
    );
    expect(f.game.cardResources.roomTags.SkipGameRule).toBeUndefined();
    expect(f.scheduler.prompt).toBeNull();
    f.game.cardResources.roomTags.SkipGameRule = true;
    f.registry.skills.unshift({
      id: "consume-phase",
      events: ["EventPhaseProceeding"],
      priority: 100,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    proceed(f, "round-start");
    expect(f.game.cardResources.roomTags.SkipGameRule).toBe(true);
    expect(f.scheduler.prompt).toBeNull();
  });
  it("routes Draw once through the existing real operation and consumes SkipGameRule once", () => {
    const f = setup();
    proceed(f, "draw");
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    expect(
      records(f.game.trace).filter((x) => x.name === "DrawNCards"),
    ).toHaveLength(1);
    f.game.cardResources.roomTags.SkipGameRule = true;
    proceed(f, "draw");
    expect(f.game.cardResources.roomTags.SkipGameRule).toBeUndefined();
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
  });
  it.each(["start", "finish", "not-active"])(
    "keeps %s Proceeding empty",
    (phase) => {
      const f = setup();
      proceed(f, phase);
      expect(f.scheduler.frames).toEqual([]);
      expect(f.game.trace).toEqual([]);
    },
  );
  it.each(["play", "discard"])(
    "fails on missing required %s phase composition",
    (phase) => {
      const f = setup();
      expect(() => proceed(f, phase)).toThrow("Unknown scheduler operation");
    },
  );
  it("calls onNullified for real Room cancellation, including both captured tricks", () => {
    const f = setup();
    delayed(f);
    f.game.nullified = true;
    proceed(f, "judge");
    expect(
      records(f.game.trace).flatMap((x) => (x.nullified ? [x.nullified] : [])),
    ).toEqual([
      { target: "a", id: 1 },
      { target: "a", id: 0 },
    ]);
    expect(records(f.game.trace).some((x) => "effect" in x)).toBe(false);
    expect(f.game.cardZones.table.cards).toEqual([1, 0]);
  });
  it("does not treat a consumed PostCardEffected as the caller's false result", () => {
    const f = setup();
    delayed(f);
    f.registry.skills.unshift({
      id: "post-consume",
      events: ["PostCardEffected"],
      priority: 100,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    proceed(f, "judge");
    expect(records(f.game.trace).filter((x) => "effect" in x)).toHaveLength(2);
    expect(records(f.game.trace).some((x) => "nullified" in x)).toBe(false);
  });
  it("keeps the captured trick list, resolves relocated cards, and leaves new delayed cards for later", () => {
    const f = setup();
    delayed(f);
    f.registry.operations = f.registry.operations!.filter(
      (o) => o.name !== "delayed-body",
    );
    f.registry.operations.push({
      name: "delayed-body",
      run: ({ game, operation, continuation }) => {
        if (continuation === null) {
          game.trace.push({ effect: operation.data });
          if (game.cardZones.delayed.cards.includes(0))
            return {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  moves: [
                    { ids: [0], to: "b" },
                    { ids: [2], to: "delayed" },
                  ],
                },
              },
              continuation: true,
            };
        }
        return { kind: "return", value: null };
      },
    });
    proceed(f, "judge");
    expect(f.game.cardZones.table.cards).toEqual([1, 0]);
    expect(f.game.cardZones.delayed.cards).toEqual([2]);
    expect(f.game.cardZones.b.cards).toEqual([]);
    expect(records(f.game.trace).filter((x) => "effect" in x)).toHaveLength(2);
  });
  it("reads the physical wrapper again after movement before cardEffect", () => {
    const f = setup();
    delayed(f);
    f.registry.skills.push({
      id: "transform-moved",
      events: ["CardsMoveOneTime"],
      rule: true,
      priority: 30,
      effect: ({ game }) => {
        Object.assign(game.wrappedCards![1], {
          name: "supply_shortage",
          className: "SupplyShortage",
        });
        return { kind: "done", value: false };
      },
    });
    proceed(f, "judge");
    const first = records(f.game.trace).find((x) => x.effect)?.effect as {
      card: { name: string };
    };
    expect(first.card.name).toBe("supply_shortage");
  });
  it("stops the captured loop after death but still invokes the current card's nullified tail", () => {
    const f = setup();
    delayed(f);
    f.registry.skills.unshift({
      id: "death-during-move",
      events: ["BeforeCardsMove"],
      rule: true,
      priority: 100,
      effect: ({ game }) => {
        game.alive.a = false;
        return { kind: "done", value: false };
      },
    });
    proceed(f, "judge");
    expect(f.game.cardZones.table.cards).toEqual([1]);
    expect(f.game.cardZones.delayed.cards).toEqual([0]);
    expect(
      records(f.game.trace).flatMap((x) => (x.nullified ? [x.nullified] : [])),
    ).toEqual([{ target: "a", id: 1 }]);
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "retains movement and pending tricks through %s unwind",
    (reason) => {
      const f = setup();
      delayed(f);
      f.registry.skills.unshift({
        id: "interrupt-effect",
        events: ["CardEffected"],
        priority: 100,
        rule: true,
        effect: () => ({ kind: "interrupt", reason }),
      });
      proceed(f, "judge");
      expect(f.scheduler.interruption?.reason).toBe(reason);
      expect(
        unwindTriggerInterruption(
          f.scheduler,
          f.game,
          f.registry,
          f.scheduler.interruption!,
        ),
      ).toBe(true);
      expect(f.game.cardZones.table.cards).toEqual([1]);
      expect(f.game.cardZones.delayed.cards).toEqual([0]);
      expect(
        records(f.game.trace).some((x) => "nullified" in x || "effect" in x),
      ).toBe(false);
    },
  );
  it("rejects missing actual-head metadata of a living duplicate-check participant", () => {
    const f = setup();
    f.game.lordAvailable = true;
    f.game.generalNames.b = [];
    f.game.playerMarks.a.HaventShowGeneral = 1;
    f.game.playerMarks.a.Global_RoundCount = 1;
    expect(() => proceed(f, "round-start")).toThrow(
      "Invalid actual head general",
    );
  });
  it.each(["cancel", "blocked", "already-shown"])(
    "handles the reveal %s gate without mutations",
    (scenario) => {
      const f = setup();
      if (scenario === "blocked")
        f.game.allowed = { head: false, deputy: false };
      if (scenario === "already-shown") {
        f.game.identities.a.headShown = true;
        f.game.identities.a.deputyShown = true;
      }
      proceed(f, "round-start");
      if (scenario === "already-shown") expect(f.scheduler.prompt).toBeNull();
      else {
        if (scenario === "blocked")
          expect(
            getTriggerPrompt(f.scheduler, "a")!.choices.map((c) => c.id),
          ).toEqual(["cancel"]);
        answer(f, "cancel");
      }
      expect(
        records(f.game.trace).filter((x) => x.event === "GeneralShown"),
      ).toEqual([]);
      expect(
        records(f.game.trace).filter((x) => x.event === "ChoiceMade"),
      ).toHaveLength(scenario === "already-shown" ? 0 : 1);
    },
  );
  it.each(["later-round", "no-token", "duplicate", "head-shown"])(
    "does not offer lord conversion for %s",
    (scenario) => {
      const f = setup();
      f.game.lordAvailable = true;
      f.game.playerMarks.a.HaventShowGeneral = 1;
      f.game.playerMarks.a.Global_RoundCount = 1;
      if (scenario === "later-round")
        f.game.playerMarks.a.Global_RoundCount = 2;
      if (scenario === "no-token") f.game.playerMarks.a.HaventShowGeneral = 0;
      if (scenario === "duplicate")
        f.game.generalNames.b = ["a-head", "b-deputy"];
      if (scenario === "head-shown") f.game.identities.a.headShown = true;
      proceed(f, "round-start");
      answer(
        f,
        scenario === "head-shown" ? "show_both_generals" : "show_head_general",
      );
      expect(f.scheduler.prompt).toBeNull();
      expect(records(f.game.trace).some((x) => "lord" in x)).toBe(false);
    },
  );
  it("captures lord eligibility before ChoiceMade but uses live shown flags for the reveal tail", () => {
    const f = setup();
    f.game.lordAvailable = true;
    f.game.playerMarks.a.HaventShowGeneral = 1;
    f.game.playerMarks.a.Global_RoundCount = 1;
    f.registry.skills.push({
      id: "change-choice-facts",
      events: ["ChoiceMade"],
      priority: 30,
      rule: true,
      effect: ({ game, event }) => {
        game.lordAvailable = false;
        if (event.data === "skillChoice:changetolord:no")
          game.identities.a.deputyShown = true;
        event.data = "rewritten";
        return { kind: "done", value: true };
      },
    });
    proceed(f, "round-start");
    answer(f, "show_both_generals");
    expect(
      getTriggerPrompt(f.scheduler, "a")!.choices.map((c) => c.id),
    ).toEqual(["yes", "no"]);
    answer(f, "no");
    expect(
      records(f.game.trace)
        .filter((x) => x.event === "GeneralShown")
        .map((x) => x.data),
    ).toEqual([true]);
    expect(records(f.game.trace).some((x) => "lord" in x)).toBe(false);
  });
  it("retains the native both-generals choice even when the head is already shown", () => {
    const f = setup();
    f.game.identities.a.headShown = true;
    proceed(f, "round-start");
    expect(
      getTriggerPrompt(f.scheduler, "a")!.choices.map((c) => c.id),
    ).toEqual(["show_deputy_general", "show_both_generals", "cancel"]);
    answer(f, "show_both_generals");
    expect(
      records(f.game.trace)
        .filter((x) => x.event === "GeneralShown")
        .map((x) => x.data),
    ).toEqual([false]);
  });
  it("Judge captures delayed tricks, moves last first to table and runs real null-source card effects", () => {
    const f = setup();
    f.game.cardZones.draw.cards = f.game.cardZones.draw.cards.filter(
      (id) => id > 1,
    );
    f.game.cardZones.delayed.cards = [0, 1];
    Object.assign(f.game.wrappedCards![0], {
      name: "indulgence",
      className: "Indulgence",
    });
    Object.assign(f.game.wrappedCards![1], {
      name: "lightning",
      className: "Lightning",
    });
    expect(proceed(f, "judge")).toBe(true);
    expect(f.game.cardZones.delayed.cards).toEqual([]);
    expect(f.game.cardZones.table.cards).toEqual([1, 0]);
    const effects = records(f.game.trace).flatMap((x) =>
      x.effect ? [x.effect] : [],
    );
    expect(effects).toEqual([
      {
        from: null,
        to: "a",
        card: {
          type: "trick",
          name: "lightning",
          className: "Lightning",
          skillName: "",
          materialIDs: [1],
          flags: [],
        },
        multiple: false,
        nullified: false,
        disresponsive: false,
      },
      {
        from: null,
        to: "a",
        card: {
          type: "trick",
          name: "indulgence",
          className: "Indulgence",
          skillName: "",
          materialIDs: [0],
          flags: [],
        },
        multiple: false,
        nullified: false,
        disresponsive: false,
      },
    ]);
    expect(records(f.game.trace).some((x) => "nullified" in x)).toBe(false);
  });
  it("asks optional lord conversion before real head reveal and keeps both ChoiceMade decisions", () => {
    const f = setup();
    f.game.lordAvailable = true;
    f.game.playerMarks.a.HaventShowGeneral = 1;
    f.game.playerMarks.a.Global_RoundCount = 1;
    proceed(f, "round-start");
    answer(f, "show_head_general");
    expect(
      getTriggerPrompt(f.scheduler, "a")?.choices.map((c) => c.id),
    ).toEqual(["yes", "no"]);
    expect(answer(f, "yes")).toBe(true);
    const trace = records(f.game.trace);
    expect(trace.findIndex((x) => "lord" in x)).toBeLessThan(
      trace.findIndex((x) => x.event === "GeneralShown"),
    );
    expect(
      trace.filter((x) => x.event === "ChoiceMade").map((x) => x.data),
    ).toEqual([
      "skillChoice:GameRule_AskForGeneralShow:show_head_general",
      "skillChoice:changetolord:yes",
    ]);
  });
  it("RoundStart offers a real reveal and both choices reveal through show-general in source order", () => {
    const f = setup();
    f.game.playerMarks.a.HaventShowGeneral = 1;
    f.game.playerMarks.a.Global_RoundCount = 1;
    expect(proceed(f, "round-start")).toBe(true);
    expect(getTriggerPrompt(f.scheduler, "b")).toBeNull();
    expect(
      getTriggerPrompt(f.scheduler, "a")!.choices.map((c) => c.id),
    ).toEqual([
      "show_head_general",
      "show_deputy_general",
      "show_both_generals",
      "cancel",
    ]);
    expect(answer(f, "show_both_generals")).toBe(true);
    expect(f.game.identities.a.headShown).toBe(true);
    expect(f.game.identities.a.deputyShown).toBe(true);
    expect(
      records(f.game.trace)
        .filter((x) => x.event === "GeneralShown")
        .map((x) => x.data),
    ).toEqual([true, false]);
    expect(
      records(f.game.trace)
        .filter((x) => x.event === "ChoiceMade")
        .map((x) => x.data),
    ).toEqual(["skillChoice:GameRule_AskForGeneralShow:show_both_generals"]);
  });
});
