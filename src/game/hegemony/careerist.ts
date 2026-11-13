import { damageRoomTags } from "./damage";
import { rescueBoolean } from "./dying-rule";
import {
  deathOrder,
  livingPlayers,
  readDeathIdentity,
  type DeathGame,
} from "./death";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerOperation,
} from "./scheduler";

export interface CareeristGame extends DeathGame {
  /** Private authoritative scenario_role_shown properties, not a player projection. */
  scenarioRoleShown: Record<string, boolean>;
}
export interface CareeristRules<G extends CareeristGame = CareeristGame> {
  hasShown: (game: Readonly<G>, target: string) => boolean;
  /** Native showGeneral(head=true, trigger_event=false, sendLog=true, ignore_rule=true). */
  showHead: (target: string) => TriggerOperation;
}
function careeristPlayers(game: CareeristGame) {
  const living = livingPlayers(game);
  return deathOrder(game).filter((p) => living.includes(p));
}
type Cursor = {
  stage: "scan" | "shown" | "recruit" | "reply" | "filled" | "recovered";
  players: string[];
  index: number;
  leader: string;
  noGameOver: boolean;
  group: string;
  recruitIndex: number;
  candidate: string;
};
function runCareerist<G extends CareeristGame>(
  { game, continuation, operationChild }: OperationContext<G>,
  rules: CareeristRules<G>,
): OperationStep {
  const cursor: Cursor =
    continuation === null
      ? {
          stage: "scan",
          players: careeristPlayers(game),
          index: 0,
          leader: "",
          noGameOver: false,
          group: "",
          recruitIndex: 0,
          candidate: "",
        }
      : (structuredClone(continuation) as Cursor);
  if (cursor.stage === "shown") {
    damageRoomTags(game).GlobalCareeristShow = false;
    cursor.group = `careerist_${readDeathIdentity(game, cursor.leader).head}`;
    game.identities[cursor.leader].role = cursor.group;
    cursor.recruitIndex = 0;
    cursor.stage = cursor.players.length > 2 ? "recruit" : "scan";
  }
  if (cursor.stage === "reply") {
    if (typeof operationChild?.value !== "string")
      throw new Error("Invalid normalized careerist answer");
    if (operationChild.value === "yes") {
      const shown = game.scenarioRoleShown;
      if (
        !shown ||
        typeof shown !== "object" ||
        Array.isArray(shown) ||
        (shown[cursor.candidate] !== undefined &&
          typeof shown[cursor.candidate] !== "boolean")
      )
        throw new Error("Invalid scenario role properties");
      shown[cursor.candidate] = true;
      game.identities[cursor.candidate].role = cursor.group;
      cursor.stage = "scan";
    } else {
      cursor.stage = "filled";
      return {
        kind: "operation",
        operation: {
          name: "fill-hand",
          data: { target: cursor.candidate, count: 4 },
        },
        continuation: cursor,
      };
    }
  }
  if (cursor.stage === "filled") {
    cursor.stage = "recovered";
    return {
      kind: "operation",
      operation: {
        name: "recover",
        data: {
          target: cursor.candidate,
          data: { recover: 1, who: null, card: null },
        },
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "recovered") cursor.stage = "recruit";
  if (cursor.stage === "recruit") {
    while (cursor.recruitIndex < cursor.players.length) {
      const target = cursor.players[cursor.recruitIndex++],
        identity = readDeathIdentity(game, target);
      if (identity.role.startsWith("careerist") || identity.lord) continue;
      cursor.candidate = target;
      cursor.stage = "reply";
      return {
        kind: "operation",
        operation: {
          name: "careerist-choice",
          data: {
            target,
            leader: cursor.leader,
            choices:
              identity.headKingdom === "careerist" ? ["no"] : ["no", "yes"],
          },
        },
        continuation: cursor,
      };
    }
    cursor.stage = "scan";
  }
  while (cursor.index < cursor.players.length) {
    const player = cursor.players[cursor.index++],
      identity = readDeathIdentity(game, player);
    if (identity.headShown) continue;
    const seeming = !rescueBoolean(
      rules.hasShown(structuredClone(game), player),
    )
      ? ""
      : identity.role === "careerist" || identity.role.startsWith("careerist_")
        ? identity.role
        : identity.kingdom;
    if (seeming === "careerist" || identity.headKingdom !== "careerist")
      continue;
    cursor.noGameOver = true;
    cursor.leader = player;
    cursor.stage = "shown";
    damageRoomTags(game).GlobalCareeristShow = true;
    return {
      kind: "operation",
      operation: rules.showHead(player),
      continuation: cursor,
    };
  }
  return { kind: "return", value: cursor.noGameOver };
}
export function createCareeristOperation<G extends CareeristGame>(
  rules: CareeristRules<G>,
): OperationHandler<G> {
  return {
    name: "careerist-rule",
    validate: (game) => {
      careeristPlayers(game);
    },
    run: (context) => runCareerist(context, rules),
  };
}
