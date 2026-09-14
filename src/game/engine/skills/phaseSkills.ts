// @ts-nocheck
import { SkillDefinition } from "../SkillRegistry";
import { SkillTriggerEffect } from "../../model";
import { playerName } from "../../cardEngine";
import { writeLog, drawCards } from "../../rules";
import { hasSkill } from "../../cardEngine";

export const tuXiSkill: SkillDefinition = {
  id: "tu-xi",
  triggerOn: "DrawPhase",
  canInvoke: (G, playerID, context) => {
    if (context.playerID !== playerID) return false;
    return G.seatOrder.some(
      (otherID) =>
        otherID !== playerID &&
        G.players[otherID].alive &&
        G.players[otherID].hand.length > 0,
    );
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as SkillTriggerEffect;
    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "option",
      responderID: effect.owner,
      reason: "tu-xi",
      sourceID: effect.owner,
      targetID: effect.owner,
      choices: ["activate", "decline"],
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect;

    if (answer.kind === "option") {
      if ((answer as any).choice === "activate") {
        const candidates = G.seatOrder.filter(
          (otherID) =>
            otherID !== effect.owner &&
            G.players[otherID].alive &&
            G.players[otherID].hand.length > 0,
        );
        if (candidates.length === 0) {
          G.effectStack.shift();
          return true;
        }
        G.prompt = {
          id: G.nextResolutionID++,
          effectID: effect.id,
          kind: "choose-players",
          responderID: effect.owner,
          reason: "tu-xi",
          candidates,
          minimum: 1,
          maximum: Math.min(2, candidates.length),
        };
        return true;
      }
      if ((answer as any).choice === "decline") {
        G.effectStack.shift();
        return true;
      }
    }

    if (answer.kind === "players") {
      const chosen = [...new Set(answer.playerIDs as string[])];
      if (
        chosen.length < (G.prompt as any).minimum ||
        chosen.length > (G.prompt as any).maximum ||
        !chosen.every((playerID) =>
          (G.prompt as any).candidates.includes(playerID),
        )
      ) {
        return false;
      }

      G.turn.skippedSteps.push("draw");

      for (const targetID of chosen) {
        const targetHand = G.players[targetID].hand;
        if (targetHand.length === 0) continue;

        const randomIndex = Math.floor(Math.random() * targetHand.length);
        const cardID = targetHand[randomIndex];
        targetHand.splice(randomIndex, 1);
        G.players[effect.owner].hand.push(cardID);
        writeLog(
          G,
          `${playerName(G, effect.owner)} dùng 【Đột Tập】 lấy một lá của ${playerName(G, targetID)}.`,
        );
      }

      G.prompt = null;
      G.effectStack.shift();
      return true;
    }
    return false;
  },
};

export const luoYiSkill: SkillDefinition = {
  id: "luo-yi",
  triggerOn: "DrawPhase",
  canInvoke: (G, playerID, context) => {
    return context.playerID === playerID;
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as SkillTriggerEffect;
    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "option",
      responderID: effect.owner,
      reason: "luo-yi",
      sourceID: effect.owner,
      targetID: effect.owner,
      choices: ["activate", "decline"],
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect;
    if (answer.kind === "option") {
      if ((answer as any).choice === "activate") {
        G.turn.skippedSteps.push("draw");
        G.turn.luoYiBuff = true;

        // Use drawCards to properly handle Ying Zi and triggers
        const amount = hasSkill(G, effect.owner, "ying-zi") ? 2 : 1;
        drawCards(G, effect.owner, amount, shuffle);

        writeLog(
          G,
          `${playerName(G, effect.owner)} dùng 【Lõa Y】 rút ${amount} lá, sát thương từ Sát hoặc Quyết Đấu gây ra trong lượt này +1.`,
        );
      } else if ((answer as any).choice !== "decline") {
        return false;
      }
      G.effectStack.shift();
      return true;
    }
    return false;
  },
};

export const lianYingSkill: SkillDefinition = {
  id: "lian-ying",
  triggerOn: "LoseHandCard",
  canInvoke: (G, playerID, context) => {
    return (
      context.playerID === playerID && G.players[playerID].hand.length === 0
    );
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as SkillTriggerEffect;
    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "option",
      responderID: effect.owner,
      reason: "lian-ying",
      sourceID: effect.owner,
      targetID: effect.owner,
      choices: ["activate", "decline"],
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect;
    if (answer.kind === "option") {
      if ((answer as any).choice === "activate") {
        drawCards(G, effect.owner, 1, shuffle);
        writeLog(
          G,
          `${playerName(G, effect.owner)} dùng 【Liên Doanh】 rút 1 lá.`,
        );
      } else if ((answer as any).choice !== "decline") {
        return false;
      }
      G.effectStack.shift();
      return true;
    }
    return false;
  },
};

export const xiaoJiSkill: SkillDefinition = {
  id: "xiao-ji",
  triggerOn: "LoseEquipment",
  canInvoke: (G, playerID, context) => {
    return context.playerID === playerID;
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as SkillTriggerEffect;
    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "option",
      responderID: effect.owner,
      reason: "xiao-ji",
      sourceID: effect.owner,
      targetID: effect.owner,
      choices: ["activate", "decline"],
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect;
    if (answer.kind === "option") {
      if ((answer as any).choice === "activate") {
        drawCards(G, effect.owner, 2, shuffle);
        writeLog(
          G,
          `${playerName(G, effect.owner)} dùng 【Kiêu Cơ】 rút 2 lá.`,
        );
      } else if ((answer as any).choice !== "decline") {
        return false;
      }
      G.effectStack.shift();
      return true;
    }
    return false;
  },
};
