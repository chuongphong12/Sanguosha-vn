import { describe, expect, it } from "vitest";
import {
  createHegemonyMatch,
  type HegemonyMatch,
  type MatchContent,
  type HegemonyRoom,
} from "../../src/game/hegemony/match";
import { createDamageDoneOperation } from "../../src/game/hegemony/damage-rule";
import { createLuckCardOperation } from "../../src/game/hegemony/luck-cards";
import { createLuckTransferOperation } from "../../src/game/hegemony/luck-transfer";
import { createShowGeneralOperation } from "../../src/game/hegemony/general";
import { createCareeristOperation } from "../../src/game/hegemony/careerist";
import { hasShownGeneral } from "../../src/game/hegemony/general-identity";
import { createFillHandCardsOperation } from "../../src/game/hegemony/fill-hand";
import { createRecoveryOperation } from "../../src/game/hegemony/recovery";

function fixture(
  count = 2,
  configure?: (rules: Parameters<typeof createHegemonyMatch>[0]) => void,
  globalSkills?: string[],
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
      globalSkills: [],
      hasPlayerStartup: () => false,
      winner: {
        showGeneral: (target, slot) => ({
          name: "show-general",
          data: {
            target,
            head: slot === "head",
            triggerEvent: false,
            sendLog: false,
            ignoreRule: true,
          },
        }),
        careerist: () => ({ name: "careerist-rule", data: null }),
      },
    },
  };
  configure?.(rules);
  // These synthetic hooks are global unless the fixture explicitly classifies them.
  rules.startup.globalSkills =
    globalSkills ?? (rules.skills ?? []).map((s) => s.id);
  rules.operations = [
    createShowGeneralOperation<HegemonyRoom>({
      canShow: () => true,
      preshow: (target, head, enabled) => ({
        name: "internal-general-hook",
        data: { kind: "preshow", target, head, enabled },
      }),
      change: () => ({ name: "internal-general-hook", data: null }),
      skills: () => ({ name: "internal-general-hook", data: null }),
      notify: () => ({ name: "internal-general-hook", data: null }),
      filter: () => ({ name: "internal-general-hook", data: null }),
    }),
    createCareeristOperation<HegemonyRoom>({
      hasShown: hasShownGeneral,
      showHead: (target) => ({
        name: "show-general",
        data: {
          target,
          head: true,
          triggerEvent: false,
          sendLog: true,
          ignoreRule: true,
        },
      }),
    }),
    createFillHandCardsOperation<HegemonyRoom>({
      draw: (target, count, reason) => ({
        name: "draw-cards",
        data: { players: [target], counts: [count], reason },
      }),
    }),
    createRecoveryOperation<HegemonyRoom>(),
    ...((rules.operations ?? []).some(
      (op) => op.name === "internal-general-hook",
    )
      ? []
      : [
          {
            name: "internal-general-hook",
            run: () => ({ kind: "return" as const, value: null }),
          },
        ]),
    ...(rules.operations ?? []),
  ];
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

/** Trusted serialized native-condition fixture; winner/reveal execution itself stays real. */
function beforeWinner(f: ReturnType<typeof fixture>) {
  const ready = chooseAll(f);
  if (ready.phase !== "room") throw new Error("Expected Room");
  const saved = structuredClone(ready);
  saved.startup = { stage: "winner", waiting: false };
  saved.scheduler.registryVersion = `${saved.registryVersion}:startup-global`;
  saved.scheduler.completion = null;
  saved.scheduler.operationCompletion = null;
  saved.room.startupNotices = [];
  saved.room.pileRandom.state = 1;
  for (const [key, zone] of Object.entries(saved.room.cardZones))
    zone.cards = key === "draw" ? f.content.cards.map((c) => c.id) : [];
  return saved;
}

describe("internal Quốc Chiến match authority", () => {
  it("rechecks player startup eligibility after global skills change current skill ownership", () => {
    const f = fixture(
        3,
        (rules) => {
          rules.startup.hasPlayerStartup = (room, actor) =>
            room.acquiredSkills[actor].head.includes("player-track");
          rules.skills = [
            {
              id: "global-giver",
              events: ["GameStart"],
              priority: 10,
              rule: true,
              effect: ({ game }) => {
                game.acquiredSkills["1"].head.push("player-track");
                return { kind: "done", value: false };
              },
            },
            {
              id: "player-track",
              events: ["GameStart"],
              priority: 9,
              rule: true,
              effect: ({ event, operationChild }) =>
                operationChild
                  ? { kind: "done", value: false }
                  : {
                      kind: "operation",
                      operation: {
                        name: "match-start-notice",
                        data: {
                          kind: "delay",
                          duration:
                            event.target === null
                              ? 999
                              : 20 + Number(event.target),
                        },
                      },
                      continuation: true,
                    },
            },
            {
              id: "player-record",
              events: ["GameStart"],
              priority: 9,
              record: ({ game, event }) => {
                game.playerMarks["0"][
                  event.target === null
                    ? "unexpectedGlobalRecord"
                    : "playerRecord"
                ] = 1;
              },
              triggerable: () => [],
              effect: () => ({ kind: "done", value: false }),
            },
          ];
        },
        ["global-giver"],
      ),
      ready = chooseAll(f),
      view = f.module.view(ready, "0");
    expect(
      view.notices?.filter((n) => n.kind === "delay").map((n) => n.duration),
    ).toEqual([3000, 21]);
    expect(view.marks).not.toHaveProperty("unexpectedGlobalRecord");
    expect(view.marks).toHaveProperty("playerRecord", 1);
  });
  it("restores consecutive per-player startup prompts without resetting IDs or replaying costs", () => {
    const f = fixture(
      2,
      (rules) => {
        rules.startup.hasPlayerStartup = () => true;
        rules.skills = [
          {
            id: "private-player-start",
            events: ["GameStart"],
            priority: 10,
            rule: true,
            effect: ({ game, event, continuation }) => {
              if (event.target === null)
                throw new Error("Player-only skill ran globally");
              if (continuation === null) {
                game.playerMarks[event.target].startupVisits =
                  (game.playerMarks[event.target].startupVisits ?? 0) + 1;
                return {
                  kind: "prompt",
                  actor: event.target,
                  choices: ["continue"],
                  canCancel: false,
                  continuation: true,
                };
              }
              return { kind: "done", value: false };
            },
          },
        ];
      },
      [],
    );
    let pending = chooseAll(f);
    const seen = new Set<string>();
    let nextId = 0;
    for (const actor of ["0", "1"]) {
      pending = f.module.restore(JSON.stringify(pending));
      if (pending.phase !== "room") throw new Error("Expected startup");
      expect(pending.scheduler.registryVersion).toBe(
        `${pending.registryVersion}:startup-full`,
      );
      expect(pending.scheduler.nextId).toBeGreaterThan(nextId);
      nextId = pending.scheduler.nextId;
      const view = f.module.view(pending, actor),
        other = actor === "0" ? "1" : "0";
      expect(f.module.view(pending, other).prompt).toBeNull();
      if (!view.prompt) throw new Error("Expected player-start prompt");
      expect(seen.has(view.prompt.id)).toBe(false);
      seen.add(view.prompt.id);
      const answer = {
        kind: "answer",
        id: view.prompt.id,
        choice: view.prompt.choices[0],
      } as const;
      expect(f.module.apply(pending, other, answer)).toBeNull();
      expect(
        f.module.apply(pending, actor, { ...answer, choice: "unoffered" }),
      ).toBeNull();
      const accepted = f.module.apply(pending, actor, answer);
      if (!accepted) throw new Error("Expected startup continuation");
      expect(f.module.apply(accepted, actor, answer)).toBeNull();
      pending = accepted;
    }
    expect(f.module.view(pending, "0")).toMatchObject({
      stage: "prepared",
      hand: [0, 1, 2, 3],
      marks: { startupVisits: 1 },
    });
    expect(f.module.view(pending, "1")).toMatchObject({
      hand: [4, 5, 6, 7],
      marks: { startupVisits: 1 },
    });
    expect(
      f.module.view(f.module.restore(JSON.stringify(pending)), "0"),
    ).toEqual(f.module.view(pending, "0"));
  });
  it("uses real initial winner/reveal/game-over from a saved native condition without dealing", () => {
    const f = fixture(),
      saved = beforeWinner(f);
    saved.room.alive["1"] = false;
    saved.room.hp["1"] = 0;
    saved.room.livingPlayers = ["0"];
    const ended = f.module.restore(JSON.stringify(saved)),
      view = f.module.view(ended, null);
    expect(view).toMatchObject({
      stage: "finished",
      result: "0",
      players: {
        "0": {
          head: { id: "0-head", shown: true },
          deputy: { id: "0-deputy", shown: true },
          handCount: 0,
        },
        "1": { handCount: 0 },
      },
    });
    if (ended.phase !== "room") throw new Error("Expected terminal Room");
    expect(ended.room.cardZones.draw.cards).toEqual(
      f.content.cards.map((c) => c.id),
    );
    expect(ended.room.startupNotices).toEqual([]);
    expect(
      f.module.view(f.module.restore(JSON.stringify(ended)), null),
    ).toEqual(view);
  });
  it("resumes actual winner reveal prompts under the global registry without running GameStart", () => {
    const f = fixture(2, (rules) => {
        rules.operations = [
          {
            name: "internal-general-hook",
            run: ({ operation, continuation }) => {
              const data = operation.data;
              if (
                !data ||
                typeof data !== "object" ||
                Array.isArray(data) ||
                data.kind !== "preshow"
              )
                return { kind: "return", value: null };
              if (continuation === null)
                return {
                  kind: "prompt",
                  actor: String(data.target),
                  choices: ["allow"],
                  canCancel: false,
                  continuation: true,
                };
              return { kind: "return", value: null };
            },
          },
        ];
      }),
      saved = beforeWinner(f);
    saved.room.alive["1"] = false;
    saved.room.hp["1"] = 0;
    saved.room.livingPlayers = ["0"];
    let current = f.module.restore(JSON.stringify(saved));
    const ids = new Set<string>();
    for (let slot = 0; slot < 2; slot++) {
      current = f.module.restore(JSON.stringify(current));
      if (current.phase !== "room")
        throw new Error("Expected winner continuation");
      expect(current.startup.stage).toBe("winner");
      expect(current.scheduler.registryVersion).toBe(
        `${current.registryVersion}:startup-global`,
      );
      expect(current.scheduler.nextId).toBeGreaterThan(saved.scheduler.nextId);
      const view = f.module.view(current, "0");
      expect(view.stage).toBe("starting");
      expect(view.hand).toEqual([]);
      expect(f.module.view(current, "1").prompt).toBeNull();
      if (!view.prompt) throw new Error("Expected native reveal prompt");
      expect(ids.has(view.prompt.id)).toBe(false);
      ids.add(view.prompt.id);
      const next = f.module.apply(current, "0", {
        kind: "answer",
        id: view.prompt.id,
        choice: view.prompt.choices[0],
      });
      if (!next) throw new Error("Expected winner reveal continuation");
      current = next;
    }
    expect(f.module.view(current, null)).toMatchObject({
      stage: "finished",
      result: "0",
      notices: [],
    });
  });
  it("rejects missing or duplicate global skill identities before creating a match", () => {
    expect(() => fixture(2, undefined, ["unregistered"])).toThrow(
      "classification",
    );
    expect(() =>
      fixture(
        2,
        (rules) => {
          rules.skills = [
            {
              id: "global-test",
              events: ["GameStart"],
              priority: 1,
              rule: true,
              effect: () => ({ kind: "done", value: false }),
            },
          ];
        },
        ["global-test", "global-test"],
      ),
    ).toThrow("classification");
  });
  it("runs the actual careerist child when deciding a fully revealed faction winner", () => {
    const f = fixture(),
      saved = beforeWinner(f);
    for (const actor of f.players) {
      saved.room.identities[actor].headShown = true;
      saved.room.identities[actor].deputyShown = true;
      saved.room.displayedGenerals[actor] = {
        head: `${actor}-head`,
        deputy: `${actor}-deputy`,
      };
    }
    const ended = f.module.restore(JSON.stringify(saved));
    expect(f.module.view(ended, "0")).toMatchObject({
      stage: "finished",
      result: "0+1",
      hand: [],
    });
    expect(f.module.view(ended, "1").hand).toEqual([]);
  });
  it("rejects old schema, classification drift and a cursor inconsistent with its active root", () => {
    const f = fixture(2, (rules) => {
        rules.skills = [
          {
            id: "global-hold",
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
      }),
      pending = chooseAll(f);
    expect(() =>
      f.module.restore(
        JSON.stringify({ ...pending, schemaVersion: "hegemony-match-v1" }),
      ),
    ).toThrow("Incompatible");
    expect(() =>
      f.module.restore(JSON.stringify({ ...pending, startupGlobals: [] })),
    ).toThrow("classification");
    if (pending.phase !== "room") throw new Error("Expected pending startup");
    const forged = structuredClone(pending);
    forged.startup = { stage: "players", index: 0, waiting: true };
    forged.scheduler.registryVersion = `${forged.registryVersion}:startup-full`;
    expect(() => f.module.restore(JSON.stringify(forged))).toThrow("root");
  });
  it("activates player-only startup after global dealing in native seat order", () => {
    const f = fixture(
      2,
      (rules) => {
        rules.startup.hasPlayerStartup = () => true;
        rules.skills = [
          {
            id: "global-track",
            events: ["GameStart"],
            priority: 10,
            rule: true,
            effect: ({ event, operationChild }) =>
              event.target !== null || operationChild
                ? { kind: "done", value: false }
                : {
                    kind: "operation",
                    operation: {
                      name: "match-start-notice",
                      data: { kind: "delay", duration: 10 },
                    },
                    continuation: true,
                  },
          },
          {
            id: "player-track",
            events: ["GameStart"],
            priority: 9,
            rule: true,
            effect: ({ event, operationChild }) =>
              operationChild
                ? { kind: "done", value: false }
                : {
                    kind: "operation",
                    operation: {
                      name: "match-start-notice",
                      data: {
                        kind: "delay",
                        duration:
                          event.target === null
                            ? 999
                            : 20 + Number(event.target),
                      },
                    },
                    continuation: true,
                  },
          },
        ];
      },
      ["global-track"],
    );
    const ready = chooseAll(f),
      view = f.module.view(ready, "0");
    expect(view.stage).toBe("prepared");
    expect(
      view.notices?.filter((n) => n.kind === "delay").map((n) => n.duration),
    ).toEqual([10, 3000, 20, 21]);
    expect(view.hand).toEqual([0, 1, 2, 3]);
    expect(f.module.view(ready, "1").hand).toEqual([4, 5, 6, 7]);
    if (ready.phase !== "room") throw new Error("Expected prepared Room");
    const checkpoint = structuredClone(ready);
    checkpoint.startup = { stage: "players", index: 1, waiting: true };
    const resumed = f.module.restore(JSON.stringify(checkpoint));
    expect(f.module.view(resumed, "0")).toEqual(view);
    if (resumed.phase !== "room") throw new Error("Expected Room");
    expect(resumed.scheduler.nextId).toBe(ready.scheduler.nextId);
  });
  it("consumes an already completed global root before switching tables without redealing", () => {
    const f = fixture(),
      ready = chooseAll(f);
    if (ready.phase !== "room") throw new Error("Expected prepared Room");
    const checkpoint = structuredClone(ready);
    checkpoint.startup = { stage: "global", waiting: true };
    checkpoint.scheduler.registryVersion = `${checkpoint.registryVersion}:startup-global`;
    const restored = f.module.restore(JSON.stringify(checkpoint));
    expect(f.module.view(restored, "0")).toEqual(f.module.view(ready, "0"));
    if (restored.phase !== "room") throw new Error("Expected prepared Room");
    expect(restored.scheduler.nextId).toBe(ready.scheduler.nextId);
    expect(restored.scheduler.registryVersion).toBe(
      `${restored.registryVersion}:startup-full`,
    );
  });
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
      stopped.module.view(
        stopped.module.restore(JSON.stringify(interrupted)),
        "0",
      ),
    ).toEqual(stopped.module.view(interrupted, "0"));
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
