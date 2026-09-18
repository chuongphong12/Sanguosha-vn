import {
  PlayerID,
  Role,
  EquipmentSlot,
  TurnStep,
  GameWinner,
  GameLogEntry,
} from "./core";
import { PhysicalCard } from "./cards";
import { GameEffect } from "./effects";
import { GamePrompt } from "./prompts";

export interface PlayerState {
  id: PlayerID;
  seat: number;
  role: Role;
  roleRevealed: boolean;
  generalID: string | null;
  generalCandidates: string[];
  activeSkillIDs: string[];
  maxHP: number;
  hp: number;
  alive: boolean;
  hand: string[];
  equipment: Partial<Record<EquipmentSlot, string>>;
  judgement: string[];
  slashUses: number;
  skillsUsedThisTurn: string[];
}

export interface TurnState {
  activePlayerID: PlayerID;
  step: TurnStep;
  number: number;
  skippedSteps: TurnStep[];
  resolvedJudgementCardIDs: string[];
  drewCards: boolean;
  luoYiBuff: boolean;
  rendeGiven: number;
  wangZunResolved: boolean;
  wangZunHandLimitPenalty: number;
  biYueResolved: boolean;
}

export interface TqsGameState {
  rulesVersion: "standard-2013-v2";
  status:
    | "waiting-room"
    | "lord-selection"
    | "general-selection"
    | "playing"
    | "ended";
  config: {
    autoSkipWuxie?: boolean;
    lordExtraHp?: number;
    turnTimeLimit?: number | null;
  };
  seatOrder: PlayerID[];
  lordID: PlayerID;
  players: Record<PlayerID, PlayerState>;
  deck: string[];
  discard: string[];
  processing: string[];
  cards: Record<string, PhysicalCard>;
  turn: TurnState;
  effectStack: GameEffect[];
  prompt: GamePrompt | null;
  nextResolutionID: number;
  winner: GameWinner | null;
  log: GameLogEntry[];
  nextLogID: number;
}

export interface PlayerViewPlayer extends Omit<
  PlayerState,
  "role" | "generalID" | "generalCandidates"
> {
  role: Role | null;
  generalID: string | null;
  generalSelected: boolean;
  generalCandidates: string[];
}

export interface TqsPlayerViewState extends Omit<
  TqsGameState,
  "players" | "deck"
> {
  players: Record<PlayerID, PlayerViewPlayer>;
  deckSize: number;
}

export interface TqsSetupOptions {
  joinedPlayerIDs?: string[];
  autoSkipWuxie?: boolean;
  fastPick?: boolean;
  lordExtraHp?: number;
  turnTimeLimit?: number | null;
  numPlayers: number;
  roleVariant?: "standard" | "double-renegade";
}
