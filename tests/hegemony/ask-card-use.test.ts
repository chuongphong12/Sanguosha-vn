import { describe, expect, it } from "vitest";
import {
  createAskCardUseOperation,
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
function setup(overrides: Partial<AskCardUseRules<Game>> = {}) {
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
      kind: "use",
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
      createAskCardUseOperation(policy),
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
            ? { isRetrial: true }
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
