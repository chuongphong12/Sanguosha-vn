import { SkillDefinition } from "../../SkillRegistry";
import {
  removeHandCard,
  playerName,
  damageEffect,
  markSkillUsed,
  resolveCardGame,
} from "../../../cardEngine";
import { writeLog } from "../../../rules";

export const fanJianSkill: SkillDefinition = {
  id: "fan-jian",
  triggerOn: "Active",
  canInvoke: () => false,
  onUse: (G, playerID, payload, shuffle) => {
    if (typeof payload !== "object" || payload === null) return false;
    const { targetID } = payload as Record<string, unknown>;
    if (typeof targetID !== "string") return false;
    const target = G.players[targetID];
    if (
      !target?.alive ||
      targetID === playerID ||
      G.players[playerID].hand.length === 0
    )
      return false;
    markSkillUsed(G, playerID, "fan-jian");
    writeLog(
      G,
      `${playerName(G, playerID)} dùng 【Phản Gián】 với ${playerName(G, targetID)}.`,
    );
    G.effectStack.push({
      id: G.nextResolutionID++,
      kind: "skill-trigger",
      skillId: "fan-jian",
      owner: playerID,
      context: { targetID },
    } as any);
    resolveCardGame(G, shuffle);
    return true;
  },
  onTrigger: (G, baseEffect) => {
    const effect = baseEffect as any;
    const targetID = effect.context.targetID;
    if (!G.players[targetID].alive || !G.players[effect.owner].alive) {
      G.effectStack.shift();
      return;
    }
    G.prompt = {
      id: G.nextResolutionID++,
      effectID: effect.id,
      kind: "option",
      responderID: targetID,
      reason: "fan-jian-suit",
      sourceID: effect.owner,
      targetID: targetID,
      choices: ["heart", "diamond", "club", "spade"],
    };
  },
  onAnswer: (G, baseEffect, answer, shuffle) => {
    const effect = baseEffect as any;
    const targetID = effect.context.targetID;
    if (answer.kind === "option") {
      const suits = ["heart", "diamond", "club", "spade"] as const;
      if (!suits.includes(answer.choice as (typeof suits)[number]))
        return false;
      const owner = G.players[effect.owner];
      if (owner.hand.length === 0) {
        G.effectStack.shift();
        return true;
      }
      const cardID = shuffle(owner.hand)[0];
      removeHandCard(G, effect.owner, cardID);
      G.players[targetID].hand.push(cardID);
      writeLog(
        G,
        `${playerName(G, targetID)} đoán chất ${answer.choice}, rút được lá ${G.cards[cardID].suit}.`,
      );
      G.effectStack.shift();
      if (G.cards[cardID].suit !== answer.choice) {
        G.effectStack.unshift(damageEffect(G, effect.owner, targetID));
      }
      return true;
    }
    return false;
  },
};
