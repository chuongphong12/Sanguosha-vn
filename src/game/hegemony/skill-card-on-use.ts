import { readExecutionCardUse, type CardUse } from "./card-on-use";
import { readRecipientFlags, type CardEffectGame } from "./card-effect";
import type {
  OperationHandler,
  TriggerOperation,
  TriggerData,
} from "./scheduler";

export type SkillCardUse = Omit<CardUse, "card"> & {
  card: Omit<CardUse["card"], "type"> & {
    type: CardUse["card"]["type"] | "skill";
    skillPosition: string;
    showSkill: string;
    willThrow: boolean;
  };
};
export interface SkillCardOnUseRules<G extends CardEffectGame> {
  tableZone: string;
  discardZone: string;
  extraCost: (use: SkillCardUse) => TriggerOperation | null;
  showSkill: (request: {
    player: string;
    skill: string;
    position: string;
  }) => TriggerOperation;
  afterShow: (request: {
    player: string;
    use: SkillCardUse;
    original: SkillCardUse;
  }) => TriggerOperation;
  notifyUse: (request: {
    use: SkillCardUse;
    hidden: boolean;
  }) => TriggerOperation;
  generalName: (game: Readonly<G>, player: string, position: string) => string;
  cardState: (
    game: Readonly<G>,
    card: SkillCardUse["card"],
  ) => { flags: string[]; materialIDs: number[] };
}

function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}
function materials(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((id) => Number.isSafeInteger(id) && id >= 0) &&
    new Set(value).size === value.length
  );
}
function readUse(game: CardEffectGame, data: TriggerData): SkillCardUse {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.from !== "string" ||
    !game.seatOrder.includes(data.from) ||
    !strings(data.to) ||
    data.to.some((id) => !game.seatOrder.includes(id)) ||
    new Set(data.to).size !== data.to.length ||
    !data.card ||
    typeof data.card !== "object" ||
    Array.isArray(data.card)
  )
    throw new Error("Invalid SkillCard use");
  const card = data.card;
  if (
    typeof card.type !== "string" ||
    !["skill", "basic", "trick", "equip"].includes(card.type) ||
    typeof card.name !== "string" ||
    !card.name ||
    typeof card.className !== "string" ||
    !card.className ||
    typeof card.skillName !== "string" ||
    typeof card.skillPosition !== "string" ||
    typeof card.showSkill !== "string" ||
    typeof card.willThrow !== "boolean" ||
    !materials(card.materialIDs) ||
    !strings(card.flags)
  )
    throw new Error("Invalid SkillCard descriptor");
  return structuredClone(data) as SkillCardUse;
}
function destination(
  game: CardEffectGame,
  key: string,
  place: "table" | "discard",
) {
  const zone = game.cardZones[key];
  if (
    !zone ||
    zone.place !== place ||
    zone.owner !== null ||
    !materials(zone.cards)
  )
    throw new Error("Invalid SkillCard destination");
}
function physicalMaterials(game: CardEffectGame, ids: number[]) {
  if (
    ids.some(
      (id) =>
        Object.values(game.cardZones).reduce(
          (count, zone) =>
            count + zone.cards.filter((card) => card === id).length,
          0,
        ) !== 1,
    )
  )
    throw new Error("Invalid SkillCard material location");
}
function roomTags(game: CardEffectGame) {
  const tags = game.cardResources?.roomTags;
  if (!tags || typeof tags !== "object" || Array.isArray(tags))
    throw new Error("Invalid SkillCard room tags");
  return tags;
}
function cardState<G extends CardEffectGame>(
  game: G,
  card: SkillCardUse["card"],
  rules: SkillCardOnUseRules<G>,
) {
  const state = rules.cardState(structuredClone(game), structuredClone(card));
  if (!state || !strings(state.flags) || !materials(state.materialIDs))
    throw new Error("Invalid SkillCard state");
  return structuredClone(state);
}
function generalName<G extends CardEffectGame>(
  game: G,
  player: string,
  position: string,
  rules: Pick<SkillCardOnUseRules<G>, "generalName">,
) {
  const name = position
    ? rules.generalName(structuredClone(game), player, position)
    : "";
  if (typeof name !== "string")
    throw new Error("Invalid SkillCard general name");
  return name;
}

function positions(game: CardEffectGame, use: SkillCardUse, player: string) {
  const tags = roomTags(game);
  const key = `${use.card.skillName}${player}`;
  const value = tags[key];
  const list = Array.isArray(value) ? [...value] : [];
  if (list.some((position) => typeof position !== "string"))
    throw new Error("Invalid skill position history");
  return { tags, key, list };
}
type Cursor = {
  stage: number;
  original: SkillCardUse;
  use: CardUse;
  afterPre: SkillCardUse | null;
  materials: number[];
};

export function createSkillCardExtraCostOperation<G extends CardEffectGame>(
  rules: Pick<SkillCardOnUseRules<G>, "discardZone" | "generalName">,
): OperationHandler<G> {
  return {
    name: "skill-card-extra-cost",
    validate: (game, operation) => {
      const use = readUse(game, operation.data);
      if (use.card.type !== "skill") throw new Error("Expected SkillCard cost");
      if (use.card.willThrow) {
        destination(game, rules.discardZone, "discard");
        physicalMaterials(game, use.card.materialIDs);
      }
    },
    run: ({ game, operation, continuation }) => {
      const use = readUse(game, operation.data);
      if (continuation !== null || !use.card.willThrow)
        return { kind: "return", value: null };
      const general = generalName(
        game,
        use.from,
        use.card.skillPosition,
        rules,
      );
      return {
        kind: "operation",
        operation: {
          name: "move-cards",
          data: {
            moves: [
              {
                ids: use.card.materialIDs,
                to: rules.discardZone,
                open: true,
                reason: {
                  kind: "throw",
                  actor: use.from,
                  target: null,
                  skill: use.card.skillName,
                  event: general,
                },
              },
            ],
            forceVisible: true,
          },
        },
        continuation: true,
      };
    },
  };
}

export function createSkillCardOnUseOperation<G extends CardEffectGame>(
  rules: SkillCardOnUseRules<G>,
): OperationHandler<G> {
  return {
    name: "skill-card-on-use",
    validate: (game, operation, currentActor) => {
      const use = readUse(game, operation.data);
      if (use.card.type !== "skill")
        throw new Error("Expected SkillCard onUse entry");
      if (currentActor !== null && !game.seatOrder.includes(currentActor))
        throw new Error("Unknown SkillCard actor");
      destination(game, rules.tableZone, "table");
      destination(game, rules.discardZone, "discard");
      roomTags(game);
      readRecipientFlags(game, use.from);
      physicalMaterials(game, use.card.materialIDs);
      physicalMaterials(game, cardState(game, use.card, rules).materialIDs);
      if (use.card.skillPosition) positions(game, use, use.from);
    },
    run: ({ game, operation, currentActor, continuation, child }) => {
      const cursor: Cursor =
        continuation === null
          ? {
              stage: 0,
              original: readUse(game, operation.data),
              use: readUse(game, operation.data),
              afterPre: null as SkillCardUse | null,
              materials: [] as number[],
            }
          : (structuredClone(continuation) as Cursor);
      if (child)
        // Shared GameRule replacements need only the execution descriptor.
        cursor.use =
          cursor.stage >= 7
            ? readExecutionCardUse(game, child.event.data)
            : readUse(game, child.event.data);
      if (continuation === null) {
        if (cursor.original.card.skillPosition) {
          const { tags, key, list } = positions(
            game,
            cursor.original,
            cursor.original.from,
          );
          list.push(cursor.original.card.skillPosition);
          tags[key] = list;
        }
        const start =
          currentActor === null ? 0 : game.seatOrder.indexOf(currentActor);
        const order = [
          ...game.seatOrder.slice(start),
          ...game.seatOrder.slice(0, start),
        ];
        cursor.use.to.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      }
      while (cursor.stage < 9) {
        const stage = cursor.stage++;
        let nested: TriggerOperation | null;
        if (stage === 0)
          nested = rules.notifyUse({
            use: readUse(game, cursor.use),
            hidden: !cursor.original.card.willThrow,
          });
        else if (stage === 2) {
          cursor.afterPre = readUse(game, cursor.use);
          const flags = readRecipientFlags(game, cursor.afterPre.from);
          if (!flags.includes("HuanshenSkillChecking"))
            flags.push("HuanshenSkillChecking");
          if (cursor.afterPre.card.type === "skill")
            nested = rules.extraCost(structuredClone(cursor.afterPre));
          else {
            const general = generalName(
              game,
              cursor.original.from,
              cursor.afterPre.card.skillPosition,
              rules,
            );
            nested = {
              name: "move-cards",
              data: {
                moves: cursor.materials.map((id) => ({
                  ids: [id],
                  to: rules.tableZone,
                  open: true,
                  reason: {
                    kind: "use",
                    actor: cursor.original.from,
                    skill: cursor.afterPre!.card.skillName,
                    event: general,
                    target:
                      cursor.afterPre!.to.length === 1
                        ? cursor.afterPre!.to[0]
                        : null,
                    use: {
                      ...cursor.afterPre!,
                      cardClass: cursor.afterPre!.card.className,
                    },
                  },
                })),
                forceVisible: true,
              },
            };
          }
        } else if (stage === 3)
          nested = rules.showSkill({
            player: cursor.original.from,
            skill: cursor.afterPre!.card.showSkill,
            position: cursor.afterPre!.card.skillPosition,
          });
        else if (stage === 4) {
          game.playerFlags[cursor.afterPre!.from] = readRecipientFlags(
            game,
            cursor.afterPre!.from,
          ).filter((flag) => flag !== "HuanshenSkillChecking");
          nested = rules.afterShow({
            player: cursor.original.from,
            use: structuredClone(cursor.afterPre!),
            original: structuredClone(cursor.original),
          });
        } else if (stage === 8) {
          const state = cardState(game, cursor.original.card, rules);
          const ids = state.materialIDs.filter((id) =>
            Object.values(game.cardZones).some(
              (zone) => zone.place === "table" && zone.cards.includes(id),
            ),
          );
          if (!ids.length) continue;
          nested = {
            name: "move-cards",
            data: {
              moves: [
                {
                  ids,
                  to: rules.discardZone,
                  open: true,
                  reason: {
                    kind: "use",
                    actor: cursor.original.from,
                    skill: cursor.original.card.skillName,
                    event: cursor.original.card.name,
                    target:
                      cursor.afterPre!.to.length === 1
                        ? cursor.afterPre!.to[0]
                        : null,
                    use: {
                      ...cursor.afterPre!,
                      cardClass: cursor.afterPre!.card.className,
                    },
                  },
                },
              ],
              forceVisible: true,
            },
          };
        } else {
          if (stage === 1)
            cursor.materials = cardState(
              game,
              cursor.original.card,
              rules,
            ).materialIDs;
          if (
            stage === 5 &&
            cardState(game, cursor.original.card, rules).flags.includes(
              "slashDisableExtraTarget",
            )
          )
            continue;
          const names: Record<number, string> = {
            1: "PreCardUsed",
            5: "TargetSelected",
            6: "CardUsed",
            7: "CardFinished",
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
        if (nested)
          return { kind: "operation", operation: nested, continuation: cursor };
      }
      if (cursor.afterPre!.card.skillPosition) {
        const { tags, key, list } = positions(
          game,
          cursor.afterPre!,
          cursor.original.from,
        );
        if (list.length) {
          list.pop();
          tags[key] = list;
        }
      }
      return { kind: "return", value: { data: cursor.use } as TriggerData };
    },
  };
}
