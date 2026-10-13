import {
  readCardEffect,
  readRecipientFlags,
  type CardEffect,
  type CardEffectGame,
} from "./card-effect";
import { readCardUse, type CardUse } from "./card-on-use";
import { readCardReference } from "./card-resources";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

export type SlashCard = { reference: string; card: CardUse["card"] };
export type SlashEffect = {
  from: string | null;
  to: string;
  slash: SlashCard | null;
  jink: SlashCard | null;
  jink_num: number;
  drank: number;
  nature: "normal" | "fire" | "thunder";
  nullified: boolean;
};
export interface SlashGame extends CardEffectGame {
  /** Private authoritative marks; package/phase adapters remain separate. */
  playerMarks: Record<string, Record<string, number>>;
}
export interface SlashOnEffectRules<G extends SlashGame> {
  reference: (effect: CardEffect) => string;
  nature: (game: Readonly<G>, slash: SlashCard) => SlashEffect["nature"];
}
export interface SlashOnUseRules<G extends SlashGame> {
  reference: (use: CardUse) => string;
  /** Resolves Play phase and native shown-skill/weapon precedence. */
  repeatSlashCause: (
    game: Readonly<G>,
    player: string,
  ) => "paoxiao" | "paoxiao_xh" | "crossbow" | null;
}
function playerTags(game: SlashGame, player: string) {
  const tags = game.cardResources?.playerTags;
  if (
    !tags ||
    !Object.prototype.hasOwnProperty.call(tags, player) ||
    !tags[player] ||
    typeof tags[player] !== "object" ||
    Array.isArray(tags[player])
  )
    throw new Error("Invalid Slash player tags");
  return tags[player];
}
function qinggang(game: SlashGame, effect: Pick<SlashEffect, "to" | "slash">) {
  if (effect.slash === null) return null;
  const { card } = readCardReference(game, effect.slash.reference);
  const tags = playerTags(game, effect.to);
  const list = tags.Qinggang === undefined ? [] : tags.Qinggang;
  if (!Array.isArray(list) || list.some((value) => typeof value !== "string"))
    throw new Error("Invalid Qinggang list");
  return { tags, list: [...list], key: card.key };
}
export function removeQinggang(
  game: SlashGame,
  effect: Pick<SlashEffect, "to" | "slash">,
) {
  const input = qinggang(game, effect);
  if (!input || !input.list.length) return;
  const index = input.list.indexOf(input.key);
  if (index !== -1) input.list.splice(index, 1);
  input.tags.Qinggang = input.list;
}
export function readSlashAlive(game: SlashGame, player: string): boolean {
  if (
    !Object.prototype.hasOwnProperty.call(game.alive, player) ||
    typeof game.alive[player] !== "boolean"
  )
    throw new Error("Invalid Slash alive state");
  return game.alive[player];
}
export function readSlashInteger(
  value: TriggerData | undefined,
  fallback?: number,
): number {
  const number = value === undefined ? fallback : value;
  if (
    typeof number !== "number" ||
    !Number.isInteger(number) ||
    number < -2147483648 ||
    number > 2147483647
  )
    throw new Error("Invalid Slash integer");
  return number;
}
export function readSlashCard(
  game: SlashGame,
  value: TriggerData,
  player: string,
): SlashCard {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.reference !== "string"
  )
    throw new Error("Invalid Slash card");
  const use = readCardUse(game, { from: player, to: [], card: value.card });
  readCardReference(game, value.reference);
  return { reference: value.reference, card: use.card };
}
export function readSlashEffect(
  game: SlashGame,
  value: TriggerData,
): SlashEffect {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value.from !== null &&
      (typeof value.from !== "string" ||
        !game.seatOrder.includes(value.from))) ||
    typeof value.to !== "string" ||
    !game.seatOrder.includes(value.to) ||
    typeof value.nullified !== "boolean" ||
    typeof value.nature !== "string" ||
    !["normal", "fire", "thunder"].includes(value.nature)
  )
    throw new Error("Invalid Slash effect");
  const slash =
    value.slash === null ? null : readSlashCard(game, value.slash, value.to);
  const jink =
    value.jink === null ? null : readSlashCard(game, value.jink, value.to);
  return {
    from: value.from as string | null,
    to: value.to,
    slash,
    jink,
    jink_num: readSlashInteger(value.jink_num),
    drank: readSlashInteger(value.drank),
    nature: value.nature as SlashEffect["nature"],
    nullified: value.nullified,
  };
}
function onEffectInput<G extends SlashGame>(
  game: G,
  data: TriggerData,
  rules: SlashOnEffectRules<G>,
) {
  const effect = readCardEffect(game, data);
  if (effect.from === null) throw new Error("Slash onEffect requires a source");
  const slash = {
    reference: rules.reference(structuredClone(effect)),
    card: effect.card,
  };
  const { card, storage } = readCardReference(game, slash.reference);
  const tags = playerTags(game, effect.from);
  const list = tags?.[`Jink_${card.key}`];
  if (
    !tags ||
    typeof tags !== "object" ||
    Array.isArray(tags) ||
    !Array.isArray(list) ||
    !list.length
  )
    throw new Error("Invalid Slash Jink requirements");
  // Normalized inputs are integers; Qt QVariant coercion is not implemented here.
  const counts = list.map((value) => readSlashInteger(value));
  const drank = readSlashInteger(storage.tags.drank, 0);
  const nature = rules.nature(structuredClone(game), structuredClone(slash));
  if (!["normal", "fire", "thunder"].includes(nature))
    throw new Error("Invalid Slash nature");
  return {
    effect,
    slash,
    tags,
    key: `Jink_${card.key}`,
    counts,
    drank,
    nature,
  };
}
function runOnEffect<G extends SlashGame>(
  { game, operation, continuation }: OperationContext<G>,
  rules: SlashOnEffectRules<G>,
): OperationStep {
  if (continuation !== null) return { kind: "return", value: null };
  const input = onEffectInput(game, operation.data, rules);
  const [count, ...remaining] = input.counts;
  if (remaining.length) input.tags[input.key] = remaining;
  else delete input.tags[input.key];
  const effect: SlashEffect = {
    from: input.effect.from,
    to: input.effect.to,
    slash: input.slash,
    jink: null,
    jink_num: input.effect.disresponsive ? 0 : count,
    drank: input.drank,
    nature: input.nature,
    nullified: input.effect.nullified,
  };
  return {
    kind: "operation",
    operation: { name: "slash-effect", data: effect },
    continuation: true,
  };
}
export function createSlashOnEffectOperation<G extends SlashGame>(
  rules: SlashOnEffectRules<G>,
): OperationHandler<G> {
  return {
    name: "slash-on-effect",
    validate: (game, operation) => {
      onEffectInput(game, operation.data, rules);
    },
    run: (context) => runOnEffect(context, rules),
  };
}
function runRoomEffect<G extends SlashGame>({
  game,
  operation,
  continuation,
  child,
}: OperationContext<G>): OperationStep {
  const effect =
    continuation === null
      ? readSlashEffect(game, operation.data)
      : (structuredClone(continuation) as SlashEffect);
  if (continuation === null)
    return {
      kind: "event",
      event: { name: "SlashEffected", target: effect.to, data: effect },
      continuation: effect,
    };
  if (child?.consumed) {
    game.playerFlags[effect.to] = readRecipientFlags(game, effect.to).filter(
      (flag) => flag !== "Global_NonSkillNullify",
    );
    removeQinggang(game, effect);
  }
  return { kind: "return", value: null };
}
export function createSlashEffectOperation<
  G extends SlashGame,
>(): OperationHandler<G> {
  return {
    name: "slash-effect",
    validate: (game, operation) => {
      const effect = readSlashEffect(game, operation.data);
      readRecipientFlags(game, effect.to);
      qinggang(game, effect);
    },
    run: runRoomEffect,
  };
}
function resultInput(game: SlashGame, data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid Slash result");
  const effect = readSlashEffect(game, data.effect);
  effect.jink =
    data.jink === null ? null : readSlashCard(game, data.jink, effect.to);
  if (effect.jink === null) readSlashAlive(game, effect.to);
  else qinggang(game, effect);
  return effect;
}
export function createSlashResultOperation<
  G extends SlashGame,
>(): OperationHandler<G> {
  return {
    name: "slash-result",
    validate: (game, operation) => {
      resultInput(game, operation.data);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const effect = resultInput(game, operation.data);
      if (effect.jink === null && !readSlashAlive(game, effect.to))
        return { kind: "return", value: null };
      if (effect.jink !== null) removeQinggang(game, effect);
      return {
        kind: "event",
        event: {
          name: effect.jink === null ? "SlashHit" : "SlashMissed",
          target: effect.from,
          data: effect,
        },
        continuation: true,
      };
    },
  };
}
function onUseInput<G extends SlashGame>(
  game: G,
  data: TriggerData,
  rules: SlashOnUseRules<G>,
) {
  const use = readCardUse(game, data);
  const reference = rules.reference(structuredClone(use));
  const { storage } = readCardReference(game, reference);
  const flags = readRecipientFlags(game, use.from);
  const marks = game.playerMarks?.[use.from];
  if (
    !marks ||
    typeof marks !== "object" ||
    Array.isArray(marks) ||
    !Object.prototype.hasOwnProperty.call(game.playerMarks, use.from)
  )
    throw new Error("Invalid Slash marks");
  const drank = readSlashInteger(marks.drank, 0);
  const assignees = flags.includes("slashTargetFix")
    ? game.seatOrder.filter((player) => readSlashAlive(game, player))
    : [];
  for (const player of assignees) readRecipientFlags(game, player);
  const cause = flags.includes("Global_MoreSlashInOneTurn")
    ? rules.repeatSlashCause(structuredClone(game), use.from)
    : null;
  if (cause !== null && !["paoxiao", "paoxiao_xh", "crossbow"].includes(cause))
    throw new Error("Invalid repeated Slash cause");
  return { use, storage, flags, marks, drank, assignees, cause };
}
export function createSlashOnUseOperation<G extends SlashGame>(
  rules: SlashOnUseRules<G>,
): OperationHandler<G> {
  return {
    name: "slash-on-use",
    validate: (game, operation) => {
      onUseInput(game, operation.data, rules);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const input = onUseInput(game, operation.data, rules);
      const remove = new Set<string>();
      if (input.flags.includes("slashTargetFix")) {
        remove.add("slashTargetFix");
        remove.add("slashTargetFixToOne");
        for (const player of input.assignees)
          game.playerFlags[player] = readRecipientFlags(game, player).filter(
            (flag) => flag !== "SlashAssignee",
          );
      }
      for (const flag of ["slashNoDistanceLimit", "slashDisableExtraTarget"])
        if (input.flags.includes(flag)) {
          remove.add(flag);
          if (!input.storage.flags.includes(flag))
            input.storage.flags.push(flag);
        }
      if (input.cause !== null) remove.add("Global_MoreSlashInOneTurn");
      // Re-read after assignee cleanup, which may also include the source.
      game.playerFlags[input.use.from] = readRecipientFlags(
        game,
        input.use.from,
      ).filter((flag) => !remove.has(flag));
      if (input.drank > 0) {
        if (!input.storage.flags.includes("drank"))
          input.storage.flags.push("drank");
        input.storage.tags.drank = input.drank;
        input.marks.drank = 0;
      }
      input.use.card.flags = [...input.storage.flags];
      return {
        kind: "operation",
        operation: { name: "card-on-use", data: input.use },
        continuation: true,
      };
    },
  };
}
export interface JinkEffectRules<G extends SlashGame> {
  isJink: (game: Readonly<G>, card: SlashCard) => boolean;
}
function jinkInput<G extends SlashGame>(
  game: G,
  data: TriggerData,
  rules: JinkEffectRules<G>,
) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid Jink effect");
  if (data.user === null || data.jink === null) return null;
  if (typeof data.user !== "string" || !game.seatOrder.includes(data.user))
    throw new Error("Invalid Jink user");
  const jink = readSlashCard(game, data.jink, data.user);
  if (rules.isJink(structuredClone(game), structuredClone(jink)) !== true)
    throw new Error("Invalid Jink ancestry");
  const negated = readCardReference(game, jink.reference).storage.tags
    .ResponseNegated;
  if (negated !== undefined && typeof negated !== "boolean")
    throw new Error("Invalid Jink ResponseNegated");
  return { user: data.user, jink, negated: negated === true };
}
export function createJinkEffectOperation<G extends SlashGame>(
  rules: JinkEffectRules<G>,
): OperationHandler<G> {
  return {
    name: "jink-effect",
    validate: (game, operation) => {
      jinkInput(game, operation.data, rules);
    },
    run: ({ game, operation, continuation, child }) => {
      if (continuation !== null)
        return { kind: "return", value: !child?.consumed };
      const input = jinkInput(game, operation.data, rules);
      if (!input || input.negated) return { kind: "return", value: false };
      return {
        kind: "event",
        event: { name: "JinkEffect", target: input.user, data: input.jink },
        continuation: true,
      };
    },
  };
}
