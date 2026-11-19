/** THROWAWAY: direct PostgreSQL connection, one session document and one writer. */
import { Client } from "pg";
import type { SessionStore } from "./storage";

export async function openPostgresStore(
  connectionString: string,
  namespace: string,
): Promise<SessionStore> {
  const client = new Client({
    connectionString,
    application_name: `tqs-m0:${namespace}`,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
  });
  let active = true;
  function fence() {
    active = false;
    void client.end().catch(() => {});
  }
  function assertActive() {
    if (!active) throw new Error("PostgreSQL writer fenced; restart required");
  }
  client.on("error", fence);
  client.on("end", () => {
    active = false;
  });
  let revision: string;
  let document: string | null;
  try {
    await client.connect();
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
      [`tqs-m0:${namespace}`],
    );
    if (!lock.rows[0].acquired) {
      await client.end();
      throw new Error("Prototype writer already active");
    }
    await client.query(`CREATE TABLE IF NOT EXISTS prototype_m0_sessions (
      name text PRIMARY KEY, revision bigint NOT NULL DEFAULT 0, body jsonb
    )`);
    await client.query(
      "INSERT INTO prototype_m0_sessions (name) VALUES ($1) ON CONFLICT DO NOTHING",
      [namespace],
    );
    const saved = await client.query<{
      revision: string;
      document: string | null;
    }>(
      "SELECT revision::text, body::text AS document FROM prototype_m0_sessions WHERE name=$1",
      [namespace],
    );
    revision = saved.rows[0].revision;
    document = saved.rows[0].document;
  } catch (error) {
    fence();
    if (
      error instanceof Error &&
      error.message === "Prototype writer already active"
    )
      throw error;
    throw new Error("PostgreSQL store unavailable");
  }
  return {
    async read() {
      assertActive();
      return document;
    },
    async write(next) {
      assertActive();
      try {
        // One autocommitted statement owns the whole document. CAS also fences an altered row.
        const saved = await client.query<{ revision: string }>(
          `UPDATE prototype_m0_sessions SET body=$1::jsonb, revision=revision+1
           WHERE name=$2 AND revision=$3::bigint RETURNING revision::text`,
          [next, namespace, revision],
        );
        if (saved.rowCount !== 1) throw new Error("Writer revision changed");
        revision = saved.rows[0].revision;
        document = next;
        assertActive();
      } catch {
        // A timeout/disconnect may mean the commit succeeded without its reply.
        // Never retry from cached state; a new writer must reload state and receipts.
        fence();
        throw new Error("PostgreSQL commit uncertain; restart required");
      }
    },
    assertActive,
    async close() {
      active = false;
      await client.end();
    },
  };
}
