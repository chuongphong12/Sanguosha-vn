import { readExecutionCardUse, type CardUse } from "./card-on-use";
import { readRecipientFlags, type CardEffectGame } from "./card-effect";
import type {
  OperationHandler,
  TriggerOperation,
  TriggerData,
} from "./scheduler";
import type { CardFace, WrappedCard } from "./wrapped-cards";
import { readCardReference } from "./card-resources";
import { shufflePileCards, type DrawPileGame } from "./draw-pile";
import type { OperationStep } from "./scheduler";

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
    unwind: ({ game, normalContinuation, continuation, interruption }) => {
      if (normalContinuation === null || interruption.reason === "game-over")
        return { kind: "return", value: null };
      const cursor = normalContinuation as Cursor;
      if (
        !Number.isSafeInteger(cursor.stage) ||
        cursor.stage < 0 ||
        cursor.stage > 7
      )
        throw new Error("Invalid Room-use cleanup continuation");
      // Validation/history precede native useCard's try; wrapping/onUse/after do not.
      if (cursor.stage < 4 || continuation !== null)
        return { kind: "return", value: null };
      return {
        kind: "operation",
        operation: {
          name: "room-use-cleanup",
          data: readEntry(game, cursor.entry),
        },
        continuation: true,
      };
    },
  };
}

export type RoomUseCleanupGame = RoomUseGame &
  DrawPileGame & {
    /** Engine catalogue flags are distinct from each Room's live wrapped flags. */
    engineCardFlags: Record<number, string[]>;
  };
export interface RoomUseCleanupRules {
  discardZone: string;
  /** Engine catalogue order; enabled reflects the pinned bans/conversions. */
  physicalCards: readonly { id: number; enabled: boolean }[];
  notify: (
    notice:
      | { kind: "player-flag"; player: string; flag: string }
      | { kind: "card-flag"; id: number; flag: "-using" },
  ) => TriggerOperation | null;
}

/** Native Room::useCard catch body, running as a child of its unwind owner. */
export function createRoomUseCleanupOperation<G extends RoomUseCleanupGame>(
  rules: RoomUseCleanupRules,
): OperationHandler<G> {
  const catalogue = structuredClone(rules.physicalCards);
  if (
    new Set(catalogue.map((card) => card.id)).size !== catalogue.length ||
    catalogue.some(
      (card) =>
        !Number.isSafeInteger(card.id) ||
        card.id < 0 ||
        typeof card.enabled !== "boolean",
    )
  )
    throw new Error("Invalid cleanup catalogue");
  function location(game: G, id: number) {
    const zones = Object.values(game.cardZones).filter((zone) =>
      zone.cards.includes(id),
    );
    if (
      zones.length !== 1 ||
      zones[0].cards.filter((card) => card === id).length !== 1
    )
      throw new Error("Invalid cleanup physical location");
    return zones[0];
  }
  function validate(game: G, data: TriggerData) {
    const entry = readEntry(game, data);
    const discard = game.cardZones[rules.discardZone];
    if (
      !discard ||
      discard.place !== "discard" ||
      discard.owner !== null ||
      !Array.isArray(discard.cards)
    )
      throw new Error("Invalid cleanup discard zone");
    if (
      !game.pileRandom ||
      game.pileRandom.algorithm !== "mulberry32-v1" ||
      !Number.isInteger(game.pileRandom.state) ||
      game.pileRandom.state < 0 ||
      game.pileRandom.state > 0xffffffff
    )
      throw new Error("Invalid cleanup RNG");
    for (const card of catalogue) {
      const flags = game.engineCardFlags?.[card.id];
      if (
        !Array.isArray(flags) ||
        flags.some((flag) => typeof flag !== "string")
      )
        throw new Error("Invalid engine card flags");
      if (card.enabled) {
        location(game, card.id);
        const wrapped = game.wrappedCards?.[card.id];
        if (
          !wrapped ||
          !Array.isArray(wrapped.flags) ||
          wrapped.flags.some((flag) => typeof flag !== "string")
        )
          throw new Error("Invalid cleanup wrapped card");
      }
    }
    for (const id of entry.use.card.materialIDs) {
      if (!catalogue.some((card) => card.id === id))
        throw new Error("Missing cleanup material catalogue");
      location(game, id);
    }
    readRecipientFlags(game, entry.use.from);
    for (const player of game.seatOrder) {
      if (typeof game.alive[player] !== "boolean")
        throw new Error("Invalid cleanup alive state");
      if (!game.alive[player]) continue;
      readRecipientFlags(game, player);
      const tags = game.cardResources?.playerTags?.[player];
      if (!tags || typeof tags !== "object" || Array.isArray(tags))
        throw new Error("Invalid cleanup player tags");
    }
    return entry;
  }
  type CleanupCursor = {
    stage: number;
    entry: RoomCardUse;
    players: string[];
    player: number;
    flags: string[] | null;
    flag: number;
    pool: number[];
    index: number;
    current: number | null;
  };
  function move(
    ids: number[],
    reason: TriggerData,
    cursor: CleanupCursor,
  ): OperationStep {
    return {
      kind: "operation",
      operation: {
        name: "move-cards",
        data: {
          moves: [{ ids, to: rules.discardZone, open: true, reason }],
          forceVisible: true,
        },
      },
      continuation: cursor,
    };
  }
  return {
    name: "room-use-cleanup",
    validate: (game, operation) => {
      validate(game, operation.data);
    },
    run: ({ game, operation, continuation }): OperationStep => {
      const cursor: CleanupCursor =
        continuation === null
          ? {
              stage: 0,
              entry: validate(game, operation.data),
              players: [],
              player: 0,
              flags: null,
              flag: 0,
              pool: [],
              index: 0,
              current: null,
            }
          : (structuredClone(continuation) as CleanupCursor);
      while (true) {
        if (cursor.stage === 0) {
          const ids = cursor.entry.use.card.materialIDs.filter(
            (id) => location(game, id).place === "table",
          );
          cursor.stage = 1;
          if (ids.length)
            return move(
              ids,
              {
                kind: "unknown",
                actor: cursor.entry.use.from,
                skill: cursor.entry.use.card.skillName,
                eventName: "",
                target:
                  cursor.entry.use.to.length === 1
                    ? cursor.entry.use.to[0]
                    : null,
              },
              cursor,
            );
        }
        if (cursor.stage === 1) {
          const flags = readRecipientFlags(game, cursor.entry.use.from);
          if (!flags.includes("Global_ProcessBroken"))
            flags.push("Global_ProcessBroken");
          cursor.stage = 2;
          return {
            kind: "event",
            event: {
              name: "CardFinished",
              target: cursor.entry.use.from,
              data: structuredClone(cursor.entry.use),
            },
            continuation: cursor,
          };
        }
        if (cursor.stage === 2) {
          game.playerFlags[cursor.entry.use.from] = readRecipientFlags(
            game,
            cursor.entry.use.from,
          ).filter((flag) => flag !== "Global_ProcessBroken");
          cursor.players = game.seatOrder.filter(
            (player) => game.alive[player],
          );
          cursor.stage = 3;
        }
        if (cursor.stage === 3) {
          while (cursor.player < cursor.players.length) {
            const player = cursor.players[cursor.player];
            if (cursor.flags === null) {
              delete game.cardResources!.playerTags[player].Qinggang;
              cursor.flags = [...readRecipientFlags(game, player)];
              cursor.flag = 0;
            }
            while (cursor.flag < cursor.flags.length) {
              const flag = cursor.flags[cursor.flag++];
              if (
                flag !== "Global_GongxinOperator" &&
                !flag.endsWith("_InTempMoving")
              )
                continue;
              if (!readRecipientFlags(game, player).includes(flag)) continue;
              game.playerFlags[player] = readRecipientFlags(
                game,
                player,
              ).filter((value) => value !== flag);
              const notice =
                flag === "Global_GongxinOperator"
                  ? null
                  : rules.notify({
                      kind: "player-flag",
                      player,
                      flag: "-" + flag,
                    });
              if (notice)
                return {
                  kind: "operation",
                  operation: notice,
                  continuation: cursor,
                };
            }
            cursor.player++;
            cursor.flags = null;
          }
          cursor.stage = 4;
        }
        if (cursor.stage === 4) {
          // getRandomCards resets ENGINE flags, then filters and shuffles; not Room wrapper flags.
          for (const card of catalogue) game.engineCardFlags[card.id] = [];
          cursor.pool = catalogue
            .filter((card) => card.enabled)
            .map((card) => card.id);
          shufflePileCards(game, cursor.pool);
          cursor.stage = 5;
        }
        if (cursor.stage === 5) {
          if (cursor.index === cursor.pool.length)
            return { kind: "return", value: null };
          const id = (cursor.current = cursor.pool[cursor.index++]);
          cursor.stage = 6;
          const place = location(game, id).place;
          if (place === "table" || place === "judge")
            return move([id], null, cursor);
        }
        if (cursor.stage === 6) {
          const id = cursor.current!,
            wrapped = game.wrappedCards![id];
          cursor.stage = 5;
          if (wrapped.flags.includes("using")) {
            wrapped.flags = wrapped.flags.filter((flag) => flag !== "using");
            wrapped.modified = true;
            const notice = rules.notify({
              kind: "card-flag",
              id,
              flag: "-using",
            });
            if (notice)
              return {
                kind: "operation",
                operation: notice,
                continuation: cursor,
              };
          }
          continue;
        }
        throw new Error("Invalid Room-use cleanup continuation");
      }
    },
  };
}
