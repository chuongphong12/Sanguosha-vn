/** Raw LOCAL baseline: chooser fixtures plus the real staged-Master draw seam. */
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir, cpus } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { chooseBot, policyVersion, type Observation, type Memory } from "./bot";
import { createPrototype } from "./session";

const seed = 17;
const memory: Memory = {
  version: policyVersion,
  actor: "0",
  seed,
  decisions: 0,
};
const cases: { name: string; view: Observation; expected: string }[] = [
  {
    name: "keep-Peach",
    view: {
      actor: "0",
      kind: "discard",
      offers: [
        { id: "peach", kind: "discard", card: "Peach" },
        { id: "slash", kind: "discard", card: "Slash" },
      ],
    },
    expected: "slash",
  },
  {
    name: "plain-Jink",
    view: {
      actor: "0",
      kind: "response",
      offers: [
        { id: "jink", kind: "jink" },
        { id: "no", kind: "decline" },
      ],
    },
    expected: "jink",
  },
  {
    name: "self-rescue",
    view: {
      actor: "0",
      kind: "rescue-self",
      offers: [
        { id: "wine", kind: "analeptic" },
        { id: "peach", kind: "peach" },
      ],
    },
    expected: "wine",
  },
  {
    name: "decline-unneeded-Nullification",
    view: {
      actor: "0",
      kind: "nullification",
      protectsActor: false,
      offers: [
        { id: "nullify", kind: "nullification" },
        { id: "no", kind: "decline" },
      ],
    },
    expected: "no",
  },
  {
    name: "public-enemy-target",
    view: {
      actor: "0",
      kind: "target",
      offers: [
        { id: "weak", kind: "target", relation: "enemy", hp: 1 },
        { id: "healthy", kind: "target", relation: "enemy", hp: 4 },
      ],
    },
    expected: "weak",
  },
];
const cpu = process.cpuUsage(),
  start = performance.now(),
  iterations = 10000;
for (let i = 0; i < iterations; i++)
  for (const test of cases)
    if (chooseBot(test.view, memory).choice !== test.expected)
      throw new Error(test.name);
const chooser = {
  decisions: iterations * cases.length,
  elapsedMs: performance.now() - start,
  cpu: process.cpuUsage(cpu),
  rssBytes: process.memoryUsage().rss,
};
const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
  session = await createPrototype(join(dir, "rooms.json"));
const real = [];
try {
  const auth = await session.create();
  await session.join(auth.room);
  let state = memory;
  for (let i = 0; i < 4; i++) {
    const observation = await session.view(auth),
      result = chooseBot(observation.decision, state);
    state = result.memory;
    if (result.choice !== "draw") throw new Error("No draw offered");
    const at = performance.now(),
      accepted = await session.command(auth, {
        id: `bot-${i}`,
        revision: observation.revision,
        generation: observation.generation,
        action: result.choice,
      });
    real.push({
      revision: accepted.receipt.revision,
      elapsedMs: performance.now() - at,
      handCount: accepted.view.hand.length,
    });
  }
} finally {
  await session.close();
  await rm(dir, { recursive: true, force: true });
}
console.log(
  JSON.stringify(
    {
      scope:
        "LOCAL throwaway baseline; chooser-only tactical fixtures; real engine execution only draw",
      policyVersion,
      native: "ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f",
      content: "fixture8card-draw-v1",
      seed,
      host: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpu: cpus()[0].model,
      },
      tactics: cases.map((c) => ({ name: c.name, expected: c.expected })),
      chooser,
      real,
      notMeasured: [
        "competitive strength",
        "full content",
        "remote store/recovery",
        "5x10 load",
        "worker isolation",
        "Lua runtime performance",
      ],
    },
    null,
    2,
  ),
);
