import type { GeneralGame } from "./general-identity";
import { dyingPlayer } from "./dying";
import { generalMark, setGeneralMark } from "./general-rule";
import { readDeathIdentity, livingPlayers, deathOrder } from "./death";
import { readRecipientFlags } from "./card-effect";
import { handCount } from "./fill-hand";
import { readSlashInteger } from "./slash";
import type { CardUse } from "./card-on-use";
import { damageRoomTags } from "./damage";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export type RewardToken = "halfmaxhp" | "companion" | "firstshow" | "careerman";
function tokenInput(game: GeneralGame, data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.token !== "string" ||
    !["halfmaxhp", "companion", "firstshow", "careerman"].includes(data.token)
  )
    throw new Error("Invalid reward token input");
  return {
    player: dyingPlayer(game, data.player),
    token: data.token as RewardToken,
  };
}

export interface RewardTokenRules<G extends GeneralGame> {
  draw: (player: string, count: number, reason: string) => TriggerOperation;
  peachAvailable: (
    game: Readonly<G>,
    player: string,
    card: TokenPeach,
  ) => boolean;
  peachLocked: (game: Readonly<G>, player: string, card: TokenPeach) => boolean;
  peachProhibited: (
    game: Readonly<G>,
    player: string,
    target: string,
    card: TokenPeach,
  ) => boolean;
  usePeach: (
    use: Omit<CardUse, "card"> & { card: TokenPeach },
  ) => TriggerOperation;
  /** Returns an already normalized askForChoice result; owns native fallback/ChoiceMade. */
  choice: (request: TokenChoice) => TriggerOperation;
  choosePlayer: (request: {
    player: string;
    candidates: string[];
    skill: "careerman";
    prompt: string;
  }) => TriggerOperation;
  indicate: (player: string, target: string) => TriggerOperation;
  publicView: (notice: {
    player: string;
    target: string;
    slot: string;
    recipients: string[];
  }) => TriggerOperation;
  /** Requester-only delivery. Actual names must never enter a public notification. */
  privateView: (notice: {
    viewer: string;
    target: string;
    slot: string;
    names: string[];
    reason: "firstshow";
  }) => TriggerOperation;
}
export type TokenPeach = CardUse["card"] & { suit: "no-suit"; number: 0 };
export type TokenChoice = {
  player: string;
  skill: string;
  target: string | null;
  choices: string[];
  allChoices: string[];
  prompt: string;
};

export function createRewardTokenCostOperation<
  G extends GeneralGame,
>(): OperationHandler<G> {
  return {
    name: "reward-token-cost",
    validate: (game, operation) => {
      const { player, token } = tokenInput(game, operation.data);
      generalMark(
        game,
        player,
        token === "careerman" ? "@careerist" : `@${token}`,
      );
    },
    run: ({ game, operation }) => {
      const { player, token } = tokenInput(game, operation.data);
      const mark = token === "careerman" ? "@careerist" : `@${token}`;
      const count = generalMark(game, player, mark);
      if (count !== 0)
        setGeneralMark(
          game,
          player,
          mark,
          Math.max(0, readSlashInteger(count - 1)),
        );
      return { kind: "return", value: null };
    },
  };
}

function deputyPresent(game: GeneralGame, player: string) {
  const displayed = game.displayedGenerals?.[player];
  if (
    !displayed ||
    typeof displayed !== "object" ||
    Array.isArray(displayed) ||
    typeof displayed.deputy !== "string"
  )
    throw new Error("Invalid token deputy");
  return displayed.deputy !== "";
}
function allShown(game: GeneralGame, player: string) {
  const identity = readDeathIdentity(game, player);
  return (
    identity.headShown && (!deputyPresent(game, player) || identity.deputyShown)
  );
}
function hiddenPlayers(game: GeneralGame, player: string | null) {
  return livingPlayers(game).filter((p) => p !== player && !allShown(game, p));
}
function enabled(game: GeneralGame, data: TriggerData) {
  const { player, token } = tokenInput(game, data);
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.reason !== "string" ||
    typeof data.pattern !== "string"
  )
    throw new Error("Invalid token context");
  if (!["play", "response", "response-use", "unknown"].includes(data.reason))
    throw new Error("Invalid token use reason");
  const count = generalMark(
    game,
    player,
    token === "careerman" ? "@careerist" : `@${token}`,
  );
  if (data.reason === "play") {
    return (
      count > 0 &&
      (token !== "firstshow" ||
        handCount(game, player) < 4 ||
        hiddenPlayers(game, player).length > 0)
    );
  }
  if (
    data.reason === "unknown" ||
    token === "halfmaxhp" ||
    token === "firstshow"
  )
    return false;
  return (
    data.pattern.includes("peach") &&
    !readRecipientFlags(game, player).includes("Global_PreventPeach") &&
    count > 0
  );
}
/** Package enabled predicates only; generic phase/skill ownership gates are external. */
export function createRewardTokenEnabledOperation<
  G extends GeneralGame,
>(): OperationHandler<G> {
  return {
    name: "reward-token-enabled",
    validate: (game, operation) => {
      enabled(game, operation.data);
    },
    run: ({ game, operation }) => ({
      kind: "return",
      value: enabled(game, operation.data),
    }),
  };
}

export function createFirstShowTargetsOperation<
  G extends GeneralGame,
>(): OperationHandler<G> {
  function targets(game: G, data: TriggerData) {
    const input = useInput(game, data);
    if (
      input.token !== "firstshow" ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    )
      throw new Error("Invalid firstshow targets");
    const candidate =
      data.candidate === null ? null : dyingPlayer(game, data.candidate);
    return {
      filter:
        input.targets.length === 0 &&
        candidate !== null &&
        candidate !== input.player &&
        !allShown(game, candidate),
      feasible:
        input.targets.length ===
        (hiddenPlayers(game, input.player).length > 0 ? 1 : 0),
    };
  }
  return {
    name: "firstshow-targets",
    validate: (game, operation) => {
      targets(game, operation.data);
    },
    run: ({ game, operation }) => ({
      kind: "return",
      value: targets(game, operation.data),
    }),
  };
}

function useInput(game: GeneralGame, data: TriggerData) {
  const input = tokenInput(game, data);
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !Array.isArray(data.targets) ||
    data.targets.some(
      (p) => typeof p !== "string" || !game.seatOrder.includes(p),
    ) ||
    new Set(data.targets).size !== data.targets.length
  )
    throw new Error("Invalid reward token targets");
  return { ...input, targets: [...data.targets] as string[] };
}
function peach(token: RewardToken): TokenPeach {
  return {
    type: "basic",
    name: "peach",
    className: "Peach",
    skillName: `_${token}`,
    materialIDs: [],
    flags: [],
    suit: "no-suit",
    number: 0,
  };
}
function predicate(value: boolean) {
  if (typeof value !== "boolean") throw new Error("Invalid token predicate");
  return value;
}
function rescueTarget(game: GeneralGame) {
  const stack = damageRoomTags(game).CurrentDying;
  if (stack === undefined || stack === null) return null;
  if (!Array.isArray(stack) || stack.some((p) => typeof p !== "string"))
    throw new Error("Invalid token CurrentDying");
  const target = stack.at(-1);
  return typeof target === "string" && livingPlayers(game).includes(target)
    ? target
    : null;
}
type Cursor = {
  player: string;
  token: RewardToken;
  targets: string[];
  stage:
    "done" | "choice" | "filled" | "slot" | "public" | "target" | "indicated";
  choices: string[];
  target: string;
  slot: string;
};
function runToken<G extends GeneralGame>(
  { game, operation, continuation, operationChild }: OperationContext<G>,
  rules: RewardTokenRules<G>,
): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    cursor = {
      ...useInput(game, operation.data),
      stage: "done",
      choices: [],
      target: "",
      slot: "",
    };
    const { player, token } = cursor;
    if (token === "halfmaxhp")
      return {
        kind: "operation",
        operation: rules.draw(player, 1, token),
        continuation: cursor,
      };
    if (token === "firstshow") {
      cursor.stage = "filled";
      return {
        kind: "operation",
        operation: {
          name: "fill-hand",
          data: { target: player, count: 4, reason: "firstshow" },
        },
        continuation: cursor,
      };
    }
    const card = peach(token),
      target = rescueTarget(game);
    if (
      target !== null &&
      readRecipientFlags(game, target).includes("Global_Dying") &&
      !predicate(
        rules.peachLocked(structuredClone(game), player, structuredClone(card)),
      ) &&
      !predicate(
        rules.peachProhibited(
          structuredClone(game),
          player,
          target,
          structuredClone(card),
        ),
      )
    ) {
      return {
        kind: "operation",
        operation: rules.usePeach({ from: player, to: [target], card }),
        continuation: cursor,
      };
    }
    const available = predicate(
      rules.peachAvailable(
        structuredClone(game),
        player,
        structuredClone(card),
      ),
    );
    if (token === "companion" && !available)
      return {
        kind: "operation",
        operation: rules.draw(player, 2, token),
        continuation: cursor,
      };
    cursor.stage = "choice";
    cursor.choices =
      token === "companion" ? ["peach", "draw"] : ["draw1card", "draw2cards"];
    if (token === "careerman") {
      if (available) cursor.choices.push("peach");
      if (handCount(game, player) < 4 || hiddenPlayers(game, null).length > 0)
        cursor.choices.push("firstshow");
    }
    return {
      kind: "operation",
      operation: rules.choice({
        player,
        skill: token,
        target: null,
        choices: [...cursor.choices],
        allChoices:
          token === "companion"
            ? ["peach", "draw"]
            : ["draw1card", "draw2cards", "peach", "firstshow"],
        prompt: `@${token}-choose`,
      }),
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as Cursor;
  if (cursor.stage === "filled") {
    if (cursor.targets.length === 0) return { kind: "return", value: null };
    cursor.target = cursor.targets[0];
    const identity = readDeathIdentity(game, cursor.target);
    cursor.choices = [];
    if (!identity.headShown) cursor.choices.push("head_general");
    if (deputyPresent(game, cursor.target) && !identity.deputyShown)
      cursor.choices.push("deputy_general");
    if (cursor.choices.length === 0) return { kind: "return", value: null };
    const flags = readRecipientFlags(game, cursor.target);
    if (!flags.includes("XianquTarget")) flags.push("XianquTarget");
    cursor.stage = "slot";
    return {
      kind: "operation",
      operation: rules.choice({
        player: cursor.player,
        skill: "firstshow_see",
        target: cursor.target,
        choices: [...cursor.choices],
        allChoices: ["head_general", "deputy_general"],
        prompt: `@firstshow-choose::${cursor.target}`,
      }),
      continuation: cursor,
    };
  }
  if (cursor.stage === "slot") {
    const answer = operationChild?.value;
    if (typeof answer !== "string" || !cursor.choices.includes(answer))
      throw new Error("Invalid normalized token choice");
    cursor.slot = answer;
    game.playerFlags[cursor.target] = readRecipientFlags(
      game,
      cursor.target,
    ).filter((flag) => flag !== "XianquTarget");
    cursor.stage = "public";
    return {
      kind: "operation",
      operation: rules.publicView({
        player: cursor.player,
        target: cursor.target,
        slot: answer,
        recipients: deathOrder(game).filter((p) => p !== cursor.player),
      }),
      continuation: cursor,
    };
  }
  if (cursor.stage === "public") {
    const names = game.generalNames?.[cursor.target];
    if (!Array.isArray(names) || names.some((name) => typeof name !== "string"))
      throw new Error("Invalid token actual names");
    const visible = [...names];
    visible.splice(cursor.slot === "head_general" ? 1 : 0, 1);
    cursor.stage = "done";
    return {
      kind: "operation",
      operation: rules.privateView({
        viewer: cursor.player,
        target: cursor.target,
        slot: cursor.slot,
        names: visible,
        reason: "firstshow",
      }),
      continuation: cursor,
    };
  }
  if (cursor.stage === "choice") {
    const answer = operationChild?.value;
    if (typeof answer !== "string" || !cursor.choices.includes(answer))
      throw new Error("Invalid normalized token choice");
    cursor.stage = "done";
    if (answer === "firstshow") {
      cursor.targets = hiddenPlayers(game, null);
      if (cursor.targets.length === 0)
        return {
          kind: "operation",
          operation: {
            name: "reward-token-use",
            data: { player: cursor.player, token: "firstshow", targets: [] },
          },
          continuation: cursor,
        };
      cursor.stage = "target";
      return {
        kind: "operation",
        operation: rules.choosePlayer({
          player: cursor.player,
          candidates: [...cursor.targets],
          skill: "careerman",
          prompt: "@careerman-target",
        }),
        continuation: cursor,
      };
    }
    return {
      kind: "operation",
      operation:
        answer === "peach"
          ? rules.usePeach({
              from: cursor.player,
              to: [cursor.player],
              card: peach(cursor.token),
            })
          : rules.draw(
              cursor.player,
              answer === "draw1card" ? 1 : 2,
              cursor.token,
            ),
      continuation: cursor,
    };
  }
  if (cursor.stage === "target") {
    const target = operationChild?.value;
    if (typeof target !== "string" || !cursor.targets.includes(target))
      throw new Error("Invalid normalized token target");
    cursor.target = target;
    cursor.stage = "indicated";
    return {
      kind: "operation",
      operation: rules.indicate(cursor.player, target),
      continuation: cursor,
    };
  }
  if (cursor.stage === "indicated") {
    cursor.stage = "done";
    return {
      kind: "operation",
      operation: {
        name: "reward-token-use",
        data: {
          player: cursor.player,
          token: "firstshow",
          targets: [cursor.target],
        },
      },
      continuation: cursor,
    };
  }
  return { kind: "return", value: null };
}
/** Native SkillCard::use boundary; generic onUse and extraCost are separate. */
export function createRewardTokenUseOperation<G extends GeneralGame>(
  rules: RewardTokenRules<G>,
): OperationHandler<G> {
  return {
    name: "reward-token-use",
    validate: (game, operation) => {
      useInput(game, operation.data);
    },
    run: (context) => runToken(context, rules),
  };
}
