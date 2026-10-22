import { damageRoomTags } from "./damage";
import type { GeneralGame } from "./general-identity";
import type { DrawPileGame } from "./draw-pile";
import { setGeneralMark } from "./general-rule";
import { readSlashInteger } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export type GameStartGame = DrawPileGame & GeneralGame;
export interface GameStartSettings {
  image: boolean;
  viewDeputy: boolean;
  mode: string;
  luckLimit: number;
}
export type StartupSkill = {
  name: string;
  frequency: string;
  limitMark: string;
  lord: boolean;
};
export type GameStartNotice =
  | { kind: "lightbox"; name: string; duration: number }
  | { kind: "delay"; duration: number }
  | { kind: "known-general"; viewer: string; target: string; name: string }
  | { kind: "view-generals"; viewer: string; names: string[] }
  | { kind: "set-mark"; target: string; name: string; value: number };
export interface GameStartRules<G extends GameStartGame> {
  settings: (game: Readonly<G>) => GameStartSettings;
  hasGeneral: (game: Readonly<G>, target: string) => boolean;
  visibleSkills: (game: Readonly<G>, target: string) => readonly StartupSkill[];
  hasLordSkill: (game: Readonly<G>, target: string, skill: string) => boolean;
  nextAlive: (game: Readonly<G>, target: string) => string;
  notify: (notice: GameStartNotice) => TriggerOperation | null;
}
function settings<G extends GameStartGame>(game: G, rules: GameStartRules<G>) {
  const value = rules.settings(structuredClone(game));
  if (
    !value ||
    typeof value.image !== "boolean" ||
    typeof value.viewDeputy !== "boolean" ||
    typeof value.mode !== "string"
  )
    throw new Error("Invalid startup settings");
  return { ...value, luckLimit: readSlashInteger(value.luckLimit) };
}
function visibleSkills<G extends GameStartGame>(
  game: G,
  target: string,
  rules: GameStartRules<G>,
) {
  if (rules.hasGeneral(structuredClone(game), target) !== true)
    throw new Error("Startup requires a current general");
  const skills = rules.visibleSkills(structuredClone(game), target);
  if (
    !Array.isArray(skills) ||
    skills.some(
      (skill) =>
        !skill ||
        typeof skill.name !== "string" ||
        !skill.name ||
        typeof skill.frequency !== "string" ||
        typeof skill.limitMark !== "string" ||
        typeof skill.lord !== "boolean",
    )
  )
    throw new Error("Invalid startup visible skills");
  return structuredClone(skills);
}
export function createGameStartOperation<G extends GameStartGame>(
  rules: GameStartRules<G>,
): OperationHandler<G> {
  type Cursor = {
    stage: number;
    players: string[];
    index: number;
    view: {
      viewer: string;
      target: string;
      names: string[];
      next: number;
    } | null;
    skills: StartupSkill[] | null;
    skill: number;
    pending: { target: string; name: string } | null;
  };
  return {
    name: "game-start",
    validate: (_game, operation) => {
      if (operation.data !== null)
        throw new Error("Invalid game-start request");
    },
    run: ({ game, continuation }): OperationStep => {
      const cursor: Cursor =
        continuation === null
          ? {
              stage: 0,
              players: [],
              index: 0,
              view: null,
              skills: null,
              skill: 0,
              pending: null,
            }
          : (structuredClone(continuation) as Cursor);
      while (true)
        switch (cursor.stage) {
          case 0: {
            cursor.stage = 1;
            if (settings(game, rules).image) {
              const next = rules.notify({
                kind: "lightbox",
                name: "$gamestart",
                duration: 3500,
              });
              if (next)
                return {
                  kind: "operation",
                  operation: next,
                  continuation: cursor,
                };
            }
            break;
          }
          case 1: {
            const config = settings(game, rules);
            cursor.players =
              config.viewDeputy && config.mode !== "custom_scenario"
                ? [...game.seatOrder]
                : [];
            cursor.stage = 2;
            break;
          }
          case 2: {
            if (cursor.index === cursor.players.length) {
              cursor.stage = 3;
              break;
            }
            if (cursor.view === null) {
              const viewer = cursor.players[cursor.index],
                target = rules.nextAlive(structuredClone(game), viewer);
              if (
                !game.seatOrder.includes(target) ||
                game.alive[target] !== true
              )
                throw new Error("Invalid next alive startup target");
              const names = game.generalNames[target];
              if (
                !Array.isArray(names) ||
                !names.length ||
                names.some((name) => typeof name !== "string")
              )
                throw new Error("Invalid startup general names");
              cursor.view = { viewer, target, names: names.slice(1), next: 0 };
            }
            const view = cursor.view;
            if (view.next < view.names.length) {
              const name = view.names[view.next++];
              const next = rules.notify({
                kind: "known-general",
                viewer: view.viewer,
                target: view.target,
                name,
              });
              if (next)
                return {
                  kind: "operation",
                  operation: next,
                  continuation: cursor,
                };
            } else {
              cursor.view = null;
              cursor.index++;
              const next = rules.notify({
                kind: "view-generals",
                viewer: view.viewer,
                names: view.names,
              });
              if (next)
                return {
                  kind: "operation",
                  operation: next,
                  continuation: cursor,
                };
            }
            break;
          }
          case 3: {
            cursor.stage = 4;
            const next = rules.notify({ kind: "delay", duration: 3000 });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 4:
            cursor.players = [...game.seatOrder];
            cursor.index = 0;
            cursor.stage = 5;
            break;
          case 5: {
            if (cursor.pending) {
              setGeneralMark(
                game,
                cursor.pending.target,
                cursor.pending.name,
                1,
              );
              cursor.pending = null;
            }
            if (cursor.index === cursor.players.length) {
              cursor.stage = 6;
              break;
            }
            const target = cursor.players[cursor.index];
            if (cursor.skills === null) {
              cursor.skills = visibleSkills(game, target, rules);
              cursor.skill = 0;
            }
            if (cursor.skill === cursor.skills.length) {
              cursor.index++;
              cursor.skills = null;
              break;
            }
            const skill = cursor.skills[cursor.skill++];
            if (skill.frequency !== "limited" || !skill.limitMark) break;
            if (skill.lord) {
              const eligible = rules.hasLordSkill(
                structuredClone(game),
                target,
                skill.name,
              );
              if (typeof eligible !== "boolean")
                throw new Error("Invalid startup lord eligibility");
              if (!eligible) break;
            }
            cursor.pending = { target, name: skill.limitMark };
            const next = rules.notify({
              kind: "set-mark",
              target,
              name: skill.limitMark,
              value: 1,
            });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 6:
            damageRoomTags(game).FirstRound = true;
            cursor.stage = 7;
            if (settings(game, rules).mode !== "custom_scenario")
              return {
                kind: "operation",
                operation: {
                  name: "draw-cards",
                  data: {
                    players: [...game.seatOrder],
                    counts: [4],
                    reason: "",
                  },
                },
                continuation: cursor,
              };
            break;
          case 7:
            cursor.stage = 8;
            if (settings(game, rules).luckLimit > 0)
              return {
                kind: "operation",
                operation: { name: "luck-card", data: null },
                continuation: cursor,
              };
            break;
          case 8:
            return { kind: "return", value: null };
          default:
            throw new Error("Invalid startup continuation");
        }
    },
  };
}
export function createGameStartRule<
  G extends GameStartGame,
>(): TriggerSkill<G> {
  return {
    id: "game-rule-game-start",
    events: ["GameStart"],
    priority: 0,
    rule: true,
    effect: ({ game, event, operationChild }) => {
      if (operationChild) return { kind: "done", value: false };
      const tags = damageRoomTags(game);
      if (
        tags.SkipGameRule !== undefined &&
        typeof tags.SkipGameRule !== "boolean"
      )
        throw new Error("Invalid SkipGameRule");
      if (tags.SkipGameRule === true) {
        delete tags.SkipGameRule;
        return { kind: "done", value: false };
      }
      if (event.target !== null) return { kind: "done", value: false };
      return {
        kind: "operation",
        operation: { name: "game-start", data: null },
        continuation: null,
      };
    },
  };
}
