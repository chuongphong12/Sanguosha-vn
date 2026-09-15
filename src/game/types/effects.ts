import { PlayerID, CardName, CardColor, DamageNature } from "./core";

export interface CardUse {
  id: number;
  cardName: CardName;
  sourceID: PlayerID;
  materialCardIDs: string[];
  targetIDs: PlayerID[];
  reason: "play" | "borrowed-sword" | "green-dragon-blade";
  color: CardColor;
}

export interface FinishUseEffect {
  id: number;
  kind: "finish-use";
  materialCardIDs: string[];
}

export interface NullificationEffect {
  id: number;
  kind: "nullification";
  cardName: CardName;
  sourceID: PlayerID | null;
  targetID: PlayerID;
  responderID: PlayerID | null;
  passedPlayerIDs: PlayerID[];
  negated: boolean;
  nullificationCardIDs: string[];
  children: GameEffect[];
  onNegated: "nothing" | "discard-delayed" | "transfer-lightning";
  delayedCardID: string | null;
}

export interface SlashEffect {
  id: number;
  kind: "slash";
  use: CardUse;
  targetIndex: number;
  stage:
    | "start"
    | "gender-swords"
    | "dodge"
    | "dodged"
    | "before-damage"
    | "after-damage";
  ignoreArmor: boolean;
  baguaTried: boolean;
  dodgesRequired: number;
  dodgesUsed: number;
  tieJiTried: boolean;
  ignoreDodge: boolean;
  liuLiDiscardID: string | null;
}

export interface DuelEffect {
  id: number;
  kind: "duel";
  sourceID: PlayerID;
  targetID: PlayerID;
  responderID: PlayerID;
  opponentID: PlayerID;
  slashesRequired: number;
  slashesPlayed: number;
  sourceCardID: string | null;
}

export interface TargetCardEffect {
  id: number;
  kind: "target-card";
  sourceID: PlayerID;
  targetID: PlayerID;
  result: "discard" | "gain";
}

export interface BorrowedSwordEffect {
  id: number;
  kind: "borrowed-sword";
  sourceID: PlayerID;
  weaponHolderID: PlayerID;
  slashTargetID: PlayerID;
}

export interface RequiredResponseEffect {
  id: number;
  kind: "required-response";
  sourceID: PlayerID;
  targetID: PlayerID;
  response: "slash" | "dodge";
  reason: "arrow-barrage" | "barbarian-invasion";
  baguaTried: boolean;
  sourceCardID: string | null;
}

export interface RecoverEffect {
  id: number;
  kind: "recover";
  targetID: PlayerID;
  amount: number;
}

export interface DrawEffect {
  id: number;
  kind: "draw";
  targetID: PlayerID;
  amount: number;
}

export interface HarvestEffect {
  id: number;
  kind: "harvest";
  sourceID: PlayerID;
  targetIDs: PlayerID[];
  poolCardIDs: string[];
}

export interface HarvestPickEffect {
  id: number;
  kind: "harvest-pick";
  targetID: PlayerID;
  poolCardIDs: string[];
}

export interface HarvestCleanupEffect {
  id: number;
  kind: "harvest-cleanup";
  poolCardIDs: string[];
}

export interface PlaceDelayedEffect {
  id: number;
  kind: "place-delayed";
  targetID: PlayerID;
  cardID: string;
}

export interface ResolveDelayedEffect {
  id: number;
  kind: "resolve-delayed";
  ownerID: PlayerID;
  cardID: string;
  judgeCardID: string | null;
}

export interface FanKuiEffect {
  id: number;
  kind: "fan-kui";
  ownerID: PlayerID;
  sourceID: PlayerID;
}

export interface GangLieEffect {
  id: number;
  kind: "gang-lie";
  ownerID: PlayerID;
  sourceID: PlayerID;
  judgeCardID: string | null;
}

export interface TuXiEffect {
  id: number;
  kind: "tu-xi";
  ownerID: PlayerID;
}

export interface LianYingEffect {
  id: number;
  kind: "lian-ying";
  ownerID: PlayerID;
}

export interface XiaoJiEffect {
  id: number;
  kind: "xiao-ji";
  ownerID: PlayerID;
}

export interface LuoYiEffect {
  id: number;
  kind: "luo-yi";
  ownerID: PlayerID;
}

export interface YiJiEffect {
  id: number;
  kind: "yi-ji";
  ownerID: PlayerID;
  remainingOpportunities: number;
  stage: "offer" | "card" | "recipient";
  poolCardIDs: string[];
  selectedCardID: string | null;
}

export interface JianXiongEffect {
  id: number;
  kind: "jian-xiong";
  ownerID: PlayerID;
  cardIDs: string[];
}

export interface YaoWuEffect {
  id: number;
  kind: "yao-wu";
  ownerID: PlayerID;
  sourceID: PlayerID;
}

export interface WangZunEffect {
  id: number;
  kind: "wang-zun";
  ownerID: PlayerID;
  lordID: PlayerID;
}

export interface AllySummonEffect {
  id: number;
  kind: "ally-summon";
  skillID: "hu-jia" | "ji-jiang";
  lordID: PlayerID;
  faction: "wei" | "shu";
  response: "dodge" | "slash";
  requesterEffectID: number;
  queueIDs: PlayerID[];
  passedIDs: PlayerID[];
}

export interface GuanXingEffect {
  id: number;
  kind: "guan-xing";
  ownerID: PlayerID;
  stage: "offer" | "top" | "bottom";
  poolCardIDs: string[];
  topCardIDs: string[];
}

export interface LuoShenEffect {
  id: number;
  kind: "luo-shen";
  ownerID: PlayerID;
  judgeCardID?: string | null | "declined";
}

export interface BaguaJudgementEffect {
  id: number;
  kind: "bagua-judgement";
  ownerID: PlayerID;
  judgeCardID: string | null;
}

export interface TieJiJudgementEffect {
  id: number;
  kind: "tie-ji-judgement";
  ownerID: PlayerID;
  slashTargetID: PlayerID;
  judgeCardID: string | null;
}

export interface OptionalSkillEffect {
  id: number;
  kind: "optional-skill";
  ownerID: PlayerID;
  skillID: "bi-yue" | "ke-ji" | "ji-zhi";
}

export interface FanJianEffect {
  id: number;
  kind: "fan-jian";
  ownerID: PlayerID;
  targetID: PlayerID;
}

export interface DamageEffect {
  id: number;
  kind: "damage";
  sourceID: PlayerID | null;
  targetID: PlayerID;
  amount: number;
  nature: DamageNature;
  stage: "apply" | "after-dying";
  cardIDs: string[];
  cardName: CardName | null;
  cardColor: CardColor;
}

export interface DyingEffect {
  id: number;
  kind: "dying";
  dyingPlayerID: PlayerID;
  sourceID: PlayerID | null;
  responderID: PlayerID;
  passedPlayerIDs: PlayerID[];
}

export interface SkillTriggerEffect {
  id: number;
  kind: "skill-trigger";
  skillId: string;
  owner: PlayerID;
  context: any;
}

export type GameEffect =
  | SkillTriggerEffect
  | { id: number; kind: "execute-draw"; ownerID: PlayerID }
  | FinishUseEffect
  | NullificationEffect
  | SlashEffect
  | DuelEffect
  | TargetCardEffect
  | BorrowedSwordEffect
  | RequiredResponseEffect
  | RecoverEffect
  | DrawEffect
  | HarvestEffect
  | HarvestPickEffect
  | HarvestCleanupEffect
  | PlaceDelayedEffect
  | ResolveDelayedEffect
  | DamageEffect
  | DyingEffect
  | FanKuiEffect
  | GangLieEffect
  | TuXiEffect
  | LianYingEffect
  | XiaoJiEffect
  | LuoYiEffect
  | YiJiEffect
  | FanJianEffect
  | JianXiongEffect
  | YaoWuEffect
  | WangZunEffect
  | AllySummonEffect
  | GuanXingEffect
  | LuoShenEffect
  | BaguaJudgementEffect
  | TieJiJudgementEffect
  | OptionalSkillEffect;
