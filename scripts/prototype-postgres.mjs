/** THROWAWAY local PostgreSQL proof. Owns only its uniquely named scratch container. */
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { createServer } from "node:net";
const name = `tqs-m0-proof-${randomUUID()}`;
const password = randomUUID();
const image =
  "postgres@sha256:edb0c08dc33befd0262ab3b5cf1c4f3f8cfd8b09e88c05b45adee29d6761ddb6";
const docker = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let created = false;
const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
try {
  docker(
    "create",
    "--name",
    name,
    "--label",
    "tqs.prototype=m0-postgres",
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-p",
    `127.0.0.1:${port}:5432`,
    image,
  );
  created = true;
  docker("start", name);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      docker("exec", name, "pg_isready", "-U", "postgres");
      ready = true;
      break;
    } catch {
      await setTimeout(500);
    }
  }
  if (!ready) throw new Error("Scratch PostgreSQL did not become ready");
  console.log(`Local PostgreSQL proof: ${image}, container ${name}`);
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--config",
      "vitest.postgres.config.ts",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        M0_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`,
        M0_PROOF_CONTAINER: name,
      },
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  if (created) {
    const label = docker(
      "inspect",
      "--format",
      '{{index .Config.Labels "tqs.prototype"}}',
      name,
    );
    if (label !== "m0-postgres")
      throw new Error("Scratch container label mismatch");
    docker("rm", "--force", "--volumes", name);
  }
}
