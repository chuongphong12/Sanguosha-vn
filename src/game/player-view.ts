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
      return [
        playerID,
        {
          ...player,
          role:
            isViewer || player.roleRevealed || G.status === "ended"
              ? player.role
              : null,
          generalID: canViewGeneral ? player.generalID : null,
          generalSelected: player.generalID !== null,
          generalCandidates: canViewCandidates
            ? [...player.generalCandidates]
            : [],
          activeSkillIDs: canViewGeneral ? [...player.activeSkillIDs] : [],
          maxHP: canViewGeneral ? player.maxHP : 0,
          hp: canViewGeneral ? player.hp : 0,
          hand: isViewer ? [...player.hand] : player.hand.map(() => "hidden"),
          equipment: { ...player.equipment },
          judgement: [...player.judgement],
        },
      ];
    }),
  );

  return {
    ...G,
    effectStack: [],
    players,
    deck: G.deck.map(() => "hidden"),
    discard: [...G.discard],
    processing: hidesGuanXingCards
      ? G.processing.map(() => "hidden")
      : [...G.processing],
    log: G.log.map((entry) => ({ ...entry })),
    cards: { ...G.cards },
  };
}
