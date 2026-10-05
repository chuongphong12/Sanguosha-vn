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

  const { deck, stream, ...G_rest } = G;

  const filteredEvents = stream.events.map((e) => {
    // We explicitly destructure allowed keys to prevent leaking anything else
    switch (e.kind) {
      case "card-committed":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          actorID: e.actorID,
          card: { ...e.card },
          material: e.material,
          targetIDs: [...e.targetIDs],
        };
      case "response-window-opened":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          promptID: e.promptID,
          windowID: e.windowID,
          eligibleActorIDs: [...e.eligibleActorIDs],
          targetID: e.targetID,
          response: e.response,
        };
      case "response-accepted":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          promptID: e.promptID,
          windowID: e.windowID,
          actorID: e.actorID,
          response: e.response,
          remainingRequired: e.remainingRequired,
        };
      case "target-outcome":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          targetID: e.targetID,
          outcome: e.outcome,
          amount: e.amount,
          nature: e.nature,
        };
      case "hp-changed":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          targetID: e.targetID,
          from: e.from,
          to: e.to,
          cause: e.cause,
        };
      case "skill-invoked":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          ownerID: e.ownerID,
          skillID: e.skillID,
          targetIDs: [...e.targetIDs],
        };
      case "role-revealed":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          playerID: e.playerID,
          role: e.role,
        };
      case "player-died":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          playerID: e.playerID,
        };
      case "match-ended":
        return {
          sequence: e.sequence,
          matchEpoch: e.matchEpoch,
          turn: e.turn,
          correlationID: e.correlationID,
          parentCorrelationID: e.parentCorrelationID,
          kind: e.kind,
          winners: [...e.winners],
        };
      default:
        // @ts-expect-error fallback for unknown events
        return { ...e };
    }
  });

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
    stream: {
      epoch: stream.epoch,
      retentionFloor: stream.retentionFloor,
      highWatermark: stream.highWatermark,
      events: filteredEvents as any,
    },
  };
}
