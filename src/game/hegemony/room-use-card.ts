import { readExecutionCardUse, type CardUse } from "./card-on-use";
import { readRecipientFlags, type CardEffectGame } from "./card-effect";
import type {
  OperationHandler,
  TriggerOperation,
  TriggerData,
} from "./scheduler";
import type { CardFace, WrappedCard } from "./wrapped-cards";
import { readCardReference } from "./card-resources";

export interface RoomUseGame extends CardEffectGame {
  playerHistory: Record<string, Record<string, number>>;
  wrappedCards?: Record<number, WrappedCard & { showSkill?: string }>;
}
export type RoomCardUse = { use: CardUse; reference: string };
export interface RoomCardMetadata {
  identity: string;
  realIdentity: string;
  virtual: boolean;
  lua: boolean;
  delayed: boolean;
  handlingMethod: string;
  canRecast: boolean;
  face: CardFace;
  showSkill: string;
}
export interface RoomUseRules<G extends RoomUseGame> {
  /** Private package authorities; callbacks never enter saved frames or projections. */
  parse: (game: Readonly<G>, entry: RoomCardUse) => RoomCardUse;
  inPlay: (game: Readonly<G>, player: string) => boolean;
  validate: (entry: RoomCardUse) => TriggerOperation;
  onUse: (entry: RoomCardUse) => TriggerOperation;
  after: (entry: RoomCardUse) => TriggerOperation;
  metadata: (game: Readonly<G>, entry: RoomCardUse) => RoomCardMetadata;
  limited: (game: Readonly<G>, entry: RoomCardUse, method: string) => boolean;
  notify: (notice: TriggerData) => TriggerOperation | null;
}
function readEntry(game: RoomUseGame, data: TriggerData): RoomCardUse {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.reference !== "string"
  )
    throw new Error("Invalid Room card entry");
  const use = readExecutionCardUse(game, data.use);
  readCardReference(game, data.reference);
  return { reference: data.reference, use };
}
type Cursor = {
  stage: number;
  entry: RoomCardUse;
  after: RoomCardUse | null;
  returned: RoomCardUse | null;
  key: string;
  addHistory: boolean;
  converted: boolean;
  history: string[];
  slashCount: number;
};

export function createRoomUseCardOperation<G extends RoomUseGame>(
  rules: RoomUseRules<G>,
): OperationHandler<G> {
  return {
    name: "room-use-card",
    validate: (game, operation) => {
      readEntry(game, operation.data);
      const data = operation.data as { addHistory?: TriggerData };
      if (data.addHistory !== undefined && typeof data.addHistory !== "boolean")
        throw new Error("Invalid history policy");
    },
    run: ({ game, operation, continuation, operationChild }) => {
      const cursor: Cursor =
        continuation === null
          ? {
              stage: 0,
              entry: rules.parse(
                structuredClone(game),
                structuredClone(operation.data) as RoomCardUse,
              ),
              key: "",
              addHistory:
                (operation.data as { addHistory?: boolean }).addHistory ?? true,
              converted: false,
              after: null,
              returned: null,
              history: [],
              slashCount: 0,
            }
          : (structuredClone(continuation) as Cursor);
      readExecutionCardUse(game, cursor.entry.use);
      if (cursor.stage === 0) {
        const original = readEntry(game, operation.data);
        const incoming = structuredClone(
          readCardReference(game, original.reference).storage,
        );
        cursor.entry = readEntry(game, cursor.entry);
        const parsed = readCardReference(game, cursor.entry.reference);
        for (const flag of incoming.flags) {
          if (flag === ".") parsed.storage.flags = [];
          else if (flag.startsWith("-"))
            parsed.storage.flags = parsed.storage.flags.filter(
              (value) => value !== flag.slice(1),
            );
          else if (!parsed.storage.flags.includes(flag))
            parsed.storage.flags.push(flag);
          if (parsed.card.kind === "wrapped")
            game.wrappedCards![parsed.card.id].modified = true;
        }
        parsed.storage.tags = structuredClone(incoming.tags);
        cursor.entry.use.card.flags = [...parsed.storage.flags];
        const use = cursor.entry.use as CardUse & {
          m_addHistory: boolean;
          m_isHandcard: boolean;
        };
        use.m_addHistory = false;
        use.m_isHandcard =
          use.card.materialIDs.length > 0 &&
          use.card.materialIDs.every((id) =>
            Object.values(game.cardZones).some(
              (zone) =>
                zone.owner === original.use.from &&
                zone.place === "hand" &&
                zone.cards.includes(id),
            ),
          );
        const meta = rules.metadata(
          structuredClone(game),
          structuredClone(cursor.entry),
        );
        if (
          rules.limited(
            structuredClone(game),
            structuredClone(cursor.entry),
            meta.handlingMethod,
          ) &&
          (!meta.canRecast ||
            rules.limited(
              structuredClone(game),
              structuredClone(cursor.entry),
              "recast",
            ))
        )
          return { kind: "return", value: false };
        cursor.key = meta.lua
          ? `#${cursor.entry.use.card.name}`
          : cursor.entry.use.card.className;
        const history = game.playerHistory[cursor.entry.use.from];
        if (
          !history ||
          ["Slash", "ThunderSlash", "FireSlash"].some(
            (key) => !Number.isSafeInteger(history[key] ?? 0),
          )
        )
          throw new Error("Invalid Slash history");
        cursor.slashCount =
          (history.Slash ?? 0) +
          (history.ThunderSlash ?? 0) +
          (history.FireSlash ?? 0);
        if (!Number.isSafeInteger(cursor.slashCount))
          throw new Error("Slash history overflow");
        cursor.stage++;
        return {
          kind: "operation",
          operation: rules.validate(structuredClone(cursor.entry)),
          continuation: cursor,
        };
      }
      if (cursor.stage === 1) {
        if (!operationChild || operationChild.value === null)
          return { kind: "return", value: false };
        const result = operationChild.value as {
          entry: RoomCardUse;
          validated: RoomCardUse;
        };
        cursor.entry = readEntry(game, result.entry);
        const returned = readEntry(game, result.validated);
        cursor.returned = returned;
        const localMeta = rules.metadata(
          structuredClone(game),
          structuredClone(cursor.entry),
        );
        const returnedMeta = rules.metadata(structuredClone(game), returned);
        cursor.converted = localMeta.realIdentity !== returnedMeta.identity;
        cursor.after = structuredClone(cursor.entry);
        if (cursor.converted)
          cursor.after.use.card = structuredClone(returned.use.card);
        cursor.stage++;
        const { use } = cursor.entry;
        if (
          cursor.addHistory &&
          rules.inPlay(structuredClone(game), use.from)
        ) {
          (use as CardUse & { m_addHistory: boolean }).m_addHistory = true;
          (
            cursor.after.use as CardUse & { m_addHistory: boolean }
          ).m_addHistory = true;
          cursor.history.push(cursor.key);
          const skill = result.validated.use.card.skillName.replace(/^_/, "");
          if (skill) {
            cursor.history.push(`ViewAsSkill_${skill}Card`);
          }
        }
      }
      if (cursor.stage === 2) {
        while (cursor.history.length) {
          const key = cursor.history.shift()!;
          const player = cursor.entry.use.from;
          const history = game.playerHistory[player];
          if (!history || !Number.isSafeInteger(history[key] ?? 0))
            throw new Error("Invalid card history");
          const count = (history[key] ?? 0) + 1;
          if (!Number.isSafeInteger(count))
            throw new Error("Card history overflow");
          history[key] = count;
          const notice = rules.notify({ kind: "history", player, key });
          if (notice)
            return {
              kind: "operation",
              operation: notice,
              continuation: cursor,
            };
        }
        cursor.stage++;
      }
      if (cursor.stage === 3) {
        if (cursor.converted) {
          cursor.stage = 6;
          return {
            kind: "operation",
            operation: {
              name: "room-use-card",
              data: {
                use: structuredClone(cursor.after!.use),
                reference: cursor.returned!.reference,
              },
            },
            continuation: cursor,
          };
        }
        cursor.stage++;
        const meta = rules.metadata(
          structuredClone(game),
          structuredClone(cursor.returned!),
        );
        const ids = cursor.returned!.use.card.materialIDs;
        if (meta.delayed && meta.virtual && ids.length === 1) {
          const wrapped = game.wrappedCards?.[ids[0]];
          if (!wrapped) throw new Error("Missing delayed-trick wrapper");
          Object.assign(wrapped, {
            name: meta.face.name,
            className: meta.face.className,
            suit: meta.face.suit,
            number: meta.face.number,
            skillName: meta.face.skillName,
            modified: true,
          });
          const notice = rules.notify({ kind: "update", id: ids[0] });
          if (notice)
            return {
              kind: "operation",
              operation: notice,
              continuation: cursor,
            };
        }
      }
      if (cursor.stage === 4) {
        cursor.stage++;
        const meta = rules.metadata(
          structuredClone(game),
          structuredClone(cursor.returned!),
        );
        const ids = cursor.returned!.use.card.materialIDs;
        if (meta.delayed && meta.virtual && ids.length === 1)
          game.wrappedCards![ids[0]].showSkill = meta.showSkill;
        const local = readCardReference(game, cursor.entry.reference);
        if (local.card.isSlash && cursor.addHistory && cursor.slashCount > 0) {
          const flags = readRecipientFlags(game, cursor.entry.use.from);
          if (!flags.includes("Global_MoreSlashInOneTurn"))
            flags.push("Global_MoreSlashInOneTurn");
        }
        const localMeta = rules.metadata(
          structuredClone(game),
          structuredClone(cursor.entry),
        );
        if (!localMeta.virtual) {
          if (local.card.kind !== "wrapped")
            throw new Error("Missing physical card wrapper");
          const wrapped = game.wrappedCards![local.card.id];
          const notice = rules.notify({
            kind: wrapped.modified ? "update" : "reset",
            id: local.card.id,
          });
          if (notice)
            return {
              kind: "operation",
              operation: notice,
              continuation: cursor,
            };
        }
      }
      if (cursor.stage === 5) {
        cursor.stage++;
        return {
          kind: "operation",
          operation: rules.onUse(structuredClone(cursor.entry)),
          continuation: cursor,
        };
      }
      if (cursor.stage === 6) {
        cursor.stage++;
        return {
          kind: "operation",
          operation: rules.after(structuredClone(cursor.after!)),
          continuation: cursor as TriggerData,
        };
      }
      return { kind: "return", value: true };
    },
  };
}
