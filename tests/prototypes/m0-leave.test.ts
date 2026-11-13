import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createPrototype,
  type Auth,
} from "../../server/prototypes/hegemony-m0/session";
import type { EngineCommand } from "../../server/prototypes/hegemony-m0/engine";

// Control only the trusted scheduling boundary; actual Master/engine/file store execute.
class Clock {
  time = 0;
  task: { at: number; run: () => Promise<void> } | null = null;
  now = () => this.time;
  schedule = (run: () => Promise<void>, delay: number) => {
    const task = { at: this.time + delay, run };
    this.task = task;
    return () => {
      if (this.task === task) this.task = null;
    };
  };
  async advance(ms = 1000) {
    this.time += ms;
    const task = this.task;
    if (task && task.at <= this.time) {
      this.task = null;
      await task.run();
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
async function pending(session: Session) {
  const a = await session.create(),
    b = await session.join(a.room);
  await send(session, a, { action: "draw" });
  await send(session, b, { action: "draw" });
  await send(session, a, { action: "play" });
  for (const label of ["Sát", "1", "Xác nhận"]) {
    const view = await session.view(a),
      choice = view.prompt?.choices.find((c) => c.label === label);
    expect(choice).toBeDefined();
    await send(session, a, {
      action: "answer",
      answer: { id: view.prompt!.id, choice: choice!.id },
    });
  }
  return { a, b };
}

it("replaces a departed player with an immediate prompt bot while revoking every old tab's seat rights", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new Clock();
  const session = await createPrototype(join(dir, "rooms.json"), { clock });
  try {
    const { a, b } = await pending(session);
    const secondary = await session.connect(b, "secondary");
    const waiting = await session.view(b);
    expect(await session.leave(b)).toEqual({ deleted: false });
    // No human mutation should be needed to trigger the departed actor's response.
    await clock.advance();
    expect((await session.view(a)).handCounts["1"]).toBe(0);
    for (const auth of [b, secondary]) {
      await expect(session.view(auth)).rejects.toThrow(
        "Unauthorized or deleted room",
      );
      await expect(session.connect(auth, "take-again", true)).rejects.toThrow(
        "Unauthorized or deleted room",
      );
      await expect(
        session.command(auth, {
          id: "late-jink",
          action: "answer",
          revision: waiting.revision,
          generation: waiting.generation,
          answer: { id: waiting.prompt!.id, choice: "jink:1" },
        }),
      ).rejects.toThrow("Unauthorized or deleted room");
    }
    const view = await session.view(a);
    expect(view.handCounts["1"]).toBe(0);
    expect(view.battle).toEqual({
      hp: { "0": 4, "1": 4 },
      discard: [0, 1],
      outcomes: ["SlashMissed"],
    });
    expect(view.prompt).toBeNull();
    expect(JSON.stringify(view)).not.toMatch(
      /frames|botMemory|secretHash|jink:/,
    );
    expect(await session.leave(a)).toEqual({ deleted: true });
    await clock.advance(60_000);
    await expect(session.connect(a, "deleted")).rejects.toThrow(
      "Unauthorized or deleted room",
    );
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("cancels the departed Play owner's pending request without removing its character or cards", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new Clock();
  const session = await createPrototype(join(dir, "rooms.json"), { clock });
  try {
    const a = await session.create(),
      b = await session.join(a.room);
    await send(session, a, { action: "draw" });
    await send(session, b, { action: "draw" });
    await send(session, a, { action: "play" });
    expect((await session.view(a)).prompt?.canCancel).toBe(true);
    expect(await session.leave(a)).toEqual({ deleted: false });
    await clock.advance();
    const view = await session.view(b);
    expect(view.handCounts).toEqual({ "0": 1, "1": 1 });
    expect(view.battle).toEqual({
      hp: { "0": 4, "1": 4 },
      discard: [],
      outcomes: [],
    });
    await expect(session.connect(a, "old-play-owner")).rejects.toThrow(
      "Unauthorized or deleted room",
    );
    expect(await session.leave(b)).toEqual({ deleted: true });
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("restores the permanent bot and revoked credential before its pending reply, then never repeats the committed effect", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    path = join(dir, "rooms.json");
  let clock = new Clock(),
    session = await createPrototype(path, { clock });
  try {
    const { a, b } = await pending(session);
    await session.leave(b);
    await session.close();
    clock = new Clock();
    session = await createPrototype(path, { clock });
    await expect(session.connect(b, "old-human")).rejects.toThrow(
      "Unauthorized or deleted room",
    );
    const returned = await session.connect(a, "remaining-human");
    // Restoring must not require another 60-second disconnect grace for this bot.
    await clock.advance();
    expect((await session.view(returned)).battle.outcomes).toEqual([
      "SlashMissed",
    ]);
    await session.close();
    clock = new Clock();
    session = await createPrototype(path, { clock });
    const again = await session.connect(a, "again");
    await clock.advance();
    const view = await session.view(again);
    expect(view.battle.discard).toEqual([0, 1]);
    expect(view.battle.outcomes).toEqual(["SlashMissed"]);
    await expect(session.connect(b, "revoked-again", true)).rejects.toThrow(
      "Unauthorized or deleted room",
    );
    await expect(session.join(a.room)).rejects.toThrow("Room unavailable");
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("keeps pre-start seat release available while revoking the departed credential", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
  const session = await createPrototype(join(dir, "rooms.json"), {
    clock: new Clock(),
  });
  try {
    const a = await session.create(),
      b = await session.join(a.room);
    await session.leave(b);
    const fresh = await session.join(a.room);
    expect(fresh.actor).toBe("1");
    expect(fresh.secret).not.toBe(b.secret);
    await expect(session.connect(b, "old")).rejects.toThrow(
      "Unauthorized or deleted room",
    );
    expect((await session.view(fresh)).controlling).toBe(true);
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("does not let a permanent bot preserve an empty room or extend the remaining human's return window", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    clock = new Clock();
  const session = await createPrototype(join(dir, "rooms.json"), { clock });
  try {
    const { a, b } = await pending(session);
    await session.leave(b);
    await session.disconnect(a);
    await clock.advance(59_999);
    expect((await session.view(a)).battle.outcomes).toEqual(["SlashMissed"]);
    // The original room deadline is now due even before the next heartbeat runs.
    clock.time++;
    await expect(session.connect(a, "too-late")).rejects.toThrow(
      "Unauthorized or deleted room",
    );
    await expect(session.join(a.room)).rejects.toThrow("Room unavailable");
  } finally {
    await session.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it.each([true, false])(
  "serializes a human answer and Leave without a second engine effect (human first: %s)",
  async (humanFirst) => {
    const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
      clock = new Clock();
    const session = await createPrototype(join(dir, "rooms.json"), { clock });
    try {
      const { a, b } = await pending(session),
        waiting = await session.view(b);
      const reply = () =>
        session.command(b, {
          id: "racing-reply",
          revision: waiting.revision,
          generation: waiting.generation,
          action: "answer",
          answer: { id: waiting.prompt!.id, choice: "jink:1" },
        });
      const results = await Promise.allSettled(
        humanFirst ? [reply(), session.leave(b)] : [session.leave(b), reply()],
      );
      expect(results[humanFirst ? 0 : 1].status).toBe(
        humanFirst ? "fulfilled" : "rejected",
      );
      expect(results[humanFirst ? 1 : 0].status).toBe("fulfilled");
      await clock.advance();
      const view = await session.view(a);
      expect(view.battle.discard).toEqual([0, 1]);
      expect(view.battle.outcomes).toEqual(["SlashMissed"]);
      await expect(session.view(b)).rejects.toThrow(
        "Unauthorized or deleted room",
      );
    } finally {
      await session.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
