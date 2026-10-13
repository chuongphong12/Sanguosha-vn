import { describe, expect, it } from "vitest";
import {
  createNullificationOperation,
  type NullificationGame,
  type NullificationRules,
} from "../../src/game/hegemony/nullification";
import type { CardEffect } from "../../src/game/hegemony/card-effect";
import type { CardUse } from "../../src/game/hegemony/card-on-use";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createCardEffectOperation } from "../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createCardCancellationOperation } from "../../src/game/hegemony/card-cancellation";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  resumeTriggerPrompt,
  getTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
  type TriggerContext,
  type TriggerStep,
  type OperationHandler,
} from "../../src/game/hegemony/scheduler";

type Game = NullificationGame & {
  available: string[];
  online: string[];
  replies: TriggerData[];
  races: TriggerData[];
  validated: TriggerData[];
  revealed: TriggerData[];
  after: TriggerData[];
  events: { name: string; target: string | null; data: TriggerData }[];
  identities: Record<
    string,
    { careerist: boolean; shown: boolean; kingdom: string }
  >;
  cancelable: boolean;
  reject: number;
};
function card(name = "duel", ids: number[] = []): CardUse["card"] {
  return {
    name,
    className: name === "duel" ? "Duel" : "Nullification",
    type: "trick",
    skillName: "",
    flags: [],
    materialIDs: ids,
  };
}
function effect(): CardEffect {
  return {
    from: "a",
    to: "b",
    card: card(),
    multiple: true,
    nullified: false,
    disresponsive: false,
  };
}
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c", "d"],
    alive: { a: true, b: true, c: true, d: true },
    playerFlags: { a: [], b: [], c: [], d: [] },
    cardZones: {
      hand: { owner: "c", place: "hand", cards: [1, 2] },
      table: { owner: null, place: "table", cards: [] },
      discard: { owner: null, place: "discard", cards: [] },
    },
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
        reply: {
          kind: "virtual",
          key: "reply-key",
          isSlash: false,
          isNDTrick: true,
          flags: [],
          tags: {},
        },
        counter: {
          kind: "virtual",
          key: "counter-key",
          isSlash: false,
          isNDTrick: true,
          flags: [],
          tags: {},
        },
      },
      playerTags: { a: {}, b: {}, c: {}, d: {} },
      roomTags: { NullifyingTimes: 0 },
    },
    available: ["c"],
    online: ["c"],
    replies: [],
    races: [],
    validated: [],
    revealed: [],
    after: [],
    events: [],
    identities: Object.fromEntries(
      ["a", "b", "c", "d"].map((id) => [
        id,
        { careerist: false, shown: true, kingdom: id === "a" ? "shu" : "wei" },
      ]),
    ),
    cancelable: false,
    reject: 0,
  };
}
function registry(
  overrides: Partial<NullificationRules<Game>> = {},
): TriggerRegistry<Game> {
  return {
    version: "nullification-ce4e62b",
    skills: [
      {
        id: "observe",
        events: [
          "TrickCardCanceling",
          "PreCardUsed",
          "CardUsed",
          "ChoiceMade",
          "CardFinished",
        ],
        priority: 10,
        record: ({ game, event }) => {
          game.events.push(structuredClone(event));
        },
        effect: () => ({ kind: "done", value: false }),
      },
    ],
    operations: [
      createNullificationOperation<Game>({
        tableZone: "table",
        discardZone: "discard",
        hasNullification: (game, player) => game.available.includes(player),
        isOnline: (game, player) => game.online.includes(player),
        isNullification: (_game, reference) => reference !== "trick",
        isHegNullification: (_game, reference) => reference === "heg",
        identity: (game, player) => game.identities[player],
        isCancelable: (game) => game.cancelable,
        race: (data) => ({ name: "race", data }),
        validateResponse: (player, response) => ({
          name: "validate",
          data: { player, response },
        }),
        reveal: (player, response) => ({
          name: "reveal",
          data: { player, response },
        }),
        validateAfter: (player, original, use) => ({
          name: "after",
          data: { player, original, use },
        }),
        moveReason: (_game, player, response) => ({
          kind: "use",
          actor: player,
          skill: response.card.skillName,
          event: "",
        }),
        ...overrides,
      }),
      createCardMovementOperation(),
      {
        name: "race",
        run: ({ game, operation }) => {
          game.races.push(structuredClone(operation.data));
          return { kind: "return", value: game.replies.shift() ?? null };
        },
      },
      {
        name: "validate",
        run: ({ game, operation }) => {
          game.validated.push(structuredClone(operation.data));
          const data = operation.data as {
            player: string;
            response: TriggerData;
          };
          return {
            kind: "return",
            value: game.reject-- > 0 ? null : data.response,
          };
        },
      },
      {
        name: "reveal",
        run: ({ game, operation }) => {
          game.revealed.push(structuredClone(operation.data));
          return { kind: "return", value: null };
        },
      },
      {
        name: "after",
        run: ({ game, operation }) => {
          game.after.push(structuredClone(operation.data));
          return { kind: "return", value: null };
        },
      },
    ],
  };
}
function dispatch(
  game: Game,
  rules = registry(),
  data: TriggerData = { effect: effect(), reference: "trick", positive: true },
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(
    scheduler,
    game,
    rules,
    { name: "ask-nullification", data },
    "a",
  );
  return scheduler;
}
function response(reference = "reply", ids = [1]): TriggerData {
  return {
    player: "c",
    response: { reference, card: card("nullification", ids) },
  };
}
function rule(
  rules: TriggerRegistry<Game>,
  name: string,
  effect: (context: TriggerContext<Game>) => TriggerStep,
) {
  rules.skills.push({
    id: `fixture-${name}`,
    events: [name],
    priority: 0,
    rule: true,
    effect,
  });
}
function operation(
  rules: TriggerRegistry<Game>,
  name: string,
  run: OperationHandler<Game>["run"],
) {
  rules.operations = rules.operations!.filter(
    (handler) => handler.name !== name,
  );
  rules.operations.push({ name, run });
}
function hegGame(targets: string[] = ["b", "d"]) {
  const game = fixture();
  game.cardResources!.cards.heg = structuredClone(
    game.cardResources!.cards.reply,
  );
  game.cardResources!.roomTags["targetsduel-key"] = targets;
  game.replies.push(response("heg"));
  return game;
}

describe("normalized Hegemony Nullification protocol", () => {
  it("reloads within hegemonic skillChoice before eager type/material mutations without replaying the choice", () => {
    let game = hegGame();
    const rules = registry();
    rule(rules, "ChoiceMade", ({ event, continuation }) =>
      typeof event.data === "string" &&
      event.data.startsWith("skillChoice:") &&
      continuation === null
        ? {
            kind: "prompt",
            actor: "c",
            choices: ["continue"],
            canCancel: false,
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    let scheduler = dispatch(game, rules);
    const choice = getTriggerPrompt(scheduler, "c")!;
    resumeTriggerPrompt(scheduler, game, rules, "c", {
      id: choice.id,
      choice: "all",
    });
    const skill = getTriggerPrompt(scheduler, "c")!;
    expect(game.cardResources!.roomTags.NullificatonType).toBeUndefined();
    expect(game.cardZones.hand.cards).toEqual([1, 2]);
    game = JSON.parse(JSON.stringify(game));
    scheduler = JSON.parse(JSON.stringify(scheduler));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "c", {
        id: choice.id,
        choice: "all",
      }),
    ).toBe(false);
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "c", {
        id: skill.id,
        choice: "continue",
      }),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(
      game.events
        .filter((event) => event.name === "ChoiceMade")
        .map((event) => event.data),
    ).toEqual([
      "skillChoice:heg_nullification:all",
      "Nullification:Duel:b:true",
    ]);
    expect(game.cardResources!.roomTags.HegNullificationValid).toBe(true);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it("emits hegemonic skillChoice before setting type/hand-origin and ignores its consumption/rewrites", () => {
    const game = hegGame();
    const rules = registry();
    rule(rules, "ChoiceMade", ({ game, event }) => {
      if (event.data === "skillChoice:heg_nullification:all") {
        expect(game.cardResources!.roomTags.NullificatonType).toBeUndefined();
        game.cardZones.hand.place = "special";
        game.cardZones.hand.pileName = "private";
        event.data = null;
      }
      return { kind: "done", value: true };
    });
    const scheduler = dispatch(game, rules);
    const prompt = getTriggerPrompt(scheduler, "c")!;
    resumeTriggerPrompt(scheduler, game, rules, "c", {
      id: prompt.id,
      choice: "all",
    });
    expect(game.events.map((e) => e.name)).toEqual([
      "TrickCardCanceling",
      "ChoiceMade",
      "PreCardUsed",
      "CardUsed",
      "ChoiceMade",
      "CardFinished",
    ]);
    expect(game.events[1].data).toBe("skillChoice:heg_nullification:all");
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.after).toMatchObject([{ use: { isHandcard: false } }]);
  });
  it("supports a nullable original source through race, retry and ChoiceMade", () => {
    const game = fixture();
    game.reject = 1;
    game.replies = [response(), response("counter", [2])];
    const data = {
      effect: { ...effect(), from: null },
      reference: "trick",
      positive: false,
    };
    const scheduler = dispatch(game, registry(), data);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.races).toMatchObject([
      {
        ask: {
          positive: false,
          effect: { from: null },
          origin: { effect: { from: null } },
        },
      },
      {
        ask: {
          positive: false,
          effect: { from: null },
          origin: { effect: { from: null } },
        },
      },
    ]);
    expect(game.events.find((e) => e.name === "ChoiceMade")?.data).toBe(
      "Nullification:Duel:b:false",
    );
  });
  it("keeps a captured race member eligible after death during the external race", () => {
    const game = fixture();
    game.replies.push(response());
    const rules = registry();
    const saved = rules.operations!.find((handler) => handler.name === "race")!;
    operation(rules, "race", (context) => {
      context.game.alive.c = false;
      return saved.run(context);
    });
    expect(dispatch(game, rules).operationCompletion?.value).toBe(true);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it("checks counter cancelability at the responder with null source and the validated reference", () => {
    const game = fixture();
    game.replies.push(response());
    const rules = registry({
      isCancelable: (_game, check, reference) =>
        check.from === null &&
        check.to === "c" &&
        !check.multiple &&
        !check.nullified &&
        !check.disresponsive &&
        check.card.name === "nullification" &&
        reference === "reply",
    });
    expect(dispatch(game, rules).operationCompletion?.value).toBe(true);
    expect(game.races).toHaveLength(2);
  });
  it("reads the current trick key and identity after response validation", () => {
    const game = hegGame([]);
    game.identities.d.shown = false;
    const rules = registry();
    const saved = rules.operations!.find(
      (handler) => handler.name === "validate",
    )!;
    operation(rules, "validate", (context) => {
      context.game.cardResources!.cards.trick.key = "changed-key";
      context.game.cardResources!.roomTags["targetschanged-key"] = ["b", "d"];
      context.game.identities.d.shown = true;
      return saved.run(context);
    });
    expect(
      getTriggerPrompt(dispatch(game, rules), "c")?.choices.map((c) => c.id),
    ).toEqual(["single", "all"]);
  });
  it("retains the all eligibility decision but computes hand origin after the choice resumes", () => {
    const game = hegGame();
    const rules = registry();
    const scheduler = dispatch(game, rules);
    const prompt = getTriggerPrompt(scheduler, "c")!;
    game.identities.b.careerist = true;
    game.identities.d.shown = false;
    game.cardZones.hand.place = "special";
    game.cardZones.hand.pileName = "hand-pile";
    resumeTriggerPrompt(scheduler, game, rules, "c", {
      id: prompt.id,
      choice: "all",
    });
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.after).toMatchObject([{ use: { isHandcard: false } }]);
    expect(game.cardResources!.roomTags.HegNullificationValid).toBe(true);
  });
  it("isolates pure predicates and every descriptor input from saved authoritative cursors", () => {
    const game = fixture();
    game.replies.push(response());
    const rules = registry({
      hasNullification: (copy, player) => {
        copy.alive.a = false;
        copy.cardResources!.roomTags.injected = true;
        return player === "c";
      },
      isOnline: (copy) => {
        copy.available.length = 0;
        return true;
      },
      isHegNullification: (copy) => {
        copy.cardResources!.cards.trick.key = "corrupt";
        return false;
      },
      isCancelable: (copy, check) => {
        copy.cardZones.hand.cards = [];
        check.to = "a";
        return false;
      },
      race: (request) => {
        const copied = structuredClone(request);
        request.ask.effect.to = "a";
        request.humans.length = 0;
        return { name: "race", data: copied };
      },
      validateResponse: (player, response) => {
        const copied = structuredClone(response);
        response.card.materialIDs.length = 0;
        response.reference = "unknown";
        return { name: "validate", data: { player, response: copied } };
      },
      reveal: (player, response) => {
        response.card.materialIDs.length = 0;
        return { name: "reveal", data: { player, response } };
      },
      moveReason: (copy, player, response) => {
        copy.alive.b = false;
        response.card.materialIDs.length = 0;
        return { kind: "use", actor: player };
      },
      validateAfter: (player, original, use) => {
        original.reference = "unknown";
        use.card.materialIDs.length = 0;
        return { name: "after", data: { player, original, use } };
      },
    });
    expect(dispatch(game, rules).operationCompletion?.value).toBe(true);
    expect(game.alive).toEqual({ a: true, b: true, c: true, d: true });
    expect(game.available).toEqual(["c"]);
    expect(game.cardResources!.cards.trick.key).toBe("duel-key");
    expect(game.cardResources!.roomTags.injected).toBeUndefined();
    expect(game.events.find((e) => e.name === "ChoiceMade")?.data).toBe(
      "Nullification:Duel:b:true",
    );
    expect(game.cardZones.hand.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it("composes real materials, GameRule, cancellation, all-choice reload, target cache and final cleanup", () => {
    let game = hegGame();
    game.cardZones.original = { owner: "a", place: "hand", cards: [3] };
    const rules = registry();
    const resources = {
      reference: (use: CardUse) => (use.card.name === "duel" ? "trick" : "heg"),
    };
    rules.operations!.push(
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardUsedOperation({
        resources,
        use: (data) => ({
          name: data.card.name === "duel" ? "card-use" : "nullification-use",
          data,
        }),
      }),
      createCardUseOperation({
        ...resources,
        effect: (data) => ({ name: "card-effect", data }),
      }),
      createCardEffectOperation({ isSlash: () => false }),
      createCardEffectedOperation({
        isSlash: () => false,
        isTrick: () => true,
        cancel: (data) => ({ name: "card-cancellation", data }),
        onEffect: (data) => ({ name: "applied-effect", data }),
      }),
      createCardCancellationOperation({
        reference: () => "trick",
        isCancelable: () => true,
        isFriend: (game, player, target) =>
          game.identities[player].kingdom === game.identities[target].kingdom,
        ask: (data) => ({
          name: "ask-nullification",
          data: { effect: data, reference: "trick", positive: true },
        }),
      }),
      {
        name: "nullification-use",
        run: () => ({ kind: "return", value: null }),
      },
      {
        name: "applied-effect",
        run: () => {
          throw new Error(
            "An all-nullified target must not receive its effect",
          );
        },
      },
    );
    rules.skills.push(
      createCardUsedRule(),
      createCardEffectedRule(),
      createCardFinishedRule(resources),
    );
    let scheduler = createTriggerScheduler(game.seatOrder, rules.version);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "card-on-use",
        data: { from: "a", to: ["b", "d"], card: card("duel", [3]) },
      },
      "a",
    );
    const prompt = getTriggerPrompt(scheduler, "c")!;
    expect(game.cardZones.table.cards).toEqual([3]);
    game = JSON.parse(JSON.stringify(game));
    scheduler = JSON.parse(JSON.stringify(scheduler));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "c", {
        id: prompt.id,
        choice: "all",
      }),
    ).toBe(true);
    expect(scheduler.frames).toEqual([]);
    expect(game.races).toHaveLength(1);
    expect(game.cardZones.table.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([3, 1]);
    expect(
      game.cardResources!.roomTags["duel-keyHegNullificationTargets"],
    ).toBeUndefined();
    expect(game.cardResources!.roomTags.HegNullificationValid).toBe(true);
    expect(game.playerFlags.b).toEqual([]);
    expect(game.playerFlags.d).toEqual([]);
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "c", {
        id: prompt.id,
        choice: "all",
      }),
    ).toBe(false);
  });
  it.each([
    "race",
    "validate",
    "reveal",
    "after",
    "TrickCardCanceling",
    "PreCardUsed",
    "CardUsed",
    "ChoiceMade",
    "CardFinished",
    "heg-choice",
  ])(
    "resumes exactly once after JSON reload at %s and rejects wrong/stale/replayed replies",
    (boundary) => {
      let game = boundary === "heg-choice" ? hegGame() : fixture();
      if (boundary !== "heg-choice") game.replies.push(response());
      const rules = registry();
      if (["race", "validate", "reveal", "after"].includes(boundary)) {
        const saved = rules.operations!.find(
          (handler) => handler.name === boundary,
        )!;
        operation(rules, boundary, (context) =>
          context.continuation === null
            ? {
                kind: "prompt",
                actor: "c",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              }
            : saved.run({ ...context, continuation: null, answer: null }),
        );
      } else if (boundary !== "heg-choice")
        rule(rules, boundary, ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "c",
                choices: ["continue"],
                canCancel: false,
                continuation: true,
              }
            : { kind: "done", value: false },
        );
      let scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "c")!;
      expect(getTriggerPrompt(scheduler, "a")).toBeNull();
      const choice = boundary === "heg-choice" ? "all" : "continue";
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "a", {
          id: prompt.id,
          choice,
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: "stale",
          choice,
        }),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: prompt.id,
          choice: null,
        }),
      ).toBe(false);
      game = JSON.parse(JSON.stringify(game));
      scheduler = JSON.parse(JSON.stringify(scheduler));
      expect(
        resumeTriggerPrompt(
          scheduler,
          game,
          { ...rules, version: "wrong" },
          "c",
          { id: prompt.id, choice },
        ),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: prompt.id,
          choice,
        }),
      ).toBe(true);
      expect(scheduler.operationCompletion?.value).toBe(true);
      expect(game.races).toHaveLength(1);
      expect(game.revealed).toHaveLength(1);
      expect(game.after).toHaveLength(1);
      expect(game.cardResources!.roomTags.NullifyingTimes).toBe(1);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.events.map((e) => e.name)).toEqual([
        "TrickCardCanceling",
        ...(boundary === "heg-choice" ? ["ChoiceMade"] : []),
        "PreCardUsed",
        "CardUsed",
        "ChoiceMade",
        "CardFinished",
      ]);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: prompt.id,
          choice,
        }),
      ).toBe(false);
    },
  );
  it("reloads a nested counter race without replaying the outer response and preserves original AI context", () => {
    let game = fixture();
    game.cancelable = true;
    game.replies = [response(), response("counter", [2])];
    const rules = registry();
    const saved = rules.operations!.find((handler) => handler.name === "race")!;
    operation(rules, "race", (context) => {
      const request = context.operation.data as { ask: { positive: boolean } };
      if (!request.ask.positive && context.continuation === null)
        return {
          kind: "prompt",
          actor: "c",
          choices: ["continue"],
          canCancel: false,
          continuation: true,
        };
      return saved.run({ ...context, continuation: null });
    });
    let scheduler = dispatch(game, rules);
    const prompt = getTriggerPrompt(scheduler, "c")!;
    expect(game.cardZones.table.cards).toEqual([1]);
    game = JSON.parse(JSON.stringify(game));
    scheduler = JSON.parse(JSON.stringify(scheduler));
    resumeTriggerPrompt(scheduler, game, rules, "c", {
      id: prompt.id,
      choice: "continue",
    });
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(game.races).toHaveLength(3);
    expect(game.validated).toHaveLength(2);
    expect(game.races[1]).toMatchObject({
      ask: {
        effect: { from: "c", to: "b" },
        reference: "reply",
        positive: false,
        origin: { reference: "trick", effect: { from: "a", to: "b" } },
      },
    });
    expect(game.cardResources!.roomTags.NullifyingTimes).toBe(2);
    expect(game.cardZones.discard.cards).toEqual([1, 2]);
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes eager tags/materials without fabricated finish for %s",
    (reason) => {
      const game = fixture();
      game.replies.push(response());
      const rules = registry();
      operation(rules, "reveal", () => ({ kind: "interrupt", reason }));
      const scheduler = dispatch(game, rules);
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.cardZones.table.cards).toEqual([1]);
      expect(game.cardZones.discard.cards).toEqual([]);
      expect(game.cardResources!.roomTags.NullificatonType).toBe(false);
      expect(game.cardResources!.roomTags.NullifyingTimes).toBe(0);
      expect(game.events.map((e) => e.name)).toEqual([
        "TrickCardCanceling",
        "PreCardUsed",
      ]);
      expect(game.after).toEqual([]);
    },
  );
  it.each([
    "effect",
    "polarity",
    "reference",
    "origin",
    "list",
    "alive",
    "zone",
  ])(
    "rejects malformed %s during preflight without allocating a frame",
    (invalid) => {
      const game = fixture();
      const data: Record<string, TriggerData> = {
        effect: effect(),
        reference: "trick",
        positive: true,
      };
      if (invalid === "effect") data.effect = null;
      if (invalid === "polarity") data.positive = "true";
      if (invalid === "reference") data.reference = "unknown";
      if (invalid === "origin")
        data.origin = { effect: effect(), reference: "unknown" };
      if (invalid === "list") {
        const resource = game.cardResources!.cards.trick;
        if (resource.kind === "virtual")
          resource.tags.CardUseDisresponsiveList = null;
      }
      if (invalid === "alive") Object.assign(game.alive, { c: null });
      if (invalid === "zone") game.cardZones.table.owner = "c";
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = JSON.stringify(game);
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "ask-nullification", data },
          "a",
        ),
      ).toThrow();
      expect(scheduler.frames).toEqual([]);
      expect(JSON.stringify(game)).toBe(before);
    },
  );
  it.each([
    "availability",
    "online",
    "heg-kind",
    "identity",
    "winner",
    "parsed",
    "validated",
    "pre",
    "used-list",
    "count",
    "cancelability",
  ])(
    "rejects malformed %s at its boundary and keeps completed eager effects",
    (invalid) => {
      const game = invalid === "identity" ? hegGame() : fixture();
      if (invalid !== "identity") game.replies.push(response());
      const rules = registry({
        ...(invalid === "availability"
          ? { hasNullification: () => null as unknown as boolean }
          : {}),
        ...(invalid === "online"
          ? { isOnline: () => null as unknown as boolean }
          : {}),
        ...(invalid === "heg-kind"
          ? { isHegNullification: () => null as unknown as boolean }
          : {}),
        ...(invalid === "cancelability"
          ? { isCancelable: () => null as unknown as boolean }
          : {}),
      });
      if (invalid === "identity")
        Object.assign(game.identities.b, { shown: "yes" });
      if (invalid === "winner")
        game.replies = [
          { player: "a", response: { reference: "reply", card: card() } },
        ];
      if (invalid === "parsed")
        game.replies = [
          { player: "c", response: { reference: "reply", card: null } },
        ];
      if (invalid === "validated")
        operation(rules, "validate", () => ({ kind: "return", value: true }));
      if (invalid === "pre")
        rule(rules, "PreCardUsed", ({ event }) => {
          event.data = null;
          return { kind: "done", value: false };
        });
      if (invalid === "used-list")
        rule(rules, "CardUsed", ({ event }) => {
          Object.assign(event.data!, { nullified: null });
          return { kind: "done", value: false };
        });
      if (invalid === "count")
        game.cardResources!.roomTags.NullifyingTimes = null;
      expect(() => dispatch(game, rules)).toThrow();
      expect(game.after).toEqual([]);
      expect(game.currentCardUseReason).toBe("response-use");
      if (["used-list", "count", "cancelability"].includes(invalid)) {
        expect(game.cardZones.table.cards).toEqual([1]);
        expect(game.cardResources!.roomTags.NullificatonType).toBe(false);
      } else expect(game.cardZones.hand.cards).toEqual([1, 2]);
    },
  );
  it("snapshots living order/disresponsive lists but shares cancellation data and reads current online state", () => {
    const game = fixture();
    game.available = ["a", "b", "c", "d"];
    game.online = ["a", "c"];
    game.alive.d = false;
    const rules = registry();
    rule(rules, "TrickCardCanceling", ({ game, event }) => {
      if (event.target === "a") {
        game.alive.c = false;
        game.online = ["c"];
        const resource = game.cardResources!.cards.trick;
        if (resource.kind === "virtual")
          resource.tags.CardUseDisresponsiveList = ["_ALL_PLAYERS"];
        event.data = { rewritten: true };
      }
      return { kind: "done", value: event.target === "b" };
    });
    const scheduler = dispatch(game, rules);
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(game.currentCardUseReason).toBe("response-use");
    expect(game.events.map((e) => [e.name, e.target])).toEqual([
      ["TrickCardCanceling", "a"],
      ["TrickCardCanceling", "b"],
      ["TrickCardCanceling", "c"],
    ]);
    expect(game.events[0].data).toMatchObject({
      multiple: false,
      nullified: false,
      disresponsive: false,
    });
    expect(game.events[1].data).toEqual({ rewritten: true });
    expect(game.events[2].data).toEqual({ rewritten: true });
    expect(game.races).toMatchObject([{ humans: ["c"], ais: ["a"] }]);
  });
  it.each([{ blocked: ["b"] }, { blocked: ["_ALL_PLAYERS"] }])(
    "filters disresponsive players before cancellation events: %j",
    ({ blocked }) => {
      const game = fixture();
      game.available = ["b", "c"];
      game.online = ["b"];
      const resource = game.cardResources!.cards.trick;
      if (resource.kind === "virtual")
        resource.tags.CardUseDisresponsiveList = blocked;
      dispatch(game);
      expect(game.events.map((e) => e.target)).toEqual(
        blocked[0] === "b" ? ["c"] : [],
      );
      expect(game.races).toMatchObject([
        { humans: [], ais: blocked[0] === "b" ? ["c"] : [] },
      ]);
    },
  );
  it("retries failed response validation without moving the rejected card and recollects eligibility", () => {
    const game = fixture();
    game.reject = 1;
    game.replies = [response("reply", [1]), response("counter", [2])];
    const scheduler = dispatch(game);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.races).toHaveLength(2);
    expect(game.validated).toHaveLength(2);
    expect(game.cardZones.hand.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
    expect(game.after).toMatchObject([{ original: { reference: "counter" } }]);
    expect(game.cardResources!.roomTags.NullifyingTimes).toBe(1);
  });
  it("keeps the parsed original for validateAfter when validateInResponse converts its card", () => {
    const game = fixture();
    game.replies.push(response("reply", [1]));
    const rules = registry();
    operation(rules, "validate", () => ({
      kind: "return",
      value: { reference: "counter", card: card("nullification", [2]) },
    }));
    const scheduler = dispatch(game, rules);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.cardZones.hand.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
    expect(game.revealed).toMatchObject([
      { response: { reference: "counter", card: { materialIDs: [2] } } },
    ]);
    expect(game.after).toMatchObject([
      {
        original: { reference: "reply", card: { materialIDs: [1] } },
        use: { card: { materialIDs: [2] } },
      },
    ]);
  });
  it.each(["consume", "all", "one"])(
    "honors CardUsed cancellation without skipping count/finish: %s",
    (mode) => {
      const game = fixture();
      game.cancelable = true;
      game.replies.push(response());
      const rules = registry();
      rule(rules, "CardUsed", ({ event }) => {
        if (mode === "consume") {
          event.data = null;
          return { kind: "done", value: true };
        }
        (event.data as CardUse & { nullified: string[] }).nullified = [
          mode === "all" ? "_ALL_TARGETS" : "b",
        ];
        return { kind: "done", value: false };
      });
      const scheduler = dispatch(game, rules);
      expect(scheduler.operationCompletion?.value).toBe(mode === "one");
      expect(game.races).toHaveLength(mode === "one" ? 2 : 1);
      expect(game.cardResources!.roomTags.NullifyingTimes).toBe(1);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.after).toHaveLength(1);
    },
  );
  it("keeps original reply/responder/materials through consumed Pre and rewritten use/finish data", () => {
    const game = fixture();
    game.replies.push(response());
    const rules = registry();
    rule(rules, "PreCardUsed", ({ event }) => {
      event.data = {
        from: "d",
        to: ["a"],
        card: card("changed", [2]),
        isHandcard: false,
      };
      return { kind: "done", value: true };
    });
    rule(rules, "CardFinished", ({ event }) => {
      event.data = null;
      return { kind: "done", value: true };
    });
    dispatch(game, rules);
    expect(game.revealed).toMatchObject([
      {
        player: "c",
        response: { card: { materialIDs: [1], name: "nullification" } },
      },
    ]);
    expect(game.cardZones.hand.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(
      game.events
        .filter((e) => e.name === "CardUsed" || e.name === "CardFinished")
        .map((e) => e.target),
    ).toEqual(["c", "c"]);
    expect(game.after).toMatchObject([
      {
        player: "c",
        use: {
          from: "d",
          to: ["a"],
          card: { name: "changed", materialIDs: [2] },
        },
      },
    ]);
  });
  it("does not require an already-Nullification parsed card or ordinary play availability", () => {
    const game = fixture();
    game.replies.push({
      player: "c",
      response: { reference: "reply", card: card("converted_by_package", []) },
    });
    const scheduler = dispatch(game);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.after).toMatchObject([{ use: { isHandcard: false } }]);
  });
  it.each(["own-hand", "other-hand", "mixed", "none"])(
    "sets isHandcard from current original material zones: %s",
    (mode) => {
      const game = fixture();
      if (mode === "other-hand") game.cardZones.hand.owner = "d";
      if (mode === "mixed") {
        game.cardZones.hand.cards = [1];
        game.cardZones.other = {
          owner: "c",
          place: "special",
          cards: [2],
          pileName: "private",
        };
      }
      game.replies.push(response("reply", mode === "none" ? [] : [1, 2]));
      dispatch(game);
      expect(game.after).toMatchObject([
        { use: { isHandcard: mode === "own-hand" } },
      ]);
      expect(game.cardZones.discard.cards).toEqual(
        mode === "none" ? [] : [2, 1],
      );
    },
  );
  it("discards only materials still on table after an actual nested obtain movement", () => {
    const game = fixture();
    game.replies.push(response("reply", [1, 2]));
    game.cardZones.obtained = { owner: "a", place: "hand", cards: [] };
    const rules = registry();
    rule(rules, "CardFinished", ({ operationChild }) =>
      operationChild
        ? { kind: "done", value: false }
        : {
            kind: "operation",
            operation: {
              name: "move-cards",
              data: {
                moves: [
                  { ids: [1], to: "obtained", reason: { kind: "obtain" } },
                ],
                forceVisible: true,
              },
            },
            continuation: null,
          },
    );
    dispatch(game, rules);
    expect(game.cardZones.obtained.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
  });
  it.each([
    { targets: ["d", "b"], offered: false },
    { targets: ["b", "d"], offered: true },
    { targets: ["d"], offered: true },
    { targets: ["b", "b"], offered: true },
    { targets: ["d", "d", "b"], offered: false },
    { targets: [], offered: false },
  ])(
    "preserves native removeOne/indexOf target semantics: %j",
    ({ targets, offered }) => {
      const game = hegGame(targets);
      const scheduler = dispatch(game);
      expect(getTriggerPrompt(scheduler, "c") !== null).toBe(offered);
      if (!offered) expect(scheduler.operationCompletion?.value).toBe(true);
    },
  );
  it.each([
    "recipient-careerist",
    "recipient-hidden",
    "later-careerist",
    "later-hidden",
    "different-kingdom",
    "delayed",
    "nullification",
    "later-dead",
  ])("uses current identity/ancestry for all eligibility: %s", (mode) => {
    const game = hegGame();
    if (mode === "recipient-careerist") game.identities.b.careerist = true;
    if (mode === "recipient-hidden") game.identities.b.shown = false;
    if (mode === "later-careerist") game.identities.d.careerist = true;
    if (mode === "later-hidden") game.identities.d.shown = false;
    if (mode === "different-kingdom") game.identities.d.kingdom = "shu";
    if (mode === "delayed") game.cardResources!.cards.trick.isNDTrick = false;
    if (mode === "later-dead") game.alive.d = false;
    const rules = registry({ isNullification: () => mode === "nullification" });
    const scheduler = dispatch(game, rules);
    expect(getTriggerPrompt(scheduler, "c") !== null).toBe(
      mode === "later-dead",
    );
  });
  it.each(["single", "all"])(
    "preserves nested validity and shared-tag deletion for selection %s",
    (choice) => {
      const game = hegGame();
      const rules = registry();
      rule(rules, "ChoiceMade", ({ game }) => {
        game.cardResources!.roomTags.HegNullificationValid = true;
        game.cardResources!.roomTags.NullificatonType = "nested";
        return { kind: "done", value: false };
      });
      const scheduler = dispatch(game, rules);
      const prompt = getTriggerPrompt(scheduler, "c")!;
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "c", {
          id: prompt.id,
          choice,
        }),
      ).toBe(true);
      expect(game.cardResources!.roomTags.HegNullificationValid).toBe(true);
      expect(game.cardResources!.roomTags.NullificatonType).toBeUndefined();
    },
  );
  it("does not mark a failed all choice valid after a counter succeeds", () => {
    const game = hegGame();
    game.cancelable = true;
    game.replies.push(response("counter", [2]));
    const rules = registry();
    const scheduler = dispatch(game, rules);
    const prompt = getTriggerPrompt(scheduler, "c")!;
    resumeTriggerPrompt(scheduler, game, rules, "c", {
      id: prompt.id,
      choice: "all",
    });
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(game.cardResources!.roomTags.HegNullificationValid).toBeUndefined();
    expect(game.cardResources!.roomTags.NullifyingTimes).toBe(2);
  });
  it.each([1, 2, 3])(
    "negates %i accepted responses and finishes inner cards before outer cards",
    (count) => {
      const game = fixture();
      game.cancelable = true;
      game.cardZones.hand.cards.push(3);
      for (let index = 0; index < count; index++)
        game.replies.push(
          response(index === 0 ? "reply" : "counter", [index + 1]),
        );
      const scheduler = dispatch(game);
      expect(scheduler.operationCompletion?.value).toBe(count % 2 === 1);
      expect(game.races).toHaveLength(count + 1);
      expect(game.races).toMatchObject(
        Array.from({ length: count + 1 }, (_, index) => ({
          ask: {
            positive: index % 2 === 0,
            effect: { to: "b" },
            origin: {
              reference: "trick",
              effect: { from: "a", to: "b", card: { name: "duel" } },
            },
          },
        })),
      );
      expect(
        game.events
          .filter((e) => e.name === "CardFinished")
          .map((e) => (e.data as CardUse).card.materialIDs),
      ).toEqual(Array.from({ length: count }, (_, index) => [count - index]));
      expect(game.cardResources!.roomTags.NullifyingTimes).toBe(count);
      expect(game.cardZones.discard.cards).toEqual(
        Array.from({ length: count }, (_, index) => index + 1),
      );
    },
  );

  it("offers all for a later revealed faction target and sets validity only after successful completion", () => {
    const game = fixture();
    game.cardResources!.cards.heg = structuredClone(
      game.cardResources!.cards.reply,
    );
    game.cardResources!.roomTags["targetsduel-key"] = ["b", "d"];
    game.replies.push(response("heg"));
    const rules = registry();
    const scheduler = dispatch(game, rules);
    const prompt = getTriggerPrompt(scheduler, "c")!;
    expect(prompt.choices.map((c) => c.id)).toEqual(["single", "all"]);
    expect(game.cardZones.hand.cards).toEqual([1, 2]);
    expect(game.cardResources!.roomTags.HegNullificationValid).toBeUndefined();
    resumeTriggerPrompt(scheduler, game, rules, "c", {
      id: prompt.id,
      choice: "all",
    });
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.cardResources!.roomTags.HegNullificationValid).toBe(true);
    expect(game.cardResources!.roomTags.NullificatonType).toBeUndefined();
  });
  it("uses a validated response, counts the decision and finishes/discards its original materials", () => {
    const game = fixture();
    game.replies.push(response());
    const scheduler = dispatch(game);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.events.map((e) => e.name)).toEqual([
      "TrickCardCanceling",
      "PreCardUsed",
      "CardUsed",
      "ChoiceMade",
      "CardFinished",
    ]);
    expect(game.events.find((e) => e.name === "ChoiceMade")?.data).toBe(
      "Nullification:Duel:b:true",
    );
    expect(game.cardResources!.roomTags).toEqual({ NullifyingTimes: 1 });
    expect(game.cardZones.hand.cards).toEqual([2]);
    expect(game.cardZones.table.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.after).toMatchObject([
      {
        player: "c",
        original: { reference: "reply" },
        use: { from: "c", to: [], isHandcard: true },
      },
    ]);
  });
  it("returns false when the race has no response after collecting the eligible roster", () => {
    const game = fixture();
    const scheduler = dispatch(game);
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(game.events.map((e) => [e.name, e.target])).toEqual([
      ["TrickCardCanceling", "c"],
    ]);
    expect(game.races).toMatchObject([{ humans: ["c"], ais: [] }]);
    expect(game.cardZones.hand.cards).toEqual([1, 2]);
  });
});
