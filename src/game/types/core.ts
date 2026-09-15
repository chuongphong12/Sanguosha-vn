export type PlayerID = string;

export type Role = "lord" | "loyalist" | "rebel" | "renegade";
export type Faction = "wei" | "shu" | "wu" | "qun";
export type Gender = "male" | "female";
export type Suit = "heart" | "diamond" | "club" | "spade";
export type Rank =
  "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export type CardName =
  | "slash"
  | "dodge"
  | "peach"
  | "duel"
  | "dismantle"
  | "snatch"
  | "borrowed-sword"
  | "ex-nihilo"
  | "nullification"
  | "arrow-barrage"
  | "barbarian-invasion"
  | "peach-garden"
  | "harvest"
  | "indulgence"
  | "lightning"
  | "crossbow"
  | "qinggang-sword"
  | "gender-swords"
  | "ice-sword"
  | "rock-cleaving-axe"
  | "green-dragon-blade"
  | "serpent-spear"
  | "halberd"
  | "qilin-bow"
  | "bagua-formation"
  | "renwang-shield"
  | "jueying"
  | "zhaohuang-feidian"
  | "dilu"
  | "dayuan"
  | "red-hare"
  | "zixing";

export type CardKind = "basic" | "trick" | "delayed-trick" | "equipment";
export type EquipmentSlot =
  "weapon" | "armor" | "offensive-mount" | "defensive-mount";
export type TurnStep =
  "start" | "prepare" | "judge" | "draw" | "play" | "discard" | "end";

export type DamageNature = "normal" | "thunder";
export type CardColor = "red" | "black" | "colorless";

export interface GameWinner {
  side: "lord" | "rebel" | "renegade";
  playerIDs: PlayerID[];
  reason: string;
}

export interface GameLogEntry {
  id: number;
  message: string;
}

export type Shuffle = <T>(items: T[]) => T[];
