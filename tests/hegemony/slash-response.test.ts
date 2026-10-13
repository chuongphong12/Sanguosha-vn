import { describe, expect, it } from "vitest";
import {
  createSlashEffectOperation,
  createSlashResultOperation,
  createJinkEffectOperation,
  type SlashGame,
  type SlashEffect,
  type SlashCard,
} from "../../src/game/hegemony/slash";
import {
  createSlashEffectedOperation,
  createSlashEffectedRule,
  createSlashProceedOperation,
  createSlashProceedRule,
} from "../../src/game/hegemony/slash-response";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerData,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";
import {
  createSlashOnUseOperation,
  createSlashOnEffectOperation,
} from "../../src/game/hegemony/slash";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardEffectOperation } from "../../src/game/hegemony/card-effect";
import {
  createCardEffectedOperation,
  createCardEffectedRule,
} from "../../src/game/hegemony/card-effected";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";

type Game = SlashGame & {
  seen: { name: string; target: string | null; data: TriggerData }[];
  requests: TriggerData[];
  replies: (SlashCard | null)[];
};
function card(reference: string): SlashCard {
  return {
    reference,
    card: {
      type: "basic",
      name: reference,
      className: reference === "slash" ? "Slash" : "Jink",
      skillName: "",
      materialIDs: [],
      flags: [],
    },
  };
}
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: true },
    playerFlags: { a: [], b: [], c: [] },
    playerMarks: { a: {}, b: {}, c: {} },
    cardZones: {},
    cardResources: {
      cards: Object.fromEntries(
        ["slash", "jink1", "jink2", "jink3"].map((reference) => [
          reference,
          {
            kind: "virtual" as const,
            key: reference,
            isSlash: reference === "slash",
            isNDTrick: false,
            flags: [],
            tags: {},
          },
        ]),
      ),
      playerTags: { a: {}, b: { Qinggang: ["slash", "slash"] }, c: {} },
      roomTags: {},
    },
    seen: [],
    requests: [],
    replies: [card("jink1"), card("jink2"), card("jink3")],
  };
}
function effect(count = 1): SlashEffect {
  return {
    from: "a",
    to: "b",
    slash: card("slash"),
    jink: null,
    jink_num: count,
    drank: 2,
    nature: "fire",
    nullified: false,
  };
}
function registry(): TriggerRegistry<Game> {
  return {
    version: "slash-response-ce4e62b",
    operations: [
      createSlashEffectOperation(),
      createSlashResultOperation(),
      createJinkEffectOperation({
        isJink: (_, value) => value.card.className === "Jink",
      }),
      createSlashEffectedOperation(),
      createSlashProceedOperation({
        ask: (request) => ({ name: "ask-jink", data: request }),
      }),
      {
        name: "ask-jink",
        run: ({ game, operation }) => {
          game.requests.push(operation.data);
          return { kind: "return", value: game.replies.shift() ?? null };
        },
      },
    ],
    skills: [
      createSlashEffectedRule(),
      createSlashProceedRule(),
      {
        id: "observe",
        events: [
          "SlashEffected",
          "SlashProceed",
          "JinkEffect",
          "SlashHit",
          "SlashMissed",
        ],
        priority: 10,
        record: ({ game, event }) => {
          game.seen.push(structuredClone(event));
        },
        effect: () => ({ kind: "done", value: false }),
      },
    ],
  };
}
function dispatch(
  game: Game,
  rules = registry(),
  data: TriggerData = effect(),
  name = "slash-effect",
) {
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  dispatchTriggerOperation(scheduler, game, rules, { name, data }, "a");
  return scheduler;
}
describe("Hegemony GameRule Slash responses", () => {
  it.each([null, "SlashProceed", "SlashMissed", "CardFinished"])(
    "composes real Slash use, target resources, effects, Jink material movement and finish cleanup: %s",
    (pause) => {
      let game = fixture();
      game.playerMarks.a.drank = 3;
      game.playerFlags.a = ["slashDisableExtraTarget"];
      game.cardZones = {
        handA: { owner: "a", place: "hand", cards: [1] },
        handB: { owner: "b", place: "hand", cards: [2] },
        table: { owner: null, place: "table", cards: [] },
        discard: { owner: null, place: "discard", cards: [] },
      };
      game.replies = [
        { ...card("jink1"), card: { ...card("jink1").card, materialIDs: [2] } },
      ];
      const rules = registry();
      const resources = { reference: () => "slash" };
      rules.operations!.push(
        createCardMovementOperation(),
        createSlashOnUseOperation({
          ...resources,
          repeatSlashCause: () => null,
        }),
        createCardOnUseOperation({
          tableZone: "table",
          discardZone: "discard",
        }),
        createCardUsedOperation({
          resources,
          use: (data) => ({ name: "card-use", data }),
        }),
        createCardUseOperation({
          ...resources,
          effect: (data) => ({ name: "card-effect", data }),
        }),
        createCardEffectOperation({ isSlash: () => true }),
        createCardEffectedOperation({
          isSlash: () => true,
          isTrick: () => false,
          cancel: () => {
            throw new Error("unused");
          },
          onEffect: (data) => ({ name: "slash-on-effect", data }),
        }),
        createSlashOnEffectOperation({ ...resources, nature: () => "fire" }),
      );
      rules.skills.push(
        createCardUsedRule(),
        createCardEffectedRule(),
        createCardFinishedRule(resources),
        {
          id: "observe-common",
          events: [
            "TargetSelected",
            "PreCardUsed",
            "CardFinished",
            "PostCardEffected",
          ],
          priority: 10,
          record: ({ game, event }) => {
            game.seen.push(structuredClone(event));
          },
          effect: () => ({ kind: "done", value: false }),
        },
      );
      rules.operations = rules.operations!.filter(
        (operation) => operation.name !== "ask-jink",
      );
      rules.operations.push({
        name: "ask-jink",
        run: ({ game, operation, continuation }) => {
          // This fixture adapter handles only physical movement, not the deferred response lifecycle.
          if (continuation === null) {
            game.requests.push(operation.data);
            return {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  moves: [
                    {
                      ids: [2],
                      to: "table",
                      open: true,
                      reason: { kind: "use", actor: "b" },
                    },
                  ],
                  forceVisible: true,
                },
              },
              continuation: 1,
            };
          }
          if (continuation === 1)
            return {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  moves: [
                    {
                      ids: [2],
                      to: "discard",
                      open: true,
                      reason: { kind: "use", actor: "b" },
                    },
                  ],
                  forceVisible: true,
                },
              },
              continuation: 2,
            };
          return { kind: "return", value: game.replies.shift() ?? null };
        },
      });
      if (pause)
        rules.skills.push({
          id: "pause-composition",
          events: [pause],
          priority: 5,
          rule: true,
          effect: ({ continuation }) =>
            continuation === null
              ? {
                  kind: "prompt",
                  actor: "b",
                  choices: ["continue"],
                  canCancel: false,
                  continuation: true,
                }
              : { kind: "done", value: false },
        });
      let scheduler = dispatch(
        game,
        rules,
        {
          from: "a",
          to: ["b"],
          card: { ...card("slash").card, materialIDs: [1] },
        },
        "slash-on-use",
      );
      if (pause) {
        const prompt = getTriggerPrompt(scheduler, "b")!;
        expect(prompt).not.toBeNull();
        expect(game.cardZones.table.cards).toEqual([1]);
        ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
        expect(
          resumeTriggerPrompt(scheduler, game, rules, "b", {
            id: prompt.id,
            choice: "continue",
          }),
        ).toBe(true);
      }
      expect(scheduler.frames).toEqual([]);
      expect(game.requests).toMatchObject([
        { data: { jink_num: 1, drank: 3, nature: "fire" } },
      ]);
      expect(game.seen.some((event) => event.name === "TargetSelected")).toBe(
        false,
      );
      expect(
        game.seen.filter((event) => event.name === "PreCardUsed"),
      ).toHaveLength(1);
      expect(
        game.seen.filter((event) => event.name === "CardFinished"),
      ).toHaveLength(1);
      expect(
        game.seen.filter((event) => event.name === "PostCardEffected"),
      ).toHaveLength(1);
      expect(
        game.seen.find((event) => event.name === "SlashMissed"),
      ).toMatchObject({
        target: "a",
        data: { to: "b", jink: { reference: "jink1" }, drank: 3 },
      });
      expect(game.playerMarks.a.drank).toBe(0);
      expect(game.cardResources!.cards.slash).toMatchObject({
        flags: [],
        tags: { drank: 3 },
      });
      expect(game.cardResources!.playerTags.a).not.toHaveProperty("Jink_slash");
      expect(game.cardZones.table.cards).toEqual([]);
      expect(game.cardZones.discard.cards).toEqual([1, 2]);
      expect(game.cardZones.handA.cards).toEqual([]);
      expect(game.cardZones.handB.cards).toEqual([]);
    },
  );
  it.each([0, 1, 2])(
    "stops immediately at the first missing Jink: %s",
    (index) => {
      const game = fixture();
      game.replies[index] = null;
      dispatch(game, registry(), effect(3));
      expect(game.requests).toHaveLength(index + 1);
      expect(
        game.seen.filter((event) => event.name === "JinkEffect"),
      ).toHaveLength(index);
      expect(game.seen.at(-1)).toMatchObject({
        name: "SlashHit",
        target: "a",
        data: { jink: null },
      });
      expect(game.cardResources!.playerTags.b.Qinggang).toEqual([
        "slash",
        "slash",
      ]);
    },
  );
  it.each([0, 1, 2])("stops on a consumed JinkEffect: %s", (index) => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "consume-jink",
      events: ["JinkEffect"],
      priority: 0,
      rule: true,
      effect: ({ game }) => ({
        kind: "done",
        value: game.requests.length === index + 1,
      }),
    });
    dispatch(game, rules, effect(3));
    expect(game.requests).toHaveLength(index + 1);
    expect(game.seen.at(-1)?.name).toBe("SlashHit");
  });
  it("uses ResponseNegated to fail without JinkEffect or further asks", () => {
    const game = fixture();
    Object.assign(game.cardResources!.cards.jink2, {
      tags: { ResponseNegated: true },
    });
    dispatch(game, registry(), effect(3));
    expect(game.requests).toHaveLength(2);
    expect(game.seen.map((event) => event.name)).toEqual([
      "SlashEffected",
      "SlashProceed",
      "JinkEffect",
      "SlashHit",
    ]);
  });
  it.each([false, true])(
    "checks alive once before asking; Room gates only failed hits later: %s",
    (success) => {
      const game = fixture();
      if (!success) game.replies[2] = null;
      const rules = registry();
      rules.skills.push({
        id: "kill",
        events: ["JinkEffect"],
        priority: 0,
        rule: true,
        effect: ({ game, event }) => {
          game.alive.b = false;
          event.data = null;
          return { kind: "done", value: false };
        },
      });
      dispatch(game, rules, effect(3));
      expect(game.requests).toHaveLength(3);
      expect(
        game.seen
          .filter((event) => ["SlashHit", "SlashMissed"].includes(event.name))
          .map((event) => event.name),
      ).toEqual(success ? ["SlashMissed"] : []);
    },
  );
  it.each([1, 3, 0])(
    "dead recipient never answers at GameRule entry: %s",
    (count) => {
      const game = fixture();
      game.alive.b = false;
      dispatch(game, registry(), effect(count));
      expect(game.requests).toEqual([]);
      expect(
        game.seen.some(
          (event) => event.name === "SlashHit" || event.name === "SlashMissed",
        ),
      ).toBe(false);
    },
  );
  it("consumes nullified before SlashProceed and lets Room clear only its original flag/tag", () => {
    const game = fixture();
    game.playerFlags.b = ["Global_NonSkillNullify", "keep"];
    const data = effect(3);
    data.nullified = true;
    dispatch(game, registry(), data);
    expect(game.requests).toEqual([]);
    expect(game.seen.map((event) => event.name)).toEqual(["SlashEffected"]);
    expect(game.playerFlags.b).toEqual(["keep"]);
    expect(game.cardResources!.playerTags.b.Qinggang).toEqual(["slash"]);
  });
  it("reads latest SlashEffected data before rule and latest SlashProceed data before its rule", () => {
    const game = fixture();
    const rules = registry();
    rules.skills.push({
      id: "rewrite",
      events: ["SlashEffected", "SlashProceed"],
      priority: 0,
      triggerable: ({ event }) => [
        {
          actor: "a",
          owner: "a",
          slot: "head",
          target: null,
          occurrence: event.name,
          compulsory: true,
          global: true,
          shown: true,
        },
      ],
      effect: ({ event }) => {
        Object.assign(
          event.data!,
          event.name === "SlashEffected"
            ? { to: "c", from: "b", jink_num: 3 }
            : { jink_num: 1, drank: 9, nature: "thunder" },
        );
        return { kind: "done", value: false };
      },
    });
    dispatch(game, rules);
    expect(game.requests).toMatchObject([
      {
        target: "c",
        source: "b",
        pattern: "jink",
        method: "use",
        prompt: "slash-jink:b",
        data: { to: "c", from: "b", jink_num: 1, drank: 9, nature: "thunder" },
      },
    ]);
    expect(game.seen.at(-1)).toMatchObject({
      name: "SlashMissed",
      target: "b",
      data: { to: "c" },
    });
    expect(game.cardResources!.playerTags.b.Qinggang).toEqual([
      "slash",
      "slash",
    ]);
  });
  it.each(["SlashEffected", "SlashProceed"])(
    "honors consumption before the selected GameRule: %s",
    (name) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "consume",
        events: [name],
        priority: 1,
        rule: true,
        effect: ({ event }) => {
          event.data = null;
          return { kind: "done", value: true };
        },
      });
      dispatch(game, rules);
      expect(game.requests).toEqual([]);
      expect(
        game.seen.some(
          (event) => event.name === "SlashHit" || event.name === "SlashMissed",
        ),
      ).toBe(false);
      expect(game.cardResources!.playerTags.b.Qinggang).toEqual(
        name === "SlashEffected" ? ["slash"] : ["slash", "slash"],
      );
    },
  );
  it("copies the ask descriptor input, keeping the captured local effect through responses", () => {
    const game = fixture();
    const rules = registry();
    rules.operations = rules.operations!.filter(
      (operation) => operation.name !== "slash-proceed",
    );
    rules.operations.push(
      createSlashProceedOperation({
        ask: (request) => {
          const data = structuredClone(request);
          request.target = "c";
          request.data.to = "c";
          request.data.jink_num = 100;
          return { name: "ask-jink", data };
        },
      }),
    );
    dispatch(game, rules, effect(3));
    expect(game.requests).toHaveLength(3);
    expect(game.requests).toMatchObject([
      { target: "b", data: { to: "b", jink_num: 3 } },
      { target: "b" },
      { target: "b" },
    ]);
    expect(game.seen.at(-1)).toMatchObject({ data: { to: "b", jink_num: 3 } });
  });
  it.each([
    "ask-1",
    "ask-2",
    "ask-3",
    "SlashEffected",
    "SlashProceed",
    "JinkEffect",
    "SlashHit",
    "SlashMissed",
  ])("reloads and resumes exactly once at %s", (pause) => {
    let game = fixture();
    if (pause === "SlashHit") game.replies = [null];
    const rules = registry();
    let paused = false;
    if (pause.startsWith("ask")) {
      const index = Number(pause.split("-")[1]);
      rules.operations = rules.operations!.filter(
        (operation) => operation.name !== "ask-jink",
      );
      rules.operations.push({
        name: "ask-jink",
        run: ({ game, operation, continuation }) => {
          if (continuation === null && game.requests.length + 1 === index)
            return {
              kind: "prompt",
              actor: "b",
              choices: ["respond"],
              canCancel: false,
              continuation: true,
            };
          game.requests.push(operation.data);
          return { kind: "return", value: game.replies.shift() ?? null };
        },
      });
    } else
      rules.skills.push({
        id: "pause",
        events: [pause],
        priority: 5,
        rule: true,
        effect: ({ continuation }) => {
          if (continuation === null && !paused) {
            paused = true;
            return {
              kind: "prompt",
              actor: "b",
              choices: ["continue"],
              canCancel: false,
              continuation: true,
            };
          }
          return { kind: "done", value: false };
        },
      });
    let scheduler = dispatch(game, rules, effect(3));
    const prompt = getTriggerPrompt(scheduler, "b")!;
    expect(prompt).not.toBeNull();
    const before = structuredClone({ game, scheduler });
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "a", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      }),
    ).toBe(false);
    expect({ game, scheduler }).toEqual(before);
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: "stale",
        choice: prompt.choices[0].id,
      }),
    ).toBe(false);
    expect({ game, scheduler }).toEqual(before);
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      }),
    ).toBe(true);
    expect(scheduler.frames).toEqual([]);
    expect(game.requests).toHaveLength(pause === "SlashHit" ? 1 : 3);
    expect(
      game.seen.filter(
        (event) => event.name === "SlashHit" || event.name === "SlashMissed",
      ),
    ).toHaveLength(1);
    expect(game.cardResources!.playerTags.b.Qinggang).toEqual(
      pause === "SlashHit" ? ["slash", "slash"] : ["slash"],
    );
    const after = structuredClone({ game, scheduler });
    expect(
      resumeTriggerPrompt(scheduler, game, rules, "b", {
        id: prompt.id,
        choice: prompt.choices[0].id,
      }),
    ).toBe(false);
    expect({ game, scheduler }).toEqual(after);
  });
  it.each(["turn-broken", "stage-change", "game-over"] as const)(
    "freezes eager state at a response interruption: %s",
    (reason) => {
      const game = fixture();
      const rules = registry();
      rules.skills.push({
        id: "interrupt",
        events: ["JinkEffect"],
        priority: 5,
        rule: true,
        effect: () => ({ kind: "interrupt", reason }),
      });
      const scheduler = dispatch(game, rules, effect(3));
      expect(scheduler.interruption?.reason).toBe(reason);
      expect(scheduler.frames.length).toBeGreaterThan(0);
      expect(scheduler.operationCompletion).toBeNull();
      expect(game.requests).toHaveLength(1);
      expect(game.cardResources!.playerTags.b.Qinggang).toEqual([
        "slash",
        "slash",
      ]);
      expect(
        game.seen.some(
          (event) => event.name === "SlashHit" || event.name === "SlashMissed",
        ),
      ).toBe(false);
    },
  );
  it.each([
    null,
    { from: null },
    { jink_num: 1.5 },
    { drank: "2" },
    { nature: "ice" },
    { nature: ["normal"] },
    { to: "unknown" },
  ])(
    "rejects malformed standalone Proceed before state allocation: %j",
    (patch) => {
      const game = fixture();
      const rules = registry();
      const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
      const before = structuredClone({ game, scheduler });
      expect(() =>
        dispatchTriggerOperation(
          scheduler,
          game,
          rules,
          {
            name: "slash-proceed",
            data: patch === null ? null : { ...effect(), ...patch },
          },
          "a",
        ),
      ).toThrow();
      expect({ game, scheduler }).toEqual(before);
    },
  );
  it.each([0, -2, 1, 3])(
    "orchestrates hit or Jinks in native order: %s",
    (count) => {
      const game = fixture();
      dispatch(game, registry(), effect(count));
      expect(
        game.requests.map((request) => (request as { prompt: string }).prompt),
      ).toEqual(
        count <= 0
          ? []
          : count === 1
            ? ["slash-jink:a"]
            : [
                "@multi-jink-start:a::3",
                "@multi-jink:a::2",
                "@multi-jink:a::1",
              ],
      );
      expect(game.seen.map((event) => event.name)).toEqual(
        count <= 0
          ? ["SlashEffected", "SlashHit"]
          : [
              "SlashEffected",
              "SlashProceed",
              ...Array(count).fill("JinkEffect"),
              "SlashMissed",
            ],
      );
      expect(game.seen.at(-1)).toMatchObject({
        target: "a",
        data: { jink: count <= 0 ? null : { reference: `jink${count}` } },
      });
      expect(game.cardResources!.playerTags.b.Qinggang).toEqual(
        count <= 0 ? ["slash", "slash"] : ["slash"],
      );
    },
  );
});
