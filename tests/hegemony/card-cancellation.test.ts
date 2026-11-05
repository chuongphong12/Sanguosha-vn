import { describe, expect, it } from "vitest";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import type {
  CardEffect,
  CardEffectGame,
} from "../../src/game/hegemony/card-effect";
import { createCardCancellationOperation } from "../../src/game/hegemony/card-cancellation";
import { createCardEffectOperation } from "../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  areHegemonyFriends,
  createHegemonySetup,
  selectGeneralPair,
  revealHegemonyGeneral,
} from "../../src/game/hegemony";

type Game = CardEffectGame & {
  cancelable: boolean;
  asked: { data: TriggerData; tags: Record<string, TriggerData> }[];
  result: boolean;
  hegValid: boolean;
  friends: string[];
};
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c", "d"],
    alive: { a: true, b: true, c: true, d: true },
    playerFlags: { a: [], b: [], c: [], d: [] },
    cardZones: {},
    cardResources: {
      cards: {
        trick: {
          kind: "virtual",
          key: "duel-key",
          isSlash: false,
          isNDTrick: true,
          flags: [],
          tags: {},
        },
      },
      playerTags: { a: {}, b: {}, c: {}, d: {} },
      roomTags: { keep: ["unrelated"] },
    },
    cancelable: true,
    asked: [],
    result: false,
    hegValid: false,
    friends: ["b", "c"],
  };
}
function effectData(): CardEffect {
  return {
    from: "a",
    to: "b",
    multiple: false,
    nullified: false,
    disresponsive: false,
    card: {
      type: "trick",
      name: "duel",
      className: "Duel",
      skillName: "",
      materialIDs: [],
      flags: [],
    },
  };
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "card-cancellation-ce4e62b",
    skills: [],
    operations: [
      createCardCancellationOperation({
        reference: () => "trick",
        isCancelable: (game) => game.cancelable,
        isFriend: (game, player) => game.friends.includes(player),
        ask: (effect) => ({ name: "ask-nullification", data: effect }),
      }),
      {
        name: "ask-nullification",
        run: ({ game, operation }) => {
          game.asked.push({
            data: structuredClone(operation.data),
            tags: structuredClone(game.cardResources!.roomTags),
          });
          game.cardResources!.roomTags.HegNullificationValid = game.hegValid;
          return { kind: "return", value: game.result };
        },
      },
    ],
  };
}
function dispatch<G extends Game>(
  game: G,
  rules: TriggerRegistry<G> = registry(),
  data: TriggerData = effectData(),
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(
    scheduler,
    game,
    rules,
    { name: "card-cancellation", data },
    "a",
  );
  return scheduler;
}

describe("Hegemony Room isCanceled state", () => {
  it.each([
    { result: false, hegValid: false, reload: false },
    { result: true, hegValid: true, reload: false },
    { result: true, hegValid: false, reload: false },
    { result: false, hegValid: true, reload: false },
    { result: true, hegValid: true, reload: true },
    { result: false, hegValid: false, reload: true },
  ])(
    "composes real cancellation, GameRule flags/cache and final material/resource cleanup: %j",
    ({ result, hegValid, reload }) => {
      let game = Object.assign(fixture(), {
        events: [] as string[],
        applied: [] as TriggerData[],
      });
      game.result = result;
      game.hegValid = hegValid;
      game.cardZones = {
        hand: { owner: "a", place: "hand", cards: [1] },
        table: { owner: null, place: "table", cards: [] },
        discard: { owner: null, place: "discard", cards: [] },
      };
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"] = ["d"];
      const resources = { reference: () => "trick" };
      const rules: TriggerRegistry<typeof game> = registry();
      rules.operations!.push(
        createCardOnUseOperation({
          tableZone: "table",
          discardZone: "discard",
        }),
        createCardMovementOperation(),
        createCardUsedOperation({
          resources,
          use: (data) => ({ name: "card-use", data }),
        }),
        createCardUseOperation({
          ...resources,
          effect: (data) => ({ name: "card-effect", data }),
        }),
        createCardEffectOperation({
          isSlash: (snapshot) => snapshot.cardResources!.cards.trick.isSlash,
        }),
        createCardEffectedOperation({
          isSlash: (snapshot) => snapshot.cardResources!.cards.trick.isSlash,
          isTrick: (_snapshot, effect) => effect.card.type === "trick",
          cancel: (data) => ({ name: "card-cancellation", data }),
          onEffect: (data) => ({ name: "apply-effect", data }),
        }),
        {
          name: "apply-effect",
          run: ({ game, operation }) => {
            game.applied.push(structuredClone(operation.data));
            return { kind: "return", value: "ignored-void-child" };
          },
        },
      );
      rules.skills.push(
        createCardUsedRule(),
        createCardEffectedRule(),
        createCardFinishedRule(resources),
        {
          id: "observe-cancellation-pipeline",
          rule: true,
          priority: 1,
          events: ["PostCardEffected", "CardEffectConfirmed", "CardFinished"],
          effect: ({ game, event }) => {
            game.events.push(`${event.name}:${event.target}`);
            if (event.name === "CardFinished")
              expect(game.cardZones.table.cards).toEqual([1]);
            return { kind: "done", value: false };
          },
        },
      );
      if (reload) {
        const ask = rules.operations![1];
        rules.operations![1] = {
          ...ask,
          run: (context) => {
            if (context.continuation !== null)
              return { kind: "return", value: context.continuation };
            const step = ask.run(context);
            if ((context.operation.data as CardEffect).to === "c") return step;
            if (step.kind !== "return")
              throw new Error("Expected fixture ask return");
            return {
              kind: "prompt",
              actor: "b",
              choices: ["continue"],
              canCancel: false,
              continuation: step.value,
            };
          },
        };
      }
      const card = { ...effectData().card, materialIDs: [1] };
      let scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-on-use", data: { from: "a", to: ["b", "c"], card } },
        "a",
      );
      if (reload) {
        const prompt = getTriggerPrompt(scheduler, "b")!;
        expect(prompt).not.toBeNull();
        expect(game.cardZones.table.cards).toEqual([1]);
        expect(game.events).toEqual([]);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
        const completed = structuredClone({ game, scheduler });
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(false);
        expect({ game, scheduler }).toEqual(completed);
      }
      expect(game.asked.map((entry) => (entry.data as CardEffect).to)).toEqual(
        hegValid ? ["b"] : ["b", "c"],
      );
      expect(game.applied.map((data) => (data as CardEffect).to)).toEqual(
        result ? [] : hegValid ? ["b"] : ["b", "c"],
      );
      expect(
        game.events.filter((event) => event.startsWith("PostCardEffected")),
      ).toEqual(["PostCardEffected:b", "PostCardEffected:c"]);
      expect(game.events.at(-1)).toBe("CardFinished:a");
      expect(game.cardZones.hand.cards).toEqual([]);
      expect(game.cardZones.table.cards).toEqual([]);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(
        game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
      ).toBeUndefined();
      expect(game.cardResources!.roomTags["targetsduel-key"]).toBeUndefined();
      expect(game.cardResources!.roomTags.NullifyingTarget).toBe(
        hegValid ? "b" : "c",
      );
      expect(game.cardResources!.roomTags.NullifyingCard).toBe("trick");
      expect(game.playerFlags).toEqual({ a: [], b: [], c: [], d: [] });
      expect(scheduler.frames).toEqual([]);
    },
  );

  it.each([null, {}, { a: null }])(
    "keeps source player-tag validation on existing card-use callers: %j",
    (playerTags) => {
      const game = fixture();
      Object.assign(game.cardResources!, { playerTags });
      const rules = registry();
      rules.operations!.push(
        createCardUseOperation({
          reference: () => "trick",
          effect: (data) => ({ name: "card-cancellation", data }),
        }),
      );
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          {
            name: "card-use",
            data: { from: "a", to: ["b"], card: effectData().card },
          },
          "a",
        ),
      ).toThrow("Invalid card resources");
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it.each([false, true])(
    "resumes an ask exactly once after JSON reload and uses late alive/key state (result=%s)",
    (result) => {
      let game = fixture();
      game.result = result;
      game.hegValid = true;
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"] = [
        "a",
        "c",
      ];
      const rules = registry();
      const ask = rules.operations![1];
      rules.operations![1] = {
        ...ask,
        run: (context) => {
          if (context.continuation !== null)
            return { kind: "return", value: context.continuation };
          const step = ask.run(context);
          if (step.kind !== "return")
            throw new Error("Expected fixture ask return");
          return {
            kind: "prompt",
            actor: "b",
            choices: ["continue"],
            canCancel: false,
            continuation: step.value,
          };
        },
      };
      let scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "b")!;
      expect(prompt).not.toBeNull();
      expect(getTriggerPrompt(scheduler, "a")).toBeNull();
      expect(game.asked).toHaveLength(1);
      expect(
        game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
      ).toEqual(["a", "c"]);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      game.alive.c = false;
      game.cardResources!.cards.trick.key = "late-key";
      const pending = structuredClone({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect({ game, scheduler }).toEqual(pending);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(true);
      expect(game.asked).toHaveLength(1);
      expect(
        game.cardResources!.roomTags["late-keyHegNullificationTargets"],
      ).toEqual(["a", "c", "b"]);
      expect(scheduler.operationCompletion?.value).toBe(result);
      expect(scheduler.frames).toEqual([]);
      const completed = structuredClone({ game, scheduler });
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: prompt.id,
          choice: "continue",
        }),
      ).toBe(false);
      expect({ game, scheduler }).toEqual(completed);
    },
  );

  it.each([false, true])(
    "does not restore nested Nullifying tags or replace the saved outer cache (reload=%s)",
    (reload) => {
      let game = fixture();
      game.hegValid = true;
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"] = ["a"];
      const rules = registry();
      rules.operations![0] = createCardCancellationOperation({
        reference: () => "trick",
        isCancelable: () => true,
        isFriend: (_game, player, target) => player === target,
        ask: (data) => ({ name: "ask-nullification", data }),
      });
      const ask = rules.operations![1];
      rules.operations![1] = {
        ...ask,
        run: (context) => {
          if (context.operationChild)
            return { kind: "return", value: context.operationChild.value };
          if (context.continuation !== null)
            return { kind: "return", value: context.continuation };
          const effect = context.operation.data as CardEffect;
          const step = ask.run(context);
          if (effect.to === "b")
            return {
              kind: "operation",
              operation: {
                name: "card-cancellation",
                data: { ...effectData(), from: "c", to: "d" },
              },
              continuation: true,
            };
          context.game.cardResources!.roomTags.NullifyingTimes = 7;
          context.game.cardResources!.cards.trick.key = "nested-key";
          return reload
            ? {
                kind: "prompt",
                actor: "d",
                choices: ["continue"],
                canCancel: false,
                continuation: false,
              }
            : step;
        },
      };
      let scheduler = dispatch(game, rules);
      if (reload) {
        const prompt = getTriggerPrompt(scheduler, "d")!;
        expect(prompt).not.toBeNull();
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "d", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
      }
      expect(game.asked.map((entry) => (entry.data as CardEffect).to)).toEqual([
        "b",
        "d",
      ]);
      expect(game.cardResources!.roomTags).toEqual({
        keep: ["unrelated"],
        "duel-keyHegNullificationTargets": ["a"],
        "nested-keyHegNullificationTargets": ["a", "b"],
        HegNullificationValid: true,
        NullifyingTarget: "d",
        NullifyingSource: "c",
        NullifyingCard: "trick",
        NullifyingTimes: 7,
      });
      expect(scheduler.operationCompletion?.value).toBe(false);
    },
  );

  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes eager ask tags on %s without fanout or unwind",
    (reason) => {
      const game = fixture();
      game.hegValid = true;
      const rules = registry();
      const ask = rules.operations![1];
      rules.operations![1] = {
        ...ask,
        run: (context) => {
          ask.run(context);
          return { kind: "interrupt", reason };
        },
      };
      const scheduler = dispatch(game, rules);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(scheduler.operationCompletion).toBeNull();
      expect(game.asked).toHaveLength(1);
      expect(game.cardResources!.roomTags.NullifyingCard).toBe("trick");
      expect(game.cardResources!.roomTags.HegNullificationValid).toBe(true);
      expect(
        game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
      ).toBeUndefined();
    },
  );

  it.each([false, true])(
    "uses the existing Quốc Chiến friendship domain after reveal/death during ask (targetDead=%s)",
    (targetDead) => {
      const seats = ["a", "b", "c", "d"];
      const generals = seats.flatMap((id) =>
        ["head", "deputy"].map((slot) => ({
          id: `${id}-${slot}`,
          kingdoms: [id === "d" ? "shu" : "wei"],
          headMaxHp: 4,
          deputyMaxHp: 4,
        })),
      );
      const identity = createHegemonySetup({
        generals,
        offers: Object.fromEntries(
          seats.map((id) => [id, [`${id}-head`, `${id}-deputy`]]),
        ),
      });
      for (const id of seats)
        expect(
          selectGeneralPair(identity, id, {
            head: `${id}-head`,
            deputy: `${id}-deputy`,
          }),
        ).toBe(true);
      expect(revealHegemonyGeneral(identity, "b", "head")).toBe(true);
      expect(revealHegemonyGeneral(identity, "d", "head")).toBe(true);
      const game = Object.assign(fixture(), { identity });
      game.hegValid = true;
      const rules: TriggerRegistry<typeof game> = registry();
      rules.operations![0] = createCardCancellationOperation({
        reference: () => "trick",
        isCancelable: () => true,
        isFriend: (snapshot, player, target) =>
          areHegemonyFriends(snapshot.identity, player, target),
        ask: (data) => ({ name: "ask-nullification", data }),
      });
      const ask = rules.operations![1];
      rules.operations![1] = {
        ...ask,
        run: (context) => {
          const step = ask.run(context);
          expect(
            revealHegemonyGeneral(context.game.identity, "c", "head"),
          ).toBe(true);
          context.game.alive.b = !targetDead;
          context.game.identity.players.b.alive = !targetDead;
          return step;
        },
      };
      dispatch(game, rules);
      expect(
        game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
      ).toEqual(targetDead ? ["c"] : ["b", "c"]);
    },
  );

  it("isolates cancelability, reference, friendship and ask descriptor mutation from saved state", () => {
    const game = fixture();
    game.hegValid = true;
    const rules = registry();
    rules.operations![0] = createCardCancellationOperation({
      reference: (effect) => {
        effect.to = "d";
        return "trick";
      },
      isCancelable: (snapshot, effect) => {
        snapshot.cardResources!.roomTags.leak = true;
        effect.from = null;
        return true;
      },
      isFriend: (snapshot, player, target) => {
        snapshot.alive.b = false;
        return player === target;
      },
      ask: (effect) => {
        const data = structuredClone(effect);
        effect.to = "d";
        return { name: "ask-nullification", data };
      },
    });
    dispatch(game, rules);
    expect(game.asked[0].data).toEqual(effectData());
    expect(game.cardResources!.roomTags.leak).toBeUndefined();
    expect(game.cardResources!.roomTags.NullifyingSource).toBe("a");
    expect(
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
    ).toEqual(["b"]);
    expect(game.alive.b).toBe(true);
  });
  it.each([false, true])(
    "uses a null source without requiring source player tags (ask=%s)",
    (result) => {
      const game = fixture();
      game.result = result;
      Object.assign(game.cardResources!, { playerTags: null });
      const data = { ...effectData(), from: null, extra: ["keep"] };
      const scheduler = dispatch(game, registry(), data);
      expect(scheduler.operationCompletion?.value).toBe(result);
      expect(game.asked[0].data).toEqual(data);
      expect(game.cardResources!.roomTags.NullifyingSource).toBeNull();
    },
  );

  it("checks cancelability before a cached target and preserves all room tags when false", () => {
    const game = fixture();
    game.cancelable = false;
    game.cardResources!.roomTags["duel-keyHegNullificationTargets"] = ["b"];
    game.cardResources!.roomTags.HegNullificationValid = "malformed-but-unused";
    const before = structuredClone(game);
    expect(dispatch(game).operationCompletion?.value).toBe(false);
    expect(game).toEqual(before);
  });

  it.each([false, true])(
    "does not modify the cache when post-ask ND-trick=%s and valid=false",
    (ndTrick) => {
      const game = fixture();
      game.result = true;
      game.cardResources!.cards.trick.isNDTrick = ndTrick;
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"] = ["old"];
      const rules = registry();
      const ask = rules.operations![1];
      rules.operations![1] = {
        ...ask,
        run: (context) => {
          const step = ask.run(context);
          context.game.cardResources!.roomTags[
            "duel-keyHegNullificationTargets"
          ] = ["child-write"];
          return step;
        },
      };
      expect(dispatch(game, rules).operationCompletion?.value).toBe(true);
      expect(
        game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
      ).toEqual(["child-write"]);
    },
  );

  it("does not fan out when the original card becomes delayed during the ask", () => {
    const game = fixture();
    game.result = true;
    game.hegValid = true;
    const rules = registry();
    const ask = rules.operations![1];
    rules.operations![1] = {
      ...ask,
      run: (context) => {
        const step = ask.run(context);
        context.game.cardResources!.cards.trick.isNDTrick = false;
        context.game.cardResources!.roomTags[
          "duel-keyHegNullificationTargets"
        ] = ["child-write"];
        return step;
      },
    };
    expect(dispatch(game, rules).operationCompletion?.value).toBe(true);
    expect(
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
    ).toEqual(["child-write"]);
  });

  it("treats a removed post-child valid tag as false", () => {
    const game = fixture();
    game.hegValid = true;
    const rules = registry();
    const ask = rules.operations![1];
    rules.operations![1] = {
      ...ask,
      run: (context) => {
        const step = ask.run(context);
        delete context.game.cardResources!.roomTags.HegNullificationValid;
        return step;
      },
    };
    expect(dispatch(game, rules).operationCompletion?.value).toBe(false);
    expect(
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
    ).toBeUndefined();
  });

  it.each([null, "yes", 1, { canceled: true }])(
    "rejects malformed ask results while retaining eager tags: %j",
    (value) => {
      const game = fixture();
      const rules = registry();
      rules.operations![1] = {
        name: "ask-nullification",
        run: ({ game }) => {
          game.cardResources!.roomTags.completedChild = true;
          return { kind: "return", value };
        },
      };
      expect(() => dispatch(game, rules)).toThrow(
        "Invalid nullification ask result",
      );
      expect(game.cardResources!.roomTags).toMatchObject({
        HegNullificationValid: false,
        NullifyingTarget: "b",
        NullifyingSource: "a",
        NullifyingCard: "trick",
        NullifyingTimes: 0,
        completedChild: true,
      });
    },
  );

  it.each([null, "true", [true]])(
    "rejects malformed post-child HegNullificationValid: %j",
    (value) => {
      const game = fixture();
      const rules = registry();
      rules.operations![1] = {
        name: "ask-nullification",
        run: ({ game }) => {
          game.cardResources!.roomTags.HegNullificationValid = value;
          return { kind: "return", value: true };
        },
      };
      expect(() => dispatch(game, rules)).toThrow(
        "Invalid HegNullificationValid",
      );
      expect(game.cardResources!.roomTags.NullifyingCard).toBe("trick");
      expect(
        game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
      ).toBeUndefined();
    },
  );

  it.each(["alive", "friend"])(
    "rejects invalid post-child %s at fanout without writing a partial cache",
    (field) => {
      const game = fixture();
      game.hegValid = true;
      const rules = registry();
      if (field === "alive") Object.assign(game.alive, { c: "yes" });
      else
        rules.operations![0] = createCardCancellationOperation({
          reference: () => "trick",
          isCancelable: () => true,
          isFriend: (_game, player) =>
            player === "c" ? JSON.parse('"yes"') : true,
          ask: (data) => ({ name: "ask-nullification", data }),
        });
      expect(() => dispatch(game, rules)).toThrow(
        field === "alive"
          ? "Invalid nullification player alive state"
          : "Invalid nullification friendship",
      );
      expect(game.asked).toHaveLength(1);
      expect(game.cardResources!.roomTags.HegNullificationValid).toBe(true);
      expect(
        game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
      ).toBeUndefined();
    },
  );

  it("rejects a malformed cancelability result in standalone preflight", () => {
    const game = fixture();
    const rules = registry();
    rules.operations![0] = createCardCancellationOperation({
      reference: () => "trick",
      isCancelable: () => JSON.parse('"yes"'),
      isFriend: () => false,
      ask: (data) => ({ name: "ask-nullification", data }),
    });
    const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    const before = structuredClone({ game, scheduler });
    expect(() =>
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-cancellation", data: effectData() },
        "a",
      ),
    ).toThrow("Invalid card cancelability");
    expect({ game, scheduler }).toEqual(before);
  });

  it.each(["missing", "key", "storage"])(
    "rejects malformed selected reference %s before allocating a frame",
    (field) => {
      const game = fixture();
      if (field === "missing") delete game.cardResources!.cards.trick;
      else if (field === "key") game.cardResources!.cards.trick.key = "";
      else Object.assign(game.cardResources!.cards.trick, { flags: [1] });
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-cancellation", data: effectData() },
          "a",
        ),
      ).toThrow("Invalid card resource");
      expect({ game, scheduler }).toEqual(before);
    },
  );

  it("preserves eager child state when its original reference becomes malformed", () => {
    const game = fixture();
    const rules = registry();
    const ask = rules.operations![1];
    rules.operations![1] = {
      ...ask,
      run: (context) => {
        const step = ask.run(context);
        context.game.cardResources!.cards.trick.key = "";
        return step;
      },
    };
    expect(() => dispatch(game, rules)).toThrow(
      "Invalid card resource reference",
    );
    expect(game.asked).toHaveLength(1);
    expect(game.cardResources!.roomTags.NullifyingCard).toBe("trick");
  });

  it("uses wrapped canonical key/storage without changing the wrapped modified state", () => {
    const game = fixture();
    game.hegValid = true;
    game.result = true;
    game.cardResources!.cards.trick = {
      kind: "wrapped",
      id: 7,
      key: "7",
      isSlash: false,
      isNDTrick: true,
    };
    game.wrappedCards = {
      7: {
        name: "duel",
        className: "Duel",
        suit: "spade",
        number: 1,
        skillName: "",
        modified: true,
        flags: ["keep"],
        tags: { private: true },
      },
    };
    const before = structuredClone(game.wrappedCards);
    expect(dispatch(game).operationCompletion?.value).toBe(true);
    expect(game.cardResources!.roomTags["7HegNullificationTargets"]).toEqual([
      "b",
      "c",
    ]);
    expect(game.cardResources!.roomTags.NullifyingCard).toBe("trick");
    expect(game.wrappedCards).toEqual(before);
  });
  it.each([false, true])(
    "appends living friends to the saved list without deduplication even when ask result=%s",
    (result) => {
      const game = fixture();
      game.result = result;
      game.hegValid = true;
      game.alive.a = false;
      game.friends = ["a", "b", "c", "d"];
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"] = [
        "old",
        "c",
        "c",
      ];
      const rules = registry();
      const ask = rules.operations![1];
      rules.operations![1] = {
        ...ask,
        run: (context) => {
          const step = ask.run(context);
          context.game.cardResources!.roomTags[
            "duel-keyHegNullificationTargets"
          ] = ["nested-write"];
          context.game.friends = ["a", "b", "c"];
          return step;
        },
      };
      const scheduler = dispatch(game, rules);
      expect(scheduler.operationCompletion?.value).toBe(result);
      expect(
        game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
      ).toEqual(["old", "c", "c", "b", "c"]);
    },
  );

  it("reads current key and ND-trick ancestry from the original reference after the ask", () => {
    const game = fixture();
    game.hegValid = true;
    game.cardResources!.cards.trick.isNDTrick = false;
    const rules = registry();
    const ask = rules.operations![1];
    rules.operations![1] = {
      ...ask,
      run: (context) => {
        const step = ask.run(context);
        const card = context.game.cardResources!.cards.trick;
        card.key = "converted-key";
        card.isNDTrick = true;
        return step;
      },
    };
    dispatch(game, rules);
    expect(
      game.cardResources!.roomTags["converted-keyHegNullificationTargets"],
    ).toEqual(["b", "c"]);
    expect(
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
    ).toBeUndefined();
    expect(game.cardResources!.roomTags.NullifyingCard).toBe("trick");
  });
  it("returns before resources or cached targets when the package says not cancelable", () => {
    const game = fixture();
    game.cancelable = false;
    delete game.cardResources;
    const before = structuredClone(game);
    const scheduler = dispatch(game);
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(game).toEqual(before);
  });

  it("uses cached HegNullificationTargets without resetting shared tags or asking", () => {
    const game = fixture();
    Object.assign(game.cardResources!.roomTags, {
      "duel-keyHegNullificationTargets": ["unknown", "b", "b"],
      HegNullificationValid: true,
      NullifyingSource: "nested",
    });
    const before = structuredClone(game);
    const scheduler = dispatch(game);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game).toEqual(before);
  });

  it.each([null, "b", [1]])(
    "rejects malformed supplied cache list before allocating a frame: %j",
    (value) => {
      const game = fixture();
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"] = value;
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "card-cancellation", data: effectData() },
          "a",
        ),
      ).toThrow("Invalid HegNullificationTargets");
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it("initializes the native shared ask tags and returns the child's boolean", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(game.asked).toEqual([
      {
        data: effectData(),
        tags: {
          keep: ["unrelated"],
          HegNullificationValid: false,
          NullifyingTarget: "b",
          NullifyingSource: "a",
          NullifyingCard: "trick",
          NullifyingTimes: 0,
        },
      },
    ]);
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(scheduler.frames).toEqual([]);
  });
});
