// @ts-nocheck
import { SkillDefinition } from "../SkillRegistry";
import {
  TqsGameState,
  GameEffect,
  PlayerID,
  SkillTriggerEffect,
} from "../../model";
import { drawCards, writeLog } from "../../rules";
import {
  removeZoneCard,
  playerName,
  damageEffect,
  takeTopCard,
  hasZoneCard,
  moveSelectedCard,
} from "../../cardEngine";

export const yiJiSkill: SkillDefinition = {
  id: "yi-ji",
  triggerOn: "AfterDamage",
  canInvoke: (G, playerID, context) => {
    // Context should have { amount, targetID }
    return context.targetID === playerID;
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as SkillTriggerEffect & {
      remainingOpportunities: number;
      stage: "offer" | "card" | "recipient";
      poolCardIDs: string[];
      selectedCardID: string | null;
    };

    // Initialize state if not present
    if (effect.stage === undefined) {
      effect.stage = "offer";
      effect.remainingOpportunities = effect.context.amount;
      effect.poolCardIDs = [];
      effect.selectedCardID = null;
    }

    const owner = G.players[effect.owner];
    if (!owner.alive || effect.remainingOpportunities <= 0) {
      G.effectStack.shift();
      return;
    }

    if (effect.stage === "offer") {
      G.prompt = {
        id: G.nextResolutionID++,
        effectID: effect.id,
        kind: "option",
        responderID: effect.owner,
        reason: "yi-ji",
        sourceID: effect.owner,
        targetID: effect.owner,
        choices: ["activate", "decline"],
      };
      return;
    }

    if (effect.stage === "card") {
      G.prompt = {
        id: G.nextResolutionID++,
        effectID: effect.id,
        kind: "select-cards",
        responderID: effect.owner,
        reason: "yi-ji",
        ownerID: effect.owner,
        zones: ["hand"],
        minimum: 0,
        maximum: 1,
        allowPass: true,
      };
      return;
    }

    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "choose-players",
      responderID: effect.owner,
      reason: "yi-ji",
      candidates: G.seatOrder.filter((pid) => G.players[pid].alive),
      minimum: 1,
      maximum: 1,
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect & {
      remainingOpportunities: number;
      stage: "offer" | "card" | "recipient";
      poolCardIDs: string[];
      selectedCardID: string | null;
    };

    if (answer.kind === "option") {
      if (answer.choice === "decline") {
        G.effectStack.shift();
        return true;
      }
      if (answer.choice !== "activate" || effect.stage !== "offer")
        return false;

      effect.poolCardIDs = [];
      for (let index = 0; index < 2; index += 1) {
        const cardID = takeTopCard(G, shuffle);
        if (!cardID) break;
        G.players[effect.owner].hand.push(cardID);
        effect.poolCardIDs.push(cardID);
      }

      writeLog(
        G,
        `${playerName(G, effect.owner)} dùng 【Di Kế】 xem ${effect.poolCardIDs.length} lá đầu Chồng Bài Rút.`,
      );

      if (effect.poolCardIDs.length === 0) {
        effect.poolCardIDs = [];
        effect.selectedCardID = null;
        effect.remainingOpportunities -= 1;
        if (effect.remainingOpportunities <= 0) G.effectStack.shift();
        else effect.stage = "offer";
      } else {
        effect.stage = "card";
      }
      return true;
    }

    if (G.prompt?.kind === "select-cards") {
      const cardIDs = moveSelectedCard(G, G.prompt, answer);
      if (!cardIDs || effect.stage !== "card" || cardIDs.length > 1)
        return false;
      for (const cardID of cardIDs) {
        if (!effect.poolCardIDs.includes(cardID)) return false;
      }
      if (cardIDs.length === 0) {
        effect.poolCardIDs = [];
        effect.selectedCardID = null;
        effect.remainingOpportunities -= 1;
        if (effect.remainingOpportunities <= 0) G.effectStack.shift();
        else effect.stage = "offer";
        return true;
      }
      effect.selectedCardID = cardIDs[0];
      effect.stage = "recipient";
      return true;
    }

    if (answer.kind === "players") {
      if (effect.stage !== "recipient" || !effect.selectedCardID) return false;
      const chosen = [...new Set(answer.playerIDs as string[] as string[])];
      if (
        chosen.length !== 1 ||
        !effect.poolCardIDs.includes(effect.selectedCardID) ||
        !G.players[effect.owner].hand.includes(effect.selectedCardID)
      ) {
        return false;
      }

      const cardID = effect.selectedCardID;
      const hand = G.players[effect.owner].hand;
      hand.splice(hand.indexOf(cardID), 1);
      G.players[chosen[0]].hand.push(cardID);

      writeLog(
        G,
        `${playerName(G, effect.owner)} dùng 【Di Kế】 đưa một lá cho ${playerName(G, chosen[0])}.`,
      );

      effect.poolCardIDs = effect.poolCardIDs.filter((id) => id !== cardID);
      effect.selectedCardID = null;
      if (effect.poolCardIDs.length === 0) {
        effect.remainingOpportunities -= 1;
        if (effect.remainingOpportunities <= 0) G.effectStack.shift();
        else effect.stage = "offer";
      } else {
        effect.stage = "card";
      }
      return true;
    }

    return false;
  },
};

export const jianXiongSkill: SkillDefinition = {
  id: "jian-xiong",
  triggerOn: "AfterDamage",
  canInvoke: (G, playerID, context) => {
    // context: { amount, targetID, effect: DamageEffect }
    if (context.targetID !== playerID) return false;
    const damageEffect = context.effect;
    const causeCardIDs =
      damageEffect.cardIDs?.filter((cardID: string) =>
        G.processing.includes(cardID),
      ) || [];
    return causeCardIDs.length > 0;
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as SkillTriggerEffect & { cardIDs?: string[] };
    if (!effect.context.cards) {
      effect.context.cards = effect.context.effect.cardIDs.filter(
        (cardID: string) => G.processing.includes(cardID),
      );
    }

    if (!G.players[effect.owner].alive || effect.context.cards.length === 0) {
      G.effectStack.shift();
      return;
    }

    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "option",
      responderID: effect.owner,
      reason: "jian-xiong",
      sourceID: effect.owner,
      targetID: effect.owner,
      choices: ["activate", "decline"],
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect & { cardIDs: string[] };
    if (answer.kind === "option") {
      if (answer.choice === "activate") {
        const obtained = effect.context.cards.filter((cardID) => {
          const index = G.processing.indexOf(cardID);
          if (index < 0) return false;
          G.processing.splice(index, 1);
          return true;
        });
        G.players[effect.owner].hand.push(...obtained);
        writeLog(
          G,
          `${playerName(G, effect.owner)} dùng 【Gian Hùng】 nhận ${obtained.length} lá gây sát thương.`,
        );
      } else if (answer.choice !== "decline") {
        return false;
      }
      G.effectStack.shift();
      return true;
    }
    return false;
  },
};

export const gangLieSkill: SkillDefinition = {
  id: "gang-lie",
  triggerOn: "AfterDamage",
  canInvoke: (G, playerID, context) => {
    return context.targetID === playerID;
  },
  onTrigger: (G, baseEffect, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect;
    if (
      !G.players[effect.owner].alive ||
      !G.players[effect.context.effect.sourceID]?.alive
    ) {
      G.effectStack.shift();
      return;
    }

    if (!effect.judgeCardID) {
      const judgeCardID = takeTopCard(G, shuffle);
      if (!judgeCardID) {
        G.effectStack.shift();
        return;
      }
      effect.judgeCardID = judgeCardID;
      G.discard.push(judgeCardID);
      const judgeCard = G.cards[judgeCardID];
      writeLog(
        G,
        `【Cương Liệt】 phán xét ${judgeCard.suit} ${judgeCard.rank}.`,
      );

      const guiCaiUser = G.seatOrder.find(
        (playerID) =>
          G.players[playerID].alive &&
          hasSkill(G, playerID, "gui-cai") &&
          G.players[playerID].hand.length > 0,
      );
      if (guiCaiUser) {
        G.prompt = {
          id: G.nextResolutionID++,
          effectID: effect.id,
          kind: "option",
          responderID: guiCaiUser,
          reason: "gui-cai",
          sourceID: guiCaiUser,
          targetID: effect.owner,
          choices: ["activate", "decline"],
        };
        return;
      }
    }

    const judgeCardID = effect.judgeCardID;
    const judgeCard = G.cards[judgeCardID];

    if (hasSkill(G, effect.owner, "tian-du")) {
      const discardIndex = G.discard.indexOf(judgeCardID);
      if (discardIndex >= 0) {
        G.discard.splice(discardIndex, 1);
        G.players[effect.owner].hand.push(judgeCardID);
        writeLog(
          G,
          `${playerName(G, effect.owner)} dùng 【Thiên Đố】 nhận lá phán xét.`,
        );
      }
    }

    if (judgeCard.suit !== "heart") {
      const sourceID = effect.context.effect.sourceID;
      const source = G.players[sourceID];
      if (source.hand.length >= 2) {
        G.prompt = {
          id: G.nextResolutionID++,
          effectID: effect.id,
          kind: "select-cards",
          responderID: sourceID,
          reason: "gang-lie-discard",
          ownerID: sourceID,
          zones: ["hand"],
          minimum: 2,
          maximum: 2,
        };
        return;
      } else {
        G.effectStack.shift();
        G.effectStack.unshift({
          id: G.nextResolutionID++,
          kind: "damage",
          sourceID: effect.owner,
          targetID: sourceID,
          amount: 1,
          type: "normal",
        });
        return;
      }
    }

    G.effectStack.shift();
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect;
    if (G.prompt?.kind === "select-cards") {
      const cardIDs = moveSelectedCard(G, G.prompt, answer);
      if (!cardIDs) return false;
      const sourceID = effect.context.effect.sourceID;
      for (const cardID of cardIDs) {
        removeZoneCard(G, sourceID, cardID);
        G.discard.push(cardID);
      }
      writeLog(G, `${playerName(G, sourceID)} bỏ hai lá vì 【Cương Liệt】.`);
      G.effectStack.shift();
      return true;
    }
    return false;
  },
};

export const fanKuiSkill: SkillDefinition = {
  id: "fan-kui",
  triggerOn: "AfterDamage",
  canInvoke: (G, playerID, context) => {
    if (context.targetID !== playerID) return false;
    const sourceID = context.effect.sourceID;
    if (!sourceID || !G.players[sourceID]?.alive) return false;
    return hasZoneCard(G, sourceID);
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as SkillTriggerEffect;
    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "option",
      responderID: effect.owner,
      reason: "fan-kui",
      sourceID: effect.context.effect.sourceID,
      targetID: effect.owner,
      choices: ["activate", "decline"],
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect;
    if (answer.kind === "option") {
      if (answer.choice === "activate") {
        G.prompt = {
          id: G.nextResolutionID++,
          effectID: effect.id,
          kind: "select-cards",
          responderID: effect.owner,
          reason: "fan-kui",
          ownerID: effect.context.effect.sourceID,
          zones: ["hand", "equipment"],
          minimum: 1,
          maximum: 1,
          allowPass: false,
        };
        return true;
      } else if (answer.choice === "decline") {
        G.effectStack.shift();
        return true;
      }
    }

    if (G.prompt?.kind === "select-cards") {
      const cardIDs = moveSelectedCard(G, G.prompt, answer);
      if (!cardIDs) return false;
      const sourceID = effect.context.effect.sourceID;

      for (const cardID of cardIDs) {
        removeZoneCard(G, sourceID, cardID);
        G.players[effect.owner].hand.push(cardID);
        writeLog(
          G,
          `${playerName(G, effect.owner)} dùng 【Phản Quỹ】 lấy một lá của ${playerName(G, sourceID)}.`,
        );
      }
      G.effectStack.shift();
      return true;
    }
    return false;
  },
};

export const yaoWuSkill: SkillDefinition = {
  id: "yao-wu",
  triggerOn: "AfterDamage",
  canInvoke: (G, playerID, context) => {
    if (context.targetID !== playerID) return false;
    const { effect } = context;
    if (!effect.sourceID || !G.players[effect.sourceID]?.alive) return false;
    return effect.cardName === "slash" && effect.cardColor === "red";
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as SkillTriggerEffect;
    const sourceID = effect.context.effect.sourceID;
    const source = G.players[sourceID];
    if (!source || !source.alive) {
      G.effectStack.shift();
      return;
    }
    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "option",
      responderID: sourceID,
      reason: "yao-wu",
      sourceID,
      targetID: effect.owner,
      choices: source.hp < source.maxHP ? ["recover", "draw"] : ["draw"],
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as SkillTriggerEffect;
    const sourceID = effect.context.effect.sourceID;
    const source = G.players[sourceID];

    if (answer.kind === "option") {
      if (answer.choice === "recover" && source.hp < source.maxHP) {
        source.hp += 1;
        writeLog(
          G,
          `【Diệu Võ】: ${playerName(G, sourceID)} hồi phục 1 Thể Lực.`,
        );
      } else if (answer.choice === "draw") {
        drawCards(G, sourceID, 1, shuffle);
        writeLog(G, `【Diệu Võ】: ${playerName(G, sourceID)} rút 1 lá.`);
      } else {
        return false;
      }
      G.effectStack.shift();
      return true;
    }
    return false;
  },
};
