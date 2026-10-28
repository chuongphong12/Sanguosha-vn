import {
  createHegemonySetup,
  selectGeneralPair,
  projectHegemonyState,
} from "./index";
import type {
  HegemonySetupOptions,
  HegemonyState,
  GeneralPairChoice,
} from "./types";
import {
  createGameStartOperation,
  createGameStartRule,
  type GameStartRules,
  type GameStartSettings,
} from "./game-start";
import { createDrawCardsOperation } from "./draw-cards";
import {
  createDrawCardOperation,
  createGetNCardsOperation,
  createSwapPileOperation,
} from "./draw-pile";
import { createCardMovementOperation } from "./movement";
import {
  createGameOverOperation,
  createGetWinnerOperation,
  type WinnerRules,
} from "./victory";
import { hasShownGeneral } from "./general-identity";
import {
  areGeneralFriends,
  willBeGeneralFriends,
  generalRoomLord,
} from "./general-relations";
import { createMatchStartup, type MatchStartup } from "./match-startup";
import { matchStartupNotice } from "./match-notice";
import {
  createTriggerScheduler,
  getTriggerPrompt,
  resumeTriggerPrompt,
  type TriggerRegistry,
  type TriggerScheduler,
} from "./scheduler";
import {
  createMatchRoom,
  validateMatchContent,
  validateMatchDeck,
  type MatchContent,
  type MatchDeck,
  type HegemonyRoom,
} from "./match-room";

export type { MatchContent, HegemonyRoom } from "./match-room";

interface MatchVersion {
  schemaVersion: "hegemony-match-v2";
  rulesVersion: "hegemony-ce4e62b";
  contentVersion: string;
  registryVersion: string;
  /** Room configuration is part of recovery identity, independent of registry code. */
  startupSettings: GameStartSettings;
  /** Package global IDs bind registry classification across recovery. */
  startupGlobals: string[];
}
export type HegemonyMatch = MatchVersion &
  (
    | { phase: "setup"; setup: HegemonyState; deck: MatchDeck }
    | {
        phase: "room";
        room: HegemonyRoom;
        scheduler: TriggerScheduler;
        startup: MatchStartup;
      }
  );
export type MatchCommand =
  | { kind: "choose-pair"; choice: GeneralPairChoice }
  | { kind: "answer"; id: string; choice: string | null };

interface MatchRules {
  content: MatchContent;
  registryVersion: string;
  startup: {
    settings: GameStartSettings;
    visibleSkills: GameStartRules<HegemonyRoom>["visibleSkills"];
    hasLordSkill: GameStartRules<HegemonyRoom>["hasLordSkill"];
    globalSkills: string[];
    hasPlayerStartup: (room: Readonly<HegemonyRoom>, player: string) => boolean;
    winner: Pick<WinnerRules<HegemonyRoom>, "showGeneral" | "careerist">;
  };
  skills?: TriggerRegistry<HegemonyRoom>["skills"];
  operations?: TriggerRegistry<HegemonyRoom>["operations"];
}

/** Internal application seam; no production registration, network auth or full-turn owner. */
export function createHegemonyMatch(options: MatchRules) {
  const content = structuredClone(options.content),
    settings = structuredClone(options.startup.settings);
  validateMatchContent(content);
  const globalIds = [...options.startup.globalSkills].sort();
  if (
    !options.registryVersion ||
    typeof settings.image !== "boolean" ||
    typeof settings.viewDeputy !== "boolean" ||
    settings.mode !== "hegemony" ||
    !Number.isSafeInteger(settings.luckLimit) ||
    settings.luckLimit < 0
  )
    throw new Error("Invalid match registry/settings");
  if (
    new Set(globalIds).size !== globalIds.length ||
    globalIds.some(
      (id) => !(options.skills ?? []).some((skill) => skill.id === id),
    ) ||
    typeof options.startup.hasPlayerStartup !== "function" ||
    typeof options.startup.winner?.showGeneral !== "function" ||
    typeof options.startup.winner?.careerist !== "function"
  )
    throw new Error("Invalid match startup classification/adapters");
  const version: MatchVersion = {
    schemaVersion: "hegemony-match-v2",
    rulesVersion: "hegemony-ce4e62b",
    contentVersion: content.version,
    registryVersion: options.registryVersion,
    startupSettings: structuredClone(settings),
    startupGlobals: globalIds,
  };
  const piles = {
    drawZone: "draw",
    reservedZone: "reserved",
    discardZone: "discard",
    notify: () => null,
  };
  const startup: GameStartRules<HegemonyRoom> = {
    settings: () => structuredClone(settings),
    hasGeneral: (room, player) =>
      room.generalNames[player].every((name) =>
        Boolean(room.generalCatalog[name]),
      ),
    visibleSkills: options.startup.visibleSkills,
    hasLordSkill: options.startup.hasLordSkill,
    nextAlive: (room, player) =>
      room.livingPlayers[
        (room.livingPlayers.indexOf(player) + 1) % room.livingPlayers.length
      ],
    notify: (notice) => ({ name: "match-start-notice", data: notice }),
  };
  const registry: TriggerRegistry<HegemonyRoom> = {
    version: `${options.registryVersion}:startup-full`,
    skills: [...(options.skills ?? []), createGameStartRule()],
    operations: [
      ...(options.operations ?? []),
      createGameStartOperation(startup),
      createDrawCardsOperation(),
      createGetNCardsOperation(piles),
      createDrawCardOperation(piles),
      createSwapPileOperation(piles),
      createCardMovementOperation(),
      createGameOverOperation(),
      createGetWinnerOperation({
        ...options.startup.winner,
        hasShown: hasShownGeneral,
        isFriend: areGeneralFriends,
        willBeFriend: willBeGeneralFriends,
        getLord: (room, kingdom) => generalRoomLord(room, kingdom, true),
      }),
      {
        name: "match-start-notice",
        run: ({ game, operation }) => {
          game.startupNotices.push(matchStartupNotice(operation.data));
          return { kind: "return", value: null };
        },
      },
    ],
  };
  const operationNames = registry.operations!.map((op) => op.name);
  if (
    new Set(operationNames).size !== operationNames.length ||
    new Set(registry.skills.map((s) => s.id)).size !== registry.skills.length ||
    (settings.luckLimit > 0 && !operationNames.includes("luck-card"))
  )
    throw new Error("Invalid match operation composition");
  const owner = createMatchStartup(
    {
      ...registry,
      version: `${options.registryVersion}:startup-global`,
      skills: registry.skills.filter(
        (s) => s.id === "game-rule-game-start" || globalIds.includes(s.id),
      ),
    },
    registry,
    options.startup.hasPlayerStartup,
  );

  function compatible(state: HegemonyMatch) {
    if (
      state.schemaVersion !== version.schemaVersion ||
      state.rulesVersion !== version.rulesVersion ||
      state.contentVersion !== version.contentVersion ||
      state.registryVersion !== version.registryVersion ||
      !["setup", "room"].includes(state.phase)
    )
      throw new Error("Incompatible Hegemony match");
    if (JSON.stringify(state.startupGlobals) !== JSON.stringify(globalIds))
      throw new Error("Incompatible match startup classification");
    if (
      !state.startupSettings ||
      state.startupSettings.image !== settings.image ||
      state.startupSettings.viewDeputy !== settings.viewDeputy ||
      state.startupSettings.mode !== settings.mode ||
      state.startupSettings.luckLimit !== settings.luckLimit
    )
      throw new Error("Incompatible match startup settings");
    if (
      (state.phase === "room" && ("setup" in state || "deck" in state)) ||
      (state.phase === "setup" &&
        ("room" in state || "scheduler" in state || "startup" in state))
    )
      throw new Error("Conflicting match authority");
    if (state.phase === "room") owner.validate(state);
  }
  function create(
    config: Omit<HegemonySetupOptions, "generals"> & MatchDeck,
  ): HegemonyMatch {
    validateMatchDeck(content, config);
    const setup = createHegemonySetup({
      generals: content.generals,
      offers: config.offers,
      bannedPairs: config.bannedPairs,
    });
    if (
      setup.seatOrder.length < 2 ||
      setup.seatOrder.length > 10 ||
      setup.seatOrder.some((id) => !id)
    )
      throw new Error("Hegemony requires 2–10 seats");
    return {
      ...structuredClone(version),
      phase: "setup",
      setup,
      deck: { drawPile: [...config.drawPile], randomState: config.randomState },
    };
  }
  function apply(
    state: HegemonyMatch,
    actor: string,
    command: MatchCommand,
  ): HegemonyMatch | null {
    compatible(state);
    const next = structuredClone(state);
    if (next.phase === "setup") {
      if (
        command.kind !== "choose-pair" ||
        !selectGeneralPair(next.setup, actor, command.choice)
      )
        return null;
      if (next.setup.status !== "ready") return next;
      const room = createMatchRoom(next.setup, content, next.deck);
      const scheduler = createTriggerScheduler(
        room.seatOrder,
        `${version.registryVersion}:startup-global`,
      );
      const prepared: HegemonyMatch = {
        ...structuredClone(version),
        phase: "room",
        room,
        scheduler,
        startup: { stage: "winner", waiting: false },
      };
      owner.advance(prepared);
      return prepared;
    }
    if (
      command.kind !== "answer" ||
      next.room.gameResult !== null ||
      !resumeTriggerPrompt(
        next.scheduler,
        next.room,
        owner.registry(next.startup),
        actor,
        {
          id: command.id,
          choice: command.choice,
        },
      )
    )
      return null;
    owner.advance(next);
    return next;
  }
  function view(state: HegemonyMatch, viewer: string | null) {
    compatible(state);
    if (state.phase === "setup")
      return {
        stage: "setup",
        ...projectHegemonyState(state.setup, viewer),
        hand: [] as number[],
        marks: {},
        prompt: null,
      };
    const room = state.room,
      own = viewer !== null && room.seatOrder.includes(viewer) ? viewer : null;
    const hand = (player: string) =>
      Object.values(room.cardZones).find(
        (zone) => zone.owner === player && zone.place === "hand",
      )!.cards;
    const pending = getTriggerPrompt(state.scheduler, own);
    return {
      rulesVersion: version.rulesVersion,
      stage:
        room.gameResult !== null
          ? "finished"
          : state.scheduler.interruption
            ? "interrupted"
            : state.startup.stage !== "complete"
              ? "starting"
              : "prepared",
      result: room.gameResult,
      seatOrder: [...room.seatOrder],
      currentPlayer: room.currentPlayer,
      players: Object.fromEntries(
        room.seatOrder.map((id) => {
          const identity = room.identities[id];
          return [
            id,
            {
              hp: room.hp[id],
              maxHp: room.maxHp[id],
              alive: room.alive[id],
              handCount: hand(id).length,
              head: {
                id:
                  own === id
                    ? room.generalNames[id][0]
                    : identity.headShown
                      ? room.displayedGenerals[id].head
                      : null,
                shown: identity.headShown,
              },
              deputy: {
                id:
                  own === id
                    ? room.generalNames[id][1]
                    : identity.deputyShown
                      ? room.displayedGenerals[id].deputy
                      : null,
                shown: identity.deputyShown,
              },
              kingdom:
                own === id ||
                identity.headShown ||
                identity.deputyShown ||
                room.scenarioRoleShown[id]
                  ? identity.kingdom
                  : null,
            },
          ];
        }),
      ),
      hand: own === null ? [] : [...hand(own)],
      marks: own === null ? {} : structuredClone(room.playerMarks[own]),
      notices: structuredClone(
        room.startupNotices
          .map(matchStartupNotice)
          .filter((notice) =>
            "viewer" in notice
              ? notice.viewer === own
              : notice.kind === "set-mark"
                ? notice.target === own
                : true,
          ),
      ),
      prompt:
        pending === null
          ? null
          : {
              id: pending.id,
              choices: pending.choices.map((c) => c.id),
              canCancel: pending.canCancel,
            },
    };
  }
  function restore(serialized: string): HegemonyMatch {
    const value = JSON.parse(serialized);
    if (!value || typeof value !== "object")
      throw new Error("Invalid Hegemony match");
    compatible(value);
    if (value.phase === "setup") validateMatchDeck(content, value.deck);
    else {
      const room: HegemonyRoom = value.room;
      if (
        !room ||
        !Array.isArray(room.seatOrder) ||
        room.seatOrder.length < 2 ||
        room.seatOrder.length > 10 ||
        new Set(room.seatOrder).size !== room.seatOrder.length ||
        JSON.stringify(room.seatOrder) !==
          JSON.stringify(value.scheduler.seatOrder) ||
        !Array.isArray(value.scheduler.frames) ||
        (room.gameResult !== null && typeof room.gameResult !== "string")
      )
        throw new Error("Invalid match Room/scheduler composition");
      const ids = Object.values(room.cardZones).flatMap((zone) => zone.cards);
      if (
        ids.length !== content.cards.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !content.cards.some((card) => card.id === id)) ||
        room.seatOrder.some(
          (actor) =>
            Object.values(room.cardZones).filter(
              (zone) => zone.place === "hand" && zone.owner === actor,
            ).length !== 1,
        )
      )
        throw new Error("Invalid match card inventory");
      room.startupNotices = room.startupNotices.map(matchStartupNotice);
      owner.advance(value);
    }
    return structuredClone(value);
  }
  return { create, apply, view, restore };
}
