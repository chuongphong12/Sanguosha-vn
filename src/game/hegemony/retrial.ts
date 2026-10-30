import {
  readResponse,
  resolveResponse,
  type AskCardUseGame,
} from "./ask-card-use";
import { readCardReference } from "./card-resources";
import type { CardZone } from "./movement";
import type { SlashCard } from "./slash";
import type {
  OperationHandler,
  TriggerOperation,
  TriggerData,
} from "./scheduler";

export type JudgeState = {
  who: string;
  card: SlashCard;
  pattern: string;
  patterns: string[];
  good: boolean;
  reason: string;
  time_consuming: boolean;
  negative: boolean;
  play_animation: boolean;
  result: "unknown" | "good" | "bad";
};
export type PendingJudgeState = Omit<JudgeState, "card"> & {
  card: SlashCard | null;
};
export interface RetrialGame extends AskCardUseGame {
  judges: Record<string, PendingJudgeState>;
}
type RetrialNotice = {
  kind: "changed-judge";
  actor: string;
  judge: string;
  who: string;
  skillName: string;
  id: number;
};
export interface RetrialRules<G extends RetrialGame> {
  discardZone: string;
  resolve: (game: Readonly<G>, card: SlashCard) => SlashCard;
  canonical: (game: Readonly<G>, id: number) => SlashCard;
  notify: (notice: RetrialNotice) => TriggerOperation | null;
}
export function readPendingJudge(
  game: RetrialGame,
  id: string,
): PendingJudgeState {
  const judge = Object.prototype.hasOwnProperty.call(game.judges, id)
    ? game.judges[id]
    : undefined;
  if (
    !judge ||
    !game.seatOrder.includes(judge.who) ||
    typeof judge.pattern !== "string" ||
    !Array.isArray(judge.patterns) ||
    judge.patterns.some((pattern) => typeof pattern !== "string") ||
    typeof judge.good !== "boolean" ||
    typeof judge.reason !== "string" ||
    typeof judge.time_consuming !== "boolean" ||
    typeof judge.negative !== "boolean" ||
    typeof judge.play_animation !== "boolean" ||
    !["unknown", "good", "bad"].includes(judge.result)
  )
    throw new Error("Invalid judge state");
  if (judge.card !== null) readResponse(game, judge.card, judge.who);
  return judge;
}
export function readJudge(game: RetrialGame, id: string): JudgeState {
  const judge = readPendingJudge(game, id);
  if (judge.card === null) throw new Error("Judge requires a ready card");
  return judge as JudgeState;
}
export function judgeIsGood(judge: Pick<JudgeState, "result">): boolean {
  if (judge.result === "unknown") throw new Error("Judge result is unknown");
  return judge.result === "good";
}
export function judgeIsEffected(
  judge: Pick<JudgeState, "result" | "negative">,
): boolean {
  return judge.negative ? !judgeIsGood(judge) : judgeIsGood(judge);
}
export function createJudgeResultOperation<G extends RetrialGame>(rules: {
  matches: (game: Readonly<G>, judge: Readonly<JudgeState>) => boolean;
}): OperationHandler<G> {
  const input = (game: G, data: TriggerData) => {
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      typeof data.judge !== "string"
    )
      throw new Error("Invalid judge result request");
    return readJudge(game, data.judge);
  };
  return {
    name: "update-judge-result",
    validate: (game, operation) => {
      input(game, operation.data);
    },
    run: ({ game, operation }) => {
      const judge = input(game, operation.data);
      const matches = rules.matches(
        structuredClone(game),
        structuredClone(judge),
      );
      if (typeof matches !== "boolean")
        throw new Error("Invalid judge pattern result");
      judge.result = judge.good === matches ? "good" : "bad";
      return { kind: "return", value: judgeIsEffected(judge) };
    },
  };
}
export function effectiveCardID(game: RetrialGame, card: SlashCard): number {
  const resource = readCardReference(game, card.reference).card;
  const id =
    resource.kind === "wrapped" ? resource.id : card.card.materialIDs[0];
  if (
    !Number.isSafeInteger(id) ||
    id < 0 ||
    (resource.kind === "wrapped" &&
      (card.card.materialIDs.length !== 1 || card.card.materialIDs[0] !== id))
  )
    throw new Error("Invalid retrial effective card");
  return id;
}
export function physicalCardZone(game: RetrialGame, id: number): CardZone {
  const zones = Object.values(game.cardZones).filter((zone) =>
    zone.cards.includes(id),
  );
  if (
    zones.length !== 1 ||
    zones[0].cards.filter((card) => card === id).length !== 1
  )
    throw new Error("Invalid retrial physical location");
  return zones[0];
}
function destination(
  game: RetrialGame,
  actor: string,
  place: "hand" | "judge",
): string {
  const zones = Object.entries(game.cardZones).filter(
    ([, zone]) => zone.owner === actor && zone.place === place,
  );
  if (zones.length !== 1) throw new Error("Invalid retrial destination");
  return zones[0][0];
}
type RetrialRequest = {
  actor: string;
  judge: string;
  card: SlashCard | null;
  skillName: string;
  exchange: boolean;
};
type Cursor = {
  stage: number;
  request: RetrialRequest;
  canonical: SlashCard | null;
  responded: boolean;
  hand: boolean;
  moves: TriggerData[];
  notice: RetrialNotice | null;
};
function prepare<G extends RetrialGame>(
  game: G,
  data: TriggerData,
  rules: RetrialRules<G>,
): Cursor {
  const input = data as Partial<RetrialRequest> | null;
  if (
    !input ||
    !game.seatOrder.includes(input.actor ?? "") ||
    typeof input.judge !== "string" ||
    typeof input.skillName !== "string" ||
    typeof input.exchange !== "boolean" ||
    input.card === undefined
  )
    throw new Error("Invalid retrial request");
  const request: RetrialRequest = {
    actor: input.actor!,
    judge: input.judge,
    skillName: input.skillName,
    exchange: input.exchange,
    card:
      input.card === null ? null : readResponse(game, input.card, input.actor!),
  };
  const cursor: Cursor = {
    stage: 0,
    request,
    canonical: null,
    responded: false,
    hand: false,
    moves: [],
    notice: null,
  };
  if (request.card === null) return cursor;
  const judge = readJudge(game, request.judge);
  const id = effectiveCardID(game, request.card),
    oldID = effectiveCardID(game, judge.card);
  if (id === oldID) throw new Error("Duplicate retrial physical card");
  const zone = physicalCardZone(game, id);
  physicalCardZone(game, oldID);
  const canonical = readResponse(
    game,
    rules.canonical(structuredClone(game), id),
    request.actor,
  );
  const reference = readCardReference(game, canonical.reference).card;
  if (
    reference.kind !== "wrapped" ||
    reference.id !== id ||
    effectiveCardID(game, canonical) !== id
  )
    throw new Error("Invalid canonical judge card");
  const discard = game.cardZones[rules.discardZone];
  if (!discard || discard.owner !== null || discard.place !== "discard")
    throw new Error("Invalid retrial discard destination");
  cursor.canonical = canonical;
  cursor.responded = zone.owner === request.actor;
  cursor.hand = cursor.responded && zone.place === "hand";
  cursor.moves = [
    {
      ids: [id],
      to: destination(game, judge.who, "judge"),
      open: true,
      reason: {
        kind: "retrial",
        actor: request.actor,
        skill: request.skillName,
      },
    },
    {
      ids: [oldID],
      to: request.exchange
        ? destination(game, request.actor, "hand")
        : rules.discardZone,
      open: true,
      reason: request.exchange
        ? { kind: "override", actor: request.actor, skill: request.skillName }
        : { kind: "judgedone", actor: request.actor },
    },
  ];
  cursor.notice = {
    kind: "changed-judge",
    actor: request.actor,
    judge: request.judge,
    who: judge.who,
    skillName: request.skillName,
    id,
  };
  return cursor;
}
export function createRetrialOperation<G extends RetrialGame>(
  rules: RetrialRules<G>,
): OperationHandler<G> {
  return {
    name: "retrial",
    validate: (game, operation) => {
      prepare(game, operation.data, rules);
    },
    run: ({ game, operation, continuation }) => {
      const cursor =
        continuation === null
          ? prepare(game, operation.data, rules)
          : (structuredClone(continuation) as Cursor);
      if (cursor.request.card === null) return { kind: "return", value: null };
      while (true) {
        switch (cursor.stage++) {
          case 0: {
            readJudge(game, cursor.request.judge).card = cursor.canonical!;
            const next = rules.notify(structuredClone(cursor.notice!));
            if (next)
              return {
                kind: "operation",
                operation: next,
                continuation: cursor,
              };
            break;
          }
          case 1:
            return {
              kind: "operation",
              operation: {
                name: "move-cards",
                data: { moves: cursor.moves, forceVisible: true },
              },
              continuation: cursor,
            };
          case 2:
            if (cursor.responded) {
              const card = resolveResponse(
                game,
                cursor.request.actor,
                cursor.request.card,
                rules.resolve,
              );
              return {
                kind: "event",
                event: {
                  name: "CardResponded",
                  target: cursor.request.actor,
                  data: {
                    m_card: card,
                    m_who: readJudge(game, cursor.request.judge).who,
                    m_isUse: false,
                    m_isRetrial: true,
                    m_isHandcard: cursor.hand,
                    m_data: null,
                  },
                },
                continuation: cursor,
              };
            }
            break;
          case 3:
            return { kind: "return", value: null };
          default:
            throw new Error("Invalid retrial continuation");
        }
      }
    },
  };
}
