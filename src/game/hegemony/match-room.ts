import type { HegemonyGeneral, HegemonyState } from "./types";
import type { GameStartGame, GameStartNotice } from "./game-start";
import type { FreeChainGame } from "./general-rewards";
import type { CardFace } from "./wrapped-cards";

export interface MatchContent {
  version: string;
  generals: HegemonyGeneral[];
  /** Explicit package companion relation; not inferred from names. */
  companions: [string, string][];
  cards: { id: number; face: CardFace; isSlash: boolean; isNDTrick: boolean }[];
}

export type HegemonyRoom = GameStartGame &
  FreeChainGame & {
    playerPhases: Record<string, string>;
    /** Private startup presentation records, filtered separately for each viewer. */
    startupNotices: GameStartNotice[];
  };

export interface MatchDeck {
  /** Server-supplied ordered physical deck; initial shuffle remains its authority. */
  drawPile: number[];
  randomState: number;
}

export function validateMatchContent(content: MatchContent) {
  const ids = content.cards.map((card) => card.id);
  if (
    !content.version ||
    !content.cards.length ||
    new Set(ids).size !== ids.length ||
    content.cards.some(
      (card) =>
        !Number.isSafeInteger(card.id) ||
        card.id < 0 ||
        !card.face.name ||
        !card.face.className ||
        typeof card.face.suit !== "string" ||
        !Number.isSafeInteger(card.face.number) ||
        card.face.number < 0 ||
        card.face.number > 13 ||
        typeof card.face.skillName !== "string" ||
        typeof card.isSlash !== "boolean" ||
        typeof card.isNDTrick !== "boolean",
    ) ||
    content.companions.some(
      (pair) =>
        pair.length !== 2 ||
        pair[0] === pair[1] ||
        pair.some((id) => !content.generals.some((g) => g.id === id)),
    ) ||
    content.generals.some((g) => g.id === "anjiang")
  )
    throw new Error("Invalid match content");
}

export function validateMatchDeck(content: MatchContent, deck: MatchDeck) {
  if (
    !Number.isSafeInteger(deck.randomState) ||
    deck.randomState < 0 ||
    deck.randomState > 0xffffffff ||
    deck.drawPile.length !== content.cards.length ||
    new Set(deck.drawPile).size !== deck.drawPile.length ||
    deck.drawPile.some((id) => !content.cards.some((c) => c.id === id))
  )
    throw new Error("Invalid match deck");
}

const mappedRoles = new Map([
  ["wei", "lord"],
  ["shu", "loyalist"],
  ["wu", "rebel"],
  ["qun", "renegade"],
  ["god", "careerist"],
]);

/** Consumes paired setup; these Room maps become the only writable gameplay facts. */
export function createMatchRoom(
  setup: HegemonyState,
  content: MatchContent,
  deck: MatchDeck,
): HegemonyRoom {
  if (setup.status !== "ready") throw new Error("Match setup is not ready");
  const players = setup.seatOrder;
  const perSeat = <T>(value: (id: string) => T) =>
    Object.fromEntries(players.map((id) => [id, value(id)]));
  return {
    seatOrder: [...players],
    livingPlayers: [...players],
    seats: perSeat((id) => players.indexOf(id) + 1),
    currentPlayer: players[0],
    alive: perSeat((id) => setup.players[id].alive),
    hp: perSeat((id) => setup.players[id].hp),
    maxHp: perSeat((id) => setup.players[id].maxHp),
    identities: perSeat((id) => {
      const p = setup.players[id],
        head = setup.generals[p.head.id!];
      return {
        head: p.head.id!,
        deputy: p.deputy.id!,
        headKingdom: head.kingdoms[0],
        kingdom: p.initialKingdom!,
        role: mappedRoles.get(p.initialKingdom!) ?? p.initialKingdom!,
        headShown: false,
        deputyShown: false,
        lord: head.lord === true,
        generalLord: false,
        actualHeadLord: head.lord === true,
      };
    }),
    generalNames: perSeat((id) => [
      setup.players[id].head.id!,
      setup.players[id].deputy.id!,
    ]),
    displayedGenerals: perSeat(() => ({ head: "anjiang", deputy: "anjiang" })),
    generalCatalog: {
      anjiang: { kingdom: "god", doubleKingdom: false, lord: false },
      ...Object.fromEntries(
        content.generals.map((g) => [
          g.id,
          {
            kingdom: g.kingdoms[0],
            doubleKingdom: g.kingdoms.length > 1,
            lord: g.lord === true,
          },
        ]),
      ),
    },
    playerMarks: perSeat((id) => {
      const p = setup.players[id],
        head = p.head.id!,
        deputy = p.deputy.id!;
      const headDefinition = setup.generals[head],
        deputyDefinition = setup.generals[deputy];
      const companion =
        (headDefinition.lord === true &&
          deputyDefinition.kingdoms.includes(headDefinition.kingdoms[0])) ||
        (deputyDefinition.lord === true &&
          headDefinition.kingdoms.includes(deputyDefinition.kingdoms[0])) ||
        content.companions.some(
          ([a, b]) =>
            (a === head && b === deputy) || (a === deputy && b === head),
        );
      return {
        HalfMaxHpLeft:
          (setup.generals[head].headMaxHp +
            setup.generals[deputy].deputyMaxHp) %
          2,
        HaventShowGeneral: 1,
        HaventShowGeneral2: 1,
        ...(companion ? { CompanionEffect: 1 } : {}),
      };
    }),
    playerFlags: perSeat(() => []),
    playerHistory: perSeat(() => ({})),
    acquiredSkills: perSeat(() => ({ head: [], deputy: [] })),
    playerPhases: perSeat(() => "not-active"),
    removed: perSeat(() => false),
    chained: perSeat(() => false),
    currentdying: perSeat(() => ""),
    scenarioRoleShown: perSeat(() => false),
    bianhuaChoice: perSeat(() => null),
    surrenderPlayer: null,
    damageStack: [],
    gameResult: null,
    cardZones: {
      draw: { place: "draw", owner: null, cards: [...deck.drawPile] },
      reserved: { place: "draw", owner: null, cards: [] },
      discard: { place: "discard", owner: null, cards: [] },
      table: { place: "table", owner: null, cards: [] },
      transit: { place: "table", owner: null, cards: [] },
      ...Object.fromEntries(
        players.map((id) => [
          `hand:${id}`,
          { place: "hand" as const, owner: id, cards: [] },
        ]),
      ),
    },
    wrappedCards: Object.fromEntries(
      content.cards.map(({ id, face }) => [
        id,
        {
          ...structuredClone(face),
          modified: false,
          flags: [],
          tags: {},
        },
      ]),
    ),
    cardResources: {
      cards: Object.fromEntries(
        content.cards.map((card) => [
          `physical:${card.id}`,
          {
            kind: "wrapped" as const,
            id: card.id,
            key: String(card.id),
            isSlash: card.isSlash,
            isNDTrick: card.isNDTrick,
          },
        ]),
      ),
      playerTags: perSeat(() => ({})),
      roomTags: {},
    },
    pileRandom: { algorithm: "mulberry32-v1", state: deck.randomState },
    startupNotices: [],
  };
}
