import { PlayerID, CardName, EquipmentSlot } from "./core";

export interface PromptBase {
  id: number;
  effectID: number;
  responderID: PlayerID;
}

export interface CardResponsePrompt extends PromptBase {
  kind: "card-response";
  response: "slash" | "dodge" | "peach" | "nullification";
  summonFaction: "wei" | "shu" | null;
  forbidCard: boolean;
  reason:
    | "slash"
    | "duel"
    | "arrow-barrage"
    | "barbarian-invasion"
    | "borrowed-sword"
    | "green-dragon-blade"
    | "rescue"
    | "nullification"
    | "ally-summon";
  sourceID: PlayerID | null;
  targetID: PlayerID;
  allowBagua: boolean;
  allowSerpentSpear: boolean;
  allowPass: boolean;
  subjectCardName: CardName | null;
  chainDepth: number;
  currentlyNegated: boolean;
}

export interface OptionPrompt extends PromptBase {
  kind: "option";
  reason:
    | "gender-swords"
    | "ice-sword"
    | "rock-cleaving-axe"
    | "green-dragon-blade"
    | "qilin-bow"
    | "gender-swords-target"
    | "fan-kui"
    | "gang-lie"
    | "gui-cai"
    | "tu-xi"
    | "lian-ying"
    | "xiao-ji"
    | "luo-yi"
    | "fan-jian-suit"
    | "yi-ji"
    | "jian-xiong"
    | "tie-ji"
    | "liu-li"
    | "guan-xing"
    | "yao-wu"
    | "wang-zun"
    | "luo-shen"
    | "bi-yue"
    | "ke-ji"
    | "ji-zhi";
  sourceID: PlayerID;
  targetID: PlayerID;
  choices: string[];
}

export interface SelectCardsPrompt extends PromptBase {
  kind: "select-cards";
  reason:
    | "dismantle"
    | "snatch"
    | "gender-swords"
    | "ice-sword"
    | "rock-cleaving-axe"
    | "qilin-bow"
    | "fan-kui"
    | "gang-lie-discard"
    | "gui-cai"
    | "yi-ji"
    | "liu-li"
    | "guan-xing";
  ownerID: PlayerID;
  zones: Array<"hand" | "equipment" | "judgement" | "processing">;
  minimum: number;
  maximum: number;
  allowPass: boolean;
}

export interface HarvestPrompt extends PromptBase {
  kind: "harvest-choice";
  reason?: string;
  availableCardIDs: string[];
}

export interface ChoosePlayersPrompt extends PromptBase {
  kind: "choose-players";
  reason: "tu-xi" | "yi-ji" | "liu-li";
  candidates: PlayerID[];
  minimum: number;
  maximum: number;
}

export interface PlayCardPrompt extends PromptBase {
  kind: "play-card";
  reason:
    | "slash"
    | "duel"
    | "arrow-barrage"
    | "barbarian-invasion"
    | "borrowed-sword"
    | "green-dragon-blade"
    | "rescue"
    | "nullification"
    | "ally-summon";
  allowBagua: boolean;
  ownerID: PlayerID;
  allowSerpentSpear?: boolean;
  allowPass?: boolean;
}

export type GamePrompt =
  | CardResponsePrompt
  | OptionPrompt
  | SelectCardsPrompt
  | HarvestPrompt
  | ChoosePlayersPrompt
  | PlayCardPrompt;

export type PromptAnswer =
  | { kind: "pass" }
  | { kind: "card"; cardID: string }
  | { kind: "option"; choice: string }
  | { kind: "bagua" }
  | { kind: "serpent-spear"; cardIDs: [string, string] }
  | { kind: "zone-cards"; choices: ZoneCardChoice[] }
  | { kind: "harvest"; cardID: string }
  | { kind: "players"; playerIDs: PlayerID[] }
  | { kind: "summon" }
  | { kind: "play-card"; input: PlayCardInput };

export type ZoneCardChoice =
  | { zone: "hand"; ownerID: PlayerID; handIndex: number }
  | { zone: "equipment"; ownerID: PlayerID; slot: EquipmentSlot }
  | { zone: "judgement"; ownerID: PlayerID; cardID: string }
  | { zone: "processing"; cardID: string };

export type PlayCardInput =
  | { kind?: "physical"; cardID: string; targetIDs: PlayerID[] }
  | {
      kind: "serpent-spear";
      cardIDs: [string, string];
      targetIDs: PlayerID[];
    }
  | {
      kind: "virtual";
      cardID: string;
      as: "slash" | "dismantle" | "snatch" | "indulgence";
      targetIDs: PlayerID[];
    };
