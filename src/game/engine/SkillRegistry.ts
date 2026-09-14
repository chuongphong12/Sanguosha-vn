import type { PlayerID, TqsGameState, PromptAnswer, Shuffle } from "../model";
import type { GameEventName } from "./EventBus";
import type { GameEffect } from "../model";

export interface SkillDefinition {
  id: string;
  triggerOn: GameEventName;
  canInvoke: (G: TqsGameState, playerID: PlayerID, context: any) => boolean;
  onTrigger?: (G: TqsGameState, effect: any, shuffle: Shuffle) => void;
  onAnswer?: (G: TqsGameState, effect: any, answer: PromptAnswer, shuffle: Shuffle) => boolean;
  onUse?: (G: TqsGameState, playerID: PlayerID, payload: unknown, shuffle: Shuffle) => boolean;
}

export const SKILL_REGISTRY: Record<string, SkillDefinition> = {};

export function registerSkill(def: SkillDefinition) {
  SKILL_REGISTRY[def.id] = def;
}
