import { readCardUse, type CardUse } from "./card-on-use";
import type { CardResourceGame } from "./card-resources";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

export type CardEffect = {
  from: string | null;
  to: string;
  card: CardUse["card"];
  multiple: boolean;
  nullified: boolean;
  disresponsive: boolean;
};
/** Private authoritative flags, separate from player tags and projections. */
export interface CardEffectGame extends CardResourceGame {
  playerFlags: Record<string, string[]>;
}
export interface CardEffectRules<G extends CardEffectGame> {
  /** Pure package ancestry lookup; receives independent snapshots. */
  isSlash: (game: Readonly<G>, effect: CardEffect) => boolean;
}
type Cursor = {
  stage: number;
  original: CardEffect;
  data: CardEffect;
  result: boolean;
};

function readCardEffect(game: CardEffectGame, data: TriggerData): CardEffect {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    (data.from !== null &&
      (typeof data.from !== "string" || !game.seatOrder.includes(data.from))) ||
    typeof data.to !== "string" ||
    !game.seatOrder.includes(data.to) ||
    typeof data.multiple !== "boolean" ||
    typeof data.nullified !== "boolean" ||
    typeof data.disresponsive !== "boolean"
  )
    throw new Error("Invalid card effect");
  readCardUse(game, {
    from: data.from ?? data.to,
    to: [data.to],
    card: data.card,
  });
  return structuredClone(data) as CardEffect;
}
function runCardEffect<G extends CardEffectGame>(
  { game, operation, continuation, child }: OperationContext<G>,
  rules: CardEffectRules<G>,
): OperationStep {
  const original =
    continuation === null ? readCardEffect(game, operation.data) : null;
  const cursor: Cursor = original
    ? {
        stage: effectEligible(game, original, rules) ? 0 : 2,
        original,
        data: structuredClone(original),
        result: false,
      }
    : (structuredClone(continuation) as Cursor);
  if (child && cursor.stage < 3) {
    cursor.data = readCardEffect(game, child.event.data);
    if (cursor.stage === 2) {
      cursor.result = !child.consumed;
      if (child.consumed)
        game.playerFlags[cursor.original.to] = readRecipientFlags(
          game,
          cursor.original.to,
        ).filter((flag) => flag !== "Global_NonSkillNullify");
    }
  }
  if (cursor.stage < 3) {
    const name = ["CardEffect", "CardEffected", "PostCardEffected"][
      cursor.stage++
    ];
    return {
      kind: "event",
      event: { name, target: cursor.original.to, data: cursor.data },
      continuation: cursor,
    };
  }
  return { kind: "return", value: cursor.result };
}

function effectEligible<G extends CardEffectGame>(
  game: G,
  effect: CardEffect,
  rules: CardEffectRules<G>,
): boolean {
  readRecipientFlags(game, effect.to);
  const slash = rules.isSlash(structuredClone(game), structuredClone(effect));
  if (typeof slash !== "boolean" || typeof game.alive[effect.to] !== "boolean")
    throw new Error("Invalid card effect eligibility");
  return game.alive[effect.to] || slash;
}

function readRecipientFlags(game: CardEffectGame, target: string): string[] {
  const flags = game.playerFlags;
  if (
    !flags ||
    typeof flags !== "object" ||
    Array.isArray(flags) ||
    !Object.prototype.hasOwnProperty.call(flags, target) ||
    !Array.isArray(flags[target]) ||
    flags[target].some((flag) => typeof flag !== "string")
  )
    throw new Error("Invalid card effect recipient flags");
  return flags[target];
}

/** Room event wrapper only; GameRule decisions and onEffect are separate. */
export function createCardEffectOperation<G extends CardEffectGame>(
  rules: CardEffectRules<G>,
): OperationHandler<G> {
  return {
    name: "card-effect",
    validate: (game, operation) => {
      effectEligible(game, readCardEffect(game, operation.data), rules);
    },
    run: (context) => runCardEffect(context, rules),
  };
}
