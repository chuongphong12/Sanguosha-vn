import { startProofServer } from "./transport";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openPostgresStore } from "./postgres";
const path =
  process.argv[2] ??
  join(await mkdtemp(join(tmpdir(), "PROTOTYPE-wipe-me-")), "rooms.json");
const server = await startProofServer(path, {
  port: Number(process.env.PORT ?? 0),
  dropOneCommandAck: process.argv.includes("--drop-ack"),
  openStore: process.env.M0_DATABASE_URL
    ? () =>
        openPostgresStore(
          process.env.M0_DATABASE_URL!,
          process.env.M0_STORE_NAME ?? "PROTOTYPE-wipe-me",
        )
    : undefined,
});
console.log(`THROWAWAY local-only proof: ${server.url}`);
console.log(
  process.env.M0_DATABASE_URL
    ? "Scratch state: PostgreSQL (connection private)"
    : `Scratch state: ${path}`,
);
process.send?.({ url: server.url });
process.on("SIGTERM", () => {
  void server.close().then(() => process.exit());
});
