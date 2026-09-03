import { Origins, Server } from "boardgame.io/server";

import { TqsGame } from "../src/game/TqsGame";

const PORT = Number(process.env.PORT ?? 8000);

const server = Server({
  games: [TqsGame],
  origins: [Origins.LOCALHOST],
});

server.run(PORT, (): void => {
  console.log(`TQS boardgame.io master listening on http://localhost:${PORT}`);
});
