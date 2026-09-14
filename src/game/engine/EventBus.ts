import { PlayerID, TqsGameState } from "../model";
// import { GENERALS_BY_ID } from "../catalog/generals";
import { getActiveSkills } from "../skills";
import { SKILL_REGISTRY } from "./SkillRegistry";

export type GameEventName =
  | "Active"
  | "AfterDamage"
  | "BeforeDamage"
  | "CardUsed"
  | "PhaseStart"
  | "DrawPhase"
  | "LoseHandCard"
  | "LoseEquipment";

export function emitEvent(
  G: TqsGameState,
  eventName: GameEventName,
  context: any
): void {
  const numPlayers = G.seatOrder.length;
  const activeIndex = G.seatOrder.indexOf(G.turn.activePlayerID);
  
  for (let i = 1; i <= numPlayers; i++) {
    const playerID = G.seatOrder[(activeIndex - i + numPlayers) % numPlayers];
    const player = G.players[playerID];
    
    if (!player || !player.alive) continue;

    const skills = getActiveSkills(G, playerID);
    for (const skillId of skills) {
      const skillDef = SKILL_REGISTRY[skillId];
      if (!skillDef || skillDef.triggerOn !== eventName) continue;
      
      if (skillDef.canInvoke(G, playerID, context)) {
        G.effectStack.unshift({
          id: G.nextResolutionID++,
          kind: "skill-trigger",
          skillId,
          owner: playerID,
          context,
        } as any);
      }
    }
  }
}
