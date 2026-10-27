import { it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPrototype } from "../../server/prototypes/hegemony-m0/session";

it("fails closed when the selected store cannot open, without falling back to local state", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-"));
  const opening = createPrototype(join(dir, "fallback.json"), {
    openStore: async () => {
      await writeFile(dir, "cannot write a directory");
      throw new Error("Unreachable storage initialization");
    },
  });
  try {
    await expect(opening).rejects.toThrow();
  } finally {
    await (await opening.catch(() => null))?.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("rejects old clock-v3 saves instead of reinterpreting their physical Slash 2 as ArcheryAttack", async () => {
  const dir = await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")),
    path = join(dir, "rooms.json");
  try {
    await writeFile(
      path,
      JSON.stringify({
        schema: "PROTOTYPE-ce4e62b-clock-v3",
        revision: 0,
        elapsed: 0,
        rooms: {},
      }),
    );
    await expect(createPrototype(path)).rejects.toThrow(
      "Incompatible prototype save",
    );
    await rm(path);
    const session = await createPrototype(path);
    try {
      expect((await session.create()).actor).toBe("0");
    } finally {
      await session.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
