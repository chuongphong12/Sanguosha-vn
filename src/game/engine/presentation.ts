import { PlayerID, TqsGameState } from "../types";
import { PresentationEvent } from "../types";

export function emitPresentationEvent(
  G: TqsGameState,
  eventData: Omit<PresentationEvent, "sequence" | "matchEpoch" | "turn">,
) {
  const nextSeq =
    G.stream.events.length > 0
      ? G.stream.events[G.stream.events.length - 1].sequence + 1
      : 1;

  const event: PresentationEvent = {
    ...eventData,
    sequence: nextSeq,
    matchEpoch: G.stream.epoch,
    turn: G.turn.number,
  } as PresentationEvent;

  G.stream.events.push(event);

  // Maintain bounded ring buffer size (e.g. max 100 events)
  const MAX_EVENTS = 100;
  if (G.stream.events.length > MAX_EVENTS) {
    G.stream.events.shift();
    if (G.stream.events.length > 0) {
      G.stream.retentionFloor = G.stream.events[0].sequence;
    }
  }
  G.stream.highWatermark = event.sequence;
}
