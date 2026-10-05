import type { GamePrompt, PlayerID, TqsGameState } from "../../../game/model";

type Prompt = GamePrompt;

/** What this needs from a game state, satisfied by both full and player-view state. */
interface ActorState {
  status: TqsGameState["status"];
  lordID: PlayerID;
  seatOrder: PlayerID[];
  turn: { activePlayerID: PlayerID };
  prompt: Prompt | null;
  players: Record<
    PlayerID,
    { alive: boolean; generalSelected?: boolean; generalID?: string | null }
  >;
}

const SIMULTANEOUS_REASONS = new Set([
  "rescue",
  "nullification",
  "arrow-barrage",
  "barbarian-invasion",
]);

/**
 * Who has to act next.
 *
 * In "simultaneous" windows (AOE, rescue, nullification) the engine fills
 * `responderID` with the active player only for compatibility; anyone who has
 * not passed may answer. Shared-device play needs a concrete person to hand
 * the device to, so take the first pending player in turn order.
 */
export function requiredActorID(G: ActorState): PlayerID | null {
  const prompt = G.prompt;
  if (prompt) return promptActor(G, prompt);
  if (G.status === "lord-selection") return G.lordID;
  if (G.status === "general-selection")
    return (
      G.seatOrder.find((id) => {
        const player = G.players[id];
        return !(player.generalSelected ?? player.generalID != null);
      }) ?? null
    );
  if (G.status === "playing") return G.turn.activePlayerID;
  return null;
}

function promptActor(G: ActorState, prompt: Prompt): PlayerID {
  if (
    prompt.kind !== "card-response" ||
    !SIMULTANEOUS_REASONS.has(prompt.reason)
  )
    return prompt.responderID;

  const isAoe =
    prompt.reason === "arrow-barrage" || prompt.reason === "barbarian-invasion";
  const passed = prompt.passedPlayerIDs ?? [];
  const startIndex = Math.max(0, G.seatOrder.indexOf(G.turn.activePlayerID));
  const inTurnOrder = G.seatOrder.map(
    (_, offset) => G.seatOrder[(startIndex + offset) % G.seatOrder.length],
  );
  const pending = inTurnOrder.find(
    (id) =>
      G.players[id].alive &&
      !passed.includes(id) &&
      !(isAoe && id === prompt.sourceID),
  );
  return pending ?? prompt.responderID;
}
