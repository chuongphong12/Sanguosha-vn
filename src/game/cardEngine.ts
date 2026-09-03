import { CARD_DEFINITIONS } from "./catalog/cards";
import { GENERALS_BY_ID } from "./catalog/generals";
import { ROLE_NAMES } from "./catalog/roles";
import type {
  CardColor,
  CardName,
  CardResponsePrompt,
  CardUse,
  DamageEffect,
  DyingEffect,
  EquipmentSlot,
  GameEffect,
  GamePrompt,
  HarvestEffect,
  NullificationEffect,
  PhysicalCard,
  PlayCardInput,
  PlayerID,
  PromptAnswer,
  RequiredResponseEffect,
  SelectCardsPrompt,
  Shuffle,
  SlashEffect,
  TqsGameState,
  TqsPlayerViewState,
} from "./model";
import {
  attackRange,
  determineWinner,
  distanceBetween,
  drawCards,
  handLimit,
  nextLivingPlayer,
  writeLog,
} from "./rules";

function resolutionID(G: TqsGameState): number {
  return G.nextResolutionID++;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringList(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  for (const item of value) if (typeof item !== "string") return false;
  return true;
}

function isPlayerIDList(value: unknown): value is PlayerID[] {
  return isStringList(value);
}

function isPlayCardInput(value: unknown): value is PlayCardInput {
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

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "weapon",
  "armor",
  "offensive-mount",
  "defensive-mount",
];

function isPromptAnswer(value: unknown): value is PromptAnswer {
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

function playerName(G: TqsGameState, playerID: PlayerID): string {
  const generalID = G.players[playerID]?.generalID;
  return generalID
    ? GENERALS_BY_ID[generalID]?.name
    : `Người chơi ${Number(playerID) + 1}`;
}

function cardColor(card: PhysicalCard): CardColor {
  return card.suit === "heart" || card.suit === "diamond" ? "red" : "black";
}

function equipmentName(
  G: TqsGameState,
  playerID: PlayerID,
  slot: EquipmentSlot,
): CardName | null {
  const cardID = G.players[playerID]?.equipment[slot];
  return cardID ? (G.cards[cardID]?.definitionID ?? null) : null;
}

function hasSkill(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
  skillID: string,
): boolean {
  return G.players[playerID]?.activeSkillIDs.includes(skillID) === true;
}

type ResponseKind = "slash" | "dodge" | "peach" | "nullification";

function matchesResponse(
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

export function canRespondWithCard(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
  cardID: string,
  response: ResponseKind,
): boolean {
  return matchesResponse(G as TqsGameState, playerID, cardID, response);
}

export function getVirtualConversions(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
  cardID: string,
): Array<"slash" | "snatch" | "indulgence"> {
  const card = G.cards[cardID];
  if (!card) return [];
  const conversions: Array<"slash" | "snatch" | "indulgence"> = [];
  if (
    card.definitionID !== "slash" &&
    ((hasSkill(G, playerID, "wu-sheng") && cardColor(card) === "red") ||
      (hasSkill(G, playerID, "long-dan") && card.definitionID === "dodge"))
  )
    conversions.push("slash");
  if (
    hasSkill(G, playerID, "qi-xi") &&
    cardColor(card) === "black" &&
    card.definitionID !== "snatch"
  )
    conversions.push("snatch");
  if (
    hasSkill(G, playerID, "guo-se") &&
    card.suit === "diamond" &&
    card.definitionID !== "indulgence"
  )
    conversions.push("indulgence");
  return conversions;
}

function aliveInActionOrder(
  G: TqsGameState,
  startID: PlayerID = G.turn.activePlayerID,
): PlayerID[] {
  const start = G.seatOrder.indexOf(startID);
  return Array.from(
    { length: G.seatOrder.length },
    (_, offset) => G.seatOrder[(start + offset) % G.seatOrder.length],
  ).filter((playerID) => G.players[playerID].alive);
}

function hasCardInHand(
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

function hasCardInEquipment(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): boolean {
  const equipment = G.players[playerID]?.equipment;
  return equipment ? Object.values(equipment).includes(cardID) : false;
}

function hasCardInZone(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): boolean {
  return (
    hasCardInHand(G, playerID, cardID) ||
    hasCardInEquipment(G, playerID, cardID)
  );
}

function removeHandCard(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): void {
  const hand = G.players[playerID].hand;
  const index = hand.indexOf(cardID);
  if (index < 0)
    throw new Error(`Lá bài ${cardID} không nằm trên tay ${playerID}.`);
  hand.splice(index, 1);
  if (
    G.status === "playing" &&
    hand.length === 0 &&
    hasSkill(G, playerID, "lian-ying")
  )
    G.effectStack.push({
      id: resolutionID(G),
      kind: "lian-ying",
      ownerID: playerID,
    });
}

function loseEquipmentCard(G: TqsGameState, ownerID: PlayerID): void {
  if (
    G.status === "playing" &&
    G.players[ownerID].alive &&
    hasSkill(G, ownerID, "xiao-ji")
  )
    G.effectStack.push({
      id: resolutionID(G),
      kind: "xiao-ji",
      ownerID,
    });
}

function handToProcessing(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): void {
  removeHandCard(G, playerID, cardID);
  G.processing.push(cardID);
}

function handToDiscard(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): void {
  removeHandCard(G, playerID, cardID);
  G.discard.push(cardID);
}

function zoneToProcessing(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): void {
  removeZoneCard(G, playerID, cardID);
  G.processing.push(cardID);
}

function zoneToDiscard(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
): void {
  removeZoneCard(G, playerID, cardID);
  G.discard.push(cardID);
}

function processingToDiscard(G: TqsGameState, cardID: string): void {
  const index = G.processing.indexOf(cardID);
  if (index >= 0) {
    G.processing.splice(index, 1);
    G.discard.push(cardID);
  }
}

function takeTopCard(G: TqsGameState, shuffle: Shuffle): string | null {
  if (G.deck.length === 0 && G.discard.length > 0) {
    G.deck = shuffle([...G.discard]);
    G.discard = [];
    writeLog(G, "Chồng Bài Bỏ được xáo lại để tạo thành Chồng Bài Rút mới.");
  }
  return G.deck.shift() ?? null;
}

function newUse(
  G: TqsGameState,
  card: PhysicalCard,
  sourceID: PlayerID,
  targetIDs: PlayerID[],
  reason: CardUse["reason"] = "play",
): CardUse {
  return {
    id: resolutionID(G),
    cardName: card.definitionID,
    sourceID,
    materialCardIDs: [card.id],
    targetIDs,
    reason,
    color: cardColor(card),
  };
}

function finishUse(G: TqsGameState, use: CardUse): GameEffect {
  return {
    id: resolutionID(G),
    kind: "finish-use",
    materialCardIDs: [...use.materialCardIDs],
  };
}

function nullifiable(
  G: TqsGameState,
  cardName: CardName,
  sourceID: PlayerID | null,
  targetID: PlayerID,
  children: GameEffect[],
  options: Pick<NullificationEffect, "onNegated" | "delayedCardID"> = {
    onNegated: "nothing",
    delayedCardID: null,
  },
): NullificationEffect {
  return {
    id: resolutionID(G),
    kind: "nullification",
    cardName,
    sourceID,
    targetID,
    responderID: null,
    passedPlayerIDs: sourceID ? [sourceID] : [],
    negated: false,
    nullificationCardIDs: [],
    children,
    ...options,
  };
}

function damageEffect(
  G: TqsGameState,
  sourceID: PlayerID | null,
  targetID: PlayerID,
  amount = 1,
  nature: DamageEffect["nature"] = "normal",
  cardIDs: string[] = [],
  cardName: CardName | null = null,
  sourceCardColor: CardColor = "colorless",
): DamageEffect {
  return {
    id: resolutionID(G),
    kind: "damage",
    sourceID,
    targetID,
    amount,
    nature,
    stage: "apply",
    cardIDs,
    cardName,
    cardColor: sourceCardColor,
  };
}

function meleeDamage(
  G: TqsGameState,
  sourceID: PlayerID,
  targetID: PlayerID,
  cardIDs: string[] = [],
  cardName: CardName | null = null,
  sourceCardColor: CardColor = "colorless",
): DamageEffect {
  const amount = sourceID === G.turn.activePlayerID && G.turn.luoYiBuff ? 2 : 1;
  return damageEffect(
    G,
    sourceID,
    targetID,
    amount,
    "normal",
    cardIDs,
    cardName,
    sourceCardColor,
  );
}

function summonFactionFor(
  G: TqsGameState,
  responderID: PlayerID,
  response: "slash" | "dodge",
  reason: CardResponsePrompt["reason"],
): "wei" | "shu" | null {
  if (reason === "borrowed-sword" || reason === "green-dragon-blade")
    return null;
  const skillID = response === "dodge" ? "hu-jia" : "ji-jiang";
  const faction = response === "dodge" ? "wei" : "shu";
  if (!hasSkill(G, responderID, skillID)) return null;
  const hasAlly = G.seatOrder.some(
    (id) =>
      id !== responderID &&
      G.players[id].alive &&
      GENERALS_BY_ID[G.players[id].generalID!]?.faction === faction,
  );
  return hasAlly ? faction : null;
}

function responsePrompt(
  G: TqsGameState,
  effectID: number,
  responderID: PlayerID,
  response: CardResponsePrompt["response"],
  reason: CardResponsePrompt["reason"],
  sourceID: PlayerID | null,
  targetID: PlayerID,
  options: Partial<
    Pick<
      CardResponsePrompt,
      | "allowBagua"
      | "allowSerpentSpear"
      | "allowPass"
      | "subjectCardName"
      | "chainDepth"
      | "currentlyNegated"
      | "forbidCard"
    >
  > = {},
): CardResponsePrompt {
  return {
    id: resolutionID(G),
    effectID,
    kind: "card-response",
    responderID,
    response,
    reason,
    sourceID,
    targetID,
    allowBagua: options.allowBagua ?? false,
    allowSerpentSpear: options.allowSerpentSpear ?? false,
    allowPass: options.allowPass ?? true,
    subjectCardName: options.subjectCardName ?? null,
    chainDepth: options.chainDepth ?? 0,
    currentlyNegated: options.currentlyNegated ?? false,
    forbidCard: options.forbidCard ?? false,
    summonFaction:
      response === "slash" || response === "dodge"
        ? summonFactionFor(G, responderID, response, reason)
        : null,
  };
}

function isIdleForPlay(G: TqsGameState, playerID: PlayerID): boolean {
  return (
    G.status === "playing" &&
    G.turn.activePlayerID === playerID &&
    G.turn.step === "play" &&
    G.players[playerID]?.alive === true &&
    G.effectStack.length === 0 &&
    G.prompt === null
  );
}

function hasZoneCard(
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

function hasDelayed(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
  cardName: "indulgence" | "lightning",
): boolean {
  return G.players[playerID].judgement.some(
    (cardID) => G.cards[cardID]?.definitionID === cardName,
  );
}

function validateTargets(
  G: TqsGameState,
  sourceID: PlayerID,
  card: PhysicalCard,
  targetIDs: PlayerID[],
  materialCount = 1,
): boolean {
  const name = card.definitionID;
  const distinct = new Set(targetIDs);
  if (distinct.size !== targetIDs.length) return false;
  if (targetIDs.some((id) => !G.players[id]?.alive)) return false;

  if (["peach", "ex-nihilo", "lightning"].includes(name)) {
    return (
      targetIDs.length === 0 ||
      (targetIDs.length === 1 && targetIDs[0] === sourceID)
    );
  }
  if (
    ["arrow-barrage", "barbarian-invasion", "peach-garden", "harvest"].includes(
      name,
    )
  )
    return targetIDs.length === 0;
  if (CARD_DEFINITIONS[name].kind === "equipment")
    return (
      targetIDs.length === 0 ||
      (targetIDs.length === 1 && targetIDs[0] === sourceID)
    );

  if (name === "slash") {
    const maximum =
      equipmentName(G, sourceID, "weapon") === "halberd" &&
      G.players[sourceID].hand.length === materialCount
        ? 3
        : 1;
    return (
      targetIDs.length >= 1 &&
      targetIDs.length <= maximum &&
      obeysTongJi(G, sourceID, targetIDs) &&
      targetIDs.every(
        (targetID) =>
          targetID !== sourceID &&
          distanceBetween(G, sourceID, targetID) <= attackRange(G, sourceID) &&
          !(
            hasSkill(G, targetID, "kong-cheng") &&
            G.players[targetID].hand.length === 0
          ),
      )
    );
  }

  if (name === "borrowed-sword") {
    if (targetIDs.length !== 2) return false;
    const [holderID, victimID] = targetIDs;
    return (
      holderID !== sourceID &&
      holderID !== victimID &&
      Boolean(G.players[holderID].equipment.weapon) &&
      distanceBetween(G, holderID, victimID) <= attackRange(G, holderID)
    );
  }

  if (targetIDs.length !== 1 || targetIDs[0] === sourceID) return false;
  const targetID = targetIDs[0];
  if (name === "snatch")
    return (
      !hasSkill(G, targetID, "qian-xun") &&
      hasZoneCard(G, targetID) &&
      (distanceBetween(G, sourceID, targetID) <= 1 ||
        hasSkill(G, sourceID, "qi-cai"))
    );
  if (name === "dismantle")
    return !hasSkill(G, targetID, "qian-xun") && hasZoneCard(G, targetID);
  if (name === "indulgence") return !hasDelayed(G, targetID, "indulgence");
  if (name === "duel")
    return !(
      hasSkill(G, targetID, "kong-cheng") &&
      G.players[targetID].hand.length === 0
    );
  return false;
}

function obeysTongJi(
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

function compileCardUse(G: TqsGameState, use: CardUse): GameEffect[] {
  const [targetID] = use.targetIDs;
  switch (use.cardName) {
    case "slash":
      return [
        {
          id: resolutionID(G),
          kind: "slash",
          use,
          targetIndex: 0,
          stage: "start",
          ignoreArmor: false,
          baguaTried: false,
          dodgesRequired: hasSkill(G, use.sourceID, "wu-shuang") ? 2 : 1,
          dodgesUsed: 0,
          tieJiTried: false,
          ignoreDodge: false,
          liuLiDiscardID: null,
        },
        finishUse(G, use),
      ];
    case "peach":
      return [
        {
          id: resolutionID(G),
          kind: "recover",
          targetID: use.sourceID,
          amount: 1,
        },
        finishUse(G, use),
      ];
    case "duel": {
      const duel: GameEffect = {
        id: resolutionID(G),
        kind: "duel",
        sourceID: use.sourceID,
        targetID,
        responderID: targetID,
        opponentID: use.sourceID,
        slashesRequired: hasSkill(G, use.sourceID, "wu-shuang") ? 2 : 1,
        slashesPlayed: 0,
        sourceCardID: use.materialCardIDs[0] ?? null,
      };
      return [
        nullifiable(G, use.cardName, use.sourceID, targetID, [duel]),
        finishUse(G, use),
      ];
    }
    case "dismantle":
    case "snatch": {
      const child: GameEffect = {
        id: resolutionID(G),
        kind: "target-card",
        sourceID: use.sourceID,
        targetID,
        result: use.cardName === "snatch" ? "gain" : "discard",
      };
      return [
        nullifiable(G, use.cardName, use.sourceID, targetID, [child]),
        finishUse(G, use),
      ];
    }
    case "borrowed-sword": {
      const child: GameEffect = {
        id: resolutionID(G),
        kind: "borrowed-sword",
        sourceID: use.sourceID,
        weaponHolderID: use.targetIDs[0],
        slashTargetID: use.targetIDs[1],
      };
      return [
        nullifiable(G, use.cardName, use.sourceID, use.targetIDs[0], [child]),
        finishUse(G, use),
      ];
    }
    case "ex-nihilo":
      return [
        nullifiable(G, use.cardName, use.sourceID, use.sourceID, [
          {
            id: resolutionID(G),
            kind: "draw",
            targetID: use.sourceID,
            amount: 2,
          },
        ]),
        finishUse(G, use),
      ];
    case "arrow-barrage":
    case "barbarian-invasion": {
      const targets = aliveInActionOrder(G, use.sourceID).filter(
        (playerID) => playerID !== use.sourceID,
      );
      const effects = targets.map((affectedID): GameEffect => {
        const child: RequiredResponseEffect = {
          id: resolutionID(G),
          kind: "required-response",
          sourceID: use.sourceID,
          targetID: affectedID,
          response: use.cardName === "arrow-barrage" ? "dodge" : "slash",
          reason:
            use.cardName === "arrow-barrage"
              ? "arrow-barrage"
              : "barbarian-invasion",
          baguaTried: false,
          sourceCardID: use.materialCardIDs[0] ?? null,
        };
        return nullifiable(G, use.cardName, use.sourceID, affectedID, [child]);
      });
      return [...effects, finishUse(G, use)];
    }
    case "peach-garden": {
      const effects = aliveInActionOrder(G, use.sourceID).map(
        (affectedID): GameEffect =>
          nullifiable(G, use.cardName, use.sourceID, affectedID, [
            {
              id: resolutionID(G),
              kind: "recover",
              targetID: affectedID,
              amount: 1,
            },
          ]),
      );
      return [...effects, finishUse(G, use)];
    }
    case "harvest":
      return [
        {
          id: resolutionID(G),
          kind: "harvest",
          sourceID: use.sourceID,
          targetIDs: aliveInActionOrder(G, use.sourceID),
          poolCardIDs: [],
        },
        finishUse(G, use),
      ];
    case "indulgence":
    case "lightning": {
      const delayedTarget =
        use.cardName === "lightning" ? use.sourceID : targetID;
      return [
        nullifiable(G, use.cardName, use.sourceID, delayedTarget, [
          {
            id: resolutionID(G),
            kind: "place-delayed",
            targetID: delayedTarget,
            cardID: use.materialCardIDs[0],
          },
        ]),
        finishUse(G, use),
      ];
    }
    default:
      return [finishUse(G, use)];
  }
}

export function declareCardUse(
  G: TqsGameState,
  playerID: PlayerID,
  input: unknown,
  shuffle: Shuffle,
): boolean {
  if (!isPlayCardInput(input)) return false;
  if (!isIdleForPlay(G, playerID)) return false;
  if (input.kind === "serpent-spear") {
    return declareSerpentSpearUse(
      G,
      playerID,
      input.cardIDs,
      input.targetIDs,
      shuffle,
    );
  }
  if (input.kind === "virtual") {
    return declareVirtualUse(
      G,
      playerID,
      input.cardID,
      input.as,
      input.targetIDs,
      shuffle,
    );
  }
  if (!hasCardInHand(G, playerID, input.cardID)) return false;
  const card = G.cards[input.cardID];
  if (
    !card ||
    card.definitionID === "dodge" ||
    card.definitionID === "nullification"
  )
    return false;
  if (!validateTargets(G, playerID, card, input.targetIDs)) return false;
  if (
    card.definitionID === "peach" &&
    G.players[playerID].hp >= G.players[playerID].maxHP
  )
    return false;
  if (card.definitionID === "lightning" && hasDelayed(G, playerID, "lightning"))
    return false;

  if (CARD_DEFINITIONS[card.definitionID].kind === "equipment") {
    equipCard(G, playerID, card.id);
    resolveCardGame(G, shuffle);
    return true;
  }

  if (card.definitionID === "slash") {
    const hasCrossbow = equipmentName(G, playerID, "weapon") === "crossbow";
    if (
      !hasCrossbow &&
      !hasSkill(G, playerID, "pao-xiao") &&
      G.players[playerID].slashUses >= 1
    )
      return false;
    G.players[playerID].slashUses += 1;
  }

  const orderedTargets =
    card.definitionID === "slash"
      ? aliveInActionOrder(G, playerID).filter((targetID) =>
          input.targetIDs.includes(targetID),
        )
      : [...input.targetIDs];
  const use = newUse(G, card, playerID, orderedTargets);
  G.effectStack.push(...compileCardUse(G, use));
  handToProcessing(G, playerID, card.id);
  writeLog(
    G,
    `${playerName(G, playerID)} sử dụng 【${CARD_DEFINITIONS[card.definitionID].name}】.`,
  );
  if (
    [
      "duel",
      "dismantle",
      "snatch",
      "borrowed-sword",
      "ex-nihilo",
      "arrow-barrage",
      "barbarian-invasion",
      "peach-garden",
      "harvest",
    ].includes(card.definitionID)
  )
    afterTrickUse(G, playerID, shuffle);
  resolveCardGame(G, shuffle);
  return true;
}

function virtualSlashColor(
  G: TqsGameState,
  cardIDs: [string, string],
): CardColor {
  const colors = cardIDs.map((cardID) => cardColor(G.cards[cardID]));
  return colors[0] === colors[1] ? colors[0] : "colorless";
}

function createVirtualSlashUse(
  G: TqsGameState,
  sourceID: PlayerID,
  cardIDs: [string, string],
  targetIDs: PlayerID[],
  reason: CardUse["reason"] = "play",
): CardUse {
  return {
    id: resolutionID(G),
    cardName: "slash",
    sourceID,
    materialCardIDs: [...cardIDs],
    targetIDs: [...targetIDs],
    reason,
    color: virtualSlashColor(G, cardIDs),
  };
}

function canUseSerpentSpear(
  G: TqsGameState,
  playerID: PlayerID,
  cardIDs: [string, string],
): boolean {
  return (
    Array.isArray(cardIDs) &&
    cardIDs.length === 2 &&
    equipmentName(G, playerID, "weapon") === "serpent-spear" &&
    cardIDs[0] !== cardIDs[1] &&
    cardIDs.every((cardID) => hasCardInHand(G, playerID, cardID))
  );
}

function declareSerpentSpearUse(
  G: TqsGameState,
  playerID: PlayerID,
  cardIDs: [string, string],
  targetIDs: PlayerID[],
  shuffle: Shuffle,
): boolean {
  if (!canUseSerpentSpear(G, playerID, cardIDs)) return false;
  const representative = G.cards[cardIDs[0]];
  const slashCard = { ...representative, definitionID: "slash" as const };
  if (!validateTargets(G, playerID, slashCard, targetIDs, 2)) return false;
  const hasCrossbow = equipmentName(G, playerID, "weapon") === "crossbow";
  if (
    !hasCrossbow &&
    !hasSkill(G, playerID, "pao-xiao") &&
    G.players[playerID].slashUses >= 1
  )
    return false;
  G.players[playerID].slashUses += 1;
  const orderedTargets = aliveInActionOrder(G, playerID).filter((targetID) =>
    targetIDs.includes(targetID),
  );
  const use = createVirtualSlashUse(G, playerID, cardIDs, orderedTargets);
  G.effectStack.push(...compileCardUse(G, use));
  for (const cardID of cardIDs) handToProcessing(G, playerID, cardID);
  writeLog(
    G,
    `${playerName(G, playerID)} dùng 【Trượng Bát Xà Mâu】 tạo 【Sát】.`,
  );
  resolveCardGame(G, shuffle);
  return true;
}

function declareVirtualUse(
  G: TqsGameState,
  playerID: PlayerID,
  cardID: string,
  as: "slash" | "snatch" | "indulgence",
  targetIDs: PlayerID[],
  shuffle: Shuffle,
): boolean {
  if (!isIdleForPlay(G, playerID)) return false;
  if (!hasCardInZone(G, playerID, cardID)) return false;
  const card = G.cards[cardID];
  if (!card) return false;

  let representative: PhysicalCard;
  if (as === "slash") {
    const convertible =
      (hasSkill(G, playerID, "wu-sheng") && cardColor(card) === "red") ||
      (hasSkill(G, playerID, "long-dan") && card.definitionID === "dodge");
    if (!convertible || card.definitionID === "slash") return false;
    const hasCrossbow = equipmentName(G, playerID, "weapon") === "crossbow";
    if (
      !hasCrossbow &&
      !hasSkill(G, playerID, "pao-xiao") &&
      G.players[playerID].slashUses >= 1
    )
      return false;
    G.players[playerID].slashUses += 1;
    representative = { ...card, definitionID: "slash" };
  } else if (as === "indulgence") {
    if (!(hasSkill(G, playerID, "guo-se") && card.suit === "diamond"))
      return false;
    representative = { ...card, definitionID: "indulgence" };
  } else {
    if (!(hasSkill(G, playerID, "qi-xi") && cardColor(card) === "black"))
      return false;
    representative = { ...card, definitionID: "snatch" };
  }

  if (!validateTargets(G, playerID, representative, targetIDs)) return false;
  const orderedTargets =
    as === "slash"
      ? aliveInActionOrder(G, playerID).filter((targetID) =>
          targetIDs.includes(targetID),
        )
      : [...targetIDs];
  const use: CardUse = {
    id: resolutionID(G),
    cardName: as,
    sourceID: playerID,
    materialCardIDs: [card.id],
    targetIDs: orderedTargets,
    reason: "play",
    color: cardColor(card),
  };
  G.effectStack.push(...compileCardUse(G, use));
  zoneToProcessing(G, playerID, card.id);
  writeLog(
    G,
    `${playerName(G, playerID)} dùng 【${CARD_DEFINITIONS[card.definitionID].name}】 làm 【${CARD_DEFINITIONS[as].name}】.`,
  );
  if (as === "snatch") afterTrickUse(G, playerID, shuffle);
  resolveCardGame(G, shuffle);
  return true;
}

function afterTrickUse(
  G: TqsGameState,
  playerID: PlayerID,
  shuffle: Shuffle,
): void {
  if (hasSkill(G, playerID, "ji-zhi"))
    G.effectStack.unshift({
      id: resolutionID(G),
      kind: "optional-skill",
      ownerID: playerID,
      skillID: "ji-zhi",
    });
  void shuffle;
}

function equipCard(G: TqsGameState, playerID: PlayerID, cardID: string): void {
  const card = G.cards[cardID];
  const definition = CARD_DEFINITIONS[card.definitionID];
  const slot = definition.equipmentSlot!;
  removeHandCard(G, playerID, cardID);
  const oldCardID = G.players[playerID].equipment[slot];
  if (oldCardID) {
    loseEquipmentCard(G, playerID);
    G.discard.push(oldCardID);
  }
  G.players[playerID].equipment[slot] = cardID;
  writeLog(G, `${playerName(G, playerID)} trang bị 【${definition.name}】.`);
}

function finishTurn(G: TqsGameState, shuffle: Shuffle): void {
  const currentID = G.turn.activePlayerID;
  const nextID = nextLivingPlayer(G, currentID);
  G.turn = {
    activePlayerID: nextID,
    step: "prepare",
    number: G.turn.number + 1,
    skippedSteps: [],
    resolvedJudgementCardIDs: [],
    drewCards: false,
    luoYiBuff: false,
    rendeGiven: 0,
    wangZunResolved: false,
    wangZunHandLimitPenalty: 0,
    biYueResolved: false,
  };
  G.players[nextID].slashUses = 0;
  G.players[nextID].skillsUsedThisTurn = [];
  writeLog(G, `Lượt của ${playerName(G, nextID)} bắt đầu.`);
  void shuffle;
}

export function startCardTurn(
  G: TqsGameState,
  playerID: PlayerID,
  shuffle: Shuffle,
): void {
  G.turn = {
    activePlayerID: playerID,
    step: "prepare",
    number: G.turn.number + 1,
    skippedSteps: [],
    resolvedJudgementCardIDs: [],
    drewCards: false,
    luoYiBuff: false,
    rendeGiven: 0,
    wangZunResolved: false,
    wangZunHandLimitPenalty: 0,
    biYueResolved: false,
  };
  G.players[playerID].slashUses = 0;
  G.players[playerID].skillsUsedThisTurn = [];
  writeLog(G, `Lượt của ${playerName(G, playerID)} bắt đầu.`);
  resolveCardGame(G, shuffle);
}

function disposeProcessing(G: TqsGameState): void {
  G.discard.push(...G.processing);
  G.processing = [];
}

function killPlayer(
  G: TqsGameState,
  playerID: PlayerID,
  sourceID: PlayerID | null,
  shuffle: Shuffle,
): void {
  const player = G.players[playerID];
  player.alive = false;
  player.roleRevealed = true;
  G.discard.push(
    ...player.hand,
    ...Object.values(player.equipment),
    ...player.judgement,
  );
  player.hand = [];
  player.equipment = {};
  player.judgement = [];
  writeLog(
    G,
    `${playerName(G, playerID)} tử trận, Thân Phận là ${ROLE_NAMES[player.role]}.`,
  );

  const winner = determineWinner(G);
  if (winner) {
    G.winner = winner;
    G.status = "ended";
    G.prompt = null;
    G.effectStack = [];
    disposeProcessing(G);
    writeLog(G, winner.reason);
    return;
  }

  const source = sourceID ? G.players[sourceID] : null;
  if (source?.alive && player.role === "rebel") {
    drawCards(G, source.id, 3, shuffle);
    writeLog(G, `${playerName(G, source.id)} rút 3 lá vì tiêu diệt Phản Tặc.`);
  } else if (
    source?.alive &&
    source.role === "lord" &&
    player.role === "loyalist"
  ) {
    G.discard.push(...source.hand, ...Object.values(source.equipment));
    source.hand = [];
    source.equipment = {};
    writeLog(G, "Chủ Công bỏ toàn bộ bài vì tiêu diệt Trung Thần.");
  }
}

function moveSelectedCard(
  G: TqsGameState,
  prompt: SelectCardsPrompt,
  answer: PromptAnswer,
): string[] | null {
  if (answer.kind !== "zone-cards") return null;
  if (
    answer.choices.length < prompt.minimum ||
    answer.choices.length > prompt.maximum
  )
    return null;

  const cardIDs = answer.choices.map((choice) => {
    if (choice.zone === "processing") {
      if (!prompt.zones.includes("processing")) return null;
      return G.processing.includes(choice.cardID) ? choice.cardID : null;
    }
    if (choice.ownerID !== prompt.ownerID) return null;
    if (!prompt.zones.includes(choice.zone)) return null;
    if (choice.zone === "hand")
      return G.players[choice.ownerID].hand[choice.handIndex] ?? null;
    if (choice.zone === "equipment") {
      if (
        prompt.reason === "qilin-bow" &&
        choice.slot !== "offensive-mount" &&
        choice.slot !== "defensive-mount"
      )
        return null;
      const cardID = G.players[choice.ownerID].equipment[choice.slot] ?? null;
      return cardID;
    }
    if (choice.zone === "judgement")
      return G.players[choice.ownerID].judgement.includes(choice.cardID)
        ? choice.cardID
        : null;
    return null;
  });
  if (
    !cardIDs.every(
      (cardID): cardID is string =>
        typeof cardID === "string" && Boolean(G.cards[cardID]),
    )
  )
    return null;
  if (new Set(cardIDs).size !== cardIDs.length) return null;
  return cardIDs;
}

function removeZoneCard(
  G: TqsGameState,
  ownerID: PlayerID,
  cardID: string,
): void {
  const player = G.players[ownerID];
  const handIndex = player.hand.indexOf(cardID);
  if (handIndex >= 0) {
    player.hand.splice(handIndex, 1);
    return;
  }
  for (const slot of [
    "weapon",
    "armor",
    "offensive-mount",
    "defensive-mount",
  ] as EquipmentSlot[]) {
    if (player.equipment[slot] === cardID) {
      loseEquipmentCard(G, ownerID);
      delete player.equipment[slot];
      return;
    }
  }
  const judgementIndex = player.judgement.indexOf(cardID);
  if (judgementIndex >= 0) player.judgement.splice(judgementIndex, 1);
}

function closeNullification(
  G: TqsGameState,
  effect: NullificationEffect,
): void {
  for (const cardID of effect.nullificationCardIDs)
    processingToDiscard(G, cardID);
  G.effectStack.shift();
  if (!effect.negated) {
    G.effectStack.unshift(...effect.children);
    return;
  }
  if (effect.onNegated === "discard-delayed" && effect.delayedCardID) {
    const owner = G.players[effect.targetID];
    const index = owner.judgement.indexOf(effect.delayedCardID);
    if (index >= 0) owner.judgement.splice(index, 1);
    G.discard.push(effect.delayedCardID);
  }
  if (effect.onNegated === "transfer-lightning" && effect.delayedCardID)
    transferLightning(G, effect.targetID, effect.delayedCardID);
}

function transferLightning(
  G: TqsGameState,
  fromID: PlayerID,
  cardID: string,
): void {
  const from = G.players[fromID];
  const index = from.judgement.indexOf(cardID);
  if (index >= 0) from.judgement.splice(index, 1);

  let candidate = nextLivingPlayer(G, fromID);
  for (let count = 0; count < G.seatOrder.length - 1; count += 1) {
    if (!hasDelayed(G, candidate, "lightning")) {
      G.players[candidate].judgement.push(cardID);
      writeLog(G, `【Thiểm Điện】 chuyển sang ${playerName(G, candidate)}.`);
      return;
    }
    candidate = nextLivingPlayer(G, candidate);
  }
  G.players[fromID].judgement.push(cardID);
  G.turn.resolvedJudgementCardIDs.push(cardID);
}

function promptNullification(
  G: TqsGameState,
  effect: NullificationEffect,
): void {
  effect.responderID =
    effect.responderID ??
    nextLivingPlayer(G, effect.sourceID ?? G.turn.activePlayerID);
  G.prompt = responsePrompt(
    G,
    effect.id,
    effect.responderID,
    "nullification",
    "nullification",
    effect.sourceID,
    effect.targetID,
    {
      subjectCardName: effect.cardName,
      chainDepth: effect.nullificationCardIDs.length,
      currentlyNegated: effect.negated,
    },
  );
}

function resolveNullification(
  G: TqsGameState,
  effect: NullificationEffect,
): void {
  const excluded =
    effect.nullificationCardIDs.length === 0 && effect.sourceID
      ? [effect.sourceID]
      : [];
  if (aliveInActionOrder(G).every((playerID) => excluded.includes(playerID))) {
    closeNullification(G, effect);
    return;
  }
  promptNullification(G, effect);
}

function advanceSlashTarget(effect: SlashEffect): void {
  effect.targetIndex += 1;
  resetSlashTargetStage(effect);
}

function resetSlashTargetStage(effect: SlashEffect): void {
  effect.stage = "start";
  effect.ignoreArmor = false;
  effect.baguaTried = false;
  effect.tieJiTried = false;
  effect.ignoreDodge = false;
  effect.liuLiDiscardID = null;
}

function resolveSlash(G: TqsGameState, effect: SlashEffect): void {
  const sourceID = effect.use.sourceID;
  const targetID = effect.use.targetIDs[effect.targetIndex];
  if (!targetID || !G.players[targetID]?.alive) {
    if (effect.targetIndex + 1 >= effect.use.targetIDs.length)
      G.effectStack.shift();
    else advanceSlashTarget(effect);
    return;
  }

  if (effect.stage === "start") {
    effect.ignoreArmor =
      equipmentName(G, sourceID, "weapon") === "qinggang-sword";
    if (hasSkill(G, targetID, "liu-li")) {
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "option",
        responderID: targetID,
        reason: "liu-li",
        sourceID,
        targetID,
        choices: ["activate", "decline"],
      };
      return;
    }
    const sourceGeneral = GENERALS_BY_ID[G.players[sourceID].generalID!];
    const targetGeneral = GENERALS_BY_ID[G.players[targetID].generalID!];
    if (
      equipmentName(G, sourceID, "weapon") === "gender-swords" &&
      sourceGeneral.gender !== targetGeneral.gender
    ) {
      effect.stage = "gender-swords";
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "option",
        responderID: sourceID,
        reason: "gender-swords",
        sourceID,
        targetID,
        choices: ["activate", "decline"],
      };
      return;
    }
    effect.stage = "dodge";
  }

  if (effect.stage === "dodge") {
    if (
      !effect.ignoreArmor &&
      equipmentName(G, targetID, "armor") === "renwang-shield" &&
      effect.use.color === "black"
    ) {
      advanceSlashTarget(effect);
      return;
    }
    if (!effect.tieJiTried && hasSkill(G, sourceID, "tie-ji")) {
      effect.tieJiTried = true;
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "option",
        responderID: sourceID,
        reason: "tie-ji",
        sourceID,
        targetID,
        choices: ["activate", "decline"],
      };
      return;
    }
    if (effect.ignoreDodge) {
      const allowBagua =
        !effect.ignoreArmor &&
        !effect.baguaTried &&
        equipmentName(G, targetID, "armor") === "bagua-formation";
      if (allowBagua) {
        G.prompt = responsePrompt(
          G,
          effect.id,
          targetID,
          "dodge",
          "slash",
          sourceID,
          targetID,
          { allowBagua: true, forbidCard: true },
        );
        return;
      }
      effect.stage = "before-damage";
      return;
    }
    G.prompt = responsePrompt(
      G,
      effect.id,
      targetID,
      "dodge",
      "slash",
      sourceID,
      targetID,
      {
        allowBagua:
          !effect.ignoreArmor &&
          !effect.baguaTried &&
          equipmentName(G, targetID, "armor") === "bagua-formation",
      },
    );
    return;
  }

  if (effect.stage === "dodged") {
    const weapon = equipmentName(G, sourceID, "weapon");
    if (weapon === "rock-cleaving-axe" || weapon === "green-dragon-blade") {
      if (
        weapon === "rock-cleaving-axe" &&
        G.players[sourceID].hand.length +
          Object.values(G.players[sourceID].equipment).length <
          2
      ) {
        advanceSlashTarget(effect);
        return;
      }
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "option",
        responderID: sourceID,
        reason:
          weapon === "rock-cleaving-axe"
            ? "rock-cleaving-axe"
            : "green-dragon-blade",
        sourceID,
        targetID,
        choices: ["activate", "decline"],
      };
      return;
    }
    advanceSlashTarget(effect);
    return;
  }

  if (effect.stage === "before-damage") {
    if (
      equipmentName(G, sourceID, "weapon") === "ice-sword" &&
      (G.players[targetID].hand.length > 0 ||
        Object.values(G.players[targetID].equipment).length > 0)
    ) {
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "option",
        responderID: sourceID,
        reason: "ice-sword",
        sourceID,
        targetID,
        choices: ["activate", "decline"],
      };
      return;
    }
    effect.stage = "after-damage";
    G.effectStack.unshift(
      meleeDamage(
        G,
        sourceID,
        targetID,
        effect.use.materialCardIDs,
        "slash",
        effect.use.color,
      ),
    );
    return;
  }

  if (effect.stage === "after-damage") {
    const target = G.players[targetID];
    if (
      target.alive &&
      equipmentName(G, sourceID, "weapon") === "qilin-bow" &&
      (target.equipment["offensive-mount"] ||
        target.equipment["defensive-mount"])
    ) {
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "option",
        responderID: sourceID,
        reason: "qilin-bow",
        sourceID,
        targetID,
        choices: ["activate", "decline"],
      };
      return;
    }
    advanceSlashTarget(effect);
  }
}

function resolveDuel(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "duel" }>,
): void {
  if (
    !G.players[effect.responderID].alive ||
    !G.players[effect.opponentID].alive
  ) {
    G.effectStack.shift();
    return;
  }
  G.prompt = responsePrompt(
    G,
    effect.id,
    effect.responderID,
    "slash",
    "duel",
    effect.opponentID,
    effect.responderID,
    {
      allowSerpentSpear:
        equipmentName(G, effect.responderID, "weapon") === "serpent-spear",
    },
  );
}

function resolveRequiredResponse(
  G: TqsGameState,
  effect: RequiredResponseEffect,
): void {
  if (!G.players[effect.targetID].alive) {
    G.effectStack.shift();
    return;
  }
  G.prompt = responsePrompt(
    G,
    effect.id,
    effect.targetID,
    effect.response,
    effect.reason,
    effect.sourceID,
    effect.targetID,
    {
      allowBagua:
        effect.response === "dodge" &&
        !effect.baguaTried &&
        equipmentName(G, effect.targetID, "armor") === "bagua-formation",
      allowSerpentSpear:
        effect.response === "slash" &&
        equipmentName(G, effect.targetID, "weapon") === "serpent-spear",
    },
  );
}

function resolveTargetCard(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "target-card" }>,
): void {
  if (!hasZoneCard(G, effect.targetID)) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "select-cards",
    responderID: effect.sourceID,
    reason: effect.result === "gain" ? "snatch" : "dismantle",
    ownerID: effect.targetID,
    zones: ["hand", "equipment", "judgement"],
    minimum: 1,
    maximum: 1,
    allowPass: false,
  };
}

function resolveBorrowedSword(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "borrowed-sword" }>,
): void {
  if (!G.players[effect.weaponHolderID].equipment.weapon) {
    G.effectStack.shift();
    return;
  }
  G.prompt = responsePrompt(
    G,
    effect.id,
    effect.weaponHolderID,
    "slash",
    "borrowed-sword",
    effect.sourceID,
    effect.slashTargetID,
    {
      allowSerpentSpear:
        equipmentName(G, effect.weaponHolderID, "weapon") === "serpent-spear",
    },
  );
}

function resolveHarvest(
  G: TqsGameState,
  effect: HarvestEffect,
  shuffle: Shuffle,
): void {
  for (let index = 0; index < effect.targetIDs.length; index += 1) {
    const cardID = takeTopCard(G, shuffle);
    if (cardID) {
      G.processing.push(cardID);
      effect.poolCardIDs.push(cardID);
    }
  }
  G.effectStack.shift();
  const picks = effect.targetIDs.map((targetID): GameEffect => {
    const pick: GameEffect = {
      id: resolutionID(G),
      kind: "harvest-pick",
      targetID,
      poolCardIDs: effect.poolCardIDs,
    };
    return nullifiable(G, "harvest", effect.sourceID, targetID, [pick]);
  });
  G.effectStack.unshift(...picks, {
    id: resolutionID(G),
    kind: "harvest-cleanup",
    poolCardIDs: effect.poolCardIDs,
  });
}

function resolveDelayed(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "resolve-delayed" }>,
  shuffle: Shuffle,
): void {
  const card = G.cards[effect.cardID];
  const owner = G.players[effect.ownerID];
  const delayedIndex = owner.judgement.indexOf(effect.cardID);
  if (!card || delayedIndex < 0) {
    G.effectStack.shift();
    return;
  }

  owner.judgement.splice(delayedIndex, 1);
  const judgeCardID = takeTopCard(G, shuffle);
  if (!judgeCardID) {
    G.discard.push(effect.cardID);
    G.effectStack.shift();
    return;
  }
  const judgeCard = G.cards[judgeCardID];
  G.discard.push(judgeCardID);
  effect.judgeCardID = judgeCardID;
  writeLog(
    G,
    `${playerName(G, effect.ownerID)} phán xét ${judgeCard.suit} ${judgeCard.rank}.`,
  );
  const guiCaiUser = G.seatOrder.find(
    (playerID) =>
      G.players[playerID].alive &&
      hasSkill(G, playerID, "gui-cai") &&
      G.players[playerID].hand.length > 0,
  );
  if (guiCaiUser) {
    G.prompt = {
      id: resolutionID(G),
      effectID: effect.id,
      kind: "option",
      responderID: guiCaiUser,
      reason: "gui-cai",
      sourceID: guiCaiUser,
      targetID: effect.ownerID,
      choices: ["activate", "decline"],
    };
    return;
  }
  G.effectStack.shift();
  applyJudgementResult(G, effect);
}

function applyJudgementResult(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "resolve-delayed" }>,
): void {
  if (!effect.judgeCardID) return;
  const card = G.cards[effect.cardID];
  const owner = G.players[effect.ownerID];
  const judgeCard = G.cards[effect.judgeCardID];

  if (hasSkill(G, effect.ownerID, "tian-du")) {
    const discardIndex = G.discard.indexOf(effect.judgeCardID);
    if (discardIndex >= 0) {
      G.discard.splice(discardIndex, 1);
      owner.hand.push(effect.judgeCardID);
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Thiên Đố】 nhận lá phán xét.`,
      );
    }
  }

  if (card.definitionID === "indulgence") {
    G.discard.push(effect.cardID);
    if (judgeCard.suit !== "heart") G.turn.skippedSteps.push("play");
    return;
  }
  const rank = Number.parseInt(judgeCard.rank, 10);
  if (judgeCard.suit === "spade" && rank >= 2 && rank <= 9) {
    G.discard.push(effect.cardID);
    G.effectStack.unshift(damageEffect(G, null, effect.ownerID, 3, "thunder"));
  } else {
    transferLightning(G, effect.ownerID, effect.cardID);
  }
}

function resolveDamage(G: TqsGameState, effect: DamageEffect): void {
  if (!G.players[effect.targetID].alive) {
    G.effectStack.shift();
    return;
  }
  if (effect.stage === "apply") {
    G.players[effect.targetID].hp -= effect.amount;
    writeLog(
      G,
      `${playerName(G, effect.targetID)} chịu ${effect.amount} điểm Sát Thương.`,
    );
    effect.stage = "after-dying";
    if (G.players[effect.targetID].hp <= 0) {
      G.effectStack.unshift({
        id: resolutionID(G),
        kind: "dying",
        dyingPlayerID: effect.targetID,
        sourceID: effect.sourceID,
        responderID: G.turn.activePlayerID,
        passedPlayerIDs: [],
      });
    }
    return;
  }
  const target = G.players[effect.targetID];
  const triggers: GameEffect[] = [];
  if (target.alive) {
    if (hasSkill(G, target.id, "yi-ji"))
      triggers.push({
        id: resolutionID(G),
        kind: "yi-ji",
        ownerID: target.id,
        remainingOpportunities: effect.amount,
        stage: "offer",
        poolCardIDs: [],
        selectedCardID: null,
      });
    const causeCardIDs = effect.cardIDs.filter((cardID) =>
      G.processing.includes(cardID),
    );
    if (causeCardIDs.length > 0 && hasSkill(G, target.id, "jian-xiong"))
      triggers.push({
        id: resolutionID(G),
        kind: "jian-xiong",
        ownerID: target.id,
        cardIDs: causeCardIDs,
      });
    if (!effect.sourceID || !G.players[effect.sourceID].alive) {
      G.effectStack.shift();
      if (triggers.length > 0) G.effectStack.unshift(...triggers);
      return;
    }
    if (hasSkill(G, target.id, "fan-kui") && hasZoneCard(G, effect.sourceID))
      triggers.push({
        id: resolutionID(G),
        kind: "fan-kui",
        ownerID: target.id,
        sourceID: effect.sourceID,
      });
    if (hasSkill(G, target.id, "gang-lie"))
      triggers.push({
        id: resolutionID(G),
        kind: "gang-lie",
        ownerID: target.id,
        sourceID: effect.sourceID,
        judgeCardID: null,
      });
    if (
      effect.cardName === "slash" &&
      effect.cardColor === "red" &&
      hasSkill(G, target.id, "yao-wu")
    )
      triggers.push({
        id: resolutionID(G),
        kind: "yao-wu",
        ownerID: target.id,
        sourceID: effect.sourceID,
      });
  }
  G.effectStack.shift();
  if (triggers.length > 0) G.effectStack.unshift(...triggers);
}

function resolveFanKui(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "fan-kui" }>,
): void {
  if (
    !G.players[effect.ownerID].alive ||
    !G.players[effect.sourceID].alive ||
    !hasZoneCard(G, effect.sourceID)
  ) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.ownerID,
    reason: "fan-kui",
    sourceID: effect.sourceID,
    targetID: effect.ownerID,
    choices: ["activate", "decline"],
  };
}

function resolveGangLie(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "gang-lie" }>,
  shuffle: Shuffle,
): void {
  if (!G.players[effect.ownerID].alive || !G.players[effect.sourceID].alive) {
    G.effectStack.shift();
    return;
  }
  const judgeCardID = takeTopCard(G, shuffle);
  if (judgeCardID) {
    const judgeCard = G.cards[judgeCardID];
    G.discard.push(judgeCardID);
    effect.judgeCardID = judgeCardID;
    writeLog(G, `【Cương Liệt】 phán xét ${judgeCard.suit} ${judgeCard.rank}.`);
    if (judgeCard.suit !== "heart") {
      const source = G.players[effect.sourceID];
      if (source.hand.length >= 2) {
        G.prompt = {
          id: resolutionID(G),
          effectID: effect.id,
          kind: "select-cards",
          responderID: effect.sourceID,
          reason: "gang-lie-discard",
          ownerID: effect.sourceID,
          zones: ["hand"],
          minimum: 2,
          maximum: 2,
          allowPass: false,
        };
        return;
      }
      G.effectStack.shift();
      G.effectStack.unshift(damageEffect(G, effect.ownerID, effect.sourceID));
      return;
    }
  }
  G.effectStack.shift();
}

function resolveDying(G: TqsGameState, effect: DyingEffect): void {
  if (G.players[effect.dyingPlayerID].hp >= 1) {
    G.effectStack.shift();
    return;
  }
  G.prompt = responsePrompt(
    G,
    effect.id,
    effect.responderID,
    "peach",
    "rescue",
    effect.sourceID,
    effect.dyingPlayerID,
  );
}

function performRegularDraw(
  G: TqsGameState,
  playerID: PlayerID,
  shuffle: Shuffle,
): void {
  const amount = hasSkill(G, playerID, "ying-zi") ? 3 : 2;
  drawCards(G, playerID, amount, shuffle);
  writeLog(
    G,
    `${playerName(G, playerID)} rút ${amount} lá${amount === 3 ? " (【Anh Tư】)" : ""}.`,
  );
  advanceAfterDraw(G, playerID);
}

function advanceAfterDraw(G: TqsGameState, playerID: PlayerID): void {
  if (G.turn.skippedSteps.includes("play")) enterDiscardPhase(G, playerID);
  else G.turn.step = "play";
}

function enterDiscardPhase(G: TqsGameState, playerID: PlayerID): void {
  G.turn.step = "discard";
  if (G.players[playerID].hand.length <= handLimit(G, playerID)) {
    G.turn.step = "end";
    return;
  }
  if (hasSkill(G, playerID, "ke-ji") && G.players[playerID].slashUses === 0)
    G.effectStack.unshift({
      id: resolutionID(G),
      kind: "optional-skill",
      ownerID: playerID,
      skillID: "ke-ji",
    });
}

function resolveTuXi(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "tu-xi" }>,
): void {
  const ownerID = effect.ownerID;
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: ownerID,
    reason: "tu-xi",
    sourceID: ownerID,
    targetID: ownerID,
    choices: ["activate", "decline"],
  };
}

function resolveLianYing(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "lian-ying" }>,
): void {
  if (
    !G.players[effect.ownerID].alive ||
    G.players[effect.ownerID].hand.length > 0
  ) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.ownerID,
    reason: "lian-ying",
    sourceID: effect.ownerID,
    targetID: effect.ownerID,
    choices: ["activate", "decline"],
  };
}

function resolveXiaoJi(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "xiao-ji" }>,
): void {
  if (!G.players[effect.ownerID].alive) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.ownerID,
    reason: "xiao-ji",
    sourceID: effect.ownerID,
    targetID: effect.ownerID,
    choices: ["activate", "decline"],
  };
}

function resolveLuoYi(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "luo-yi" }>,
): void {
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.ownerID,
    reason: "luo-yi",
    sourceID: effect.ownerID,
    targetID: effect.ownerID,
    choices: ["activate", "decline"],
  };
}

function resolveYiJi(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "yi-ji" }>,
): void {
  const owner = G.players[effect.ownerID];
  if (!owner.alive || effect.remainingOpportunities <= 0) {
    G.effectStack.shift();
    return;
  }
  if (effect.stage === "offer") {
    G.prompt = {
      id: resolutionID(G),
      effectID: effect.id,
      kind: "option",
      responderID: effect.ownerID,
      reason: "yi-ji",
      sourceID: effect.ownerID,
      targetID: effect.ownerID,
      choices: ["activate", "decline"],
    };
    return;
  }
  if (effect.stage === "card") {
    G.prompt = {
      id: resolutionID(G),
      effectID: effect.id,
      kind: "select-cards",
      responderID: effect.ownerID,
      reason: "yi-ji",
      ownerID: effect.ownerID,
      zones: ["hand"],
      minimum: 0,
      maximum: 1,
      allowPass: true,
    };
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "choose-players",
    responderID: effect.ownerID,
    reason: "yi-ji",
    candidates: G.seatOrder.filter((playerID) => G.players[playerID].alive),
    minimum: 1,
    maximum: 1,
  };
}

function finishYiJiOpportunity(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "yi-ji" }>,
): void {
  effect.poolCardIDs = [];
  effect.selectedCardID = null;
  effect.remainingOpportunities -= 1;
  if (effect.remainingOpportunities <= 0) G.effectStack.shift();
  else effect.stage = "offer";
}

function resolveFanJian(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "fan-jian" }>,
): void {
  if (!G.players[effect.targetID].alive || !G.players[effect.ownerID].alive) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.targetID,
    reason: "fan-jian-suit",
    sourceID: effect.ownerID,
    targetID: effect.targetID,
    choices: ["heart", "diamond", "club", "spade"],
  };
}

function resolveJianXiong(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "jian-xiong" }>,
): void {
  if (
    !G.players[effect.ownerID].alive ||
    !effect.cardIDs.some((cardID) => G.processing.includes(cardID))
  ) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.ownerID,
    reason: "jian-xiong",
    sourceID: effect.ownerID,
    targetID: effect.ownerID,
    choices: ["activate", "decline"],
  };
}

function resolveYaoWu(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "yao-wu" }>,
): void {
  const source = G.players[effect.sourceID];
  if (!source?.alive) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.sourceID,
    reason: "yao-wu",
    sourceID: effect.sourceID,
    targetID: effect.ownerID,
    choices: source.hp < source.maxHP ? ["recover", "draw"] : ["draw"],
  };
}

function resolveWangZun(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "wang-zun" }>,
): void {
  if (!G.players[effect.ownerID].alive || !G.players[effect.lordID].alive) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.ownerID,
    reason: "wang-zun",
    sourceID: effect.ownerID,
    targetID: effect.lordID,
    choices: ["activate", "decline"],
  };
}

function resolveAllySummon(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "ally-summon" }>,
): void {
  const next = effect.queueIDs.find(
    (id) => G.players[id].alive && !effect.passedIDs.includes(id),
  );
  if (!next) {
    G.effectStack.shift();
    return;
  }
  G.prompt = responsePrompt(
    G,
    effect.id,
    next,
    effect.response,
    "ally-summon",
    effect.lordID,
    next,
    {
      allowSerpentSpear:
        effect.response === "slash" &&
        equipmentName(G, next, "weapon") === "serpent-spear",
    },
  );
}

function completeAllyResponse(
  G: TqsGameState,
  summon: Extract<GameEffect, { kind: "ally-summon" }>,
): void {
  const underlying = G.effectStack.find(
    (candidate) => candidate.id === summon.requesterEffectID,
  );
  if (!underlying) return;
  const allyName = playerName(G, G.prompt!.responderID);
  if (underlying.kind === "slash" && summon.response === "dodge") {
    underlying.dodgesUsed += 1;
    underlying.stage =
      underlying.dodgesUsed < underlying.dodgesRequired ? "dodge" : "dodged";
    writeLog(
      G,
      `【Hộ Giá】: ${allyName} đánh 【Thiểm】 thay ${playerName(G, summon.lordID)}.`,
    );
    return;
  }
  if (underlying.kind === "duel" && summon.response === "slash") {
    underlying.slashesPlayed += 1;
    if (underlying.slashesPlayed >= underlying.slashesRequired) {
      const previous = underlying.responderID;
      underlying.responderID = underlying.opponentID;
      underlying.opponentID = previous;
      underlying.slashesPlayed = 0;
      underlying.slashesRequired = hasSkill(
        G,
        underlying.opponentID,
        "wu-shuang",
      )
        ? 2
        : 1;
    }
    writeLog(
      G,
      `【Kích Tướng】: ${allyName} đánh 【Sát】 thay ${playerName(G, summon.lordID)}.`,
    );
    return;
  }
  if (underlying.kind === "required-response") {
    const index = G.effectStack.indexOf(underlying);
    if (index >= 0) G.effectStack.splice(index, 1);
    writeLog(
      G,
      `【Kích Tướng】: ${allyName} đánh 【Sát】 thay ${playerName(G, summon.lordID)}.`,
    );
  }
}

function resolveGuanXing(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "guan-xing" }>,
): void {
  const owner = G.players[effect.ownerID];
  if (!owner.alive) {
    for (const cardID of effect.poolCardIDs) {
      const index = G.processing.indexOf(cardID);
      if (index >= 0) G.processing.splice(index, 1);
    }
    G.deck = [...effect.poolCardIDs, ...G.deck];
    G.effectStack.shift();
    return;
  }
  if (effect.stage === "offer") {
    G.prompt = {
      id: resolutionID(G),
      effectID: effect.id,
      kind: "option",
      responderID: effect.ownerID,
      reason: "guan-xing",
      sourceID: effect.ownerID,
      targetID: effect.ownerID,
      choices: ["activate", "decline"],
    };
    return;
  }
  const remaining = effect.poolCardIDs.filter(
    (cardID) => !effect.topCardIDs.includes(cardID),
  );
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "select-cards",
    responderID: effect.ownerID,
    reason: "guan-xing",
    ownerID: effect.ownerID,
    zones: ["processing"],
    minimum: effect.stage === "top" ? 0 : remaining.length,
    maximum:
      effect.stage === "top" ? effect.poolCardIDs.length : remaining.length,
    allowPass: effect.stage === "top",
  };
}

function finishGuanXing(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "guan-xing" }>,
  bottomCardIDs: string[],
): void {
  const remainingDeck = G.deck.filter((id) => !effect.poolCardIDs.includes(id));
  G.deck = [...effect.topCardIDs, ...remainingDeck, ...bottomCardIDs];
  for (const cardID of effect.poolCardIDs) {
    const index = G.processing.indexOf(cardID);
    if (index >= 0) G.processing.splice(index, 1);
  }
  writeLog(
    G,
    `${playerName(G, effect.ownerID)} sắp ${effect.topCardIDs.length} lá lên đầu, ${bottomCardIDs.length} lá xuống cuối Chồng Bài Rút.`,
  );
  G.effectStack.shift();
}

function resolveLuoShen(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "luo-shen" }>,
): void {
  if (!G.players[effect.ownerID].alive) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.ownerID,
    reason: "luo-shen",
    sourceID: effect.ownerID,
    targetID: effect.ownerID,
    choices: ["activate", "decline"],
  };
}

function resolveOptionalSkill(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "optional-skill" }>,
): void {
  if (!G.players[effect.ownerID].alive) {
    G.effectStack.shift();
    return;
  }
  G.prompt = {
    id: resolutionID(G),
    effectID: effect.id,
    kind: "option",
    responderID: effect.ownerID,
    reason: effect.skillID,
    sourceID: effect.ownerID,
    targetID: effect.ownerID,
    choices: ["activate", "decline"],
  };
}

function resolveTurnFlow(G: TqsGameState, shuffle: Shuffle): boolean {
  const playerID = G.turn.activePlayerID;
  if (!G.players[playerID].alive) {
    finishTurn(G, shuffle);
    return true;
  }
  if (G.turn.step === "end") {
    if (!G.turn.biYueResolved && hasSkill(G, playerID, "bi-yue")) {
      G.turn.biYueResolved = true;
      G.effectStack.unshift({
        id: resolutionID(G),
        kind: "optional-skill",
        ownerID: playerID,
        skillID: "bi-yue",
      });
      return true;
    }
    finishTurn(G, shuffle);
    return true;
  }
  if (G.turn.step === "prepare") {
    if (!G.turn.wangZunResolved) {
      G.turn.wangZunResolved = true;
      if (playerID === G.lordID) {
        const owners = aliveInActionOrder(G, playerID)
          .slice(1)
          .filter((ownerID) => hasSkill(G, ownerID, "wang-zun"));
        if (owners.length > 0) {
          G.effectStack.unshift(
            ...owners.map((ownerID): GameEffect => ({
              id: resolutionID(G),
              kind: "wang-zun",
              ownerID,
              lordID: playerID,
            })),
          );
          return true;
        }
      }
    }
    if (hasSkill(G, playerID, "guan-xing")) {
      G.turn.step = "judge";
      G.effectStack.unshift({
        id: resolutionID(G),
        kind: "guan-xing",
        ownerID: playerID,
        stage: "offer",
        poolCardIDs: [],
        topCardIDs: [],
      });
      return true;
    }
    if (hasSkill(G, playerID, "luo-shen")) {
      G.turn.step = "judge";
      G.effectStack.unshift({
        id: resolutionID(G),
        kind: "luo-shen",
        ownerID: playerID,
      });
      return true;
    }
    G.turn.step = "judge";
    return true;
  }
  if (G.turn.step === "judge") {
    const judgement = G.players[playerID].judgement;
    const delayedCardID = [...judgement]
      .reverse()
      .find((cardID) => !G.turn.resolvedJudgementCardIDs.includes(cardID));
    if (delayedCardID) {
      const cardName = G.cards[delayedCardID].definitionID;
      const delayed: GameEffect = {
        id: resolutionID(G),
        kind: "resolve-delayed",
        ownerID: playerID,
        cardID: delayedCardID,
        judgeCardID: null,
      };
      G.effectStack.unshift(
        nullifiable(G, cardName, null, playerID, [delayed], {
          onNegated:
            cardName === "lightning" ? "transfer-lightning" : "discard-delayed",
          delayedCardID,
        }),
      );
      return true;
    }
    G.turn.step = "draw";
    return true;
  }
  if (G.turn.step === "draw") {
    if (G.turn.drewCards) return false;
    G.turn.drewCards = true;
    if (hasSkill(G, playerID, "luo-yi")) {
      G.effectStack.unshift({
        id: resolutionID(G),
        kind: "luo-yi",
        ownerID: playerID,
      });
      return true;
    }
    if (
      hasSkill(G, playerID, "tu-xi") &&
      G.seatOrder.some(
        (otherID) =>
          otherID !== playerID &&
          G.players[otherID].alive &&
          G.players[otherID].hand.length > 0,
      )
    ) {
      G.effectStack.unshift({
        id: resolutionID(G),
        kind: "tu-xi",
        ownerID: playerID,
      });
      return true;
    }
    performRegularDraw(G, playerID, shuffle);
    return true;
  }
  return false;
}

export function resolveCardGame(G: TqsGameState, shuffle: Shuffle): void {
  while (G.status === "playing" && G.prompt === null) {
    const effect = G.effectStack[0];
    if (!effect) {
      if (!resolveTurnFlow(G, shuffle)) return;
      continue;
    }
    switch (effect.kind) {
      case "finish-use":
        for (const cardID of effect.materialCardIDs)
          processingToDiscard(G, cardID);
        G.effectStack.shift();
        break;
      case "nullification":
        resolveNullification(G, effect);
        break;
      case "slash":
        resolveSlash(G, effect);
        break;
      case "duel":
        resolveDuel(G, effect);
        break;
      case "target-card":
        resolveTargetCard(G, effect);
        break;
      case "borrowed-sword":
        resolveBorrowedSword(G, effect);
        break;
      case "required-response":
        resolveRequiredResponse(G, effect);
        break;
      case "fan-kui":
        resolveFanKui(G, effect);
        break;
      case "gang-lie":
        resolveGangLie(G, effect, shuffle);
        break;
      case "tu-xi":
        resolveTuXi(G, effect);
        break;
      case "lian-ying":
        resolveLianYing(G, effect);
        break;
      case "xiao-ji":
        resolveXiaoJi(G, effect);
        break;
      case "luo-yi":
        resolveLuoYi(G, effect);
        break;
      case "yi-ji":
        resolveYiJi(G, effect);
        break;
      case "fan-jian":
        resolveFanJian(G, effect);
        break;
      case "jian-xiong":
        resolveJianXiong(G, effect);
        break;
      case "yao-wu":
        resolveYaoWu(G, effect);
        break;
      case "wang-zun":
        resolveWangZun(G, effect);
        break;
      case "ally-summon":
        resolveAllySummon(G, effect);
        break;
      case "guan-xing":
        resolveGuanXing(G, effect);
        break;
      case "luo-shen":
        resolveLuoShen(G, effect);
        break;
      case "optional-skill":
        resolveOptionalSkill(G, effect);
        break;
      case "recover": {
        const player = G.players[effect.targetID];
        player.hp = Math.min(player.maxHP, player.hp + effect.amount);
        G.effectStack.shift();
        break;
      }
      case "draw":
        drawCards(G, effect.targetID, effect.amount, shuffle);
        G.effectStack.shift();
        break;
      case "harvest":
        resolveHarvest(G, effect, shuffle);
        break;
      case "harvest-pick":
        if (
          !G.players[effect.targetID].alive ||
          !effect.poolCardIDs.some((cardID) => G.processing.includes(cardID))
        )
          G.effectStack.shift();
        else
          G.prompt = {
            id: resolutionID(G),
            effectID: effect.id,
            kind: "harvest-choice",
            responderID: effect.targetID,
            availableCardIDs: effect.poolCardIDs.filter((cardID) =>
              G.processing.includes(cardID),
            ),
          };
        break;
      case "harvest-cleanup":
        for (const cardID of effect.poolCardIDs) processingToDiscard(G, cardID);
        G.effectStack.shift();
        break;
      case "place-delayed": {
        const index = G.processing.indexOf(effect.cardID);
        if (index >= 0) G.processing.splice(index, 1);
        G.players[effect.targetID].judgement.push(effect.cardID);
        G.effectStack.shift();
        break;
      }
      case "resolve-delayed":
        resolveDelayed(G, effect, shuffle);
        break;
      case "damage":
        resolveDamage(G, effect);
        break;
      case "dying":
        resolveDying(G, effect);
        break;
    }
  }
}

function discardResponseMaterials(
  G: TqsGameState,
  playerID: PlayerID,
  answer: PromptAnswer,
  expected: "slash" | "dodge" | "peach" | "nullification",
): string[] | null {
  if (answer.kind === "card") {
    if (!matchesResponse(G, playerID, answer.cardID, expected)) return null;
    zoneToDiscard(G, playerID, answer.cardID);
    return [answer.cardID];
  }
  if (answer.kind === "serpent-spear" && expected === "slash") {
    if (!canUseSerpentSpear(G, playerID, answer.cardIDs)) return null;
    for (const cardID of answer.cardIDs) handToDiscard(G, playerID, cardID);
    return [...answer.cardIDs];
  }
  return null;
}

function resolveBagua(
  G: TqsGameState,
  prompt: CardResponsePrompt,
  shuffle: Shuffle,
): boolean {
  if (!prompt.allowBagua) return false;
  const cardID = takeTopCard(G, shuffle);
  if (!cardID) return false;
  const card = G.cards[cardID];
  G.discard.push(cardID);
  const success = cardColor(card) === "red";
  writeLog(
    G,
    `【Bát Quái Trận】 phán xét ${success ? "đỏ, thành công" : "đen, thất bại"}.`,
  );
  const effect = G.effectStack[0];
  if (effect?.kind === "slash") {
    effect.baguaTried = true;
    if (success) {
      effect.dodgesUsed += 1;
      if (effect.dodgesUsed < effect.dodgesRequired) effect.stage = "dodge";
      else effect.stage = "dodged";
    }
  } else if (effect?.kind === "required-response") {
    effect.baguaTried = true;
    if (success) G.effectStack.shift();
  }
  return true;
}

function answerNullification(
  G: TqsGameState,
  effect: NullificationEffect,
  prompt: CardResponsePrompt,
  answer: PromptAnswer,
): boolean {
  if (answer.kind === "card") {
    if (!hasCardInHand(G, prompt.responderID, answer.cardID, "nullification"))
      return false;
    handToProcessing(G, prompt.responderID, answer.cardID);
    effect.nullificationCardIDs.push(answer.cardID);
    effect.negated = !effect.negated;
    writeLog(
      G,
      `${playerName(G, prompt.responderID)} sử dụng 【Vô Giải Khả Kích】.`,
    );
    effect.passedPlayerIDs = [];
    effect.responderID = nextLivingPlayer(G, prompt.responderID);
    return true;
  }
  if (answer.kind !== "pass") return false;
  effect.passedPlayerIDs.push(prompt.responderID);
  const living = aliveInActionOrder(G);
  if (living.every((playerID) => effect.passedPlayerIDs.includes(playerID))) {
    closeNullification(G, effect);
  } else {
    effect.responderID = nextLivingPlayer(G, prompt.responderID);
  }
  return true;
}

function answerSlashPrompt(
  G: TqsGameState,
  effect: SlashEffect,
  prompt: CardResponsePrompt,
  answer: PromptAnswer,
  shuffle: Shuffle,
): boolean {
  if (answer.kind === "bagua") return resolveBagua(G, prompt, shuffle);
  if (prompt.forbidCard && answer.kind === "card") return false;
  if (answer.kind === "pass") {
    effect.stage = "before-damage";
    return true;
  }
  const materials = discardResponseMaterials(
    G,
    prompt.responderID,
    answer,
    "dodge",
  );
  if (!materials) return false;
  effect.dodgesUsed += 1;
  if (effect.dodgesUsed < effect.dodgesRequired) effect.stage = "dodge";
  else effect.stage = "dodged";
  writeLog(G, `${playerName(G, prompt.responderID)} sử dụng 【Thiểm】.`);
  return true;
}

function answerGreenDragonPrompt(
  G: TqsGameState,
  effect: SlashEffect,
  prompt: CardResponsePrompt,
  answer: PromptAnswer,
): boolean {
  const targetID = effect.use.targetIDs[effect.targetIndex];
  if (answer.kind === "pass") {
    advanceSlashTarget(effect);
    return true;
  }

  let childUse: CardUse;
  if (answer.kind === "card") {
    if (!hasCardInHand(G, prompt.responderID, answer.cardID, "slash"))
      return false;
    handToProcessing(G, prompt.responderID, answer.cardID);
    childUse = newUse(
      G,
      G.cards[answer.cardID],
      prompt.responderID,
      [targetID],
      "green-dragon-blade",
    );
  } else if (answer.kind === "serpent-spear") {
    if (!canUseSerpentSpear(G, prompt.responderID, answer.cardIDs))
      return false;
    for (const cardID of answer.cardIDs)
      handToProcessing(G, prompt.responderID, cardID);
    childUse = createVirtualSlashUse(
      G,
      prompt.responderID,
      answer.cardIDs,
      [targetID],
      "green-dragon-blade",
    );
  } else return false;

  advanceSlashTarget(effect);
  G.effectStack.unshift(...compileCardUse(G, childUse));
  return true;
}

function answerDuelPrompt(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "duel" }>,
  prompt: CardResponsePrompt,
  answer: PromptAnswer,
): boolean {
  if (answer.kind === "pass") {
    G.effectStack.shift();
    G.effectStack.unshift(
      meleeDamage(
        G,
        effect.opponentID,
        effect.responderID,
        effect.sourceCardID ? [effect.sourceCardID] : [],
        "duel",
      ),
    );
    return true;
  }
  const materials = discardResponseMaterials(
    G,
    prompt.responderID,
    answer,
    "slash",
  );
  if (!materials) return false;
  effect.slashesPlayed += 1;
  if (effect.slashesPlayed < effect.slashesRequired) {
    G.prompt = responsePrompt(
      G,
      effect.id,
      effect.responderID,
      "slash",
      "duel",
      effect.opponentID,
      effect.responderID,
      {
        allowSerpentSpear:
          equipmentName(G, effect.responderID, "weapon") === "serpent-spear",
      },
    );
    return true;
  }
  const previousResponder = effect.responderID;
  effect.responderID = effect.opponentID;
  effect.opponentID = previousResponder;
  effect.slashesPlayed = 0;
  effect.slashesRequired = hasSkill(G, effect.opponentID, "wu-shuang") ? 2 : 1;
  return true;
}

function answerRequiredResponse(
  G: TqsGameState,
  effect: RequiredResponseEffect,
  prompt: CardResponsePrompt,
  answer: PromptAnswer,
  shuffle: Shuffle,
): boolean {
  if (answer.kind === "bagua") return resolveBagua(G, prompt, shuffle);
  if (answer.kind === "pass") {
    G.effectStack.shift();
    G.effectStack.unshift(
      meleeDamage(
        G,
        effect.sourceID,
        effect.targetID,
        effect.sourceCardID ? [effect.sourceCardID] : [],
      ),
    );
    return true;
  }
  const materials = discardResponseMaterials(
    G,
    prompt.responderID,
    answer,
    effect.response,
  );
  if (!materials) return false;
  G.effectStack.shift();
  return true;
}

function answerBorrowedSword(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "borrowed-sword" }>,
  prompt: CardResponsePrompt,
  answer: PromptAnswer,
): boolean {
  if (answer.kind === "pass") {
    const weaponID = G.players[effect.weaponHolderID].equipment.weapon;
    if (!weaponID) return false;
    loseEquipmentCard(G, effect.weaponHolderID);
    delete G.players[effect.weaponHolderID].equipment.weapon;
    G.players[effect.sourceID].hand.push(weaponID);
    G.effectStack.shift();
    return true;
  }

  let use: CardUse;
  if (answer.kind === "card") {
    if (!hasCardInHand(G, prompt.responderID, answer.cardID, "slash"))
      return false;
    handToProcessing(G, prompt.responderID, answer.cardID);
    use = newUse(
      G,
      G.cards[answer.cardID],
      prompt.responderID,
      [effect.slashTargetID],
      "borrowed-sword",
    );
  } else if (answer.kind === "serpent-spear") {
    if (!canUseSerpentSpear(G, prompt.responderID, answer.cardIDs))
      return false;
    for (const cardID of answer.cardIDs)
      handToProcessing(G, prompt.responderID, cardID);
    use = createVirtualSlashUse(
      G,
      prompt.responderID,
      answer.cardIDs,
      [effect.slashTargetID],
      "borrowed-sword",
    );
  } else return false;

  G.effectStack.shift();
  G.effectStack.unshift(...compileCardUse(G, use));
  return true;
}

function answerRescue(
  G: TqsGameState,
  effect: DyingEffect,
  prompt: CardResponsePrompt,
  answer: PromptAnswer,
  shuffle: Shuffle,
): boolean {
  if (answer.kind === "card") {
    if (!matchesResponse(G, prompt.responderID, answer.cardID, "peach"))
      return false;
    zoneToDiscard(G, prompt.responderID, answer.cardID);
    const dying = G.players[effect.dyingPlayerID];
    const jiuYuanBonus =
      prompt.responderID !== effect.dyingPlayerID &&
      hasSkill(G, dying.id, "jiu-yuan")
        ? 1
        : 0;
    dying.hp += 1 + jiuYuanBonus;
    if (jiuYuanBonus > 0)
      writeLog(
        G,
        `【Cứu Viện】 tăng hiệu quả hồi phục cho ${playerName(G, dying.id)}.`,
      );
    effect.passedPlayerIDs = [];
    if (G.players[effect.dyingPlayerID].hp >= 1) G.effectStack.shift();
    return true;
  }
  if (answer.kind !== "pass") return false;
  effect.passedPlayerIDs.push(prompt.responderID);
  const living = aliveInActionOrder(G);
  if (living.every((playerID) => effect.passedPlayerIDs.includes(playerID))) {
    G.effectStack.shift();
    killPlayer(G, effect.dyingPlayerID, effect.sourceID, shuffle);
  } else {
    effect.responderID = nextLivingPlayer(G, prompt.responderID);
  }
  return true;
}

function answerSelectCards(
  G: TqsGameState,
  effect: GameEffect,
  prompt: SelectCardsPrompt,
  answer: PromptAnswer,
  shuffle: Shuffle,
): boolean {
  if (
    answer.kind === "pass" &&
    prompt.allowPass &&
    effect.kind === "slash" &&
    prompt.reason === "gender-swords"
  ) {
    drawCards(G, effect.use.sourceID, 1, shuffle);
    effect.stage = "dodge";
    return true;
  }
  if (answer.kind === "pass" && prompt.allowPass) {
    if (effect.kind === "yi-ji") {
      finishYiJiOpportunity(G, effect);
      return true;
    }
    if (effect.kind === "guan-xing" && effect.stage === "top") {
      effect.topCardIDs = [];
      effect.stage = "bottom";
      return true;
    }
  }
  const cardIDs = moveSelectedCard(G, prompt, answer);
  if (!cardIDs) return false;

  if (effect.kind === "target-card") {
    for (const cardID of cardIDs) {
      removeZoneCard(G, prompt.ownerID, cardID);
      if (effect.result === "gain")
        G.players[effect.sourceID].hand.push(cardID);
      else G.discard.push(cardID);
      writeLog(
        G,
        `${playerName(G, effect.sourceID)} ${effect.result === "gain" ? "thu lấy" : "bỏ"} một lá của ${playerName(G, prompt.ownerID)}.`,
      );
    }
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "slash") {
    if (prompt.reason === "liu-li") {
      effect.liuLiDiscardID = cardIDs[0];
      const candidates = G.seatOrder.filter(
        (id) => id !== effect.use.sourceID && G.players[id].alive,
      );
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "choose-players",
        responderID: prompt.responderID,
        reason: "liu-li",
        candidates,
        minimum: 1,
        maximum: 1,
      };
      return true;
    }
    for (const cardID of cardIDs) {
      removeZoneCard(G, prompt.ownerID, cardID);
      G.discard.push(cardID);
    }
    if (prompt.reason === "gender-swords") effect.stage = "dodge";
    else if (prompt.reason === "ice-sword") advanceSlashTarget(effect);
    else if (prompt.reason === "rock-cleaving-axe")
      effect.stage = "before-damage";
    else if (prompt.reason === "qilin-bow") advanceSlashTarget(effect);
    else advanceSlashTarget(effect);
    return true;
  }
  if (effect.kind === "guan-xing") {
    for (const cardID of cardIDs)
      if (!effect.poolCardIDs.includes(cardID)) return false;
    if (effect.stage === "top") {
      effect.topCardIDs = cardIDs;
      const remaining = effect.poolCardIDs.filter(
        (cardID) => !cardIDs.includes(cardID),
      );
      if (remaining.length === 0) finishGuanXing(G, effect, []);
      else effect.stage = "bottom";
      return true;
    }
    const remaining = effect.poolCardIDs.filter(
      (cardID) => !effect.topCardIDs.includes(cardID),
    );
    if (
      cardIDs.length !== remaining.length ||
      cardIDs.some((cardID) => !remaining.includes(cardID))
    )
      return false;
    finishGuanXing(G, effect, cardIDs);
    return true;
  }
  if (effect.kind === "yi-ji") {
    if (effect.stage !== "card" || cardIDs.length > 1) return false;
    for (const cardID of cardIDs)
      if (!effect.poolCardIDs.includes(cardID)) return false;
    if (cardIDs.length === 0) {
      finishYiJiOpportunity(G, effect);
      return true;
    }
    effect.selectedCardID = cardIDs[0];
    effect.stage = "recipient";
    return true;
  }
  if (effect.kind === "fan-kui") {
    for (const cardID of cardIDs) {
      removeZoneCard(G, effect.sourceID, cardID);
      G.players[effect.ownerID].hand.push(cardID);
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Phản Quỹ】 lấy một lá của ${playerName(G, effect.sourceID)}.`,
      );
    }
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "gang-lie" && prompt.reason === "gang-lie-discard") {
    for (const cardID of cardIDs) {
      removeZoneCard(G, effect.sourceID, cardID);
      G.discard.push(cardID);
    }
    writeLog(
      G,
      `${playerName(G, effect.sourceID)} bỏ hai lá vì 【Cương Liệt】.`,
    );
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "resolve-delayed" && prompt.reason === "gui-cai") {
    const cardID = cardIDs[0];
    handToDiscard(G, prompt.ownerID, cardID);
    effect.judgeCardID = cardID;
    writeLog(
      G,
      `${playerName(G, prompt.ownerID)} dùng 【Quỷ Tài】 thay lá phán xét.`,
    );
    G.effectStack.shift();
    applyJudgementResult(G, effect);
    return true;
  }
  return false;
}

function answerOption(
  G: TqsGameState,
  effect: GameEffect,
  answer: PromptAnswer,
  shuffle: Shuffle,
): boolean {
  if (answer.kind !== "option") return false;
  const prompt = G.prompt;
  if (prompt?.kind !== "option" || !prompt.choices.includes(answer.choice))
    return false;
  if (effect.kind === "slash") {
    const targetID = effect.use.targetIDs[effect.targetIndex];
    if (prompt.reason === "gender-swords-target") {
      if (answer.choice === "draw") {
        drawCards(G, effect.use.sourceID, 1, shuffle);
        effect.stage = "dodge";
        return true;
      }
      if (answer.choice !== "discard") return false;
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "select-cards",
        responderID: targetID,
        reason: "gender-swords",
        ownerID: targetID,
        zones: ["hand"],
        minimum: 1,
        maximum: 1,
        allowPass: false,
      };
      return true;
    }
    if (answer.choice === "decline") {
      if (effect.stage === "gender-swords") effect.stage = "dodge";
      else if (effect.stage === "dodged") advanceSlashTarget(effect);
      else if (effect.stage === "before-damage") {
        effect.stage = "after-damage";
        G.effectStack.unshift(
          damageEffect(
            G,
            effect.use.sourceID,
            targetID,
            1,
            "normal",
            effect.use.materialCardIDs,
            "slash",
            effect.use.color,
          ),
        );
      } else advanceSlashTarget(effect);
      return true;
    }
    if (answer.choice !== "activate") return false;
    if (prompt.reason === "gender-swords") {
      if (G.players[targetID].hand.length === 0) {
        drawCards(G, effect.use.sourceID, 1, shuffle);
        effect.stage = "dodge";
      } else {
        G.prompt = {
          id: resolutionID(G),
          effectID: effect.id,
          kind: "option",
          responderID: targetID,
          reason: "gender-swords-target",
          sourceID: effect.use.sourceID,
          targetID,
          choices: ["discard", "draw"],
        };
      }
      return true;
    }

    if (prompt.reason === "ice-sword") {
      const available =
        G.players[targetID].hand.length +
        Object.values(G.players[targetID].equipment).length;
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "select-cards",
        responderID: effect.use.sourceID,
        reason: "ice-sword",
        ownerID: targetID,
        zones: ["hand", "equipment"],
        minimum: Math.min(2, available),
        maximum: Math.min(2, available),
        allowPass: false,
      };
      return true;
    }
    if (prompt.reason === "rock-cleaving-axe") {
      const eligibleCount =
        G.players[effect.use.sourceID].hand.length +
        Object.values(G.players[effect.use.sourceID].equipment).length;
      if (eligibleCount < 2) {
        advanceSlashTarget(effect);
        return true;
      }
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "select-cards",
        responderID: effect.use.sourceID,
        reason: "rock-cleaving-axe",
        ownerID: effect.use.sourceID,
        zones: ["hand", "equipment"],
        minimum: 2,
        maximum: 2,
        allowPass: false,
      };
      return true;
    }
    if (prompt.reason === "qilin-bow") {
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "select-cards",
        responderID: effect.use.sourceID,
        reason: "qilin-bow",
        ownerID: targetID,
        zones: ["equipment"],
        minimum: 1,
        maximum: 1,
        allowPass: false,
      };
      return true;
    }
    if (prompt.reason === "green-dragon-blade") {
      G.prompt = responsePrompt(
        G,
        effect.id,
        effect.use.sourceID,
        "slash",
        "green-dragon-blade",
        effect.use.sourceID,
        targetID,
        { allowSerpentSpear: false },
      );
      return true;
    }
  }
  if (effect.kind === "fan-kui") {
    if (answer.choice === "activate") {
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "select-cards",
        responderID: effect.ownerID,
        reason: "fan-kui",
        ownerID: effect.sourceID,
        zones: ["hand", "equipment"],
        minimum: 1,
        maximum: 1,
        allowPass: false,
      };
      return true;
    }
    if (answer.choice === "decline") {
      G.effectStack.shift();
      return true;
    }
    return false;
  }
  if (effect.kind === "resolve-delayed" && prompt.reason === "gui-cai") {
    if (answer.choice === "decline") {
      G.effectStack.shift();
      applyJudgementResult(G, effect);
      return true;
    }
    if (answer.choice !== "activate") return false;
    G.prompt = {
      id: resolutionID(G),
      effectID: effect.id,
      kind: "select-cards",
      responderID: prompt.responderID,
      reason: "gui-cai",
      ownerID: prompt.responderID,
      zones: ["hand"],
      minimum: 1,
      maximum: 1,
      allowPass: false,
    };
    return true;
  }
  if (effect.kind === "yi-ji") {
    if (answer.choice === "decline") {
      G.effectStack.shift();
      return true;
    }
    if (answer.choice !== "activate" || effect.stage !== "offer") return false;
    effect.poolCardIDs = [];
    for (let index = 0; index < 2; index += 1) {
      const cardID = takeTopCard(G, shuffle);
      if (!cardID) break;
      G.players[effect.ownerID].hand.push(cardID);
      effect.poolCardIDs.push(cardID);
    }
    writeLog(
      G,
      `${playerName(G, effect.ownerID)} dùng 【Di Kế】 xem ${effect.poolCardIDs.length} lá đầu Chồng Bài Rút.`,
    );
    if (effect.poolCardIDs.length === 0) finishYiJiOpportunity(G, effect);
    else effect.stage = "card";
    return true;
  }
  if (effect.kind === "guan-xing") {
    if (answer.choice === "decline") {
      G.effectStack.shift();
      return true;
    }
    if (answer.choice !== "activate" || effect.stage !== "offer") return false;
    const count = Math.min(
      5,
      G.seatOrder.filter((playerID) => G.players[playerID].alive).length,
    );
    for (let index = 0; index < count; index += 1) {
      const cardID = takeTopCard(G, shuffle);
      if (!cardID) break;
      G.processing.push(cardID);
      effect.poolCardIDs.push(cardID);
    }
    writeLog(
      G,
      `${playerName(G, effect.ownerID)} dùng 【Quan Tinh】 xem ${effect.poolCardIDs.length} lá đầu Chồng Bài Rút.`,
    );
    if (effect.poolCardIDs.length === 0) G.effectStack.shift();
    else effect.stage = "top";
    return true;
  }
  if (effect.kind === "luo-shen") {
    if (answer.choice === "decline") {
      G.effectStack.shift();
      return true;
    }
    if (answer.choice !== "activate") return false;
    const cardID = takeTopCard(G, shuffle);
    if (!cardID) {
      G.effectStack.shift();
      return true;
    }
    if (cardColor(G.cards[cardID]) === "black") {
      G.players[effect.ownerID].hand.push(cardID);
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Lạc Thần】 nhận một lá đen.`,
      );
    } else {
      G.discard.push(cardID);
      G.effectStack.shift();
      writeLog(G, `【Lạc Thần】 phán xét lá đỏ, dừng lại.`);
    }
    return true;
  }
  if (effect.kind === "optional-skill") {
    if (answer.choice === "decline") {
      G.effectStack.shift();
      return true;
    }
    if (answer.choice !== "activate") return false;
    if (effect.skillID === "ke-ji") {
      G.turn.step = "end";
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Khắc Kỷ】 bỏ qua Giai Đoạn Bỏ Bài.`,
      );
    } else {
      drawCards(G, effect.ownerID, 1, shuffle);
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【${effect.skillID === "bi-yue" ? "Bế Nguyệt" : "Tập Trí"}】 rút 1 lá.`,
      );
    }
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "jian-xiong") {
    if (answer.choice === "activate") {
      const obtained = effect.cardIDs.filter((cardID) => {
        const index = G.processing.indexOf(cardID);
        if (index < 0) return false;
        G.processing.splice(index, 1);
        return true;
      });
      G.players[effect.ownerID].hand.push(...obtained);
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Gian Hùng】 nhận ${obtained.length} lá gây sát thương.`,
      );
    } else if (answer.choice !== "decline") return false;
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "yao-wu") {
    const source = G.players[effect.sourceID];
    if (answer.choice === "recover" && source.hp < source.maxHP) {
      source.hp += 1;
      writeLog(
        G,
        `【Diệu Võ】: ${playerName(G, effect.sourceID)} hồi phục 1 Thể Lực.`,
      );
    } else if (answer.choice === "draw") {
      drawCards(G, effect.sourceID, 1, shuffle);
      writeLog(G, `【Diệu Võ】: ${playerName(G, effect.sourceID)} rút 1 lá.`);
    } else return false;
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "wang-zun") {
    if (answer.choice === "activate") {
      drawCards(G, effect.ownerID, 1, shuffle);
      G.turn.wangZunHandLimitPenalty += 1;
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Vọng Tôn】 rút 1 lá; giới hạn tay của ${playerName(G, effect.lordID)} trong lượt này -1.`,
      );
    } else if (answer.choice !== "decline") return false;
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "slash" && prompt.reason === "tie-ji") {
    if (answer.choice === "activate") {
      const judgeCardID = takeTopCard(G, shuffle);
      if (judgeCardID) {
        const judgeCard = G.cards[judgeCardID];
        G.discard.push(judgeCardID);
        writeLog(
          G,
          `【Thiết Kỵ】 phán xét ${judgeCard.suit} ${judgeCard.rank}.`,
        );
        if (cardColor(judgeCard) === "red") {
          effect.ignoreDodge = true;
          writeLog(G, `【Thiết Kỵ】 khóa 【Thiểm】 của mục tiêu.`);
        }
      }
      return true;
    }
    if (answer.choice === "decline") return true;
    return false;
  }
  if (effect.kind === "slash" && prompt.reason === "liu-li") {
    if (answer.choice === "activate") {
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "select-cards",
        responderID: effect.use.targetIDs[effect.targetIndex],
        reason: "liu-li",
        ownerID: effect.use.targetIDs[effect.targetIndex],
        zones: ["hand", "equipment"],
        minimum: 1,
        maximum: 1,
        allowPass: false,
      };
      return true;
    }
    if (answer.choice === "decline") {
      effect.stage = "dodge";
      return true;
    }
    return false;
  }
  if (effect.kind === "tu-xi") {
    if (answer.choice === "activate") {
      const candidates = G.seatOrder.filter(
        (otherID) =>
          otherID !== effect.ownerID &&
          G.players[otherID].alive &&
          G.players[otherID].hand.length > 0,
      );
      if (candidates.length === 0) {
        G.effectStack.shift();
        performRegularDraw(G, effect.ownerID, shuffle);
        return true;
      }
      G.prompt = {
        id: resolutionID(G),
        effectID: effect.id,
        kind: "choose-players",
        responderID: effect.ownerID,
        reason: "tu-xi",
        candidates,
        minimum: 1,
        maximum: Math.min(2, candidates.length),
      };
      return true;
    }
    if (answer.choice === "decline") {
      G.effectStack.shift();
      performRegularDraw(G, effect.ownerID, shuffle);
      return true;
    }
    return false;
  }
  if (effect.kind === "lian-ying") {
    if (answer.choice === "activate") {
      drawCards(G, effect.ownerID, 1, shuffle);
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Liên Doanh】 rút 1 lá.`,
      );
    } else if (answer.choice !== "decline") return false;
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "xiao-ji") {
    if (answer.choice === "activate") {
      drawCards(G, effect.ownerID, 2, shuffle);
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Kiêu Cơ】 rút 2 lá.`,
      );
    } else if (answer.choice !== "decline") return false;
    G.effectStack.shift();
    return true;
  }
  if (effect.kind === "luo-yi") {
    if (answer.choice === "activate") {
      G.effectStack.shift();
      const amount = hasSkill(G, effect.ownerID, "ying-zi") ? 2 : 1;
      drawCards(G, effect.ownerID, amount, shuffle);
      G.turn.luoYiBuff = true;
      writeLog(
        G,
        `${playerName(G, effect.ownerID)} dùng 【Lõa Y】 rút ${amount} lá, tăng sát thương 【Sát】/【Quyết Đấu】 lượt này.`,
      );
      advanceAfterDraw(G, effect.ownerID);
      return true;
    }
    if (answer.choice === "decline") {
      G.effectStack.shift();
      performRegularDraw(G, effect.ownerID, shuffle);
      return true;
    }
    return false;
  }
  if (effect.kind === "fan-jian") {
    const suits = ["heart", "diamond", "club", "spade"] as const;
    if (!suits.includes(answer.choice as (typeof suits)[number])) return false;
    const owner = G.players[effect.ownerID];
    if (owner.hand.length === 0) {
      G.effectStack.shift();
      return true;
    }
    const cardID = shuffle(owner.hand)[0];
    removeHandCard(G, effect.ownerID, cardID);
    G.players[effect.targetID].hand.push(cardID);
    writeLog(
      G,
      `${playerName(G, effect.targetID)} nhận 【${CARD_DEFINITIONS[G.cards[cardID].definitionID].name}】 qua 【Phản Gián】.`,
    );
    G.effectStack.shift();
    if (G.cards[cardID].suit !== answer.choice)
      G.effectStack.unshift(damageEffect(G, effect.ownerID, effect.targetID));
    return true;
  }
  return false;
}

function answerAllySummon(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "ally-summon" }>,
  prompt: CardResponsePrompt,
  answer: PromptAnswer,
): boolean {
  if (answer.kind === "pass") {
    effect.passedIDs.push(prompt.responderID);
    return true;
  }
  if (
    answer.kind === "card" &&
    matchesResponse(G, prompt.responderID, answer.cardID, effect.response)
  ) {
    zoneToDiscard(G, prompt.responderID, answer.cardID);
    G.effectStack.shift();
    completeAllyResponse(G, effect);
    return true;
  }
  if (
    answer.kind === "serpent-spear" &&
    effect.response === "slash" &&
    canUseSerpentSpear(G, prompt.responderID, answer.cardIDs)
  ) {
    for (const cardID of answer.cardIDs)
      handToDiscard(G, prompt.responderID, cardID);
    G.effectStack.shift();
    completeAllyResponse(G, effect);
    return true;
  }
  return false;
}

function answerHarvest(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "harvest-pick" }>,
  answer: PromptAnswer,
): boolean {
  if (
    answer.kind !== "harvest" ||
    !effect.poolCardIDs.includes(answer.cardID) ||
    !G.processing.includes(answer.cardID)
  )
    return false;
  const index = G.processing.indexOf(answer.cardID);
  G.processing.splice(index, 1);
  G.players[effect.targetID].hand.push(answer.cardID);
  writeLog(
    G,
    `${playerName(G, effect.targetID)} nhận 【${CARD_DEFINITIONS[G.cards[answer.cardID].definitionID].name}】 từ 【Ngũ Cốc Phong Đăng】.`,
  );
  G.effectStack.shift();
  return true;
}

function answerChoosePlayers(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "tu-xi" }>,
  prompt: Extract<GamePrompt, { kind: "choose-players" }>,
  answer: PromptAnswer,
  shuffle: Shuffle,
): boolean {
  if (
    answer.kind !== "players" ||
    prompt.reason !== "tu-xi" ||
    effect.kind !== "tu-xi"
  )
    return false;
  const chosen = [...new Set(answer.playerIDs)];
  if (
    chosen.length < prompt.minimum ||
    chosen.length > prompt.maximum ||
    !chosen.every((playerID) => prompt.candidates.includes(playerID))
  )
    return false;
  for (const targetID of chosen) {
    const hand = G.players[targetID].hand;
    if (hand.length === 0) continue;
    const cardID = shuffle(hand)[0];
    hand.splice(hand.indexOf(cardID), 1);
    G.players[effect.ownerID].hand.push(cardID);
    writeLog(
      G,
      `${playerName(G, effect.ownerID)} dùng 【Đột Tập】 lấy một lá của ${playerName(G, targetID)}.`,
    );
  }
  G.effectStack.shift();
  advanceAfterDraw(G, effect.ownerID);
  return true;
}

function answerLiuLiPlayers(
  G: TqsGameState,
  effect: SlashEffect,
  prompt: Extract<GamePrompt, { kind: "choose-players" }>,
  answer: PromptAnswer,
): boolean {
  if (
    answer.kind !== "players" ||
    prompt.reason !== "liu-li" ||
    !effect.liuLiDiscardID
  )
    return false;
  const chosen = [...new Set(answer.playerIDs)];
  const holderID = effect.use.targetIDs[effect.targetIndex];
  if (
    chosen.length !== 1 ||
    !prompt.candidates.includes(chosen[0]) ||
    chosen[0] === effect.use.sourceID ||
    chosen[0] === holderID ||
    !hasCardInZone(G, holderID, effect.liuLiDiscardID)
  )
    return false;
  zoneToDiscard(G, holderID, effect.liuLiDiscardID);
  writeLog(
    G,
    `${playerName(G, holderID)} dùng 【Lưu Ly】 chuyển 【Sát】 sang ${playerName(G, chosen[0])}.`,
  );
  effect.use.targetIDs[effect.targetIndex] = chosen[0];
  effect.liuLiDiscardID = null;
  resetSlashTargetStage(effect);
  return true;
}

function answerYiJiPlayers(
  G: TqsGameState,
  effect: Extract<GameEffect, { kind: "yi-ji" }>,
  prompt: Extract<GamePrompt, { kind: "choose-players" }>,
  answer: PromptAnswer,
): boolean {
  if (
    answer.kind !== "players" ||
    prompt.reason !== "yi-ji" ||
    effect.stage !== "recipient" ||
    !effect.selectedCardID
  )
    return false;
  const chosen = [...new Set(answer.playerIDs)];
  if (
    chosen.length !== 1 ||
    !prompt.candidates.includes(chosen[0]) ||
    !effect.poolCardIDs.includes(effect.selectedCardID) ||
    !G.players[effect.ownerID].hand.includes(effect.selectedCardID)
  )
    return false;
  const cardID = effect.selectedCardID;
  const hand = G.players[effect.ownerID].hand;
  hand.splice(hand.indexOf(cardID), 1);
  G.players[chosen[0]].hand.push(cardID);
  writeLog(
    G,
    `${playerName(G, effect.ownerID)} dùng 【Di Kế】 đưa một lá cho ${playerName(G, chosen[0])}.`,
  );
  effect.poolCardIDs = effect.poolCardIDs.filter(
    (poolCardID) => poolCardID !== cardID,
  );
  effect.selectedCardID = null;
  if (effect.poolCardIDs.length === 0) finishYiJiOpportunity(G, effect);
  else effect.stage = "card";
  return true;
}

function markSkillUsed(
  G: TqsGameState,
  playerID: PlayerID,
  skillID: string,
): void {
  G.players[playerID].skillsUsedThisTurn.push(skillID);
}

export function useSkill(
  G: TqsGameState,
  playerID: PlayerID,
  skillID: string,
  payload: unknown,
  shuffle: Shuffle,
): boolean {
  if (!isIdleForPlay(G, playerID)) return false;
  if (!hasSkill(G, playerID, skillID)) return false;
  if (G.players[playerID].skillsUsedThisTurn.includes(skillID)) return false;

  if (skillID === "ku-rou") {
    if (payload !== undefined && payload !== null) return false;
    const player = G.players[playerID];
    player.hp -= 1;
    writeLog(G, `${playerName(G, playerID)} dùng 【Khổ Nhục】, mất 1 Thể Lực.`);
    markSkillUsed(G, playerID, skillID);
    drawCards(G, playerID, 2, shuffle);
    writeLog(G, `${playerName(G, playerID)} rút 2 lá.`);
    if (player.hp <= 0)
      G.effectStack.unshift({
        id: resolutionID(G),
        kind: "dying",
        dyingPlayerID: playerID,
        sourceID: null,
        responderID: nextLivingPlayer(G, playerID),
        passedPlayerIDs: [],
      });
    resolveCardGame(G, shuffle);
    return true;
  }

  if (skillID === "zhi-heng") {
    if (!isStringList(payload)) return false;
    const cardIDs = [...new Set(payload)];
    if (
      cardIDs.length === 0 ||
      !cardIDs.every((cardID) => hasCardInHand(G, playerID, cardID))
    )
      return false;
    for (const cardID of cardIDs) handToDiscard(G, playerID, cardID);
    markSkillUsed(G, playerID, skillID);
    drawCards(G, playerID, cardIDs.length, shuffle);
    writeLog(
      G,
      `${playerName(G, playerID)} dùng 【Chế Hành】 bỏ ${cardIDs.length} lá rồi rút ${cardIDs.length} lá.`,
    );
    return true;
  }

  if (skillID === "qing-nang") {
    if (!isRecord(payload)) return false;
    const { cardID, targetID } = payload as Record<string, unknown>;
    if (typeof cardID !== "string" || typeof targetID !== "string")
      return false;
    if (
      !hasCardInHand(G, playerID, cardID) ||
      !G.players[targetID]?.alive ||
      G.players[targetID].hp >= G.players[targetID].maxHP
    )
      return false;
    handToDiscard(G, playerID, cardID);
    const target = G.players[targetID];
    target.hp = Math.min(target.maxHP, target.hp + 1);
    writeLog(
      G,
      `${playerName(G, playerID)} dùng 【Thanh Nang】, ${playerName(G, targetID)} hồi phục 1 Thể Lực.`,
    );
    markSkillUsed(G, playerID, skillID);
    return true;
  }

  if (skillID === "ren-de") {
    if (!isRecord(payload)) return false;
    const { cardIDs, targetID } = payload as Record<string, unknown>;
    if (!isStringList(cardIDs) || typeof targetID !== "string") return false;
    if (targetID === playerID || !G.players[targetID]?.alive) return false;
    const distinct = [...new Set(cardIDs)];
    if (
      distinct.length === 0 ||
      !distinct.every((cardID) => hasCardInHand(G, playerID, cardID))
    )
      return false;
    for (const cardID of distinct) {
      removeHandCard(G, playerID, cardID);
      G.players[targetID].hand.push(cardID);
    }
    const previous = G.turn.rendeGiven;
    G.turn.rendeGiven += distinct.length;
    writeLog(
      G,
      `${playerName(G, playerID)} dùng 【Nhân Đức】 đưa ${distinct.length} lá cho ${playerName(G, targetID)}.`,
    );
    if (previous < 2 && G.turn.rendeGiven >= 2) {
      const owner = G.players[playerID];
      owner.hp = Math.min(owner.maxHP, owner.hp + 1);
      writeLog(
        G,
        `${playerName(G, playerID)} hồi phục 1 Thể Lực nhờ 【Nhân Đức】.`,
      );
    }
    markSkillUsed(G, playerID, skillID);
    return true;
  }

  if (skillID === "jie-yin") {
    if (!isRecord(payload)) return false;
    const { cardIDs, targetID } = payload as Record<string, unknown>;
    if (!isStringList(cardIDs) || typeof targetID !== "string") return false;
    const distinct = [...new Set(cardIDs)];
    const target = G.players[targetID];
    if (
      distinct.length !== 2 ||
      !distinct.every((cardID) => hasCardInHand(G, playerID, cardID)) ||
      !target?.alive ||
      target.id === playerID ||
      target.hp >= target.maxHP ||
      GENERALS_BY_ID[target.generalID!]?.gender !== "male"
    )
      return false;
    for (const cardID of distinct) handToDiscard(G, playerID, cardID);
    target.hp = Math.min(target.maxHP, target.hp + 1);
    const owner = G.players[playerID];
    owner.hp = Math.min(owner.maxHP, owner.hp + 1);
    writeLog(
      G,
      `${playerName(G, playerID)} dùng 【Kết Nhân】, ${playerName(G, targetID)} và ${playerName(G, playerID)} mỗi người hồi phục 1 Thể Lực.`,
    );
    markSkillUsed(G, playerID, skillID);
    return true;
  }

  if (skillID === "li-jian") {
    if (!isRecord(payload)) return false;
    const { cardID, firstID, secondID } = payload as Record<string, unknown>;
    if (
      typeof cardID !== "string" ||
      typeof firstID !== "string" ||
      typeof secondID !== "string"
    )
      return false;
    const first = G.players[firstID];
    const second = G.players[secondID];
    if (
      !hasCardInHand(G, playerID, cardID) ||
      !first?.alive ||
      !second?.alive ||
      firstID === secondID ||
      [firstID, secondID].includes(playerID) ||
      GENERALS_BY_ID[first.generalID!]?.gender !== "male" ||
      GENERALS_BY_ID[second.generalID!]?.gender !== "male"
    )
      return false;
    handToDiscard(G, playerID, cardID);
    writeLog(
      G,
      `${playerName(G, playerID)} dùng 【Ly Gián】, ${playerName(G, firstID)} và ${playerName(G, secondID)} tiến hành 【Quyết Đấu】.`,
    );
    markSkillUsed(G, playerID, skillID);
    G.effectStack.push({
      id: resolutionID(G),
      kind: "duel",
      sourceID: playerID,
      targetID: firstID,
      responderID: firstID,
      opponentID: secondID,
      slashesRequired: hasSkill(G, secondID, "wu-shuang") ? 2 : 1,
      slashesPlayed: 0,
      sourceCardID: null,
    });
    resolveCardGame(G, shuffle);
    return true;
  }

  if (skillID === "fan-jian") {
    if (!isRecord(payload)) return false;
    const { targetID } = payload as Record<string, unknown>;
    if (typeof targetID !== "string") return false;
    const target = G.players[targetID];
    if (
      !target?.alive ||
      targetID === playerID ||
      G.players[playerID].hand.length === 0
    )
      return false;
    markSkillUsed(G, playerID, skillID);
    writeLog(
      G,
      `${playerName(G, playerID)} dùng 【Phản Gián】 với ${playerName(G, targetID)}.`,
    );
    G.effectStack.push({
      id: resolutionID(G),
      kind: "fan-jian",
      ownerID: playerID,
      targetID,
    });
    resolveCardGame(G, shuffle);
    return true;
  }

  return false;
}

export function answerCardPrompt(
  G: TqsGameState,
  playerID: PlayerID,
  promptID: number,
  answer: unknown,
  shuffle: Shuffle,
): boolean {
  if (!isPromptAnswer(answer)) return false;
  const prompt = G.prompt;
  const effect = G.effectStack[0];
  if (
    !prompt ||
    !effect ||
    prompt.id !== promptID ||
    prompt.responderID !== playerID ||
    !("effectID" in prompt) ||
    prompt.effectID !== effect.id
  )
    return false;

  let accepted = false;
  if (prompt.kind === "card-response") {
    if (
      answer.kind === "summon" &&
      prompt.summonFaction &&
      (effect.kind === "slash" ||
        effect.kind === "duel" ||
        effect.kind === "required-response")
    ) {
      const skillID = prompt.summonFaction === "wei" ? "hu-jia" : "ji-jiang";
      const queueIDs = G.seatOrder.filter(
        (id) =>
          id !== prompt.responderID &&
          G.players[id].alive &&
          GENERALS_BY_ID[G.players[id].generalID!]?.faction ===
            prompt.summonFaction,
      );
      G.effectStack.unshift({
        id: resolutionID(G),
        kind: "ally-summon",
        skillID,
        lordID: prompt.responderID,
        faction: prompt.summonFaction,
        response: prompt.response === "slash" ? "slash" : "dodge",
        requesterEffectID: effect.id,
        queueIDs,
        passedIDs: [],
      });
      writeLog(
        G,
        `${playerName(G, prompt.responderID)} phát động 【${skillID === "hu-jia" ? "Hộ Giá" : "Kích Tướng"}】.`,
      );
      accepted = true;
    } else if (
      effect.kind === "ally-summon" &&
      prompt.reason === "ally-summon"
    ) {
      accepted = answerAllySummon(G, effect, prompt, answer);
    } else if (effect.kind === "nullification")
      accepted = answerNullification(G, effect, prompt, answer);
    else if (effect.kind === "slash")
      accepted =
        prompt.reason === "green-dragon-blade"
          ? answerGreenDragonPrompt(G, effect, prompt, answer)
          : answerSlashPrompt(G, effect, prompt, answer, shuffle);
    else if (effect.kind === "duel")
      accepted = answerDuelPrompt(G, effect, prompt, answer);
    else if (effect.kind === "required-response")
      accepted = answerRequiredResponse(G, effect, prompt, answer, shuffle);
    else if (effect.kind === "borrowed-sword")
      accepted = answerBorrowedSword(G, effect, prompt, answer);
    else if (effect.kind === "dying")
      accepted = answerRescue(G, effect, prompt, answer, shuffle);
  } else if (prompt.kind === "select-cards") {
    accepted = answerSelectCards(G, effect, prompt, answer, shuffle);
  } else if (prompt.kind === "option") {
    accepted = answerOption(G, effect, answer, shuffle);
  } else if (prompt.kind === "choose-players") {
    accepted =
      prompt.reason === "tu-xi" && effect.kind === "tu-xi"
        ? answerChoosePlayers(G, effect, prompt, answer, shuffle)
        : prompt.reason === "yi-ji" && effect.kind === "yi-ji"
          ? answerYiJiPlayers(G, effect, prompt, answer)
          : prompt.reason === "liu-li" && effect.kind === "slash"
            ? answerLiuLiPlayers(G, effect, prompt, answer)
            : false;
  } else if (
    prompt.kind === "harvest-choice" &&
    effect.kind === "harvest-pick"
  ) {
    accepted = answerHarvest(G, effect, answer);
  }

  if (!accepted) return false;
  if (G.prompt?.id === promptID) G.prompt = null;
  resolveCardGame(G, shuffle);
  return true;
}

export function endCardPlayPhase(
  G: TqsGameState,
  playerID: PlayerID,
  shuffle: Shuffle,
): boolean {
  if (!isIdleForPlay(G, playerID)) return false;
  enterDiscardPhase(G, playerID);
  resolveCardGame(G, shuffle);
  return true;
}

export function resumeCardPlayPhase(
  G: TqsGameState,
  playerID: PlayerID,
): boolean {
  if (
    G.status !== "playing" ||
    G.turn.activePlayerID !== playerID ||
    G.turn.step !== "discard" ||
    G.turn.skippedSteps.includes("play") ||
    G.effectStack.length > 0 ||
    G.prompt
  )
    return false;
  G.turn.step = "play";
  return true;
}

export function discardCardHand(
  G: TqsGameState,
  playerID: PlayerID,
  cardIDs: unknown,
  shuffle: Shuffle,
): boolean {
  if (!isStringList(cardIDs)) return false;
  if (
    G.status !== "playing" ||
    G.turn.activePlayerID !== playerID ||
    G.turn.step !== "discard" ||
    G.effectStack.length > 0 ||
    G.prompt
  )
    return false;
  const required = G.players[playerID].hand.length - handLimit(G, playerID);
  if (
    required <= 0 ||
    cardIDs.length !== required ||
    new Set(cardIDs).size !== cardIDs.length ||
    !cardIDs.every((cardID) => hasCardInHand(G, playerID, cardID))
  )
    return false;
  for (const cardID of cardIDs) handToDiscard(G, playerID, cardID);
  G.turn.step = "end";
  resolveCardGame(G, shuffle);
  return true;
}
