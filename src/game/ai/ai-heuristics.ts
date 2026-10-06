import type { Ctx } from "boardgame.io";
import type {
  CardName,
  GamePrompt,
  PlayCardInput,
  PlayerID,
  PromptAnswer,
  Role,
  Shuffle,
  TqsGameState,
  ZoneCardChoice,
} from "../model";
import { CARD_DEFINITIONS } from "../catalog/cards";
import {
  answerCardPrompt,
  declareCardUse,
  discardCardHand,
  endCardPlayPhase,
} from "../cardEngine";
import { attackRange, distanceBetween, handLimit } from "../rules";
import { selectGeneral } from "../setup";

export type BotMoveName =
  | "selectGeneral"
  | "playCard"
  | "endPlayPhase"
  | "answerPrompt"
  | "discardCards";

export interface HeuristicMove {
  move: BotMoveName;
  args: unknown[];
}

type Side = "lord" | "rebel" | "renegade";

type MoveSimulator = (
  G: TqsGameState,
  playerID: PlayerID,
  args: unknown[],
) => boolean;

const keepOrder: Shuffle = <T>(items: T[]) => [...items];

// Every candidate is dry-run against a copy of the state with the real rule
// engine, so the bot never sends a move the server would reject (a rejected
// move leaves the state unchanged and the bot would never be asked again).
const MOVE_SIMULATORS: Record<BotMoveName, MoveSimulator> = {
  selectGeneral: (G, playerID, [generalID]) =>
    selectGeneral(G, playerID, generalID as string, keepOrder),
  playCard: (G, playerID, [input]) =>
    declareCardUse(G, playerID, input as PlayCardInput, keepOrder),
  endPlayPhase: (G, playerID) => endCardPlayPhase(G, playerID, keepOrder),
  answerPrompt: (G, playerID, [promptID, answer]) =>
    answerCardPrompt(G, playerID, promptID as number, answer, keepOrder),
  discardCards: (G, playerID, [cardIDs]) =>
    discardCardHand(G, playerID, cardIDs, keepOrder),
};

// Cards the bot would rather keep, most valuable last. Unlisted cards rank
// below every listed one and are thrown away first.
const KEEP_PRIORITY: CardName[] = ["slash", "nullification", "dodge", "peach"];

const SIDE_BY_ROLE: Record<Role, Side> = {
  lord: "lord",
  loyalist: "lord",
  rebel: "rebel",
  renegade: "renegade",
};

const AOE_RESPONSE: Partial<Record<string, CardName>> = {
  "arrow-barrage": "dodge",
  "barbarian-invasion": "slash",
};

const isRoleKnown = (G: TqsGameState, targetID: PlayerID): boolean =>
  targetID === G.lordID || G.players[targetID].roleRevealed;

// The bot only reasons about roles it could see at the table: its own and
// the revealed ones. Unknown players are neither attacked nor rescued.
const isEnemy = (
  G: TqsGameState,
  selfID: PlayerID,
  targetID: PlayerID,
): boolean => {
  if (selfID === targetID || !isRoleKnown(G, targetID)) return false;
  const selfSide = SIDE_BY_ROLE[G.players[selfID].role];
  if (selfSide === "renegade") return true;
  return selfSide !== SIDE_BY_ROLE[G.players[targetID].role];
};

const isAlly = (
  G: TqsGameState,
  selfID: PlayerID,
  targetID: PlayerID,
): boolean => {
  if (selfID === targetID) return true;
  if (!isRoleKnown(G, targetID)) return false;
  const selfSide = SIDE_BY_ROLE[G.players[selfID].role];
  if (selfSide === "renegade") return false;
  return selfSide === SIDE_BY_ROLE[G.players[targetID].role];
};

const cardName = (G: TqsGameState, cardID: string): CardName =>
  G.cards[cardID].definitionID;

const handCardsNamed = (
  G: TqsGameState,
  playerID: PlayerID,
  name: CardName,
): string[] =>
  G.players[playerID].hand.filter((cardID) => cardName(G, cardID) === name);

const livingEnemiesByHp = (G: TqsGameState, playerID: PlayerID): PlayerID[] =>
  G.seatOrder
    .filter((id) => G.players[id].alive && isEnemy(G, playerID, id))
    .sort((a, b) => G.players[a].hp - G.players[b].hp);

const answer = (prompt: GamePrompt, reply: PromptAnswer): HeuristicMove => ({
  move: "answerPrompt",
  args: [prompt.id, reply],
});

const playCard = (cardID: string, targetIDs: PlayerID[]): HeuristicMove => ({
  move: "playCard",
  args: [{ cardID, targetIDs }],
});

const keepValue = (G: TqsGameState, cardID: string): number =>
  KEEP_PRIORITY.indexOf(cardName(G, cardID));

const zoneChoicesFor = (
  G: TqsGameState,
  prompt: Extract<GamePrompt, { kind: "select-cards" }>,
): ZoneCardChoice[] => {
  const owner = G.players[prompt.ownerID];
  const choices: ZoneCardChoice[] = [];
  for (const zone of prompt.zones) {
    if (zone === "hand")
      owner.hand.forEach((_, handIndex) =>
        choices.push({ zone, ownerID: prompt.ownerID, handIndex }),
      );
    if (zone === "equipment")
      for (const slot of Object.keys(owner.equipment) as Array<
        keyof typeof owner.equipment
      >)
        if (!prompt.excludedEquipmentSlots?.includes(slot))
          choices.push({ zone, ownerID: prompt.ownerID, slot });
    if (zone === "judgement")
      owner.judgement.forEach((cardID) =>
        choices.push({ zone, ownerID: prompt.ownerID, cardID }),
      );
    if (zone === "processing")
      G.processing.forEach((cardID) => choices.push({ zone, cardID }));
  }
  return choices;
};

const cardResponseCandidates = (
  G: TqsGameState,
  playerID: PlayerID,
  prompt: Extract<GamePrompt, { kind: "card-response" }>,
): HeuristicMove[] => {
  if (prompt.reason === "rescue" && !isAlly(G, playerID, prompt.targetID))
    return [];
  if (prompt.response === "nullification") return [];

  const candidates: HeuristicMove[] = [];
  if (prompt.allowBagua) candidates.push(answer(prompt, { kind: "bagua" }));

  const needed =
    prompt.response === "aoe-response"
      ? AOE_RESPONSE[prompt.reason]
      : prompt.response;
  if (!needed) return candidates;
  for (const cardID of handCardsNamed(G, playerID, needed))
    candidates.push(answer(prompt, { kind: "card", cardID }));
  return candidates;
};

const promptCandidates = (
  G: TqsGameState,
  playerID: PlayerID,
  prompt: GamePrompt,
): HeuristicMove[] => {
  const pass = answer(prompt, { kind: "pass" });

  switch (prompt.kind) {
    case "card-response":
      return [...cardResponseCandidates(G, playerID, prompt), pass];
    case "option":
      return prompt.choices.map((choice) =>
        answer(prompt, { kind: "option", choice }),
      );
    case "select-cards": {
      // Some prompts only accept part of a zone (Guan Xing's second pick
      // excludes the cards already placed on top), so offer every run of
      // consecutive cards and let the rule engine pick out the legal one.
      const count = Math.min(Math.max(prompt.minimum, 1), prompt.maximum);
      const zoneChoices = zoneChoicesFor(G, prompt);
      const windows = Array.from(
        { length: Math.max(0, zoneChoices.length - count + 1) },
        (_, start) => zoneChoices.slice(start, start + count),
      );
      return [
        ...windows.map((choices) =>
          answer(prompt, { kind: "zone-cards", choices }),
        ),
        pass,
      ];
    }
    case "harvest-choice": {
      const byValue = [...prompt.availableCardIDs].sort(
        (a, b) => keepValue(G, b) - keepValue(G, a),
      );
      return byValue.map((cardID) =>
        answer(prompt, { kind: "harvest", cardID }),
      );
    }
    case "choose-players": {
      const count = Math.min(Math.max(prompt.minimum, 1), prompt.maximum);
      const enemiesFirst = [...prompt.candidates].sort(
        (a, b) =>
          Number(isEnemy(G, playerID, b)) - Number(isEnemy(G, playerID, a)),
      );
      return [
        answer(prompt, {
          kind: "players",
          playerIDs: enemiesFirst.slice(0, count),
        }),
        pass,
      ];
    }
    case "play-card":
      return [pass];
  }
};

// Fallbacks for prompts whose specific heuristic produced nothing legal, so a
// bot answers something rather than leaving the table waiting on it.
const genericPromptCandidates = (
  G: TqsGameState,
  playerID: PlayerID,
  prompt: GamePrompt,
): HeuristicMove[] => [
  answer(prompt, { kind: "pass" }),
  ...G.players[playerID].hand.map((cardID) =>
    answer(prompt, { kind: "card", cardID }),
  ),
];

const playStepCandidates = (
  G: TqsGameState,
  playerID: PlayerID,
): HeuristicMove[] => {
  const player = G.players[playerID];
  const enemies = livingEnemiesByHp(G, playerID);
  const candidates: HeuristicMove[] = [];

  // 1. Heal when injured.
  if (player.hp < player.maxHP)
    for (const cardID of handCardsNamed(G, playerID, "peach"))
      candidates.push(playCard(cardID, []));

  // 2. Draw cards.
  for (const cardID of handCardsNamed(G, playerID, "ex-nihilo"))
    candidates.push(playCard(cardID, []));

  // 3. Fill empty equipment slots.
  for (const cardID of player.hand) {
    const slot = CARD_DEFINITIONS[cardName(G, cardID)].equipmentSlot;
    if (slot && !player.equipment[slot]) candidates.push(playCard(cardID, []));
  }

  // 4. Strip, steal from and duel the weakest known enemy.
  for (const name of ["snatch", "dismantle", "duel"] as const)
    for (const cardID of handCardsNamed(G, playerID, name))
      for (const targetID of enemies)
        candidates.push(playCard(cardID, [targetID]));

  // 5. Slash the weakest known enemy in range.
  const range = attackRange(G, playerID);
  const slashTargets = enemies.filter(
    (targetID) => distanceBetween(G, playerID, targetID) <= range,
  );
  for (const cardID of handCardsNamed(G, playerID, "slash"))
    for (const targetID of slashTargets)
      candidates.push(playCard(cardID, [targetID]));

  // 6. Nothing useful left to do.
  candidates.push({ move: "endPlayPhase", args: [] });
  return candidates;
};

const discardStepCandidates = (
  G: TqsGameState,
  playerID: PlayerID,
): HeuristicMove[] => {
  const hand = G.players[playerID].hand;
  const excess = hand.length - handLimit(G, playerID);
  if (excess <= 0) return [];
  const leastValuableFirst = [...hand].sort(
    (a, b) => keepValue(G, a) - keepValue(G, b),
  );
  return [
    { move: "discardCards", args: [leastValuableFirst.slice(0, excess)] },
  ];
};

const selectionCandidates = (
  G: TqsGameState,
  playerID: PlayerID,
): HeuristicMove[] =>
  G.players[playerID].generalCandidates.map((generalID) => ({
    move: "selectGeneral",
    args: [generalID],
  }));

// Nullification is an open response window; rescue and AOE follow seat order.
const OPEN_PROMPT_REASONS = new Set(["nullification"]);

const mayAnswerPrompt = (prompt: GamePrompt, playerID: PlayerID): boolean => {
  if (prompt.responderID === playerID) return true;
  return (
    prompt.kind === "card-response" &&
    OPEN_PROMPT_REASONS.has(prompt.reason) &&
    !prompt.passedPlayerIDs?.includes(playerID)
  );
};

/** Every move the bot would consider right now, best first. */
export const listHeuristicCandidates = (
  G: TqsGameState,
  playerID: PlayerID,
): HeuristicMove[] => {
  const player = G.players[playerID];
  if (!player) return [];

  if (G.status === "lord-selection" || G.status === "general-selection")
    return player.generalID ? [] : selectionCandidates(G, playerID);
  if (G.status !== "playing" || !player.alive) return [];

  if (G.prompt)
    return mayAnswerPrompt(G.prompt, playerID)
      ? [
          ...promptCandidates(G, playerID, G.prompt),
          ...genericPromptCandidates(G, playerID, G.prompt),
        ]
      : [];

  if (G.turn.activePlayerID !== playerID || G.effectStack.length > 0) return [];
  if (G.turn.step === "play") return playStepCandidates(G, playerID);
  if (G.turn.step === "discard") return discardStepCandidates(G, playerID);
  return [];
};

export const isMoveAccepted = (
  G: TqsGameState,
  playerID: PlayerID,
  candidate: HeuristicMove,
): boolean => {
  try {
    return MOVE_SIMULATORS[candidate.move](
      structuredClone(G),
      playerID,
      candidate.args,
    );
  } catch {
    return false;
  }
};

/** The best move the rule engine accepts for this player, or null if none. */
export const chooseHeuristicMove = (
  G: TqsGameState,
  playerID: PlayerID,
): HeuristicMove | null =>
  listHeuristicCandidates(G, playerID).find((candidate) =>
    isMoveAccepted(G, playerID, candidate),
  ) ?? null;

/**
 * `game.ai.enumerate` hook. Returns at most one move (the heuristic choice),
 * so any boardgame.io bot built on it plays the heuristic deterministically.
 */
export const getHeuristicMoves = (
  G: TqsGameState,
  _ctx: Ctx,
  playerID: PlayerID,
): HeuristicMove[] => {
  const move = chooseHeuristicMove(G, playerID);
  return move ? [move] : [];
};
