import type { DeathGame } from "./death";
import { readSlashInteger } from "./slash";
import { damageRoomTags } from "./damage";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";
export interface RoomSkillGame extends DeathGame {
  ownedSkills: Record<
    string,
    { head: Record<string, boolean>; deputy: Record<string, boolean> }
  >;
}
export type RoomSkillNotice =
  | {
      kind: "skill";
      target: string;
      name: string;
      head: boolean;
      lost: boolean;
    }
  | { kind: "limited-mark"; target: string; name: string; value: 0 | 1 };
export interface RoomSkillRules<G extends RoomSkillGame = RoomSkillGame> {
  definitions: Readonly<
    Record<string, { visible: boolean; limitMark?: string; refilter?: boolean }>
  >;
  notify: (notice: RoomSkillNotice) => TriggerOperation | null;
  isEquipSkill: (game: Readonly<G>, target: string, name: string) => boolean;
}
function skillDefinitions(input: RoomSkillRules["definitions"]) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid skill definitions");
  const definitions = structuredClone(input);
  for (const d of Object.values(definitions))
    if (
      !d ||
      typeof d.visible !== "boolean" ||
      (d.limitMark !== undefined && typeof d.limitMark !== "string") ||
      (d.refilter !== undefined && typeof d.refilter !== "boolean")
    )
      throw Error("Invalid skill definitions");
  return definitions;
}
function slots(game: RoomSkillGame, target: string) {
  if (!game.seatOrder.includes(target)) throw Error("Invalid skill player");
  const owned = game.ownedSkills?.[target],
    acquired = game.acquiredSkills?.[target];
  for (const slot of ["head", "deputy"] as const) {
    if (
      !owned?.[slot] ||
      typeof owned[slot] !== "object" ||
      Array.isArray(owned[slot]) ||
      Object.values(owned[slot]).some((v) => typeof v !== "boolean") ||
      !Array.isArray(acquired?.[slot]) ||
      acquired[slot].some((s) => typeof s !== "string")
    )
      throw Error("Invalid Room skill ledger");
  }
  return { owned, acquired };
}
/** Raw owned/acquired membership; package validity, global/ViewHas and main-skill policy are adapters. */
export function hasRoomSkill(
  game: RoomSkillGame,
  target: string,
  name: string,
): boolean {
  const { owned, acquired } = slots(game, target);
  return (
    owned.head[name] === true ||
    owned.deputy[name] === true ||
    acquired.head.includes(name) ||
    acquired.deputy.includes(name)
  );
}
export function createRoomSkillBatchOperation<G extends RoomSkillGame>(
  rules: RoomSkillRules<G>,
): OperationHandler<G> {
  const definitions = skillDefinitions(rules.definitions);
  function input(game: G, data: TriggerData) {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.target !== "string" ||
      !Array.isArray(data.skills) ||
      data.skills.some((s) => typeof s !== "string") ||
      (data.acquireOnly !== undefined && typeof data.acquireOnly !== "boolean")
    )
      throw Error("Invalid skill batch");
    slots(game, data.target);
    return {
      target: data.target,
      skills: structuredClone(data.skills) as string[],
      acquireOnly: data.acquireOnly === true,
    };
  }
  type Mutation = {
    name: string;
    head: boolean;
    lost: boolean;
    visible: boolean;
    limitMark: string | null;
  };
  type Cursor = ReturnType<typeof input> & {
    stage: number;
    index: number;
    current: Mutation | null;
    events: Mutation[];
    eventIndex: number;
  };
  return {
    name: "room-skill-batch",
    validate: (game, op) => {
      input(game, op.data);
    },
    run: ({ game, operation, continuation }): OperationStep => {
      const c: Cursor =
        continuation === null
          ? {
              ...input(game, operation.data),
              stage: 0,
              index: 0,
              current: null,
              events: [],
              eventIndex: 0,
            }
          : (structuredClone(continuation) as Cursor);
      while (true)
        switch (c.stage++) {
          case 0: {
            if (c.index === c.skills.length) {
              c.stage = 4;
              break;
            }
            let name = c.skills[c.index++];
            const lost = name.startsWith("-");
            if (lost) name = name.slice(1);
            const head = !name.endsWith("!");
            if (!head) name = name.slice(0, -1);
            const slot = head ? "head" : "deputy",
              { owned, acquired } = slots(game, c.target);
            const definition = Object.prototype.hasOwnProperty.call(
              definitions,
              name,
            )
              ? definitions[name]
              : null;
            if (lost) {
              if (acquired[slot].includes(name))
                acquired[slot] = acquired[slot].filter((s) => s !== name);
              else if (
                Object.prototype.hasOwnProperty.call(owned[slot], name) &&
                !c.acquireOnly &&
                definition?.visible === true
              ) {
                const equip = rules.isEquipSkill(
                  structuredClone(game),
                  c.target,
                  name,
                );
                if (typeof equip !== "boolean")
                  throw Error("Invalid equipment skill predicate");
                if (equip) {
                  c.stage = 0;
                  break;
                }
                delete owned[slot][name];
              } else {
                c.stage = 0;
                break;
              }
            } else {
              if (
                !definition ||
                acquired.head.includes(name) ||
                acquired.deputy.includes(name)
              ) {
                c.stage = 0;
                break;
              }
              acquired[slot].push(name);
            }
            c.current = {
              name,
              head,
              lost,
              visible: definition?.visible === true,
              limitMark:
                !lost && definition?.limitMark ? definition.limitMark : null,
            };
            if (c.current.limitMark) {
              if (!game.playerMarks?.[c.target])
                throw Error("Invalid skill marks");
              game.playerMarks[c.target][c.current.limitMark] =
                readSlashInteger(1);
              const op = rules.notify({
                kind: "limited-mark",
                target: c.target,
                name: c.current.limitMark,
                value: 1,
              });
              if (op)
                return { kind: "operation", operation: op, continuation: c };
            }
            break;
          }
          case 1:
            if (c.current!.visible) {
              const m = c.current!,
                op = rules.notify({
                  kind: "skill",
                  target: c.target,
                  name: m.name,
                  head: m.head,
                  lost: m.lost,
                });
              if (op)
                return { kind: "operation", operation: op, continuation: c };
            }
            break;
          case 2:
            if (c.current!.visible) c.events.push(structuredClone(c.current!));
            c.current = null;
            c.stage = 0;
            break;
          case 4:
            if (c.eventIndex < c.events.length) {
              const m = c.events[c.eventIndex++];
              c.stage = 4;
              return {
                kind: "event",
                event: {
                  name: m.lost ? "EventLoseSkill" : "EventAcquireSkill",
                  target: c.target,
                  data: m.name + ":" + (m.head ? "head" : "deputy"),
                },
                continuation: c,
              };
            }
            return { kind: "return", value: null };
          default:
            throw Error("Invalid skill batch continuation");
        }
    },
  };
}
export function ownsRoomSkill(
  game: RoomSkillGame,
  target: string,
  name: string,
): boolean {
  const { owned } = slots(game, target);
  return (
    Object.prototype.hasOwnProperty.call(owned.head, name) ||
    Object.prototype.hasOwnProperty.call(owned.deputy, name)
  );
}
export function createRoomSkillEventRule<
  G extends RoomSkillGame,
>(): TriggerSkill<G> {
  return {
    id: "game-rule-room-skill-event",
    events: ["EventAcquireSkill", "EventLoseSkill"],
    priority: 0,
    rule: true,
    effect: ({ event, operationChild }) =>
      operationChild
        ? { kind: "done", value: false }
        : {
            kind: "operation",
            operation: {
              name: "room-skill-event",
              data: {
                event: event.name,
                target: event.target,
                data: event.data,
              },
            },
            continuation: true,
          },
  };
}
export function createRoomSkillEventOperation<G extends RoomSkillGame>(
  rules: RoomSkillRules<G> & {
    filter: (target: string, reset: boolean) => TriggerOperation;
  },
): OperationHandler<G> {
  const definitions = skillDefinitions(rules.definitions);
  type Cursor = { stage: number; target: string; name: string; lost: boolean };
  return {
    name: "room-skill-event",
    run: ({ game, operation, continuation }): OperationStep => {
      let c: Cursor;
      if (continuation === null) {
        const tags = damageRoomTags(game);
        if (
          tags.SkipGameRule !== undefined &&
          typeof tags.SkipGameRule !== "boolean"
        )
          throw Error("Invalid SkipGameRule");
        if (tags.SkipGameRule) {
          delete tags.SkipGameRule;
          return { kind: "return", value: null };
        }
        const data = operation.data;
        if (
          !data ||
          typeof data !== "object" ||
          Array.isArray(data) ||
          !["EventAcquireSkill", "EventLoseSkill"].includes(String(data.event))
        )
          throw Error("Invalid skill event");
        if (data.target === null) return { kind: "return", value: null };
        if (typeof data.target !== "string" || typeof data.data !== "string")
          throw Error("Invalid skill event target/data");
        slots(game, data.target);
        c = {
          stage: 0,
          target: data.target,
          name: data.data.split(":")[0],
          lost: data.event === "EventLoseSkill",
        };
      } else c = structuredClone(continuation) as Cursor;
      const definition = Object.prototype.hasOwnProperty.call(
        definitions,
        c.name,
      )
        ? definitions[c.name]
        : null;
      if (!definition) throw Error("Missing skill event definition");
      while (true)
        switch (c.stage++) {
          case 0:
            if (
              definition.limitMark &&
              !ownsRoomSkill(game, c.target, c.name)
            ) {
              if (!game.playerMarks[c.target])
                throw Error("Invalid skill marks");
              game.playerMarks[c.target][definition.limitMark] = 0;
              const op = rules.notify({
                kind: "limited-mark",
                target: c.target,
                name: definition.limitMark,
                value: 0,
              });
              if (op)
                return { kind: "operation", operation: op, continuation: c };
            }
            break;
          case 1:
            if (definition.refilter === true)
              return {
                kind: "operation",
                operation: rules.filter(c.target, c.lost),
                continuation: c,
              };
            break;
          case 2:
            return { kind: "return", value: null };
          default:
            throw Error("Invalid skill event continuation");
        }
    },
  };
}
