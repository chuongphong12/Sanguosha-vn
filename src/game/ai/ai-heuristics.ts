import type { Ctx } from "boardgame.io";
import type { PlayerID, TqsGameState } from "../model";
import { CARD_DEFINITIONS } from "../catalog/cards";
import { attackRange, distanceBetween } from "../rules";

function isEnemy(G: TqsGameState, a: PlayerID, b: PlayerID): boolean {
  if (a === b) return false;
  const pA = G.players[a];
  const pB = G.players[b];
  if (!pA.roleRevealed && !pB.roleRevealed) {
    // If neither is revealed, bot acts passively or randomly.
    // We'll treat unrevealed as NOT enemy to avoid randomly attacking friends,
    // UNLESS the bot is a rebel and attacks the Lord (Lord is always revealed).
    // Actually, Lord is always revealed.
    return false;
  }

  const getAlignment = (role: string) => {
    if (role === "lord" || role === "loyalist") return "good";
    if (role === "rebel") return "evil";
    return "neutral"; // renegade
  };

  const alignA = getAlignment(pA.role);
  const alignB = getAlignment(pB.role);

  if (alignA === "neutral" || alignB === "neutral") {
    // Renegade considers everyone an enemy (simplified)
    return true;
  }

  return alignA !== alignB;
}

export function getHeuristicMoves(
  G: TqsGameState,
  ctx: Ctx,
  playerID: PlayerID,
): any[] {
  const moves: any[] = [];
  const prompt = G.prompt;
  const player = G.players[playerID];

  if (prompt && prompt.responderID === playerID) {
    let answered = false;

    if (prompt.kind === "card-response") {
      const needed = prompt.response;
      if (needed === "dodge" || needed === "slash" || needed === "peach") {
        const cardID = player.hand.find(
          (c) => G.cards[c].definitionID === needed,
        );
        if (cardID) {
          moves.push({
            move: "answerPrompt",
            args: [prompt.id, { kind: "card", cardID }],
          });
          answered = true;
        }
      } else if (needed === "aoe-response") {
        const reason = (prompt as any).reason;
        const required = reason === "arrow-barrage" ? "dodge" : "slash";
        const cardID = player.hand.find(
          (c) => G.cards[c].definitionID === required,
        );
        if (cardID) {
          moves.push({
            move: "answerPrompt",
            args: [prompt.id, { kind: "card", cardID }],
          });
          answered = true;
        }
      }
    }

    if (!answered) {
      moves.push({
        move: "answerPrompt",
        args: [prompt.id, { kind: "pass" }],
      });
    }
    return moves;
  }

  if (G.status === "lord-selection" || G.status === "general-selection") {
    if (player && !player.generalID && player.generalCandidates.length > 0) {
      moves.push({
        move: "selectGeneral",
        args: [player.generalCandidates[0]],
      });
    }
    return moves;
  }

  const activeStage = ctx.activePlayers?.[playerID];
  if (activeStage === "play") {
    let acted = false;

    // 1. Use Peach if injured
    if (player.hp < player.maxHP) {
      const peachID = player.hand.find(
        (c) => G.cards[c].definitionID === "peach",
      );
      if (peachID) {
        moves.push({ move: "declareCardUse", args: [{ cardID: peachID }] });
        acted = true;
      }
    }

    if (!acted) {
      // 2. Equip equipment
      for (const cid of player.hand) {
        const def = CARD_DEFINITIONS[G.cards[cid].definitionID];
        if (def.kind === "equipment") {
          // Simplified: just equip it, even if it replaces an old one
          moves.push({ move: "declareCardUse", args: [{ cardID: cid }] });
          acted = true;
          break;
        }
      }
    }

    if (!acted && player.slashUses < 1) {
      // Actually, some generals have >1
      // 3. Attack an enemy in range with Slash
      const slashID = player.hand.find(
        (c) => G.cards[c].definitionID === "slash",
      );
      if (slashID) {
        const range = attackRange(G, playerID);
        // Find a valid enemy
        for (const targetID of ctx.playOrder) {
          if (targetID === playerID || !G.players[targetID].alive) continue;
          if (
            isEnemy(G, playerID, targetID) &&
            distanceBetween(G, playerID, targetID) <= range
          ) {
            moves.push({
              move: "declareCardUse",
              args: [{ cardID: slashID, targetIDs: [targetID] }],
            });
            acted = true;
            break;
          }
        }
      }
    }

    if (!acted) {
      // 4. Use AOE if there are more enemies than allies (Simplified: always use AOE for now if renegade/rebel, or skip for lord)
      // For a simple bot, just skip AOE to avoid hitting allies randomly.
      moves.push({ move: "endPlayPhase", args: [] });
    }
  } else if (activeStage === "discard") {
    const limit = player.hp;
    if (player.hand.length > Math.max(0, limit)) {
      const numToDiscard = player.hand.length - Math.max(0, limit);
      const discards = player.hand.slice(0, numToDiscard);
      moves.push({ move: "discardCards", args: [discards] });
    } else {
      moves.push({ move: "discardCards", args: [[]] });
    }
  }

  return moves;
}
