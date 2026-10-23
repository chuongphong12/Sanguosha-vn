import { describe, it, expect } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPrototype } from "../../server/prototypes/hegemony-m0/session";
import { startProofServer } from "../../server/prototypes/hegemony-m0/transport";
import { io, type Socket } from "socket.io-client";
import { fork } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

async function client(url: string) {
  const socket = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("connect_error", reject);
  });
  return socket;
}
async function rpc(s: Socket, request: object) {
  const reply = await s.timeout(1500).emitWithAck("request", request);
  if (!reply.ok) throw new Error(reply.error);
  return reply.result;
}

describe("M0 staged Master local persistence proof", () => {
  it("does not let a disconnected join preserve the room when Leave is already queued behind its commit", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
    let pause: () => Promise<void> = async () => {};
    const session = await createPrototype(join(dir, "rooms.json"), {
      beforeCommit: () => pause(),
    });
    try {
      const a = await session.create();
      let bLive = true,
        enter!: () => void,
        release!: () => void;
      const entered = new Promise<void>((r) => {
          enter = r;
        }),
        released = new Promise<void>((r) => {
          release = r;
        });
      pause = async () => {
        enter();
        await released;
      };
      const joining = session.join(a.room, "pending-b", () => bLive);
      await entered;
      bLive = false;
      const leaving = session.leave(a); // Already queued before join can finish.
      pause = async () => {};
      release();
      await joining;
      expect(await leaving).toEqual({ deleted: true });
    } finally {
      await session.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("cleans a join that finishes committing after its socket disconnects", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
    let pause: (signal: AbortSignal) => Promise<void> = async () => {};
    const server = await startProofServer(join(dir, "rooms.json"), {
        beforeBind: (signal) => pause(signal),
      }),
      a = await client(server.url),
      b = await client(server.url);
    try {
      const auth = await rpc(a, { action: "create" });
      let enter!: () => void, observedDisconnect!: () => void;
      const entered = new Promise<void>((r) => {
          enter = r;
        }),
        disconnected = new Promise<void>((r) => {
          observedDisconnect = r;
        });
      pause = async (signal) => {
        enter();
        await new Promise<void>((resolve) =>
          signal.addEventListener(
            "abort",
            () => {
              observedDisconnect();
              resolve();
            },
            { once: true },
          ),
        );
      };
      const pending = rpc(b, { action: "join", room: auth.room }).catch(
        () => undefined,
      );
      await entered;
      b.disconnect();
      await disconnected;
      // A real round-trip queues behind the resumed join. No arbitrary sleep.
      await rpc(a, { action: "view" });
      await pending;
      expect(await rpc(a, { action: "leave" })).toEqual({ deleted: true });
    } finally {
      a.disconnect();
      b.disconnect();
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("does not let a read-only secondary revoke the active controller's seat", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
      session = await createPrototype(join(dir, "rooms.json"));
    try {
      const a = await session.create(),
        secondary = await session.connect(a, "secondary");
      await expect(session.leave(secondary)).rejects.toThrow(
        "Stale controller",
      );
      expect((await session.view(a)).controlling).toBe(true);
    } finally {
      await session.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("binds exactly one created room to an initially unbound socket", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
      server = await startProofServer(join(dir, "rooms.json")),
      a = await client(server.url);
    try {
      const results = await Promise.allSettled([
        rpc(a, { action: "create" }),
        rpc(a, { action: "create" }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    } finally {
      a.disconnect();
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("runs the actual draw operation and restores the committed actor-private state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
    try {
      const first = await createPrototype(join(dir, "rooms.json"));
      const a = await first.create();
      const b = await first.join(a.room);
      const result = await first.command(a, {
        id: "draw-1",
        revision: b.revision,
        generation: a.generation,
        action: "draw",
      });
      expect(result.view.hand).toEqual([0]);
      expect((await first.view(b)).hand).toEqual([]);
      expect(JSON.stringify(await first.view(b))).not.toContain("pileRandom");
      await first.close();
      const second = await createPrototype(join(dir, "rooms.json"));
      const restored = await second.connect(a, "restored-tab");
      expect((await second.view(restored)).hand).toEqual([0]);
      await second.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("rejects a real disk-write failure without publishing a speculative update", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
      path = join(dir, "rooms.json");
    const server = await startProofServer(path),
      a = await client(server.url),
      b = await client(server.url);
    try {
      const auth = await rpc(a, { action: "create" });
      await rpc(b, { action: "join", room: auth.room });
      const before = await rpc(a, { action: "view" }),
        updates: unknown[] = [];
      a.on("view", (v) => updates.push(v));
      await mkdir(path + ".next");
      await expect(
        rpc(a, {
          action: "command",
          command: {
            id: "disk-fault",
            revision: before.revision,
            generation: before.generation,
            action: "draw",
          },
        }),
      ).rejects.toThrow("Commit failed");
      expect(updates).toEqual([]);
      expect((await rpc(a, { action: "view" })).hand).toEqual([]);
    } finally {
      a.disconnect();
      b.disconnect();
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("fences the prior controlling tab and accepts one effect for a duplicate intent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
      server = await startProofServer(join(dir, "rooms.json"));
    const a = await client(server.url),
      b = await client(server.url),
      secondary = await client(server.url);
    try {
      const auth = await rpc(a, { action: "create" });
      await rpc(b, { action: "join", room: auth.room });
      await rpc(secondary, { action: "connect", auth });
      expect((await rpc(secondary, { action: "view" })).controlling).toBe(
        false,
      );
      const current = await rpc(secondary, { action: "take" });
      await expect(
        rpc(a, {
          action: "command",
          command: {
            id: "late-bot",
            revision: 0,
            generation: auth.generation,
            action: "draw",
          },
        }),
      ).rejects.toThrow("Stale controller");
      const command = {
        id: "one-intent",
        revision: 0,
        generation: current.generation,
        action: "draw",
      };
      const replies = await Promise.all([
        rpc(secondary, { action: "command", command }),
        rpc(secondary, { action: "command", command }),
      ]);
      expect(replies.map((r) => r.duplicate).sort()).toEqual([false, true]);
      expect((await rpc(secondary, { action: "view" })).hand).toEqual([0]);
      const other = await rpc(b, { action: "view" });
      expect(other.hand).toEqual([]);
      expect(Object.keys(other).sort()).toEqual([
        "actor",
        "battle",
        "controlling",
        "decision",
        "generation",
        "hand",
        "handCounts",
        "prompt",
        "revision",
        "room",
      ]);
      await expect(
        rpc(b, {
          action: "command",
          command: { ...command, id: "stale", generation: 1 },
        }),
      ).rejects.toThrow("Stale revision");
    } finally {
      a.disconnect();
      b.disconnect();
      secondary.disconnect();
      await server.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("deletes on last-online Leave despite another offline member and rejects old sync", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
      session = await createPrototype(join(dir, "rooms.json"));
    try {
      const a = await session.create(),
        b = await session.join(a.room);
      await session.disconnect(b);
      expect(await session.leave(a)).toEqual({ deleted: true });
      await expect(session.connect(b, "returning-b")).rejects.toThrow(
        "Unauthorized or deleted room",
      );
      await expect(session.join(a.room)).rejects.toThrow("Room unavailable");
      await expect(
        session.command(a, {
          id: "zombie",
          generation: 1,
          revision: 0,
          action: "draw",
        }),
      ).rejects.toThrow("Unauthorized or deleted room");
    } finally {
      await session.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
  it("restores an unacknowledged committed move after killing the server process", async () => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
      path = join(dir, "rooms.json");
    const child = fork(
      resolve("server/prototypes/hegemony-m0/serve.ts"),
      [path, "--drop-ack"],
      {
        execArgv: ["--import", "tsx"],
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      },
    );
    let a: Socket | undefined, b: Socket | undefined;
    try {
      const [ready] = await once(child, "message");
      a = await client(ready.url);
      b = await client(ready.url);
      const auth = await rpc(a, { action: "create" });
      await rpc(b, { action: "join", room: auth.room });
      const command = {
        id: "lost-ack",
        revision: 0,
        generation: auth.generation,
        action: "draw",
      };
      await expect(rpc(a, { action: "command", command })).rejects.toThrow(
        "operation has timed out",
      );
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
      a.disconnect();
      b.disconnect();
      const restored = await startProofServer(path),
        returning = await client(restored.url);
      try {
        const rebound = await rpc(returning, { action: "connect", auth });
        const reply = await rpc(returning, {
          action: "command",
          command: { ...command, generation: rebound.generation },
        });
        expect(reply.duplicate).toBe(true);
        expect(reply.view.hand).toEqual([0]);
      } finally {
        returning.disconnect();
        await restored.close();
      }
    } finally {
      a?.disconnect();
      b?.disconnect();
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }
      await rm(dir, { recursive: true, force: true });
    }
  }, 20000);
});
