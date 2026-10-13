import { readCardUse, type CardUse } from "./card-on-use";
import type { CardMovementGame } from "./movement";
import type { TriggerData, TriggerSkill } from "./scheduler";

type CardReference = {
  /** Supplied current native toString, distinct from the object's reference ID. */
  key: string;
  isSlash: boolean;
  isNDTrick: boolean;
} & (
  | { kind: "virtual"; flags: string[]; tags: Record<string, TriggerData> }
  | { kind: "wrapped"; id: number }
);
export interface CardResources {
  cards: Record<string, CardReference>;
  playerTags: Record<string, Record<string, TriggerData>>;
  roomTags: Record<string, TriggerData>;
}
/** Private authoritative resources; never a player projection. */
export interface CardResourceGame extends CardMovementGame {
  cardResources?: CardResources;
}
export interface CardUseResourceRules {
  /** Pure package mapping; callbacks stay outside serialized game/frames. */
  reference: (use: CardUse) => string;
}
function isRecord(value: unknown): value is Record<string, TriggerData> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** Source-independent identity/storage lookup; nullable effects have no player tag owner. */
export function readCardReference(game: CardResourceGame, reference: string) {
  const ledger = game.cardResources;
  if (
    !ledger ||
    !isRecord(ledger.roomTags) ||
    !isRecord(ledger.cards) ||
    typeof reference !== "string" ||
    !Object.prototype.hasOwnProperty.call(ledger.cards, reference)
  )
    throw new Error("Invalid card resources");
  const card = ledger.cards[reference];
  if (
    !card ||
    typeof card.key !== "string" ||
    !card.key ||
    typeof card.isSlash !== "boolean" ||
    typeof card.isNDTrick !== "boolean" ||
    !["virtual", "wrapped"].includes(card.kind)
  )
    throw new Error("Invalid card resource reference");
  if (
    card.kind === "wrapped" &&
    (!Number.isSafeInteger(card.id) ||
      card.id < 0 ||
      card.key !== String(card.id))
  )
    throw new Error("Invalid wrapped card reference");
  const storage = card.kind === "wrapped" ? game.wrappedCards?.[card.id] : card;
  if (
    !storage ||
    !Array.isArray(storage.flags) ||
    storage.flags.some((flag) => typeof flag !== "string") ||
    !isRecord(storage.tags)
  )
    throw new Error("Invalid card resource storage");
  return { ledger, card, storage };
}

export function readResourceCard(
  game: CardResourceGame,
  use: CardUse,
  rules: CardUseResourceRules,
) {
  const reference = rules.reference(structuredClone(use));
  const ledger = game.cardResources;
  if (
    !ledger ||
    !isRecord(ledger.playerTags) ||
    !Object.prototype.hasOwnProperty.call(ledger.playerTags, use.from) ||
    !isRecord(ledger.playerTags[use.from])
  )
    throw new Error("Invalid card resources");
  return {
    ...readCardReference(game, reference),
    playerTags: ledger.playerTags[use.from],
  };
}

export function prepareJink(
  game: CardResourceGame,
  use: CardUse,
  rules: CardUseResourceRules,
): TriggerData[] {
  const { card, playerTags } = readResourceCard(game, use, rules);
  if (!card.isSlash) return [];
  const key = `Jink_${card.key}`;
  const previous = playerTags[key];
  const backup = Array.isArray(previous) ? structuredClone(previous) : [];
  playerTags[key] = use.to.map(() => 1);
  return backup;
}

export function restoreJink(
  game: CardResourceGame,
  use: CardUse,
  backup: TriggerData[],
  rules: CardUseResourceRules,
): void {
  if (!backup.length) return;
  const { card, playerTags } = readResourceCard(game, use, rules);
  playerTags[`Jink_${card.key}`] = structuredClone(backup);
}

export function readEffectUse(use: CardUse) {
  const data = use as CardUse & {
    nullified_list?: TriggerData;
    disresponsive_list?: TriggerData;
  };
  const lists = [
    data.nullified_list === undefined ? [] : data.nullified_list,
    data.disresponsive_list === undefined ? [] : data.disresponsive_list,
  ];
  if (
    lists.some(
      (list) =>
        !Array.isArray(list) || list.some((id) => typeof id !== "string"),
    )
  )
    throw new Error("Invalid card effect lists");
  return {
    ...structuredClone(use),
    nullified_list: [...(lists[0] as string[])],
    disresponsive_list: [...(lists[1] as string[])],
  };
}

export function prepareEffectResources(
  game: CardResourceGame,
  use: CardUse,
  rules: CardUseResourceRules,
) {
  const { ledger, storage } = readResourceCard(game, use, rules);
  const data = readEffectUse(use);
  if (storage.flags.includes("GlobalCardUseNullified"))
    data.nullified_list.push("_ALL_TARGETS");
  if (storage.flags.includes("GlobalCardUseDisresponsive"))
    data.disresponsive_list.push("_ALL_PLAYERS");
  ledger.roomTags.CardUseNullifiedList = [...data.nullified_list];
  storage.tags.CardUseDisresponsiveList = [...data.disresponsive_list];
  return data;
}

/** Normal GameRule cleanup only; notifications and interruption unwind are separate. */
export function createCardFinishedRule<G extends CardResourceGame>(
  rules: CardUseResourceRules,
): TriggerSkill<G> {
  return {
    id: "game-rule-card-finished",
    events: ["CardFinished"],
    priority: 0,
    rule: true,
    effect: ({ game, event }) => {
      const use = readCardUse(game, event.data);
      const { ledger, card, storage, playerTags } = readResourceCard(
        game,
        use,
        rules,
      );
      storage.flags = [];
      if (card.isNDTrick)
        delete ledger.roomTags[`${card.key}HegNullificationTargets`];
      if (card.isSlash) delete playerTags[`Jink_${card.key}`];
      return { kind: "done", value: false };
    },
  };
}
