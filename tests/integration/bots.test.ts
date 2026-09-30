import { afterEach, describe, expect, it } from "vitest";

import { MatchClient } from "../../src/client/MatchClient";

let match: MatchClient | undefined;

afterEach(() => {
  match?.destroy();
  match = undefined;
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Answers for the single human seat so the bots can keep the match moving. */
function humanMove(client: MatchClient): void {
  const G = client.state?.G;
  if (!G || G.status !== "playing") return;
  const me = client.currentViewerID;
  const prompt = G.prompt;
  if (prompt) {
    if (prompt.responderID !== me) return;
    if (prompt.kind === "option")
      client.move("answerPrompt", prompt.id, {
        kind: "option",
        choice: prompt.choices.includes("decline")
          ? "decline"
          : prompt.choices[0],
      });
    else client.move("answerPrompt", prompt.id, { kind: "pass" });
    return;
  }
  if (G.turn.activePlayerID !== me) return;
  if (G.turn.step === "play") client.move("endPlayPhase");
  else if (G.turn.step === "discard") {
    const player = G.players[me];
    const excess = player.hand.length - Math.max(0, player.hp);
    client.move("discardCards", player.hand.slice(0, Math.max(0, excess)));
  }
}

describe("local match with AI bots", () => {
  it.each([4, 6])(
    "every bot seat takes its turns in a %i-player match",
    async (numPlayers) => {
      match = new MatchClient({
        numPlayers,
        botsEnabled: true,
        fastPick: true,
        matchID: `bots-${numPlayers}-${Date.now()}`,
      });
      await expect.poll(() => match!.state).not.toBeNull();
      await expect
        .poll(() => match!.state!.G.status, { timeout: 5000 })
        .not.toBe("waiting-room");

      const seatsThatActed = new Set<string>();
      const deadline = Date.now() + 40000;
      while (Date.now() < deadline) {
        const G = match.state!.G;
        if (G.status === "ended") break;
        if (G.status === "playing" && !G.prompt)
          seatsThatActed.add(G.turn.activePlayerID);
        humanMove(match);
        if (seatsThatActed.size === numPlayers) break;
        await sleep(50);
      }

      expect([...seatsThatActed].sort()).toEqual(
        Array.from({ length: numPlayers }, (_, i) => String(i)),
      );
    },
    60000,
  );
});
