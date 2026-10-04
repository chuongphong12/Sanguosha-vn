import { describe, expect, it } from "vitest";

import { answerCardPrompt, declareCardUse } from "../../src/game/cardEngine";
import {
  createStartedGame,
  giveCard,
  identityShuffle,
  resetHands,
} from "../helpers/game";

describe("nullification window", () => {
  it("tells clients who has already passed, so nobody is asked twice", () => {
    const G = createStartedGame(4);
    G.config.autoSkipWuxie = false;
    resetHands(G);
    const sourceID = G.turn.activePlayerID;
    const trickID = giveCard(G, sourceID, "ex-nihilo");
    declareCardUse(
      G,
      sourceID,
      { cardID: trickID, targetIDs: [] },
      identityShuffle,
    );

    expect(G.prompt).toMatchObject({ reason: "nullification" });
    const first = G.prompt!.responderID;
    expect(
      answerCardPrompt(
        G,
        first,
        G.prompt!.id,
        { kind: "pass" },
        identityShuffle,
      ),
    ).toBe(true);

    const prompt = G.prompt as { passedPlayerIDs?: string[] } | null;
    expect(prompt?.passedPlayerIDs).toContain(first);
  });
});
