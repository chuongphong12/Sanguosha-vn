/** THROWAWAY custom handlers. Stock lobby/sync handlers are never registered. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { Server } from "socket.io";
import { createPrototype, type Auth, type Command } from "./session";
import type { ServiceClock } from "./deadlines";

export async function startProofServer(
  path: string,
  options: {
    port?: number;
    dropOneCommandAck?: boolean;
    beforeBind?: (disconnected: AbortSignal) => Promise<void>;
    clock?: ServiceClock;
  } = {},
) {
  let announce = () => {};
  const session = await createPrototype(path, {
    clock: options.clock,
    onChange: () => announce(),
  });
  const http = createServer(async (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(await readFile(new URL("./demo.html", import.meta.url)));
  });
  const io = new Server(http, {
    transports: ["websocket"],
    maxHttpBufferSize: 16_384,
  });
  const bound = new Map<string, Auth>();
  let drop = options.dropOneCommandAck ?? false;
  let publication = Promise.resolve();
  function publish() {
    const next = publication.then(async () => {
      for (const [id, auth] of bound) {
        try {
          io.to(id).emit("view", await session.view(auth));
        } catch {
          io.to(id).emit("room-closed");
          bound.delete(id);
        }
      }
    });
    publication = next.catch(() => {});
    return next;
  }
  announce = () => {
    void publish().catch(() => {});
  };
  io.on("connection", (socket) => {
    let binding = false;
    const disconnected = new AbortController();
    async function bind(acquire: () => Promise<Auth>) {
      if (bound.has(socket.id) || binding) throw new Error("Already bound");
      binding = true;
      try {
        // Test-only latency gate; the actual session still commits to real disk.
        await options.beforeBind?.(disconnected.signal);
        const auth = await acquire();
        if (!socket.connected) {
          await session.disconnect(auth);
          throw new Error("Disconnected during bind");
        }
        bound.set(socket.id, auth);
        return auth;
      } finally {
        binding = false;
      }
    }
    socket.on(
      "request",
      async (
        request: {
          action: string;
          room?: string;
          auth?: Auth;
          command?: Command;
        },
        ack: (result: unknown) => void,
      ) => {
        if (typeof ack !== "function") return;
        try {
          let auth = bound.get(socket.id),
            result: unknown;
          if (request.action === "create") {
            auth = await bind(() =>
              session.create(socket.id, () => socket.connected),
            );
            result = auth;
          } else if (request.action === "join") {
            auth = await bind(() =>
              session.join(
                request.room ?? "",
                socket.id,
                () => socket.connected,
              ),
            );
            result = auth;
          } else if (request.action === "connect") {
            if (auth || !request.auth) throw new Error("Invalid connect");
            const retained = request.auth;
            auth = await bind(() =>
              session.connect(
                retained,
                socket.id,
                false,
                () => socket.connected,
              ),
            );
            result = auth;
          } else {
            if (!auth) throw new Error("Unauthenticated socket");
            if (request.action === "view") result = await session.view(auth);
            else if (request.action === "take") {
              auth = await session.connect(
                auth,
                socket.id,
                true,
                () => socket.connected,
              );
              bound.set(socket.id, auth);
              result = auth;
            } else if (request.action === "command") {
              result = await session.command(auth, request.command!);
              if (drop) {
                drop = false;
                return;
              }
            } else if (request.action === "leave") {
              result = await session.leave(auth);
              bound.delete(socket.id);
            } else throw new Error("Unknown request");
          }
          await publish();
          ack({ ok: true, result });
        } catch (e) {
          // Do not expose storage paths, stack traces, raw state or credentials.
          const known = [
            "Already bound",
            "Invalid connect",
            "Unauthenticated socket",
            "Unknown request",
            "Unauthorized or deleted room",
            "Room unavailable",
            "Room capacity",
            "Stale controller",
            "Stale revision",
            "Invalid command",
            "Intent collision",
            "Engine rejected command",
          ];
          ack({
            ok: false,
            error:
              e instanceof Error && known.includes(e.message)
                ? e.message
                : "Commit failed",
          });
        }
      },
    );
    socket.on("disconnect", () => {
      disconnected.abort();
      const auth = bound.get(socket.id);
      bound.delete(socket.id);
      if (auth) void session.disconnect(auth).catch(() => {});
    });
  });
  await new Promise<void>((resolve) =>
    http.listen(options.port ?? 0, "127.0.0.1", resolve),
  );
  const address = http.address();
  if (!address || typeof address === "string")
    throw new Error("No proof address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await session.close();
    },
  };
}
