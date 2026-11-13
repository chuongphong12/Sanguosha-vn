import { describe, expect, it } from "vitest";
import {
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";
import { drawingSetup, records } from "./drawing-support";

describe("Room getNCards", () => {
  it("returns ordered reserved IDs after individual Fetch events and one count notice", () => {
    const { game, scheduler, rules } = drawingSetup();
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "get-n-cards", data: { count: 2 } },
        null,
      ),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toEqual([0, 1]);
    expect(game.cardZones.reserved.cards).toEqual([0, 1]);
    expect(game.trace).toEqual([
      { name: "FetchDrawPileCard", target: null, data: null },
      { name: "FetchDrawPileCard", target: null, data: null },
      { kind: "update-pile", count: 10 },
    ]);
  });
  it("pre-swaps a nonempty draw pile before bottom selection", () => {
    const { game, scheduler, rules } = drawingSetup();
    game.cardZones.draw.cards = [0];
    game.cardZones.discard.cards = [1, 2];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "get-n-cards", data: { count: 2, fromUp: false } },
      null,
    );
    expect(scheduler.operationCompletion?.value).toEqual([1, 2]);
    expect(game.cardZones.draw.cards).toEqual([0]);
    expect(game.trace).toEqual([
      { kind: "reset-pile" },
      { kind: "update-pile", count: 3 },
      { name: "FetchDrawPileCard", target: null, data: null },
      { name: "FetchDrawPileCard", target: null, data: null },
      { kind: "update-pile", count: 1 },
    ]);
  });
  it("ends insufficient total capacity before Fetch or recycling", () => {
    const { game, scheduler, rules } = drawingSetup();
    game.cardZones.draw.cards = [0];
    game.cardZones.discard.cards = [1];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "get-n-cards", data: { count: 3 } },
      null,
    );
    expect(game.gameResult).toBe(".");
    expect(game.trace).toEqual([]);
    expect(game.cardResources!.roomTags.SwapPile).toBeUndefined();
    expect(game.cardZones.reserved.cards).toEqual([]);
  });
  it.each([0, -2])(
    "returns empty for count %i but still sends the requested current count",
    (count) => {
      const { game, scheduler, rules } = drawingSetup();
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "get-n-cards", data: { count } },
        null,
      );
      expect(scheduler.operationCompletion?.value).toEqual([]);
      expect(game.trace).toEqual([{ kind: "update-pile", count: 12 }]);
      expect(game.pileRandom.state).toBe(1);
    },
  );
  it("suppresses only its own count notice, retaining swap notices", () => {
    const { game, scheduler, rules } = drawingSetup();
    game.cardZones.draw.cards = [];
    game.cardZones.discard.cards = [0, 1];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "get-n-cards", data: { count: 2, updatePileNumber: false } },
      null,
    );
    expect(records(game.trace).filter((entry) => "kind" in entry)).toEqual([
      { kind: "reset-pile" },
      { kind: "update-pile", count: 2 },
    ]);
    expect(game.cardZones.reserved.cards).toHaveLength(2);
    expect(game.wrappedCards![0].flags).toEqual(["visible", "keep"]);
  });
  it("uses each real Fetch result and the latest available count after nested drawing", () => {
    const { game, scheduler, rules } = drawingSetup();
    rules.skills.push({
      id: "nested",
      priority: 30,
      rule: true,
      events: ["FetchDrawPileCard"],
      effect: ({ game }) => {
        if (!game.cardResources.roomTags.nested) {
          game.cardResources.roomTags.nested = true;
          return {
            kind: "operation",
            operation: { name: "draw-card", data: {} },
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
      { name: "get-n-cards", data: { count: 2 } },
      null,
    );
    expect(scheduler.operationCompletion?.value).toEqual([1, 2]);
    expect(game.cardZones.reserved.cards).toEqual([0, 1, 2]);
    expect(game.trace.at(-1)).toEqual({ kind: "update-pile", count: 9 });
  });
  it("retains earlier reservations and omits success notice on a later terminal draw", () => {
    const { game, scheduler, rules } = drawingSetup();
    rules.skills.push({
      id: "drain",
      priority: 10,
      rule: true,
      events: ["FetchDrawPileCard"],
      effect: ({ game, continuation }) => {
        if (
          continuation === null &&
          records(game.trace).filter(
            (entry) => entry.name === "FetchDrawPileCard",
          ).length === 2
        )
          return {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: {
                moves: [{ ids: [...game.cardZones.draw.cards], to: "c" }],
              },
            },
            continuation: true,
          };
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "get-n-cards", data: { count: 2 } },
      null,
    );
    expect(game.gameResult).toBe(".");
    expect(game.cardZones.reserved.cards).toEqual([0]);
    expect(game.cardZones.c.cards).toHaveLength(11);
    expect(
      records(game.trace).filter((entry) => entry.kind === "update-pile"),
    ).toEqual([]);
  });
  it("resumes JSON between every selected card and rejects stale, wrong-registry and replay answers", () => {
    const state = drawingSetup(),
      { rules } = state;
    let { game, scheduler } = state;
    rules.skills.push({
      id: "pause",
      priority: 50,
      rule: true,
      events: ["FetchDrawPileCard"],
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
      { name: "get-n-cards", data: { count: 3 } },
      null,
    );
    let count = 0;
    while (scheduler.prompt) {
      expect(++count).toBeLessThan(5);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      const reply = { id: getTriggerPrompt(scheduler, "a")!.id, choice: "go" };
      expect(
        resumeTriggerPrompt(
          scheduler,
          game,
          { ...rules, version: "wrong" },
          "a",
          reply,
        ),
      ).toBe(false);
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
    expect(count).toBe(3);
    expect(scheduler.operationCompletion?.value).toEqual([0, 1, 2]);
    expect(game.trace.at(-1)).toEqual({ kind: "update-pile", count: 9 });
  });
  it.each<Record<string, TriggerData>>([
    { count: 1.5 },
    { count: 2147483648 },
    { count: 2, fromUp: "yes" },
    { count: 1, updatePileNumber: 0 },
  ])("rejects malformed batch input %j before a frame", (data) => {
    const { game, scheduler, rules } = drawingSetup();
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "get-n-cards", data },
        null,
      ),
    ).toThrow();
    expect(scheduler.frames).toEqual([]);
    expect(game.trace).toEqual([]);
  });
});
