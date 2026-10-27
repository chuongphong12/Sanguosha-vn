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
import { createGameOverOperation } from "./victory";
import { matchStartupNotice } from "./match-notice";
import {
  createTriggerScheduler,
  dispatchTriggerEvent,
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
  schemaVersion: "hegemony-match-v1";
  rulesVersion: "hegemony-ce4e62b";
  contentVersion: string;
  registryVersion: string;
  /** Room configuration is part of recovery identity, independent of registry code. */
  startupSettings: GameStartSettings;
}
export type HegemonyMatch = MatchVersion &
  (
    | { phase: "setup"; setup: HegemonyState; deck: MatchDeck }
    | { phase: "room"; room: HegemonyRoom; scheduler: TriggerScheduler }
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
  };
  skills?: TriggerRegistry<HegemonyRoom>["skills"];
  operations?: TriggerRegistry<HegemonyRoom>["operations"];
}

/** Internal application seam; no production registration, network auth or full-turn owner. */
export function createHegemonyMatch(options: MatchRules) {
  const content = structuredClone(options.content),
    settings = structuredClone(options.startup.settings);
  validateMatchContent(content);
  if (
    !options.registryVersion ||
    typeof settings.image !== "boolean" ||
    typeof settings.viewDeputy !== "boolean" ||
    settings.mode !== "hegemony" ||
    !Number.isSafeInteger(settings.luckLimit) ||
    settings.luckLimit < 0
  )
    throw new Error("Invalid match registry/settings");
  const version: MatchVersion = {
    schemaVersion: "hegemony-match-v1",
    rulesVersion: "hegemony-ce4e62b",
    contentVersion: content.version,
    registryVersion: options.registryVersion,
    startupSettings: structuredClone(settings),
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
    version: options.registryVersion,
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

  function compatible(state: HegemonyMatch) {
    if (
      state.schemaVersion !== version.schemaVersion ||
      state.rulesVersion !== version.rulesVersion ||
      state.contentVersion !== version.contentVersion ||
      state.registryVersion !== version.registryVersion ||
      !["setup", "room"].includes(state.phase) ||
      (state.phase === "room" &&
        state.scheduler.registryVersion !== version.registryVersion)
    )
      throw new Error("Incompatible Hegemony match");
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
      (state.phase === "setup" && ("room" in state || "scheduler" in state))
    )
      throw new Error("Conflicting match authority");
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
        version.registryVersion,
      );
      if (
        !dispatchTriggerEvent(
          scheduler,
          room,
          registry,
          { name: "GameStart", target: null, data: null },
          room.currentPlayer,
        )
      )
        throw new Error("Cannot dispatch match startup");
      return { ...structuredClone(version), phase: "room", room, scheduler };
    }
    if (
      command.kind !== "answer" ||
      next.room.gameResult !== null ||
      !resumeTriggerPrompt(next.scheduler, next.room, registry, actor, {
        id: command.id,
        choice: command.choice,
      })
    )
      return null;
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
            : state.scheduler.frames.length
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
    }
    return structuredClone(value);
  }
  return { create, apply, view, restore };
}
