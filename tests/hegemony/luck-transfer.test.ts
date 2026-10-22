import { describe, expect, it } from "vitest";
import {
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
} from "../../src/game/hegemony/scheduler";
import { luckSetup, fixtureHand } from "./luck-support";

describe("native luck-card manual transfers", () => {
  it("redeals through actual acquisition and refiltering without DRAW metadata or visible clearing", () => {
    const { game, rules, scheduler, transfer } = luckSetup();
    transfer.wrapped.filters = () => [
      {
        matches: () => true,
        transform: (_context, card) => ({
          ...card,
          name: "slash",
          className: "Slash",
          skillName: "filter",
        }),
      },
    ];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "get-n-cards", data: { count: 2, updatePileNumber: false } },
      null,
    );
    game.trace = [];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "luck-transfer",
        data: { direction: "redeal", target: "a", ids: [0, 1] },
      },
      null,
    );
    expect(game.cardZones.a.cards).toEqual([0, 1]);
    expect(game.cardZones.reserved.cards).toEqual([]);
    expect(game.cardZones.transit).toEqual({
      place: "table",
      owner: null,
      cards: [],
    });
    expect(game.wrappedCards![0]).toMatchObject({
      name: "slash",
      modified: true,
      flags: ["visible", "keep"],
      skillName: "filter",
    });
    expect(game.trace).toEqual([
      {
        kind: "luck-move",
        phase: "lose",
        direction: "redeal",
        target: "a",
        ids: [0, 1],
        privateTo: null,
        reason: { kind: "unknown", actor: "", skill: "", eventName: "" },
      },
      {
        kind: "luck-move",
        phase: "get",
        direction: "redeal",
        target: "a",
        ids: [0, 1],
        privateTo: null,
        reason: { kind: "unknown", actor: "", skill: "", eventName: "" },
      },
    ]);
  });
  it("does not reset a modified wrapper on returning to the draw pile", () => {
    const { game, rules, scheduler } = luckSetup();
    fixtureHand(game, "a", [0]);
    game.wrappedCards![0].modified = true;
    game.wrappedCards![0].name = "slash";
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "luck-transfer",
        data: { direction: "return", target: "a", ids: [0] },
      },
      null,
    );
    expect(game.wrappedCards![0]).toMatchObject({
      name: "slash",
      modified: true,
      flags: ["visible", "keep"],
    });
  });
  it.each(["return", "redeal"])(
    "keeps native source-removal/mapping/get/add boundaries across JSON for %s",
    (direction) => {
      const state = luckSetup(),
        { rules, transfer } = state;
      let { game, scheduler } = state;
      if (direction === "return") fixtureHand(game, "a", [0, 1]);
      else
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "get-n-cards", data: { count: 2, updatePileNumber: false } },
          null,
        );
      transfer.notify = (notice) => ({
        name: "pause-move",
        data: { ...notice },
      });
      rules.operations!.push({
        name: "pause-move",
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
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "luck-transfer",
          data: { direction, target: "a", ids: [0, 1] },
        },
        null,
      );
      expect(
        game.cardZones[direction === "return" ? "a" : "reserved"].cards,
      ).toEqual([0, 1]);
      for (let phase = 0; phase < 2; phase++) {
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
        expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
          true,
        );
        expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
          false,
        );
        if (phase === 0) {
          expect(game.cardZones.a.cards).toEqual([]);
          expect(game.cardZones.reserved.cards).toEqual([]);
          expect(game.cardZones.transit).toEqual({
            place: direction === "return" ? "draw" : "hand",
            owner: direction === "return" ? null : "a",
            cards: [0, 1],
          });
          expect(game.cardZones.draw.cards).toEqual([
            2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
          ]);
        }
      }
      expect(game.cardZones.transit.cards).toEqual([]);
      expect(game.cardZones.a.cards).toEqual(
        direction === "return" ? [] : [0, 1],
      );
    },
  );
  it.each(["return", "redeal"])(
    "permits an empty %s without filtering or movement events",
    (direction) => {
      const { game, rules, scheduler, transfer } = luckSetup();
      transfer.wrapped.filters = () => {
        throw new Error("No cards to filter");
      };
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "luck-transfer", data: { direction, target: "a", ids: [] } },
        null,
      );
      expect(game.cardZones.draw.cards).toHaveLength(12);
      expect(game.cardZones.transit).toEqual({
        place: "table",
        owner: null,
        cards: [],
      });
      expect(game.trace).toHaveLength(2);
    },
  );
  it("does not add an alive/removed guard to manual transfers", () => {
    const { game, rules, scheduler } = luckSetup();
    fixtureHand(game, "a", [0]);
    game.alive.a = false;
    game.removed.a = true;
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "luck-transfer",
        data: { direction: "return", target: "a", ids: [0] },
      },
      null,
    );
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.draw.cards[0]).toBe(0);
  });
  it.each([
    { direction: "bad", target: "a", ids: [0] },
    { direction: "return", target: "unknown", ids: [0] },
    { direction: "return", target: "a", ids: [0, 0] },
    { direction: "return", target: "a", ids: [0] },
    { direction: "return", target: "a", ids: [1, 0] },
    { direction: "redeal", target: "a", ids: [0, 1] },
  ])("rejects malformed or wrong-source transfer %# before frames", (data) => {
    const { game, rules, scheduler } = luckSetup();
    fixtureHand(game, "a", [0, 1]);
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "luck-transfer", data },
        null,
      ),
    ).toThrow();
    expect(scheduler.frames).toEqual([]);
    expect(game.cardZones.a.cards).toEqual([0, 1]);
  });
  it("retains private in-flight mapping after a get-notice interruption", () => {
    const { game, rules, scheduler, transfer } = luckSetup();
    fixtureHand(game, "a", [0]);
    transfer.notify = (notice) =>
      notice.phase === "get" ? { name: "break", data: null } : null;
    rules.operations!.push({
      name: "break",
      run: () => ({ kind: "interrupt", reason: "turn-broken" }),
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "luck-transfer",
        data: { direction: "return", target: "a", ids: [0] },
      },
      null,
    );
    expect(scheduler.interruption?.reason).toBe("turn-broken");
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.draw.cards).not.toContain(0);
    expect(game.cardZones.transit).toEqual({
      place: "draw",
      owner: null,
      cards: [0],
    });
  });
  it("privately returns the whole hand by prepend without ordinary arrival flag clearing", () => {
    const { game, rules, scheduler } = luckSetup();
    fixtureHand(game, "a", [0, 1]);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "luck-transfer",
        data: { direction: "return", target: "a", ids: [0, 1] },
      },
      null,
    );
    expect(game.cardZones.a.cards).toEqual([]);
    expect(game.cardZones.draw.cards).toEqual([
      1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(game.wrappedCards![0].flags).toEqual(["visible", "keep"]);
    expect(game.wrappedCards![0].modified).toBe(false);
    expect(game.trace).toEqual([
      {
        kind: "luck-move",
        phase: "lose",
        direction: "return",
        target: "a",
        ids: [0, 1],
        privateTo: "a",
        reason: { kind: "put", actor: "a", skill: "luck_card", eventName: "" },
      },
      {
        kind: "luck-move",
        phase: "get",
        direction: "return",
        target: "a",
        ids: [0, 1],
        privateTo: "a",
        reason: { kind: "put", actor: "a", skill: "luck_card", eventName: "" },
      },
    ]);
  });
});
