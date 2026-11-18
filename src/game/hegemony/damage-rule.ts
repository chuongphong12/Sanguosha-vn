import { readCardReference } from "./card-resources";
import { readRecipientFlags } from "./card-effect";
import {
  damageRoomTags,
  readDamage,
  type DamageGame,
  type Damage,
} from "./damage";
import { readSlashEffect, readSlashInteger, readSlashAlive } from "./slash";
import type {
  OperationContext,
  OperationStep,
  OperationHandler,
  TriggerData,
  TriggerSkill,
} from "./scheduler";

export function ruleInput(game: DamageGame, data: TriggerData) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid damage rule input");
  if (data.target === null) return null;
  if (typeof data.target !== "string" || !game.seatOrder.includes(data.target))
    throw new Error("Invalid damage rule target");
  return { target: data.target, data: data.data };
}
function slashHitInput(game: DamageGame, data: TriggerData) {
  const input = ruleInput(game, data);
  if (!input) return null;
  const effect = readSlashEffect(game, input.data);
  if (effect.slash === null) throw new Error("SlashHit requires a card");
  const { storage } = readCardReference(game, effect.slash.reference);
  const bonuses =
    storage.tags.AddDamage_List === undefined
      ? []
      : storage.tags.AddDamage_List;
  if (
    !Array.isArray(bonuses) ||
    bonuses.some((value) => typeof value !== "string")
  )
    throw new Error("Invalid AddDamage list");
  let amount = readSlashInteger(
    readSlashInteger(storage.tags.addcardinality, 0) + effect.drank,
  );
  amount = readSlashInteger(amount + 1);
  for (const player of bonuses)
    if (player === effect.to) amount = readSlashInteger(amount + 1);
  const damage: Damage = {
    from: effect.from,
    to: effect.to,
    card: effect.slash,
    damage: amount,
    nature: effect.nature,
    chain: false,
    transfer: false,
    by_user: true,
    reason: "",
    flags: [],
    transfer_reason: "",
    prevented: false,
  };
  return damage;
}
export function createSlashHitOperation<
  G extends DamageGame,
>(): OperationHandler<G> {
  return {
    name: "slash-hit",
    validate: (game, operation) => {
      slashHitInput(game, operation.data);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const damage = slashHitInput(game, operation.data);
      if (!damage) return { kind: "return", value: null };
      return {
        kind: "operation",
        operation: { name: "damage", data: damage },
        continuation: true,
      };
    },
  };
}
function ruleDataKey(value: TriggerData): string {
  if (Array.isArray(value)) return `[${value.map(ruleDataKey).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${ruleDataKey(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function damageRule<G extends DamageGame>(
  event: string,
  operation: string,
): TriggerSkill<G> {
  return {
    id: `game-rule-${operation}`,
    events: [event],
    priority: 0,
    rule: true,
    validateSave: (game, frame, prompt, state) => {
      for (const candidate of frame.candidates) {
        if (candidate.skill !== `game-rule-${operation}`) continue;
        if (
          candidate.actor !== null ||
          candidate.owner !== null ||
          candidate.slot !== null ||
          candidate.occurrence !== "rule" ||
          candidate.order !== undefined ||
          (frame.recorded &&
            frame.selected === null &&
            candidate.target !== frame.event.target) ||
          [
            candidate.compulsory,
            candidate.wake,
            candidate.global,
            candidate.shown,
            candidate.equipment,
            candidate.cardSkill,
          ].some((value) => value !== undefined)
        )
          throw Error("Invalid GameRule occurrence");
      }
      if (frame.selected?.skill !== `game-rule-${operation}`) return;
      const selected = frame.selected;
      if (
        selected.target !== frame.event.target ||
        !["cost", "effect"].includes(frame.stage) ||
        frame.continuation !== null ||
        frame.answer ||
        frame.child ||
        prompt ||
        (frame.event.target !== null &&
          !game.seatOrder.includes(frame.event.target))
      )
        throw Error("Invalid GameRule save");
      const child = state?.child;
      const pending =
        child?.kind === "operation"
          ? child.operation
          : frame.operationChild?.operation;
      if (child?.kind === "event") throw Error("Invalid GameRule child");
      if (!pending) return;
      const data = pending.data;
      if (
        frame.stage !== "effect" ||
        frame.event.name !== event ||
        frame.event.target === null ||
        pending.name !== operation ||
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.keys(data).length !== 2 ||
        data.target !== frame.event.target ||
        !("data" in data) ||
        ruleDataKey(data.data) !== ruleDataKey(frame.event.data)
      )
        throw Error("Invalid GameRule operation");
      if (frame.event.name === "DamageDone" && frame.operationChild) {
        const value = frame.operationChild.value;
        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          !("data" in value)
        )
          throw Error("Invalid DamageDone result");
      }
    },
    effect: ({ game, event, operationChild }) => {
      if (operationChild) {
        if (event.name === "DamageDone") {
          const value = operationChild.value;
          if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            !("data" in value)
          )
            throw new Error("Invalid DamageDone result");
          event.data = structuredClone(value.data);
        }
        return { kind: "done", value: false };
      }
      const tags = damageRoomTags(game);
      const skip = tags.SkipGameRule;
      if (skip !== undefined && typeof skip !== "boolean")
        throw new Error("Invalid SkipGameRule");
      if (skip === true) {
        delete tags.SkipGameRule;
        return { kind: "done", value: false };
      }
      if (event.target === null) return { kind: "done", value: false };
      return {
        kind: "operation",
        operation: {
          name: operation,
          data: { target: event.target, data: event.data },
        },
        continuation: null,
      };
    },
  };
}
export function createSlashHitRule<G extends DamageGame>(): TriggerSkill<G> {
  return damageRule("SlashHit", "slash-hit");
}
function chained(game: DamageGame, player: string): boolean {
  if (
    !Object.prototype.hasOwnProperty.call(game.chained, player) ||
    typeof game.chained[player] !== "boolean"
  )
    throw new Error("Invalid damage chained state");
  return game.chained[player];
}
function doneInput(game: DamageGame, data: TriggerData) {
  const input = ruleInput(game, data);
  if (!input) return null;
  const damage = readDamage(game, input.data);
  const hp = readSlashInteger(game.hp?.[input.target]);
  readSlashInteger(hp - damage.damage);
  chained(game, input.target);
  if (damage.from !== null) readSlashAlive(game, damage.from);
  return { target: input.target, damage };
}
type DoneCursor = {
  stage: number;
  target: string;
  local: Damage;
  shared: TriggerData;
};
function runDone<G extends DamageGame>({
  game,
  operation,
  continuation,
  child,
}: OperationContext<G>): OperationStep {
  let cursor: DoneCursor;
  if (continuation === null) {
    const input = doneInput(game, operation.data);
    if (!input) return { kind: "return", value: null };
    if (input.damage.from !== null && !readSlashAlive(game, input.damage.from))
      input.damage.from = null;
    cursor = {
      stage: 1,
      target: input.target,
      local: input.damage,
      shared: structuredClone(input.damage),
    };
    game.hp[cursor.target] = readSlashInteger(
      readSlashInteger(game.hp[cursor.target]) - cursor.local.damage,
    );
    return {
      kind: "event",
      event: { name: "HpChanged", target: cursor.target, data: null },
      continuation: cursor,
    };
  }
  cursor = structuredClone(continuation) as DoneCursor;
  if (cursor.stage === 1) {
    if (cursor.local.nature !== "normal" && chained(game, cursor.target)) {
      game.chained[cursor.target] = false;
      cursor.stage = 2;
      return {
        kind: "event",
        event: { name: "ChainStateChanged", target: cursor.target, data: null },
        continuation: cursor,
      };
    }
    cursor.stage = 3;
  }
  if (cursor.stage === 2) {
    if (!cursor.local.chain) {
      const tags = damageRoomTags(game);
      tags.is_chained = readSlashInteger(
        readSlashInteger(tags.is_chained, 0) + 1,
      );
    }
    cursor.stage = 3;
  }
  if (cursor.stage === 3) {
    cursor.stage = 4;
    return {
      kind: "event",
      event: {
        name: "PostHpReduced",
        target: cursor.target,
        data: cursor.shared,
      },
      continuation: cursor,
    };
  }
  if (child) cursor.shared = structuredClone(child.event.data);
  return { kind: "return", value: { data: cursor.shared } };
}
export function createDamageDoneOperation<
  G extends DamageGame,
>(): OperationHandler<G> {
  return {
    name: "damage-done",
    validate: (game, operation) => {
      doneInput(game, operation.data);
    },
    run: runDone,
  };
}
export function createDamageDoneRule<G extends DamageGame>(): TriggerSkill<G> {
  return damageRule("DamageDone", "damage-done");
}

export function allPlayers(game: DamageGame): string[] {
  if (game.currentPlayer === null) return [...game.seatOrder];
  const index = game.seatOrder.indexOf(game.currentPlayer);
  if (index < 0) throw new Error("Invalid damage current player");
  return [
    ...game.seatOrder.slice(index),
    ...game.seatOrder.slice(0, index),
  ].filter((player) => readSlashAlive(game, player));
}
function completeInput(game: DamageGame, data: TriggerData) {
  const input = ruleInput(game, data);
  if (!input) return null;
  const damage = readDamage(game, input.data);
  if (!damage.prevented) {
    const count = readSlashInteger(damageRoomTags(game).is_chained, 0);
    if (
      count > 0 &&
      damage.nature !== "normal" &&
      !damage.chain &&
      game.currentPlayer === null
    )
      throw new Error("Elemental fanout requires a current player");
    allPlayers(game);
  }
  return damage;
}
type CompleteCursor = {
  local: Damage;
  chainSeats: string[];
  chainIndex: number;
  debutSeats: string[] | null;
  debutIndex: number;
};
function runComplete<G extends DamageGame>({
  game,
  operation,
  continuation,
}: OperationContext<G>): OperationStep {
  let cursor: CompleteCursor;
  if (continuation === null) {
    const damage = completeInput(game, operation.data);
    if (!damage || damage.prevented) return { kind: "return", value: null };
    const tags = damageRoomTags(game);
    const count = readSlashInteger(tags.is_chained, 0);
    const fanout = count > 0 && damage.nature !== "normal" && !damage.chain;
    if (fanout) tags.is_chained = count - 1;
    cursor = {
      local: damage,
      chainSeats: fanout ? allPlayers(game) : [],
      chainIndex: 0,
      debutSeats: null,
      debutIndex: 0,
    };
  } else cursor = structuredClone(continuation) as CompleteCursor;
  while (cursor.chainIndex < cursor.chainSeats.length) {
    const player = cursor.chainSeats[cursor.chainIndex++];
    if (chained(game, player))
      return {
        kind: "operation",
        operation: {
          name: "damage",
          data: {
            ...structuredClone(cursor.local),
            to: player,
            chain: true,
            transfer: false,
            transfer_reason: "",
            flags: [],
          },
        },
        continuation: cursor,
      };
  }
  cursor.debutSeats ??= allPlayers(game);
  while (cursor.debutIndex < cursor.debutSeats.length) {
    const player = cursor.debutSeats[cursor.debutIndex++];
    const flags = readRecipientFlags(game, player);
    if (flags.includes("Global_DFDebut")) {
      game.playerFlags[player] = flags.filter(
        (flag) => flag !== "Global_DFDebut",
      );
      return {
        kind: "event",
        event: { name: "DFDebut", target: player, data: null },
        continuation: cursor,
      };
    }
  }
  return { kind: "return", value: null };
}
export function createDamageCompleteOperation<
  G extends DamageGame,
>(): OperationHandler<G> {
  return {
    name: "damage-complete",
    validate: (game, operation) => {
      completeInput(game, operation.data);
    },
    run: runComplete,
  };
}
export function createDamageCompleteRule<
  G extends DamageGame,
>(): TriggerSkill<G> {
  return damageRule("DamageComplete", "damage-complete");
}
