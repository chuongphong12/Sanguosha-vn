import { STANDARD_2013_DECK } from "./catalog/cards";
import {
  GENERALS,
  GENERALS_BY_ID,
  LORD_GENERAL_IDS,
  getActiveSkillIDs,
} from "./catalog/generals";
import { getRoleDeck } from "./catalog/roles";
import type {
  PlayerID,
  PlayerState,
  Shuffle,
  TqsGameState,
  TqsSetupOptions,
} from "./model";
import { startCardTurn } from "./cardEngine";
import { drawCards, writeLog } from "./rules";

export function validateSetupOptions(
  options: TqsSetupOptions,
): string | undefined {
  if (
    !Number.isInteger(options.numPlayers) ||
    options.numPlayers < 4 ||
    options.numPlayers > 10
  ) {
    return "Số người chơi phải nằm trong khoảng từ 4 đến 10.";
  }
  if (
    options.roleVariant === "double-renegade" &&
    ![6, 8, 10].includes(options.numPlayers)
  ) {
    return "Biến thể hai Nội Gian chỉ áp dụng cho 6, 8 hoặc 10 người.";
  }
  return undefined;
}

export function createInitialState(
  options: TqsSetupOptions,
  shuffle: Shuffle,
): TqsGameState {
  const validationError = validateSetupOptions(options);
  if (validationError) throw new Error(validationError);

  const playerIDs = Array.from({ length: options.numPlayers }, (_, index) =>
    String(index),
  );
  const roles = shuffle(getRoleDeck(options.numPlayers, options.roleVariant));
  const lordIndex = roles.indexOf("lord");
  const seatOrder = [
    ...playerIDs.slice(lordIndex),
    ...playerIDs.slice(0, lordIndex),
  ];
  const lordID = seatOrder[0];

  const randomCandidates = shuffle(
    GENERALS.filter(
      (general) =>
        !LORD_GENERAL_IDS.includes(
          general.id as (typeof LORD_GENERAL_IDS)[number],
        ),
    ),
  ).slice(0, 2);
  const lordCandidates = [
    ...LORD_GENERAL_IDS,
    ...randomCandidates.map((general) => general.id),
  ];
  const candidateCount = options.numPlayers >= 9 ? 2 : 3;
  const availableGenerals = shuffle(
    GENERALS.filter((general) => !lordCandidates.includes(general.id)),
  );
  const generalCandidates = new Map<PlayerID, string[]>();
  let candidateCursor = 0;
  for (const playerID of seatOrder.slice(1)) {
    generalCandidates.set(
      playerID,
      availableGenerals
        .slice(candidateCursor, candidateCursor + candidateCount)
        .map((general) => general.id),
    );
    candidateCursor += candidateCount;
  }

  const players = Object.fromEntries(
    playerIDs.map((id, index): [string, PlayerState] => [
      id,
      {
        id,
        seat: seatOrder.indexOf(id),
        role: roles[index],
        roleRevealed: id === lordID,
        generalID: null,
        generalCandidates:
          id === lordID ? lordCandidates : (generalCandidates.get(id) ?? []),
        activeSkillIDs: [],
        maxHP: 0,
        hp: 0,
        alive: true,
        hand: [],
        equipment: {},
        judgement: [],
        slashUses: 0,
        skillsUsedThisTurn: [],
      },
    ]),
  );

  const cards = Object.fromEntries(
    STANDARD_2013_DECK.map((card) => [card.id, { ...card }]),
  );

  return {
    rulesVersion: "standard-2013-v2",
    status: "lord-selection",
    seatOrder,
    lordID,
    players,
    deck: [],
    discard: [],
    processing: [],
    cards,
    turn: {
      activePlayerID: lordID,
      step: "prepare",
      number: 0,
      skippedSteps: [],
      resolvedJudgementCardIDs: [],
      drewCards: false,
      luoYiBuff: false,
      rendeGiven: 0,
      wangZunResolved: false,
      wangZunHandLimitPenalty: 0,
      biYueResolved: false,
    },
    effectStack: [],
    prompt: null,
    nextResolutionID: 1,
    winner: null,
    log: [],
    nextLogID: 1,
  };
}

export function selectGeneral(
  G: TqsGameState,
  playerID: PlayerID,
  generalID: string,
  shuffle: Shuffle,
): boolean {
  const player = G.players[playerID];
  if (
    !player ||
    player.generalID ||
    !player.generalCandidates.includes(generalID)
  )
    return false;

  if (G.status === "lord-selection") {
    if (playerID !== G.lordID) return false;
    player.generalID = generalID;
    G.status = "general-selection";
    writeLog(G, `Chủ Công đã chọn ${GENERALS_BY_ID[generalID].name}.`);
    return true;
  }

  if (G.status !== "general-selection" || playerID === G.lordID) return false;
  player.generalID = generalID;

  if (G.seatOrder.every((id) => G.players[id].generalID !== null)) {
    startMatch(G, shuffle);
  }
  return true;
}

function startMatch(G: TqsGameState, shuffle: Shuffle): void {
  for (const playerID of G.seatOrder) {
    const player = G.players[playerID];
    const general = GENERALS_BY_ID[player.generalID!];
    const lordBonus = playerID === G.lordID && G.seatOrder.length >= 5 ? 1 : 0;
    player.maxHP = general.maxHP + lordBonus;
    player.hp = player.maxHP;
    player.generalCandidates = [];
    player.activeSkillIDs = getActiveSkillIDs(general.id, player.role);
  }

  G.deck = shuffle(STANDARD_2013_DECK.map((card) => card.id));
  for (const playerID of G.seatOrder) drawCards(G, playerID, 4, shuffle);
  G.status = "playing";
  writeLog(G, "Ván đấu bắt đầu. Chủ Công hành động trước.");
  startCardTurn(G, G.lordID, shuffle);
}
