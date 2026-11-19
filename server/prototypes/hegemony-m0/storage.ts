/** THROWAWAY document boundary; the store owns its writer lifetime. */
import { open, readFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export interface SessionStore {
  read(): Promise<string | null>;
  write(document: string): Promise<void>;
  assertActive(): void;
  close(): Promise<void>;
}

export async function openFileStore(
  path: string,
  beforeCommit?: () => Promise<void>,
): Promise<SessionStore> {
  const lockPath = path + ".writer";
  async function acquire(): Promise<void> {
    try {
      const file = await open(lockPath, "wx", 0o600);
      try {
        await file.writeFile(
          JSON.stringify({ pid: process.pid, nonce: randomUUID() }),
        );
      } finally {
        await file.close();
      }
    } catch (error: any) {
      if (error.code !== "EEXIST") throw error;
      const previous = JSON.parse(await readFile(lockPath, "utf8"));
      try {
        process.kill(previous.pid, 0);
      } catch (error: any) {
        if (error.code !== "ESRCH") throw error;
        await unlink(lockPath);
        return acquire();
      }
      throw new Error("Prototype writer already active");
    }
  }
  await acquire();
  let closed = false;
  return {
    async read() {
      try {
        return await readFile(path, "utf8");
      } catch (error: any) {
        if (error.code !== "ENOENT") throw error;
        return null;
      }
    },
    async write(document) {
      const file = await open(path + ".next", "w", 0o600);
      try {
        await file.writeFile(document);
        await file.sync();
      } finally {
        await file.close();
      }
      await beforeCommit?.();
      await rename(path + ".next", path);
    },
    assertActive() {
      if (closed) throw new Error("Writer closed");
    },
    async close() {
      if (closed) return;
      closed = true;
      await unlink(lockPath);
    },
  };
}
