import { expect, it } from "vitest";
import type { GeneralGame } from "../../src/game/hegemony/general-identity";
import {
  createCardCommandAdmission,
  type CardCommandGame,
  type CardCommandOffer,
} from "../../src/game/hegemony/card-command";
import { createRoomUseCardOperation } from "../../src/game/hegemony/room-use-card";
import {
  createSkillCardOnUseOperation,
  type SkillCardUse,
} from "../../src/game/hegemony/skill-card-on-use";
import {
  createRewardTokenCostOperation,
  createRewardTokenUseOperation,
} from "../../src/game/hegemony/reward-tokens";
import {
  createCardUsedOperation,
  createCardUsedRule,
} from "../../src/game/hegemony/card-used";
import { createCardFinishedRule } from "../../src/game/hegemony/card-resources";
import { createCardMovementOperation } from "../../src/game/hegemony/movement";
import {
  createTriggerScheduler,
  dispatchTriggerOperation,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerRegistry,
} from "../../src/game/hegemony/scheduler";

type Game = GeneralGame & CardCommandGame;
function fixture(): Game {
  return {
    seatOrder: ["a"],
    livingPlayers: ["a"],
    currentPlayer: "a",
    seats: { a: 1 },
    alive: { a: true },
    playerFlags: { a: [] },
    playerMarks: { a: { "@halfmaxhp": 1 } },
    playerHistory: { a: {} },
    hp: { a: 3 },
    maxHp: { a: 4 },
    removed: { a: false },
    chained: { a: false },
    damageStack: [],
    currentdying: { a: "" },
    acquiredSkills: { a: { head: [], deputy: [] } },
    scenarioRoleShown: { a: false },
    identities: {
      a: {
        head: "private-head",
        deputy: "private-deputy",
        headKingdom: "wei",
        kingdom: "wei",
        role: "lord",
        headShown: false,
        deputyShown: false,
        lord: false,
        generalLord: false,
        actualHeadLord: false,
      },
    },
    generalNames: { a: ["private-head", "private-deputy"] },
    displayedGenerals: { a: { head: "anjiang", deputy: "anjiang" } },
    generalCatalog: {},
    cardZones: {
      a: { place: "hand", owner: "a", cards: [] },
      draw: { place: "draw", owner: null, cards: [2, 3] },
      table: { place: "table", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
    },
    cardResources: {
      cards: {
        TestRewardCard: {
          kind: "virtual",
          key: "reward",
          isSlash: false,
          isNDTrick: false,
          flags: [],
          tags: {},
        },
      },
      playerTags: { a: {} },
      roomTags: {},
    },
  };
}
it("admits a reward SkillCard and reloads after its real token cost without paying twice", () => {
  let game = fixture();
  // Package construction and notification are fixtures; cost/use/GameRule are real.
  const use: SkillCardUse = {
    from: "a",
    to: [],
    card: {
      type: "skill",
      name: "test_reward",
      className: "TestRewardCard",
      skillName: "halfmaxhp",
      materialIDs: [],
      flags: [],
      skillPosition: "",
      showSkill: "",
      willThrow: false,
    },
  };
  const offer: CardCommandOffer = {
    id: "private-reward",
    version: "fixture-ce4e62b",
    label: "Nửa máu",
    targetFixed: true,
    multipleVotes: false,
    entry: { use, reference: "TestRewardCard" },
  };
  const admission = createCardCommandAdmission<Game, { serverPlayer: string }>(
    {
      inPlay: () => true,
      contextValid: (_game, req) => req.context === "token-turn",
      offers: () => [offer],
      enabled: (game) => game.playerMarks.a["@halfmaxhp"] > 0,
      skillAllowed: () => true,
      matchesPattern: (_game, req) => req.reason === "play",
      materialAllowed: () => false,
      targetFilter: () => false,
      prohibited: () => false,
      feasible: (_game, _req, entry) => entry.use.to.length === 0,
    },
    (session) => session.serverPlayer,
  );
  const resources = { reference: () => "TestRewardCard" };
  const rules: TriggerRegistry<Game> = {
    version: "admitted-token-fixture-ce4e62b",
    skills: [createCardUsedRule(), createCardFinishedRule(resources)],
    operations: [
      admission.operation,
      createRoomUseCardOperation({
        parse: (_game, value) => value,
        inPlay: () => true,
        limited: () => false,
        notify: () => null,
        metadata: (_game, value) => ({
          identity: value.reference,
          realIdentity: value.reference,
          virtual: true,
          lua: false,
          delayed: false,
          handlingMethod: "none",
          canRecast: false,
          face: {
            name: "test_reward",
            className: "TestRewardCard",
            suit: "no-suit",
            number: 0,
            skillName: "halfmaxhp",
          },
          showSkill: "",
        }),
        validate: (data) => ({ name: "validate-fixture", data }),
        onUse: ({ use }) => ({ name: "skill-card-on-use", data: use }),
        after: () => ({ name: "void-fixture", data: null }),
      }),
      {
        name: "validate-fixture",
        run: ({ operation }) => ({
          kind: "return",
          value: { entry: operation.data, validated: operation.data },
        }),
      },
      { name: "void-fixture", run: () => ({ kind: "return", value: null }) },
      createSkillCardOnUseOperation({
        tableZone: "table",
        discardZone: "discard",
        extraCost: (use) => ({
          name: "reward-token-cost",
          data: { player: use.from, token: "halfmaxhp" },
        }),
        showSkill: () => ({ name: "void-fixture", data: null }),
        afterShow: () => ({ name: "pause-paid-token", data: null }),
        notifyUse: () => ({ name: "void-fixture", data: null }),
        generalName: () => "",
        cardState: (_game, card) => ({
          flags: card.flags,
          materialIDs: card.materialIDs,
        }),
      }),
      createCardUsedOperation({
        resources,
        use: (use) => ({
          name: "reward-token-use",
          data: { player: use.from, token: "halfmaxhp", targets: use.to },
        }),
      }),
      createRewardTokenCostOperation(),
      createRewardTokenUseOperation({
        draw: (player, count, reason) => ({
          name: "fixed-draw-fixture",
          data: { player, count, reason },
        }),
        peachAvailable: () => false,
        peachLocked: () => false,
        peachProhibited: () => false,
        usePeach: () => ({ name: "unexpected", data: null }),
        choice: () => ({ name: "unexpected", data: null }),
        choosePlayer: () => ({ name: "unexpected", data: null }),
        indicate: () => ({ name: "unexpected", data: null }),
        publicView: () => ({ name: "unexpected", data: null }),
        privateView: () => ({ name: "unexpected", data: null }),
      }),
      createCardMovementOperation(),
      {
        name: "fixed-draw-fixture",
        run: ({ game, continuation }) =>
          continuation === null
            ? {
                kind: "operation",
                operation: {
                  name: "move-cards",
                  data: {
                    moves: [
                      {
                        ids: game.cardZones.draw.cards.slice(0, 1),
                        to: "a",
                        open: false,
                        reason: {
                          kind: "draw",
                          actor: "a",
                          skill: "halfmaxhp",
                        },
                      },
                    ],
                  },
                },
                continuation: true,
              }
            : { kind: "return", value: null },
      },
    ],
  };
  rules.operations!.push({
    name: "pause-paid-token",
    run: ({ continuation }) =>
      continuation === null
        ? {
            kind: "prompt",
            actor: "a",
            choices: ["continue"],
            canCancel: false,
            continuation: true,
          }
        : { kind: "return", value: null },
  });
  let scheduler = createTriggerScheduler(game.seatOrder, rules.version);
  const session = { serverPlayer: "a" };
  dispatchTriggerOperation(
    scheduler,
    game,
    rules,
    {
      name: "card-use-request",
      data: {
        actor: "a",
        reason: "play",
        context: "token-turn",
        pattern: "",
        prompt: "token",
        method: "none",
        addHistory: true,
        canCancel: true,
      },
    },
    "a",
  );
  expect(JSON.stringify(admission.view(scheduler, session))).not.toContain(
    "private-",
  );
  for (let i = 0; i < 2; i++) {
    const view = admission.view(scheduler, session)!;
    expect(
      admission.submit(scheduler, game, rules, session, {
        id: view.id,
        choice: view.choices[0].id,
      }),
    ).toBe(true);
  }
  expect(game.playerMarks.a["@halfmaxhp"]).toBe(0);
  expect(game.cardZones.a.cards).toEqual([]);
  expect(admission.view(scheduler, session)).toBeNull();
  ({ game, scheduler } = JSON.parse(JSON.stringify({ game, scheduler })));
  const prompt = getTriggerPrompt(scheduler, "a")!;
  expect(
    resumeTriggerPrompt(scheduler, game, rules, "a", {
      id: prompt.id,
      choice: "continue",
    }),
  ).toBe(true);
  expect(
    resumeTriggerPrompt(scheduler, game, rules, "a", {
      id: prompt.id,
      choice: "continue",
    }),
  ).toBe(false);
  expect(scheduler.operationCompletion?.value).toEqual({ status: "used" });
  expect(game.playerMarks.a["@halfmaxhp"]).toBe(0);
  expect(game.cardZones.a.cards).toEqual([2]);
  expect(game.cardZones.draw.cards).toEqual([3]);
  expect(game.playerHistory.a).toEqual({
    TestRewardCard: 1,
    ViewAsSkill_halfmaxhpCard: 1,
  });
  expect(game.playerFlags.a).toEqual([]);
  expect(game.cardResources.cards.TestRewardCard).toMatchObject({ flags: [] });
});
