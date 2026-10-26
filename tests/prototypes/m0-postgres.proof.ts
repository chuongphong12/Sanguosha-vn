/** Requires the disposable PostgreSQL owned by npm run prototype:m0:postgres. */
import { expect, it } from "vitest";
import { Client } from "pg";
import { io, type Socket } from "socket.io-client";
import { fork, execFileSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { openPostgresStore } from "../../server/prototypes/hegemony-m0/postgres";
import { startProofServer } from "../../server/prototypes/hegemony-m0/transport";

const connectionString = process.env.M0_DATABASE_URL;
if (!connectionString) throw new Error("Run npm run prototype:m0:postgres");
const frozenClock = { now: () => 0, schedule: () => () => {} };
const store = (name: string) => () => openPostgresStore(connectionString, name);
async function client(url: string) {
  const socket = io(url, {
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}
async function rpc(socket: Socket, request: object) {
  const reply = await socket.timeout(2000).emitWithAck("request", request);
  if (!reply.ok) throw new Error(reply.error);
  return reply.result;
}
async function command(socket: Socket, action: string, answer?: object) {
  const view = await rpc(socket, { action: "view" });
  return rpc(socket, {
    action: "command",
    command: {
      id: crypto.randomUUID(),
      revision: view.revision,
      generation: view.generation,
      action,
      ...(answer ? { answer } : {}),
    },
  });
}
async function pending(a: Socket, b: Socket) {
  await command(a, "draw");
  await command(b, "draw");
  await command(a, "play");
  for (const label of ["Sát", "1", "Xác nhận"]) {
    const view = await rpc(a, { action: "view" });
    const choice = view.prompt.choices.find(
      (c: { label: string }) => c.label === label,
    );
    expect(choice).toBeDefined();
    await command(a, "answer", { id: view.prompt.id, choice: choice.id });
  }
  return rpc(b, { action: "view" });
}
async function processServer(name: string, drop = false) {
  const child = fork(
    resolve("server/prototypes/hegemony-m0/serve.ts"),
    drop ? ["unused", "--drop-ack"] : ["unused"],
    {
      execArgv: ["--import", "tsx"],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      env: { ...process.env, M0_STORE_NAME: name },
    },
  );
  const ready = await Promise.race([
    once(child, "message").then(([message]) => message),
    once(child, "exit").then(() => {
      throw new Error("SQL proof child exited before ready");
    }),
  ]);
  return { child, url: ready.url as string };
}
async function kill(child: ChildProcess) {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  }
}

it("recovers pending Jink on a new SQL writer and deduplicates a committed response lost before ACK", async () => {
  const name = crypto.randomUUID();
  const first = await processServer(name),
    children = [first.child],
    sockets: Socket[] = [];
  try {
    const a = await client(first.url),
      b = await client(first.url);
    sockets.push(a, b);
    const auth = await rpc(a, { action: "create" });
    const bAuth = await rpc(b, { action: "join", room: auth.room });
    const waiting = await pending(a, b);
    expect((await rpc(a, { action: "view" })).prompt).toBeNull();
    expect(JSON.stringify(await rpc(a, { action: "view" }))).not.toMatch(
      /jink:|frames|pileRandom|providedCard/,
    );
    await expect(
      startProofServer("unused", { openStore: store(name) }),
    ).rejects.toThrow("writer already active");
    await kill(first.child);
    const second = await processServer(name, true);
    children.push(second.child);
    const returning = await client(second.url);
    sockets.push(returning);
    const rebound = await rpc(returning, { action: "connect", auth: bAuth });
    const restored = await rpc(returning, { action: "view" });
    expect(restored.prompt).toEqual(waiting.prompt);
    expect(restored.hand).toEqual([1]);
    expect(restored.timing.remainingMs).toBeGreaterThan(0);
    expect(restored.timing.remainingMs).toBeLessThanOrEqual(
      waiting.timing.remainingMs,
    );
    const intent = {
      id: "sql-unacked-jink",
      revision: restored.revision,
      generation: rebound.generation,
      action: "answer",
      answer: { id: restored.prompt.id, choice: "jink:1" },
    };
    await expect(
      rpc(returning, { action: "command", command: intent }),
    ).rejects.toThrow("operation has timed out");
    await kill(second.child);
    const third = await processServer(name);
    children.push(third.child);
    const final = await client(third.url);
    sockets.push(final);
    const returned = await rpc(final, { action: "connect", auth: bAuth });
    const receipt = await rpc(final, {
      action: "command",
      command: { ...intent, generation: returned.generation },
    });
    expect(receipt.duplicate).toBe(true);
    expect(receipt.view.hand).toEqual([]);
    expect(receipt.view.prompt).toBeNull();
    expect(receipt.view.battle).toEqual({
      hp: { "0": 4, "1": 4 },
      discard: [0, 1],
      outcomes: ["SlashMissed"],
    });
    await expect(
      rpc(final, {
        action: "command",
        command: {
          ...intent,
          generation: returned.generation,
          answer: { ...intent.answer, choice: "decline" },
        },
      }),
    ).rejects.toThrow("Intent collision");
  } finally {
    sockets.forEach((s) => s.disconnect());
    for (const child of children) await kill(child);
  }
});

it("rejects a real failed SQL write without publication, fences the writer, and restores the exact pending engine state", async () => {
  const name = crypto.randomUUID();
  const admin = new Client({ connectionString });
  await admin.connect();
  const servers = [
    await startProofServer("unused", {
      openStore: store(name),
      clock: frozenClock,
    }),
  ];
  const a = await client(servers[0].url),
    b = await client(servers[0].url),
    sockets = [a, b];
  try {
    const auth = await rpc(a, { action: "create" });
    const bAuth = await rpc(b, { action: "join", room: auth.room });
    const waiting = await pending(a, b),
      updates: unknown[] = [];
    b.on("view", (v) => updates.push(v));
    await admin.query(
      "ALTER TABLE prototype_m0_sessions ADD CONSTRAINT proof_no_write CHECK (body IS NULL) NOT VALID",
    );
    await expect(
      rpc(b, {
        action: "command",
        command: {
          id: "sql-failed-jink",
          revision: waiting.revision,
          generation: waiting.generation,
          action: "answer",
          answer: { id: waiting.prompt.id, choice: "jink:1" },
        },
      }),
    ).rejects.toThrow("Commit failed");
    expect(updates).toEqual([]);
    await expect(rpc(b, { action: "view" })).rejects.toThrow();
    await admin.query(
      "ALTER TABLE prototype_m0_sessions DROP CONSTRAINT proof_no_write",
    );
    await servers[0].close();
    const next = await startProofServer("unused", {
      openStore: store(name),
      clock: frozenClock,
    });
    servers.push(next);
    const returning = await client(next.url);
    sockets.push(returning);
    await rpc(returning, { action: "connect", auth: bAuth });
    const restored = await rpc(returning, { action: "view" });
    expect(restored.prompt).toEqual(waiting.prompt);
    expect(restored.hand).toEqual([1]);
    expect(restored.battle).toEqual(waiting.battle);
    const result = await command(returning, "answer", {
      id: restored.prompt.id,
      choice: "jink:1",
    });
    expect(result.view.battle.outcomes).toEqual(["SlashMissed"]);
  } finally {
    await admin.query(
      "ALTER TABLE prototype_m0_sessions DROP CONSTRAINT IF EXISTS proof_no_write",
    );
    sockets.forEach((s) => s.disconnect());
    for (const server of servers) await server.close();
    await admin.end();
  }
});

it("recovers from an actual PostgreSQL restart while the old game server remains fenced", async () => {
  const name = crypto.randomUUID();
  const first = await startProofServer("unused", {
    openStore: store(name),
    clock: frozenClock,
  });
  const servers = [first],
    sockets: Socket[] = [];
  try {
    const a = await client(first.url),
      b = await client(first.url);
    sockets.push(a, b);
    const auth = await rpc(a, { action: "create" });
    const bAuth = await rpc(b, { action: "join", room: auth.room });
    const waiting = await pending(a, b);
    const container = process.env.M0_PROOF_CONTAINER;
    if (!container?.startsWith("tqs-m0-proof-"))
      throw new Error("Missing owned scratch container");
    const label = execFileSync(
      "docker",
      [
        "inspect",
        "--format",
        '{{index .Config.Labels "tqs.prototype"}}',
        container,
      ],
      { encoding: "utf8" },
    ).trim();
    expect(label).toBe("m0-postgres");
    execFileSync("docker", ["restart", container], { stdio: "pipe" });
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        execFileSync(
          "docker",
          ["exec", container, "pg_isready", "-U", "postgres"],
          { stdio: "pipe" },
        );
        ready = true;
        break;
      } catch {
        await setTimeout(250);
      }
    }
    expect(ready).toBe(true);
    await expect
      .poll(() =>
        rpc(b, { action: "view" }).then(
          () => false,
          () => true,
        ),
      )
      .toBe(true);
    const next = await startProofServer("unused", {
      openStore: store(name),
      clock: frozenClock,
    });
    servers.push(next);
    const returning = await client(next.url);
    sockets.push(returning);
    await rpc(returning, { action: "connect", auth: bAuth });
    const restored = await rpc(returning, { action: "view" });
    expect(restored.prompt).toEqual(waiting.prompt);
    expect(restored.hand).toEqual([1]);
    await expect(
      rpc(b, {
        action: "command",
        command: {
          id: "old-sql-writer",
          revision: waiting.revision,
          generation: waiting.generation,
          action: "answer",
          answer: { id: waiting.prompt.id, choice: "jink:1" },
        },
      }),
    ).rejects.toThrow();
    const result = await command(returning, "answer", {
      id: restored.prompt.id,
      choice: "jink:1",
    });
    expect(result.view.battle.outcomes).toEqual(["SlashMissed"]);
    expect(result.view.battle.discard).toEqual([0, 1]);
  } finally {
    sockets.forEach((s) => s.disconnect());
    for (const server of servers) await server.close();
  }
});

it("fences a writer whose database revision has been superseded without overwriting saved state", async () => {
  const name = crypto.randomUUID(),
    admin = new Client({ connectionString });
  await admin.connect();
  const first = await startProofServer("unused", {
      openStore: store(name),
      clock: frozenClock,
    }),
    servers = [first];
  const a = await client(first.url),
    sockets = [a];
  try {
    const auth = await rpc(a, { action: "create" });
    const waiting = await rpc(a, { action: "view" });
    await admin.query(
      "UPDATE prototype_m0_sessions SET revision=revision+1 WHERE name=$1",
      [name],
    );
    await expect(
      rpc(a, {
        action: "command",
        command: {
          id: "superseded-draw",
          revision: waiting.revision,
          generation: waiting.generation,
          action: "draw",
        },
      }),
    ).rejects.toThrow("Commit failed");
    await expect(rpc(a, { action: "view" })).rejects.toThrow();
    await first.close();
    const next = await startProofServer("unused", {
      openStore: store(name),
      clock: frozenClock,
    });
    servers.push(next);
    const returning = await client(next.url);
    sockets.push(returning);
    await rpc(returning, { action: "connect", auth });
    expect((await rpc(returning, { action: "view" })).hand).toEqual([]);
    expect((await command(returning, "draw")).view.hand).toEqual([0]);
  } finally {
    sockets.forEach((s) => s.disconnect());
    for (const server of servers) await server.close();
    await admin.end();
  }
});

it("persists last-human deletion and rejects old links and credentials on a new SQL writer", async () => {
  const name = crypto.randomUUID();
  const first = await startProofServer("unused", {
      openStore: store(name),
      clock: frozenClock,
    }),
    servers = [first];
  const a = await client(first.url),
    sockets = [a];
  try {
    const auth = await rpc(a, { action: "create" });
    await command(a, "draw");
    await rpc(a, { action: "leave" });
    await first.close();
    const next = await startProofServer("unused", {
      openStore: store(name),
      clock: frozenClock,
    });
    servers.push(next);
    const returning = await client(next.url);
    sockets.push(returning);
    await expect(rpc(returning, { action: "connect", auth })).rejects.toThrow(
      "Unauthorized or deleted room",
    );
    await expect(
      rpc(returning, { action: "join", room: auth.room }),
    ).rejects.toThrow("Room unavailable");
    const fresh = await rpc(returning, { action: "create" });
    expect(fresh.room).not.toBe(auth.room);
    expect((await rpc(returning, { action: "view" })).hand).toEqual([]);
  } finally {
    sockets.forEach((s) => s.disconnect());
    for (const server of servers) await server.close();
  }
});
