import {
  effectiveCardID,
  physicalCardZone,
  readJudge,
  type RetrialGame,
} from "./retrial";
import { readResponse, resolveResponse } from "./ask-card-use";
import type { SlashCard } from "./slash";
import type {
  TriggerData,
  TriggerOccurrence,
  TriggerOperation,
  TriggerSkill,
  TriggerStep,
} from "./scheduler";

export interface RetrialSkillRules<G extends RetrialGame> {
  skill: "guicai" | "guidao";
  tableZone: string;
  eligible: (
    game: Readonly<G>,
    actor: string,
  ) => Pick<TriggerOccurrence, "slot" | "shown"> | null;
  resolve: (game: Readonly<G>, card: SlashCard) => SlashCard;
  notify: (notice: {
    skill: "guicai" | "guidao";
    actor: string;
    card: SlashCard;
  }) => TriggerOperation | null;
  reveal: (
    actor: string,
    skill: "guicai" | "guidao",
    slot: TriggerOccurrence["slot"],
  ) => TriggerOperation | null;
  serialize: (game: Readonly<G>, card: SlashCard) => string;
  parse: (game: Readonly<G>, serialized: string) => SlashCard | null;
}
function judgeID(data: TriggerData): string {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.judge !== "string"
  )
    throw new Error("Invalid retrial judge reference");
  return data.judge;
}
function stack(game: RetrialGame, actor: string, skill: string) {
  const tags = game.cardResources?.playerTags[actor];
  if (!tags) throw new Error("Invalid retrial skill tags");
  const key = `${skill}_cards`,
    value = tags[key] ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error("Invalid retrial skill stack");
  return { tags, key, list: [...value] as string[] };
}
type CostCursor = {
  stage: number;
  judge: string;
  card: SlashCard | null;
  hand: boolean;
};
type EffectCursor = { stage: number; judge: string };
export function createRetrialSkill<G extends RetrialGame>(
  rules: RetrialSkillRules<G>,
): TriggerSkill<G> {
  return {
    id: rules.skill,
    events: ["AskForRetrial"],
    priority: 3,
    triggerable: ({ game, event }) => {
      if (event.target === null || !game.alive[event.target]) return [];
      const eligible = rules.eligible(structuredClone(game), event.target);
      return eligible
        ? [
            {
              ...eligible,
              actor: event.target,
              owner: event.target,
              target: event.target,
              occurrence: rules.skill,
            },
          ]
        : [];
    },
    cost: ({ game, event, selected, continuation, operationChild }) => {
      const actor = selected!.actor!;
      const cursor: CostCursor =
        continuation === null
          ? { stage: 0, judge: judgeID(event.data), card: null, hand: false }
          : (structuredClone(continuation) as CostCursor);
      const current = () =>
        resolveResponse(game, actor, cursor.card!, rules.resolve);
      const child = (operation: TriggerOperation): TriggerStep => ({
        kind: "operation",
        operation,
        continuation: cursor,
      });
      while (true) {
        switch (cursor.stage++) {
          case 0: {
            const judge = readJudge(game, cursor.judge);
            return child({
              name: "ask-card-response",
              data: {
                actor,
                pattern: rules.skill === "guicai" ? ".." : ".|black",
                prompt: `@${rules.skill}-card:${judge.who}:${rules.skill}:${judge.reason}:${effectiveCardID(game, judge.card)}`,
                data: structuredClone(event.data),
                to: judge.who,
                isRetrial: true,
                skillName: "",
                isProvision: false,
              },
            });
          }
          case 1: {
            if (operationChild!.value === null)
              return { kind: "done", value: false };
            cursor.card = readResponse(game, operationChild!.value, actor);
            effectiveCardID(game, current());
            const next = rules.notify({
              skill: rules.skill,
              actor,
              card: current(),
            });
            if (next) return child(next);
            break;
          }
          case 2: {
            const card = current();
            const zone = physicalCardZone(game, effectiveCardID(game, card));
            cursor.hand = zone.owner === actor && zone.place === "hand";
            const table = game.cardZones[rules.tableZone];
            if (!table || table.owner !== null || table.place !== "table")
              throw new Error("Invalid retrial skill table destination");
            for (const id of card.card.materialIDs) physicalCardZone(game, id);
            return child({
              name: "move-cards",
              data: {
                moves: [
                  {
                    ids: [...card.card.materialIDs],
                    to: rules.tableZone,
                    // Public table visibility; the separate native force flag remains false.
                    open: true,
                    reason: { kind: "response", actor, skill: rules.skill },
                  },
                ],
                forceVisible: false,
              },
            });
          }
          case 3:
            return {
              kind: "event",
              event: {
                name: "CardResponded",
                target: actor,
                data: {
                  m_card: current(),
                  m_who: readJudge(game, cursor.judge).who,
                  m_isUse: false,
                  m_isRetrial: false,
                  m_isHandcard: cursor.hand,
                  m_data: structuredClone(event.data),
                },
              },
              continuation: cursor,
            };
          case 4: {
            const saved = rules.serialize(structuredClone(game), current());
            if (typeof saved !== "string" || !saved)
              throw new Error("Invalid retrial card serialization");
            const { tags, key, list } = stack(game, actor, rules.skill);
            list.push(saved);
            tags[key] = list;
            return { kind: "done", value: true };
          }
          default:
            throw new Error("Invalid retrial skill cost continuation");
        }
      }
    },
    reveal: ({ selected, continuation }) => {
      if (continuation === null) {
        const operation = rules.reveal(
          selected!.actor!,
          rules.skill,
          selected!.slot,
        );
        if (operation)
          return { kind: "operation", operation, continuation: true };
      }
      return { kind: "done", value: false };
    },
    effect: ({ game, event, selected, continuation }): TriggerStep => {
      const actor = selected!.actor!;
      if (continuation === null) {
        const { tags, key, list } = stack(game, actor, rules.skill);
        if (!list.length) return { kind: "done", value: false };
        const saved = list.pop()!;
        tags[key] = list;
        const parsed = rules.parse(structuredClone(game), saved);
        if (parsed === null) return { kind: "done", value: false };
        const card = readResponse(game, parsed, actor);
        const judge = judgeID(event.data);
        readJudge(game, judge);
        return {
          kind: "operation",
          operation: {
            name: "retrial",
            data: {
              actor,
              judge,
              card,
              skillName: rules.skill,
              exchange: rules.skill === "guidao",
            },
          },
          continuation: { stage: 1, judge },
        };
      }
      const cursor = structuredClone(continuation) as EffectCursor;
      if (cursor.stage === 1)
        return {
          kind: "operation",
          operation: {
            name: "update-judge-result",
            data: { judge: cursor.judge },
          },
          continuation: { stage: 2, judge: cursor.judge },
        };
      if (cursor.stage === 2) return { kind: "done", value: false };
      throw new Error("Invalid retrial skill effect continuation");
    },
  };
}
