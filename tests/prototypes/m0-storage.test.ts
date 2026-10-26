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
