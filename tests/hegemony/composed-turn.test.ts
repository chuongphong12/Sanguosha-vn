import { describe, expect, it } from "vitest";
import { setup, root, answer, drain } from "./composed-turn-support";
import { records } from "./drawing-support";
import { insertPhase, skipPhase } from "../../src/game/hegemony/phases";
import { unwindTriggerInterruption } from "../../src/game/hegemony/scheduler";

describe("Composed core turn", () => {
  it("runs reveal, delayed effect, Draw, admitted Room use and mandatory discard through one normal-turn root", () => {
    const f = setup();
    root(f);
    drain(f);
    expect(f.game.identities.a.headShown).toBe(true);
    expect(f.game.cardZones.a.cards).toEqual([5, 6]);
    expect(f.game.cardZones.discard.cards).toEqual([3, 2, 1, 0, 4]);
    expect(f.game.cardZones.draw.cards).toEqual([7, 8, 9, 10, 11]);
    expect(
      records(f.game.trace).filter((r) => r.name === "DrawNCards"),
    ).toHaveLength(1);
    expect(f.game.playerPhases.a).toBe("not-active");
    expect(f.game.playerMarks.a.Global_TurnCount).toBe(1);
    expect(f.game.playerHistory.a).toEqual({});
    expect(f.scheduler.frames).toEqual([]);
    expect(
      records(f.game.trace)
        .filter((r) => r.event === "EventPhaseStart")
        .map((r) => r.phase),
    ).toEqual([
      "round-start",
      "start",
      "judge",
      "draw",
      "play",
      "discard",
      "finish",
      "not-active",
    ]);
  });
  it.each([1, 7, 10000])(
    "restores every prompt/yield without replaying cards or phases (budget %i)",
    (budget) => {
      const expected = setup();
      root(expected);
      drain(expected);
      const f = setup();
      f.registry.stepBudget = budget;
      root(f);
      const boundaries = drain(f, true, true);
      expect(f.game).toEqual(expected.game);
      expect({ ...f.scheduler, yielded: f.scheduler.yielded ?? false }).toEqual(
        { ...expected.scheduler, yielded: false },
      );
      expect(boundaries).toBeGreaterThan(0);
      expect(
        Object.values(f.game.cardZones)
          .flatMap((z) => z.cards)
          .sort((a, b) => a - b),
      ).toEqual(Array.from({ length: 12 }, (_, id) => id));
    },
  );
  it("spends a halfmaxhp token before mandatory selection inside the same turn", () => {
    const f = setup();
    f.game.playerMarks.a["@halfmaxhp"] = 1;
    root(f);
    drain(f, true, true, "yes");
    expect(f.game.playerMarks.a["@halfmaxhp"]).toBe(0);
    expect(f.game.playerMarks.a.Global_MaxcardsIncrease).toBe(2);
    expect(f.game.cardZones.a.cards).toEqual([2, 3, 5, 6]);
    expect(f.game.cardZones.discard.cards).toEqual([1, 0, 4]);
    expect(
      records(f.game.trace).filter(
        (r) =>
          typeof r.data === "string" &&
          r.data.startsWith("cardDiscard:gamerule:"),
      ),
    ).toHaveLength(1);
  });
  it("advances from the regular anchor after an extra turn using the same Room", () => {
    const f = setup();
    root(f);
    drain(f);
    f.game.cardResources!.roomTags.ExtraTurnList = ["c"];
    root(f);
    drain(f, false, true);
    expect(f.game.currentPlayer).toBe("c");
    expect(f.game.playerMarks.c.Global_TurnCount).toBe(1);
    expect(f.game.cardZones.c.cards).toEqual([7, 8]);
    root(f);
    expect(f.game.currentPlayer).toBe("b");
    root(f);
    drain(f, false, true);
    expect(f.game.cardZones.b.cards).toEqual([9, 10]);
    expect(f.game.playerMarks.a.Global_TurnCount).toBe(1);
    expect(f.game.playerMarks.b.Global_TurnCount).toBe(1);
    expect(f.game.turnOrder).toEqual({ stage: "extra", anchor: "b" });
  });
  it("a face-down regular actor skips every phase body and still advances normally", () => {
    const f = setup();
    f.game.faceUp.a = false;
    const zones = structuredClone(f.game.cardZones);
    root(f);
    drain(f, false, true);
    expect(f.game.faceUp.a).toBe(true);
    expect(f.game.cardZones).toEqual(zones);
    expect(f.game.playerMarks.a.Global_RoundCount).toBeUndefined();
    expect(f.game.playerPhases.a).toBe("not-active");
    root(f);
    expect(f.game.currentPlayer).toBe("b");
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "preserves committed movement and unwinds a real Room use on %s",
    (reason) => {
      const f = setup();
      f.game.interruptEvent = "CardFinished";
      f.game.interruptReason = reason;
      f.registry.stepBudget = 7;
      root(f);
      drain(f, true, true);
      expect(f.scheduler.interruption?.reason).toBe(reason);
      expect(f.game.cardZones.discard.cards).toEqual([4]);
      expect(f.game.cardZones.table.cards).toEqual([0]);
      expect(f.game.playerPhases.a).toBe("play");
      f.game = JSON.parse(JSON.stringify(f.game));
      f.scheduler = JSON.parse(JSON.stringify(f.scheduler));
      expect(
        unwindTriggerInterruption(
          f.scheduler,
          f.game,
          f.registry,
          f.scheduler.interruption!,
        ),
      ).toBe(true);
      drain(f, false, true);
      expect(f.scheduler.frames).toEqual([]);
      expect(f.scheduler.unwindCompletion?.reason).toBe(reason);
      expect(f.game.cardZones.table.cards).toEqual(
        reason === "game-over" ? [0] : [],
      );
      expect(f.game.cardZones.discard.cards).toEqual(
        reason === "game-over" ? [4] : [0, 4],
      );
      if (reason === "turn-broken") {
        root(f, "recover-normal-turn");
        drain(f, false, true);
        expect(f.game.currentPlayer).toBe("b");
        expect(f.game.playerPhases.a).toBe("not-active");
        expect(f.game.playerHistory.a).toEqual({});
        root(f);
        drain(f, false, true);
        expect(f.game.playerMarks.b.Global_TurnCount).toBe(1);
      } else {
        // Classification/terminal ownership belongs to match-v3; do not invent recovery here.
        expect(f.game.currentPlayer).toBe("a");
        expect(f.game.playerPhases.a).toBe("play");
      }
    },
  );
  it("cannot spend the same Play answer after it has advanced to Discard", () => {
    const f = setup();
    root(f);
    expect(answer(f, "show_head_general")).toBe(true);
    const play = f.play.view(f.scheduler, "a")!;
    expect(f.play.view(f.scheduler, "b")).toBeNull();
    expect(
      f.play.submit(f.scheduler, f.game, f.registry, "b", {
        id: play.id,
        choice: null,
      }),
    ).toBe(false);
    expect(answer(f, null)).toBe(true);
    expect(f.game.playerPhases.a).toBe("discard");
    const snapshot = JSON.stringify(f.game);
    expect(
      f.play.submit(f.scheduler, f.game, f.registry, "a", {
        id: play.id,
        choice: null,
      }),
    ).toBe(false);
    expect(f.discard.view(f.scheduler, "b")).toBeNull();
    expect(JSON.stringify(f.game)).toBe(snapshot);
    drain(f, false, true);
    expect(f.game.cardZones.a.cards).toEqual([5, 6]);
    expect(f.game.playerPhases.a).toBe("not-active");
  });
  it("executes an inserted Draw phase before Play without replaying Judge or losing cards", () => {
    const f = setup();
    f.registry.skills.unshift({
      id: "package-extra-draw",
      rule: true,
      priority: 100,
      events: ["EventPhaseStart"],
      effect: ({ game, event }) => {
        if (event.target === "a" && game.playerPhases.a === "judge")
          insertPhase(game, "a", "draw");
        return { kind: "done", value: false };
      },
    });
    root(f);
    drain(f, true, true);
    expect(f.game.cardZones.a.cards).toEqual([7, 8]);
    expect(f.game.cardZones.discard.cards).toEqual([6, 5, 3, 2, 1, 0, 4]);
    expect(
      records(f.game.trace).filter((r) => r.name === "DrawNCards"),
    ).toHaveLength(2);
    expect(
      records(f.game.trace).filter(
        (r) => r.event === "EventPhaseStart" && r.phase === "judge",
      ),
    ).toHaveLength(1);
  });
  it("skips Play through the real phase queue and goes directly to mandatory Discard", () => {
    const f = setup();
    f.registry.skills.unshift({
      id: "package-skip-play",
      rule: true,
      priority: 100,
      events: ["EventPhaseStart"],
      effect: ({ game, event }) => {
        if (event.target === "a" && game.playerPhases.a === "draw")
          skipPhase(game, "a", "play");
        return { kind: "done", value: false };
      },
    });
    root(f);
    drain(f, false, true);
    expect(f.game.cardZones.a.cards).toEqual([5, 6]);
    expect(f.game.cardZones.discard.cards).toEqual([3, 2, 1, 0, 4]);
    expect(
      records(f.game.trace).filter((r) => r.event === "CardFinished"),
    ).toEqual([]);
    expect(
      records(f.game.trace).filter(
        (r) =>
          r.phase === "play" &&
          (r.event === "EventPhaseStart" || r.event === "EventPhaseProceeding"),
      ),
    ).toEqual([]);
    expect(f.game.playerPhases.a).toBe("not-active");
  });
});
