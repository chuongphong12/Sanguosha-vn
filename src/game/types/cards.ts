import {
  CardName,
  CardKind,
  EquipmentSlot,
  Suit,
  Rank,
  Faction,
  Gender,
} from "./core";

export interface CardDefinition {
  id: CardName;
  name: string;
  chineseName: string;
  kind: CardKind;
  equipmentSlot?: EquipmentSlot;
  attackRange?: number;
}

export interface PhysicalCard {
  id: string;
  definitionID: CardName;
  suit: Suit;
  rank: Rank;
  edition: "standard" | "ex";
}

export interface SkillDefinition {
  id: string;
  name: string;
  chineseName: string;
  description: string;
  lordSkill?: boolean;
  lockedSkill?: boolean;
}

export interface GeneralDefinition {
  id: string;
  name: string;
  chineseName: string;
  faction: Faction;
  gender: Gender;
  maxHP: number;
  skillIDs: string[];
}
