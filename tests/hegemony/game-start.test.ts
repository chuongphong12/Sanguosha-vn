import { describe, expect, it } from "vitest";
import {
  createGameStartOperation,
  createGameStartRule,
  type GameStartRules,
} from "../../src/game/hegemony/game-start";
import {
  dispatchTriggerEvent,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
} from "../../src/game/hegemony/scheduler";
import { drawingSetup, records, type DrawingGame } from "./drawing-support";

function setup() {
  const state = drawingSetup();
  const settings = {
    image: false,
    viewDeputy: false,
    mode: "hegemony",
    luckLimit: 0,
  };
  const next: Record<string, string> = { a: "b", b: "c", c: "a" };
  const policy: GameStartRules<DrawingGame> = {
    settings: () => settings,
    hasGeneral: () => true,
    visibleSkills: () => [],
    hasLordSkill: () => false,
    nextAlive: (_game, player) => next[player],
    notify: (notice) => ({ name: "notice", data: notice }),
  };
  state.rules.skills.push(createGameStartRule());
  state.rules.operations!.push(createGameStartOperation(policy));
  return { ...state, settings, policy };
}
describe("global GameRule GameStart", () => {
  it.each([null, "a"])(
    "consumes SkipGameRule before target dispatch for %s",
    (target) => {
      const { game, rules, scheduler } = setup();
      game.cardResources.roomTags.SkipGameRule = true;
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "GameStart", target, data: null },
        null,
      );
      expect(game.cardResources.roomTags.SkipGameRule).toBeUndefined();
      expect(game.cardZones.draw.cards).toHaveLength(12);
      expect(game.trace).toEqual([]);
    },
  );
  it("does not redeal for per-player startup or a consumed earlier event", () => {
    const { game, rules, scheduler } = setup();
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: "a", data: null },
      null,
    );
    rules.skills.push({
      id: "consume",
      events: ["GameStart"],
      rule: true,
      priority: 100,
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: null, data: null },
      null,
    );
    expect(game.trace).toEqual([]);
    expect(game.cardResources.roomTags.FirstRound).toBeUndefined();
  });
  it("initializes only qualifying player-visible skill marks without deduplicating entries", () => {
    const { game, rules, scheduler, policy, settings } = setup();
    settings.mode = "custom_scenario";
    game.playerMarks.a["@limit"] = 9;
    policy.visibleSkills = () => [
      {
        name: "acquired",
        frequency: "limited",
        limitMark: "@limit",
        lord: false,
      },
      {
        name: "deputy",
        frequency: "limited",
        limitMark: "@limit",
        lord: false,
      },
      { name: "lord", frequency: "limited", limitMark: "@lord", lord: true },
      {
        name: "denied",
        frequency: "limited",
        limitMark: "@denied",
        lord: true,
      },
      { name: "empty", frequency: "limited", limitMark: "", lord: false },
      {
        name: "normal",
        frequency: "frequent",
        limitMark: "@normal",
        lord: false,
      },
    ];
    policy.hasLordSkill = (_game, player, skill) =>
      player === "a" && skill === "lord";
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: null, data: null },
      null,
    );
    expect(game.playerMarks.a).toEqual({ "@limit": 1, "@lord": 1 });
    expect(game.playerMarks.b).toEqual({ "@limit": 1 });
    expect(
      records(game.trace).filter((row) => row.kind === "set-mark"),
    ).toHaveLength(7);
  });
  it("rejects a missing general after earlier delay without silently skipping the player", () => {
    const { game, rules, scheduler, policy } = setup();
    policy.hasGeneral = () => false;
    expect(() =>
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "GameStart", target: null, data: null },
        null,
      ),
    ).toThrow("current general");
    expect(game.trace).toEqual([{ kind: "delay", duration: 3000 }]);
    expect(game.cardResources.roomTags.FirstRound).toBeUndefined();
  });
  it.each(["hegemony", "custom_scenario"])(
    "invokes the luck child after the native %s dealing boundary",
    (mode) => {
      const { game, rules, scheduler, settings } = setup();
      settings.mode = mode;
      settings.luckLimit = 1;
      rules.operations!.push({
        name: "luck-card",
        run: ({ game }) => {
          game.trace.push({
            kind: "luck-boundary",
            count: game.cardZones.a.cards.length,
            first: game.cardResources.roomTags.FirstRound,
          });
          return { kind: "return", value: null };
        },
      });
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "GameStart", target: null, data: null },
        null,
      );
      expect(game.trace.at(-1)).toEqual({
        kind: "luck-boundary",
        count: mode === "hegemony" ? 4 : 0,
        first: true,
      });
    },
  );
  it("skips private views for custom scenarios but keeps the lightbox and delay", () => {
    const { game, rules, scheduler, settings } = setup();
    settings.mode = "custom_scenario";
    settings.image = true;
    settings.viewDeputy = true;
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: null, data: null },
      null,
    );
    expect(game.trace).toEqual([
      { kind: "lightbox", name: "$gamestart", duration: 3500 },
      { kind: "delay", duration: 3000 },
    ]);
  });
  it("emits no Draw-phase events/free-chain and leaves the player FirstRound flag intact", () => {
    const { game, rules, scheduler } = setup();
    game.playerFlags.a = ["Global_FirstRound"];
    rules.operations = rules.operations!.filter(
      (op) => op.name !== "free-chain",
    );
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: null, data: null },
      null,
    );
    expect(game.playerFlags.a).toEqual(["Global_FirstRound"]);
    expect(
      records(game.trace).filter(
        (row) => row.name === "DrawNCards" || row.name === "AfterDrawNCards",
      ),
    ).toEqual([]);
    expect(
      records(game.trace).find((row) => row.name === "BeforeCardsMove"),
    ).toMatchObject({
      data: {
        moves: [{ reason: { kind: "draw", skill: "", eventName: "" } }, {}, {}],
      },
    });
  });
  it("keeps earlier startup state on actual initial-deal shortage", () => {
    const { game, rules, scheduler, policy } = setup();
    game.cardZones.draw.cards = [0, 1, 2];
    policy.visibleSkills = () => [
      {
        name: "limited",
        frequency: "limited",
        limitMark: "@limit",
        lord: false,
      },
    ];
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: null, data: null },
      null,
    );
    expect(scheduler.interruption?.reason).toBe("game-over");
    expect(game.cardResources.roomTags.FirstRound).toBe(true);
    expect(game.playerMarks.a["@limit"]).toBe(1);
    expect(game.cardZones.a.cards).toEqual([]);
  });
  it("does not invent an idempotency guard for fresh repeated GameStart", () => {
    const { game, rules, scheduler } = setup();
    game.alive.b = false;
    game.alive.c = false;
    for (let i = 0; i < 2; i++)
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "GameStart", target: null, data: null },
        null,
      );
    expect(game.cardZones.a.cards).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it("restores JSON at all private notices without repeating marks or dealing", () => {
    const state = setup(),
      { rules, settings, policy } = state;
    let { game, scheduler } = state;
    settings.image = true;
    settings.viewDeputy = true;
    policy.visibleSkills = () => [
      {
        name: "limited",
        frequency: "limited",
        limitMark: "@limit",
        lord: false,
      },
    ];
    policy.notify = (notice) => ({ name: "startup-notice", data: notice });
    rules.operations!.push({
      name: "startup-notice",
      run: ({ game, operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        game.trace.push(operation.data);
        return {
          kind: "prompt",
          actor: "a",
          choices: ["go"],
          canCancel: false,
          continuation: true,
        };
      },
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: null, data: null },
      null,
    );
    let pauses = 0;
    while (scheduler.prompt) {
      expect(++pauses).toBeLessThan(20);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      const reply = { id: getTriggerPrompt(scheduler, "a")!.id, choice: "go" };
      expect(resumeTriggerPrompt(scheduler, game, rules, "b", reply)).toBe(
        false,
      );
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          ...reply,
          id: "stale",
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(
          scheduler,
          game,
          { ...rules, version: "different" },
          "a",
          reply,
        ),
      ).toBe(false);
      expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
        true,
      );
      expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
        false,
      );
    }
    expect(pauses).toBe(11);
    expect(game.cardZones.c.cards).toEqual([8, 9, 10, 11]);
    expect(game.playerMarks.a["@limit"]).toBe(1);
    expect(
      records(game.trace).filter((row) => row.kind === "set-mark"),
    ).toHaveLength(3);
  });
  it("rejects malformed direct operation input before allocating a frame", () => {
    const { game, rules, scheduler } = setup();
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "game-start", data: {} },
        null,
      ),
    ).toThrow("game-start request");
    expect(scheduler.frames).toEqual([]);
  });
  it("delivers private next-deputy knowledge before delay and marking", () => {
    const { game, rules, scheduler, settings } = setup();
    settings.image = true;
    settings.viewDeputy = true;
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: null, data: null },
      null,
    );
    expect(game.trace.slice(0, 4)).toEqual([
      { kind: "lightbox", name: "$gamestart", duration: 3500 },
      { kind: "known-general", viewer: "a", target: "b", name: "b-deputy" },
      { kind: "view-generals", viewer: "a", names: ["b-deputy"] },
      { kind: "known-general", viewer: "b", target: "c", name: "c-deputy" },
    ]);
  });
  it("keeps custom startup marks and tag without the normal deal", () => {
    const { game, rules, scheduler, settings, policy } = setup();
    settings.mode = "custom_scenario";
    policy.visibleSkills = () => [
      {
        name: "limited",
        frequency: "limited",
        limitMark: "@limited",
        lord: false,
      },
    ];
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "GameStart", target: null, data: null },
      null,
    );
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.playerMarks.b["@limited"]).toBe(1);
    expect(game.cardResources.roomTags.FirstRound).toBe(true);
  });
  it("sets FirstRound and deals four in registration order through actual drawing", () => {
    const { game, rules, scheduler } = setup();
    game.currentPlayer = "b";
    expect(
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "GameStart", target: null, data: null },
        null,
      ),
    ).toBe(true);
    expect(game.cardZones.a.cards).toEqual([0, 1, 2, 3]);
    expect(game.cardZones.b.cards).toEqual([4, 5, 6, 7]);
    expect(game.cardZones.c.cards).toEqual([8, 9, 10, 11]);
    expect(game.cardResources.roomTags.FirstRound).toBe(true);
    expect(game.trace[0]).toEqual({ kind: "delay", duration: 3000 });
  });
});
