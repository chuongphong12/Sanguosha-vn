import { describe, expect, it } from "vitest";
import {
  createRetrialOperation,
  createJudgeResultOperation,
  judgeIsGood,
  judgeIsEffected,
  type JudgeState,
  type RetrialGame,
  type RetrialRules,
} from "../../src/game/hegemony/retrial";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  dispatchTriggerEvent,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import type { SlashCard } from "../../src/game/hegemony/slash";
import { createAskCardResponseOperation } from "../../src/game/hegemony/ask-card-use";
import { readCardReference } from "../../src/game/hegemony/card-resources";
import {
  createRetrialSkill,
  type RetrialSkillRules,
} from "../../src/game/hegemony/retrial-skill";

type Game = RetrialGame & {
  catalog: Record<string, SlashCard>;
  trace: TriggerData[];
  replies: (SlashCard | null)[];
  requests: TriggerData[];
};
const card = (reference = "one", ids = [1]): SlashCard => ({
  reference,
  card: {
    type: "basic",
    name: "jink",
    className: "Jink",
    skillName: "",
    materialIDs: ids,
    flags: [],
  },
});
const judge = (): JudgeState => ({
  who: "a",
  card: card("old", [3]),
  pattern: ".|red",
  patterns: [],
  good: true,
  reason: "lightning",
  time_consuming: false,
  negative: false,
  play_animation: true,
  result: "unknown",
});
function setup(overrides: Partial<RetrialRules<Game>> = {}) {
  const game: Game = {
    seatOrder: ["a", "b"],
    alive: { a: true, b: true },
    playerFlags: { a: [], b: [] },
    cardZones: {
      handA: { place: "hand", owner: "a", cards: [] },
      handB: { place: "hand", owner: "b", cards: [1, 2] },
      judgeA: { place: "judge", owner: "a", cards: [3] },
      judgeB: { place: "judge", owner: "b", cards: [] },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    wrappedCards: Object.fromEntries(
      [1, 2, 3].map((id) => [
        id,
        {
          name: "jink",
          className: "Jink",
          suit: "heart",
          number: id,
          skillName: "",
          modified: false,
          flags: [],
          tags: {},
        },
      ]),
    ),
    cardResources: {
      cards: {
        one: {
          kind: "wrapped",
          id: 1,
          key: "1",
          isSlash: false,
          isNDTrick: false,
        },
        two: {
          kind: "wrapped",
          id: 2,
          key: "2",
          isSlash: false,
          isNDTrick: false,
        },
        old: {
          kind: "wrapped",
          id: 3,
          key: "3",
          isSlash: false,
          isNDTrick: false,
        },
        virtual: {
          kind: "virtual",
          key: "virtual",
          isSlash: false,
          isNDTrick: false,
          flags: [],
          tags: {},
        },
      },
      playerTags: { a: {}, b: {} },
      roomTags: {},
    },
    judges: { first: judge(), second: { ...judge(), who: "b" } },
    catalog: {
      one: card(),
      two: card("two", [2]),
      old: card("old", [3]),
      virtual: card("virtual", [1, 2]),
    },
    trace: [],
    replies: [card()],
    requests: [],
  };
  const policy: RetrialRules<Game> = {
    discardZone: "discard",
    resolve: (game, response) => game.catalog[response.reference],
    canonical: (game, id) =>
      Object.values(game.catalog).find(
        (card) =>
          game.cardResources!.cards[card.reference].kind === "wrapped" &&
          card.card.materialIDs[0] === id,
      )!,
    notify: (notice) => ({ name: "notice", data: notice }),
    ...overrides,
  };
  const rules: TriggerRegistry<Game> = {
    version: "retrial-ce4e62b",
    skills: [
      {
        id: "observer",
        rule: true,
        priority: 20,
        events: [
          "CardAsked",
          "ChoiceMade",
          "PreCardUsed",
          "CardUsed",
          "CardFinished",
          "CardResponded",
          "BeforeCardsMove",
        ],
        effect: ({ game, event }) => {
          if (event.name !== "BeforeCardsMove" || event.target === "a")
            game.trace.push({
              event: event.name,
              target: event.target,
              data: structuredClone(event.data),
            });
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      createRetrialOperation(policy),
      createCardMovementOperation(),
      {
        name: "notice",
        run: ({ game, operation }) => {
          game.trace.push(operation.data);
          return { kind: "return", value: null };
        },
      },
    ],
  };
  return {
    game,
    rules,
    policy,
    scheduler: createTriggerScheduler(game.seatOrder, rules.version),
  };
}
const request = (exchange = false) => ({
  actor: "b",
  judge: "first",
  card: card(),
  skillName: "guicai",
  exchange,
});
function skillSetup(
  skill: "guicai" | "guidao",
  overrides: Partial<RetrialSkillRules<Game>> = {},
) {
  const state = setup();
  const { rules, policy } = state;
  rules.operations!.push(
    createAskCardResponseOperation({
      tableZone: "table",
      discardZone: "discard",
      isAI: () => false,
      request: (data) => ({ name: "request-card", data }),
      limited: () => false,
      validateResponse: (_actor, card) => ({
        name: "validate-card",
        data: card,
      }),
      resolve: policy.resolve,
      notify: (notice) => ({ name: "notice", data: notice }),
      reveal: () => {
        throw new Error("Unexpected ordinary card reveal");
      },
      moveReason: () => {
        throw new Error("Unexpected ordinary response payment");
      },
      validateInResponseAfter: () => {
        throw new Error("Unexpected response-after");
      },
    }),
    createJudgeResultOperation({ matches: () => true }),
    {
      name: "request-card",
      run: ({ game, operation }) => {
        game.requests.push(operation.data);
        return { kind: "return", value: game.replies.shift() ?? null };
      },
    },
    {
      name: "validate-card",
      run: ({ operation }) => ({ kind: "return", value: operation.data }),
    },
  );
  rules.skills.push(
    createRetrialSkill({
      skill,
      tableZone: "table",
      eligible: () => ({ slot: "head", shown: true }),
      resolve: policy.resolve,
      notify: (notice) => ({
        name: "notice",
        data: { kind: "skill-notice", ...notice },
      }),
      reveal: (actor, skill) => ({
        name: "notice",
        data: { kind: "skill-reveal", actor, skill },
      }),
      serialize: (_game, card) => JSON.stringify(card),
      parse: (_game, serialized) => JSON.parse(serialized),
      ...overrides,
    }),
  );
  return state;
}
function finishPrompts(state: ReturnType<typeof setup>) {
  let count = 0;
  while (state.scheduler.prompt) {
    expect(++count).toBeLessThan(20);
    const view = getTriggerPrompt(state.scheduler, "b")!;
    expect(
      resumeTriggerPrompt(state.scheduler, state.game, state.rules, "b", {
        id: view.id,
        choice: view.choices[0].id,
      }),
    ).toBe(true);
  }
}
describe("Guicai and Guidao retrial composition", () => {
  it("submits package and core movement with distinct visibility, reasons and snapshot timing", () => {
    const state = skillSetup("guidao");
    state.game.replies = [card("virtual", [1, 2])];
    const movements: TriggerData[] = [];
    state.rules.operations = state.rules.operations!.map((operation) =>
      operation.name !== "move-cards"
        ? operation
        : {
            ...operation,
            run: (context) => {
              if (context.continuation === null) {
                movements.push(structuredClone(context.operation.data));
                expect(context.game.judges.first.result).toBe("unknown");
              }
              return operation.run(context);
            },
          },
    );
    dispatchTriggerEvent(
      state.scheduler,
      state.game,
      state.rules,
      { name: "AskForRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    finishPrompts(state);
    expect(movements).toEqual([
      {
        moves: [
          {
            ids: [1, 2],
            to: "table",
            open: true,
            reason: { kind: "response", actor: "b", skill: "guidao" },
          },
        ],
        forceVisible: false,
      },
      {
        moves: [
          {
            ids: [1],
            to: "judgeA",
            open: true,
            reason: { kind: "retrial", actor: "b", skill: "guidao" },
          },
          {
            ids: [3],
            to: "handB",
            open: true,
            reason: { kind: "override", actor: "b", skill: "guidao" },
          },
        ],
        forceVisible: true,
      },
    ]);
    expect(state.game.judges.first.result).toBe("good");
    expect(state.game.cardZones.table.cards).toEqual([2]);
  });
  it("uses validated conversion output for package response and replacement", () => {
    const state = skillSetup("guicai");
    const raw = { ...card("virtual", []), metadata: { original: "private" } };
    raw.card.type = "skill";
    state.game.replies = [raw];
    state.rules.operations = state.rules.operations!.map((operation) =>
      operation.name === "validate-card"
        ? { ...operation, run: () => ({ kind: "return", value: card() }) }
        : operation,
    );
    dispatchTriggerEvent(
      state.scheduler,
      state.game,
      state.rules,
      { name: "AskForRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    finishPrompts(state);
    expect(state.game.trace).toContainEqual({
      event: "CardResponded",
      target: "b",
      data: expect.objectContaining({ m_card: card() }),
    });
    expect(state.game.judges.first.card).toEqual(card());
  });
  it.each(["BeforeCardsMove", "CardsMoveOneTime", "CardResponded"])(
    "reloads both cost and replacement movement around %s",
    (pause) => {
      const state = skillSetup("guicai");
      state.rules.skills.push({
        id: "pause-pipeline",
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
      dispatchTriggerEvent(
        state.scheduler,
        state.game,
        state.rules,
        { name: "AskForRetrial", target: "b", data: { judge: "first" } },
        "a",
      );
      let pauses = 0;
      while (state.scheduler.prompt) {
        expect(++pauses).toBeLessThan(8);
        Object.assign(
          state,
          JSON.parse(
            JSON.stringify({ game: state.game, scheduler: state.scheduler }),
          ),
        );
        const view = getTriggerPrompt(state.scheduler, "b")!;
        expect(
          resumeTriggerPrompt(state.scheduler, state.game, state.rules, "b", {
            id: view.id,
            choice: view.choices[0].id,
          }),
        ).toBe(true);
      }
      expect(pauses).toBeGreaterThan(1);
      expect(state.game.requests).toHaveLength(1);
      expect(state.game.judges.first.result).toBe("good");
      expect(state.game.cardZones.judgeA.cards).toEqual([1]);
      expect(state.game.cardZones.discard.cards).toEqual([3]);
      expect(state.game.cardResources!.playerTags.b.guicai_cards).toEqual([]);
    },
  );
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes paid cost and eager core state on %s",
    (reason) => {
      const state = skillSetup("guicai");
      state.rules.skills.push({
        id: "interrupt-core",
        rule: true,
        priority: 50,
        events: ["BeforeCardsMove"],
        effect: ({ event }) => {
          const data = event.data as { moves: { reason: { kind: string } }[] };
          return data.moves.some((move) => move.reason.kind === "retrial")
            ? { kind: "interrupt", reason }
            : { kind: "done", value: false };
        },
      });
      dispatchTriggerEvent(
        state.scheduler,
        state.game,
        state.rules,
        { name: "AskForRetrial", target: "b", data: { judge: "first" } },
        "a",
      );
      finishPrompts(state);
      expect(state.scheduler.interruption?.reason).toBe(reason);
      expect(state.game.judges.first.card).toEqual(card());
      expect(state.game.judges.first.result).toBe("unknown");
      expect(state.game.cardZones.judgeA.cards).toEqual([3]);
      expect(state.game.cardZones.table.cards).toEqual([1]);
      expect(state.game.cardResources!.playerTags.b.guicai_cards).toEqual([]);
    },
  );
  it.each(["guicai", "guidao"] as const)(
    "uses native %s request, package response and successful-cost reveal ordering",
    (skill) => {
      const state = skillSetup(skill);
      dispatchTriggerEvent(
        state.scheduler,
        state.game,
        state.rules,
        {
          name: "AskForRetrial",
          target: "b",
          data: { judge: "first", extra: "original" },
        },
        "a",
      );
      finishPrompts(state);
      expect(state.game.requests).toEqual([
        {
          actor: "b",
          pattern: skill === "guicai" ? ".." : ".|black",
          prompt: `@${skill}-card:a:${skill}:lightning:3`,
          data: { judge: "first", extra: "original" },
          to: "a",
          isRetrial: true,
          skillName: "",
          isProvision: false,
          ai: false,
        },
      ]);
      const eventNames = state.game.trace.flatMap((item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.event === "string" &&
        item.event !== "BeforeCardsMove"
          ? [item.event]
          : [],
      );
      expect(eventNames).toEqual(["ChoiceMade", "CardResponded"]);
      expect(state.game.trace).toContainEqual({
        event: "CardResponded",
        target: "b",
        data: {
          m_card: card(),
          m_who: "a",
          m_isUse: false,
          m_isRetrial: false,
          m_isHandcard: true,
          m_data: { judge: "first", extra: "original" },
        },
      });
      const notices = state.game.trace.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          typeof item.kind === "string",
      );
      expect(notices).toEqual([
        expect.objectContaining({ kind: "focus" }),
        expect.objectContaining({ kind: "accepted" }),
        expect.objectContaining({ kind: "skill-notice", skill }),
        expect.objectContaining({ kind: "skill-reveal", skill }),
        expect.objectContaining({ kind: "changed-judge", skillName: skill }),
      ]);
    },
  );
  it("moves all virtual cost materials, but only the effective card replaces the judge", () => {
    const state = skillSetup("guicai");
    state.game.replies = [card("virtual", [1, 2])];
    state.game.cardZones.handB.cards = [1];
    state.game.cardZones.equip = { place: "equip", owner: "b", cards: [2] };
    dispatchTriggerEvent(
      state.scheduler,
      state.game,
      state.rules,
      { name: "AskForRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    finishPrompts(state);
    expect(state.game.cardZones.table.cards).toEqual([2]);
    expect(state.game.cardZones.judgeA.cards).toEqual([1]);
    expect(state.game.trace).toContainEqual({
      event: "CardResponded",
      target: "b",
      data: expect.objectContaining({
        m_card: card("virtual", [1, 2]),
        m_isHandcard: true,
        m_isRetrial: false,
      }),
    });
  });
  it("serializes current validated materials and flags after a consumed/rewritten response", () => {
    const state = skillSetup("guicai");
    state.game.replies = [card("virtual", [1, 2])];
    let encoded: SlashCard | null = null;
    const skill = state.rules.skills.find((skill) => skill.id === "guicai")!;
    const replacement = createRetrialSkill<Game>({
      skill: "guicai",
      tableZone: "table",
      eligible: () => ({ slot: "head", shown: true }),
      resolve: state.policy.resolve,
      notify: () => null,
      reveal: () => null,
      serialize: (_game, response) => {
        encoded = structuredClone(response);
        return JSON.stringify(response);
      },
      parse: (_game, saved) => JSON.parse(saved),
    });
    Object.assign(skill, replacement);
    state.rules.skills.push({
      id: "response-mutation",
      rule: true,
      priority: 50,
      events: ["CardResponded"],
      effect: ({ game, event }) => {
        game.catalog.virtual.card.materialIDs = [2];
        readCardReference(game, "virtual").storage.flags = [
          "changed-after-response",
        ];
        event.data = { m_card: card("one", [1]) };
        return { kind: "done", value: true };
      },
    });
    dispatchTriggerEvent(
      state.scheduler,
      state.game,
      state.rules,
      { name: "AskForRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    finishPrompts(state);
    expect(encoded).toEqual({
      ...card("virtual", [2]),
      card: { ...card("virtual", [2]).card, flags: ["changed-after-response"] },
    });
    expect(state.game.judges.first.card).toEqual(card("two", [2]));
    expect(state.game.cardZones.table.cards).toEqual([1]);
  });
  it("pops before parse and consumes a null parse without replacement or result update", () => {
    const state = skillSetup("guicai", {
      parse: (game) => {
        expect(game.cardResources!.playerTags.b.guicai_cards).toEqual([]);
        return null;
      },
    });
    dispatchTriggerEvent(
      state.scheduler,
      state.game,
      state.rules,
      { name: "AskForRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    finishPrompts(state);
    expect(state.game.cardResources!.playerTags.b.guicai_cards).toEqual([]);
    expect(state.game.cardZones.table.cards).toEqual([1]);
    expect(state.game.judges.first.card).toEqual(card("old", [3]));
    expect(state.game.judges.first.result).toBe("unknown");
  });
  it("uses the current effect judge ID rather than its cost snapshot", () => {
    const state = skillSetup("guicai");
    state.game.catalog.fourth = card("fourth", [4]);
    state.game.cardResources!.cards.fourth = {
      kind: "wrapped",
      id: 4,
      key: "4",
      isSlash: false,
      isNDTrick: false,
    };
    state.game.wrappedCards![4] = {
      ...structuredClone(state.game.wrappedCards![3]),
      number: 4,
    };
    state.game.cardZones.judgeB.cards = [4];
    state.game.judges.second = {
      ...judge(),
      who: "b",
      card: card("fourth", [4]),
    };
    state.rules.skills.find((skill) => skill.id === "guicai")!.reveal = ({
      event,
    }) => {
      event.data = { judge: "second" };
      return { kind: "done", value: false };
    };
    dispatchTriggerEvent(
      state.scheduler,
      state.game,
      state.rules,
      { name: "AskForRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    finishPrompts(state);
    expect(state.game.judges.first.result).toBe("unknown");
    expect(state.game.judges.second.result).toBe("good");
    expect(state.game.cardZones.judgeA.cards).toEqual([3]);
    expect(state.game.cardZones.judgeB.cards).toEqual([1]);
    expect(state.game.cardZones.discard.cards).toEqual([4]);
    expect(state.game.trace).toContainEqual({
      event: "CardResponded",
      target: "b",
      data: expect.objectContaining({ m_who: "a" }),
    });
  });
  it("keeps per-skill LIFO stacks when another cost/effect nests during reveal", () => {
    const parsed: string[] = [];
    const state = skillSetup("guicai", {
      parse: (game, saved) => {
        const response: SlashCard = JSON.parse(saved);
        parsed.push(response.reference);
        expect(
          (game.cardResources!.playerTags.b.guicai_cards as TriggerData[])
            .length,
        ).toBe(response.reference === "two" ? 1 : 0);
        return response;
      },
    });
    state.game.replies = [card(), card("two", [2])];
    state.rules.skills.find((skill) => skill.id === "guicai")!.reveal = ({
      game,
      continuation,
    }) => {
      if (continuation === null && !game.cardResources!.roomTags.nested) {
        game.cardResources!.roomTags.nested = true;
        return {
          kind: "event",
          event: {
            name: "AskForRetrial",
            target: "b",
            data: { judge: "first" },
          },
          continuation: true,
        };
      }
      return { kind: "done", value: false };
    };
    dispatchTriggerEvent(
      state.scheduler,
      state.game,
      state.rules,
      { name: "AskForRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    finishPrompts(state);
    expect(parsed).toEqual(["two", "one"]);
    expect(state.game.judges.first.card).toEqual(card());
    expect(state.game.cardZones.discard.cards).toEqual(
      expect.arrayContaining([2, 3]),
    );
    expect(state.game.cardResources!.playerTags.b.guicai_cards).toEqual([]);
  });
  it("emits the conditional core response if a cost response child restores ownership", () => {
    const state = skillSetup("guicai");
    state.rules.skills.push({
      id: "restore-ownership",
      rule: true,
      priority: 10,
      events: ["CardResponded"],
      effect: ({ event, continuation }) => {
        const data = event.data as { m_isRetrial: boolean };
        return !data.m_isRetrial && continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  moves: [{ ids: [1], to: "handB", reason: { kind: "take" } }],
                },
              },
              continuation: true,
            }
          : { kind: "done", value: false };
      },
    });
    dispatchTriggerEvent(
      state.scheduler,
      state.game,
      state.rules,
      { name: "AskForRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    finishPrompts(state);
    const flags = state.game.trace.flatMap((value) =>
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      value.event === "CardResponded"
        ? [(value.data as { m_isRetrial: boolean }).m_isRetrial]
        : [],
    );
    expect(flags).toEqual([false, true]);
    expect(state.game.cardZones.judgeA.cards).toEqual([1]);
  });
  it.each(["request-card", "validate-card", "notice", "update-judge-result"])(
    "restores the full skill pipeline at %s",
    (name) => {
      const state = skillSetup("guidao");
      const original = state.rules.operations!.find(
        (operation) => operation.name === name,
      )!;
      state.rules.operations = state.rules.operations!.map((operation) =>
        operation.name !== name
          ? operation
          : {
              ...operation,
              run: (context) =>
                context.continuation === null
                  ? {
                      kind: "prompt",
                      actor: "b",
                      choices: ["go"],
                      canCancel: false,
                      continuation: "fixture-start",
                    }
                  : original.run({
                      ...context,
                      continuation:
                        context.continuation === "fixture-start"
                          ? null
                          : context.continuation,
                    }),
            },
      );
      dispatchTriggerEvent(
        state.scheduler,
        state.game,
        state.rules,
        { name: "AskForRetrial", target: "b", data: { judge: "first" } },
        "a",
      );
      let pauses = 0;
      while (state.scheduler.prompt) {
        expect(++pauses).toBeLessThan(15);
        Object.assign(
          state,
          JSON.parse(
            JSON.stringify({ game: state.game, scheduler: state.scheduler }),
          ),
        );
        const view = getTriggerPrompt(state.scheduler, "b")!,
          reply = { id: view.id, choice: view.choices[0].id };
        const before = structuredClone({
          game: state.game,
          scheduler: state.scheduler,
        });
        expect(
          resumeTriggerPrompt(
            state.scheduler,
            state.game,
            state.rules,
            "a",
            reply,
          ),
        ).toBe(false);
        expect(
          resumeTriggerPrompt(
            state.scheduler,
            state.game,
            { ...state.rules, version: "wrong" },
            "b",
            reply,
          ),
        ).toBe(false);
        expect({ game: state.game, scheduler: state.scheduler }).toEqual(
          before,
        );
        expect(
          resumeTriggerPrompt(
            state.scheduler,
            state.game,
            state.rules,
            "b",
            reply,
          ),
        ).toBe(true);
        expect(
          resumeTriggerPrompt(
            state.scheduler,
            state.game,
            state.rules,
            "b",
            reply,
          ),
        ).toBe(false);
      }
      expect(pauses).toBeGreaterThan(1);
      expect(state.game.requests).toHaveLength(1);
      expect(state.game.judges.first.result).toBe("good");
      expect(state.game.cardZones.judgeA.cards).toEqual([1]);
      expect(state.game.cardZones.handB.cards).toEqual([2, 3]);
      expect(state.game.cardResources!.playerTags.b.guidao_cards).toEqual([]);
    },
  );
  it.each(["nil", "ineligible", "empty-stack"])(
    "does not replace a judge for %s",
    (variant) => {
      const state = skillSetup(
        "guicai",
        variant === "ineligible"
          ? { eligible: () => null }
          : {
              parse: () => {
                throw new Error("Unexpected parse");
              },
            },
      );
      if (variant === "nil") state.game.replies = [null];
      if (variant === "empty-stack")
        state.rules.skills.find((skill) => skill.id === "guicai")!.reveal = ({
          game,
        }) => {
          game.cardResources!.playerTags.b.guicai_cards = [];
          return { kind: "done", value: false };
        };
      dispatchTriggerEvent(
        state.scheduler,
        state.game,
        state.rules,
        { name: "AskForRetrial", target: "b", data: { judge: "first" } },
        "a",
      );
      finishPrompts(state);
      expect(state.game.judges.first.card).toEqual(card("old", [3]));
      expect(state.game.judges.first.result).toBe("unknown");
    },
  );
  it.each(["guicai", "guidao"] as const)(
    "runs real acquisition, cost, replacement and result for %s",
    (skill) => {
      const state = skillSetup(skill);
      expect(
        dispatchTriggerEvent(
          state.scheduler,
          state.game,
          state.rules,
          { name: "AskForRetrial", target: "b", data: { judge: "first" } },
          "a",
        ),
      ).toBe(true);
      finishPrompts(state);
      expect(state.game.judges.first.card).toEqual(card());
      expect(state.game.judges.first.result).toBe("good");
      expect(state.game.cardZones.judgeA.cards).toEqual([1]);
      expect(state.game.cardZones.discard.cards).toEqual(
        skill === "guicai" ? [3] : [],
      );
      expect(state.game.cardResources!.playerTags.b[`${skill}_cards`]).toEqual(
        [],
      );
    },
  );
});
describe("Room retrial replacement", () => {
  it("moves only a virtual card's first effective ID and emits the incoming descriptor", () => {
    const { game, rules, scheduler } = setup();
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      {
        name: "retrial",
        data: { ...request(), card: card("virtual", [1, 2]) },
      },
      "a",
    );
    expect(game.judges.first.card).toEqual(card());
    expect(game.cardZones.handB.cards).toEqual([2]);
    expect(game.trace).toContainEqual({
      event: "CardResponded",
      target: "b",
      data: {
        m_card: card("virtual", [1, 2]),
        m_who: "a",
        m_isUse: false,
        m_isRetrial: true,
        m_isHandcard: true,
        m_data: null,
      },
    });
    expect(game.trace).toContainEqual({
      event: "BeforeCardsMove",
      target: "a",
      data: {
        moves: expect.arrayContaining([
          expect.objectContaining({
            ids: [1],
            to: "judgeA",
            reason: { kind: "retrial", actor: "b", skill: "guicai" },
          }),
          expect.objectContaining({
            ids: [3],
            to: "discard",
            reason: { kind: "judgedone", actor: "b" },
          }),
        ]),
      },
    });
  });
  it.each(["table", "other", "equip"])(
    "captures response ownership/hand before replacing a card from %s",
    (source) => {
      const { game, rules, scheduler } = setup();
      game.cardZones.handB.cards = [2];
      game.cardZones.source = {
        place:
          source === "equip" ? "equip" : source === "table" ? "table" : "hand",
        owner: source === "equip" ? "b" : source === "table" ? null : "a",
        cards: [1],
      };
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "retrial", data: request() },
        "a",
      );
      const responses = game.trace.filter(
        (value) =>
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          value.event === "CardResponded",
      );
      expect(responses).toHaveLength(source === "equip" ? 1 : 0);
      if (source === "equip")
        expect(responses[0]).toEqual(
          expect.objectContaining({
            data: expect.objectContaining({ m_isHandcard: false }),
          }),
        );
      expect(game.cardZones.judgeA.cards).toEqual([1]);
    },
  );
  it("keeps captured moves/gates but observes shared judge mutation after a notification pause", () => {
    const state = setup();
    const { rules } = state;
    let { game, scheduler } = state;
    rules.operations = rules.operations!.map((operation) =>
      operation.name !== "notice"
        ? operation
        : {
            ...operation,
            run: ({ game, continuation }) => {
              if (continuation === null) {
                expect(game.judges.first.card).toEqual(card());
                return {
                  kind: "prompt",
                  actor: "b",
                  choices: ["go"],
                  canCancel: false,
                  continuation: true,
                };
              }
              game.judges.first.card = card("two", [2]);
              game.judges.first.who = "b";
              return { kind: "return", value: null };
            },
          },
    );
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "retrial", data: request() },
      "a",
    );
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    const view = getTriggerPrompt(scheduler, "b")!;
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: view.id,
        choice: "go",
      }),
    ).toBe(true);
    expect(game.cardZones.judgeA.cards).toEqual([1]);
    expect(game.cardZones.discard.cards).toEqual([3]);
    expect(game.judges.first.card).toEqual(card("two", [2]));
    expect(game.trace).toContainEqual({
      event: "CardResponded",
      target: "b",
      data: expect.objectContaining({
        m_card: card(),
        m_who: "b",
        m_isHandcard: true,
      }),
    });
  });
  it.each(["BeforeCardsMove", "CardsMoveOneTime", "CardResponded"])(
    "restores JSON at %s without duplicate replacement or accepting invalid replies",
    (pause) => {
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
        { name: "retrial", data: request(true) },
        "a",
      );
      let pauses = 0;
      while (scheduler.prompt) {
        expect(++pauses).toBeLessThan(4);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        const view = getTriggerPrompt(scheduler, "b")!,
          reply = { id: view.id, choice: "go" };
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
      expect(game.cardZones.judgeA.cards).toEqual([1]);
      expect(game.cardZones.handB.cards).toEqual([2, 3]);
      expect(game.cardZones.discard.cards).toEqual([]);
    },
  );
  it.each(["actor", "judge", "empty", "duplicate", "canonical", "location"])(
    "rejects malformed %s before eager judge replacement",
    (variant) => {
      const { game, rules, scheduler } = setup(
        variant === "canonical"
          ? { canonical: () => card("virtual", [1]) }
          : {},
      );
      const data = request();
      if (variant === "actor") data.actor = "unknown";
      if (variant === "judge") data.judge = "missing";
      if (variant === "empty") data.card = card("virtual", []);
      if (variant === "duplicate") data.card = card("old", [3]);
      if (variant === "location") game.cardZones.table.cards.push(1);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "retrial", data },
          "a",
        ),
      ).toThrow();
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it("returns immediately for null without reading or moving a judge", () => {
    const { game, rules, scheduler } = setup();
    delete game.judges.first;
    const before = structuredClone(game);
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "retrial", data: { ...request(), card: null } },
      "a",
    );
    expect(game).toEqual(before);
    expect(scheduler.operationCompletion?.value).toBeNull();
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "keeps eager canonical mutation when movement interrupts with %s",
    (reason) => {
      const { game, rules, scheduler } = setup();
      rules.skills.push({
        id: "interrupt",
        rule: true,
        priority: 50,
        events: ["BeforeCardsMove"],
        effect: () => ({ kind: "interrupt", reason }),
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "retrial", data: request() },
        "a",
      );
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(game.judges.first.card).toEqual(card());
      expect(game.cardZones.judgeA.cards).toEqual([3]);
      expect(game.cardZones.handB.cards).toEqual([1, 2]);
    },
  );
  it.each([false, true])(
    "replaces the canonical judge and moves the old card with exchange=%s",
    (exchange) => {
      const { game, rules, scheduler } = setup();
      expect(
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "retrial", data: request(exchange) },
          "a",
        ),
      ).toBe(true);
      expect(game.judges.first.card).toEqual(card());
      expect(game.cardZones.judgeA.cards).toEqual([1]);
      expect(game.cardZones.handB.cards).toEqual(exchange ? [2, 3] : [2]);
      expect(game.cardZones.discard.cards).toEqual(exchange ? [] : [3]);
      expect(game.judges.first.result).toBe("unknown");
    },
  );
});
describe("judge result cache", () => {
  it.each([true, false])(
    "computes the cache before applying negative=%s to isEffected",
    (negative) => {
      const { game, rules, scheduler } = setup();
      game.judges.first.negative = negative;
      expect(() => judgeIsGood(game.judges.first)).toThrow("unknown");
      rules.operations!.push(
        createJudgeResultOperation({
          matches: (_game, judge) => {
            expect(judge.who).toBe("a");
            expect(judge.pattern).toBe(".|red");
            expect(judge.card).toEqual(card("old", [3]));
            return true;
          },
        }),
      );
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "update-judge-result", data: { judge: "first" } },
        "a",
      );
      expect(game.judges.first.result).toBe("good");
      expect(judgeIsGood(game.judges.first)).toBe(true);
      expect(judgeIsEffected(game.judges.first)).toBe(!negative);
      expect(scheduler.operationCompletion?.value).toBe(!negative);
      game.judges.first.good = false;
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "update-judge-result", data: { judge: "first" } },
        "a",
      );
      expect(game.judges.first.result).toBe("bad");
      expect(judgeIsEffected(game.judges.first)).toBe(negative);
    },
  );
});
