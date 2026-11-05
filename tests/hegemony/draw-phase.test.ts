import { describe, expect, it } from "vitest";
import {
  createDrawPhaseOperation,
  createDrawPhaseRule,
} from "../../src/game/hegemony/draw-phase";
import {
  dispatchTriggerEvent,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
} from "../../src/game/hegemony/scheduler";
import { drawingSetup, records } from "./drawing-support";

function setup() {
  const state = drawingSetup();
  state.rules.operations!.push(createDrawPhaseOperation());
  state.rules.skills.push(createDrawPhaseRule());
  return state;
}
describe("GameRule Draw phase", () => {
  it.each(["DrawNCards", "GeneralShowed", "AfterDrawNCards"])(
    "preserves eager phase state on interruption at %s",
    (pause) => {
      const { game, scheduler, rules } = setup();
      game.playerFlags.a = ["Global_FirstRound"];
      game.playerMarks.a.Global_GeneralShown = 1;
      game.playerMarks.a.Global_TheFirstToShowRewarded = 1;
      rules.skills.push({
        id: "interrupt",
        priority: 50,
        rule: true,
        events: [pause],
        effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
      });
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "EventPhaseProceeding", target: "a", data: null },
        "a",
      );
      expect(scheduler.interruption?.reason).toBe("turn-broken");
      expect(game.playerFlags.a).toEqual([]);
      expect(game.cardZones.a.cards).toEqual(
        pause === "AfterDrawNCards" ? [0, 1] : [],
      );
      if (pause === "GeneralShowed") {
        expect(game.playerMarks.a.Global_GeneralShown).toBe(0);
        expect(game.playerMarks.a["@firstshow"]).toBeUndefined();
      }
      expect(scheduler.frames.length).toBeGreaterThan(0);
    },
  );
  it("draws the native count through the actual phase rule, player draw and movement", () => {
    const { game, scheduler, rules } = setup();
    game.playerFlags.a = ["Global_FirstRound", "keep"];
    expect(
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "EventPhaseProceeding", target: "a", data: null },
        "a",
      ),
    ).toBe(true);
    expect(game.cardZones.a.cards).toEqual([0, 1]);
    expect(game.playerFlags.a).toEqual(["keep"]);
    expect(
      records(game.trace).filter((entry) => entry.name === "AfterDrawNCards"),
    ).toEqual([{ name: "AfterDrawNCards", target: "a", data: 2 }]);
  });
  it("uses JieyueExtraDraw arithmetic and an empty drawing skill reason", () => {
    const { game, scheduler, rules } = setup();
    game.playerMarks.a.JieyueExtraDraw = 1;
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([0, 1, 2, 3, 4]);
    expect(
      records(game.trace).find((entry) => entry.name === "DrawNCards")?.data,
    ).toBe(5);
    expect(
      records(game.trace).find((entry) => entry.name === "BeforeCardsMove"),
    ).toMatchObject({
      data: {
        moves: [
          { reason: { kind: "draw", actor: "a", skill: "", eventName: "" } },
        ],
      },
    });
  });
  it("executes all three actual free-chain drains and reward grants in native order", () => {
    const { game, scheduler, rules } = setup();
    rules.skills.push({
      id: "queue-rewards",
      priority: 10,
      rule: true,
      events: ["DrawNCards", "CardsMoveOneTime", "AfterDrawNCards"],
      effect: ({ game, event }) => {
        if (event.name !== "CardsMoveOneTime" || event.target === "a") {
          const key =
            event.name === "CardsMoveOneTime"
              ? "Global_General2Shown"
              : "Global_GeneralShown";
          game.playerMarks.a[key] = 1;
          game.playerMarks.a.Global_TheFirstToShowRewarded = 1;
        }
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    const stages = records(game.trace)
      .filter((entry) =>
        ["DrawNCards", "AfterDrawNCards", "GeneralShowed"].includes(
          String(entry.name),
        ),
      )
      .map((entry) => [entry.name, entry.data]);
    expect(stages).toEqual([
      ["DrawNCards", 2],
      ["GeneralShowed", ["head"]],
      ["GeneralShowed", ["deputy"]],
      ["AfterDrawNCards", 2],
      ["GeneralShowed", ["head"]],
    ]);
    expect(game.playerMarks.a["@firstshow"]).toBe(3);
    expect(game.playerMarks.a.Global_GeneralShown).toBe(0);
    expect(game.playerMarks.a.Global_General2Shown).toBe(0);
  });
  it.each([0, -2])(
    "ignores count-event consumption but emits AfterDraw with captured %i",
    (count) => {
      const { game, scheduler, rules } = setup();
      rules.skills.push({
        id: "consume-count",
        priority: 30,
        rule: true,
        events: ["DrawNCards"],
        effect: ({ game, event }) => {
          event.data = count;
          game.playerMarks.a.Global_GeneralShown = 1;
          game.playerMarks.a.Global_TheFirstToShowRewarded = 1;
          return { kind: "done", value: true };
        },
      });
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "EventPhaseProceeding", target: "a", data: null },
        "a",
      );
      expect(game.cardZones.a.cards).toEqual([]);
      expect(
        records(game.trace).filter((entry) => entry.name === "AfterDrawNCards"),
      ).toEqual([{ name: "AfterDrawNCards", target: "a", data: count }]);
      expect(
        records(game.trace).filter((entry) => entry.name === "BeforeCardsMove"),
      ).toEqual([]);
      expect(game.playerMarks.a["@firstshow"]).toBe(1);
    },
  );
  it("captures the rewritten count once and still drains after consumed AfterDraw", () => {
    const { game, scheduler, rules } = setup();
    rules.skills.push({
      id: "rewrite",
      priority: 10,
      rule: true,
      events: ["DrawNCards", "CardsMoveOneTime", "AfterDrawNCards"],
      effect: ({ game, event }) => {
        if (event.name === "DrawNCards") event.data = 1;
        if (event.name === "CardsMoveOneTime")
          game.playerMarks.a.JieyueExtraDraw = 5;
        if (event.name === "AfterDrawNCards") {
          event.data = 99;
          game.playerMarks.a.Global_GeneralShown = 1;
          game.playerMarks.a.Global_TheFirstToShowRewarded = 1;
          return { kind: "done", value: true };
        }
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([0]);
    expect(
      records(game.trace).find((entry) => entry.name === "AfterDrawNCards")
        ?.data,
    ).toBe(1);
    expect(game.playerMarks.a["@firstshow"]).toBe(1);
  });
  it("lets real free-chain surrender kill the recipient before inner drawing", () => {
    const { game, scheduler, rules } = setup();
    rules.skills.push({
      id: "surrender",
      priority: 10,
      rule: true,
      events: ["DrawNCards"],
      effect: ({ game }) => {
        game.surrenderPlayer = "a";
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    expect(game.alive.a).toBe(false);
    expect(game.hp.a).toBe(0);
    expect(game.livingPlayers).toEqual(["b", "c"]);
    expect(game.cardZones.a.cards).toEqual([]);
    expect(
      records(game.trace).find((entry) => entry.name === "AfterDrawNCards")
        ?.data,
    ).toBe(2);
    expect(
      records(game.trace).filter((entry) => entry.name === "FetchDrawPileCard"),
    ).toEqual([]);
  });
  it("does not add a removed-player phase guard", () => {
    const { game, scheduler, rules } = setup();
    game.removed.a = true;
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([0, 1]);
  });
  it("does not execute the Draw owner for another current phase", () => {
    const { game, scheduler, rules } = setup();
    game.playerPhases.a = "play";
    game.playerFlags.a = ["Global_FirstRound"];
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    expect(game.trace).toEqual([]);
    expect(game.playerFlags.a).toEqual(["Global_FirstRound"]);
  });
  it("consumes SkipGameRule once before phase execution", () => {
    const { game, scheduler, rules } = setup();
    game.cardResources.roomTags.SkipGameRule = true;
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    expect(game.cardResources.roomTags.SkipGameRule).toBeUndefined();
    expect(game.cardZones.a.cards).toEqual([]);
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([0, 1]);
  });
  it("rejects invalid count rewrites after preserving earlier free-chain rewards", () => {
    const { game, scheduler, rules } = setup();
    game.playerFlags.a = ["Global_FirstRound"];
    rules.skills.push({
      id: "invalid-count",
      priority: 10,
      rule: true,
      events: ["DrawNCards"],
      effect: ({ game, event }) => {
        event.data = "two";
        game.playerMarks.a.Global_GeneralShown = 1;
        game.playerMarks.a.Global_TheFirstToShowRewarded = 1;
        return { kind: "done", value: false };
      },
    });
    expect(() =>
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "EventPhaseProceeding", target: "a", data: null },
        "a",
      ),
    ).toThrow();
    expect(game.playerMarks.a["@firstshow"]).toBe(1);
    expect(game.playerFlags.a).toEqual([]);
    expect(game.cardZones.a.cards).toEqual([]);
  });
  it.each([715827882, -715827883])(
    "rejects undefined native arithmetic for bonus mark %i before a direct operation frame",
    (mark) => {
      const { game, scheduler, rules } = setup();
      game.playerMarks.a.JieyueExtraDraw = mark;
      game.playerFlags.a = ["Global_FirstRound"];
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "draw-phase", data: { target: "a", data: null } },
          "a",
        ),
      ).toThrow();
      expect(scheduler.frames).toEqual([]);
      expect(game.playerFlags.a).toEqual(["Global_FirstRound"]);
    },
  );
  it.each([
    "DrawNCards",
    "GeneralShowed",
    "AfterDrawNCards",
    "ConfirmMoveCards",
  ])("restores JSON during %s without duplicate draws or rewards", (pause) => {
    const state = setup(),
      { rules } = state;
    let { game, scheduler } = state;
    game.playerMarks.a.Global_GeneralShown = 1;
    game.playerMarks.a.Global_TheFirstToShowRewarded = 1;
    rules.skills.push({
      id: "pause",
      priority: 50,
      rule: true,
      events: [pause],
      effect: ({ event, continuation }) =>
        continuation === null && event.target === "a"
          ? {
              kind: "prompt",
              actor: "a",
              choices: ["go"],
              canCancel: false,
              continuation: true,
            }
          : { kind: "done", value: false },
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "EventPhaseProceeding", target: "a", data: null },
      "a",
    );
    let count = 0;
    while (scheduler.prompt) {
      expect(++count).toBeLessThan(5);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      const reply = { id: getTriggerPrompt(scheduler, "a")!.id, choice: "go" };
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          ...reply,
          id: "stale",
        }),
      ).toBe(false);
      expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
        true,
      );
      expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
        false,
      );
    }
    expect(count).toBeGreaterThan(0);
    expect(game.cardZones.a.cards).toEqual([0, 1]);
    expect(game.playerMarks.a["@firstshow"]).toBe(1);
    expect(
      records(game.trace).filter((entry) => entry.name === "AfterDrawNCards"),
    ).toHaveLength(1);
  });
});
