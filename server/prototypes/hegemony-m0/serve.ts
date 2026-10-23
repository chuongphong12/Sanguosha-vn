import { startProofServer } from "./transport";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const path =
  process.argv[2] ??
  join(await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")), "rooms.json");
const server = await startProofServer(path, {
  port: Number(process.env.PORT ?? 0),
  dropOneCommandAck: process.argv.includes("--drop-ack"),
});
console.log(`THROWAWAY local-only proof: ${server.url}`);
console.log(`Scratch state: ${path}`);
process.send?.({ url: server.url });
process.on("SIGTERM", () => {
  void server.close().then(() => process.exit());
});
