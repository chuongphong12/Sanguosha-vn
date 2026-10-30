import { describe, expect, it } from "vitest";
import {
  dispatchTriggerOperation,
  dispatchTriggerEvent,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";
import { luckFlowSetup, fixtureHand } from "./luck-support";
import { records } from "./drawing-support";
import {
  createGameStartOperation,
  createGameStartRule,
} from "../../src/game/hegemony/game-start";

const invalidReplies: TriggerData[] = [
  null,
  true,
  {},
  { ready: false, payload: true },
  { ready: true, payload: false },
  { ready: "true", payload: true },
  { ready: true, payload: "true" },
  { ready: true, payload: 1 },
  { ready: true, payload: [true] },
];

describe("Room luck-card rounds", () => {
  it("keeps the empty-hand/empty-pile round without inventing game-over or RNG draws", () => {
    const { game, rules, scheduler } = luckFlowSetup();
    fixtureHand(game, "c", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "luck-card", data: null },
      null,
    );
    expect(scheduler.interruption).toBeNull();
    expect(game.pileRandom.state).toBe(1);
    expect(game.trace.at(-1)).toEqual({ kind: "update-pile", count: 0 });
    expect(
      records(game.trace).filter((row) => row.name === "FetchDrawPileCard"),
    ).toEqual([]);
  });
  it.each([
    "luck-pause",
    "luck-focus",
    "luck-log",
    "return-lose",
    "return-get",
    "redeal-lose",
    "redeal-get",
    "update-pile",
    "request-round",
    "fetch",
  ])(
    "restores JSON at %s without duplicated rounds, shuffle or manual transfers",
    (pause) => {
      const state = luckFlowSetup(),
        { rules, luck, transfer, rounds } = state;
      let { game, scheduler } = state;
      fixtureHand(game, "a", [0, 1]);
      fixtureHand(game, "b", [2]);
      fixtureHand(game, "c", [5, 6, 7, 8, 9, 10, 11]);
      luck.notify = (notice) => ({ name: "luck-delivery", data: notice });
      transfer.notify = (notice) => ({
        name: "luck-delivery",
        data: { ...notice },
      });
      rules.operations!.push({
        name: "luck-delivery",
        run: ({ game, operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          const data = operation.data;
          if (!data || typeof data !== "object" || Array.isArray(data))
            throw new Error("Bad delivery fixture");
          game.trace.push(data);
          if (
            data.kind === pause ||
            (data.kind === "luck-move" &&
              `${data.direction}-${data.phase}` === pause)
          )
            return {
              kind: "prompt",
              actor: "a",
              choices: ["go"],
              canCancel: false,
              continuation: true,
            };
          return { kind: "return", value: null };
        },
      });
      if (pause === "request-round") {
        luck.request = (players, round) => ({
          name: "round-delivery",
          data: { players, round },
        });
        rules.operations!.push({
          name: "round-delivery",
          run: ({ game, operation, continuation }) => {
            const data = operation.data;
            if (
              !data ||
              typeof data !== "object" ||
              Array.isArray(data) ||
              typeof data.round !== "number"
            )
              throw new Error("Bad request fixture");
            if (continuation === null) {
              game.trace.push({ kind: "round", ...data });
              // Diagnostic completion of the trusted batch adapter, not serial player luck prompts.
              return {
                kind: "prompt",
                actor: "a",
                choices: ["go"],
                canCancel: false,
                continuation: true,
              };
            }
            return { kind: "return", value: rounds[data.round - 1] ?? {} };
          },
        });
      }
      if (pause === "fetch")
        rules.skills.push({
          id: "pause-fetch",
          events: ["FetchDrawPileCard"],
          rule: true,
          priority: 100,
          effect: ({ continuation }) =>
            continuation === null
              ? {
                  kind: "prompt",
                  actor: "a",
                  choices: ["go"],
                  canCancel: false,
                  continuation: true,
                }
              : { kind: "done", value: false },
        });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "luck-card", data: null },
        null,
      );
      let count = 0;
      while (scheduler.prompt) {
        expect(++count).toBeLessThan(20);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        const reply = {
          id: getTriggerPrompt(scheduler, "a")!.id,
          choice: "go",
        };
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
            { ...rules, version: "other" },
            "a",
            reply,
          ),
        ).toBe(false);
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "a", {
            ...reply,
            choice: "invalid",
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
      expect(game.cardZones.a.cards).toEqual([3, 1]);
      expect(game.cardZones.b.cards).toEqual([4]);
      expect(game.cardZones.draw.cards).toEqual([2, 0]);
      expect(game.pileRandom.state).toBe(567894474);
      expect(
        records(game.trace).filter((row) => row.kind === "luck-move"),
      ).toHaveLength(8);
      expect(
        records(game.trace).filter((row) => row.kind === "luck-log"),
      ).toHaveLength(2);
      expect(
        records(game.trace).filter((row) => row.kind === "round"),
      ).toHaveLength(1);
    },
  );
  it("takes the eligible snapshot after the single pause boundary", () => {
    const { game, rules, scheduler, ai, luck } = luckFlowSetup();
    luck.notify = (notice) =>
      notice.kind === "luck-pause"
        ? { name: "pause-luck", data: null }
        : { name: "notice", data: notice };
    rules.operations!.push({
      name: "pause-luck",
      run: ({ continuation }) =>
        continuation === null
          ? {
              kind: "prompt",
              actor: "a",
              choices: ["go"],
              canCancel: false,
              continuation: true,
            }
          : { kind: "return", value: null },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "luck-card", data: null },
      null,
    );
    ai.add("a");
    resumeTriggerPrompt(scheduler, game, rules, "a", {
      id: getTriggerPrompt(scheduler, "a")!.id,
      choice: "go",
    });
    expect(records(game.trace).filter((row) => row.kind === "round")).toEqual([
      { kind: "round", players: ["b"], round: 1 },
    ]);
  });
  it("rejects a malformed top-level batch adapter result without touching hands", () => {
    const { game, rules, scheduler, rounds } = luckFlowSetup();
    fixtureHand(game, "a", [0]);
    rounds[0] = null;
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "luck-card", data: null },
        null,
      ),
    ).toThrow("request-round result");
    expect(game.cardZones.a.cards).toEqual([0]);
    expect(game.pileRandom.state).toBe(1);
  });
  it("rejects malformed operation input before a pause/frame", () => {
    const { game, rules, scheduler } = luckFlowSetup();
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "luck-card", data: {} },
        null,
      ),
    ).toThrow("luck-card request");
    expect(scheduler.frames).toEqual([]);
    expect(game.trace).toEqual([]);
  });
  it.each(invalidReplies.map((reply, index) => ({ reply, index })))(
    "drops nonaffirmative/not-ready reply $index without validation retry",
    ({ reply }) => {
      const { game, rules, scheduler, rounds, config } = luckFlowSetup();
      fixtureHand(game, "a", [0]);
      config.limit = 3;
      rounds[0] = { a: reply };
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "luck-card", data: null },
        null,
      );
      expect(game.cardZones.a.cards).toEqual([0]);
      expect(game.pileRandom.state).toBe(1);
      expect(
        records(game.trace).filter((row) => row.kind === "round"),
      ).toHaveLength(1);
      expect(
        records(game.trace).filter(
          (row) => row.kind === "luck-log" || row.kind === "update-pile",
        ),
      ).toEqual([]);
    },
  );
  it("permanently drops a declined actor while affirmative survivors receive bounded further rounds", () => {
    const { game, rules, scheduler, rounds, config } = luckFlowSetup();
    config.limit = 3;
    rounds.push(
      { a: { ready: true, payload: false }, b: { ready: true, payload: true } },
      { a: { ready: true, payload: true }, b: { ready: true, payload: true } },
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "luck-card", data: null },
      null,
    );
    expect(records(game.trace).filter((row) => row.kind === "round")).toEqual([
      { kind: "round", players: ["a", "b"], round: 1 },
      { kind: "round", players: ["a", "b"], round: 2 },
      { kind: "round", players: ["b"], round: 3 },
    ]);
    expect(
      records(game.trace)
        .filter((row) => row.kind === "luck-log")
        .map((row) => row.target),
    ).toEqual(["a", "b", "b", "b"]);
    expect(
      records(game.trace).filter((row) => row.kind === "update-pile"),
    ).toHaveLength(3);
  });
  it.each([0, -1])(
    "runs the initial pause but no round at limit %i",
    (limit) => {
      const { game, rules, scheduler, config } = luckFlowSetup();
      config.limit = limit;
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "luck-card", data: null },
        null,
      );
      expect(game.trace).toEqual([{ kind: "luck-pause" }]);
      expect(game.pileRandom.state).toBe(1);
    },
  );
  it("does not create requests when all registered participants use AI", () => {
    const { game, rules, scheduler, ai } = luckFlowSetup();
    ai.add("a");
    ai.add("b");
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "luck-card", data: null },
      null,
    );
    expect(game.trace).toEqual([{ kind: "luck-pause" }]);
  });
  it("captures AI eligibility once and does not skip a later dead or removed participant", () => {
    const { game, rules, scheduler, ai, config } = luckFlowSetup();
    ai.add("b");
    config.limit = 2;
    fixtureHand(game, "a", [0]);
    rules.operations = rules.operations!.filter(
      (op) => op.name !== "luck-round",
    );
    rules.operations.push({
      name: "luck-round",
      run: ({ game, operation }) => {
        const data = operation.data;
        if (!data || typeof data !== "object" || Array.isArray(data))
          throw new Error("Bad request fixture");
        ai.add("a");
        game.alive.a = false;
        game.removed.a = true;
        game.trace.push({
          kind: "round",
          ...data,
        });
        return { kind: "return", value: { a: { ready: true, payload: true } } };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "luck-card", data: null },
      null,
    );
    expect(
      records(game.trace)
        .filter((row) => row.kind === "round")
        .map((row) => row.players),
    ).toEqual([["a"], ["a"]]);
    expect(game.cardZones.a.cards).toHaveLength(1);
    expect(
      records(game.trace).filter((row) => row.kind === "luck-log"),
    ).toHaveLength(2);
  });
  it("logs every accepted invocation and returns all hands before the first Fetch", () => {
    const { game, rules, scheduler } = luckFlowSetup();
    fixtureHand(game, "a", [0, 1]);
    fixtureHand(game, "b", [2]);
    fixtureHand(game, "c", [5, 6, 7, 8, 9, 10, 11]);
    rules.skills.push({
      id: "check-first-fetch",
      priority: 100,
      rule: true,
      events: ["FetchDrawPileCard"],
      effect: ({ game }) => {
        if (!records(game.trace).some((row) => row.kind === "first-fetch"))
          game.trace.push({
            kind: "first-fetch",
            a: [...game.cardZones.a.cards],
            b: [...game.cardZones.b.cards],
            pile: [...game.cardZones.draw.cards],
            logs: records(game.trace)
              .filter((row) => row.kind === "luck-log")
              .map((row) => row.target),
          });
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "luck-card", data: null },
      null,
    );
    expect(
      records(game.trace).find((row) => row.kind === "first-fetch"),
    ).toEqual({
      kind: "first-fetch",
      a: [],
      b: [],
      pile: [3, 1, 4, 2, 0],
      logs: ["a", "b"],
    });
    expect(
      records(game.trace).filter(
        (row) =>
          row.name === "BeforeCardsMove" || row.name === "CardsMoveOneTime",
      ),
    ).toEqual([]);
  });
  it("keeps an earlier completed redeal after a later actual batch shortage", () => {
    const { game, rules, scheduler } = luckFlowSetup();
    fixtureHand(game, "a", [0, 1]);
    fixtureHand(game, "b", [2]);
    fixtureHand(game, "c", [5, 6, 7, 8, 9, 10, 11]);
    let fetches = 0;
    rules.skills.push({
      id: "steal-remaining",
      priority: 100,
      rule: true,
      events: ["FetchDrawPileCard"],
      effect: ({ game }) => {
        if (++fetches === 2) {
          const rest = game.cardZones.draw.cards.splice(1);
          game.cardZones.c.cards.push(...rest);
        }
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "luck-card", data: null },
      null,
    );
    expect(scheduler.interruption?.reason).toBe("game-over");
    expect(game.cardZones.a.cards).toEqual([3, 1]);
    expect(game.cardZones.b.cards).toEqual([]);
    expect(
      records(game.trace).filter((row) => row.kind === "update-pile"),
    ).toEqual([]);
  });
  it.each(["hegemony", "custom_scenario"])(
    "composes real global GameStart and luck-card owners in %s",
    (mode) => {
      const { game, rules, scheduler, config } = luckFlowSetup();
      rules.skills.push(createGameStartRule());
      rules.operations!.push(
        createGameStartOperation({
          settings: () => ({
            image: false,
            viewDeputy: false,
            mode,
            luckLimit: config.limit,
          }),
          hasGeneral: () => true,
          visibleSkills: () => [],
          hasLordSkill: () => false,
          nextAlive: () => "a",
          notify: (notice) => ({ name: "notice", data: notice }),
        }),
      );
      if (mode === "custom_scenario") {
        fixtureHand(game, "a", [0, 1]);
        fixtureHand(game, "b", [2]);
      }
      dispatchTriggerEvent(
        scheduler,
        game,
        rules,
        { name: "GameStart", target: null, data: null },
        null,
      );
      expect(game.cardResources.roomTags.FirstRound).toBe(true);
      expect(game.cardZones.a.cards).toHaveLength(mode === "hegemony" ? 4 : 2);
      expect(game.cardZones.b.cards).toHaveLength(mode === "hegemony" ? 4 : 1);
      expect(game.cardZones.c.cards).toHaveLength(mode === "hegemony" ? 4 : 0);
      expect(
        records(game.trace).filter((row) => row.name === "CardsMoveOneTime"),
      ).toHaveLength(mode === "hegemony" ? 3 : 0);
      expect(
        records(game.trace).filter(
          (row) => row.name === "DrawNCards" || row.name === "AfterDrawNCards",
        ),
      ).toEqual([]);
      expect(
        records(game.trace).filter((row) => row.kind === "luck-log"),
      ).toHaveLength(2);
    },
  );
  it("returns all accepted hands, shuffles once and redeals sequentially through actual acquisition", () => {
    const { game, rules, scheduler } = luckFlowSetup();
    fixtureHand(game, "a", [0, 1]);
    fixtureHand(game, "b", [2]);
    fixtureHand(game, "c", [5, 6, 7, 8, 9, 10, 11]);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "luck-card", data: null },
      null,
    );
    // Returned pile [2,1,0,3,4], seed-1 transcript swaps [3,1,4,3,4].
    expect(game.cardZones.a.cards).toEqual([3, 1]);
    expect(game.cardZones.b.cards).toEqual([4]);
    expect(game.cardZones.draw.cards).toEqual([2, 0]);
    expect(game.cardZones.c.cards).toEqual([5, 6, 7, 8, 9, 10, 11]);
    expect(game.pileRandom.state).toBe(567894474);
    expect(
      records(game.trace).filter((row) => row.kind === "luck-log"),
    ).toEqual([
      { kind: "luck-log", target: "a" },
      { kind: "luck-log", target: "b" },
    ]);
    expect(game.trace.at(-1)).toEqual({ kind: "update-pile", count: 2 });
  });
});
