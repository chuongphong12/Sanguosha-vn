import type { PlayerID, TqsGameState, TqsPlayerViewState } from "./model";

export function createPlayerView(
  G: TqsGameState,
  viewerID: PlayerID | null,
): TqsPlayerViewState {
  const hidesGuanXingCards =
    G.prompt !== null &&
    "reason" in G.prompt &&
    G.prompt.reason === "guan-xing" &&
    viewerID !== G.prompt.responderID;
  const players = Object.fromEntries(
    Object.entries(G.players).map(([playerID, player]) => {
      const isViewer = viewerID === playerID;
      const canViewCandidates =
        isViewer && (G.status !== "lord-selection" || playerID === G.lordID);
      const canViewGeneral =
        isViewer ||
        playerID === G.lordID ||
        G.status === "playing" ||
        G.status === "ended";

      const { role, generalID, hand, ...rest } = player;

      return [
        playerID,
        {
          ...rest,
          hand: isViewer ? [...hand] : hand.map(() => "hidden"),
          role:
            isViewer || player.roleRevealed || G.status === "ended"
              ? role
              : null,
          generalID: canViewGeneral ? generalID : null,
          generalSelected: generalID !== null,
          generalCandidates: canViewCandidates
            ? [...player.generalCandidates]
            : [],
          activeSkillIDs: canViewGeneral ? [...player.activeSkillIDs] : [],
          maxHP: canViewGeneral ? player.maxHP : 0,
          hp: canViewGeneral ? player.hp : 0,
          equipment: { ...player.equipment },
          judgement: [...player.judgement],
        },
      ];
    }),
  );

  const { deck, ...G_rest } = G;

  return {
    ...G_rest,
    effectStack: [],
    players,
    deckSize: deck.length,
    discard: [...G.discard],
    processing: hidesGuanXingCards
      ? G.processing.map(() => "hidden")
      : [...G.processing],
    log: G.log.map((entry) => ({ ...entry })),
    cards: { ...G.cards },
  };
}
