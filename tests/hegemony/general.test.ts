import { describe, expect, it } from "vitest";
import {
  createShowGeneralOperation,
  createHideGeneralOperation,
  type GeneralRules,
} from "../../src/game/hegemony/general";
import type { GeneralGame } from "../../src/game/hegemony/general-identity";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  type TriggerData,
  type TriggerRegistry,
  type TriggerSkill,
  getTriggerPrompt,
  resumeTriggerPrompt,
} from "../../src/game/hegemony/scheduler";
import { createCareeristOperation } from "../../src/game/hegemony/careerist";
import { createBeforeGameOverJudgeOperation } from "../../src/game/hegemony/victory";

type Game = GeneralGame & { seen: string[] };
function fixture(): Game {
  const players = ["a", "b", "c", "d"];
  return {
    seatOrder: players,
    livingPlayers: [...players],
    seats: { a: 1, b: 2, c: 3, d: 4 },
    currentPlayer: "c",
    alive: { a: true, b: true, c: true, d: true },
    hp: { a: 3, b: 3, c: 3, d: 3 },
    maxHp: { a: 4, b: 4, c: 4, d: 4 },
    removed: { a: false, b: false, c: false, d: false },
    chained: { a: false, b: false, c: false, d: false },
    damageStack: [],
    playerFlags: { a: [], b: [], c: [], d: [] },
    playerMarks: { a: {}, b: {}, c: {}, d: {} },
    currentdying: { a: "", b: "", c: "", d: "" },
    playerHistory: { a: {}, b: {}, c: {}, d: {} },
    acquiredSkills: {
      a: { head: [], deputy: [] },
      b: { head: [], deputy: [] },
      c: { head: [], deputy: [] },
      d: { head: [], deputy: [] },
    },
    scenarioRoleShown: { a: false, b: false, c: false, d: false },
    identities: Object.fromEntries(
      players.map((p) => [
        p,
        {
          head: `${p}-head`,
          deputy: `${p}-deputy`,
          headKingdom: "wei",
          kingdom: "wei",
          role: "lord",
          headShown: false,
          deputyShown: false,
          lord: false,
          generalLord: false,
          actualHeadLord: false,
        },
      ]),
    ),
    generalNames: Object.fromEntries(
      players.map((p) => [p, [`${p}-head`, `${p}-deputy`]]),
    ),
    displayedGenerals: Object.fromEntries(
      players.map((p) => [p, { head: "anjiang", deputy: "anjiang" }]),
    ),
    generalCatalog: Object.fromEntries(
      ["anjiang", ...players.flatMap((p) => [`${p}-head`, `${p}-deputy`])].map(
        (name) => [
          name,
          {
            kingdom: name === "anjiang" ? "god" : "wei",
            doubleKingdom: false,
            lord: false,
          },
        ],
      ),
    ),
    cardZones: {
      draw: { place: "draw", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    cardResources: {
      cards: {},
      playerTags: { a: {}, b: {}, c: {}, d: {} },
      roomTags: {},
    },
    seen: [],
  };
}
function rules(
  canShow: GeneralRules<Game>["canShow"] = () => true,
): TriggerRegistry<Game> {
  const adapters: GeneralRules<Game> = {
    canShow,
    preshow: (target, head, enabled) => ({
      name: "observe-adapter",
      data: { target, label: `preshow:${head}:${enabled}` },
    }),
    change: (target, head, name) => ({
      name: "observe-adapter",
      data: { target, label: `change:${head}:${name}` },
    }),
    skills: (target, head, shown) => ({
      name: "observe-adapter",
      data: { target, label: `skills:${head}:${shown}` },
    }),
    notify: (target, head, shown, sendLog) => ({
      name: "observe-adapter",
      data: { target, label: `notify:${head}:${shown}:${sendLog}` },
    }),
    filter: (target) => ({
      name: "observe-adapter",
      data: { target, label: "filter" },
    }),
  };
  return {
    version: "general-ce4e62b",
    operations: [
      createShowGeneralOperation(adapters),
      createHideGeneralOperation(adapters),
      {
        name: "observe-adapter",
        run: ({ game, operation, continuation }) => {
          if (continuation !== null) return { kind: "return", value: null };
          const data = operation.data;
          if (!data || typeof data !== "object" || Array.isArray(data))
            throw new Error("fixture adapter");
          game.seen.push(String(data.label));
          if (String(data.label).startsWith("change:"))
            return {
              kind: "operation",
              operation: {
                name: "observe-adapter",
                data: { target: data.target, label: "change-filter" },
              },
              continuation: true,
            };
          return { kind: "return", value: null };
        },
      },
    ],
    skills: [
      {
        id: "observe-events",
        events: ["GeneralShown", "GeneralHidden", "DFDebut"],
        priority: 10,
        record: ({ game, event }) => {
          game.seen.push(`${event.name}:${event.data}`);
        },
        effect: () => ({ kind: "done", value: false }),
      },
    ],
  };
}
function run(
  game: Game,
  registry = rules(),
  name = "show-general",
  data: TriggerData = { target: "a" },
) {
  const scheduler = createTriggerScheduler(game.seatOrder, registry.version);
  expect(
    dispatchTriggerOperation(scheduler, game, registry, { name, data }, "c"),
  ).toBe(true);
  return scheduler;
}
function hook(
  registry: TriggerRegistry<Game>,
  event: string,
  effect: TriggerSkill<Game>["effect"],
) {
  registry.skills.push({
    id: `hook-${event}`,
    events: [event],
    priority: 5,
    rule: true,
    effect,
  });
}
function adapterHook(
  registry: TriggerRegistry<Game>,
  label: string,
  effect: (game: Game) => void,
) {
  const adapter = registry.operations!.find(
    (op) => op.name === "observe-adapter",
  )!;
  const original = adapter.run;
  adapter.run = (ctx) => {
    const data = ctx.operation.data;
    if (
      ctx.continuation === null &&
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data.label === label
    )
      effect(ctx.game);
    return original(ctx);
  };
}
function resumeAll(
  game: Game,
  scheduler: ReturnType<typeof createTriggerScheduler>,
  registry: TriggerRegistry<Game>,
  actor: string,
) {
  let pauses = 0;
  while (getTriggerPrompt(scheduler, actor)) {
    const prompt = getTriggerPrompt(scheduler, actor)!,
      before = JSON.stringify({ game, scheduler });
    for (const [replyActor, id, choice] of [
      ["b", prompt.id, "continue"],
      [actor, `${prompt.id}-old`, "continue"],
      [actor, prompt.id, "invalid"],
    ]) {
      expect(
        resumeTriggerPrompt(scheduler, game, registry, replyActor, {
          id,
          choice,
        }),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    }
    ({ game, scheduler } = JSON.parse(before));
    expect(
      resumeTriggerPrompt(scheduler, game, registry, actor, {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(true);
    const after = JSON.stringify({ game, scheduler });
    expect(
      resumeTriggerPrompt(scheduler, game, registry, actor, {
        id: prompt.id,
        choice: "continue",
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(after);
    if (++pauses > 12) throw new Error("pause fixture loop");
  }
  expect(pauses).toBeGreaterThan(0);
  expect(scheduler.frames).toEqual([]);
  return { game, scheduler };
}
describe("general lifecycle through public operation dispatch", () => {
  it("reveals head before GeneralShown and completes the final filter", () => {
    const game = fixture();
    const scheduler = run(game);
    expect(game.identities.a).toMatchObject({
      headShown: true,
      deputyShown: false,
      kingdom: "wei",
      role: "lord",
    });
    expect(game.displayedGenerals.a).toEqual({
      head: "a-head",
      deputy: "anjiang",
    });
    expect(game.scenarioRoleShown.a).toBe(true);
    expect(game.seen).toEqual([
      "preshow:true:true",
      "change:true:a-head",
      "change-filter",
      "skills:true:true",
      "notify:true:true:true",
      "GeneralShown:true",
      "filter",
    ]);
    expect(scheduler.frames).toEqual([]);
  });
  it("counts dead exposed faction members against the original room size", () => {
    const game = fixture();
    for (const p of ["b", "c"]) {
      game.identities[p].headShown = true;
      game.displayedGenerals[p].head = `${p}-head`;
    }
    game.alive.b = false;
    game.livingPlayers = ["a", "c", "d"];
    run(game);
    expect(game.identities.a.role).toBe("careerist");
    expect(game.identities.a.kingdom).toBe("wei");
  });
  it("hides head, retains scenario role and restores preshow only after event and filter", () => {
    const game = fixture();
    game.identities.a.headShown = true;
    game.displayedGenerals.a.head = "a-head";
    game.scenarioRoleShown.a = true;
    game.playerFlags.a = ["hiding", "retained"];
    const scheduler = run(game, rules(), "hide-general");
    expect(game.identities.a).toMatchObject({
      headShown: false,
      kingdom: "god",
      role: "careerist",
    });
    expect(game.displayedGenerals.a.head).toBe("anjiang");
    expect(game.scenarioRoleShown.a).toBe(true);
    expect(game.playerFlags.a).toEqual(["retained"]);
    expect(game.seen).toEqual([
      "preshow:true:false",
      "change:true:anjiang",
      "change-filter",
      "skills:true:false",
      "notify:true:false:true",
      "GeneralHidden:true",
      "filter",
      "preshow:true:true",
    ]);
    expect(scheduler.frames).toEqual([]);
  });
  it("emits only DFDebut for triggerEvent false, with logging independently disabled", () => {
    const game = fixture();
    run(game, rules(), "show-general", {
      target: "a",
      head: false,
      triggerEvent: false,
      sendLog: false,
    });
    expect(game.identities.a.deputyShown).toBe(true);
    expect(game.seen).toEqual([
      "preshow:false:true",
      "change:false:a-deputy",
      "change-filter",
      "skills:false:true",
      "notify:false:true:false",
      "DFDebut:null",
      "filter",
    ]);
  });
  it.each(["head", "deputy"] as const)(
    "uses displayed %s name for the no-op gate",
    (slot) => {
      const game = fixture();
      game.displayedGenerals.a[slot] = `a-${slot}`;
      const before = structuredClone(game);
      run(game, rules(), "show-general", {
        target: "a",
        head: slot === "head",
      });
      expect(game).toEqual(before);
    },
  );
  it("skips an empty actual-name tag before identity or guard access", () => {
    const game = fixture();
    game.generalNames.a = [];
    game.scenarioRoleShown.a = null as unknown as boolean;
    run(
      game,
      rules(() => {
        throw new Error("guard must not run");
      }),
    );
    expect(game.seen).toEqual([]);
  });
  it.each([true, false])(
    "respects ignoreRule=%s and keeps the guard pure",
    (ignoreRule) => {
      const game = fixture();
      const registry = rules((copy) => {
        copy.identities.a.kingdom = "shu";
        return false;
      });
      run(game, registry, "show-general", { target: "a", ignoreRule });
      expect(game.identities.a.headShown).toBe(ignoreRule);
      expect(game.identities.a.kingdom).toBe("wei");
    },
  );
  it("preserves first-head current kingdom instead of substituting actual head kingdom", () => {
    const game = fixture();
    game.identities.a.kingdom = "shu";
    run(game);
    expect(game.identities.a).toMatchObject({
      kingdom: "shu",
      role: "loyalist",
    });
  });
  it.each<[string, string]>([
    ["wei", "lord"],
    ["shu", "loyalist"],
    ["wu", "rebel"],
    ["qun", "renegade"],
    ["god", "careerist"],
    ["constructor", "constructor"],
  ])("maps current kingdom %s to native role %s", (kingdom, role) => {
    const game = fixture();
    game.identities.a.kingdom = kingdom;
    run(game);
    expect(game.identities.a.role).toBe(role);
  });
  it.each([false, true])(
    "uses displayed head fallback for double-kingdom deputy=%s",
    (doubleKingdom) => {
      const game = fixture();
      game.identities.a.kingdom = "";
      game.generalCatalog["a-deputy"].kingdom = "wu";
      game.generalCatalog["a-deputy"].doubleKingdom = doubleKingdom;
      run(game, rules(), "show-general", { target: "a", head: false });
      expect(game.identities.a).toMatchObject(
        doubleKingdom
          ? { kingdom: "god", role: "careerist" }
          : { kingdom: "wu", role: "rebel" },
      );
    },
  );
  it("does not treat a private scenario role as first-time reveal", () => {
    const game = fixture();
    game.scenarioRoleShown.a = true;
    game.identities.a.role = "careerist_leader";
    game.identities.a.kingdom = "god";
    run(game);
    expect(game.identities.a).toMatchObject({
      role: "careerist_leader",
      kingdom: "god",
      headShown: true,
    });
  });
  it.each(["lord", "careerist", "careerist_leader", "careerist-custom"])(
    "reveals a careerist head with prior role %s",
    (role) => {
      const game = fixture();
      game.generalCatalog["a-head"].kingdom = "careerist";
      game.identities.a.role = role;
      run(game);
      expect(game.identities.a.kingdom).toBe("careerist");
      expect(game.identities.a.role).toBe(role === "lord" ? "careerist" : role);
    },
  );
  it("accepts exactly half the registered room as a faction", () => {
    const game = fixture();
    game.identities.b.headShown = true;
    run(game);
    expect(game.identities.a.role).toBe("lord");
  });
  it("GlobalQuanjiaShow suppresses majority conversion", () => {
    const game = fixture();
    game.identities.b.headShown = game.identities.c.headShown = true;
    game.cardResources.roomTags.GlobalQuanjiaShow = true;
    run(game);
    expect(game.identities.a.role).toBe("lord");
  });
  it.each([true, false])(
    "revealed faction lord alive=%s controls conversion",
    (alive) => {
      const game = fixture();
      game.identities.b.headShown = true;
      game.identities.b.generalLord = true;
      game.alive.b = alive;
      run(game);
      expect(game.identities.a.role).toBe(alive ? "lord" : "careerist");
    },
  );
  it("actual-head lord self wins over a dead exposed sibling while deputy reveals", () => {
    const game = fixture();
    game.identities.a.actualHeadLord = true;
    game.identities.b.headShown = game.identities.b.generalLord = true;
    game.alive.b = false;
    run(game, rules(), "show-general", { target: "a", head: false });
    expect(game.identities.a).toMatchObject({
      role: "lord",
      lord: true,
      headShown: false,
    });
  });
  it("head lord converts plain careerists including dead seats but keeps recruited groups", () => {
    const game = fixture();
    game.generalCatalog["a-head"].lord = true;
    game.identities.a.actualHeadLord = true;
    game.identities.b.role = game.identities.c.role = "careerist";
    game.identities.d.role = "careerist_other";
    game.alive.c = false;
    run(game);
    expect([
      game.identities.b.role,
      game.identities.c.role,
      game.identities.d.role,
    ]).toEqual(["lord", "lord", "careerist_other"]);
  });
  it("captures actual name and first-show before preshow adapter mutations", () => {
    const game = fixture(),
      registry = rules();
    adapterHook(registry, "preshow:true:true", (g) => {
      g.generalNames.a[0] = "b-head";
      g.scenarioRoleShown.a = true;
      g.identities.a.kingdom = "shu";
    });
    run(game, registry);
    expect(game.displayedGenerals.a.head).toBe("a-head");
    expect(game.identities.a.role).toBe("loyalist");
  });
  it("does not restore kingdom after full conceal/reveal when scenario_role_shown persists", () => {
    const game = fixture();
    run(game);
    run(game, rules(), "hide-general");
    run(game);
    expect(game.identities.a).toMatchObject({
      kingdom: "god",
      role: "careerist",
      headShown: true,
    });
  });
  it.each(["head", "deputy"] as const)(
    "conceals %s while retaining the opposite shown faction",
    (slot) => {
      const game = fixture();
      game.displayedGenerals.a = { head: "a-head", deputy: "a-deputy" };
      game.identities.a.headShown = game.identities.a.deputyShown = true;
      run(game, rules(), "hide-general", {
        target: "a",
        head: slot === "head",
      });
      expect(game.identities.a.kingdom).toBe("wei");
      expect(game.identities.a.role).toBe("lord");
      expect(game.displayedGenerals.a[slot]).toBe("anjiang");
    },
  );
  it("conceal skips anjiang without reading actual tags, flags or identity", () => {
    const game = fixture();
    game.generalNames.a = null as unknown as string[];
    game.playerFlags.a = null as unknown as string[];
    run(game, rules(), "hide-general");
    expect(game.seen).toEqual([]);
  });
  it("conceal rereads the opposite shown flag after disconnect effects", () => {
    const game = fixture(),
      registry = rules();
    game.identities.a.headShown = true;
    game.displayedGenerals.a.head = "a-head";
    adapterHook(registry, "skills:true:false", (g) => {
      g.identities.a.deputyShown = true;
    });
    run(game, registry, "hide-general");
    expect(game.identities.a.kingdom).toBe("wei");
  });
  it.each(["GeneralShown", "DFDebut", "GeneralHidden"])(
    "continues after consumed/rewritten %s",
    (event) => {
      const game = fixture(),
        registry = rules();
      if (event === "GeneralHidden") {
        game.identities.a.headShown = true;
        game.displayedGenerals.a.head = "a-head";
      }
      hook(registry, event, ({ event: occurrence }) => {
        occurrence.data = "redirect";
        return { kind: "done", value: true };
      });
      const scheduler = run(
        game,
        registry,
        event === "GeneralHidden" ? "hide-general" : "show-general",
        { target: "a", triggerEvent: event !== "DFDebut" },
      );
      expect(game.seen).toContain("filter");
      expect(scheduler.frames).toEqual([]);
      if (event === "GeneralHidden")
        expect(game.seen.at(-1)).toBe("preshow:true:true");
    },
  );
  it("rejects malformed late Quanjia authority after retaining prior change effects", () => {
    const game = fixture();
    game.cardResources.roomTags.GlobalQuanjiaShow = "false";
    expect(() => run(game)).toThrow("Invalid GlobalQuanjiaShow");
    expect(game.identities.a.headShown).toBe(true);
    expect(game.seen).toEqual([
      "preshow:true:true",
      "change:true:a-head",
      "change-filter",
      "skills:true:true",
    ]);
  });
  it.each(["GeneralShown", "DFDebut", "GeneralHidden"])(
    "round-trips JSON and rejects wrong/stale/replayed replies at %s",
    (event) => {
      const game = fixture(),
        registry = rules();
      if (event === "GeneralHidden") {
        game.identities.a.headShown = true;
        game.displayedGenerals.a.head = "a-head";
      }
      hook(registry, event, ({ continuation }) =>
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
      const scheduler = run(
        game,
        registry,
        event === "GeneralHidden" ? "hide-general" : "show-general",
        { target: "a", triggerEvent: event !== "DFDebut" },
      );
      const restored = resumeAll(game, scheduler, registry, "c").game;
      expect(restored.seen.filter((label) => label === "filter")).toHaveLength(
        1,
      );
      expect(
        restored.seen.filter((label) => label.startsWith(`${event}:`)),
      ).toHaveLength(1);
      expect(restored.identities.a.headShown).toBe(event !== "GeneralHidden");
      if (event === "GeneralHidden")
        expect(restored.seen.at(-1)).toBe("preshow:true:true");
    },
  );
  it.each<[string, string]>([
    ["show-general", "preshow:true:true"],
    ["show-general", "change:true:a-head"],
    ["show-general", "change-filter"],
    ["show-general", "skills:true:true"],
    ["show-general", "notify:true:true:true"],
    ["show-general", "filter"],
    ["hide-general", "preshow:true:false"],
    ["hide-general", "change:true:anjiang"],
    ["hide-general", "skills:true:false"],
    ["hide-general", "notify:true:false:true"],
    ["hide-general", "filter"],
    ["hide-general", "preshow:true:true"],
  ])("resumes %s adapter %s exactly once through JSON", (name, label) => {
    const game = fixture(),
      registry = rules();
    if (name === "hide-general") {
      game.identities.a.headShown = true;
      game.displayedGenerals.a.head = "a-head";
      game.scenarioRoleShown.a = true;
    }
    const adapter = registry.operations!.find(
        (op) => op.name === "observe-adapter",
      )!,
      original = adapter.run;
    adapter.run = (ctx) => {
      const data = ctx.operation.data;
      if (
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        data.label === label
      ) {
        if (ctx.continuation === null)
          return {
            kind: "prompt",
            actor: "a",
            choices: ["continue"],
            canCancel: false,
            continuation: { resume: true },
          };
        if (
          ctx.continuation &&
          typeof ctx.continuation === "object" &&
          !Array.isArray(ctx.continuation) &&
          ctx.continuation.resume === true
        )
          return original({ ...ctx, continuation: null });
      }
      return original(ctx);
    };
    const restored = resumeAll(
      game,
      run(game, registry, name),
      registry,
      "a",
    ).game;
    expect(restored.seen.filter((value) => value === label)).toHaveLength(1);
    expect(restored.identities.a.headShown).toBe(name === "show-general");
    expect(restored.scenarioRoleShown.a).toBe(true);
    expect(restored.playerFlags.a).toEqual([]);
  });
  it.each(["GeneralShown", "DFDebut", "GeneralHidden"])(
    "freezes committed identity at interrupted %s without tail filtering",
    (event) => {
      const game = fixture(),
        registry = rules();
      if (event === "GeneralHidden") {
        game.identities.a.headShown = true;
        game.displayedGenerals.a.head = "a-head";
        game.scenarioRoleShown.a = true;
      }
      hook(registry, event, () => ({
        kind: "interrupt",
        reason: "turn-broken",
      }));
      const scheduler = run(
        game,
        registry,
        event === "GeneralHidden" ? "hide-general" : "show-general",
        { target: "a", triggerEvent: event !== "DFDebut" },
      );
      expect(scheduler.interruption?.reason).toBe("turn-broken");
      expect(game.identities.a.headShown).toBe(event !== "GeneralHidden");
      expect(game.scenarioRoleShown.a).toBe(true);
      expect(game.seen).not.toContain("filter");
      expect(
        game.seen.filter((label) => label === "preshow:true:true"),
      ).toHaveLength(event === "GeneralHidden" ? 0 : 1);
    },
  );
  it("interrupted conceal preshow leaves temporary hiding flag and original general", () => {
    const game = fixture(),
      registry = rules();
    game.identities.a.headShown = true;
    game.displayedGenerals.a.head = "a-head";
    const adapter = registry.operations!.find(
      (op) => op.name === "observe-adapter",
    )!;
    adapter.run = () => ({ kind: "interrupt", reason: "stage-change" });
    const scheduler = run(game, registry, "hide-general");
    expect(scheduler.interruption?.reason).toBe("stage-change");
    expect(game.playerFlags.a).toEqual(["hiding"]);
    expect(game.identities.a.headShown).toBe(true);
    expect(game.displayedGenerals.a.head).toBe("a-head");
  });
  it("allows nested deputy reveal within head GeneralShown", () => {
    const game = fixture(),
      registry = rules();
    hook(registry, "GeneralShown", ({ event, continuation }) =>
      event.data === true && continuation === null
        ? {
            kind: "operation",
            operation: {
              name: "show-general",
              data: { target: "a", head: false },
            },
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    const scheduler = run(game, registry);
    expect(game.identities.a).toMatchObject({
      headShown: true,
      deputyShown: true,
      kingdom: "wei",
      role: "lord",
    });
    expect(
      game.seen.filter((label) => label.startsWith("GeneralShown:")),
    ).toEqual(["GeneralShown:true", "GeneralShown:false"]);
    expect(scheduler.frames).toEqual([]);
  });
  it("keeps identity reset when a nested deputy reveals during GeneralHidden", () => {
    const game = fixture(),
      registry = rules();
    run(game);
    hook(registry, "GeneralHidden", ({ continuation }) =>
      continuation === null
        ? {
            kind: "operation",
            operation: {
              name: "show-general",
              data: { target: "a", head: false },
            },
            continuation: true,
          }
        : { kind: "done", value: false },
    );
    const scheduler = run(game, registry, "hide-general");
    expect(game.identities.a).toMatchObject({
      headShown: false,
      deputyShown: true,
      kingdom: "god",
      role: "careerist",
    });
    expect(game.seen.at(-1)).toBe("preshow:true:true");
    expect(scheduler.frames).toEqual([]);
  });
  it("still filters after GeneralShown kills its original target", () => {
    const game = fixture(),
      registry = rules();
    hook(registry, "GeneralShown", ({ game }) => {
      game.alive.a = false;
      return { kind: "done", value: false };
    });
    run(game, registry);
    expect(game.alive.a).toBe(false);
    expect(game.seen.at(-1)).toBe("filter");
  });
  it("careerist forced reveal executes actual DFDebut lifecycle before assigning its group", () => {
    const game = fixture(),
      registry = rules();
    game.livingPlayers = ["a", "b"];
    game.generalCatalog["a-head"].kingdom = game.identities.a.headKingdom =
      "careerist";
    game.identities.a.kingdom = "god";
    registry.operations!.push(
      createCareeristOperation({
        showHead: (target) => ({
          name: "show-general",
          data: { target, triggerEvent: false },
        }),
      }),
    );
    const scheduler = run(game, registry, "careerist-rule", null);
    expect(scheduler.operationCompletion?.value).toBe(true);
    expect(game.identities.a).toMatchObject({
      headShown: true,
      kingdom: "careerist",
      role: "careerist_a-head",
    });
    expect(game.cardResources.roomTags.GlobalCareeristShow).toBe(false);
    expect(game.seen).toContain("DFDebut:null");
    expect(game.seen).not.toContain("GeneralShown:true");
  });
  it("BeforeGameOverJudge composes both actual lifecycle reveals with DFDebut and no reveal log", () => {
    const game = fixture(),
      registry = rules();
    game.alive.a = false;
    registry.operations!.push(
      createBeforeGameOverJudgeOperation({
        showGeneral: (target, slot) => ({
          name: "show-general",
          data: {
            target,
            head: slot === "head",
            triggerEvent: false,
            sendLog: false,
          },
        }),
      }),
    );
    run(game, registry, "before-game-over-judge", { target: "a", data: null });
    expect(game.identities.a).toMatchObject({
      headShown: true,
      deputyShown: true,
    });
    expect(game.seen.filter((label) => label === "DFDebut:null")).toHaveLength(
      2,
    );
    expect(game.seen.filter((label) => label.startsWith("notify:"))).toEqual([
      "notify:true:true:false",
      "notify:false:true:false",
    ]);
  });
  it("careerist processing respects retained scenario_role_shown after actual reveal/conceal", () => {
    const game = fixture(),
      registry = rules();
    game.livingPlayers = ["a", "b"];
    game.generalCatalog["a-head"].kingdom = game.identities.a.headKingdom =
      "careerist";
    run(game, registry);
    run(game, registry, "hide-general");
    registry.operations!.push(
      createCareeristOperation({
        showHead: (target) => ({
          name: "show-general",
          data: { target, triggerEvent: false },
        }),
      }),
    );
    const before = structuredClone(game);
    expect(
      run(game, registry, "careerist-rule", null).operationCompletion?.value,
    ).toBe(false);
    expect(game).toEqual(before);
  });
  it("careerist shown-head skip does not consume a malformed scenario flag", () => {
    const game = fixture(),
      registry = rules();
    game.identities.a.headShown = true;
    game.scenarioRoleShown.a = null as unknown as boolean;
    registry.operations!.push(
      createCareeristOperation({
        showHead: (target) => ({ name: "show-general", data: { target } }),
      }),
    );
    const before = structuredClone(game);
    expect(
      run(game, registry, "careerist-rule", null).operationCompletion?.value,
    ).toBe(false);
    expect(game).toEqual(before);
  });
  it.each<TriggerData>([
    null,
    {},
    { target: "ghost" },
    { target: "a", head: null },
    { target: "a", triggerEvent: 0 },
    { target: "a", sendLog: "false" },
    { target: "a", ignoreRule: null },
  ])("rejects malformed input %j before state mutation", (data) => {
    const game = fixture(),
      before = structuredClone(game);
    expect(() => run(game, rules(), "show-general", data)).toThrow();
    expect(game).toEqual(before);
  });
  it.each<[string, (game: Game) => void]>([
    [
      "scenario flag",
      (g) => {
        g.scenarioRoleShown.a = null as unknown as boolean;
      },
    ],
    [
      "actual names",
      (g) => {
        g.generalNames.a = null as unknown as string[];
      },
    ],
    [
      "missing deputy",
      (g) => {
        g.generalNames.a = ["a-head"];
      },
    ],
    [
      "definition",
      (g) => {
        g.generalCatalog["a-deputy"].lord = 1 as unknown as boolean;
      },
    ],
    [
      "displayed",
      (g) => {
        g.displayedGenerals.a.deputy = null as unknown as string;
      },
    ],
  ])("rejects malformed %s before preshow", (_label, change) => {
    const game = fixture();
    change(game);
    const before = structuredClone(game);
    expect(() =>
      run(game, rules(), "show-general", { target: "a", head: false }),
    ).toThrow();
    expect(game).toEqual(before);
  });
  it("rejects nonboolean guard output before any effect", () => {
    const game = fixture(),
      before = structuredClone(game);
    expect(() =>
      run(
        game,
        rules(() => null as unknown as boolean),
        "show-general",
        { target: "a", ignoreRule: false },
      ),
    ).toThrow("Invalid canShow result");
    expect(game).toEqual(before);
  });
});
