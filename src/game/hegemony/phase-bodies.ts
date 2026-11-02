import { damageRule, ruleInput } from "./damage-rule";
import type { GeneralGame } from "./general-identity";
import { generalMark } from "./general-rule";
import { readPhase, type PhaseGame } from "./phases";
import { readCardEffect, type CardEffect } from "./card-effect";
import { readSlashAlive } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export type PhaseBodyGame = GeneralGame & PhaseGame;
export interface PhaseBodyRules<G extends PhaseBodyGame> {
  tableZone: string;
  card: (game: Readonly<G>, id: number) => CardEffect["card"];
  onNullified: (target: string, id: number) => TriggerOperation;
}
/** Replaces the standalone Draw rule in the composed profile: one GameRule entry guard. */
export function createPhaseBodyRule<
  G extends PhaseBodyGame,
>(): TriggerSkill<G> {
  return damageRule("EventPhaseProceeding", "phase-proceeding");
}
export function createPhaseBodyOperations<G extends PhaseBodyGame>(
  rules: PhaseBodyRules<G>,
): OperationHandler<G>[] {
  const { tableZone, card, onNullified } = rules;
  if (
    typeof tableZone !== "string" ||
    !tableZone ||
    typeof card !== "function" ||
    typeof onNullified !== "function"
  )
    throw Error("Invalid phase body rules");
  function judgeInput(game: G, data: Parameters<typeof ruleInput>[1]) {
    const input = ruleInput(game, data);
    if (!input) return null;
    const zones = Object.values(game.cardZones).filter(
      (z) => z.owner === input.target && z.place === "delayed",
    );
    if (zones.length > 1) throw Error("Ambiguous judging area");
    const ids = zones[0]?.cards ?? [];
    if (
      !Array.isArray(ids) ||
      ids.some((id) => !Number.isSafeInteger(id) || id < 0) ||
      new Set(ids).size !== ids.length
    )
      throw Error("Invalid judging area");
    return { target: input.target, ids: [...ids] };
  }
  function resolve(game: G, target: string, id: number) {
    const parsed = readCardEffect(game, {
      from: null,
      to: target,
      card: card(structuredClone(game), id),
      multiple: false,
      nullified: false,
      disresponsive: false,
    }).card;
    if (parsed.materialIDs.length !== 1 || parsed.materialIDs[0] !== id)
      throw Error("Invalid delayed physical card");
    return parsed;
  }
  return [
    {
      name: "phase-proceeding",
      validate: (game, op) => {
        ruleInput(game, op.data);
      },
      run: ({ game, operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const input = ruleInput(game, operation.data);
        if (!input) return { kind: "return", value: null };
        const phase = readPhase(game.playerPhases[input.target]);
        const name =
          phase === "round-start"
            ? "round-start-phase"
            : phase === "judge"
              ? "judge-phase"
              : phase === "draw"
                ? "draw-phase"
                : phase === "play"
                  ? "play-phase"
                  : phase === "discard"
                    ? "discard-phase"
                    : null;
        if (phase === "none") throw Error("Invalid Proceeding phase");
        return name
          ? {
              kind: "operation",
              operation: { name, data: { target: input.target, data: null } },
              continuation: true,
            }
          : { kind: "return", value: null };
      },
    },
    {
      name: "round-start-phase",
      validate: (game, op) => {
        ruleInput(game, op.data);
      },
      run: ({ game, operation, continuation }) => {
        if (continuation !== null) return { kind: "return", value: null };
        const input = ruleInput(game, operation.data);
        if (!input) return { kind: "return", value: null };
        const change =
          generalMark(game, input.target, "HaventShowGeneral") > 0 &&
          generalMark(game, input.target, "Global_RoundCount") === 1;
        return {
          kind: "operation",
          operation: {
            name: "ask-general-show",
            data: {
              target: input.target,
              reason: "GameRule_AskForGeneralShow",
              change,
            },
          },
          continuation: true,
        };
      },
    },
    {
      name: "judge-phase",
      validate: (game, op) => {
        judgeInput(game, op.data);
      },
      run: ({
        game,
        operation,
        continuation,
        operationChild,
      }): OperationStep => {
        type Cursor = {
          target: string;
          ids: number[];
          index: number;
          stage: number;
          id: number;
          card: CardEffect["card"] | null;
        };
        let c: Cursor;
        if (continuation === null) {
          const input = judgeInput(game, operation.data);
          if (!input) return { kind: "return", value: null };
          c = {
            ...input,
            index: input.ids.length,
            stage: 0,
            id: 0,
            card: null,
          };
        } else c = structuredClone(continuation) as Cursor;
        while (true)
          switch (c.stage++) {
            case 0: {
              if (c.index === 0 || !readSlashAlive(game, c.target))
                return { kind: "return", value: null };
              c.id = c.ids[--c.index];
              c.card = resolve(game, c.target, c.id);
              const table = game.cardZones[tableZone];
              if (!table || table.owner !== null || table.place !== "table")
                throw Error("Invalid Judge table zone");
              return {
                kind: "operation",
                operation: {
                  name: "move-cards",
                  data: {
                    moves: [
                      {
                        ids: [c.id],
                        to: tableZone,
                        open: true,
                        reason: {
                          kind: "natural-move",
                          actor: c.target,
                          skill: c.card.name,
                        },
                      },
                    ],
                  },
                },
                continuation: c,
              };
            }
            case 1:
              c.card = resolve(game, c.target, c.id);
              return {
                kind: "operation",
                operation: {
                  name: "card-effect",
                  data: {
                    from: null,
                    to: c.target,
                    card: c.card,
                    multiple: false,
                    nullified: false,
                    disresponsive: false,
                  },
                },
                continuation: c,
              };
            case 2:
              if (typeof operationChild?.value !== "boolean")
                throw Error("Invalid Judge card-effect result");
              if (!operationChild.value)
                return {
                  kind: "operation",
                  operation: onNullified(c.target, c.id),
                  continuation: c,
                };
              break;
            case 3:
              return {
                kind: "operation",
                operation: { name: "free-chain", data: null },
                continuation: c,
              };
            case 4:
              c.stage = 0;
              c.card = null;
              break;
            default:
              throw Error("Invalid Judge continuation");
          }
      },
    },
  ];
}
