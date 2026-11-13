import { describe, expect, it } from "vitest";
import { drawingSetup, type DrawingGame } from "./drawing-support";
import {
  createPlayPhaseOperation,
  type PlayPhaseGame,
} from "../../src/game/hegemony/play-phase";
import { createCardCommandAdmission } from "../../src/game/hegemony/card-command";
import { createRoomUseCardOperation } from "../../src/game/hegemony/room-use-card";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import {
  createPhaseBodyOperations,
  createPhaseBodyRule,
} from "../../src/game/hegemony/phase-bodies";
import { createPhaseOperations } from "../../src/game/hegemony/phases";
import {
  createTriggerScheduler,
  continueTriggerWork,
  resumeTriggerPrompt,
  unwindTriggerInterruption,
  dispatchTriggerOperation,
  type TriggerRegistry,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";

type Game = PlayPhaseGame &
  DrawingGame & {
    trace: TriggerData[];
    reject: boolean;
    pendingSurrender: boolean;
    mode: string;
    pauses: boolean;
  };
function setup() {
  const f = drawingSetup();
  const game: Game = {
    ...f.game,
    currentPlayer: "a",
    phaseQueues: {},
    reject: false,
    pendingSurrender: false,
    mode: "",
    pauses: false,
  };
  game.playerPhases.a = "play";
  game.cardZones.draw.cards = game.cardZones.draw.cards.slice(2);
  game.cardZones.a.cards = [0, 1];
  game.cardZones.table = { owner: null, place: "table", cards: [] };
  game.cardResources!.cards.Test = {
    kind: "virtual",
    key: "test",
    isSlash: false,
    isNDTrick: false,
    flags: [],
    tags: {},
  };
  const admission = createCardCommandAdmission<Game, string>(
    {
      inPlay: (g, actor) => g.playerPhases[actor] === "play",
      contextValid: (_g, r) => r.context === "turn-1",
      offers: (g, r) =>
        g.cardZones.a.cards.map((id) => ({
          id: `offer-${id}`,
          version: "fixture",
          label: `Bài ${id}`,
          targetFixed: true,
          multipleVotes: false,
          entry: {
            reference: "Test",
            use: {
              from: r.actor,
              to: [],
              card: {
                type: "basic",
                name: "test",
                className: "Test",
                skillName: "",
                materialIDs: [id],
                flags: [],
              },
            },
          },
        })),
      enabled: () => true,
      skillAllowed: () => true,
      matchesPattern: () => true,
      materialAllowed: (g, r, _o, _id, zone) =>
        g.cardZones[zone].owner === r.actor &&
        g.cardZones[zone].place === "hand",
      targetFilter: () => false,
      prohibited: () => false,
      feasible: (_g, _r, entry) => entry.use.to.length === 0,
    },
    (actor) => actor,
  );
  const resources = { reference: () => "Test" };
  const rules: TriggerRegistry<Game> = {
    version: "play-phase-ce4e62b",
    skills: [
      createPhaseBodyRule(),
      createCardUsedRule(),
      createCardFinishedRule(resources),
      {
        id: "play-observer",
        events: ["PlayCard", "ChoiceMade", "GeneralShowed"],
        priority: 20,
        rule: true,
        effect: ({ game, event }) => {
          game.trace.push(event.name);
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      ...f.rules.operations!,
      ...createPhaseOperations<Game>({ notify: () => null }),
      ...createPhaseBodyOperations<Game>({
        tableZone: "table",
        card: () => {
          throw Error("No Judge card fixture");
        },
        onNullified: () => {
          throw Error("No Judge nullification fixture");
        },
      }),
      createPlayPhaseOperation<Game>({
        context: () => "turn-1",
        pendingSurrender: (g, target) =>
          g.pendingSurrender
            ? { name: "surrender-fixture", data: target }
            : null,
        notify: (n) => ({ name: "play-notice", data: n }),
      }),
      admission.operation,
      createRoomUseCardOperation({
        parse: (_g, entry) => entry,
        inPlay: (g, p) => g.playerPhases[p] === "play",
        limited: () => false,
        notify: () => null,
        metadata: (_g, entry) => ({
          identity: entry.reference,
          realIdentity: entry.reference,
          virtual: true,
          lua: false,
          delayed: false,
          handlingMethod: "use",
          canRecast: false,
          face: {
            name: "test",
            className: "Test",
            skillName: "",
            suit: "no-suit",
            number: 0,
          },
          showSkill: "",
        }),
        validate: (data) => ({ name: "validate-fixture", data }),
        // Fixture target-fixed package supplies its implied recipient.
        onUse: ({ use }) => ({
          name: "card-on-use",
          data: { ...use, to: ["b"] },
        }),
        after: () => ({ name: "after-fixture", data: null }),
      }),
      {
        name: "validate-fixture",
        run: ({ game, operation }) => {
          if (game.reject) {
            game.trace.push("rejected");
            game.playerMarks.b.Global_GeneralShown = 1;
            return { kind: "return", value: null };
          }
          return {
            kind: "return",
            value: { entry: operation.data, validated: operation.data },
          };
        },
      },
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardUsedOperation({
        resources,
        use: (data) => ({ name: "card-use", data }),
      }),
      createCardUseOperation({
        ...resources,
        effect: () => ({ name: "effect-fixture", data: null }),
      }),
      {
        name: "effect-fixture",
        run: ({ game, continuation }) => {
          if (continuation === null) {
            game.trace.push("effect");
            game.playerMarks.b.Global_GeneralShown = 1;
            if (game.pauses)
              return {
                kind: "prompt",
                actor: "b",
                choices: ["go"],
                canCancel: false,
                continuation: true,
              };
          }
          return { kind: "return", value: null };
        },
      },
      {
        name: "after-fixture",
        run: ({ game }) => {
          game.trace.push("after");
          if (game.mode === "terminate")
            game.playerFlags.a.push("Global_PlayPhaseTerminated");
          if (game.mode === "phase") game.playerPhases.a = "finish";
          if (game.mode === "death") game.alive.a = false;
          return { kind: "return", value: null };
        },
      },
      {
        name: "surrender-fixture",
        run: ({ game }) => {
          game.pendingSurrender = false;
          game.trace.push("surrender");
          return { kind: "return", value: null };
        },
      },
      {
        name: "play-notice",
        run: ({ game, operation, continuation }) => {
          if (continuation === null) {
            game.trace.push(operation.data);
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
    ],
  };
  return {
    game,
    rules,
    scheduler: createTriggerScheduler(game.seatOrder, rules.version),
    admission,
  };
}
type Fixture = ReturnType<typeof setup>;
function start(f: Fixture) {
  expect(
    dispatchTriggerOperation(
      f.scheduler,
      f.game,
      f.rules,
      {
        name: "play-phase",
        data: { target: "a", data: null },
      },
      "a",
    ),
  ).toBe(true);
}
function choose(f: Fixture, label: string | null) {
  const view = f.admission.view(f.scheduler, "a")!;
  expect(view).not.toBeNull();
  const choice =
    label === null ? null : view.choices.find((c) => c.label === label)!.id;
  expect(
    f.admission.submit(f.scheduler, f.game, f.rules, "a", {
      id: view.id,
      choice,
    }),
  ).toBe(true);
}
describe("Play phase body", () => {
  it("uses consecutive admitted cards through Room, draining reveal rewards before the next activation", () => {
    const f = setup();
    start(f);
    choose(f, "Bài 0");
    choose(f, "Xác nhận");
    choose(f, "Bài 1");
    choose(f, "Xác nhận");
    choose(f, null);
    expect(f.game.cardZones.a.cards).toEqual([]);
    expect(f.game.cardZones.discard.cards).toEqual([1, 0]);
    expect(f.game.playerHistory.a.Test).toBe(2);
    expect(f.game.playerMarks.b.Global_GeneralShown).toBe(0);
    expect(f.game.trace).toEqual([
      { kind: "history", target: null, name: "pushPile", times: 1 },
      "PlayCard",
      "ChoiceMade",
      "effect",
      "after",
      "GeneralShowed",
      { kind: "history", target: null, name: "pushPile", times: 1 },
      "PlayCard",
      "ChoiceMade",
      "effect",
      "after",
      "GeneralShowed",
      { kind: "history", target: null, name: "pushPile", times: 1 },
      "PlayCard",
    ]);
    expect(f.scheduler.frames).toEqual([]);
    expect(f.scheduler.prompt).toBeNull();
  });
  it("drains free-chain after a real Room rejection and starts a fresh PlayCard activation", () => {
    const f = setup();
    f.game.reject = true;
    start(f);
    choose(f, "Bài 0");
    choose(f, "Xác nhận");
    expect(f.game.trace).toEqual([
      { kind: "history", target: null, name: "pushPile", times: 1 },
      "PlayCard",
      "ChoiceMade",
      "rejected",
      "GeneralShowed",
      { kind: "history", target: null, name: "pushPile", times: 1 },
      "PlayCard",
    ]);
    expect(f.game.cardZones.a.cards).toEqual([0, 1]);
    expect(f.game.playerHistory.a).toEqual({});
    f.game.reject = false;
    choose(f, "Bài 0");
    choose(f, "Xác nhận");
    choose(f, null);
    expect(f.game.cardZones.discard.cards).toEqual([0]);
    expect(f.game.playerHistory.a.Test).toBe(1);
  });
  it.each(["terminate", "phase", "death"])(
    "stops after a use with %s, retaining its completed cost and reward tail",
    (mode) => {
      const f = setup();
      f.game.mode = mode;
      start(f);
      choose(f, "Bài 0");
      choose(f, "Xác nhận");
      expect(f.scheduler.frames).toEqual([]);
      expect(f.game.trace.filter((x) => x === "PlayCard")).toHaveLength(1);
      expect(f.game.trace).toContain("GeneralShowed");
      expect(f.game.cardZones.discard.cards).toEqual([0]);
      expect(f.game.playerFlags.a).not.toContain("Global_PlayPhaseTerminated");
    },
  );
  it.each(["terminate", "phase", "death", "wrong-current"])(
    "does not admit a card when the initial gate is %s",
    (mode) => {
      const f = setup();
      if (mode === "terminate")
        f.game.playerFlags.a = ["keep", "Global_PlayPhaseTerminated"];
      if (mode === "phase") f.game.playerPhases.a = "finish";
      if (mode === "death") f.game.alive.a = false;
      if (mode === "wrong-current") f.game.currentPlayer = "b";
      start(f);
      expect(f.scheduler.frames).toEqual([]);
      expect(f.game.trace.filter((x) => x === "PlayCard")).toEqual([]);
      expect(f.game.cardZones.a.cards).toEqual([0, 1]);
      if (mode === "terminate") expect(f.game.playerFlags.a).toEqual(["keep"]);
    },
  );
  it("handles pending surrender before the termination gate and emits no activation on cancel", () => {
    const f = setup();
    f.game.pendingSurrender = true;
    f.game.playerFlags.a.push("Global_PlayPhaseTerminated");
    start(f);
    expect(f.game.trace).toEqual(["surrender"]);
    expect(f.scheduler.frames).toEqual([]);
    expect(f.game.playerFlags.a).toEqual([]);
    start(f);
    choose(f, null);
    expect(f.game.trace.filter((x) => x === "ChoiceMade")).toEqual([]);
    expect(f.game.playerHistory.a).toEqual({});
  });
  it("routes the shared Proceeding body through execute-phase and preserves its End event", () => {
    const f = setup();
    f.rules.skills.push({
      id: "phase-events",
      events: ["EventPhaseStart", "EventPhaseEnd"],
      priority: 30,
      rule: true,
      effect: ({ game, event }) => {
        game.trace.push(event.name);
        return { kind: "done", value: false };
      },
    });
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.rules,
        { name: "execute-phase", data: { target: "a" } },
        "a",
      ),
    ).toBe(true);
    choose(f, null);
    expect(f.game.trace).toEqual([
      "EventPhaseStart",
      { kind: "history", target: null, name: "pushPile", times: 1 },
      "PlayCard",
      "EventPhaseEnd",
    ]);
  });
  it("does not run Play when EventPhaseStart is consumed", () => {
    const f = setup();
    f.rules.skills.push({
      id: "consume-start",
      events: ["EventPhaseStart"],
      priority: 30,
      rule: true,
      effect: () => ({ kind: "done", value: true }),
    });
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.rules,
        { name: "execute-phase", data: { target: "a" } },
        "a",
      ),
    ).toBe(true);
    expect(f.scheduler.frames).toEqual([]);
    expect(f.game.trace).toEqual([]);
  });
  it("ignores a null GameRule target", () => {
    const f = setup();
    expect(
      dispatchTriggerOperation(
        f.scheduler,
        f.game,
        f.rules,
        { name: "play-phase", data: { target: null, data: null } },
        "a",
      ),
    ).toBe(true);
    expect(f.scheduler.frames).toEqual([]);
    expect(f.game.trace).toEqual([]);
  });
  it.each(["card-use-request", "free-chain"])(
    "fails explicitly when required %s is missing",
    (name) => {
      const f = setup();
      f.rules.operations = f.rules.operations!.filter((op) => op.name !== name);
      if (name === "card-use-request") expect(() => start(f)).toThrow();
      else {
        start(f);
        choose(f, "Bài 0");
        expect(() => choose(f, "Xác nhận")).toThrow();
        expect(f.game.cardZones.discard.cards).toEqual([0]);
      }
    },
  );
  it("preserves another actor's privacy and rejects stale, forged and unoffered replies", () => {
    const f = setup();
    start(f);
    const first = f.admission.view(f.scheduler, "a")!;
    expect(f.admission.view(f.scheduler, "b")).toBeNull();
    expect(JSON.stringify(first)).not.toMatch(
      /offer-|materialIDs|reference|context/,
    );
    for (const [actor, reply] of [
      ["b", { id: first.id, choice: first.choices[0].id }],
      ["a", { id: first.id, choice: "unoffered" }],
      ["a", { id: first.id, choice: first.choices[0].id, actor: "a" }],
    ] as const) {
      const before = structuredClone({ game: f.game, scheduler: f.scheduler });
      expect(
        f.admission.submit(f.scheduler, f.game, f.rules, actor, reply),
      ).toBe(false);
      expect({ game: f.game, scheduler: f.scheduler }).toEqual(before);
    }
    choose(f, "Bài 0");
    const before = structuredClone({ game: f.game, scheduler: f.scheduler });
    expect(
      f.admission.submit(f.scheduler, f.game, f.rules, "a", {
        id: first.id,
        choice: first.choices[0].id,
      }),
    ).toBe(false);
    expect({ game: f.game, scheduler: f.scheduler }).toEqual(before);
  });
  it.each([1, 7, 10000])(
    "restores every prompt and cooperative yield with budget %s without replaying costs or notifications",
    (stepBudget) => {
      let f = setup();
      f.game.pauses = true;
      f.rules.stepBudget = stepBudget;
      start(f);
      let decisions = 0;
      for (let guard = 0; f.scheduler.frames.length && guard < 3000; guard++) {
        f = {
          ...f,
          ...JSON.parse(
            JSON.stringify({ game: f.game, scheduler: f.scheduler }),
          ),
        };
        if (f.scheduler.yielded) {
          expect(continueTriggerWork(f.scheduler, f.game, f.rules)).toBe(true);
          continue;
        }
        const p = f.scheduler.prompt!;
        expect(p).not.toBeNull();
        const view = f.admission.view(f.scheduler, "a");
        if (view) {
          const label =
            decisions++ === 0 ? "Bài 0" : decisions === 2 ? "Xác nhận" : null;
          choose(f, label);
        } else {
          const before = structuredClone({
            game: f.game,
            scheduler: f.scheduler,
          });
          expect(
            resumeTriggerPrompt(
              f.scheduler,
              f.game,
              f.rules,
              p.actor === "a" ? "b" : "a",
              { id: p.id, choice: "go" },
            ),
          ).toBe(false);
          expect({ game: f.game, scheduler: f.scheduler }).toEqual(before);
          expect(
            resumeTriggerPrompt(f.scheduler, f.game, f.rules, p.actor, {
              id: p.id,
              choice: "go",
            }),
          ).toBe(true);
        }
      }
      expect(f.scheduler.frames).toEqual([]);
      expect(decisions).toBe(3);
      expect(f.game.cardZones.discard.cards).toEqual([0]);
      expect(f.game.playerHistory.a.Test).toBe(1);
      expect(f.game.trace.filter((x) => x === "effect")).toHaveLength(1);
      expect(f.game.trace.filter((x) => typeof x === "object")).toHaveLength(2);
      expect(f.game.trace.filter((x) => x === "GeneralShowed")).toHaveLength(1);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "abandons the Play loop on %s instead of starting another activation",
    (reason) => {
      const f = setup();
      f.rules.unwind = true;
      f.rules.skills.push({
        id: "interrupt-play",
        events: ["PlayCard"],
        priority: 30,
        rule: true,
        effect: () => ({ kind: "interrupt", reason }),
      });
      start(f);
      expect(f.scheduler.interruption?.reason).toBe(reason);
      expect(
        unwindTriggerInterruption(
          f.scheduler,
          f.game,
          f.rules,
          f.scheduler.interruption!,
        ),
      ).toBe(true);
      expect(f.scheduler.frames).toEqual([]);
      expect(f.game.cardZones.a.cards).toEqual([0, 1]);
      expect(f.game.playerHistory.a).toEqual({});
      expect(f.game.trace).toHaveLength(1);
    },
  );
});
