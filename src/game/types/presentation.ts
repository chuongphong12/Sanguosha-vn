import { PlayerID, Role, DamageNature } from "./core";

export type ResponseKind = "played-card" | "selected-option" | "passed";

export interface PublicCardRef {
  id: string; // The specific card ID if public, or "hidden" if hidden
  name?: string; // The card definition name if public
}

export type PublicMaterialRef = "skill" | "equipment" | "hand";

export type PresentationBase = {
  sequence: number;
  matchEpoch: number;
  turn: number;
  correlationID: string;
  parentCorrelationID?: string;
};

export type PresentationEvent =
  | (PresentationBase & {
      kind: "card-committed";
      actorID: PlayerID;
      card: PublicCardRef;
      material?: PublicMaterialRef;
      targetIDs: PlayerID[];
    })
  | (PresentationBase & {
      kind: "response-window-opened";
      promptID: number;
      windowID: string;
      eligibleActorIDs: PlayerID[];
      targetID?: PlayerID;
      response: ResponseKind;
    })
  | (PresentationBase & {
      kind: "response-accepted";
      promptID: number;
      windowID: string;
      actorID: PlayerID;
      response: ResponseKind;
      remainingRequired?: number;
    })
  | (PresentationBase & {
      kind: "target-outcome";
      targetID: PlayerID;
      outcome: "evaded" | "damaged" | "prevented" | "redirected";
      amount?: number;
      nature?: DamageNature;
    })
  | (PresentationBase & {
      kind: "hp-changed";
      targetID: PlayerID;
      from: number;
      to: number;
      cause: "damage" | "loss-of-hp" | "recover";
    })
  | (PresentationBase & {
      kind: "skill-invoked";
      ownerID: PlayerID;
      skillID: string;
      targetIDs: PlayerID[];
    })
  | (PresentationBase & {
      kind: "role-revealed";
      playerID: PlayerID;
      role: Role;
    })
  | (PresentationBase & { kind: "player-died"; playerID: PlayerID })
  | (PresentationBase & { kind: "match-ended"; winners: PlayerID[] });

export interface PresentationStream {
  epoch: number;
  retentionFloor: number;
  highWatermark: number;
  events: PresentationEvent[];
}
