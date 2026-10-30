import { readDeathIdentity } from "./death";
import { dyingPlayer } from "./dying";
import {
  applyShownGeneralIdentity,
  applyHiddenGeneralIdentity,
  generalDefinition,
  hasShownGeneral,
  type GeneralGame,
} from "./general-identity";
import { readRecipientFlags } from "./card-effect";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export interface GeneralRules<G extends GeneralGame> {
  canShow: (game: G, target: string, head: boolean) => boolean;
  preshow: (
    target: string,
    head: boolean,
    enabled: boolean,
  ) => TriggerOperation;
  /** Gender/property notifications AND the change method's initial refilter. */
  change: (target: string, head: boolean, name: string) => TriggerOperation;
  /** Skill sharing/disconnect, limited marks, Duanchang and skin notifications. */
  skills: (target: string, head: boolean, shown: boolean) => TriggerOperation;
  notify: (
    target: string,
    head: boolean,
    shown: boolean,
    sendLog: boolean,
  ) => TriggerOperation;
  filter: (target: string) => TriggerOperation;
}
function input(game: GeneralGame, data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid general input");
  const target = dyingPlayer(game, data.target);
  const flag = (name: string) => {
    const value = data[name] === undefined ? true : data[name];
    if (typeof value !== "boolean") throw new Error("Invalid general flag");
    return value;
  };
  return {
    target,
    head: flag("head"),
    triggerEvent: flag("triggerEvent"),
    sendLog: flag("sendLog"),
    ignoreRule: flag("ignoreRule"),
  };
}
function displayed(game: GeneralGame, target: string) {
  const names = game.displayedGenerals?.[target];
  if (
    !names ||
    typeof names.head !== "string" ||
    typeof names.deputy !== "string"
  )
    throw new Error("Invalid displayed generals");
  return names;
}
type Cursor = ReturnType<typeof input> & {
  stage:
    | "preshown"
    | "changed"
    | "skills"
    | "notified"
    | "event"
    | "filtered"
    | "finished";
  name: string;
  first: boolean;
};
function runShow<G extends GeneralGame>(
  { game, operation, continuation }: OperationContext<G>,
  rules: GeneralRules<G>,
): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const request = input(game, operation.data),
      names = game.generalNames?.[request.target];
    if (!Array.isArray(names) || names.some((n) => typeof n !== "string"))
      throw new Error("Invalid actual general names");
    if (names.length === 0) return { kind: "return", value: null };
    const first = !hasShownGeneral(game, request.target);
    if (!request.ignoreRule) {
      const allowed = rules.canShow(
        structuredClone(game),
        request.target,
        request.head,
      );
      if (typeof allowed !== "boolean")
        throw new Error("Invalid canShow result");
      if (!allowed) return { kind: "return", value: null };
    }
    const slot = request.head ? "head" : "deputy";
    if (displayed(game, request.target)[slot] !== "anjiang")
      return { kind: "return", value: null };
    const name = names[request.head ? 0 : 1];
    if (typeof name !== "string") throw new Error("Missing actual general");
    generalDefinition(game, name);
    cursor = { ...request, name, first, stage: "preshown" };
    return {
      kind: "operation",
      operation: rules.preshow(cursor.target, cursor.head, true),
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as Cursor;
  if (cursor.stage === "preshown") {
    readDeathIdentity(game, cursor.target);
    const identity = game.identities[cursor.target];
    if (cursor.head) identity.headShown = true;
    else identity.deputyShown = true;
    displayed(game, cursor.target)[cursor.head ? "head" : "deputy"] =
      cursor.name;
    if (cursor.head)
      identity.generalLord = generalDefinition(game, cursor.name).lord;
    cursor.stage = "changed";
    return {
      kind: "operation",
      operation: rules.change(cursor.target, cursor.head, cursor.name),
      continuation: cursor,
    };
  }
  if (cursor.stage === "changed") {
    cursor.stage = "skills";
    return {
      kind: "operation",
      operation: rules.skills(cursor.target, cursor.head, true),
      continuation: cursor,
    };
  }
  if (cursor.stage === "skills") {
    applyShownGeneralIdentity(game, cursor.target, cursor.head, cursor.first);
    hasShownGeneral(game, cursor.target);
    game.scenarioRoleShown[cursor.target] = true;
    cursor.stage = "notified";
    return {
      kind: "operation",
      operation: rules.notify(cursor.target, cursor.head, true, cursor.sendLog),
      continuation: cursor,
    };
  }
  if (cursor.stage === "notified") {
    cursor.stage = "event";
    return {
      kind: "event",
      event: {
        name: cursor.triggerEvent ? "GeneralShown" : "DFDebut",
        target: cursor.target,
        data: cursor.triggerEvent ? cursor.head : null,
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "event") {
    cursor.stage = "filtered";
    return {
      kind: "operation",
      operation: rules.filter(cursor.target),
      continuation: cursor,
    };
  }
  return { kind: "return", value: null };
}
export function createShowGeneralOperation<G extends GeneralGame>(
  rules: GeneralRules<G>,
): OperationHandler<G> {
  return {
    name: "show-general",
    validate: (game, operation) => {
      input(game, operation.data);
    },
    run: (context) => runShow(context, rules),
  };
}
function runHide<G extends GeneralGame>(
  { game, operation, continuation }: OperationContext<G>,
  rules: GeneralRules<G>,
): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const request = input(game, operation.data);
    if (
      displayed(game, request.target)[request.head ? "head" : "deputy"] ===
      "anjiang"
    )
      return { kind: "return", value: null };
    readDeathIdentity(game, request.target);
    generalDefinition(game, "anjiang");
    const flags = readRecipientFlags(game, request.target);
    if (!flags.includes("hiding")) flags.push("hiding");
    game.playerFlags[request.target] = flags;
    cursor = { ...request, name: "anjiang", first: false, stage: "preshown" };
    return {
      kind: "operation",
      operation: rules.preshow(cursor.target, cursor.head, false),
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as Cursor;
  if (cursor.stage === "preshown") {
    readDeathIdentity(game, cursor.target);
    const identity = game.identities[cursor.target];
    if (cursor.head) identity.headShown = false;
    else identity.deputyShown = false;
    game.playerFlags[cursor.target] = readRecipientFlags(
      game,
      cursor.target,
    ).filter((flag) => flag !== "hiding");
    displayed(game, cursor.target)[cursor.head ? "head" : "deputy"] = "anjiang";
    if (cursor.head)
      identity.generalLord = generalDefinition(game, "anjiang").lord;
    cursor.stage = "changed";
    return {
      kind: "operation",
      operation: rules.change(cursor.target, cursor.head, "anjiang"),
      continuation: cursor,
    };
  }
  if (cursor.stage === "changed") {
    cursor.stage = "skills";
    return {
      kind: "operation",
      operation: rules.skills(cursor.target, cursor.head, false),
      continuation: cursor,
    };
  }
  if (cursor.stage === "skills") {
    applyHiddenGeneralIdentity(game, cursor.target, cursor.head);
    cursor.stage = "notified";
    return {
      kind: "operation",
      operation: rules.notify(cursor.target, cursor.head, false, true),
      continuation: cursor,
    };
  }
  if (cursor.stage === "notified") {
    cursor.stage = "event";
    return {
      kind: "event",
      event: {
        name: "GeneralHidden",
        target: cursor.target,
        data: cursor.head,
      },
      continuation: cursor,
    };
  }
  if (cursor.stage === "event") {
    cursor.stage = "filtered";
    return {
      kind: "operation",
      operation: rules.filter(cursor.target),
      continuation: cursor,
    };
  }
  if (cursor.stage === "filtered") {
    cursor.stage = "finished";
    return {
      kind: "operation",
      operation: rules.preshow(cursor.target, cursor.head, true),
      continuation: cursor,
    };
  }
  return { kind: "return", value: null };
}
export function createHideGeneralOperation<G extends GeneralGame>(
  rules: GeneralRules<G>,
): OperationHandler<G> {
  return {
    name: "hide-general",
    validate: (game, operation) => {
      input(game, operation.data);
    },
    run: (context) => runHide(context, rules),
  };
}
