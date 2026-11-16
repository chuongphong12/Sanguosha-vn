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
  /** Opt-in versioned kill snapshot; never invoke the live kill mapper on read. */
  validateKillSave?: (
    target: string,
    operation: Readonly<TriggerOperation>,
  ) => void;
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
  killTarget?: string;
};
function runFree<G extends FreeChainGame>(
  { game, continuation }: OperationContext<G>,
  rules: FreeChainRules<G>,
  saveKills = false,
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
    if (target !== null && readSlashAlive(game, target)) {
      if (saveKills) cursor.killTarget = target;
      return {
        kind: "operation",
        operation: rules.kill(target),
        continuation: cursor,
      };
    }
  }
  if (saveKills) delete cursor.killTarget;
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
  const validateKillSave = rules.validateKillSave;
  return {
    name: "free-chain",
    ...(validateKillSave
      ? {
          validateSave: ((game, frame, _interruption, prompt, state) => {
            const c = frame.continuation,
              child = state?.child;
            if (prompt || frame.answer !== null || frame.cleanup)
              throw new Error("Invalid saved free-chain boundary");
            const roster = players(game);
            if (c === null) {
              surrender(game);
              if (child || frame.child || frame.operationChild)
                throw new Error("Invalid initial free-chain child");
              return;
            }
            if (
              typeof c !== "object" ||
              Array.isArray(c) ||
              (c.stage !== "showed" && c.stage !== "killed") ||
              Object.keys(c).length !== (c.stage === "killed" ? 5 : 4) ||
              !Array.isArray(c.players) ||
              !Array.isArray(c.shown)
            )
              throw new Error("Invalid saved free-chain cursor");
            if (c.players.length === 0) {
              if (
                c.stage !== "killed" ||
                c.target !== "" ||
                c.shown.length !== 0
              )
                throw new Error("Invalid initial kill cursor");
            } else if (
              JSON.stringify(c.players) !== JSON.stringify(roster) ||
              typeof c.target !== "string" ||
              !roster.includes(c.target) ||
              ![["head"], ["deputy"], ["head", "deputy"]].some(
                (slots) => JSON.stringify(slots) === JSON.stringify(c.shown),
              )
            )
              throw new Error("Invalid captured reveal cursor");
            if (c.stage === "showed") {
              const event =
                child?.kind === "event" ? child.event : frame.child?.event;
              if (
                frame.operationChild ||
                (child && child.kind !== "event") ||
                (!event && !state?.abandoning) ||
                (event &&
                  (event.name !== "GeneralShowed" || event.target !== c.target))
              )
                throw new Error("Invalid saved reveal child");
            } else {
              const target = dyingPlayer(game, c.killTarget),
                operation =
                  child?.kind === "operation"
                    ? child.operation
                    : frame.operationChild?.operation;
              if (
                frame.child ||
                (child && child.kind !== "operation") ||
                (!operation && !state?.abandoning)
              )
                throw new Error("Invalid saved surrender child");
              if (operation) validateKillSave(target, operation);
            }
          }) satisfies NonNullable<OperationHandler<G>["validateSave"]>,
          validateResult: ((_game, result) => {
            if (result.value !== null)
              throw new Error("Invalid saved free-chain completion");
          }) satisfies NonNullable<OperationHandler<G>["validateResult"]>,
        }
      : {}),
    validate: (game) => {
      players(game);
      surrender(game);
    },
    run: (context) => runFree(context, rules, Boolean(validateKillSave)),
  };
}
