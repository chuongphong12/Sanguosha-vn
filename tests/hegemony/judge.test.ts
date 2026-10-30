import { describe, expect, it } from "vitest";
import {
  createRoomJudgeOperation,
  createStartJudgeOperation,
  createFinishRetrialOperation,
  createFinishJudgeOperation,
  createJudgeRules,
  type JudgeGame,
  type JudgeRules,
} from "../../src/game/hegemony/judge";
import {
  createJudgeResultOperation,
  createRetrialOperation,
  type JudgeState,
  readJudge,
} from "../../src/game/hegemony/retrial";
import {
  createDrawCardOperation,
  createSwapPileOperation,
  type DrawPileGame,
} from "../../src/game/hegemony/draw-pile";
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
import { createRetrialSkill } from "../../src/game/hegemony/retrial-skill";

function isRecord(value: TriggerData): value is Record<string, TriggerData> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

type Game = JudgeGame &
  DrawPileGame & { trace: TriggerData[]; catalog: Record<number, SlashCard> };
const card = (id: number): SlashCard => ({
  reference: String(id),
  card: {
    type: "basic",
    name: "jink",
    className: "Jink",
    skillName: "",
    materialIDs: [id],
    flags: [],
  },
});
function setup() {
  const game: Game = {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    playerFlags: { a: [], b: [], c: [] },
    playerMarks: {},
    removed: {},
    hp: {},
    chained: {},
    currentPlayer: "b",
    damageStack: [],
    cardResources: {
      cards: Object.fromEntries(
        [0, 1, 2].map((id) => [
          String(id),
          {
            kind: "wrapped",
            key: String(id),
            id,
            isSlash: false,
            isNDTrick: false,
          },
        ]),
      ),
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    wrappedCards: Object.fromEntries(
      [0, 1, 2].map((id) => [
        id,
        {
          name: "jink",
          className: "Jink",
          suit: id === 1 ? "spade" : "heart",
          number: id + 1,
          skillName: "",
          modified: false,
          flags: [],
          tags: {},
        },
      ]),
    ),
    cardZones: {
      draw: { owner: null, place: "draw", cards: [0, 2] },
      reserved: { owner: null, place: "draw", cards: [] },
      discard: { owner: null, place: "discard", cards: [] },
      table: { owner: null, place: "table", cards: [] },
      handA: { owner: "a", place: "hand", cards: [] },
      handB: { owner: "b", place: "hand", cards: [1] },
      handC: { owner: "c", place: "hand", cards: [] },
      judgeA: { owner: "a", place: "judge", cards: [] },
      judgeB: { owner: "b", place: "judge", cards: [] },
      judgeC: { owner: "c", place: "judge", cards: [] },
    },
    judges: {
      first: {
        who: "a",
        card: null,
        pattern: ".|red",
        patterns: [],
        good: true,
        reason: "lightning",
        time_consuming: false,
        negative: false,
        play_animation: true,
        result: "unknown",
      },
    },
    pileRandom: { algorithm: "mulberry32-v1", state: 1 },
    trace: [],
    catalog: { 0: card(0), 1: card(1), 2: card(2) },
  };
  const matches = (game: Readonly<Game>, judge: Readonly<JudgeState>) =>
    judge.pattern === "." ||
    (judge.pattern === ".|red"
      ? game.wrappedCards![judge.card.card.materialIDs[0]].suit === "heart"
      : game.wrappedCards![judge.card.card.materialIDs[0]].suit === "spade");
  const policy: JudgeRules<Game> = {
    discardZone: "discard",
    canonical: (game, id) => game.catalog[id],
    matches,
    notify: (notice) => ({ name: "notice", data: notice }),
  };
  const rules: TriggerRegistry<Game> = {
    version: "judge-ce4e62b",
    skills: [
      {
        id: "observer",
        priority: 20,
        rule: true,
        events: [
          "StartJudge",
          "FetchDrawPileCard",
          "AskForRetrial",
          "FinishRetrial",
          "FinishJudge",
          "BeforeCardsMove",
          "CardResponded",
        ],
        effect: ({ game, event }) => {
          game.trace.push({ ...structuredClone(event) });
          return { kind: "done", value: false };
        },
      },
    ],
    operations: [
      createRoomJudgeOperation(policy),
      createStartJudgeOperation(policy),
      createFinishRetrialOperation(policy),
      createFinishJudgeOperation(policy),
      createDrawCardOperation({
        drawZone: "draw",
        reservedZone: "reserved",
        discardZone: "discard",
        notify: (notice) => ({ name: "notice", data: notice }),
      }),
      createSwapPileOperation({
        drawZone: "draw",
        reservedZone: "reserved",
        discardZone: "discard",
        notify: (notice) => ({ name: "notice", data: notice }),
      }),
      createCardMovementOperation(),
      createJudgeResultOperation({ matches }),
      {
        name: "notice",
        run: ({ game, operation }) => {
          game.trace.push(operation.data);
          return { kind: "return", value: null };
        },
      },
    ],
  };
  rules.skills.push(...createJudgeRules<Game>());
  return {
    game,
    rules,
    matches,
    policy,
    scheduler: createTriggerScheduler(game.seatOrder, rules.version),
  };
}
function installRetrial(
  state: ReturnType<typeof setup>,
  skill: "guicai" | "guidao",
) {
  const { rules, policy } = state;
  const resolve = (game: Readonly<Game>, response: SlashCard) =>
    game.catalog[response.card.materialIDs[0]];
  rules.operations!.push(
    createRetrialOperation({
      discardZone: "discard",
      canonical: policy.canonical,
      resolve,
      notify: (notice) => ({ name: "notice", data: notice }),
    }),
    createAskCardResponseOperation({
      tableZone: "table",
      discardZone: "discard",
      isAI: () => false,
      request: (request) => ({ name: "request-card", data: request }),
      limited: () => false,
      validateResponse: (_actor, card) => ({
        name: "validate-card",
        data: card,
      }),
      resolve,
      notify: (notice) => ({ name: "notice", data: notice }),
      reveal: () => {
        throw new Error("Unexpected ordinary reveal");
      },
      moveReason: () => {
        throw new Error("Unexpected ordinary payment");
      },
      validateInResponseAfter: () => {
        throw new Error("Unexpected response-after");
      },
    }),
    {
      name: "request-card",
      run: ({ game, operation, continuation }) => {
        if (continuation === null) {
          game.trace.push({ kind: "request", request: operation.data });
          return {
            kind: "prompt",
            actor: "b",
            choices: ["card"],
            canCancel: true,
            continuation: true,
          };
        }
        return { kind: "return", value: card(1) };
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
      eligible: (_game, actor) =>
        actor === "b" ? { slot: "head", shown: true } : null,
      resolve,
      notify: (notice) => ({
        name: "notice",
        data: { kind: "skill", ...notice },
      }),
      reveal: (actor, skill) => ({
        name: "notice",
        data: { kind: "reveal", actor, skill },
      }),
      serialize: (_game, response) => JSON.stringify(response),
      parse: (_game, text) => JSON.parse(text),
    }),
  );
}
describe("Room judgment", () => {
  it("logs the original cached result even if FinishJudge clears its card", () => {
    const { game, scheduler, rules } = setup();
    rules.skills.push({
      id: "clear-after-disposal",
      priority: -10,
      rule: true,
      events: ["FinishJudge"],
      effect: ({ game }) => {
        game.judges.first.card = null;
        return { kind: "done", value: false };
      },
    });
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "judge", data: { judge: "first" } },
        "a",
      ),
    ).toBe(true);
    expect(game.judges.first.card).toBeNull();
    expect(game.cardZones.discard.cards).toEqual([0]);
    expect(game.trace.at(-1)).toEqual({
      kind: "judge-effected",
      who: "a",
      reason: "lightning",
    });
  });
  it("resolves the judgment owner after Fetch and preserves native initial log timing", () => {
    const { game, scheduler, rules } = setup();
    rules.skills.push({
      id: "fetch-owner",
      priority: 10,
      rule: true,
      events: ["FetchDrawPileCard"],
      effect: ({ game }) => {
        game.judges.first.who = "b";
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    expect(game.trace).toContainEqual({
      kind: "initial-judge",
      who: "b",
      id: 0,
    });
    expect(game.trace).toContainEqual({
      name: "FinishJudge",
      target: "b",
      data: { judge: "first" },
    });
  });
  it("uses the captured judgment's latest card after initial log delivery", () => {
    const { game, scheduler, rules } = setup();
    rules.operations = rules.operations!.filter((op) => op.name !== "notice");
    rules.operations.push({
      name: "notice",
      run: ({ game, operation }) => {
        game.trace.push(operation.data);
        if (isRecord(operation.data) && operation.data.kind === "initial-judge")
          game.judges.first.card = card(2);
        return { kind: "return", value: null };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    expect(game.trace).toContainEqual({
      kind: "initial-judge",
      who: "a",
      id: 0,
    });
    expect(game.cardZones.discard.cards).toEqual([2]);
    expect(game.cardZones.reserved.cards).toEqual([0]);
  });
  it.each([
    "initial-judge",
    "judge-result",
    "judge-animation",
    "judge-delay",
    "judge-effected",
  ])("resumes %s delivery exactly once", (pause) => {
    const state = setup(),
      { rules } = state;
    let { game, scheduler } = state;
    rules.operations = rules.operations!.filter((op) => op.name !== "notice");
    rules.operations.push({
      name: "notice",
      run: ({ game, operation, continuation }) => {
        if (
          isRecord(operation.data) &&
          operation.data.kind === pause &&
          continuation === null
        )
          return {
            kind: "prompt",
            actor: "a",
            choices: ["go"],
            canCancel: false,
            continuation: true,
          };
        game.trace.push(operation.data);
        return { kind: "return", value: null };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    const reply = { id: getTriggerPrompt(scheduler, "a")!.id, choice: "go" };
    expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(true);
    expect(resumeTriggerPrompt(scheduler, game, rules, "a", reply)).toBe(false);
    expect(
      game.trace.filter(isRecord).filter((entry) => entry.kind === pause),
    ).toHaveLength(1);
    expect(game.cardZones.discard.cards).toEqual([0]);
    expect(game.cardResources.roomTags.judge).toBe(0);
  });
  it.each([
    ["FetchDrawPileCard", 1],
    ["FinishRetrial", 1],
    ["FinishJudge", 0],
  ] as const)(
    "retains eager judge counter on interruption at %s",
    (pause, count) => {
      const { game, scheduler, rules } = setup();
      rules.skills.push({
        id: "interrupt",
        priority: 50,
        rule: true,
        events: [pause],
        effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "judge", data: { judge: "first" } },
        "a",
      );
      expect(scheduler.interruption?.reason).toBe("turn-broken");
      expect(game.cardResources.roomTags.judge).toBe(count);
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(
        game.trace
          .filter(isRecord)
          .filter((entry) => entry.kind === "judge-effected"),
      ).toEqual([]);
    },
  );
  it.each(["missing", "bad-who", "invalid-cache"])(
    "rejects %s judgment before allocating frames or tags",
    (fault) => {
      const { game, scheduler, rules } = setup();
      if (fault === "bad-who") game.judges.first.who = "missing";
      if (fault === "invalid-cache")
        Object.assign(game.judges.first, { result: "invalid" });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          {
            name: "judge",
            data: { judge: fault === "missing" ? "absent" : "first" },
          },
          "a",
        ),
      ).toThrow();
      expect(scheduler.frames).toEqual([]);
      expect(game.cardResources.roomTags.judge).toBeUndefined();
    },
  );
  it.each(["guicai", "guidao"] as const)(
    "runs actual %s acquisition, cost, reveal, replacement and result from a pending judgment",
    (skill) => {
      const state = setup(),
        { rules } = state;
      let { game, scheduler } = state;
      installRetrial(state, skill);
      expect(
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          { name: "judge", data: { judge: "first" } },
          "a",
        ),
      ).toBe(true);
      let count = 0;
      while (scheduler.prompt) {
        expect(++count).toBeLessThan(8);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        const view = getTriggerPrompt(scheduler, "b")!;
        expect(view).not.toBeNull();
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: view.id,
            choice: view.choices[0].id,
          }),
        ).toBe(true);
      }
      expect(count).toBeGreaterThan(0);
      expect(game.judges.first.card).toEqual(card(1));
      expect(game.judges.first.result).toBe("bad");
      expect(game.cardZones.handB.cards).toEqual(skill === "guidao" ? [0] : []);
      expect(game.cardZones.discard.cards).toEqual(
        skill === "guidao" ? [1] : [1, 0],
      );
      expect(game.cardZones.table.cards).toEqual([]);
      expect(game.cardZones.reserved.cards).toEqual([]);
      expect(game.cardResources.roomTags.judge).toBe(0);
      expect(
        game.trace.filter(isRecord).filter((entry) => entry.kind === "reveal"),
      ).toEqual([{ kind: "reveal", actor: "b", skill }]);
      expect(
        game.trace
          .filter(isRecord)
          .filter((entry) => entry.name === "CardResponded"),
      ).toHaveLength(1);
      expect(game.cardResources.playerTags.b[`${skill}_cards`]).toEqual([]);
    },
  );
  it("preserves nested judgment counters and distinct reservations during initial logging", () => {
    const { game, scheduler, rules } = setup();
    game.judges.second = { ...structuredClone(game.judges.first), who: "b" };
    const tags: number[] = [];
    rules.operations = rules.operations!.filter((op) => op.name !== "notice");
    rules.operations.push({
      name: "notice",
      run: ({ game, operation, continuation }) => {
        if (continuation === null) {
          game.trace.push(operation.data);
          tags.push(Number(game.cardResources.roomTags.judge));
          if (
            isRecord(operation.data) &&
            operation.data.kind === "initial-judge" &&
            operation.data.id === 0
          )
            return {
              kind: "operation",
              operation: { name: "judge", data: { judge: "second" } },
              continuation: true,
            };
        }
        return { kind: "return", value: null };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    expect(game.judges.first.card).toEqual(card(0));
    expect(game.judges.second.card).toEqual(card(2));
    expect(game.cardZones.discard.cards).toEqual([0, 2]);
    expect(game.cardResources.roomTags.judge).toBe(0);
    expect(tags).toContain(2);
    expect(tags.at(-1)).toBe(0);
  });
  it("continues after consumed start and finish events using the latest counter value", () => {
    const { game, scheduler, rules } = setup();
    Object.assign(game.judges.first, { card: card(0), result: "good" });
    rules.skills.push({
      id: "consume",
      priority: 10,
      rule: true,
      events: ["StartJudge", "FinishRetrial", "FinishJudge"],
      effect: ({ game, event }) => {
        if (event.name === "FinishRetrial")
          game.cardResources.roomTags.judge = 8;
        if (event.name === "FinishJudge")
          expect(game.cardResources.roomTags.judge).toBe(7);
        return { kind: "done", value: true };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    expect(game.cardZones.draw.cards).toEqual([0, 2]);
    expect(game.trace.at(-1)).toEqual({
      kind: "judge-effected",
      who: "a",
      reason: "lightning",
    });
    expect(
      game.trace
        .filter(isRecord)
        .filter((entry) => entry.name === "AskForRetrial"),
    ).toHaveLength(3);
  });
  it("turns a pending judgment into a real drawn, evaluated and disposed card", () => {
    const { game, scheduler, rules } = setup();
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "judge", data: { judge: "first" } },
        "a",
      ),
    ).toBe(true);
    expect(game.judges.first.card).toEqual(card(0));
    expect(game.judges.first.result).toBe("good");
    expect(game.cardZones.reserved.cards).toEqual([]);
    expect(game.cardZones.discard.cards).toEqual([0]);
    expect(game.cardResources.roomTags.judge).toBe(0);
  });
  it("keeps the existing retrial reader strict for pending judgments", () => {
    const { game } = setup();
    expect(() => readJudge(game, "first")).toThrow("ready card");
  });
  it("emits the native event order and JUDGE/JUDGEDONE reason metadata", () => {
    const { game, scheduler, rules } = setup();
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    const events = game.trace
      .filter(isRecord)
      .filter((entry) => "name" in entry);
    expect(
      events
        .filter((entry) => entry.name !== "BeforeCardsMove")
        .map((entry) => [entry.name, entry.target]),
    ).toEqual([
      ["StartJudge", "a"],
      ["FetchDrawPileCard", null],
      ["AskForRetrial", "b"],
      ["AskForRetrial", "c"],
      ["AskForRetrial", "a"],
      ["FinishRetrial", "a"],
      ["FinishJudge", "a"],
    ]);
    const moves = events.filter((entry) => entry.name === "BeforeCardsMove");
    expect(moves[0]).toMatchObject({
      data: {
        moves: [
          {
            ids: [0],
            fromPlaces: ["draw"],
            toPlace: "judge",
            reason: {
              kind: "judge",
              actor: "a",
              skill: "",
              eventName: "lightning",
            },
          },
        ],
      },
    });
    expect(moves.at(-1)).toMatchObject({
      data: {
        moves: [
          {
            ids: [0],
            toPlace: "discard",
            reason: {
              kind: "judgedone",
              actor: "a",
              skill: "",
              eventName: "lightning",
            },
          },
        ],
      },
    });
    expect(
      game.trace.filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          "kind" in entry,
      ),
    ).toEqual([
      { kind: "initial-judge", who: "a", id: 0 },
      { kind: "judge-result", who: "a", id: 0 },
      {
        kind: "judge-animation",
        judge: "first",
        who: "a",
        id: 0,
        reason: "lightning",
        effected: true,
      },
      { kind: "judge-delay" },
      { kind: "judge-effected", who: "a", reason: "lightning" },
    ]);
  });
  it.each([true, false])(
    "handles Luoshen cached good=%s independently of negative",
    (good) => {
      const { game, scheduler, rules } = setup();
      Object.assign(game.judges.first, {
        reason: "luoshen",
        good,
        negative: true,
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "judge", data: { judge: "first" } },
        "a",
      );
      expect(game.cardZones.judgeA.cards).toEqual(good ? [0] : []);
      expect(game.cardZones.discard.cards).toEqual(good ? [] : [0]);
      expect(game.trace.at(-1)).toMatchObject({
        kind: good ? "judge-failure" : "judge-effected",
      });
    },
  );
  it("selects the first matching pattern for the event player without recomputing cache", () => {
    const { game, scheduler, rules, policy } = setup();
    policy.matches = (_game, judge) =>
      judge.who === "b" && judge.pattern === ".";
    Object.assign(game.judges.first, {
      card: card(0),
      patterns: ["never", ".", ".|red"],
      pattern: ".|black",
      result: "bad",
      play_animation: false,
    });
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "FinishRetrial", target: "b", data: { judge: "first" } },
      "a",
    );
    expect(game.judges.first.pattern).toBe(".");
    expect(game.judges.first.result).toBe("bad");
    expect(game.trace.at(-1)).toEqual({
      kind: "judge-result",
      who: "b",
      id: 0,
    });
  });
  it("does not discard a judgment card already obtained by a skill", () => {
    const { game, scheduler, rules } = setup();
    rules.skills.push({
      id: "obtain",
      priority: 10,
      rule: true,
      events: ["FinishJudge"],
      effect: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  moves: [
                    {
                      ids: [0],
                      to: "handB",
                      reason: { kind: "gotcard", actor: "b" },
                    },
                  ],
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
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    expect(game.cardZones.handB.cards).toEqual([1, 0]);
    expect(game.cardZones.discard.cards).toEqual([]);
  });
  it("captures retrial players after StartJudge and does not recheck dead actors", () => {
    const { game, scheduler, rules } = setup();
    rules.skills.push({
      id: "change-seats",
      priority: 10,
      rule: true,
      events: ["StartJudge", "AskForRetrial"],
      effect: ({ game, event }) => {
        if (event.name === "StartJudge") {
          game.currentPlayer = "c";
          game.alive.a = false;
        }
        if (event.name === "AskForRetrial" && event.target === "c")
          game.alive.b = false;
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    expect(
      game.trace
        .filter(isRecord)
        .filter(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            !Array.isArray(entry) &&
            entry.name === "AskForRetrial",
        )
        .map((entry) => entry.target),
    ).toEqual(["c", "b"]);
  });
  it("breaks only the actor iteration when AskForRetrial is consumed", () => {
    const { game, scheduler, rules } = setup();
    rules.skills.push({
      id: "stop",
      priority: 10,
      rule: true,
      events: ["AskForRetrial"],
      effect: () => ({ kind: "done", value: true }),
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    expect(
      game.trace.filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          entry.name === "AskForRetrial",
      ),
    ).toHaveLength(1);
    expect(game.cardZones.discard.cards).toEqual([0]);
  });
  it("keeps owner identity separate from rewritten event judgment identity", () => {
    const { game, scheduler, rules } = setup();
    game.judges.second = { ...structuredClone(game.judges.first), who: "b" };
    game.judges.first.play_animation = false;
    rules.skills.push({
      id: "redirect",
      priority: 10,
      rule: true,
      events: ["StartJudge"],
      effect: ({ game, event }) => {
        event.data = { judge: "second" };
        game.judges.first.who = "c";
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "judge", data: { judge: "first" } },
      "a",
    );
    expect(game.judges.first.card).toBeNull();
    expect(game.judges.second.card).toEqual(card(0));
    expect(game.trace).toContainEqual({
      name: "FinishRetrial",
      target: "c",
      data: { judge: "second" },
    });
    expect(game.trace).toContainEqual({
      name: "FinishJudge",
      target: "c",
      data: { judge: "second" },
    });
    expect(game.trace).toContainEqual({
      kind: "judge-result",
      who: "c",
      id: 0,
    });
    expect(
      game.trace.filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          entry.kind === "judge-effected",
      ),
    ).toEqual([]);
  });
  it("clears SkipGameRule before the null-target guard", () => {
    const { game, scheduler, rules } = setup();
    game.cardResources.roomTags.SkipGameRule = true;
    dispatchTriggerEvent(
      scheduler,
      game,
      rules,
      { name: "StartJudge", target: null, data: null },
      null,
    );
    expect(game.cardResources.roomTags.SkipGameRule).toBeUndefined();
    expect(game.cardZones.draw.cards).toEqual([0, 2]);
  });
  it.each([
    "FetchDrawPileCard",
    "BeforeCardsMove",
    "AskForRetrial",
    "FinishRetrial",
    "FinishJudge",
  ])("restores JSON during %s without duplicate effects", (pause) => {
    const state = setup(),
      { rules } = state;
    let { game, scheduler } = state;
    rules.skills.push({
      id: "pause",
      priority: 50,
      rule: true,
      events: [pause],
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
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "judge", data: { judge: "first" } },
        "a",
      ),
    ).toBe(true);
    let count = 0;
    while (scheduler.prompt) {
      expect(++count).toBeLessThan(15);
      ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
      const reply = { id: getTriggerPrompt(scheduler, "a")!.id, choice: "go" };
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
    expect(game.cardZones.draw.cards).toEqual([2]);
    expect(game.cardZones.discard.cards).toEqual([0]);
    expect(game.cardResources.roomTags.judge).toBe(0);
  });
});
