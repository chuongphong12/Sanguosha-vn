import { CARD_DEFINITIONS } from "../../catalog/cards";
import { GENERALS_BY_ID } from "../../catalog/generals";
import { ROLE_NAMES } from "../../catalog/roles";
import { SKILL_REGISTRY } from "../SkillRegistry";
import type {
  CardColor,
  CardName,
  EquipmentSlot,
  PhysicalCard,
  PlayCardInput,
  PlayerID,
  PromptAnswer,
  TqsGameState,
  TqsPlayerViewState,
} from "../../types";
import { distanceBetween, attackRange } from "../../rules";

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "weapon",
  "armor",
  "offensive-mount",
  "defensive-mount",
];

export function resolutionID(G: TqsGameState): number {
  return G.nextResolutionID++;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isStringList(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (const item of value) if (typeof item !== "string") return false;
  return true;
}

export function isPlayerIDList(value: unknown): value is PlayerID[] {
  return isStringList(value);
}

export function isPlayCardInput(value: unknown): value is PlayCardInput {
  if (!isRecord(value) || !isPlayerIDList(value.targetIDs)) return false;
  if (value.kind === "serpent-spear")
    return (
      Array.isArray(value.cardIDs) &&
      value.cardIDs.length === 2 &&
      typeof value.cardIDs[0] === "string" &&
      typeof value.cardIDs[1] === "string"
    );
  if (value.kind === "virtual")
    return (
      typeof value.cardID === "string" &&
      (value.as === "slash" ||
        value.as === "snatch" ||
        value.as === "indulgence")
    );
  return (
    (value.kind === undefined || value.kind === "physical") &&
    typeof value.cardID === "string"
  );
}

export function isPromptAnswer(value: unknown): value is PromptAnswer {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "pass" || value.kind === "bagua") return true;
  if (value.kind === "card" || value.kind === "harvest")
    return typeof value.cardID === "string";
  if (value.kind === "option") return typeof value.choice === "string";
  if (value.kind === "serpent-spear")
    return (
      Array.isArray(value.cardIDs) &&
      value.cardIDs.length === 2 &&
      typeof value.cardIDs[0] === "string" &&
      typeof value.cardIDs[1] === "string"
    );
  if (value.kind === "players")
    return (
      Array.isArray(value.playerIDs) &&
      value.playerIDs.every((playerID) => typeof playerID === "string")
    );
  if (value.kind === "summon") return true;
  if (value.kind !== "zone-cards" || !Array.isArray(value.choices))
    return false;
  for (const choice of value.choices) {
    if (!isRecord(choice) || typeof choice.zone !== "string") return false;
    if (choice.zone === "processing") return typeof choice.cardID === "string";
    if (typeof choice.ownerID !== "string") return false;
    if (choice.zone === "hand") {
      if (
        typeof choice.handIndex === "number" &&
        Number.isInteger(choice.handIndex) &&
        choice.handIndex >= 0
      )
        continue;
      return false;
    }
    if (choice.zone === "equipment") {
      if (EQUIPMENT_SLOTS.includes(choice.slot as EquipmentSlot)) continue;
      return false;
    }
    if (
      (choice.zone === "judgement" || choice.zone === "processing") &&
      typeof choice.cardID === "string"
    )
      continue;
    return false;
  }
  return true;
}

export function playerName(G: TqsGameState, playerID: PlayerID): string {
  const generalID = G.players[playerID]?.generalID;
  return generalID
    ? GENERALS_BY_ID[generalID]?.name
    : `Người chơi ${Number(playerID) + 1}`;
}

export function cardColor(card: PhysicalCard): CardColor {
  return card.suit === "heart" || card.suit === "diamond" ? "red" : "black";
}

export function equipmentName(
  G: TqsGameState,
  playerID: PlayerID,
  slot: EquipmentSlot,
): CardName | null {
  const cardID = G.players[playerID]?.equipment[slot];
  return cardID ? (G.cards[cardID]?.definitionID ?? null) : null;
}

export function hasSkill(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
  skillID: string,
): boolean {
  return G.players[playerID]?.activeSkillIDs.includes(skillID) === true;
}

export function canRespondWithCard(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
  cardID: string,
  response: ResponseKind,
): boolean {
  return matchesResponse(G as TqsGameState, playerID, cardID, response);
}

export function aliveInActionOrder(
  G: TqsGameState,
  startID: PlayerID = G.turn.activePlayerID,
): PlayerID[] {
  const start = G.seatOrder.indexOf(startID);
  return Array.from(
    { length: G.seatOrder.length },
    (_, offset) => G.seatOrder[(start + offset) % G.seatOrder.length],
  ).filter((playerID) => G.players[playerID].alive);
}

export function hasCardInHand(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
  cardName?: CardName,
): boolean {
  return (
    G.players[playerID]?.hand.includes(cardID) === true &&
    (!cardName || G.cards[cardID]?.definitionID === cardName)
  );
}

export function hasCardInEquipment(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): boolean {
  const equipment = G.players[playerID]?.equipment;
  return equipment ? Object.values(equipment).includes(cardID) : false;
}

export function hasCardInZone(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): boolean {
  return (
    hasCardInHand(G, playerID, cardID) ||
    hasCardInEquipment(G, playerID, cardID)
  );
}

export function hasDelayed(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
  cardName: "indulgence" | "lightning",
): boolean {
  return G.players[playerID].judgement.some(
    (cardID) => G.cards[cardID]?.definitionID === cardName,
  );
}

export function canSelectCardTarget(
  G: TqsGameState | TqsPlayerViewState,
  sourceID: PlayerID,
  cardName: CardName,
  selectedTargetIDs: PlayerID[],
  candidateID: PlayerID,
): boolean {
  if (!G.players[candidateID]?.alive || selectedTargetIDs.includes(candidateID))
    return false;

  const borrowedSwordVictimStep =
    cardName === "borrowed-sword" && selectedTargetIDs.length === 1;
  if (candidateID === sourceID && !borrowedSwordVictimStep) return false;

  const authoritativeShape = G as TqsGameState;
  if (cardName === "slash") {
    const maximum =
      equipmentName(authoritativeShape, sourceID, "weapon") === "halberd" &&
      G.players[sourceID].hand.length === 1
        ? 3
        : 1;
    return (
      selectedTargetIDs.length < maximum &&
      obeysTongJi(G, sourceID, [...selectedTargetIDs, candidateID]) &&
      distanceBetween(authoritativeShape, sourceID, candidateID) <=
        attackRange(authoritativeShape, sourceID) &&
      !(
        hasSkill(G, candidateID, "kong-cheng") &&
        G.players[candidateID].hand.length === 0
      )
    );
  }
  if (cardName === "borrowed-sword") {
    if (selectedTargetIDs.length === 0)
      return Boolean(G.players[candidateID].equipment.weapon);
    if (selectedTargetIDs.length === 1) {
      const holderID = selectedTargetIDs[0];
      return (
        candidateID !== holderID &&
        distanceBetween(authoritativeShape, holderID, candidateID) <=
          attackRange(authoritativeShape, holderID)
      );
    }
    return false;
  }
  if (selectedTargetIDs.length > 0) return false;
  if (
    (cardName === "snatch" || cardName === "dismantle") &&
    hasSkill(G, candidateID, "qian-xun")
  )
    return false;
  if (cardName === "snatch")
    return (
      hasZoneCard(G, candidateID) &&
      (distanceBetween(authoritativeShape, sourceID, candidateID) <= 1 ||
        hasSkill(G, sourceID, "qi-cai"))
    );
  if (cardName === "dismantle") return hasZoneCard(G, candidateID);
  if (cardName === "indulgence")
    return !hasDelayed(G, candidateID, "indulgence");
  if (cardName === "duel")
    return !(
      hasSkill(G, candidateID, "kong-cheng") &&
      G.players[candidateID].hand.length === 0
    );
  return false;
}

export type ResponseKind = "slash" | "dodge" | "peach" | "nullification";

export function matchesResponse(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
  response: ResponseKind,
): boolean {
  const card = G.cards[cardID];
  if (!card) return false;
  const inHand = hasCardInHand(G, playerID, cardID);
  if (!inHand && !hasCardInEquipment(G, playerID, cardID)) return false;
  if (inHand) {
    if (card.definitionID === response) return true;
    if (
      response === "slash" &&
      hasSkill(G, playerID, "long-dan") &&
      card.definitionID === "dodge"
    )
      return true;
    if (
      response === "dodge" &&
      hasSkill(G, playerID, "long-dan") &&
      card.definitionID === "slash"
    )
      return true;
    if (
      response === "dodge" &&
      hasSkill(G, playerID, "qing-guo") &&
      CARD_DEFINITIONS[card.definitionID].kind === "equipment"
    )
      return true;
  }
  // Wu Sheng / Ji Jiu convert both hand AND already-equipped cards.
  if (
    response === "slash" &&
    hasSkill(G, playerID, "wu-sheng") &&
    cardColor(card) === "red"
  )
    return true;
  if (
    response === "peach" &&
    cardColor(card) === "red" &&
    hasSkill(G, playerID, "ji-jiu") &&
    G.turn.activePlayerID !== playerID
  )
    return true;
  return false;
}

export function obeysTongJi(
  G: TqsGameState | TqsPlayerViewState,
  sourceID: PlayerID,
  targetIDs: PlayerID[],
): boolean {
  const authoritativeShape = G as TqsGameState;
  const owners = G.seatOrder.filter(
    (ownerID) =>
      ownerID !== sourceID &&
      G.players[ownerID].alive &&
      hasSkill(G, ownerID, "tong-ji") &&
      G.players[ownerID].hand.length > G.players[ownerID].hp &&
      distanceBetween(authoritativeShape, sourceID, ownerID) <=
        attackRange(authoritativeShape, sourceID),
  );
  return (
    owners.length === 0 ||
    (owners.length === 1 &&
      targetIDs.length === 1 &&
      targetIDs[0] === owners[0])
  );
}

export function hasZoneCard(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
): boolean {
  const player = G.players[playerID];
  return (
    player.hand.length > 0 ||
    Object.values(player.equipment).length > 0 ||
    player.judgement.length > 0
  );
}
