import { PlayerID, TqsGameState } from "../types";
import { PresentationEvent } from "../types";

type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;
export type PresentationEventInput = DistributiveOmit<
  PresentationEvent,
  "sequence" | "matchEpoch" | "turn" | "correlationID"
> & { correlationID?: string };

export function emitPresentationEvent(
  G: TqsGameState,
  eventData: PresentationEventInput,
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
