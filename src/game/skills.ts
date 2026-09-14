import { PlayerID, TqsGameState, TqsPlayerViewState } from "./model";

export function hasSkill(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
  skillID: string,
): boolean {
  return G.players[playerID]?.activeSkillIDs.includes(skillID) === true;
}

export function getActiveSkills(
  G: TqsGameState | TqsPlayerViewState,
  playerID: PlayerID,
): string[] {
  return G.players[playerID]?.activeSkillIDs || [];
}
