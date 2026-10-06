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

const SIMULTANEOUS_REASONS = new Set(["nullification"]);

/**
 * Who has to act next.
 *
 * Nullification accepts any living player who has not passed. Shared-device
 * play hands the device to the first pending seat; ordered responses use the
 * engine's responder directly.
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

  const passed = prompt.passedPlayerIDs ?? [];
  const startIndex = Math.max(0, G.seatOrder.indexOf(G.turn.activePlayerID));
  const inTurnOrder = G.seatOrder.map(
    (_, offset) => G.seatOrder[(startIndex + offset) % G.seatOrder.length],
  );
  const pending = inTurnOrder.find(
    (id) => G.players[id].alive && !passed.includes(id),
  );
  return pending ?? prompt.responderID;
}
