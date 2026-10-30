import { describe, expect, it } from "vitest";
import {
  createAskCardUseOperation,
  createAskCardResponseOperation,
  createAskCardNoneOperation,
  createAskCardDiscardOperation,
  provideCard,
  type AskCardUseGame,
  type AskCardUseRules,
  type AskCardUseRequest,
} from "../../src/game/hegemony/ask-card-use";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import {
  createCardFinishedRule,
  readCardReference,
} from "../../src/game/hegemony/card-resources";
import {
  createJinkEffectOperation,
  createSlashResultOperation,
  type SlashCard,
} from "../../src/game/hegemony/slash";
import { createSlashProceedOperation } from "../../src/game/hegemony/slash-response";

type Game = AskCardUseGame & {
  catalog: Record<string, SlashCard>;
  trace: TriggerData[];
  requests: TriggerData[];
  reply: SlashCard | null;
  validations: (SlashCard | null)[];
  ai: boolean;
  denied: boolean;
  playerHistory: Record<string, Record<string, number>>;
  playerMarks: Record<string, Record<string, number>>;
};
const card = (reference = "Jink", materialIDs = [1]): SlashCard => ({
  reference,
  card: {
    type: "basic",
    name: reference.toLowerCase(),
    className: reference,
    skillName: "",
    materialIDs,
    flags: [],
  },
});
const request = (): AskCardUseRequest => ({
  actor: "b",
  pattern: "jink",
  prompt: "slash-jink:a",
  data: { source: "a" },
  to: "a",
  skillName: "fixture-skill",
  isProvision: true,
});
function setup(
  overrides: Partial<AskCardUseRules<Game>> = {},
  method: "use" | "response" | "none" | "discard" = "use",
) {
  const game: Game = {
    seatOrder: ["a", "b"],
    alive: { a: true, b: true },
    playerFlags: { a: [], b: [] },
    playerHistory: { a: {}, b: {} },
    playerMarks: { a: {}, b: {} },
    cardZones: {
      hand: { owner: "b", place: "hand", cards: [1, 2] },
      table: { owner: null, place: "table", cards: [] },
      discard: { owner: null, place: "discard", cards: [] },
    },
    cardResources: {
      cards: Object.fromEntries(
        ["Jink", "Raw", "Other"].map((reference) => [
          reference,
          {
            kind: "virtual" as const,
            key: reference,
            isSlash: false,
            isNDTrick: false,
            flags: [],
            tags: {},
          },
        ]),
      ),
      playerTags: { a: {}, b: {} },
      roomTags: {},
    },
    catalog: { Jink: card(), Raw: card("Raw"), Other: card("Other", [2]) },
    trace: [],
    requests: [],
    reply: card(),
    validations: [],
    ai: false,
    denied: false,
  };
  const policy: AskCardUseRules<Game> = {
    tableZone: "table",
    discardZone: "discard",
    isAI: (game) => game.ai,
    request: (data) => ({ name: "reply-fixture", data }),
    limited: (game) => game.denied,
    validateResponse: (actor, response) => ({
      name: "validate-fixture",
      data: { actor, response },
    }),
    resolve: (game, response) => game.catalog[response.reference],
    notify: (notice) => ({ name: "notice-fixture", data: notice }),
    reveal: (actor, response) => ({
      name: "reveal-fixture",
      data: { actor, response },
    }),
    moveReason: (_game, actor, response) => ({
      kind: method,
      actor,
      skill: response.card.skillName,
    }),
    validateAfter: (actor, original, use) => ({
      name: "after-fixture",
      data: { actor, original, use },
    }),
    ...overrides,
  };
  const resources = {
    reference: (use: { card: { className: string } }) => use.card.className,
  };
  const rules: TriggerRegistry<Game> = {
    version: "ask-card-use-ce4e62b",
    skills: [
      createCardUsedRule(),
      createCardFinishedRule(resources),
      {
        id: "observe",
        rule: true,
        priority: 20,
        events: [
          "CardAsked",
          "ChoiceMade",
          "PreCardUsed",
          "CardUsed",
          "CardFinished",
          "CardResponded",
          "TargetSelected",
        ],
        effect: ({ game, event }) => {
          game.trace.push({
            event: event.name,
            data: structuredClone(event.data),
          });
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      method === "use"
        ? createAskCardUseOperation(policy)
        : method === "none"
          ? createAskCardNoneOperation(policy)
          : method === "discard"
            ? createAskCardDiscardOperation(policy)
            : createAskCardResponseOperation({
                ...policy,
                validateInResponseAfter: (actor, original) => ({
                  name: "response-after-fixture",
                  data: { actor, original },
                }),
              }),
      createCardMovementOperation(),
      createCardUsedOperation({
        resources,
        use: (use) => ({ name: "use-fixture", data: use }),
      }),
      {
        name: "reply-fixture",
        run: ({ game, operation }) => {
          game.requests.push(operation.data);
          return { kind: "return", value: game.reply };
        },
      },
      {
        name: "validate-fixture",
        run: ({ game, operation }) => {
          game.trace.push("validate");
          const input = operation.data as { response: SlashCard };
          return {
            kind: "return",
            value: game.validations.length
              ? game.validations.shift()!
              : input.response,
          };
        },
      },
      ...[
        "notice-fixture",
        "reveal-fixture",
        "after-fixture",
        "use-fixture",
        "response-after-fixture",
      ].map((name) => ({
        name,
        run: ({
          game,
          operation,
        }: {
          game: Game;
          operation: { data: TriggerData };
        }) => {
          game.trace.push({ operation: name, data: operation.data });
          return { kind: "return" as const, value: null };
        },
      })),
    ],
  };
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  return { game, rules, scheduler, policy };
}
const events = (game: Game) =>
  game.trace
    .filter(
      (item): item is Record<string, TriggerData> =>
        !!item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        "event" in item,
    )
    .map((item) => item.event);
describe("selection-only and discard requests", () => {
  it.each(["none", "discard"] as const)(
    "consumes null/dead acquisition for %s without CardAsked or request",
    (method) => {
      for (const provision of [true, false]) {
        const { game, rules, scheduler } = setup({}, method);
        game.playerFlags.b = ["continuing"];
        if (provision) provideCard(game, null);
        else game.alive.b = false;
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: `ask-card-${method}`, data: request() },
          "a",
        );
        expect(game.requests).toEqual([]);
        expect(game.providedCard).toBeUndefined();
        expect(game.playerFlags.b).toEqual([]);
        expect(events(game)).toEqual(["ChoiceMade"]);
        expect(scheduler.operationCompletion?.value).toBeNull();
      }
    },
  );
  it.each(["use", "response", "none", "discard"] as const)(
    "retains retrial acquisition but suppresses ordinary %s execution",
    (method) => {
      const { game, rules, scheduler } = setup({}, method);
      game.validations = [null, card()];
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: `ask-card-${method}`, data: { ...request(), isRetrial: true } },
        "a",
      );
      expect(events(game)).toEqual(["ChoiceMade"]);
      expect(game.requests).toEqual([
        { ...request(), isRetrial: true, ai: false },
        {
          ...request(),
          skillName: "",
          isProvision: false,
          isRetrial: true,
          ai: false,
        },
      ]);
      expect(game.cardZones.table.cards).toEqual([]);
      expect(game.cardZones.discard.cards).toEqual(
        method === "discard" ? [1] : [],
      );
      expect(game.trace).toContainEqual({
        operation: "notice-fixture",
        data: {
          kind: "accepted",
          actor: "b",
          card: card(),
          context: { method, skillName: "", isRetrial: true },
        },
      });
      expect(scheduler.operationCompletion?.value).toEqual(card());
      expect(
        game.trace.filter(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item) &&
            [
              "reveal-fixture",
              "after-fixture",
              "response-after-fixture",
            ].includes(String(item.operation)),
        ),
      ).toHaveLength(0);
    },
  );
  it.each(["AI", "provided"])(
    "bypasses limitations for None %s while Discard still applies them",
    (source) => {
      for (const method of ["none", "discard"] as const) {
        const { game, rules, scheduler } = setup({}, method);
        game.denied = true;
        game.ai = source === "AI";
        if (source === "provided") provideCard(game, card());
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: `ask-card-${method}`, data: request() },
          "a",
        );
        expect(scheduler.operationCompletion?.value).toEqual(
          method === "none" ? card() : null,
        );
        expect(events(game)).toEqual(["ChoiceMade"]);
      }
    },
  );
  it.each(["none", "discard"] as const)(
    "supports %s without unrelated use/response dependencies",
    (method) => {
      const { game, rules, scheduler, policy } = setup({}, method);
      const common = {
        isAI: policy.isAI,
        request: policy.request,
        validateResponse: policy.validateResponse,
        resolve: policy.resolve,
        notify: policy.notify,
      };
      rules.operations![0] =
        method === "none"
          ? createAskCardNoneOperation(common)
          : createAskCardDiscardOperation({
              ...common,
              discardZone: "discard",
              limited: policy.limited,
            });
      if (method === "none") {
        delete game.cardZones.table;
        delete game.cardZones.discard;
      }
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: `ask-card-${method}`, data: request() },
        "a",
      );
      expect(scheduler.operationCompletion?.value).toEqual(card());
    },
  );
  it("uses post-choice discard materials with THROW, independently of request/card skill names", () => {
    const { game, rules, scheduler } = setup({}, "discard");
    game.catalog.Jink.card.skillName = "card-skill";
    const moves: TriggerData[] = [];
    rules.skills.push({
      id: "discard-observer",
      rule: true,
      priority: 10,
      events: ["ChoiceMade", "BeforeCardsMove"],
      effect: ({ game, event }) => {
        if (event.name === "ChoiceMade")
          game.catalog.Jink.card.materialIDs = [2];
        else if (event.target === "a") moves.push(structuredClone(event.data));
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-discard", data: request() },
      "a",
    );
    expect(moves).toEqual([
      {
        moves: [
          expect.objectContaining({
            ids: [2],
            to: "discard",
            reason: { kind: "throw", actor: "b" },
          }),
        ],
      },
    ]);
    expect(game.cardZones.hand.cards).toEqual([1]);
    expect(game.trace).toContainEqual({
      operation: "notice-fixture",
      data: {
        kind: "accepted",
        actor: "b",
        card: { ...card(), card: { ...card().card, skillName: "card-skill" } },
        context: {
          method: "discard",
          skillName: "fixture-skill",
          isRetrial: false,
        },
      },
    });
  });
  it.each(["none", "discard"] as const)(
    "accepts zero-material %s without movement or hooks",
    (method) => {
      const { game, rules, scheduler } = setup({}, method);
      game.reply = game.catalog.Jink = card("Jink", []);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: `ask-card-${method}`,
          data: { ...request(), pattern: "slash" },
        },
        "a",
      );
      expect(game.cardZones.hand.cards).toEqual([1, 2]);
      expect(scheduler.operationCompletion?.value).toEqual(card("Jink", []));
      expect(events(game)).toEqual(["ChoiceMade"]);
    },
  );
  it.each(["ChoiceMade", "BeforeCardsMove", "CardsMoveOneTime"])(
    "restores direct discard at %s without repeating payment",
    (pause) => {
      const state = setup({}, "discard");
      const { rules } = state;
      let { game, scheduler } = state;
      rules.skills.push({
        id: "pause-discard",
        rule: true,
        priority: 50,
        events: [pause],
        effect: ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "b",
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
        { name: "ask-card-discard", data: request() },
        "a",
      );
      let pauses = 0;
      while (scheduler.prompt) {
        expect(++pauses).toBeLessThan(4);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        const view = getTriggerPrompt(scheduler, "b")!;
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: view.id,
            choice: "go",
          }),
        ).toBe(true);
      }
      expect(pauses).toBeGreaterThan(0);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(game.requests).toHaveLength(1);
      expect(game.trace.filter((item) => item === "validate")).toHaveLength(1);
    },
  );
  it.each(["none", "discard"] as const)(
    "owns the distinct %s selection lifecycle",
    (method) => {
      const { game, rules, scheduler } = setup({}, method);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: `ask-card-${method}`, data: request() },
        "a",
      );
      expect(events(game)).toEqual(["ChoiceMade"]);
      expect(game.currentCardUseReason).toBe("unknown");
      expect(game.cardZones.table.cards).toEqual([]);
      expect(game.cardZones.discard.cards).toEqual(
        method === "discard" ? [1] : [],
      );
      expect(scheduler.operationCompletion?.value).toEqual(card());
      expect(
        game.trace.filter(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item) &&
            [
              "reveal-fixture",
              "after-fixture",
              "response-after-fixture",
            ].includes(String(item.operation)),
        ),
      ).toHaveLength(0);
    },
  );
});
describe("direct MethodResponse askForCard", () => {
  it("pays and discards with response actor/skill metadata through real movement events", () => {
    const { game, rules, scheduler } = setup({}, "response");
    game.catalog.Jink.card.skillName = "response-skill";
    const movements: TriggerData[] = [];
    rules.skills.push({
      id: "movement-reason",
      rule: true,
      priority: 20,
      events: ["BeforeCardsMove", "CardsMoveOneTime"],
      effect: ({ event }) => {
        if (event.target === "a")
          movements.push({
            event: event.name,
            data: structuredClone(event.data),
          });
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-response", data: { ...request(), isProvision: false } },
      "a",
    );
    expect(movements).toEqual(
      ["table", "discard"].flatMap((to) =>
        ["BeforeCardsMove", "CardsMoveOneTime"].map((event) => ({
          event,
          data: {
            moves: [
              expect.objectContaining({
                ids: [1],
                to,
                reason: {
                  kind: "response",
                  actor: "b",
                  skill: "response-skill",
                },
              }),
            ],
          },
        })),
      ),
    );
  });
  it("shares one provided slot and room reason with a nested MethodUse ask", () => {
    const { game, rules, scheduler, policy } = setup({}, "response");
    rules.operations!.push(createAskCardUseOperation(policy));
    rules.skills.push({
      id: "nested-use",
      rule: true,
      priority: 30,
      events: ["CardAsked"],
      effect: ({ game, event, continuation }) => {
        if (event.target !== "b" || continuation !== null)
          return { kind: "done", value: false };
        provideCard(game, null);
        return {
          kind: "operation",
          operation: {
            name: "ask-card-use",
            data: { ...request(), actor: "a", to: "b" },
          },
          continuation: true,
        };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-response", data: { ...request(), isProvision: false } },
      "a",
    );
    expect(game.requests).toEqual([
      { ...request(), isProvision: false, ai: false },
    ]);
    expect(game.providedCard).toBeUndefined();
    expect(game.currentCardUseReason).toBe("response-use");
    expect(events(game)).toEqual([
      "CardAsked",
      "ChoiceMade",
      "CardAsked",
      "ChoiceMade",
      "CardResponded",
    ]);
    expect(scheduler.operationCompletion?.value).toEqual(card());
  });
  it.each(["jink", "slash"])(
    "composes a caller-owned %s response request/result contract",
    (pattern) => {
      const { game, rules, scheduler } = setup({}, "response");
      if (pattern === "slash") {
        game.catalog.Raw.card.name = "slash";
        game.catalog.Raw.card.className = "Slash";
        game.reply = structuredClone(game.catalog.Raw);
      }
      rules.operations!.push({
        name: "response-caller-fixture",
        run: ({ continuation, operationChild }) =>
          continuation === null
            ? {
                kind: "operation",
                operation: {
                  name: "ask-card-response",
                  data: {
                    ...request(),
                    pattern,
                    prompt: `${pattern}:a`,
                    isProvision: false,
                  },
                },
                continuation: true,
              }
            : { kind: "return", value: operationChild!.value !== null },
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "response-caller-fixture", data: null },
        "a",
      );
      expect(scheduler.operationCompletion?.value).toBe(true);
      expect(game.requests).toEqual([
        {
          ...request(),
          pattern,
          prompt: `${pattern}:a`,
          isProvision: false,
          ai: false,
        },
      ]);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(events(game)).toEqual([
        "CardAsked",
        "ChoiceMade",
        "CardResponded",
      ]);
    },
  );
  it.each(["use", "none", "discard", "retrial", "actor", "target"])(
    "rejects invalid response request %s before allocating a frame",
    (variant) => {
      const { game, rules, scheduler } = setup({}, "response");
      const data = {
        ...request(),
        ...(variant === "retrial"
          ? { isRetrial: "invalid" }
          : variant === "actor"
            ? { actor: "unknown" }
            : variant === "target"
              ? { to: "unknown" }
              : { method: variant }),
      };
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "ask-card-response", data },
          "a",
        ),
      ).toThrow("Invalid MethodResponse request");
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it.each([
    { initial: [1], place: "hand", owner: "b", expected: true },
    { initial: [], place: "hand", owner: "b", expected: false },
    { initial: [1, 2], place: "equip", owner: "b", expected: false },
    { initial: [1], place: "hand", owner: "a", expected: false },
  ] as const)(
    "captures hand provenance before ChoiceMade: $initial/$place/$owner",
    ({ initial, place, owner, expected }) => {
      const { game, rules, scheduler } = setup({}, "response");
      game.catalog.Jink = card("Jink", [...initial]);
      game.reply = structuredClone(game.catalog.Jink);
      game.cardZones.hand.cards = [2];
      game.cardZones.initial = { place, owner, cards: [1] };
      rules.skills.push({
        id: "change-at-choice",
        rule: true,
        priority: 10,
        events: ["ChoiceMade"],
        effect: ({ game }) => {
          game.catalog.Jink.card.materialIDs = [2];
          return { kind: "done", value: false };
        },
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "ask-card-response",
          data: {
            ...request(),
            isProvision: false,
            to: null,
            data: ["effect", { from: "a" }],
          },
        },
        "a",
      );
      expect(game.trace).toContainEqual({
        event: "CardResponded",
        data: {
          m_card: card("Jink", [2]),
          m_who: null,
          m_isUse: false,
          m_isRetrial: false,
          m_isHandcard: expected,
          m_data: ["effect", { from: "a" }],
        },
      });
      expect(game.cardZones.discard.cards).toEqual([2]);
      expect(game.cardZones.initial.cards).toEqual([1]);
    },
  );
  it("keeps raw conversion, response payload and current-material cleanup identities separate", () => {
    const { game, rules, scheduler } = setup({}, "response");
    const raw = { ...card("Raw", []), metadata: { private: "retained" } };
    raw.card.type = "skill";
    game.reply = raw;
    game.validations = [card()];
    rules.skills.push({
      id: "rewrite-response",
      rule: true,
      priority: 10,
      events: ["CardResponded"],
      effect: ({ game, event }) => {
        event.data = { m_card: card("Other", [2]), m_who: "b" };
        game.catalog.Jink.card.materialIDs = [2];
        game.cardZones.hand.cards = [];
        game.cardZones.table.cards.push(2);
        return { kind: "done", value: true };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-response", data: { ...request(), isProvision: false } },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toEqual(card("Jink", [2]));
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([2]);
    expect(game.trace).toContainEqual({
      operation: "response-after-fixture",
      data: { actor: "b", original: raw },
    });
    expect(events(game)).toEqual(["CardAsked", "ChoiceMade", "CardResponded"]);
  });
  it("does not discard material moved away by a CardResponded child", () => {
    const { game, rules, scheduler } = setup({}, "response");
    rules.skills.push({
      id: "take-response",
      rule: true,
      priority: 10,
      events: ["CardResponded"],
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  moves: [{ ids: [1], to: "hand", reason: { skill: "take" } }],
                },
              },
              continuation: true,
            }
          : { kind: "done", value: false },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-response", data: { ...request(), isProvision: false } },
      "a",
    );
    expect(game.cardZones.hand.cards).toEqual(expect.arrayContaining([1, 2]));
    expect(game.cardZones.discard.cards).toEqual([]);
    expect(game.cardZones.table.cards).toEqual([]);
  });
  it.each([{ ids: [] }, { ids: [1, 2] }])(
    "supports virtual response material set $ids",
    ({ ids }) => {
      const { game, rules, scheduler } = setup(
        { notify: () => null },
        "response",
      );
      game.reply = game.catalog.Jink = card("Jink", ids);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "ask-card-response",
          data: { ...request(), pattern: "slash", isProvision: false },
        },
        "a",
      );
      expect(scheduler.operationCompletion?.value).toEqual(card("Jink", ids));
      expect(game.cardZones.discard.cards).toEqual(expect.arrayContaining(ids));
      expect(game.cardZones.discard.cards).toHaveLength(ids.length);
      expect(game.playerHistory.b).toEqual({});
    },
  );
  it.each([true, false])(
    "preserves physical wrapped state with modified=%s",
    (modified) => {
      const { game, rules, scheduler } = setup({}, "response");
      game.cardResources!.cards.Jink = {
        kind: "wrapped",
        id: 1,
        key: "1",
        isSlash: false,
        isNDTrick: false,
      };
      const face = {
        name: "jink",
        className: "Jink",
        skillName: "",
        suit: "heart" as const,
        number: 7,
        modified,
        flags: ["temporary"],
        tags: { private: "kept" },
      };
      game.wrappedCards = { 1: structuredClone(face) };
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "ask-card-response",
          data: { ...request(), isProvision: false },
        },
        "a",
      );
      expect(game.wrappedCards[1]).toEqual(face);
      expect(game.trace).toContainEqual({
        event: "ChoiceMade",
        data: "cardResponded:jink:slash-jink:a:_1_",
      });
      expect(game.cardZones.discard.cards).toEqual([1]);
    },
  );
  it("retries conversion without another CardAsked and resets provision to false", () => {
    const { game, rules, scheduler } = setup({}, "response");
    game.validations = [null, card()];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-response", data: request() },
      "a",
    );
    expect(game.requests).toEqual([
      { ...request(), ai: false },
      { ...request(), skillName: "", isProvision: false, ai: false },
    ]);
    expect(events(game)).toEqual(["CardAsked", "ChoiceMade", "CardResponded"]);
    expect(game.trace.filter((item) => item === "validate")).toHaveLength(2);
    expect(game.playerFlags.b).not.toContain("continuing");
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it.each(["human", "AI", "provided"])(
    "checks pre-conversion limitation for %s",
    (source) => {
      const { game, rules, scheduler } = setup({}, "response");
      game.denied = true;
      game.ai = source === "AI";
      if (source === "provided") provideCard(game, card());
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "ask-card-response",
          data: { ...request(), isProvision: false },
        },
        "a",
      );
      expect(scheduler.operationCompletion?.value).toEqual(
        source === "human" ? card() : null,
      );
      expect(game.cardZones.discard.cards).toEqual(
        source === "human" ? [1] : [],
      );
    },
  );
  it.each(["card", "null", "dead-card", "dead-empty"])(
    "consumes shared provision before requesting: %s",
    (variant) => {
      const { game, rules, scheduler } = setup(
        {
          limited: (_game, _actor, selected) => {
            expect(selected).not.toBeNull();
            return false;
          },
        },
        "response",
      );
      rules.skills.push({
        id: "provider",
        rule: true,
        priority: 30,
        events: ["CardAsked"],
        effect: ({ game }) => {
          if (variant !== "dead-empty")
            provideCard(game, variant === "null" ? null : card());
          if (variant.startsWith("dead")) game.alive.b = false;
          return { kind: "done", value: true };
        },
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "ask-card-response", data: request() },
        "a",
      );
      expect(game.requests).toEqual([]);
      expect(game.providedCard).toBeUndefined();
      expect(scheduler.operationCompletion?.value).toEqual(
        variant === "null" || variant === "dead-empty" ? null : card(),
      );
    },
  );
  it.each([
    "reply-fixture",
    "validate-fixture",
    "notice-fixture",
    "reveal-fixture",
    "response-after-fixture",
  ])("restores a JSON pause in %s exactly once", (name) => {
    const state = setup({}, "response");
    const { rules } = state;
    let { game, scheduler } = state;
    const original = rules.operations!.find((op) => op.name === name)!;
    rules.operations = rules.operations!.map((op) =>
      op.name !== name
        ? op
        : {
            ...op,
            run: (context) =>
              context.continuation === null
                ? {
                    kind: "prompt",
                    actor: "b",
                    choices: ["go"],
                    canCancel: false,
                    continuation: true,
                  }
                : original.run({ ...context, continuation: null }),
          },
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-response", data: { ...request(), isProvision: false } },
      "a",
    );
    let pauses = 0;
    while (scheduler.prompt) {
      expect(++pauses).toBeLessThan(5);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      const view = getTriggerPrompt(scheduler, "b")!;
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          id: view.id,
          choice: "go",
        }),
      ).toBe(true);
    }
    expect(pauses).toBeGreaterThan(0);
    expect(scheduler.operationCompletion?.value).toEqual(card());
    expect(game.requests).toHaveLength(1);
    expect(game.trace.filter((item) => item === "validate")).toHaveLength(1);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it.each([
    "CardAsked",
    "ChoiceMade",
    "CardResponded",
    "BeforeCardsMove",
    "CardsMoveOneTime",
  ])(
    "resumes JSON event %s without duplicate effects or accepting stale replies",
    (pause) => {
      const state = setup({}, "response");
      const { rules } = state;
      let { game, scheduler } = state;
      rules.skills.push({
        id: "pause",
        rule: true,
        priority: 50,
        events: [pause],
        effect: ({ continuation }) =>
          continuation === null
            ? {
                kind: "prompt",
                actor: "b",
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
        {
          name: "ask-card-response",
          data: { ...request(), isProvision: false },
        },
        "a",
      );
      let pauses = 0;
      while (scheduler.prompt) {
        expect(++pauses).toBeLessThan(6);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        const view = getTriggerPrompt(scheduler, "b")!;
        const reply = { id: view.id, choice: "go" };
        const before = structuredClone({ game, scheduler });
        expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
          false,
        );
        expect(
          resumeTriggerPrompt(
            scheduler,
            game,
            { ...rules, version: "wrong" },
            "b",
            reply,
          ),
        ).toBe(false);
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            ...reply,
            id: "stale",
          }),
        ).toBe(false);
        expect({ game, scheduler }).toEqual(before);
        expect(resumeTriggerPrompt(scheduler, game, rules, "b", reply)).toBe(
          true,
        );
        expect(resumeTriggerPrompt(scheduler, game, rules, "b", reply)).toBe(
          false,
        );
      }
      expect(pauses).toBeGreaterThan(0);
      expect(game.requests).toHaveLength(1);
      expect(game.trace.filter((item) => item === "validate")).toHaveLength(1);
      expect(game.cardZones.discard.cards).toEqual([1]);
      expect(
        game.trace.filter(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item) &&
            item.operation === "response-after-fixture",
        ),
      ).toHaveLength(1);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "retains paid state at response interruption %s without inventing unwind",
    (reason) => {
      const { game, rules, scheduler } = setup({}, "response");
      rules.skills.push({
        id: "interrupt",
        rule: true,
        priority: 50,
        events: ["CardResponded"],
        effect: () => ({ kind: "interrupt", reason }),
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "ask-card-response",
          data: { ...request(), isProvision: false },
        },
        "a",
      );
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.cardZones.table.cards).toEqual([1]);
      expect(game.cardZones.discard.cards).toEqual([]);
      expect(
        game.trace.filter(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            !Array.isArray(item) &&
            item.operation === "response-after-fixture",
        ),
      ).toHaveLength(0);
    },
  );
  it("retains a provision on the table while still revealing, responding and validating after", () => {
    const { game, rules, scheduler } = setup({}, "response");
    readCardReference(game, "Jink").storage.flags = [
      "cardNotTriggerCardFinished",
    ];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-response", data: request() },
      "a",
    );
    expect(game.cardZones.table.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([]);
    expect(events(game)).toEqual(["CardAsked", "ChoiceMade", "CardResponded"]);
    expect(game.trace).toContainEqual({
      operation: "reveal-fixture",
      data: {
        actor: "b",
        response: {
          ...card(),
          card: { ...card().card, flags: ["cardNotTriggerCardFinished"] },
        },
      },
    });
    expect(game.trace).toContainEqual({
      operation: "response-after-fixture",
      data: { actor: "b", original: card() },
    });
    expect(readCardReference(game, "Jink").storage.flags).toEqual([
      "cardNotTriggerCardFinished",
    ]);
  });
  it("emits CardResponded and the response after-hook without a use lifecycle", () => {
    const { game, rules, scheduler } = setup({}, "response");
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        {
          name: "ask-card-response",
          data: { ...request(), isProvision: false },
        },
        "a",
      ),
    ).toBe(true);
    expect(events(game)).toEqual(["CardAsked", "ChoiceMade", "CardResponded"]);
    expect(game.trace).toContainEqual({
      event: "CardResponded",
      data: {
        m_card: card(),
        m_who: "a",
        m_isUse: false,
        m_isRetrial: false,
        m_isHandcard: true,
        m_data: { source: "a" },
      },
    });
    expect(game.trace).toContainEqual({
      operation: "response-after-fixture",
      data: { actor: "b", original: card() },
    });
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.currentCardUseReason).toBe("response");
    expect(game.playerHistory).toEqual({ a: {}, b: {} });
  });
});
describe("direct MethodUse askForCard", () => {
  it.each([true, false])(
    "uses a physical wrapped reference with modified=%s and preserves its face",
    (modified) => {
      const { game, rules, scheduler } = setup();
      game.cardResources!.cards.Jink = {
        kind: "wrapped",
        id: 1,
        key: "1",
        isSlash: false,
        isNDTrick: false,
      };
      game.wrappedCards = {
        1: {
          name: "jink",
          className: "Jink",
          skillName: "",
          suit: "heart",
          number: 7,
          modified,
          flags: ["temporary"],
          tags: { private: "kept" },
        },
      };
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "ask-card-use", data: request() },
        "a",
      );
      expect(events(game)).toEqual([
        "CardAsked",
        "ChoiceMade",
        "PreCardUsed",
        "CardUsed",
        "CardFinished",
      ]);
      expect(game.trace).toContainEqual({
        event: "ChoiceMade",
        data: "cardResponded:jink:slash-jink:a:_1_",
      });
      expect(game.trace).toContainEqual({
        operation: "notice-fixture",
        data: {
          kind: "accepted",
          actor: "b",
          card: { ...card(), card: { ...card().card, flags: ["temporary"] } },
        },
      });
      expect(game.wrappedCards[1]).toEqual({
        name: "jink",
        className: "Jink",
        skillName: "",
        suit: "heart",
        number: 7,
        modified,
        flags: [],
        tags: { private: "kept", CardUseDisresponsiveList: [] },
      });
      expect(game.cardZones.discard.cards).toEqual([1]);
    },
  );
  it.each(["descriptor", "reference", "duplicate material"])(
    "rejects an invalid %s without moving materials or charging history",
    (variant) => {
      const { game, rules, scheduler } = setup();
      if (variant === "descriptor") game.reply!.card.materialIDs = [-1];
      if (variant === "reference") game.reply!.reference = "unknown";
      if (variant === "duplicate material") game.cardZones.table.cards.push(1);
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "ask-card-use", data: request() },
          "a",
        ),
      ).toThrow(/Invalid/);
      expect(game.cardZones.hand.cards).toEqual([1, 2]);
      expect(game.cardZones.discard.cards).toEqual([]);
      expect(game.playerHistory).toEqual({ a: {}, b: {} });
      expect(events(game)).not.toContain("PreCardUsed");
    },
  );
  it("lets a nested ask consume the room-wide provider without restoring nested reason or pattern", () => {
    const { game, rules, scheduler } = setup();
    game.reply = card("Other", [2]);
    rules.skills.push({
      id: "nested-provider",
      rule: true,
      priority: 40,
      events: ["CardAsked"],
      effect: ({ game, event, continuation }) => {
        if (event.target !== "b" || continuation !== null)
          return { kind: "done", value: false };
        provideCard(game, card());
        return {
          kind: "operation",
          operation: {
            name: "ask-card-use",
            data: {
              ...request(),
              actor: "a",
              pattern: "nested",
              prompt: "inner",
            },
          },
          continuation: true,
        };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-use", data: request() },
      "a",
    );
    expect(game.requests).toEqual([{ ...request(), ai: false }]);
    expect(game.currentCardUsePattern).toBe("nested");
    expect(game.currentCardUseReason).toBe("response-use");
    expect(game.providedCard).toBeUndefined();
    expect(game.cardZones.discard.cards).toEqual([2, 1]);
    expect(scheduler.operationCompletion?.value).toEqual(card("Other", [2]));
  });
  it("does not call a limitation predicate with a null provided card", () => {
    const { game, rules, scheduler } = setup({
      limited: () => {
        throw new Error("limitation must not be called for null");
      },
    });
    provideCard(game, null);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-use", data: request() },
      "a",
    );
    expect(events(game)).toEqual(["CardAsked", "ChoiceMade"]);
    expect(scheduler.operationCompletion?.value).toBeNull();
  });
  it.each([
    "reply-fixture",
    "validate-fixture",
    "reveal-fixture",
    "after-fixture",
  ])("restores an asynchronous %s child without duplicate work", (name) => {
    const state = setup();
    const { rules } = state;
    let { game, scheduler } = state;
    const original = rules.operations!.find((op) => op.name === name)!;
    rules.operations = rules.operations!.map((op) =>
      op.name !== name
        ? op
        : {
            ...op,
            run: (context) =>
              context.continuation === null
                ? {
                    kind: "prompt",
                    actor: "b",
                    choices: ["go"],
                    canCancel: false,
                    continuation: true,
                  }
                : original.run({ ...context, continuation: null }),
          },
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-use", data: request() },
      "a",
    );
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    const view = getTriggerPrompt(scheduler, "b")!;
    expect(view).not.toBeNull();
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: view.id,
        choice: "go",
      }),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toEqual(card());
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.requests).toHaveLength(1);
    expect(game.trace.filter((item) => item === "validate")).toHaveLength(1);
  });
  it.each(["use", "response", "none", "discard", "retrial", "actor", "target"])(
    "rejects unsupported or invalid %s requests before frame allocation",
    (variant) => {
      const { game, rules, scheduler } = setup();
      const data = {
        ...request(),
        ...(variant === "use"
          ? { pattern: "slash" }
          : variant === "retrial"
            ? { isRetrial: "invalid" }
            : variant === "actor"
              ? { actor: "unknown" }
              : variant === "target"
                ? { to: "unknown" }
                : { method: variant }),
      };
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "ask-card-use", data },
          "a",
        ),
      ).toThrow("Invalid MethodUse request");
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it.each([{ ids: [] }, { ids: [1, 2] }])(
    "supports virtual material set $ids without Room history",
    ({ ids }) => {
      const { game, rules, scheduler } = setup({ notify: () => null });
      game.catalog.Jink = card("Jink", ids);
      game.reply = card("Jink", ids);
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "ask-card-use", data: request() },
        "a",
      );
      expect(game.cardZones.discard.cards).toEqual(expect.arrayContaining(ids));
      expect(game.cardZones.discard.cards).toHaveLength(ids.length);
      expect(game.playerHistory.b).toEqual({});
      expect(scheduler.operationCompletion?.value).toEqual(card("Jink", ids));
    },
  );
  it("composes the real SlashProceed and JinkEffect caller with acquired direct use", () => {
    const { game, rules, scheduler } = setup();
    rules.operations!.push(
      createSlashProceedOperation<Game>({
        ask: (req) => ({
          name: "ask-card-use",
          data: {
            ...request(),
            actor: req.target,
            pattern: req.pattern,
            prompt: req.prompt,
            data: req.data,
            to: req.source,
          },
        }),
      }),
      createJinkEffectOperation<Game>({
        isJink: (_game, response) => response.card.className === "Jink",
      }),
      createSlashResultOperation<Game>(),
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "slash-proceed",
        data: {
          from: "a",
          to: "b",
          slash: card("Raw", []),
          jink: null,
          jink_num: 1,
          drank: 0,
          nature: "normal",
          nullified: false,
        },
      },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toBe(false);
    expect(events(game)).toContain("CardFinished");
    expect(game.requests).toHaveLength(1);
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardResources!.playerTags.b.Qinggang).toBeUndefined();
  });
  it.each(["human", "AI", "provided"])(
    "keeps native pre-conversion limitation ownership for %s",
    (source) => {
      const { game, rules, scheduler } = setup();
      game.denied = true;
      game.ai = source === "AI";
      if (source === "provided") provideCard(game, card());
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "ask-card-use", data: request() },
        "a",
      );
      expect(scheduler.operationCompletion?.value).toEqual(
        source === "human" ? card() : null,
      );
      expect(game.trace.filter((item) => item === "validate")).toHaveLength(
        source === "human" ? 1 : 0,
      );
      expect(game.cardZones.discard.cards).toEqual(
        source === "human" ? [1] : [],
      );
    },
  );
  it("rejects a duplicate provide even when the first supplied value is null", () => {
    const { game } = setup();
    provideCard(game, null);
    expect(() => provideCard(game, card())).toThrow("already provided");
    expect(game.providedCard).toEqual({ card: null });
  });
  it.each([
    "CardAsked",
    "ChoiceMade",
    "PreCardUsed",
    "CardUsed",
    "CardFinished",
    "BeforeCardsMove",
    "CardsMoveOneTime",
  ])("retains exact-once effects after JSON pause at %s", (pause) => {
    const state = setup();
    const { rules } = state;
    let { game, scheduler } = state;
    rules.skills.push({
      id: "pause",
      rule: true,
      priority: 50,
      events: [pause],
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "prompt",
              actor: "b",
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
      { name: "ask-card-use", data: request() },
      "a",
    );
    let pauses = 0;
    expect(scheduler.prompt).not.toBeNull();
    while (scheduler.prompt) {
      expect(++pauses).toBeLessThan(6);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      const view = getTriggerPrompt(scheduler, "b")!;
      const reply = { id: view.id, choice: "go" };
      const before = structuredClone({ game, scheduler });
      expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(
        false,
      );
      expect(
        resumeTriggerPrompt(
          scheduler,
          game,
          { ...rules, version: "wrong" },
          "b",
          reply,
        ),
      ).toBe(false);
      expect(
        resumeTriggerPrompt(scheduler, game, rules, "b", {
          ...reply,
          id: "stale",
        }),
      ).toBe(false);
      expect({ game, scheduler }).toEqual(before);
      expect(resumeTriggerPrompt(scheduler, game, rules, "b", reply)).toBe(
        true,
      );
      expect(resumeTriggerPrompt(scheduler, game, rules, "b", reply)).toBe(
        false,
      );
    }
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.trace.filter((item) => item === "validate")).toHaveLength(1);
    expect(game.requests).toHaveLength(1);
    expect(
      game.trace.filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          !Array.isArray(item) &&
          item.operation === "after-fixture",
      ),
    ).toHaveLength(1);
  });
  it("keeps raw conversion identity and the local use distinct from rewritten event data", () => {
    const { game, rules, scheduler } = setup();
    const raw = { ...card("Raw", []), metadata: { owner: "private" } };
    raw.card.type = "skill";
    game.reply = raw;
    game.validations = [card()];
    rules.skills.push({
      id: "rewrite",
      rule: true,
      priority: 10,
      events: ["PreCardUsed"],
      effect: ({ event }) => {
        event.data = { from: "a", to: [], card: card("Other", [2]).card };
        return { kind: "done", value: true };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-use", data: request() },
      "a",
    );
    expect(scheduler.operationCompletion?.value).toEqual(card());
    expect(game.trace).toContainEqual({
      operation: "use-fixture",
      data: expect.objectContaining({
        from: "a",
        card: expect.objectContaining({ className: "Other" }),
      }),
    });
    expect(game.trace).toContainEqual({
      operation: "after-fixture",
      data: {
        actor: "b",
        original: raw,
        use: {
          from: "b",
          to: [],
          card: card().card,
          m_isOwnerUse: true,
          m_addHistory: true,
          nullified_list: [],
          disresponsive_list: [],
        },
      },
    });
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.hand.cards).toEqual([2]);
  });
  it("captures initial IDs after ChoiceMade but resolves current validated materials for cleanup", () => {
    const { game, rules, scheduler } = setup();
    rules.skills.push({
      id: "materials",
      rule: true,
      priority: 10,
      events: ["ChoiceMade", "CardUsed"],
      effect: ({ game, event }) => {
        game.catalog.Jink.card.materialIDs =
          event.name === "ChoiceMade" ? [2] : [1];
        if (event.name === "CardUsed") {
          game.cardZones.hand.cards = [];
          game.cardZones.table.cards.push(1);
        }
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-use", data: request() },
      "a",
    );
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.table.cards).toEqual([2]);
    expect(scheduler.operationCompletion?.value).toEqual(card("Jink", [1]));
  });
  it("uses local-card suppression cleanup even if CardUsed rewrites the event card", () => {
    const { game, rules, scheduler } = setup();
    game.cardResources!.cards.Jink.isSlash = true;
    game.cardResources!.cards.Jink.isNDTrick = true;
    game.cardResources!.playerTags.b.Jink_Jink = [1];
    game.cardResources!.roomTags.JinkHegNullificationTargets = ["a"];
    readCardReference(game, "Jink").storage.flags = [
      "cardNotTriggerCardFinished",
    ];
    rules.skills.push({
      id: "rewrite-used",
      rule: true,
      priority: 10,
      events: ["CardUsed"],
      effect: ({ event }) => {
        event.data = { from: "a", to: [], card: card("Other", [2]).card };
        return { kind: "done", value: true };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-use", data: request() },
      "a",
    );
    expect(events(game)).not.toContain("CardFinished");
    expect(readCardReference(game, "Jink").storage.flags).toEqual([]);
    expect(game.cardResources!.playerTags.b.Jink_Jink).toBeUndefined();
    expect(
      game.cardResources!.roomTags.JinkHegNullificationTargets,
    ).toBeUndefined();
    expect(game.trace).toContainEqual({
      operation: "notice-fixture",
      data: { kind: "finish", players: ["a", "b"] },
    });
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes paid movement without inventing native unwind on %s",
    (reason) => {
      const { game, rules, scheduler } = setup();
      rules.skills.push({
        id: "interrupt",
        rule: true,
        priority: 50,
        events: ["CardUsed"],
        effect: () => ({ kind: "interrupt", reason }),
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "ask-card-use", data: request() },
        "a",
      );
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.cardZones.table.cards).toEqual([1]);
      expect(game.cardZones.discard.cards).toEqual([]);
      expect(events(game)).not.toContain("CardFinished");
    },
  );
  it("retries null conversion without another CardAsked and resets native retry options", () => {
    const { game, rules, scheduler } = setup();
    game.validations = [null, card()];
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "ask-card-use", data: request() },
      "a",
    );
    expect(game.requests).toEqual([
      { ...request(), ai: false },
      { ...request(), skillName: "", isProvision: false, ai: false },
    ]);
    expect(events(game)).toEqual([
      "CardAsked",
      "ChoiceMade",
      "PreCardUsed",
      "CardUsed",
      "CardFinished",
    ]);
    expect(game.trace.filter((item) => item === "validate")).toHaveLength(2);
    expect(game.playerFlags.b).not.toContain("continuing");
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it.each(["card", "null", "dead-card", "dead-empty"])(
    "consumes the shared provided slot before acquisition: %s",
    (variant) => {
      const { game, rules, scheduler } = setup();
      rules.skills.unshift({
        id: "provider",
        rule: true,
        priority: 30,
        events: ["CardAsked"],
        effect: ({ game }) => {
          if (variant !== "dead-empty")
            provideCard(game, variant === "null" ? null : card());
          if (variant.startsWith("dead")) game.alive.b = false;
          return { kind: "done", value: true };
        },
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "ask-card-use", data: request() },
        "a",
      );
      expect(game.requests).toEqual([]);
      expect(game.providedCard).toBeUndefined();
      expect(scheduler.operationCompletion?.value).toEqual(
        variant === "null" || variant === "dead-empty" ? null : card(),
      );
    },
  );
  it("runs the direct response lifecycle through shared GameRule without Room history or ordinary onUse", () => {
    const { game, rules, scheduler } = setup();
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "ask-card-use", data: request() },
        "a",
      ),
    ).toBe(true);
    expect(events(game)).toEqual([
      "CardAsked",
      "ChoiceMade",
      "PreCardUsed",
      "CardUsed",
      "CardFinished",
    ]);
    expect(scheduler.operationCompletion?.value).toEqual(card());
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.cardZones.hand.cards).toEqual([2]);
    expect(game.playerHistory).toEqual({ a: {}, b: {} });
  });
});
