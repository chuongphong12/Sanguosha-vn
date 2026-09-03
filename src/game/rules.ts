import { CARD_DEFINITIONS } from "./catalog/cards";
import type {
  GameWinner,
  PlayerID,
  Role,
  Shuffle,
  TqsGameState,
} from "./model";

export function writeLog(G: TqsGameState, message: string): void {
  G.log.push({ id: G.nextLogID++, message });
  if (G.log.length > 80) G.log.shift();
}

export function drawCards(
  G: TqsGameState,
  playerID: PlayerID,
  amount: number,
  shuffle: Shuffle,
): void {
  const player = G.players[playerID];
  for (let index = 0; index < amount; index += 1) {
    if (G.deck.length === 0 && G.discard.length > 0) {
      G.deck = shuffle([...G.discard]);
      G.discard = [];
      writeLog(G, "Chồng Bài Bỏ được xáo lại để tạo thành Chồng Bài Rút mới.");
    }
    const cardID = G.deck.shift();
    if (!cardID) return;
    player.hand.push(cardID);
  }
}

export function determineWinner(G: TqsGameState): GameWinner | null {
  const lord = G.players[G.lordID];
  const living = G.seatOrder.filter((id) => G.players[id].alive);

  if (!lord.alive) {
    if (living.length === 1 && G.players[living[0]].role === "renegade") {
      return {
        side: "renegade",
        playerIDs: living,
        reason: "Nội Gian độc tồn và giành chiến thắng.",
      };
    }
    return {
      side: "rebel",
      playerIDs: G.seatOrder.filter((id) => G.players[id].role === "rebel"),
      reason: "Chủ Công tử trận. Phản Tặc chiến thắng.",
    };
  }

  const enemiesRemain = living.some((id) =>
    ["rebel", "renegade"].includes(G.players[id].role),
  );
  if (!enemiesRemain) {
    return {
      side: "lord",
      playerIDs: G.seatOrder.filter((id) =>
        ["lord", "loyalist"].includes(G.players[id].role),
      ),
      reason:
        "Toàn bộ Phản Tặc và Nội Gian đã bị tiêu diệt. Chủ Công và Trung Thần chiến thắng.",
    };
  }
  return null;
}

export function distanceBetween(
  G: TqsGameState,
  sourceID: PlayerID,
  targetID: PlayerID,
): number {
  const living = G.seatOrder.filter((id) => G.players[id].alive);
  const sourceIndex = living.indexOf(sourceID);
  const targetIndex = living.indexOf(targetID);
  if (sourceIndex < 0 || targetIndex < 0 || sourceID === targetID) return 0;

  const clockwise = (targetIndex - sourceIndex + living.length) % living.length;
  const base = Math.min(clockwise, living.length - clockwise);
  const offensiveModifier =
    (G.players[sourceID].equipment["offensive-mount"] ? 1 : 0) +
    (G.players[sourceID].activeSkillIDs.includes("ma-shu") &&
    G.players[sourceID].generalID
      ? 1
      : 0);
  const defensiveModifier = G.players[targetID].equipment["defensive-mount"]
    ? 1
    : 0;
  return Math.max(1, base - offensiveModifier + defensiveModifier);
}

export function attackRange(G: TqsGameState, playerID: PlayerID): number {
  const weaponID = G.players[playerID].equipment.weapon;
  if (!weaponID) return 1;
  return CARD_DEFINITIONS[G.cards[weaponID].definitionID].attackRange ?? 1;
}

export function handLimit(G: TqsGameState, playerID: PlayerID): number {
  const wangZunPenalty =
    playerID === G.lordID && G.turn.activePlayerID === playerID
      ? G.turn.wangZunHandLimitPenalty
      : 0;
  return Math.max(0, G.players[playerID].hp - wangZunPenalty);
}

export function nextLivingPlayer(
  G: TqsGameState,
  playerID: PlayerID,
): PlayerID {
  const index = G.seatOrder.indexOf(playerID);
  for (let offset = 1; offset <= G.seatOrder.length; offset += 1) {
    const candidate = G.seatOrder[(index + offset) % G.seatOrder.length];
    if (G.players[candidate].alive) return candidate;
  }
  return playerID;
}

export function roleSide(role: Role): "lord" | "rebel" | "renegade" {
  if (role === "lord" || role === "loyalist") return "lord";
  return role;
}
