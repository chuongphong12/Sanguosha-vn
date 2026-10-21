import { describe, expect, it } from "vitest";
import {
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";
import { createRewardTokenUseOperation } from "../../src/game/hegemony/reward-tokens";
import { drawingSetup, records } from "./drawing-support";

describe("Room drawCards", () => {
  it("reserves all recipients before one actual hand transaction with DRAW metadata", () => {
    const { game, scheduler, rules } = drawingSetup();
    rules.skills.push({
      id: "reserved",
      priority: 10,
      rule: true,
      events: ["BeforeCardsMove"],
      effect: ({ game, event }) => {
        if (event.target === "a")
          game.trace.push({
            kind: "reserved",
            ids: [...game.cardZones.reserved.cards],
            a: [...game.cardZones.a.cards],
            b: [...game.cardZones.b.cards],
          });
        return { kind: "done", value: false };
      },
    });
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "draw-cards",
          data: { players: ["a", "b"], counts: [2, 1], reason: "yiji" },
        },
        "a",
      ),
    ).toBe(true);
    expect(game.cardZones.a.cards).toEqual([0, 1]);
    expect(game.cardZones.b.cards).toEqual([2]);
    expect(game.cardZones.reserved.cards).toEqual([]);
    const before = records(game.trace).filter(
      (entry) => entry.name === "BeforeCardsMove",
    );
    expect(before).toHaveLength(3);
    expect(before[0]).toMatchObject({
      data: {
        moves: [
          {
            ids: [0, 1],
            to: "a",
            open: [false, false],
            reason: { kind: "draw", actor: "a", skill: "yiji", eventName: "" },
          },
          { ids: [2], to: "b" },
        ],
      },
    });
    expect(game.wrappedCards![0].flags).toEqual(["keep"]);
    expect(game.trace).toContainEqual({
      kind: "reserved",
      ids: [0, 1, 2],
      a: [],
      b: [],
    });
    expect(
      records(game.trace).filter((entry) => entry.kind === "update-pile"),
    ).toEqual([]);
  });
  it("repeats the last count but defaults missing directions to top", () => {
    const { game, scheduler, rules } = drawingSetup();
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "draw-cards",
        data: { players: ["a", "b", "c"], counts: [1, 2], fromUps: [false] },
      },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([11]);
    expect(game.cardZones.b.cards).toEqual([0, 1]);
    expect(game.cardZones.c.cards).toEqual([2, 3]);
  });
  it("keeps indices for skipped dead slots and allows duplicate recipients", () => {
    const { game, scheduler, rules } = drawingSetup();
    game.alive.b = false;
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "draw-cards",
        data: {
          players: ["b", "a", "a"],
          counts: [99, 1],
          fromUps: [true, false],
        },
      },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([11, 0]);
    expect(game.cardZones.b.cards).toEqual([]);
  });
  it.each(["reform", "Reform"])(
    "uses the exact dead-recipient exception for reason %s",
    (reason) => {
      const { game, scheduler, rules } = drawingSetup();
      game.alive.b = false;
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "draw-cards", data: { players: ["b"], counts: [1], reason } },
        "a",
      );
      expect(game.cardZones.b.cards).toEqual(reason === "reform" ? [0] : []);
    },
  );
  it("does not add a removed guard or recheck alive after a slot's acquisition", () => {
    const { game, scheduler, rules } = drawingSetup();
    game.removed.a = true;
    rules.skills.push({
      id: "kill-during-fetch",
      priority: 10,
      rule: true,
      events: ["FetchDrawPileCard"],
      effect: ({ game }) => {
        game.alive.a = false;
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-cards", data: { players: ["a"], counts: [1] } },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([0]);
  });
  it("checks later recipients against current life state", () => {
    const { game, scheduler, rules } = drawingSetup();
    game.alive.b = false;
    rules.skills.push({
      id: "revive",
      priority: 10,
      rule: true,
      events: ["FetchDrawPileCard"],
      effect: ({ game }) => {
        game.alive.b = true;
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-cards", data: { players: ["a", "b"], counts: [1] } },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([0]);
    expect(game.cardZones.b.cards).toEqual([1]);
  });
  it("does not precheck combined capacity or grant earlier hands before later failure", () => {
    const { game, scheduler, rules } = drawingSetup();
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-cards", data: { players: ["a", "b"], counts: [2, 99] } },
      "a",
    );
    expect(game.gameResult).toBe(".");
    expect(game.cardZones.reserved.cards).toEqual([0, 1]);
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.b.cards).toEqual([]);
    expect(
      records(game.trace).filter((entry) => entry.name === "BeforeCardsMove"),
    ).toEqual([]);
  });
  it.each([{ players: [] }, { players: ["a", "b"] }])(
    "runs the actual empty transaction for skipped recipients %j",
    ({ players }) => {
      const { game, scheduler, rules } = drawingSetup();
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "draw-cards", data: { players, counts: [0, -1] } },
        "a",
      );
      const before = records(game.trace).filter(
        (entry) => entry.name === "BeforeCardsMove",
      );
      expect(before).toHaveLength(3);
      expect(before[0]).toMatchObject({ data: { moves: [] } });
      expect(
        records(game.trace).filter(
          (entry) => entry.name === "FetchDrawPileCard",
        ),
      ).toEqual([]);
    },
  );
  it("preserves drawn reservations if BeforeCardsMove consumes the atomic transfer", () => {
    const { game, scheduler, rules } = drawingSetup();
    rules.skills.push({
      id: "cancel-move",
      priority: 10,
      rule: true,
      events: ["BeforeCardsMove"],
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "draw-cards", data: { players: ["a", "b"], counts: [1] } },
      "a",
    );
    expect(game.cardZones.reserved.cards).toEqual([0, 1]);
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.b.cards).toEqual([]);
    expect(game.wrappedCards![0].flags).toContain("visible");
  });
  it("composes actual fill-hand with a captured deficit despite nested hand changes", () => {
    const { game, scheduler, rules } = drawingSetup();
    game.cardZones.a.cards = [10];
    game.cardZones.draw.cards = game.cardZones.draw.cards.filter(
      (id) => id !== 10,
    );
    rules.skills.push({
      id: "gain",
      priority: 10,
      rule: true,
      events: ["FetchDrawPileCard"],
      effect: ({ game, continuation }) => {
        if (!game.cardResources.roomTags.gained && continuation === null) {
          game.cardResources.roomTags.gained = true;
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: { moves: [{ ids: [11], to: "a" }] },
            },
            continuation: true,
          };
        }
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "fill-hand",
        data: { target: "a", count: 3, reason: "firstshow" },
      },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([10, 11, 0, 1]);
  });
  it("does not use reform to bypass fill-hand's own alive guard", () => {
    const { game, scheduler, rules } = drawingSetup();
    game.alive.b = false;
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "fill-hand", data: { target: "b", count: 4, reason: "reform" } },
      "a",
    );
    expect(game.trace).toEqual([]);
    expect(game.cardZones.b.cards).toEqual([]);
  });
  it("routes an actual halfmaxhp token use through player drawing", () => {
    const { game, scheduler, rules } = drawingSetup();
    const unexpected = () => {
      throw new Error("Unexpected token branch");
    };
    rules.operations!.push(
      createRewardTokenUseOperation({
        draw: (player, count, reason) => ({
          name: "draw-cards",
          data: { players: [player], counts: [count], reason },
        }),
        peachAvailable: () => false,
        peachLocked: () => false,
        peachProhibited: () => false,
        usePeach: unexpected,
        choice: unexpected,
        choosePlayer: unexpected,
        indicate: unexpected,
        publicView: unexpected,
        privateView: unexpected,
      }),
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "reward-token-use",
        data: { player: "a", token: "halfmaxhp", targets: [] },
      },
      "a",
    );
    expect(game.cardZones.a.cards).toEqual([0]);
    expect(
      records(game.trace).find((entry) => entry.name === "BeforeCardsMove"),
    ).toMatchObject({
      data: {
        moves: [
          {
            reason: {
              kind: "draw",
              actor: "a",
              skill: "halfmaxhp",
              eventName: "",
            },
          },
        ],
      },
    });
  });
  it.each(["FetchDrawPileCard", "ConfirmMoveCards", "CardsMoveOneTime"])(
    "resumes JSON during %s without duplicated delivery",
    (pause) => {
      const state = drawingSetup(),
        { rules } = state;
      let { game, scheduler } = state;
      rules.skills.push({
        id: "pause",
        priority: 50,
        rule: true,
        events: [pause],
        effect: ({ event, continuation }) =>
          continuation === null &&
          (event.target === null || event.target === "a")
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
        { name: "draw-cards", data: { players: ["a", "b"], counts: [2] } },
        "a",
      );
      let count = 0;
      while (scheduler.prompt) {
        expect(++count).toBeLessThan(6);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        const reply = {
          id: getTriggerPrompt(scheduler, "a")!.id,
          choice: "go",
        };
        expect(resumeTriggerPrompt(scheduler, game, rules, "b", reply)).toBe(
          false,
        );
        expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
          true,
        );
        expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
          false,
        );
      }
      expect(count).toBeGreaterThan(0);
      expect(game.cardZones.a.cards).toEqual([0, 1]);
      expect(game.cardZones.b.cards).toEqual([2, 3]);
      expect(game.cardZones.reserved.cards).toEqual([]);
    },
  );
  it.each<Record<string, TriggerData>>([
    { players: ["a"], counts: [] },
    { players: [null], counts: [1] },
    { players: ["missing"], counts: [1] },
    { players: ["a"], counts: [1.2] },
    { players: ["a"], counts: [1], fromUps: [0] },
  ])("rejects malformed recipient request %j", (data) => {
    const { game, scheduler, rules } = drawingSetup();
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "draw-cards", data },
        "a",
      ),
    ).toThrow();
    expect(scheduler.frames).toEqual([]);
    expect(game.trace).toEqual([]);
  });
});
