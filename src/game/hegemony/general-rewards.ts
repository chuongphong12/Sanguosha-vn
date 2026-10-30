import { readDeathIdentity } from "./death";
import { dyingPlayer } from "./dying";
import { generalDefinition, type GeneralGame } from "./general-identity";
import { addGeneralMark, generalMark, setGeneralMark } from "./general-rule";
import { readSlashAlive, readSlashInteger } from "./slash";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerOperation,
} from "./scheduler";

export interface FreeChainGame extends GeneralGame {
  surrenderPlayer: string | null;
  bianhuaChoice: Record<string, string | null>;
}
export interface FreeChainRules<G extends FreeChainGame> {
  kill: (target: string) => TriggerOperation;
  companion: (game: Readonly<G>, left: string, right: string) => boolean;
  maxHp: (game: Readonly<G>, name: string, head: boolean) => number;
}
function displayed(game: FreeChainGame, target: string) {
  const names = game.displayedGenerals?.[target];
  if (
    !names ||
    typeof names !== "object" ||
    Array.isArray(names) ||
    typeof names.head !== "string" ||
    typeof names.deputy !== "string"
  )
    throw new Error("Invalid reward generals");
  return { ...names };
}
function companion<G extends FreeChainGame>(
  game: G,
  target: string,
  left: string,
  right: string,
  rules: FreeChainRules<G>,
) {
  const result = rules.companion(structuredClone(game), left, right);
  if (typeof result !== "boolean")
    throw new Error("Invalid companion predicate");
  if (result) addGeneralMark(game, target, "@companion");
}
function award<G extends FreeChainGame>(
  game: G,
  target: string,
  shown: string[],
  rules: FreeChainRules<G>,
) {
  if (readSlashAlive(game, target)) {
    const identity = readDeathIdentity(game, target);
    if (identity.headShown) {
      const names = displayed(game, target);
      if (
        (!names.deputy || identity.deputyShown) &&
        generalMark(game, target, "Global_hasShownAllGenerals") === 0
      ) {
        addGeneralMark(game, target, "Global_hasShownAllGenerals");
        if (
          names.deputy &&
          !names.head.includes("sujiang") &&
          !names.deputy.includes("sujiang")
        ) {
          companion(game, target, names.head, names.deputy, rules);
          const choices = game.bianhuaChoice;
          if (!choices || typeof choices !== "object" || Array.isArray(choices))
            throw new Error("Invalid bianhua properties");
          const choice = choices[target];
          if (
            choice !== undefined &&
            choice !== null &&
            typeof choice !== "string"
          )
            throw new Error("Invalid bianhua choice");
          if (choice) companion(game, target, names.deputy, choice, rules);
          const head = readSlashInteger(
            rules.maxHp(structuredClone(game), names.head, true),
          );
          const deputy = readSlashInteger(
            rules.maxHp(structuredClone(game), names.deputy, false),
          );
          if (readSlashInteger(head + deputy) % 2 > 0)
            addGeneralMark(game, target, "@halfmaxhp");
        }
      }
    }
  }
  if (
    shown.includes("head") &&
    generalMark(game, target, "HaventShowGeneral") > 0
  ) {
    addGeneralMark(game, target, "HaventShowGeneral", -1);
    if (
      generalDefinition(game, displayed(game, target).head).kingdom ===
      "careerist"
    )
      addGeneralMark(game, target, "@careerist");
  }
  if (
    shown.includes("deputy") &&
    generalMark(game, target, "HaventShowGeneral2") > 0
  )
    addGeneralMark(game, target, "HaventShowGeneral2", -1);
  if (generalMark(game, target, "Global_TheFirstToShowRewarded") > 0) {
    addGeneralMark(game, target, "Global_TheFirstToShowRewarded", -1);
    addGeneralMark(game, target, "@firstshow");
  }
}
function surrender(game: FreeChainGame) {
  return game.surrenderPlayer === null
    ? null
    : dyingPlayer(game, game.surrenderPlayer);
}
function players(game: FreeChainGame) {
  if (
    !Array.isArray(game.seatOrder) ||
    new Set(game.seatOrder).size !== game.seatOrder.length ||
    game.seatOrder.some((p) => typeof p !== "string")
  )
    throw new Error("Invalid reward registration");
  return [...game.seatOrder];
}
type Cursor = {
  stage: "begin" | "killed" | "showed";
  players: string[];
  target: string;
  shown: string[];
};
function runFree<G extends FreeChainGame>(
  { game, continuation }: OperationContext<G>,
  rules: FreeChainRules<G>,
): OperationStep {
  const cursor: Cursor =
    continuation === null
      ? { stage: "begin", players: [], target: "", shown: [] }
      : (structuredClone(continuation) as Cursor);
  if (cursor.stage === "showed") {
    award(game, cursor.target, cursor.shown, rules);
    cursor.stage = "begin";
  }
  if (cursor.stage === "begin") {
    const target = surrender(game);
    cursor.stage = "killed";
    if (target !== null && readSlashAlive(game, target))
      return {
        kind: "operation",
        operation: rules.kill(target),
        continuation: cursor,
      };
  }
  cursor.players = players(game);
  for (const target of cursor.players) {
    const shown: string[] = [];
    if (generalMark(game, target, "Global_GeneralShown") > 0) {
      shown.push("head");
      setGeneralMark(game, target, "Global_GeneralShown", 0);
    }
    if (generalMark(game, target, "Global_General2Shown") > 0) {
      shown.push("deputy");
      setGeneralMark(game, target, "Global_General2Shown", 0);
    }
    if (shown.length > 0 && readSlashAlive(game, target)) {
      cursor.stage = "showed";
      cursor.target = target;
      cursor.shown = shown;
      return {
        kind: "event",
        event: { name: "GeneralShowed", target, data: [...shown] },
        continuation: cursor,
      };
    }
  }
  return { kind: "return", value: null };
}
export function createFreeChainOperation<G extends FreeChainGame>(
  rules: FreeChainRules<G>,
): OperationHandler<G> {
  return {
    name: "free-chain",
    validate: (game) => {
      players(game);
      surrender(game);
    },
    run: (context) => runFree(context, rules),
  };
}
