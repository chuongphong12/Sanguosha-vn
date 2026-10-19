import { describe, expect, it } from "vitest";
import {
  createCardCommandAdmission,
  type CardCommandGame,
  type CardCommandRules,
  type CardUseRequest,
  type CardCommandOffer,
} from "../../src/game/hegemony/card-command";
import { createRoomUseCardOperation } from "../../src/game/hegemony/room-use-card";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import { createCardOnUseOperation } from "../../src/game/hegemony/card-on-use";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardUseOperation } from "../../src/game/hegemony/card-use";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  type TriggerRegistry,
  type TriggerData,
} from "../../src/game/hegemony/scheduler";

type Game = CardCommandGame & {
  phase: string;
  trace: TriggerData[];
  permitted: boolean;
  requestEpoch: string;
};
// Fixture authentication represents a trusted server session, never the reply body.
type Session = { boundPlayer: string | null };
const session = (boundPlayer: string | null): Session => ({ boundPlayer });
function fixture(): Game {
  return {
    seatOrder: ["a", "b", "c"],
    alive: { a: true, b: true, c: false },
    currentPlayer: "a",
    phase: "play",
    permitted: true,
    requestEpoch: "turn-1",
    playerFlags: { a: [], b: [], c: [] },
    playerHistory: { a: {}, b: {}, c: {} },
    cardZones: {
      hand: { place: "hand", owner: "a", cards: [1] },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    cardResources: {
      cards: {
        Test: {
          kind: "virtual",
          key: "test",
          isSlash: false,
          isNDTrick: false,
          flags: [],
          tags: {},
        },
      },
      playerTags: { a: {}, b: {}, c: {} },
      roomTags: {},
    },
    trace: [],
  };
}
function offer(): CardCommandOffer {
  return {
    id: "private-card-1",
    label: "Bài thử nghiệm",
    version: "fixture-ce4e62b",
    targetFixed: true,
    multipleVotes: false,
    entry: {
      reference: "Test",
      use: {
        from: "a",
        to: [],
        card: {
          type: "basic",
          name: "test",
          className: "Test",
          skillName: "",
          materialIDs: [1],
          flags: [],
        },
      },
    },
  };
}
function request(): CardUseRequest {
  return {
    actor: "a",
    reason: "play",
    context: "turn-1",
    pattern: "",
    prompt: "test",
    method: "use",
    addHistory: true,
    canCancel: true,
  };
}
function setup(overrides: Partial<CardCommandRules<Game>> = {}) {
  const game = fixture();
  const admission = createCardCommandAdmission<Game, Session>(
    {
      inPlay: (game) => game.phase === "play",
      contextValid: (game, req) => game.requestEpoch === req.context,
      offers: () => [offer()],
      enabled: (game) => game.permitted,
      skillAllowed: () => true,
      matchesPattern: (_game, req) =>
        req.pattern === "" || req.pattern === "test",
      materialAllowed: (game, req, _offer, _id, zone) =>
        game.cardZones[zone].owner === req.actor &&
        game.cardZones[zone].place === "hand",
      targetFilter: (game, _req, entry, target) =>
        game.alive[target] &&
        target !== entry.use.from &&
        entry.use.to.length < 1,
      prohibited: () => false,
      feasible: (_game, _req, entry) => entry.use.to.length === 0,
      ...overrides,
    },
    (auth) => auth.boundPlayer,
  );
  const resources = { reference: () => "Test" };
  const rules: TriggerRegistry<Game> = {
    version: "command-fixture-ce4e62b",
    skills: [createCardUsedRule(), createCardFinishedRule(resources)],
    operations: [
      admission.operation,
      createRoomUseCardOperation({
        parse: (_game, entry) => entry,
        inPlay: (game) => game.phase === "play",
        limited: () => false,
        notify: () => null,
        metadata: (_game, entry) => ({
          identity: entry.reference,
          realIdentity: entry.reference,
          virtual: true,
          lua: false,
          delayed: false,
          handlingMethod: "use",
          canRecast: false,
          face: {
            name: "test",
            className: "Test",
            skillName: "",
            suit: "no-suit",
            number: 0,
          },
          showSkill: "",
        }),
        validate: (data) => ({ name: "validate-fixture", data }),
        onUse: ({ use }) => ({ name: "card-on-use", data: use }),
        after: (data) => ({ name: "after-fixture", data }),
      }),
      {
        name: "validate-fixture",
        run: ({ operation }) => ({
          kind: "return",
          value: { entry: operation.data, validated: operation.data },
        }),
      },
      {
        name: "after-fixture",
        run: ({ game, operation }) => {
          game.trace.push(operation.data);
          return { kind: "return", value: null };
        },
      },
      createCardOnUseOperation({ tableZone: "table", discardZone: "discard" }),
      createCardMovementOperation(),
      createCardUsedOperation({
        resources,
        use: (data) => ({ name: "card-use", data }),
      }),
      createCardUseOperation({
        ...resources,
        effect: (data) => ({ name: "effect-fixture", data }),
      }),
      {
        name: "effect-fixture",
        run: ({ game, operation }) => {
          game.trace.push(operation.data);
          return { kind: "return", value: null };
        },
      },
    ],
  };
  const scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  return { game, rules, scheduler, admission };
}
describe("authoritative card command admission", () => {
  it.each(["back", "cancel"] as const)(
    "allows %s to discard an inaccessible selection without paying",
    (action) => {
      const { game, rules, scheduler, admission } = setup();
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-use-request", data: request() },
        "a",
      );
      const first = admission.view(scheduler, session("a"))!;
      admission.submit(scheduler, game, rules, session("a"), {
        id: first.id,
        choice: first.choices[0].id,
      });
      game.cardZones.hand.cards = [];
      game.cardZones.discard.cards = [1];
      const view = admission.view(scheduler, session("a"))!;
      const choice =
        action === "cancel"
          ? null
          : view.choices.find((choice) => choice.label === "Chọn lại bài")!.id;
      expect(
        admission.submit(scheduler, game, rules, session("a"), {
          id: view.id,
          choice,
        }),
      ).toBe(true);
      if (action === "cancel")
        expect(scheduler.operationCompletion?.value).toEqual({
          status: "cancelled",
        });
      else
        expect(
          admission
            .view(scheduler, session("a"))!
            .choices.map((choice) => choice.label),
        ).toEqual(["Không dùng bài"]);
      expect(game.playerHistory.a).toEqual({});
      expect(game.trace).toEqual([]);
    },
  );
  it("allows back to discard a prohibited selected target prefix", () => {
    const targeted = offer();
    targeted.targetFixed = false;
    const { game, rules, scheduler, admission } = setup({
      offers: () => [targeted],
      enabled: () => true,
      feasible: (_game, _req, entry) => entry.use.to.length === 1,
      prohibited: (game) => !game.permitted,
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    for (let i = 0; i < 2; i++) {
      const view = admission.view(scheduler, session("a"))!;
      admission.submit(scheduler, game, rules, session("a"), {
        id: view.id,
        choice: view.choices[0].id,
      });
    }
    game.permitted = false;
    const view = admission.view(scheduler, session("a"))!;
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: view.id,
        choice: view.choices.find((choice) => choice.label === "Chọn lại bài")!
          .id,
      }),
    ).toBe(true);
    expect(admission.view(scheduler, session("a"))!.choices[0].label).toBe(
      "Bài thử nghiệm",
    );
    expect(game.playerHistory.a).toEqual({});
    expect(game.cardZones.hand.cards).toEqual([1]);
  });
  it.each(["skillAllowed", "matchesPattern"] as const)(
    "does not offer a card when %s denies its current context",
    (predicate) => {
      const { game, rules, scheduler, admission } = setup({
        [predicate]: () => false,
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-use-request", data: request() },
        "a",
      );
      expect(
        admission
          .view(scheduler, session("a"))!
          .choices.map((choice) => choice.label),
      ).toEqual(["Không dùng bài"]);
      expect(game.playerHistory.a).toEqual({});
      expect(game.cardZones.hand.cards).toEqual([1]);
    },
  );
  it.each(["multipleVotes", "manualTargets"] as const)(
    "does not advertise unsupported %s metadata",
    (variant) => {
      const unsupported = offer();
      if (variant === "multipleVotes") unsupported.multipleVotes = true;
      else unsupported.entry.use.to = ["b"];
      const { game, rules, scheduler, admission } = setup({
        offers: () => [unsupported],
      });
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-use-request", data: request() },
        "a",
      );
      expect(
        admission
          .view(scheduler, session("a"))!
          .choices.map((choice) => choice.label),
      ).toEqual(["Không dùng bài"]);
    },
  );
  it("uses explicit package permission for equipment/private-pile materials rather than requiring hand cards", () => {
    const { game, rules, scheduler, admission } = setup({
      materialAllowed: (game, req, _offer, _id, zone) =>
        game.cardZones[zone].owner === req.actor &&
        game.cardZones[zone].place === "special",
    });
    game.cardZones.hand.place = "special";
    game.cardZones.hand.pileName = "private-pile";
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    for (let i = 0; i < 2; i++) {
      const view = admission.view(scheduler, session("a"))!;
      expect(
        admission.submit(scheduler, game, rules, session("a"), {
          id: view.id,
          choice: view.choices[0].id,
        }),
      ).toBe(true);
    }
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.trace[0]).toMatchObject({ use: { m_isHandcard: false } });
  });
  it("restores private offer bindings from JSON and rejects stale, replayed and mismatched-registry replies", () => {
    const setupResult = setup();
    const { rules, admission } = setupResult;
    let { game, scheduler } = setupResult;
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    const first = admission.view(scheduler, session("a"))!;
    admission.submit(scheduler, game, rules, session("a"), {
      id: first.id,
      choice: first.choices[0].id,
    });
    ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
    const view = admission.view(scheduler, session("a"))!;
    const before = JSON.stringify({ game, scheduler });
    for (const reply of [
      { id: first.id, choice: first.choices[0].id },
      { id: view.id, choice: "forged" },
      null,
      { id: view.id, choice: view.choices[0].id, targets: ["b"] },
    ])
      expect(
        admission.submit(scheduler, game, rules, session("a"), reply),
      ).toBe(false);
    expect(
      admission.submit(
        scheduler,
        game,
        { ...rules, version: "other" },
        session("a"),
        { id: view.id, choice: view.choices[0].id },
      ),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(before);
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: view.id,
        choice: view.choices[0].id,
      }),
    ).toBe(true);
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: view.id,
        choice: view.choices[0].id,
      }),
    ).toBe(false);
    expect(game.playerHistory.a.Test).toBe(1);
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it("rejects a target that becomes prohibited before reply and rechecks a completed prefix before confirm", () => {
    const targeted = offer();
    targeted.targetFixed = false;
    const { game, rules, scheduler, admission } = setup({
      offers: () => [targeted],
      enabled: () => true,
      feasible: (_game, _req, entry) => entry.use.to.length === 1,
      prohibited: (game) => !game.permitted,
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    const select = admission.view(scheduler, session("a"))!;
    admission.submit(scheduler, game, rules, session("a"), {
      id: select.id,
      choice: select.choices[0].id,
    });
    let view = admission.view(scheduler, session("a"))!;
    game.permitted = false;
    let before = JSON.stringify({ game, scheduler });
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: view.id,
        choice: view.choices[0].id,
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(before);
    game.permitted = true;
    admission.submit(scheduler, game, rules, session("a"), {
      id: view.id,
      choice: view.choices[0].id,
    });
    view = admission.view(scheduler, session("a"))!;
    game.permitted = false;
    before = JSON.stringify({ game, scheduler });
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: view.id,
        choice: view.choices[0].id,
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(before);
  });
  it("emits PlayCard before choosing and ignores ChoiceMade consumption and payload rewrites", () => {
    const { game, rules, scheduler, admission } = setup();
    rules.skills.push({
      id: "entry-events",
      events: ["PlayCard", "ChoiceMade"],
      priority: 5,
      rule: true,
      effect: ({ game, event }) => {
        game.trace.push(event.name);
        if (event.name === "ChoiceMade")
          event.data = { from: "b", to: [], card: null };
        return { kind: "done", value: true };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    expect(game.trace).toEqual(["PlayCard"]);
    for (let i = 0; i < 2; i++) {
      const view = admission.view(scheduler, session("a"))!;
      expect(
        admission.submit(scheduler, game, rules, session("a"), {
          id: view.id,
          choice: view.choices[0].id,
        }),
      ).toBe(true);
    }
    expect(game.trace.slice(0, 2)).toEqual(["PlayCard", "ChoiceMade"]);
    expect(game.playerHistory.a.Test).toBe(1);
    expect(game.playerHistory.b).toEqual({});
  });
  it("revalidates permission after yielding ChoiceMade before charging history or cost", () => {
    const { game, rules, scheduler, admission } = setup();
    rules.skills.push({
      id: "revoke",
      events: ["ChoiceMade"],
      priority: 5,
      rule: true,
      effect: ({ game }) => {
        game.permitted = false;
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    for (let i = 0; i < 2; i++) {
      const view = admission.view(scheduler, session("a"))!;
      expect(
        admission.submit(scheduler, game, rules, session("a"), {
          id: view.id,
          choice: view.choices[0].id,
        }),
      ).toBe(true);
    }
    expect(game.playerHistory.a).toEqual({});
    expect(game.cardZones.hand.cards).toEqual([1]);
    expect(
      admission
        .view(scheduler, session("a"))!
        .choices.map((choice) => choice.label),
    ).toEqual(["Không dùng bài"]);
  });
  it("requests response-use as a child outside Play, retries a real Room false, and distinguishes cancellation", () => {
    const { game, rules, scheduler, admission } = setup();
    game.phase = "finish";
    game.currentPlayer = "b";
    rules.operations!.push({
      name: "parent",
      run: ({ continuation }) =>
        continuation === null
          ? {
              kind: "operation",
              operation: {
                name: "card-use-request",
                data: { ...request(), reason: "response-use", pattern: "test" },
              },
              continuation: true,
            }
          : { kind: "return", value: "parent-completed" },
    });
    rules.operations![2] = {
      name: "validate-fixture",
      run: ({ game }) => {
        game.trace.push("eager-reveal");
        return { kind: "return", value: null };
      },
    };
    rules.skills.push({
      id: "cancel-trace",
      events: ["ChoiceMade"],
      priority: 5,
      rule: true,
      effect: ({ game, event }) => {
        game.trace.push(event.data);
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "parent", data: null },
      "b",
    );
    const first = admission.view(scheduler, session("a"))!;
    admission.submit(scheduler, game, rules, session("a"), {
      id: first.id,
      choice: first.choices[0].id,
    });
    const confirm = admission.view(scheduler, session("a"))!;
    admission.submit(scheduler, game, rules, session("a"), {
      id: confirm.id,
      choice: confirm.choices[0].id,
    });
    const retry = admission.view(scheduler, session("a"))!;
    expect(retry.id).not.toBe(first.id);
    expect(retry.choices[0].label).toBe("Bài thử nghiệm");
    const before = JSON.stringify({ game, scheduler });
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: confirm.id,
        choice: confirm.choices[0].id,
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(before);
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: retry.id,
        choice: null,
      }),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toBe("parent-completed");
    expect(game.trace).toContain("eager-reveal");
    expect(game.trace).toContain("cardUsed:test:test:nil");
    expect(game.playerHistory.a).toEqual({});
    expect(game.cardZones.hand.cards).toEqual([1]);
  });
  it("checks an ordered target prefix and final feasibility using card policy", () => {
    const targeted = offer();
    targeted.targetFixed = false;
    const { game, rules, scheduler, admission } = setup({
      offers: () => [targeted],
      targetFilter: (_game, _req, entry, target) =>
        entry.use.to.length === 0
          ? target === "c"
          : entry.use.to.length === 1 && target === "b",
      feasible: (_game, _req, entry) => entry.use.to.length === 2,
    });
    rules.skills.push({
      id: "observe-choice",
      events: ["ChoiceMade"],
      priority: 5,
      rule: true,
      effect: ({ game, event }) => {
        game.trace.push(event.data);
        return { kind: "done", value: false };
      },
    });
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    const choose = (label: string) => {
      const view = admission.view(scheduler, session("a"))!;
      const choice = view.choices.find((choice) => choice.label === label)!;
      expect(choice).toBeDefined();
      expect(
        admission.submit(scheduler, game, rules, session("a"), {
          id: view.id,
          choice: choice.id,
        }),
      ).toBe(true);
    };
    choose("Bài thử nghiệm");
    expect(
      admission
        .view(scheduler, session("a"))!
        .choices.map((choice) => choice.label),
    ).toEqual(["c", "Chọn lại bài"]);
    choose("c");
    choose("b");
    choose("Xác nhận");
    expect(scheduler.operationCompletion?.value).toEqual({ status: "used" });
    expect(game.trace[0]).toMatchObject({ from: "a", to: ["c", "b"] });
    expect(game.cardZones.discard.cards).toEqual([1]);
  });
  it.each([
    ["forged actor", { actor: "a" }],
    ["forged descriptor", { card: { name: "slash" } }],
  ])("rejects %s fields without changing the request", (_name, extra) => {
    const { game, rules, scheduler, admission } = setup();
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    const view = admission.view(scheduler, session("a"))!;
    const before = JSON.stringify({ game, scheduler });
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: view.id,
        choice: view.choices[0].id,
        ...extra,
      }),
    ).toBe(false);
    expect(JSON.stringify({ game, scheduler })).toBe(before);
  });
  it.each([
    [
      "phase",
      (game: Game) => {
        game.phase = "finish";
      },
    ],
    [
      "active player",
      (game: Game) => {
        game.currentPlayer = "b";
      },
    ],
    [
      "death",
      (game: Game) => {
        game.alive.a = false;
      },
    ],
    [
      "request epoch",
      (game: Game) => {
        game.requestEpoch = "turn-2";
      },
    ],
    [
      "availability",
      (game: Game) => {
        game.permitted = false;
      },
    ],
    [
      "material location",
      (game: Game) => {
        game.cardZones.hand.cards = [];
        game.cardZones.discard.cards = [1];
      },
    ],
  ])(
    "rechecks current %s before consuming an offered choice",
    (_name, change) => {
      const { game, rules, scheduler, admission } = setup();
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-use-request", data: request() },
        "a",
      );
      const view = admission.view(scheduler, session("a"))!;
      change(game);
      const before = JSON.stringify({ game, scheduler });
      expect(
        admission.submit(scheduler, game, rules, session("a"), {
          id: view.id,
          choice: view.choices[0].id,
        }),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    },
  );
  it("projects choices only to the bound actor and rejects missing or other identities", () => {
    const { game, rules, scheduler, admission } = setup();
    dispatchTriggerOperation(
      scheduler,
      game,
      rules,
      { name: "card-use-request", data: request() },
      "a",
    );
    const view = admission.view(scheduler, session("a"))!;
    expect(JSON.stringify(view)).not.toMatch(
      /private-card-1|materialIDs|reference|className/,
    );
    for (const actor of [null, "b", "c"]) {
      expect(admission.view(scheduler, session(actor))).toBeNull();
      const before = JSON.stringify({ game, scheduler });
      expect(
        admission.submit(scheduler, game, rules, session(actor), {
          id: view.id,
          choice: view.choices[0].id,
        }),
      ).toBe(false);
      expect(JSON.stringify({ game, scheduler })).toBe(before);
    }
  });
  it("admits opaque card and confirm choices through the real Room wrapper and costs", () => {
    const { game, rules, scheduler, admission } = setup();
    expect(
      dispatchTriggerOperation(
        scheduler,
        game,
        rules,
        { name: "card-use-request", data: request() },
        "a",
      ),
    ).toBe(true);
    const select = admission.view(scheduler, session("a"));
    expect(select).not.toBeNull();
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: select!.id,
        choice: select!.choices[0].id,
      }),
    ).toBe(true);
    const confirm = admission.view(scheduler, session("a"));
    expect(confirm!.choices[0].label).toBe("Xác nhận");
    expect(
      admission.submit(scheduler, game, rules, session("a"), {
        id: confirm!.id,
        choice: confirm!.choices[0].id,
      }),
    ).toBe(true);
    expect(scheduler.operationCompletion?.value).toEqual({ status: "used" });
    expect(game.cardZones.discard.cards).toEqual([1]);
    expect(game.playerHistory.a.Test).toBe(1);
  });
});
