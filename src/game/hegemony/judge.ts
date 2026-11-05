import { damageRoomTags, type DamageGame } from "./damage";
import { allPlayers, damageRule } from "./damage-rule";
import { readResponse } from "./ask-card-use";
import { readCardReference } from "./card-resources";
import {
  effectiveCardID,
  judgeIsEffected,
  judgeIsGood,
  physicalCardZone,
  readJudge,
  readPendingJudge,
  type JudgeState,
  type RetrialGame,
} from "./retrial";
import { readSlashInteger, type SlashCard } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
  TriggerSkill,
} from "./scheduler";

export type JudgeGame = RetrialGame & DamageGame;
export type JudgeNotice =
  | { kind: "initial-judge" | "judge-result"; who: string; id: number }
  | {
      kind: "judge-animation";
      judge: string;
      who: string;
      id: number;
      reason: string;
      effected: boolean;
    }
  | { kind: "judge-delay" }
  | { kind: "judge-effected" | "judge-failure"; who: string; reason: string };
export interface JudgeRules<G extends JudgeGame> {
  discardZone: string;
  canonical: (game: Readonly<G>, id: number) => SlashCard;
  matches: (game: Readonly<G>, judge: Readonly<JudgeState>) => boolean;
  notify: (notice: JudgeNotice) => TriggerOperation | null;
}
function judgeID(game: JudgeGame, data: TriggerData): string {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.judge !== "string"
  )
    throw new Error("Invalid judgment request");
  readPendingJudge(game, data.judge);
  return data.judge;
}
function ruleRequest(game: JudgeGame, data: TriggerData) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.target !== "string" ||
    !game.seatOrder.includes(data.target) ||
    !("data" in data)
  )
    throw new Error("Invalid judgment rule request");
  return { target: data.target, data: data.data };
}
type OwnerCursor = {
  stage: number;
  original: string;
  shared: TriggerData;
  players: string[];
  index: number;
};
export function createRoomJudgeOperation<G extends JudgeGame>(
  rules: Pick<JudgeRules<G>, "notify">,
): OperationHandler<G> {
  return {
    name: "judge",
    validate: (game, operation) => {
      judgeID(game, operation.data);
      damageRoomTags(game);
    },
    run: ({ game, operation, continuation, child }) => {
      const cursor: OwnerCursor =
        continuation === null
          ? {
              stage: 0,
              original: judgeID(game, operation.data),
              shared: structuredClone(operation.data),
              players: [],
              index: 0,
            }
          : (structuredClone(continuation) as OwnerCursor);
      if (child) cursor.shared = structuredClone(child.event.data);
      const event = (name: string, target: string) => ({
        kind: "event" as const,
        event: { name, target, data: cursor.shared },
        continuation: cursor,
      });
      while (true)
        switch (cursor.stage) {
          case 0: {
            const tags = damageRoomTags(game);
            tags.judge = readSlashInteger(readSlashInteger(tags.judge, 0) + 1);
            cursor.stage = 1;
            return event(
              "StartJudge",
              readPendingJudge(game, cursor.original).who,
            );
          }
          case 1:
            cursor.players = allPlayers(game);
            cursor.stage = 2;
            break;
          case 2:
            if (child?.consumed && child.event.name === "AskForRetrial")
              cursor.index = cursor.players.length;
            if (cursor.index < cursor.players.length)
              return event("AskForRetrial", cursor.players[cursor.index++]);
            cursor.stage = 3;
            break;
          case 3:
            cursor.stage = 4;
            return event(
              "FinishRetrial",
              readPendingJudge(game, cursor.original).who,
            );
          case 4: {
            const tags = damageRoomTags(game);
            tags.judge = readSlashInteger(readSlashInteger(tags.judge, 0) - 1);
            cursor.stage = 5;
            return event(
              "FinishJudge",
              readPendingJudge(game, cursor.original).who,
            );
          }
          case 5: {
            cursor.stage = 6;
            if (readPendingJudge(game, cursor.original).play_animation) {
              const judge = readPendingJudge(game, cursor.original),
                next = rules.notify({
                  kind: judgeIsEffected(judge)
                    ? "judge-effected"
                    : "judge-failure",
                  who: judge.who,
                  reason: judge.reason,
                });
              if (next)
                return {
                  kind: "operation",
                  operation: next,
                  continuation: cursor,
                };
            }
            break;
          }
          case 6:
            return { kind: "return", value: null };
          default:
            throw new Error("Invalid judgment continuation");
        }
    },
  };
}
function judgeDestination(game: JudgeGame, who: string) {
  const zones = Object.entries(game.cardZones).filter(
    ([, zone]) => zone.owner === who && zone.place === "judge",
  );
  if (zones.length !== 1) throw new Error("Invalid judgment destination");
  return zones[0][0];
}
export function createStartJudgeOperation<G extends JudgeGame>(
  rules: JudgeRules<G>,
): OperationHandler<G> {
  type Cursor = { stage: number; judge: string | null };
  return {
    name: "start-judge",
    validate: (game, operation) => {
      ruleRequest(game, operation.data);
    },
    run: ({ game, operation, continuation, operationChild }): OperationStep => {
      const cursor: Cursor =
        continuation === null
          ? { stage: 0, judge: null }
          : (structuredClone(continuation) as Cursor);
      while (true)
        switch (cursor.stage++) {
          case 0:
            return {
              kind: "operation",
              operation: { name: "draw-card", data: {} },
              continuation: cursor,
            };
          case 1: {
            const input = ruleRequest(game, operation.data),
              id = operationChild?.value;
            if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 0)
              throw new Error("Invalid judgment draw result");
            cursor.judge = judgeID(game, input.data);
            const judge = readPendingJudge(game, cursor.judge),
              canonical = readResponse(
                game,
                rules.canonical(structuredClone(game), id),
                judge.who,
              ),
              resource = readCardReference(game, canonical.reference).card;
            if (
              resource.kind !== "wrapped" ||
              resource.id !== id ||
              effectiveCardID(game, canonical) !== id
            )
              throw new Error("Invalid canonical judgment card");
            physicalCardZone(game, id);
            judge.card = canonical;
            const next = rules.notify({
              kind: "initial-judge",
              who: judge.who,
              id,
            });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 2: {
            const judge = readJudge(game, cursor.judge!);
            return {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: {
                  forceVisible: true,
                  moves: [
                    {
                      ids: [effectiveCardID(game, judge.card)],
                      to: judgeDestination(game, judge.who),
                      open: true,
                      reason: {
                        kind: "judge",
                        actor: judge.who,
                        skill: "",
                        eventName: judge.reason,
                      },
                    },
                  ],
                },
              },
              continuation: cursor,
            };
          }
          case 3:
            return {
              kind: "operation",
              operation: {
                name: "update-judge-result",
                data: { judge: cursor.judge },
              },
              continuation: cursor,
            };
          case 4:
            return { kind: "return", value: null };
          default:
            throw new Error("Invalid StartJudge continuation");
        }
    },
  };
}
export function createFinishRetrialOperation<G extends JudgeGame>(
  rules: JudgeRules<G>,
): OperationHandler<G> {
  type Cursor = { stage: number; judge: string; target: string };
  return {
    name: "finish-retrial",
    validate: (game, operation) => {
      const input = ruleRequest(game, operation.data);
      readJudge(game, judgeID(game, input.data));
    },
    run: ({ game, operation, continuation }) => {
      const input = ruleRequest(game, operation.data);
      const cursor: Cursor =
        continuation === null
          ? { stage: 0, judge: judgeID(game, input.data), target: input.target }
          : (structuredClone(continuation) as Cursor);
      while (true)
        switch (cursor.stage++) {
          case 0: {
            const judge = readJudge(game, cursor.judge),
              next = rules.notify({
                kind: "judge-result",
                who: cursor.target,
                id: effectiveCardID(game, judge.card),
              });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 1: {
            const judge = readJudge(game, cursor.judge);
            for (const pattern of [...judge.patterns]) {
              const matches = rules.matches(structuredClone(game), {
                ...structuredClone(judge),
                who: cursor.target,
                pattern,
              });
              if (typeof matches !== "boolean")
                throw new Error("Invalid judgment pattern result");
              if (matches) {
                judge.pattern = pattern;
                break;
              }
            }
            if (judge.play_animation) {
              const next = rules.notify({
                kind: "judge-animation",
                judge: cursor.judge,
                who: judge.who,
                id: effectiveCardID(game, judge.card),
                reason: judge.reason,
                effected: judgeIsEffected(judge),
              });
              if (next)
                return {
                  kind: "operation",
                  operation: next,
                  continuation: cursor,
                };
            } else cursor.stage = 3;
            break;
          }
          case 2: {
            const next = rules.notify({ kind: "judge-delay" });
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 3:
            return { kind: "return", value: null };
          default:
            throw new Error("Invalid FinishRetrial continuation");
        }
    },
  };
}
export function createFinishJudgeOperation<G extends JudgeGame>(
  rules: Pick<JudgeRules<G>, "discardZone">,
): OperationHandler<G> {
  return {
    name: "finish-judge",
    validate: (game, operation) => {
      const input = ruleRequest(game, operation.data);
      readJudge(game, judgeID(game, input.data));
    },
    run: ({ game, operation, continuation }) => {
      if (continuation !== null) return { kind: "return", value: null };
      const input = ruleRequest(game, operation.data),
        judge = readJudge(game, judgeID(game, input.data)),
        id = effectiveCardID(game, judge.card);
      if (
        physicalCardZone(game, id).place !== "judge" ||
        (judge.reason === "luoshen" && judgeIsGood(judge))
      )
        return { kind: "return", value: null };
      const discard = game.cardZones[rules.discardZone];
      if (!discard || discard.owner !== null || discard.place !== "discard")
        throw new Error("Invalid judgment discard destination");
      return {
        kind: "operation",
        operation: {
          name: "move-cards",
          data: {
            forceVisible: true,
            moves: [
              {
                ids: [id],
                to: rules.discardZone,
                open: true,
                reason: {
                  kind: "judgedone",
                  actor: judge.who,
                  skill: "",
                  eventName: judge.reason,
                },
              },
            ],
          },
        },
        continuation: true,
      };
    },
  };
}
export function createJudgeRules<G extends JudgeGame>(): TriggerSkill<G>[] {
  return [
    ["StartJudge", "start-judge"],
    ["FinishRetrial", "finish-retrial"],
    ["FinishJudge", "finish-judge"],
  ].map(([event, operation]) => damageRule<G>(event, operation));
}
