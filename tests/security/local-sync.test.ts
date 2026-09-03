import { Client } from "boardgame.io/client";
import { Local } from "boardgame.io/multiplayer";
import { afterEach, describe, expect, it } from "vitest";

import { TqsGame } from "../../src/game/TqsGame";
import type { TqsGameState } from "../../src/game/model";

const clients: Array<ReturnType<typeof Client<TqsGameState>>> = [];

afterEach(() => {
  for (const client of clients) client.stop();
  clients.length = 0;
});

describe("patched local sync", () => {
  it("filters both current and initial state", async () => {
    const client = Client<TqsGameState>({
      game: TqsGame,
      playerID: "1",
      numPlayers: 4,
      multiplayer: Local(),
      debug: false,
    });
    clients.push(client);
    client.start();

    await expect.poll(() => client.getState()).not.toBeNull();
    const current = client.getState()!;
    const initial = client.getInitialState();
    const opponentID = Object.keys(current.G.players).find((id) => id !== "1")!;

    expect(current.G.players["1"].role).not.toBeNull();
    expect(current.G.players[opponentID].role).toBe(
      current.G.players[opponentID].roleRevealed ? "lord" : null,
    );
    expect(initial.G.players["1"].role).not.toBeNull();
    expect(initial.G.players[opponentID].role).toBe(
      initial.G.players[opponentID].roleRevealed ? "lord" : null,
    );
    expect(initial.plugins.random.data).toBeUndefined();
  });
});
