import { describe, expect, it } from "vitest";
import {
  createHegemonyMatch,
  type HegemonyMatch,
  type MatchContent,
} from "../../src/game/hegemony/match";
import { createDamageDoneOperation } from "../../src/game/hegemony/damage-rule";
import { createLuckCardOperation } from "../../src/game/hegemony/luck-cards";
import { createLuckTransferOperation } from "../../src/game/hegemony/luck-transfer";

function fixture(
  count = 2,
  configure?: (rules: Parameters<typeof createHegemonyMatch>[0]) => void,
) {
  const players = Array.from({ length: count }, (_, i) => String(i));
  const content: MatchContent = {
    version: "INTERNAL-match-test-v1",
    generals: players.flatMap((p) => [
      { id: `${p}-head`, kingdoms: ["wei"], headMaxHp: 4, deputyMaxHp: 4 },
      { id: `${p}-deputy`, kingdoms: ["wei"], headMaxHp: 3, deputyMaxHp: 3 },
    ]),
    companions: [["0-head", "0-deputy"]] satisfies [string, string][],
    cards: Array.from({ length: count * 4 + 4 }, (_, id) => ({
      id,
      face: {
        name: "jink",
        className: "Jink",
        suit: "heart",
        number: (id % 13) + 1,
        skillName: "",
      },
      isSlash: false,
      isNDTrick: false,
    })),
  };
  const rules: Parameters<typeof createHegemonyMatch>[0] = {
    content,
    registryVersion: "INTERNAL-match-registry-v1",
    startup: {
      settings: {
        image: false,
        viewDeputy: false,
        mode: "hegemony",
        luckLimit: 0,
      },
      visibleSkills: () => [],
      hasLordSkill: () => false,
    },
  };
  configure?.(rules);
  const module = createHegemonyMatch(rules);
  const state = module.create({
    offers: Object.fromEntries(
      players.map((p) => [p, [`${p}-head`, `${p}-deputy`]]),
    ),
    drawPile: content.cards.map((c) => c.id),
    randomState: 1,
  });
  return { module, state, players, content };
}

function chooseAll(f: ReturnType<typeof fixture>): HegemonyMatch {
  let state = f.state;
  for (const actor of f.players) {
    const next = f.module.apply(state, actor, {
      kind: "choose-pair",
      choice: { head: `${actor}-head`, deputy: `${actor}-deputy` },
    });
    if (!next) throw new Error("Expected accepted selection");
    state = next;
  }
  return state;
}

describe("internal Quốc Chiến match authority", () => {
  it.each(["replace", "keep"])(
    "resumes real luck (%s) through an explicit collection adapter",
    (decision) => {
      const f = fixture(2, (rules) => {
          rules.startup.settings.luckLimit = 1;
          const piles = {
            drawZone: "draw",
            reservedZone: "reserved",
            discardZone: "discard",
            transitZone: "transit",
          };
          rules.operations = [
            createLuckTransferOperation({
              ...piles,
              wrapped: {
                originals: Object.fromEntries(
                  rules.content.cards.map((c) => [c.id, c.face]),
                ),
              },
              notify: () => null,
            }),
            createLuckCardOperation({
              piles,
              limit: () => 1,
              usesAI: () => false,
              request: () => ({ name: "internal-luck-collection", data: null }),
              notify: () => null,
            }),
            {
              name: "internal-luck-collection",
              run: ({ continuation, answer }) =>
                continuation === null
                  ? {
                      kind: "prompt",
                      actor: "0",
                      choices: ["replace", "keep"],
                      canCancel: false,
                      continuation: true,
                    }
                  : {
                      kind: "return",
                      value: {
                        "0": {
                          ready: true,
                          payload: answer?.choice === "replace",
                        },
                        "1": { ready: true, payload: false },
                      },
                    },
            },
          ];
        }),
        pending = chooseAll(f),
        view = f.module.view(pending, "0");
      expect(view.hand).toEqual([0, 1, 2, 3]);
      expect(view.stage).toBe("starting");
      if (!view.prompt) throw new Error("Expected luck prompt");
      expect(f.module.view(pending, "1").prompt).toBeNull();
      const restored = f.module.restore(JSON.stringify(pending));
      const ready = f.module.apply(restored, "0", {
        kind: "answer",
        id: view.prompt.id,
        choice: view.prompt.choices[decision === "replace" ? 0 : 1],
      });
      if (!ready || ready.phase !== "room") throw new Error("Expected redeal");
      expect(f.module.view(ready, "0").stage).toBe("prepared");
      if (decision === "replace")
        expect(f.module.view(ready, "0").hand).not.toEqual([0, 1, 2, 3]);
      else expect(f.module.view(ready, "0").hand).toEqual([0, 1, 2, 3]);
      expect(f.module.view(ready, "1").hand).toEqual([4, 5, 6, 7]);
      // Public module serialization is the persistence seam; physical IDs remain conserved.
      const all = Object.values(ready.room.cardZones)
        .flatMap((z) => z.cards)
        .sort((a, b) => a - b);
      expect(all).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      if (decision === "replace")
        expect(ready.room.pileRandom.state).not.toBe(1);
      else expect(ready.room.pileRandom.state).toBe(1);
      expect(
        f.module.view(f.module.restore(JSON.stringify(ready)), "0"),
      ).toEqual(f.module.view(ready, "0"));
    },
  );
  it("binds restored pending startup to its original settings even under the same registry version", () => {
    const hold = (rules: Parameters<typeof createHegemonyMatch>[0]) => {
      rules.skills = [
        {
          id: "internal-held-start",
          events: ["GameStart"],
          priority: 10,
          rule: true,
          effect: ({ continuation }) =>
            continuation === null
              ? {
                  kind: "prompt",
                  actor: "0",
                  choices: ["continue"],
                  canCancel: false,
                  continuation: true,
                }
              : { kind: "done", value: false },
        },
      ];
    };
    const f = fixture(2, hold),
      pending = chooseAll(f),
      saved = JSON.stringify(pending);
    expect(f.module.view(pending, "0").stage).toBe("starting");
    const changed = fixture(2, (rules) => {
      hold(rules);
      rules.startup.settings.viewDeputy = true;
    });
    expect(() => changed.module.restore(saved)).toThrow("settings");
    for (const delta of [
      { image: true },
      { viewDeputy: true },
      { mode: "custom_scenario" },
      { luckLimit: 1 },
    ]) {
      const value = JSON.parse(saved);
      value.startupSettings = {
        image: false,
        viewDeputy: false,
        mode: "hegemony",
        luckLimit: 0,
        ...delta,
      };
      expect(() => f.module.restore(JSON.stringify(value))).toThrow("settings");
    }
    expect(f.module.view(f.module.restore(saved), "0")).toEqual(
      f.module.view(pending, "0"),
    );
  });
  it("rejects malformed deck configuration and out-of-range seat counts", () => {
    for (const count of [1, 11]) expect(() => fixture(count)).toThrow("2–10");
    expect(() =>
      fixture(2, (r) => {
        r.content.cards[1].id = 0;
      }),
    ).toThrow("content");
    const f = fixture();
    const config = {
      offers: { "0": ["0-head", "0-deputy"], "1": ["1-head", "1-deputy"] },
      drawPile: [0, 0],
      randomState: 1,
    };
    expect(() => f.module.create(config)).toThrow("deck");
    expect(() =>
      f.module.create({
        ...config,
        drawPile: f.content.cards.map((c) => c.id),
        randomState: -1,
      }),
    ).toThrow("deck");
  });
  it("preserves a partial setup on reload and rejects illegal or repeated selection without dealing", () => {
    const f = fixture();
    expect(
      f.module.apply(f.state, "unknown", {
        kind: "choose-pair",
        choice: { head: "0-head", deputy: "0-deputy" },
      }),
    ).toBeNull();
    expect(
      f.module.apply(f.state, "0", {
        kind: "choose-pair",
        choice: { head: "0-head", deputy: "1-deputy" },
      }),
    ).toBeNull();
    const first = f.module.apply(f.state, "0", {
      kind: "choose-pair",
      choice: { head: "0-head", deputy: "0-deputy" },
    });
    if (!first) throw new Error("Expected accepted pair");
    const restored = f.module.restore(JSON.stringify(first));
    expect(f.module.view(restored, "0")).toEqual(f.module.view(first, "0"));
    expect(f.module.view(restored, "0").hand).toEqual([]);
    expect(
      f.module.apply(restored, "0", {
        kind: "choose-pair",
        choice: { head: "0-head", deputy: "0-deputy" },
      }),
    ).toBeNull();
    expect(JSON.stringify(f.module.view(restored, "1"))).not.toContain(
      "0-head",
    );
  });
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
    "prepares all %i seats with real four-card dealing",
    (count) => {
      const f = fixture(count),
        ready = chooseAll(f);
      expect(f.module.view(ready, null).stage).toBe("prepared");
      const dealt = f.players.flatMap(
        (actor) => f.module.view(ready, actor).hand,
      );
      expect(dealt).toEqual(Array.from({ length: count * 4 }, (_, i) => i));
      expect(new Set(dealt).size).toBe(count * 4);
      expect(f.module.view(ready, null).hand).toEqual([]);
      expect(JSON.stringify(f.module.view(ready, null))).not.toContain("-head");
    },
  );
  it("keeps private startup views and limited marks scoped to their actor", () => {
    const f = fixture(2, (rules) => {
        rules.startup.settings.viewDeputy = true;
        rules.startup.visibleSkills = (_room, target) => [
          {
            name: `hidden-${target}`,
            frequency: "limited",
            limitMark: `@hidden-${target}`,
            lord: false,
          },
        ];
      }),
      ready = chooseAll(f);
    const own = f.module.view(ready, "0"),
      other = f.module.view(ready, "1"),
      spectator = f.module.view(ready, null);
    expect(own.marks).toHaveProperty("@hidden-0", 1);
    expect(own.notices).toContainEqual({
      kind: "known-general",
      viewer: "0",
      target: "1",
      name: "1-deputy",
    });
    expect(JSON.stringify(other.notices)).not.toContain('"viewer":"0"');
    expect(JSON.stringify(spectator)).not.toContain("@hidden-");
    expect(JSON.stringify(spectator)).not.toContain("-deputy");
    expect(spectator.marks).toEqual({});
    expect(spectator).not.toHaveProperty("scheduler");
  });
  it("resumes a real movement prompt without rerunning startup and projects only Room HP", () => {
    const f = fixture(2, (rules) => {
        rules.operations = [createDamageDoneOperation()];
        rules.skills = [
          {
            id: "internal-start-question",
            events: ["BeforeCardsMove"],
            priority: 10,
            rule: true,
            effect: ({ game, continuation, operationChild }) => {
              if (continuation === null) {
                if (game.playerMarks["0"].startupQuestion === 1)
                  return { kind: "done", value: false };
                game.playerMarks["0"].startupQuestion = 1;
                return {
                  kind: "prompt",
                  actor: "0",
                  choices: ["continue"],
                  canCancel: false,
                  continuation: 1,
                };
              }
              if (operationChild) return { kind: "done", value: false };
              return {
                kind: "operation",
                operation: {
                  name: "damage-done",
                  data: {
                    target: "0",
                    data: {
                      from: null,
                      to: "0",
                      card: null,
                      damage: 1,
                      nature: "normal",
                      chain: false,
                      transfer: false,
                      by_user: true,
                      reason: "internal-start-question",
                      flags: [],
                      transfer_reason: "",
                      prevented: false,
                    },
                  },
                },
                continuation: 2,
              };
            },
          },
        ];
      }),
      pending = chooseAll(f),
      before = f.module.view(pending, "0");
    expect(before.stage).toBe("starting");
    if (!before.prompt) throw new Error("Expected private startup prompt");
    expect(f.module.view(pending, "1").prompt).toBeNull();
    expect(f.module.view(pending, null).prompt).toBeNull();
    const restored = f.module.restore(JSON.stringify(pending));
    expect(f.module.view(restored, "0")).toEqual(before);
    const answer = {
      kind: "answer",
      id: before.prompt.id,
      choice: before.prompt.choices[0],
    } as const;
    expect(f.module.apply(restored, "1", answer)).toBeNull();
    expect(
      f.module.apply(restored, "0", { ...answer, id: "stale" }),
    ).toBeNull();
    expect(
      f.module.apply(restored, "0", { ...answer, choice: "unoffered" }),
    ).toBeNull();
    expect(
      f.module.apply(restored, "0", { ...answer, choice: null }),
    ).toBeNull();
    const ready = f.module.apply(restored, "0", answer);
    if (!ready) throw new Error("Expected completed startup");
    expect(f.module.view(ready, "0")).toMatchObject({
      stage: "prepared",
      players: { "0": { hp: 2 } },
      hand: [0, 1, 2, 3],
    });
    expect(f.module.view(ready, "1").hand).toEqual([4, 5, 6, 7]);
    expect(f.module.apply(ready, "0", answer)).toBeNull();
    expect(f.module.view(pending, "0")).toEqual(before);
  });
  it("keeps terminal result and interrupted startup distinct from prepared gameplay", () => {
    const terminal = fixture(2, (rules) => {
        rules.skills = [
          {
            id: "internal-terminal",
            events: ["GameStart"],
            priority: 10,
            rule: true,
            effect: () => ({
              kind: "operation",
              operation: { name: "game-over", data: "." },
              continuation: true,
            }),
          },
        ];
      }),
      ended = chooseAll(terminal);
    expect(terminal.module.view(ended, "0")).toMatchObject({
      stage: "finished",
      result: ".",
      hand: [],
    });
    expect(
      terminal.module.view(terminal.module.restore(JSON.stringify(ended)), "0"),
    ).toEqual(terminal.module.view(ended, "0"));
    const stopped = fixture(2, (rules) => {
        rules.skills = [
          {
            id: "internal-interrupt",
            events: ["GameStart"],
            priority: 10,
            rule: true,
            effect: () => ({ kind: "interrupt", reason: "turn-broken" }),
          },
        ];
      }),
      interrupted = chooseAll(stopped);
    expect(stopped.module.view(interrupted, "0")).toMatchObject({
      stage: "interrupted",
      result: null,
      hand: [],
    });
    expect(
      stopped.module.apply(interrupted, "0", {
        kind: "answer",
        id: "x",
        choice: null,
      }),
    ).toBeNull();
  });
  it("rejects incompatible versions and a restored second setup authority", () => {
    const f = fixture(),
      ready = chooseAll(f);
    for (const [key, value] of [
      ["schemaVersion", "PROTOTYPE-ce4e62b-response-v4"],
      ["rulesVersion", "old"],
      ["contentVersion", "other"],
      ["registryVersion", "other"],
    ]) {
      expect(() =>
        f.module.restore(JSON.stringify({ ...ready, [key]: value })),
      ).toThrow("Incompatible");
    }
    if (f.state.phase !== "setup") throw new Error("Expected paired setup");
    const setup = f.state.setup;
    expect(() => f.module.restore(JSON.stringify({ ...ready, setup }))).toThrow(
      "authority",
    );
  });
  it("initializes native lord companions without requiring a literal companion pair", () => {
    const f = fixture(2, (rules) => {
      rules.content.companions = [];
      rules.content.generals[0].lord = true;
    });
    const ready = chooseAll(f);
    if (ready.phase !== "room") throw new Error("Expected Room snapshot");
    expect(ready.room.identities["0"]).toMatchObject({
      lord: true,
      generalLord: false,
      actualHeadLord: true,
    });
    expect(f.module.view(ready, "0").marks).toHaveProperty(
      "CompanionEffect",
      1,
    );
  });
  it("projects only declared presentation fields from a package-produced startup notice", () => {
    const f = fixture(2, (rules) => {
      rules.skills = [
        {
          id: "decorated-presentation",
          events: ["GameStart"],
          priority: 10,
          rule: true,
          effect: ({ operationChild }) =>
            operationChild
              ? { kind: "done", value: false }
              : {
                  kind: "operation",
                  operation: {
                    name: "match-start-notice",
                    data: {
                      kind: "delay",
                      duration: 5,
                      privateDeck: [8, 9, 10, 11],
                    },
                  },
                  continuation: true,
                },
        },
      ];
    });
    const ready = chooseAll(f);
    expect(f.module.view(ready, null)).not.toHaveProperty("room");
    expect(JSON.stringify(f.module.view(ready, null))).not.toContain(
      "privateDeck",
    );
  });
  it("hands paired setup to one Room and actually deals once after the last choice", () => {
    const { module, state } = fixture();
    const first = module.apply(state, "0", {
      kind: "choose-pair",
      choice: { head: "0-head", deputy: "0-deputy" },
    });
    if (!first) throw new Error("Expected accepted pair");
    expect(module.view(first, "0").stage).toBe("setup");
    const ready = module.apply(first, "1", {
      kind: "choose-pair",
      choice: { head: "1-head", deputy: "1-deputy" },
    });
    if (!ready) throw new Error("Expected startup");
    expect(module.view(ready, "0")).toMatchObject({
      stage: "prepared",
      hand: [0, 1, 2, 3],
      players: {
        "0": { hp: 3, maxHp: 3, head: { id: "0-head", shown: false } },
        "1": { hp: 3, maxHp: 3, head: { id: null, shown: false } },
      },
      marks: { HalfMaxHpLeft: 1, CompanionEffect: 1, HaventShowGeneral: 1 },
    });
    expect(module.view(ready, "1").hand).toEqual([4, 5, 6, 7]);
    expect(ready).not.toHaveProperty("setup");
    expect(state).toHaveProperty("setup.status", "selecting-generals");
    expect(
      module.apply(ready, "1", {
        kind: "choose-pair",
        choice: { head: "1-head", deputy: "1-deputy" },
      }),
    ).toBeNull();
    const restored = module.restore(JSON.stringify(ready));
    expect(module.view(restored, "0")).toEqual(module.view(ready, "0"));
  });
});
