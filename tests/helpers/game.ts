import { GENERALS_BY_ID } from "../../src/game/catalog/generals";
import { answerCardPrompt } from "../../src/game/cardEngine";
import type {
  CardName,
  PlayerID,
  Shuffle,
  TqsGameState,
} from "../../src/game/model";
import { createInitialState, selectGeneral } from "../../src/game/setup";

export const identityShuffle: Shuffle = <T>(items: T[]) => [...items];

export function createStartedGame(numPlayers = 4): TqsGameState {
  const G = createInitialState({ numPlayers }, identityShuffle);
  selectGeneral(G, G.lordID, "cao-cao", identityShuffle);
  for (const playerID of G.seatOrder.slice(1)) {
    selectGeneral(
      G,
      playerID,
      G.players[playerID].generalCandidates[0],
      identityShuffle,
    );
  }
  return G;
}

export function giveCard(
  G: TqsGameState,
  playerID: PlayerID,
  cardName: CardName,
): string {
  const cardID = G.deck.find(
    (candidateID) => G.cards[candidateID].definitionID === cardName,
  );
  if (!cardID) throw new Error(`Không còn lá ${cardName} để cấp.`);
  G.deck.splice(G.deck.indexOf(cardID), 1);
  G.players[playerID].hand.push(cardID);
  return cardID;
}

export function givePhysicalCard(
  G: TqsGameState,
  playerID: PlayerID,
  predicate: (card: TqsGameState["cards"][string]) => boolean,
): string {
  const card = G.deck
    .map((cardID) => G.cards[cardID])
    .find((candidate) => predicate(candidate));
  if (!card) throw new Error("Không tìm thấy lá vật lý phù hợp.");
  G.deck.splice(G.deck.indexOf(card.id), 1);
  G.players[playerID].hand.push(card.id);
  return card.id;
}

export function resetHands(G: TqsGameState): void {
  for (const player of Object.values(G.players)) {
    player.hand = [];
    player.equipment = {};
    player.judgement = [];
  }
  G.deck = Object.keys(G.cards);
  G.discard = [];
  G.processing = [];
  G.effectStack = [];
  G.prompt = null;
}

export function stackDeck(G: TqsGameState, cardIDs: string[]): void {
  if (
    new Set(cardIDs).size !== cardIDs.length ||
    cardIDs.some((cardID) => !G.cards[cardID])
  )
    throw new Error("Chồng bài thử nghiệm chứa lá trùng hoặc không tồn tại.");
  const stacked = new Set(cardIDs);
  for (const player of Object.values(G.players)) {
    player.hand = player.hand.filter((cardID) => !stacked.has(cardID));
    player.judgement = player.judgement.filter(
      (cardID) => !stacked.has(cardID),
    );
    for (const slot of Object.keys(player.equipment) as Array<
      keyof typeof player.equipment
    >) {
      if (stacked.has(player.equipment[slot]!)) delete player.equipment[slot];
    }
  }
  G.discard = G.discard.filter((cardID) => !stacked.has(cardID));
  G.processing = G.processing.filter((cardID) => !stacked.has(cardID));
  G.deck = [...cardIDs, ...G.deck.filter((cardID) => !stacked.has(cardID))];
}

export function generalName(G: TqsGameState, playerID: PlayerID): string {
  return GENERALS_BY_ID[G.players[playerID].generalID!].name;
}

export function answerNullificationChain(
  G: TqsGameState,
  playsByPlayer: Record<string, string>,
): void {
  const pending = new Map(Object.entries(playsByPlayer));
  for (let guard = 0; guard < 64; guard += 1) {
    const prompt = G.prompt;
    if (
      !prompt ||
      prompt.kind !== "card-response" ||
      prompt.reason !== "nullification"
    )
      return;
    const cardID = pending.get(prompt.responderID);
    pending.delete(prompt.responderID);
    answerCardPrompt(
      G,
      prompt.responderID,
      prompt.id,
      cardID ? { kind: "card", cardID } : { kind: "pass" },
      identityShuffle,
    );
  }
}
