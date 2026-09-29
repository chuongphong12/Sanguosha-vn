import { afterEach, describe, expect, it } from "vitest";

import { MatchClient } from "../../src/client/MatchClient";
import { handLimit } from "../../src/game/rules";
import type { TqsGameState } from "../../src/game/model";

let match: MatchClient | undefined;

afterEach(() => {
  match?.destroy();
  match = undefined;
});

// Plays seat 0 as a human who always does the minimum, so every other
// decision in the match comes from the heuristic bots.
const actAsPassiveHuman = (current: MatchClient): void => {
  const G = current.state?.G;
  if (!G) return;
  const me = G.players["0"];
  const isSelecting =
    G.status === "lord-selection" || G.status === "general-selection";
  if (isSelecting && !me.generalSelected && me.generalCandidates.length > 0) {
    current.move("selectGeneral", me.generalCandidates[0]);
    return;
  }
  const prompt = G.prompt;
  // Nullification and rescue are open to every seat that has not passed yet,
  // whoever the named responder is (as in the table UI).
  const isOpenPrompt =
    prompt?.kind === "card-response" &&
    (prompt.reason === "nullification" || prompt.reason === "rescue");
  const mustAnswer = isOpenPrompt
    ? !prompt.passedPlayerIDs?.includes("0")
    : prompt?.responderID === "0";
  if (prompt && mustAnswer) {
    const answer =
      prompt.kind === "option"
        ? { kind: "option", choice: prompt.choices.at(-1) }
        : { kind: "pass" };
    current.move("answerPrompt", prompt.id, answer);
    return;
  }
  if (G.status !== "playing" || G.turn.activePlayerID !== "0") return;
  if (G.turn.step === "play") current.move("endPlayPhase");
  if (G.turn.step === "discard")
    current.move(
      "discardCards",
      me.hand.slice(
        0,
        me.hand.length - handLimit(G as unknown as TqsGameState, "0"),
      ),
    );
};

describe("offline match against bots", () => {
  it("lets the bots pick generals and play full rounds", async () => {
    match = new MatchClient({
      numPlayers: 4,
      matchID: `offline-bots-${Date.now()}`,
      botsEnabled: true,
    });
    const timer = setInterval(() => actAsPassiveHuman(match!), 50);

    try {
      await expect
        .poll(() => match!.state?.G.status, { timeout: 5000 })
        .toBe("playing");
      await expect
        .poll(
          () => {
            const G = match!.state!.G;
            return G.status === "ended" || G.turn.number > 4;
          },
          { timeout: 20000, interval: 100 },
        )
        .toBe(true);
    } finally {
      clearInterval(timer);
    }

    const G = match.state!.G;
    const botActions = G.log.filter((entry) =>
      /sử dụng|trang bị/.test(entry.message),
    );
    expect(botActions.length).toBeGreaterThan(0);
  }, 30000);
});
