import { describe, expect, it } from "vitest";

import { lobbyUrl } from "../../src/app/utils/lobbyUrl";

describe("lobbyUrl", () => {
  it("drops the match and local-game parameters so the lobby shows", () => {
    expect(lobbyUrl("?matchID=abc")).toBe("/");
    expect(lobbyUrl("?mode=local&numPlayers=4&seed=x&fastpick=1&bots=1")).toBe(
      "/",
    );
    expect(lobbyUrl("")).toBe("/");
  });

  it("keeps the backend override used to reach a non-default server", () => {
    expect(lobbyUrl("?matchID=abc&backend=http%3A%2F%2Flocalhost%3A8000")).toBe(
      "/?backend=http%3A%2F%2Flocalhost%3A8000",
    );
  });
});
