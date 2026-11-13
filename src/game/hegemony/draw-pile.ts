import type { CardResourceGame } from "./card-resources";
import { readSlashInteger } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
  OperationFrame,
  TriggerPrompt,
  TriggerFrame,
} from "./scheduler";

export interface DrawPileGame extends CardResourceGame {
  pileRandom: { algorithm: "mulberry32-v1"; state: number };
}
export interface DrawPileRules {
  drawZone: string;
  reservedZone: string;
  discardZone: string;
  swappingLimit?: number;
  notify: (
    notice: { kind: "reset-pile" } | { kind: "update-pile"; count: number },
  ) => TriggerOperation | null;
}
function batchInput(data: TriggerData) {
  const fromUp = fromTop(data);
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    (data.updatePileNumber !== undefined &&
      typeof data.updatePileNumber !== "boolean")
  )
    throw new Error("Invalid get-n-cards request");
  return {
    count: readSlashInteger(data.count),
    fromUp,
    updatePileNumber: data.updatePileNumber !== false,
  };
}
function savePileFrame(
  game: DrawPileGame,
  rules: DrawPileRules,
  frame: Readonly<OperationFrame>,
  prompt: Readonly<TriggerPrompt> | null,
) {
  piles(game, rules);
  if (prompt || frame.cleanup || frame.answer !== null)
    throw new Error("Invalid pile saved boundary");
}
function reservedIds(
  game: DrawPileGame,
  rules: DrawPileRules,
  value: unknown,
): number[] {
  const reserved = piles(game, rules).reserved.cards;
  if (
    !Array.isArray(value) ||
    new Set(value).size !== value.length ||
    value.some(
      (id) => !Number.isSafeInteger(id) || id < 0 || !reserved.includes(id),
    )
  )
    throw new Error("Invalid reserved draw IDs");
  return value;
}
function pileChild(
  frame: Readonly<OperationFrame>,
  child: Readonly<OperationFrame | TriggerFrame> | null | undefined,
  expected: string | null | undefined,
  abandoning: boolean,
) {
  if (
    frame.child !== null ||
    (expected !== null && !abandoning && !child && !frame.operationChild) ||
    (expected === null && (child || frame.operationChild)) ||
    (child &&
      (child.kind !== "operation" ||
        (expected !== undefined && child.operation.name !== expected))) ||
    (frame.operationChild &&
      expected !== undefined &&
      frame.operationChild.operation.name !== expected)
  )
    throw new Error("Invalid saved pile child");
  return child?.kind === "operation"
    ? child.operation
    : frame.operationChild?.operation;
}
export function createGetNCardsOperation<G extends DrawPileGame>(
  rules: DrawPileRules,
): OperationHandler<G> {
  type Cursor = ReturnType<typeof batchInput> & {
    stage: "begin" | "drawing" | "drawn" | "noticed" | "terminal";
    ids: number[];
  };
  return {
    name: "get-n-cards",
    validateSave: (game, frame, _interruption, prompt, state) => {
      const child = state?.child;
      savePileFrame(game, rules, frame, prompt);
      const input = batchInput(frame.operation.data),
        c = frame.continuation;
      if (c === null) {
        pileChild(frame, child, null, state?.abandoning === true);
        return;
      }
      if (
        typeof c !== "object" ||
        Array.isArray(c) ||
        typeof c.stage !== "string" ||
        !["drawing", "drawn", "noticed", "terminal"].includes(c.stage) ||
        c.count !== input.count ||
        c.fromUp !== input.fromUp ||
        c.updatePileNumber !== input.updatePileNumber ||
        (c.stage === "noticed" && !input.updatePileNumber)
      )
        throw new Error("Invalid batch draw cursor");
      const ids = reservedIds(game, rules, c.ids);
      if (
        ids.length > Math.max(0, input.count) ||
        (c.stage === "noticed"
          ? ids.length !== Math.max(0, input.count)
          : c.stage === "drawn"
            ? ids.length >= input.count
            : ids.length !== 0)
      )
        throw new Error("Invalid batch draw progress");
      if (c.stage === "terminal") {
        const { draw, discard } = piles(game, rules);
        if (input.count <= draw.cards.length + discard.cards.length)
          throw new Error("Invalid batch exhaustion condition");
      }
      const next = pileChild(
        frame,
        child,
        c.stage === "drawn"
          ? "draw-card"
          : c.stage === "drawing"
            ? "swap-pile"
            : c.stage === "terminal"
              ? "game-over"
              : undefined,
        state?.abandoning === true,
      );
      if (
        (c.stage === "drawn" && next && fromTop(next.data) !== c.fromUp) ||
        (c.stage === "drawn" &&
          frame.operationChild &&
          ids.includes(Number(frame.operationChild.value))) ||
        (c.stage === "terminal" && next && next.data !== ".")
      )
        throw new Error("Invalid batch draw child input");
    },
    validateResult: (game, result) => {
      const input = batchInput(result.operation.data);
      if (
        reservedIds(game, rules, result.value).length !==
        Math.max(0, input.count)
      )
        throw new Error("Invalid batch draw completion");
    },
    validate: (game, operation) => {
      batchInput(operation.data);
      piles(game, rules);
    },
    run: ({ game, operation, continuation, operationChild }): OperationStep => {
      const cursor: Cursor =
        continuation === null
          ? { ...batchInput(operation.data), stage: "begin", ids: [] }
          : (structuredClone(continuation) as Cursor);
      if (cursor.stage === "terminal")
        throw new Error("Game-over operation must interrupt");
      if (cursor.stage === "noticed")
        return { kind: "return", value: cursor.ids };
      if (cursor.stage === "begin") {
        const { draw, discard } = piles(game, rules);
        cursor.stage = "drawing";
        if (cursor.count > draw.cards.length) {
          if (cursor.count > draw.cards.length + discard.cards.length) {
            cursor.stage = "terminal";
            return {
              kind: "operation",
              operation: { name: "game-over", data: "." },
              continuation: cursor,
            };
          }
          return {
            kind: "operation",
            operation: { name: "swap-pile", data: null },
            continuation: cursor,
          };
        }
      }
      if (cursor.stage === "drawn") {
        const id = operationChild?.value;
        if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0)
          throw new Error("Invalid batch draw result");
        cursor.ids.push(id);
        cursor.stage = "drawing";
      }
      if (cursor.ids.length < cursor.count) {
        cursor.stage = "drawn";
        return {
          kind: "operation",
          operation: { name: "draw-card", data: { fromUp: cursor.fromUp } },
          continuation: cursor,
        };
      }
      cursor.stage = "noticed";
      if (cursor.updatePileNumber) {
        const next = rules.notify({
          kind: "update-pile",
          count: piles(game, rules).draw.cards.length,
        });
        if (next)
          return { kind: "operation", operation: next, continuation: cursor };
      }
      return { kind: "return", value: cursor.ids };
    },
  };
}
function roomTags(game: DrawPileGame) {
  const tags = game.cardResources?.roomTags;
  if (!tags || typeof tags !== "object" || Array.isArray(tags))
    throw new Error("Invalid draw pile room tags");
  return tags;
}
function randomInteger(game: DrawPileGame): number {
  const random = game.pileRandom;
  if (
    !random ||
    random.algorithm !== "mulberry32-v1" ||
    !Number.isInteger(random.state) ||
    random.state < 0 ||
    random.state > 0xffffffff
  )
    throw new Error("Invalid draw pile RNG");
  random.state = (random.state + 0x6d2b79f5) >>> 0;
  let value = random.state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) >>> 1;
}
/** Native forward modulo shuffle over a caller-owned available card list. */
export function shufflePileCards(game: DrawPileGame, cards: number[]): void {
  for (let i = 0; i < cards.length; i++) {
    const r = (randomInteger(game) % (cards.length - i)) + i;
    [cards[i], cards[r]] = [cards[r], cards[i]];
  }
}
export function createSwapPileOperation<G extends DrawPileGame>(
  rules: DrawPileRules,
): OperationHandler<G> {
  return {
    name: "swap-pile",
    validateSave: (game, frame, _interruption, prompt, state) => {
      const child = state?.child;
      savePileFrame(game, rules, frame, prompt);
      readSlashInteger(roomTags(game).SwapPile, 0);
      readSlashInteger(rules.swappingLimit, 5);
      if (
        ![null, 1, 2, "terminal"].includes(
          frame.continuation as number | string | null,
        )
      )
        throw new Error("Invalid swap-pile cursor");
      if (frame.continuation === "terminal") {
        const { draw, discard } = piles(game, rules);
        const limit = readSlashInteger(
          readSlashInteger(rules.swappingLimit, 5) + 1,
        );
        if (
          (draw.cards.length || discard.cards.length) &&
          !(limit > 0 && roomTags(game).SwapPile === limit)
        )
          throw new Error("Invalid swap terminal condition");
      }
      const next = pileChild(
        frame,
        child,
        frame.continuation === null
          ? null
          : frame.continuation === "terminal"
            ? "game-over"
            : undefined,
        state?.abandoning === true,
      );
      if (frame.continuation === "terminal" && next && next.data !== ".")
        throw new Error("Invalid swap terminal child");
    },
    validateResult: (_game, result) => {
      if (result.value !== null) throw new Error("Invalid swap-pile result");
    },
    validate: (game) => {
      piles(game, rules);
      roomTags(game);
      readSlashInteger(rules.swappingLimit, 5);
    },
    run: ({ game, continuation }) => {
      if (continuation === "terminal")
        throw new Error("Game-over operation must interrupt");
      if (continuation === null) {
        const { draw, discard } = piles(game, rules),
          tags = roomTags(game);
        if (!draw.cards.length && !discard.cards.length)
          return {
            kind: "operation",
            operation: { name: "game-over", data: "." },
            continuation: "terminal",
          };
        const times = readSlashInteger(readSlashInteger(tags.SwapPile, 0) + 1),
          limit = readSlashInteger(
            readSlashInteger(rules.swappingLimit, 5) + 1,
          );
        tags.SwapPile = times;
        if (limit > 0 && times === limit)
          return {
            kind: "operation",
            operation: { name: "game-over", data: "." },
            continuation: "terminal",
          };
        const shuffled = [...discard.cards];
        shufflePileCards(game, shuffled);
        draw.cards.push(...shuffled);
        discard.cards = [];
        const next = rules.notify({ kind: "reset-pile" });
        if (next)
          return { kind: "operation", operation: next, continuation: 1 };
      }
      if (continuation === null || continuation === 1) {
        const next = rules.notify({
          kind: "update-pile",
          count: piles(game, rules).draw.cards.length,
        });
        if (next)
          return { kind: "operation", operation: next, continuation: 2 };
      }
      return { kind: "return", value: null };
    },
  };
}
function piles(
  game: DrawPileGame,
  rules: Pick<DrawPileRules, "drawZone" | "reservedZone" | "discardZone">,
) {
  const keys = [rules.drawZone, rules.reservedZone, rules.discardZone];
  if (new Set(keys).size !== 3) throw new Error("Overlapping draw pile zones");
  const zones = keys.map((key, index) => {
    const zone = game.cardZones[key];
    if (
      !zone ||
      zone.owner !== null ||
      zone.place !== (index === 2 ? "discard" : "draw") ||
      !Array.isArray(zone.cards) ||
      zone.cards.some((id) => !Number.isSafeInteger(id) || id < 0)
    )
      throw new Error("Invalid draw pile zone");
    return zone;
  });
  const ids = new Set<number>();
  for (const zone of zones)
    for (const id of zone.cards) {
      if (
        ids.has(id) ||
        Object.values(game.cardZones).filter((zone) => zone.cards.includes(id))
          .length !== 1
      )
        throw new Error("Duplicate draw pile card");
      ids.add(id);
    }
  return { draw: zones[0], reserved: zones[1], discard: zones[2] };
}
export { piles as readDrawPiles };
function fromTop(data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    (data.fromUp !== undefined && typeof data.fromUp !== "boolean")
  )
    throw new Error("Invalid draw-card request");
  return data.fromUp !== false;
}
export function createDrawCardOperation<G extends DrawPileGame>(
  rules: DrawPileRules,
): OperationHandler<G> {
  return {
    name: "draw-card",
    validateSave: (game, frame, _interruption, prompt, state) => {
      const child = state?.child;
      savePileFrame(game, rules, frame, prompt);
      fromTop(frame.operation.data);
      if (![null, 1, 2].includes(frame.continuation as number | null))
        throw new Error("Invalid draw-card cursor");
      if (frame.continuation === 1) {
        if (
          frame.operationChild ||
          (!state?.abandoning && !child && !frame.child) ||
          (child && child.kind !== "event")
        )
          throw new Error("Invalid Fetch child");
        const event =
          child?.kind === "event" ? child.event : frame.child?.event;
        if (
          event &&
          (event.name !== "FetchDrawPileCard" ||
            event.target !== null ||
            event.data !== null)
        )
          throw new Error("Invalid Fetch event");
      } else
        pileChild(
          frame,
          child,
          frame.continuation === null ? null : "swap-pile",
          state?.abandoning === true,
        );
    },
    validateResult: (game, result) => {
      fromTop(result.operation.data);
      reservedIds(game, rules, [result.value]);
    },
    validate: (game, operation) => {
      fromTop(operation.data);
      piles(game, rules);
    },
    run: ({ game, operation, continuation }) => {
      if (continuation === null)
        return {
          kind: "event",
          event: { name: "FetchDrawPileCard", target: null, data: null },
          continuation: 1,
        };
      const { draw, reserved } = piles(game, rules);
      if (!draw.cards.length && continuation === 1)
        return {
          kind: "operation",
          operation: { name: "swap-pile", data: null },
          continuation: 2,
        };
      if (!draw.cards.length)
        throw new Error("Draw pile exhausted after recycling");
      const id = fromTop(operation.data)
        ? draw.cards.shift()!
        : draw.cards.pop()!;
      reserved.cards.push(id);
      return { kind: "return", value: id };
    },
  };
}
