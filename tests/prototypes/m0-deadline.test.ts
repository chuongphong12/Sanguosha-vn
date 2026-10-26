import { expect, it } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPrototype,
  type Auth,
  type Command,
} from "../../server/prototypes/hegemony-m0/session";
import type { EngineCommand } from "../../server/prototypes/hegemony-m0/engine";
import { startProofServer } from "../../server/prototypes/hegemony-m0/transport";
import { io, type Socket } from "socket.io-client";

// Only the OS clock/scheduling boundary is controlled; engine, Master and disk are real.
class ManualClock {
  time = 0;
  jobs = new Set<{ at: number; run: () => Promise<void> }>();
  now = () => this.time;
  schedule = (run: () => Promise<void>, delay: number) => {
    const job = { at: this.time + delay, run };
    this.jobs.add(job);
    return () => {
      this.jobs.delete(job);
    };
  };
  async advance(ms: number) {
    this.time += ms;
    for (const job of [...this.jobs].filter((j) => j.at <= this.time)) {
      this.jobs.delete(job);
      await job.run();
    }
  }
}
type Session = Awaited<ReturnType<typeof createPrototype>>;
async function send(session: Session, auth: Auth, intent: EngineCommand) {
  const view = await session.view(auth);
  return session.command(auth, {
    ...intent,
    id: crypto.randomUUID(),
    revision: view.revision,
    generation: view.generation,
  });
}
async function answer(session: Session, auth: Auth, label: string) {
  const view = await session.view(auth);
  const choice = view.prompt?.choices.find((c) => c.label === label);
  expect(choice).toBeDefined();
  return send(session, auth, {
    action: "answer",
    answer: { id: view.prompt!.id, choice: choice!.id },
  });
}
async function pendingJink(session: Session) {
  const a = await session.create(),
    b = await session.join(a.room);
  await send(session, a, { action: "draw" });
  await send(session, b, { action: "draw" });
  await send(session, a, { action: "play" });
  await answer(session, a, "Sát");
  await answer(session, a, "1");
  await answer(session, a, "Xác nhận");
  return { a, b };
}

it("keeps the original prompt deadline when disconnection starts at second 59", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new ManualClock();
  const session = await createPrototype(join(dir, "rooms.json"), { clock });
  try {
    const { b } = await pendingJink(session);
    await clock.advance(59_000);
    expect((await session.view(b)).prompt?.kind).toBe("response");
    await session.disconnect(b);
    await clock.advance(1000);
    const timedOut = await session.view(b);
    expect(timedOut.hand).toEqual([]);
    expect(timedOut.battle.outcomes).toEqual(["SlashMissed"]);
    expect(timedOut.timing.control).toBe("human");
    await clock.advance(59_000);
    expect((await session.view(b)).timing.control).toBe("bot");
    const returned = await session.connect(b, "returned");
    expect((await session.view(returned)).timing.control).toBe("human");
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("answers one online decision without transferring the human's controller", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new ManualClock();
  const session = await createPrototype(join(dir, "rooms.json"), { clock });
  try {
    const { b } = await pendingJink(session),
      before = await session.view(b);
    await clock.advance(60_000);
    const after = await session.view(b);
    expect(after.controlling).toBe(true);
    expect(after.generation).toBe(before.generation);
    expect(after.timing.control).toBe("human");
    expect(after.battle.outcomes).toEqual(["SlashMissed"]);
    await clock.advance(60_000);
    expect((await session.view(b)).battle.outcomes).toEqual(["SlashMissed"]);
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("restores the committed remaining prompt time while excluding an arbitrary restart clock gap", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    path = join(dir, "rooms.json"),
    firstClock = new ManualClock();
  let session = await createPrototype(path, { clock: firstClock });
  try {
    const { a, b } = await pendingJink(session);
    await firstClock.advance(45_000);
    const pending = await session.view(b);
    expect(pending.timing.remainingMs).toBe(15_000);
    await session.close();
    const restartedClock = new ManualClock();
    restartedClock.time = 9_000_000;
    session = await createPrototype(path, { clock: restartedClock });
    await session.connect(a, "restored-a");
    const returned = await session.connect(b, "restored-b");
    expect((await session.view(returned)).prompt).toEqual(pending.prompt);
    expect((await session.view(returned)).timing.remainingMs).toBe(15_000);
    await restartedClock.advance(14_000);
    expect((await session.view(returned)).hand).toEqual([1]);
    await restartedClock.advance(1000);
    expect((await session.view(returned)).hand).toEqual([]);
    expect((await session.view(returned)).battle.outcomes).toEqual([
      "SlashMissed",
    ]);
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("starts room expiry when the last human disconnects, and bots cannot retain an empty room", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new ManualClock();
  const session = await createPrototype(join(dir, "rooms.json"), { clock });
  try {
    const a = await session.create(),
      b = await session.join(a.room);
    await session.disconnect(a);
    await clock.advance(59_000);
    await session.disconnect(b);
    await clock.advance(1000);
    expect((await session.view(a)).timing.control).toBe("bot");
    expect((await session.view(b)).timing.control).toBe("human");
    await clock.advance(59_000);
    await expect(session.view(a)).rejects.toThrow(
      "Unauthorized or deleted room",
    );
    await expect(session.connect(b, "late-return")).rejects.toThrow(
      "Unauthorized or deleted room",
    );
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("restores seat time but grants room recovery grace from readiness, rejecting return at its exact expiry", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    path = join(dir, "rooms.json"),
    clock = new ManualClock();
  let session = await createPrototype(path, { clock });
  try {
    const a = await session.create();
    await session.disconnect(a);
    await clock.advance(30_000);
    await session.close();
    const resumed = new ManualClock();
    resumed.time = 100_000_000;
    session = await createPrototype(path, { clock: resumed });
    await resumed.advance(29_000);
    expect((await session.view(a)).room).toBe(a.room);
    await resumed.advance(1000);
    expect((await session.view(a)).timing.control).toBe("bot");
    expect((await session.view(a)).room).toBe(a.room);
    resumed.time += 30_000; // Return races ahead of the physical timer callback.
    await expect(session.connect(a, "too-late")).rejects.toThrow(
      "Unauthorized or deleted room",
    );
    await resumed.advance(0);
    await expect(session.join(a.room)).rejects.toThrow("Room unavailable");
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("does not mark a seat offline while its authenticated secondary tab remains connected", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new ManualClock();
  const session = await createPrototype(join(dir, "rooms.json"), { clock });
  try {
    const a = await session.create(),
      b = await session.join(a.room);
    const secondary = await session.connect(b, "secondary");
    await session.disconnect(b);
    await clock.advance(60_000);
    expect((await session.view(secondary)).timing.control).toBe("human");
    const claimed = await session.connect(secondary, "secondary");
    expect((await session.view(claimed)).controlling).toBe(true);
    await session.disconnect(a);
    await clock.advance(60_000);
    expect((await session.view(claimed)).room).toBe(a.room);
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("keeps pending state and bot costs unchanged after a failed deadline write, then retries once", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    path = join(dir, "rooms.json"),
    clock = new ManualClock();
  let announcements = 0;
  const session = await createPrototype(path, {
    clock,
    onChange: () => {
      announcements++;
    },
  });
  try {
    const { b } = await pendingJink(session),
      before = await session.view(b);
    await mkdir(path + ".next");
    await clock.advance(60_000);
    expect(await session.view(b)).toEqual(before);
    expect(announcements).toBe(0);
    await rm(path + ".next", { recursive: true });
    await clock.advance(1000);
    const accepted = await session.view(b);
    expect(accepted.battle.outcomes).toEqual(["SlashMissed"]);
    expect(accepted.battle.discard).toEqual([0, 1]);
    expect(announcements).toBe(1);
    await clock.advance(1000);
    expect((await session.view(b)).battle.outcomes).toEqual(["SlashMissed"]);
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("fences an obsolete timeout after a human answer and accepts only one outcome in a deadline race", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new ManualClock();
  const session = await createPrototype(join(dir, "rooms.json"), { clock });
  try {
    const first = await pendingJink(session);
    await clock.advance(59_000);
    await answer(session, first.b, "Thiểm");
    await clock.advance(1000);
    expect((await session.view(first.b)).battle.outcomes).toEqual([
      "SlashMissed",
    ]);
    const second = await pendingJink(session),
      offered = await session.view(second.b);
    const intent: Command = {
      id: "human-race",
      revision: offered.revision,
      generation: offered.generation,
      action: "answer",
      answer: { id: offered.prompt!.id, choice: "jink:1" },
    };
    const race = await Promise.allSettled([
      session.command(second.b, intent),
      clock.advance(60_000),
    ]);
    expect(race.filter((r) => r.status === "rejected")).toHaveLength(1);
    const after = await session.view(second.b);
    expect(after.hand).toEqual([]);
    expect(after.battle.outcomes).toEqual(["SlashMissed"]);
    expect(after.battle.discard).toEqual([0, 1]);
    await expect(session.command(second.b, intent)).rejects.toThrow(
      "Stale revision",
    );
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

async function socketClient(url: string) {
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

it("releases its writer lease when the recovery checkpoint cannot be written", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    path = join(dir, "rooms.json"),
    clock = new ManualClock();
  const first = await createPrototype(path, { clock });
  const auth = await first.create();
  await first.close();
  try {
    await mkdir(path + ".next");
    await expect(createPrototype(path, { clock })).rejects.toThrow();
    await rm(path + ".next", { recursive: true });
    const resumed = await createPrototype(path, { clock });
    try {
      expect(
        (await resumed.view(await resumed.connect(auth, "retry"))).room,
      ).toBe(auth.room);
    } finally {
      await resumed.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
async function rpc(socket: Socket, request: object) {
  const reply = await socket.timeout(2000).emitWithAck("request", request);
  if (!reply.ok) throw new Error(reply.error);
  return reply.result;
}
it("publishes an automatically scheduled real Master Jink result through Socket.IO after durable acceptance", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new ManualClock();
  const server = await startProofServer(join(dir, "rooms.json"), { clock });
  const a = await socketClient(server.url),
    b = await socketClient(server.url);
  try {
    const auth = await rpc(a, { action: "create" });
    await rpc(b, { action: "join", room: auth.room });
    async function move(socket: Socket, intent: EngineCommand) {
      const view = await rpc(socket, { action: "view" });
      return rpc(socket, {
        action: "command",
        command: {
          ...intent,
          id: crypto.randomUUID(),
          revision: view.revision,
          generation: view.generation,
        },
      });
    }
    await move(a, { action: "draw" });
    await move(b, { action: "draw" });
    await move(a, { action: "play" });
    for (const label of ["Sát", "1", "Xác nhận"]) {
      const view = await rpc(a, { action: "view" });
      await move(a, {
        action: "answer",
        answer: {
          id: view.prompt.id,
          choice: view.prompt.choices.find(
            (c: { label: string }) => c.label === label,
          ).id,
        },
      });
    }
    const published = new Promise<Awaited<ReturnType<Session["view"]>>>(
      (resolve) => {
        b.on("view", (view) => {
          if (view.battle.outcomes.includes("SlashMissed")) resolve(view);
        });
      },
    );
    await clock.advance(60_000);
    const result = await published;
    expect(result.hand).toEqual([]);
    expect(result.prompt).toBeNull();
    expect(result.timing.control).toBe("human");
    expect((await rpc(a, { action: "view" })).battle.outcomes).toEqual([
      "SlashMissed",
    ]);
  } finally {
    a.disconnect();
    b.disconnect();
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
