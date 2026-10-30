import { readCardReference, type CardResourceGame } from "./card-resources";
import { readExecutionCardUse, type CardUse } from "./card-on-use";
import type { SlashCard } from "./slash";
import type {
  OperationHandler,
  OperationStep,
  TriggerData,
  TriggerOperation,
} from "./scheduler";

export interface AskCardUseGame extends CardResourceGame {
  playerFlags: Record<string, string[]>;
  currentCardUseReason?: "play" | "response" | "response-use" | "unknown";
  currentCardUsePattern?: string;
  providedCard?: { card: SlashCard | null };
}
export type AskCardUseRequest = {
  actor: string;
  pattern: string;
  prompt: string;
  data: TriggerData;
  to: string | null;
  skillName: string;
  isProvision: boolean;
  isRetrial?: boolean;
};
type AskCardMethod = "use" | "response" | "none" | "discard";
export type AskCardUseNotice =
  | { kind: "focus"; actor: string }
  | {
      kind: "accepted" | "skill";
      actor: string;
      card: SlashCard;
      context?: {
        method: AskCardMethod;
        skillName: string;
        isRetrial: boolean;
      };
    }
  | { kind: "finish"; players: string[] };
export interface AskCardUseRules<G extends AskCardUseGame> {
  tableZone: string;
  discardZone: string;
  isAI: (game: Readonly<G>, actor: string) => boolean;
  /** Trusted admission/parse adapter; owns AI DummyCard unwrapping and delay/timeout. */
  request: (request: AskCardUseRequest & { ai: boolean }) => TriggerOperation;
  limited: (game: Readonly<G>, actor: string, card: SlashCard) => boolean;
  validateResponse: (actor: string, card: SlashCard) => TriggerOperation;
  /** Current private card metadata/subcards, preserving the supplied reference identity. */
  resolve: (game: Readonly<G>, card: SlashCard) => SlashCard;
  /** Focus; accepted wrapped update/reset/log/emotion; owned-skill notice; bypass finish notices. */
  notify: (notice: AskCardUseNotice) => TriggerOperation | null;
  /** showSkill/position and conditional Huashen drop, as a resumable package operation. */
  reveal: (actor: string, card: SlashCard) => TriggerOperation;
  moveReason: (
    game: Readonly<G>,
    actor: string,
    card: SlashCard,
  ) => TriggerData;
  validateAfter: (
    actor: string,
    original: SlashCard,
    use: CardUse,
  ) => TriggerOperation;
}
export type AskCardResponseRules<G extends AskCardUseGame> = Omit<
  AskCardUseRules<G>,
  "validateAfter"
> & {
  validateInResponseAfter: (
    actor: string,
    original: SlashCard,
  ) => TriggerOperation;
};
export type AskCardNoneRules<G extends AskCardUseGame> = Pick<
  AskCardUseRules<G>,
  "isAI" | "request" | "validateResponse" | "resolve" | "notify"
>;
export type AskCardDiscardRules<G extends AskCardUseGame> =
  AskCardNoneRules<G> & Pick<AskCardUseRules<G>, "limited" | "discardZone">;
export type CardResponseData = {
  m_card: SlashCard;
  m_who: string | null;
  m_isUse: false;
  m_isRetrial: false;
  m_isHandcard: boolean;
  m_data: TriggerData;
};
export function createAskCardResponseOperation<G extends AskCardUseGame>(
  rules: AskCardResponseRules<G>,
): OperationHandler<G> {
  return createAskCardOperation({ ...rules, method: "response" });
}
/** Room-wide single slot; explicit null still counts as a provision. */
export function provideCard(
  game: AskCardUseGame,
  card: SlashCard | null,
): void {
  if (game.providedCard !== undefined) throw new Error("Card already provided");
  game.providedCard = { card: structuredClone(card) };
}
type Cursor = {
  stage: number;
  request: AskCardUseRequest;
  original: SlashCard | null;
  validated: SlashCard | null;
  local: CardUse | null;
  eventData: TriggerData;
  ids: number[];
  suppressed: boolean;
  ai: boolean;
  isHandcard: boolean;
};
export function readResponse(
  game: AskCardUseGame,
  value: TriggerData,
  actor: string,
): SlashCard {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    typeof value.reference !== "string"
  )
    throw new Error("Invalid response card");
  const use = readExecutionCardUse(game, {
    from: actor,
    to: [],
    card: value.card,
  });
  readCardReference(game, value.reference);
  return {
    ...structuredClone(value),
    reference: value.reference,
    card: use.card,
  };
}
/** Resolve mutable native identity without allowing an adapter to substitute another card. */
export function resolveResponse<G extends AskCardUseGame>(
  game: G,
  actor: string,
  original: SlashCard,
  resolve: AskCardUseRules<G>["resolve"],
): SlashCard {
  const response = readResponse(
    game,
    resolve(structuredClone(game), structuredClone(original)),
    actor,
  );
  if (response.reference !== original.reference)
    throw new Error("Changed response identity");
  response.card.flags = [
    ...readCardReference(game, response.reference).storage.flags,
  ];
  return response;
}
function readRequest(
  game: AskCardUseGame,
  data: TriggerData,
  method: AskCardMethod,
): AskCardUseRequest {
  const input = data as
    | (Partial<AskCardUseRequest> & { method?: string; isRetrial?: boolean })
    | null;
  if (
    !input ||
    !game.seatOrder.includes(input.actor ?? "") ||
    typeof game.alive[input.actor!] !== "boolean" ||
    !Array.isArray(game.playerFlags[input.actor!]) ||
    typeof input.pattern !== "string" ||
    (method === "use" && input.pattern === "slash") ||
    typeof input.prompt !== "string" ||
    typeof input.skillName !== "string" ||
    typeof input.isProvision !== "boolean" ||
    (input.to !== null && !game.seatOrder.includes(input.to ?? "")) ||
    input.data === undefined ||
    (input.method !== undefined && input.method !== method) ||
    (input.isRetrial !== undefined && typeof input.isRetrial !== "boolean")
  )
    throw new Error(
      `Invalid Method${method[0].toUpperCase()}${method.slice(1)} request`,
    );
  return structuredClone({
    actor: input.actor!,
    pattern: input.pattern,
    prompt: input.prompt,
    data: input.data,
    to: input.to!,
    skillName: input.skillName,
    isProvision: input.isProvision,
    ...(input.isRetrial !== undefined ? { isRetrial: input.isRetrial } : {}),
  });
}
function boolean(value: boolean): boolean {
  if (typeof value !== "boolean") throw new Error("Invalid response predicate");
  return value;
}
export function createAskCardUseOperation<G extends AskCardUseGame>(
  rules: AskCardUseRules<G>,
): OperationHandler<G> {
  return createAskCardOperation({ ...rules, method: "use" });
}
export function createAskCardNoneOperation<G extends AskCardUseGame>(
  rules: AskCardNoneRules<G>,
): OperationHandler<G> {
  return createAskCardOperation({ ...rules, method: "none" });
}
export function createAskCardDiscardOperation<G extends AskCardUseGame>(
  rules: AskCardDiscardRules<G>,
): OperationHandler<G> {
  return createAskCardOperation({ ...rules, method: "discard" });
}
function createAskCardOperation<G extends AskCardUseGame>(
  rules:
    | (AskCardUseRules<G> & { method: "use" })
    | (AskCardResponseRules<G> & { method: "response" })
    | (AskCardNoneRules<G> & { method: "none" })
    | (AskCardDiscardRules<G> & { method: "discard" }),
): OperationHandler<G> {
  return {
    name: `ask-card-${rules.method}`,
    validate: (game, operation) => {
      readRequest(game, operation.data, rules.method);
      const destinations =
        rules.method === "none"
          ? []
          : rules.method === "discard"
            ? [[rules.discardZone, "discard"]]
            : [
                [rules.tableZone, "table"],
                [rules.discardZone, "discard"],
              ];
      for (const [key, place] of destinations) {
        const zone = game.cardZones[key];
        if (!zone || zone.place !== place || zone.owner !== null)
          throw new Error("Invalid response destination");
      }
    },
    run: ({ game, operation, continuation, operationChild, child }) => {
      const cursor: Cursor =
        continuation === null
          ? {
              stage: 0,
              request: readRequest(game, operation.data, rules.method),
              original: null,
              validated: null,
              local: null,
              eventData: null,
              ids: [],
              suppressed: false,
              ai: false,
              isHandcard: false,
            }
          : (structuredClone(continuation) as Cursor);
      const actor = cursor.request.actor;
      const operationStep = (operation: TriggerOperation): OperationStep => ({
        kind: "operation",
        operation,
        continuation: cursor,
      });
      const event = (name: string, data: TriggerData): OperationStep => ({
        kind: "event",
        event: { name, target: actor, data },
        continuation: cursor,
      });
      const current = () =>
        resolveResponse(game, actor, cursor.validated!, rules.resolve);
      const notice = (value: AskCardUseNotice) => {
        const next = rules.notify(
          structuredClone(
            value.kind === "accepted" &&
              (rules.method === "none" ||
                rules.method === "discard" ||
                cursor.request.isRetrial)
              ? {
                  ...value,
                  context: {
                    method: rules.method,
                    skillName: cursor.request.skillName,
                    isRetrial: cursor.request.isRetrial === true,
                  },
                }
              : value,
          ),
        );
        return next ? operationStep(next) : null;
      };
      const move = (
        ids: number[],
        to: string,
        atomic: boolean,
      ): OperationStep => {
        if (rules.method === "none")
          throw new Error("Selection cannot move cards");
        const reason =
          rules.method === "discard"
            ? { kind: "throw", actor }
            : rules.moveReason(structuredClone(game), actor, current());
        return operationStep({
          name: "move-cards",
          data: {
            moves: atomic
              ? ids.map((id) => ({ ids: [id], to, open: true, reason }))
              : [{ ids, to, open: true, reason }],
            forceVisible: true,
          },
        });
      };
      while (true) {
        switch (cursor.stage++) {
          case 0: {
            const next = notice({ kind: "focus", actor });
            if (next) return next;
            break;
          }
          case 1:
            game.currentCardUsePattern = cursor.request.pattern;
            game.currentCardUseReason =
              rules.method === "use"
                ? "response-use"
                : rules.method === "response"
                  ? "response"
                  : "unknown";
            if (
              (rules.method === "use" || rules.method === "response") &&
              !cursor.request.isRetrial &&
              !game.playerFlags[actor].includes("continuing")
            )
              return event("CardAsked", [
                cursor.request.pattern,
                cursor.request.prompt,
              ]);
            break;
          case 2: {
            game.playerFlags[actor] = game.playerFlags[actor].filter(
              (flag) => flag !== "continuing",
            );
            if (game.providedCard !== undefined || !game.alive[actor]) {
              const provided = game.providedCard?.card ?? null;
              delete game.providedCard;
              cursor.original =
                provided === null ? null : readResponse(game, provided, actor);
              if (
                cursor.original &&
                rules.method !== "none" &&
                boolean(
                  rules.limited(
                    structuredClone(game),
                    actor,
                    structuredClone(cursor.original),
                  ),
                )
              )
                cursor.original = null;
              cursor.stage = 18;
              break;
            }
            cursor.ai = boolean(rules.isAI(structuredClone(game), actor));
            return operationStep(
              rules.request({
                ...structuredClone(cursor.request),
                ai: cursor.ai,
              }),
            );
          }
          case 3:
            cursor.original =
              operationChild!.value === null
                ? null
                : readResponse(game, operationChild!.value, actor);
            if (
              cursor.original &&
              cursor.ai &&
              rules.method !== "none" &&
              boolean(
                rules.limited(
                  structuredClone(game),
                  actor,
                  structuredClone(cursor.original),
                ),
              )
            )
              cursor.original = null;
            cursor.stage = 18;
            break;
          case 18:
            if (cursor.original === null) {
              cursor.stage = 17;
              return event(
                "ChoiceMade",
                `cardResponded:${cursor.request.pattern}:${cursor.request.prompt}:_nil_`,
              );
            }
            cursor.stage = 4;
            return operationStep(
              rules.validateResponse(actor, structuredClone(cursor.original)),
            );
          case 4:
            if (operationChild!.value === null) {
              if (!game.playerFlags[actor].includes("continuing"))
                game.playerFlags[actor].push("continuing");
              cursor.request.skillName = "";
              cursor.request.isProvision = false;
              cursor.original = null;
              cursor.stage = 0;
              break;
            }
            cursor.validated = readResponse(game, operationChild!.value, actor);
            {
              const next = notice({ kind: "accepted", actor, card: current() });
              if (next) return next;
            }
            break;
          case 5: {
            if (rules.method === "response") {
              const ids = current().card.materialIDs;
              cursor.isHandcard =
                ids.length > 0 &&
                ids.every((id) =>
                  Object.values(game.cardZones).some(
                    (zone) =>
                      zone.place === "hand" &&
                      zone.owner === actor &&
                      zone.cards.includes(id),
                  ),
                );
            }
            const { card } = readCardReference(
              game,
              cursor.validated!.reference,
            );
            return event(
              "ChoiceMade",
              `cardResponded:${cursor.request.pattern}:${cursor.request.prompt}:_${card.key}_`,
            );
          }
          case 6: {
            if (
              rules.method === "none" ||
              (rules.method !== "discard" && cursor.request.isRetrial)
            ) {
              cursor.stage = 14;
              break;
            }
            if (rules.method === "discard") break;
            const next = notice({ kind: "skill", actor, card: current() });
            if (next) return next;
            break;
          }
          case 7: {
            if (rules.method === "none")
              throw new Error("Invalid selection continuation");
            const response = current();
            cursor.ids = [...response.card.materialIDs];
            for (const id of cursor.ids) {
              const count = Object.values(game.cardZones).reduce(
                (count, zone) =>
                  count + zone.cards.filter((card) => card === id).length,
                0,
              );
              if (count !== 1)
                throw new Error("Invalid response material location");
            }
            if (rules.method === "discard") {
              cursor.stage = 14;
              if (cursor.ids.length)
                return move(cursor.ids, rules.discardZone, false);
              break;
            }
            if (rules.method === "response") {
              cursor.stage = 9;
              if (cursor.ids.length)
                return move(cursor.ids, rules.tableZone, true);
              break;
            }
            cursor.local = {
              from: actor,
              to: [],
              card: response.card,
              m_isOwnerUse: true,
              m_addHistory: true,
              nullified_list: [],
              disresponsive_list: [],
            } as CardUse;
            cursor.eventData = structuredClone(cursor.local);
            return event("PreCardUsed", cursor.eventData);
          }
          case 8:
            if (!("tableZone" in rules))
              throw new Error("Invalid selection continuation");
            cursor.eventData = structuredClone(child!.event.data);
            if (cursor.ids.length)
              return move(cursor.ids, rules.tableZone, true);
            break;
          case 9:
            if (!("reveal" in rules))
              throw new Error("Invalid selection continuation");
            return operationStep(rules.reveal(actor, current()));
          case 10:
            if (rules.method === "response") {
              const response: CardResponseData = {
                m_card: current(),
                m_who: cursor.request.to,
                m_isUse: false,
                m_isRetrial: false,
                m_isHandcard: cursor.isHandcard,
                m_data: structuredClone(cursor.request.data),
              };
              return event("CardResponded", response);
            }
            return event("CardUsed", cursor.eventData);
          case 11: {
            if (rules.method === "response") break;
            if (rules.method !== "use")
              throw new Error("Invalid selection continuation");
            cursor.eventData = structuredClone(child!.event.data);
            const { card, storage, ledger } = readCardReference(
              game,
              cursor.validated!.reference,
            );
            cursor.suppressed = storage.flags.includes(
              "cardNotTriggerCardFinished",
            );
            if (!cursor.suppressed)
              return event("CardFinished", cursor.eventData);
            storage.flags = [];
            if (card.isNDTrick)
              delete ledger.roomTags[`${card.key}HegNullificationTargets`];
            const next = notice({
              kind: "finish",
              players: game.seatOrder.filter((player) => game.alive[player]),
            });
            if (next) return next;
            break;
          }
          case 12: {
            if (!("tableZone" in rules))
              throw new Error("Invalid selection continuation");
            if (rules.method === "response" && cursor.request.isProvision)
              break;
            if (cursor.suppressed) {
              const { card, ledger } = readCardReference(
                game,
                cursor.validated!.reference,
              );
              if (card.isSlash)
                delete ledger.playerTags[actor][`Jink_${card.key}`];
            }
            const ids = current().card.materialIDs.filter((id) =>
              Object.values(game.cardZones).some(
                (zone) => zone.place === "table" && zone.cards.includes(id),
              ),
            );
            if (ids.length) return move(ids, rules.discardZone, false);
            break;
          }
          case 13:
            if (rules.method === "response")
              return operationStep(
                rules.validateInResponseAfter(
                  actor,
                  structuredClone(cursor.original!),
                ),
              );
            if (rules.method !== "use")
              throw new Error("Invalid selection continuation");
            return operationStep(
              rules.validateAfter(actor, structuredClone(cursor.original!), {
                ...cursor.local!,
                card: current().card,
              }),
            );
          case 14:
            return { kind: "return", value: current() };
          case 17:
            return { kind: "return", value: null };
          default:
            throw new Error("Invalid response continuation");
        }
      }
    },
  };
}
