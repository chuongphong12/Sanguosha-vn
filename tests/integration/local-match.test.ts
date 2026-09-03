import { afterEach, describe, expect, it } from "vitest";

import { LocalMatch } from "../../src/client/LocalMatch";
import { GENERALS_BY_ID } from "../../src/game/catalog/generals";

let match: LocalMatch | undefined;

afterEach(() => {
  match?.destroy();
  match = undefined;
});

describe("local hot-seat match", () => {
  it("selects generals through four filtered clients and starts the match", async () => {
    match = new LocalMatch(4, `integration-${Date.now()}`);
    await expect.poll(() => match!.state).not.toBeNull();

    const initial = match.state!.G;
    match.switchViewer(initial.lordID, () => undefined);
    const lordView = match.state!.G;
    expect(lordView.players[initial.lordID].generalCandidates).toHaveLength(5);
    match.move(
      "selectGeneral",
      lordView.players[initial.lordID].generalCandidates[0],
    );
    await expect.poll(() => match!.state!.G.status).toBe("general-selection");

    for (const playerID of match.playerIDs.filter(
      (id) => id !== initial.lordID,
    )) {
      match.switchViewer(playerID, () => undefined);
      const view = match.state!.G;
      expect(view.players[playerID].generalCandidates).toHaveLength(3);
      match.move("selectGeneral", view.players[playerID].generalCandidates[0]);
    }

    await expect.poll(() => match!.state!.G.status).toBe("playing");

    // Yuan Shu's Wang Zun isn't lord-exclusive: whichever seat draws him may
    // get an "activate/decline" prompt during the very first Prepare step,
    // which legitimately holds turn.step at "prepare" until answered. Drain
    // any such prompt (declining, to keep the scenario deterministic) before
    // asserting the turn has reached "play".
    const viewerBeforeDrain = match.currentViewerID;
    for (let guard = 0; guard < 8 && match!.state!.G.prompt; guard += 1) {
      const prompt = match!.state!.G.prompt;
      match.switchViewer(prompt.responderID, () => undefined);
      if (prompt.kind === "option")
        match.move("answerPrompt", prompt.id, {
          kind: "option",
          choice: "decline",
        });
      else match.move("answerPrompt", prompt.id, { kind: "pass" });
      await expect.poll(() => match!.state!.G.prompt?.id ?? null).toBe(null);
    }
    match.switchViewer(viewerBeforeDrain, () => undefined);

    const started = match.state!.G;
    expect(started.turn.activePlayerID).toBe(started.lordID);
    expect(started.turn.step).toBe("play");
    expect(started.players[match.currentViewerID].hand).toHaveLength(4);

    const opponentID = started.seatOrder.find(
      (id) => id !== match!.currentViewerID,
    )!;
    const opponentHandSize = opponentID === started.lordID ? 6 : 4;
    expect(started.players[opponentID].hand).toEqual(
      Array.from({ length: opponentHandSize }, () => "hidden"),
    );

    match.switchViewer(started.lordID, () => undefined);
    match.move("endPlayPhase");
    await expect.poll(() => match!.state!.G.turn.step).toBe("discard");
    match.move("resumePlayPhase");
    await expect.poll(() => match!.state!.G.turn.step).toBe("play");
    match.move("endPlayPhase");
    await expect.poll(() => match!.state!.G.turn.step).toBe("discard");
    const lordHand = match.state!.G.players[started.lordID].hand;
    match.move("discardCards", lordHand.slice(0, 2));

    const nextPlayerID = started.seatOrder[1];
    await expect
      .poll(() => match!.state!.G.turn.activePlayerID)
      .toBe(nextPlayerID);
    match.switchViewer(nextPlayerID, () => undefined);
    for (let guard = 0; guard < 8 && match!.state!.G.prompt; guard += 1) {
      const prompt = match!.state!.G.prompt;
      if (prompt.kind === "option")
        match.move("answerPrompt", prompt.id, {
          kind: "option",
          choice: "decline",
        });
      else match.move("answerPrompt", prompt.id, { kind: "pass" });
      await expect.poll(() => match!.state!.G.prompt?.id ?? null).toBe(null);
    }
    expect(match.state!.G.turn.step).toBe("play");
    const nextDrawAmount = GENERALS_BY_ID[
      match.state!.G.players[nextPlayerID].generalID!
    ].skillIDs.includes("ying-zi")
      ? 3
      : 2;
    expect(match.state!.G.players[nextPlayerID].hand).toHaveLength(
      4 + nextDrawAmount,
    );
  });
});
