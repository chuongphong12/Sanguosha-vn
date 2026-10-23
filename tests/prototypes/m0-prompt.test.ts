import { expect, it } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { io, type Socket } from "socket.io-client";
import { startProofServer } from "../../server/prototypes/hegemony-m0/transport";
import {
  chooseBot,
  policyVersion,
} from "../../server/prototypes/hegemony-m0/bot";
import { fork, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

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
async function answerLabel(socket: Socket, label: string) {
  const view = await rpc(socket, { action: "view" });
  const choice = view.prompt?.choices.find(
    (c: { label: string }) => c.label === label,
  );
  expect(choice, label).toBeDefined();
  return command(socket, "answer", { id: view.prompt.id, choice: choice.id });
}
async function slash(a: Socket) {
  await command(a, "play");
  await answerLabel(a, "Sát");
  await answerLabel(a, "1");
  await answerLabel(a, "Xác nhận");
}

it("executes an actor-private Jink prompt through actual admission, MethodUse and SlashMissed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
  const server = await startProofServer(join(dir, "rooms.json"));
  const a = await client(server.url),
    b = await client(server.url);
  try {
    const auth = await rpc(a, { action: "create" });
    await rpc(b, { action: "join", room: auth.room });
    await command(a, "draw"); // fixture physical Slash 0
    await command(b, "draw"); // fixture physical Jink 1
    await slash(a);
    const waiting = await rpc(b, { action: "view" });
    expect(waiting.prompt).toMatchObject({ kind: "response", canCancel: true });
    expect(waiting.hand).toEqual([1]);
    expect(waiting.battle.hp).toEqual({ "0": 4, "1": 4 });
    const other = await rpc(a, { action: "view" });
    expect(other.prompt).toBeNull();
    expect(other.decision.offers).toEqual([]);
    expect(JSON.stringify(other)).not.toMatch(
      /jink:|frames|pileRandom|playerTags|providedCard/,
    );
    const finished = await answerLabel(b, "Thiểm");
    expect(finished.view.hand).toEqual([]);
    expect(finished.view.prompt).toBeNull();
    expect(finished.view.battle).toMatchObject({
      hp: { "0": 4, "1": 4 },
      discard: [0, 1],
      outcomes: ["SlashMissed"],
    });
  } finally {
    a.disconnect();
    b.disconnect();
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("keeps the committed prompt and both materials intact when persisting the answer fails", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    path = join(dir, "rooms.json");
  const server = await startProofServer(path),
    a = await client(server.url),
    b = await client(server.url);
  try {
    const auth = await rpc(a, { action: "create" });
    await rpc(b, { action: "join", room: auth.room });
    await command(a, "draw");
    await command(b, "draw");
    await slash(a);
    const waiting = await rpc(b, { action: "view" });
    const intent = {
      id: "answer-disk-fault",
      revision: waiting.revision,
      generation: waiting.generation,
      action: "answer",
      answer: { id: waiting.prompt.id, choice: "jink:1" },
    };
    const updates: unknown[] = [];
    b.on("view", (view) => updates.push(view));
    await mkdir(path + ".next");
    await expect(
      rpc(b, { action: "command", command: intent }),
    ).rejects.toThrow("Commit failed");
    expect(updates).toEqual([]);
    expect(await rpc(b, { action: "view" })).toEqual(waiting);
    await rm(path + ".next", { recursive: true });
    const accepted = await rpc(b, { action: "command", command: intent });
    expect(accepted.duplicate).toBe(false);
    expect(accepted.view.battle.outcomes).toEqual(["SlashMissed"]);
    expect(accepted.view.battle.discard).toEqual([0, 1]);
  } finally {
    a.disconnect();
    b.disconnect();
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("declining Jink runs the real damage pipeline exactly once", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
  const server = await startProofServer(join(dir, "rooms.json"));
  const a = await client(server.url),
    b = await client(server.url);
  try {
    const auth = await rpc(a, { action: "create" });
    await rpc(b, { action: "join", room: auth.room });
    await command(a, "draw");
    await slash(a);
    const result = await answerLabel(b, "Không dùng Thiểm");
    expect(result.view.battle).toEqual({
      hp: { "0": 4, "1": 3 },
      discard: [0],
      outcomes: ["SlashHit"],
    });
    expect(result.view.prompt).toBeNull();
    await expect(command(a, "play")).rejects.toThrow("Engine rejected command");
    expect((await rpc(b, { action: "view" })).battle.hp["1"]).toBe(3);
  } finally {
    a.disconnect();
    b.disconnect();
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("fences wrong actors/controllers and serializes competing human/bot replies to one effect", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
  const server = await startProofServer(join(dir, "rooms.json"));
  const a = await client(server.url),
    b = await client(server.url),
    secondary = await client(server.url);
  try {
    const auth = await rpc(a, { action: "create" });
    const bAuth = await rpc(b, { action: "join", room: auth.room });
    await command(a, "draw");
    await command(b, "draw");
    await slash(a);
    const waiting = await rpc(b, { action: "view" });
    const bot = chooseBot(waiting.decision, {
      version: policyVersion,
      actor: "1",
      seed: 17,
      decisions: 0,
    });
    expect(bot.choice).toBe("jink:1");
    const answer = { id: waiting.prompt.id, choice: bot.choice };
    await expect(command(a, "answer", answer)).rejects.toThrow(
      "Engine rejected command",
    );
    await expect(command(b, "draw")).rejects.toThrow("Engine rejected command");
    await expect(
      command(b, "answer", { ...answer, id: "old-prompt" }),
    ).rejects.toThrow("Engine rejected command");
    await expect(
      command(b, "answer", { ...answer, choice: "jink:7" }),
    ).rejects.toThrow("Engine rejected command");
    await rpc(secondary, { action: "connect", auth: bAuth });
    await expect(command(secondary, "answer", answer)).rejects.toThrow(
      "Stale controller",
    );
    const taken = await rpc(secondary, { action: "take" });
    await expect(
      rpc(b, {
        action: "command",
        command: {
          id: "late-bot",
          revision: waiting.revision,
          generation: waiting.generation,
          action: "answer",
          answer,
        },
      }),
    ).rejects.toThrow("Stale controller");
    const intent = {
      id: "bot-or-human",
      revision: waiting.revision,
      generation: taken.generation,
      action: "answer",
      answer,
    };
    const race = await Promise.allSettled([
      rpc(secondary, { action: "command", command: intent }),
      rpc(secondary, {
        action: "command",
        command: { ...intent, id: "other-reply" },
      }),
    ]);
    expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const duplicate = await rpc(secondary, {
      action: "command",
      command: intent,
    });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.view.battle.outcomes).toEqual(["SlashMissed"]);
    expect(duplicate.view.battle.discard).toEqual([0, 1]);
    await expect(
      rpc(secondary, {
        action: "command",
        command: { ...intent, answer: { ...answer, choice: "decline" } },
      }),
    ).rejects.toThrow("Intent collision");
    await expect(command(secondary, "answer", answer)).rejects.toThrow(
      "Engine rejected command",
    );
  } finally {
    a.disconnect();
    b.disconnect();
    secondary.disconnect();
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

async function processServer(path: string, dropAck = false) {
  const child = fork(
    resolve("server/prototypes/hegemony-m0/serve.ts"),
    [path, ...(dropAck ? ["--drop-ack"] : [])],
    {
      execArgv: ["--import", "tsx"],
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    },
  );
  const [ready] = await once(child, "message");
  return { child, url: ready.url as string };
}
async function kill(child: ChildProcess) {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
  }
}
it("resumes a pending Jink after SIGKILL and deduplicates its committed answer after another crash before ACK", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    path = join(dir, "rooms.json");
  const first = await processServer(path);
  const sockets: Socket[] = [],
    children = [first.child];
  try {
    const a = await client(first.url),
      b = await client(first.url);
    sockets.push(a, b);
    const auth = await rpc(a, { action: "create" });
    const bAuth = await rpc(b, { action: "join", room: auth.room });
    await command(a, "draw");
    await command(b, "draw");
    await slash(a);
    const pending = await rpc(b, { action: "view" });
    await kill(first.child);
    a.disconnect();
    b.disconnect();
    const second = await processServer(path, true);
    children.push(second.child);
    const returning = await client(second.url);
    sockets.push(returning);
    const restored = await rpc(returning, { action: "connect", auth: bAuth });
    const waiting = await rpc(returning, { action: "view" });
    expect(waiting.prompt).toEqual(pending.prompt);
    expect(waiting.hand).toEqual([1]);
    expect(waiting.battle).toEqual(pending.battle);
    const intent = {
      id: "unacked-jink",
      revision: waiting.revision,
      generation: restored.generation,
      action: "answer",
      answer: { id: waiting.prompt.id, choice: "jink:1" },
    };
    await expect(
      rpc(returning, { action: "command", command: intent }),
    ).rejects.toThrow("operation has timed out");
    await kill(second.child);
    returning.disconnect();
    const third = await startProofServer(path),
      final = await client(third.url);
    sockets.push(final);
    try {
      const rebound = await rpc(final, { action: "connect", auth: bAuth });
      const receipt = await rpc(final, {
        action: "command",
        command: { ...intent, generation: rebound.generation },
      });
      expect(receipt.duplicate).toBe(true);
      expect(receipt.view.hand).toEqual([]);
      expect(receipt.view.prompt).toBeNull();
      expect(receipt.view.battle).toEqual({
        hp: { "0": 4, "1": 4 },
        discard: [0, 1],
        outcomes: ["SlashMissed"],
      });
    } finally {
      final.disconnect();
      await third.close();
    }
  } finally {
    for (const s of sockets) s.disconnect();
    for (const child of children) await kill(child);
    await rm(dir, { recursive: true, force: true });
  }
}, 25000);
