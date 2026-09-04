import { Server, Origins } from "boardgame.io/server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { TqsGame } from "../src/game/TqsGame";

const PORT = Number(process.env.PORT ?? 8000);
const roomPasswords = new Map<string, string>();

const server = Server({
  games: [TqsGame],
  origins: [Origins.LOCALHOST, /^https?:\/\//],
});

const originalPost = server.router.post.bind(server.router);
(server.router as any).post = function (path: string, ...middlewares: any[]) {
  if (path === "/games/:name/create") {
    const ourMiddleware = async (ctx: any, next: any) => {
      await next();
      // After match created
      const matchID = ctx.body?.matchID;
      const pwd = ctx.request.body?.setupData?.password;
      if (matchID && pwd) {
        roomPasswords.set(matchID, pwd);
        const fetched = await (server as any).db.fetch(matchID, {
          metadata: true,
        });
        if (fetched.metadata) {
          delete fetched.metadata.setupData.password;
          fetched.metadata.setupData.hasPassword = true;
          await (server as any).db.setMetadata(matchID, fetched.metadata);
        }
      }
    };
    middlewares.splice(middlewares.length - 1, 0, ourMiddleware);
  } else if (path === "/games/:name/:id/join") {
    const ourMiddleware = async (ctx: any, next: any) => {
      const matchID = ctx.params.id;
      const inputPassword = ctx.request.body?.data?.password;
      const expectedPassword = roomPasswords.get(matchID);
      if (expectedPassword && inputPassword !== expectedPassword) {
        ctx.status = 401;
        ctx.body = { error: "Sai mật khẩu!" };
        return;
      }
      await next();
    };
    middlewares.splice(middlewares.length - 1, 0, ourMiddleware);
  }
  return originalPost(path, ...middlewares);
};

server.run(PORT, (): void => {
  console.log(`TQS boardgame.io master listening on http://localhost:${PORT}`);
});
