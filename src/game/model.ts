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
  "prepare" | "judge" | "draw" | "play" | "discard" | "end";

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

export type DamageNature = "normal" | "thunder";
export type CardColor = "red" | "black" | "colorless";

export interface CardUse {
  id: number;
  cardName: CardName;
  sourceID: PlayerID;
  materialCardIDs: string[];
  targetIDs: PlayerID[];
  reason: "play" | "borrowed-sword" | "green-dragon-blade";
  color: CardColor;
}

interface PromptBase {
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
  availableCardIDs: string[];
}

export interface ChoosePlayersPrompt extends PromptBase {
  kind: "choose-players";
  reason: "tu-xi" | "yi-ji" | "liu-li";
  candidates: PlayerID[];
  minimum: number;
  maximum: number;
}

export type GamePrompt =
  | CardResponsePrompt
  | OptionPrompt
  | SelectCardsPrompt
  | HarvestPrompt
  | ChoosePlayersPrompt;

export type PromptAnswer =
  | { kind: "pass" }
  | { kind: "card"; cardID: string }
  | { kind: "option"; choice: string }
  | { kind: "bagua" }
  | { kind: "serpent-spear"; cardIDs: [string, string] }
  | { kind: "zone-cards"; choices: ZoneCardChoice[] }
  | { kind: "harvest"; cardID: string }
  | { kind: "players"; playerIDs: PlayerID[] }
  | { kind: "summon" };

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
      as: "slash" | "snatch" | "indulgence";
      targetIDs: PlayerID[];
    };

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

export type GameEffect =
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
  | OptionalSkillEffect;

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

export interface GameWinner {
  side: "lord" | "rebel" | "renegade";
  playerIDs: PlayerID[];
  reason: string;
}

export interface GameLogEntry {
  id: number;
  message: string;
}

export interface TqsGameState {
  rulesVersion: "standard-2013-v2";
  status: "lord-selection" | "general-selection" | "playing" | "ended";
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
  deck: string[];
}

export interface TqsSetupOptions {
  numPlayers: number;
  roleVariant?: "standard" | "double-renegade";
}

export type Shuffle = <T>(items: T[]) => T[];
