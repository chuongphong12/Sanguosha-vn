import type {
  GeneralPairChoice,
  HegemonyPlayerView,
  HegemonySetupOptions,
  HegemonyState,
} from "./types";

export type * from "./types";
export {
  revealHegemonyGeneral,
  concealHegemonyGeneral,
  areHegemonyFriends,
  willBeHegemonyFriend,
} from "./identity";

/** Paired setup only: ready does not yet mean a playable match. */
export function createHegemonySetup(
  options: HegemonySetupOptions,
): HegemonyState {
  options = structuredClone(options);
  const seatOrder = Object.keys(options.offers);
  const ids = new Set(options.generals.map((g) => g.id));
  if (
    !seatOrder.length ||
    ids.size !== options.generals.length ||
    options.generals.some(
      (g) =>
        !g.id ||
        !g.kingdoms.length ||
        g.kingdoms.some((kingdom) => !kingdom) ||
        new Set(g.kingdoms).size !== g.kingdoms.length ||
        !Number.isInteger(g.headMaxHp) ||
        g.headMaxHp <= 0 ||
        !Number.isInteger(g.deputyMaxHp) ||
        g.deputyMaxHp <= 0,
    ) ||
    Object.values(options.offers).some(
      (offer) =>
        offer.length < 2 ||
        new Set(offer).size !== offer.length ||
        offer.some((id) => !ids.has(id)),
    )
  )
    throw new Error("Invalid Hegemony setup catalog or offers");
  return {
    rulesVersion: "hegemony-ce4e62b",
    status: "selecting-generals",
    seatOrder,
    generals: Object.fromEntries(options.generals.map((g) => [g.id, g])),
    bannedPairs: options.bannedPairs ?? [],
    players: Object.fromEntries(
      seatOrder.map((id) => [
        id,
        {
          id,
          head: { id: null, shown: false },
          deputy: { id: null, shown: false },
          candidates: options.offers[id],
          initialKingdom: null,
          kingdom: null,
          alliance: null,
          hp: 0,
          maxHp: 0,
          alive: true,
        },
      ]),
    ),
  };
}

export function selectGeneralPair(
  state: HegemonyState,
  actor: string,
  choice: unknown,
): boolean {
  if (!state.seatOrder.includes(actor) || !isGeneralPairChoice(choice))
    return false;
  const player = state.players[actor];
  if (
    state.status !== "selecting-generals" ||
    player.head.id !== null ||
    choice.head === choice.deputy ||
    !player.candidates.includes(choice.head) ||
    !player.candidates.includes(choice.deputy)
  )
    return false;
  const head = state.generals[choice.head];
  const deputy = state.generals[choice.deputy];
  // General::compareKingdomsWith is directional for careerist generals.
  const kingdoms =
    deputy.kingdoms[0] === "careerist"
      ? []
      : head.kingdoms[0] === "careerist"
        ? deputy.kingdoms
        : head.kingdoms.filter((kingdom) => deputy.kingdoms.includes(kingdom));
  const kingdom =
    choice.kingdom ?? (kingdoms.length === 1 ? kingdoms[0] : null);
  if (!kingdom || !kingdoms.includes(kingdom)) return false;
  if (
    state.bannedPairs.some(
      ([a, b]) =>
        (a === head.id && b === deputy.id) ||
        (a === deputy.id && b === head.id),
    ) ||
    Object.values(state.players).some((p) =>
      [p.head.id, p.deputy.id].some((id) => id === head.id || id === deputy.id),
    )
  )
    return false;
  player.head.id = head.id;
  player.deputy.id = deputy.id;
  player.initialKingdom = kingdom;
  player.hp = player.maxHp = Math.floor(
    (head.headMaxHp + deputy.deputyMaxHp) / 2,
  );
  if (Object.values(state.players).every((p) => p.head.id && p.deputy.id))
    state.status = "ready";
  return true;
}

function isGeneralPairChoice(choice: unknown): choice is GeneralPairChoice {
  return (
    typeof choice === "object" &&
    choice !== null &&
    "head" in choice &&
    typeof choice.head === "string" &&
    "deputy" in choice &&
    typeof choice.deputy === "string" &&
    (!("kingdom" in choice) || typeof choice.kingdom === "string")
  );
}

export function projectHegemonyState(
  state: HegemonyState,
  viewer: string | null,
): HegemonyPlayerView {
  return {
    rulesVersion: state.rulesVersion,
    status: state.status,
    seatOrder: [...state.seatOrder],
    players: Object.fromEntries(
      state.seatOrder.map((id) => {
        const p = state.players[id];
        const own = id === viewer;
        const shown = p.head.shown || p.deputy.shown;
        return [
          id,
          {
            id,
            head: {
              id: own || p.head.shown ? p.head.id : null,
              shown: p.head.shown,
            },
            deputy: {
              id: own || p.deputy.shown ? p.deputy.id : null,
              shown: p.deputy.shown,
            },
            selected: p.head.id !== null && p.deputy.id !== null,
            candidates: own ? [...p.candidates] : [],
            kingdom: shown ? p.kingdom : null,
            alliance: shown && p.alliance ? { ...p.alliance } : null,
            ...(own ? { initialKingdom: p.initialKingdom } : {}),
            hp: p.hp,
            maxHp: p.maxHp,
            alive: p.alive,
          },
        ];
      }),
    ),
  };
}
