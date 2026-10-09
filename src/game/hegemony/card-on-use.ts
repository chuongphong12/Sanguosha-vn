import type { CardMovementGame } from "./movement";
import type {
  OperationContext,
  OperationHandler,
  OperationStep,
  TriggerData,
} from "./scheduler";

export interface CardOnUseRules {
  tableZone: string;
  discardZone: string;
}

export type CardUse = {
  from: string;
  to: string[];
  card: {
    type: "basic" | "trick" | "equip";
    name: string;
    className: string;
    skillName: string;
    materialIDs: number[];
    flags: string[];
  };
};
type Cursor = {
  stage: number;
  original: CardUse;
  afterPre: CardUse | null;
  use: CardUse;
};

function readUse(game: CardMovementGame, data: TriggerData): CardUse {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.from !== "string" ||
    !game.seatOrder.includes(data.from) ||
    !Array.isArray(data.to) ||
    data.to.some(
      (id) => typeof id !== "string" || !game.seatOrder.includes(id),
    ) ||
    new Set(data.to).size !== data.to.length ||
    !data.card ||
    typeof data.card !== "object" ||
    Array.isArray(data.card)
  )
    throw new Error("Invalid card use");
  const card = data.card;
  if (
    typeof card.type !== "string" ||
    !["basic", "trick", "equip"].includes(card.type) ||
    typeof card.name !== "string" ||
    !card.name ||
    typeof card.className !== "string" ||
    !card.className ||
    typeof card.skillName !== "string" ||
    !Array.isArray(card.materialIDs) ||
    card.materialIDs.some(
      (id) => typeof id !== "number" || !Number.isSafeInteger(id) || id < 0,
    ) ||
    new Set(card.materialIDs).size !== card.materialIDs.length ||
    !Array.isArray(card.flags) ||
    card.flags.some((flag) => typeof flag !== "string")
  )
    throw new Error("Invalid card use");
  return structuredClone(data) as CardUse;
}

function validateOnUse(
  game: CardMovementGame,
  data: TriggerData,
  currentActor: string | null,
  rules: CardOnUseRules,
): void {
  const use = readUse(game, data);
  if (currentActor !== null && !game.seatOrder.includes(currentActor))
    throw new Error("Unknown card use actor");
  for (const [key, place] of [
    [rules.tableZone, "table"],
    [rules.discardZone, "discard"],
  ]) {
    const zone = game.cardZones[key];
    if (
      !zone ||
      zone.place !== place ||
      zone.owner !== null ||
      !Array.isArray(zone.cards)
    )
      throw new Error("Invalid card use destination");
  }
  for (const id of use.card.materialIDs) {
    const count = Object.values(game.cardZones).reduce(
      (count, zone) => count + zone.cards.filter((card) => card === id).length,
      0,
    );
    if (count !== 1) throw new Error("Invalid card use material location");
  }
}

function useReason(
  use: CardUse,
  original: CardUse,
  cleanup: boolean,
): TriggerData {
  return {
    kind: "use",
    actor: original.from,
    skill: cleanup ? original.card.skillName : use.card.skillName,
    event: cleanup ? original.card.name : "",
    target: use.to.length === 1 ? use.to[0] : null,
    use: { ...use, cardClass: use.card.className },
  };
}

function runCardOnUse<G extends CardMovementGame>(
  { game, operation, currentActor, continuation, child }: OperationContext<G>,
  rules: CardOnUseRules,
): OperationStep {
  let cursor: Cursor;
  if (continuation === null) {
    const use = readUse(game, operation.data);
    const start =
      currentActor === null ? 0 : game.seatOrder.indexOf(currentActor);
    const order = [
      ...game.seatOrder.slice(start),
      ...game.seatOrder.slice(0, start),
    ];
    use.to.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    cursor = { stage: 0, original: structuredClone(use), afterPre: null, use };
  } else {
    cursor = structuredClone(continuation) as Cursor;
    if (child) cursor.use = readUse(game, child.event.data);
  }
  while (cursor.stage < 6) {
    const stage = cursor.stage++;
    if (stage === 1) {
      cursor.afterPre = structuredClone(cursor.use);
      return {
        kind: "operation",
        operation: {
          name: "move-cards",
          data: {
            moves: cursor.original.card.materialIDs.map((id) => ({
              ids: [id],
              to: rules.tableZone,
              open: true,
              reason: useReason(cursor.use, cursor.original, false),
            })),
            forceVisible: true,
          },
        },
        continuation: cursor,
      };
    }
    if (stage === 5) {
      const ids = cursor.original.card.materialIDs.filter((id) =>
        Object.values(game.cardZones).some(
          (zone) => zone.place === "table" && zone.cards.includes(id),
        ),
      );
      if (!ids.length) continue;
      return {
        kind: "operation",
        operation: {
          name: "move-cards",
          data: {
            moves: [
              {
                ids,
                to: rules.discardZone,
                open: true,
                reason: useReason(cursor.afterPre!, cursor.original, true),
              },
            ],
            forceVisible: true,
          },
        },
        continuation: cursor,
      };
    }
    if (
      stage === 2 &&
      cursor.original.card.flags.includes("slashDisableExtraTarget")
    )
      continue;
    const names: Record<number, string> = {
      0: "PreCardUsed",
      2: "TargetSelected",
      3: "CardUsed",
      4: "CardFinished",
    };
    return {
      kind: "event",
      event: {
        name: names[stage],
        target: cursor.original.from,
        data: cursor.use,
      },
      continuation: cursor,
    };
  }
  return { kind: "return", value: { data: cursor.use } };
}

/** Common onUse lifecycle only; legality, GameRule effects and unwind are adapters. */
export function createCardOnUseOperation<G extends CardMovementGame>(
  rules: CardOnUseRules,
): OperationHandler<G> {
  return {
    name: "card-on-use",
    validate: (game, operation, currentActor) =>
      validateOnUse(game, operation.data, currentActor, rules),
    run: (context) => runCardOnUse(context, rules),
  };
}
