# M0.4 — Separate local PostgreSQL recovery and writer fencing

Date: 2026-10-26. Fixed game base: `48d186896a641c63c9f22051162d7ade0be44810`; implemented source: [`816191df12e6b9b5849b727104afd4a350d58ca9`](https://github.com/chuongphong12/Sanguosha-vn/commit/816191df12e6b9b5849b727104afd4a350d58ca9). Input knowledge: `aeb89418fd73a12cdbf4304e7126897c053a3ecc`. Native pin remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. User approved continuing the proposed external-store work under Q31 and [M0.4 #30](https://github.com/chuongphong12/Sanguosha-vn/issues/30); this slice is local SQL proof before hosted-provider selection/provisioning. M0.4 remains open.

## Authority and scope

| Boundary | Actual execution | Remaining limitation |
| --- | --- | --- |
| Engine | Same actual staged Master/admission/Room/Slash/MethodUse/Jink/movement operations | Two seats, eight synthetic cards, one Slash/fixed Play; no full turn, package expansion or production registration |
| Default storage | Extracted file adapter, same fsync/rename/PID ownership behavior | Same-machine file is not hosted durable storage |
| Optional SQL | Direct `pg` Client, one namespace document, session advisory ownership and revision-conditional atomic UPDATE | One prototype coordinator; no transaction-pooling support, automatic owner transfer or general distributed-failover acceptance |
| Durable document | State, RNG, frames, deadlines, authority, bot memory and payload-bound receipts commit together | No durable external event outbox or shuffled-draw progression proof |
| Fault/authority | SQL failure/observed connection loss/changed revision fences cached views and commands; restart/reload required | No exact network-failure detection or timing SLA; no induced loss of the SQL commit reply itself |
| Publication | Actual Socket.IO actors, authenticated commands and post-commit allowlisted views | SQL proof uses sockets, not Chromium against SQL; existing Chromium checks remain on default file storage |
| Deletion | Last-human Leave saved, old credentials/room link rejected by a new writer | No physical erasure/WAL/backup retention guarantee |

The file adapter remains the default. An explicitly selected store that fails to open never falls back to file/memory. SQL uncertainty must not retry an operation from cached state: the next writer reloads whatever actually committed, then uses existing receipts. The save identity stays clock-v3 because the serialized session shape is unchanged. Only two pinned development dependencies (`pg` and `@types/pg` 8.23.1) and their 15-package closure are added; existing package, snapshot and patch identities were preserved. No `src/` or production `server/server.ts` change occurred.

## Newly executed checks

- First public-session RED: selecting an unavailable store resolved a file-backed session instead of rejecting. After the storage boundary was implemented, this regression passed.
- `npm run check`: **90 files / 2,154 tests passed**; typecheck passed; lint **0 errors / 42 existing warnings**. Includes 29 ordinary prototype tests; the dedicated SQL suite is separate.
- `npm run prototype:m0:postgres`: **5/5 passed** against actual local PostgreSQL, also independently rerun successfully by each reviewer in separately owned containers.
- `npm run prototype:m0:browser`: **9 checks passed**, actual Chromium contexts/secondary tab/private Jink/refresh/default OS heartbeat, using the unchanged default file path.
- `npm run build`, frozen-lock installation with scripts disabled, and staged whitespace checks passed.

The five SQL cases execute:

1. Two socket actors → pending Jink → actual game-server SIGKILL → new writer restores prompt/hand and saved positive deadline remainder. Another writer is refused while the first owns the namespace. The Jink response then commits with its application ACK withheld, another SIGKILL occurs, and a third writer returns the accepted receipt with one SlashMissed/material cost. Changed-payload duplicate is rejected; owner prompt/privacy remain enforced.
2. A real PostgreSQL CHECK constraint rejects the Jink document update. No speculative response view is published; that writer rejects cached views. After removing the constraint and restarting the owner, the exact old prompt/hand/battle state is restored and the response succeeds once.
3. Actual PostgreSQL container restart while the old game server remains alive. Old writer reads/commands fail; a new writer reloads pending Jink and executes one response. This is a database-process restart, not a hosted failover/power-loss test.
4. An administrative SQL revision change supersedes the cached owner. Its draw update fails CAS and cannot overwrite saved state. A new writer sees the undrawn hand and can draw normally.
5. Last-human Leave commits deletion. A new writer rejects the old credential and room link and creates a distinct fresh room.

Runner: `npm run prototype:m0:postgres`, requiring a running Docker daemon. It pins official image `postgres@sha256:edb0c08dc33befd0262ab3b5cf1c4f3f8cfd8b09e88c05b45adee29d6761ddb6`, creates a unique labelled loopback-only scratch container with an explicit host port retained across restart, waits for readiness, then removes only that owned container and its volume. Missing Docker fails the proof; there is no silent skip. Connection strings and private session bodies are not committed or printed. The ordinary suite does not require Docker. Initial proof-harness fixes separated a helper's pre-read publication from the failed write and stabilized the loopback endpoint across restart; final cases passed without changing runtime behavior for those harness failures.

Existing clock limitations remain: only checkpointed uptime survives a stop; the one-second checkpoint interval is not a precision bound. Most SQL fault cases freeze only the trusted scheduling boundary to isolate persistence; they do not establish provider latency or timing acceptance. Actual default-clock process recovery is exercised in the first case. Application ACK loss is exercised; deliberate loss of a database COMMIT result, blackholed TCP/automatic failover and hosted cold start remain untested.

## Primary sources consulted

Accessed official documentation on 2026-10-26. These mutable/versioned provider/library pages are explanatory references outside the immutable code-source registry.

- PostgreSQL executes an individual successful statement in an implicit transaction; this supports the one-document UPDATE boundary. [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html). Session advisory locks remain until release/session end; this is why the prototype owns one direct connection. [Explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).
- If multiple statements are later grouped, node-postgres requires the same client throughout that transaction. [Driver transactions](https://node-postgres.com/features/transactions). Driver SSL configuration follows the connection options; this code installs no verification bypass. [SSL configuration](https://node-postgres.com/features/ssl).
- Neon documents transaction-pooling restrictions, including session-level advisory locks. This adapter therefore requires a direct/session connection and does not certify a Neon pooled endpoint. [Neon connection pooling](https://neon.com/docs/connect/connection-pooling). No provider/account/region/billing choice was made or tested.

## Graph and review evidence

Before editing, graph context/impact identified the session/transport/benchmark/browser/test callers. `commit` carried **CRITICAL**, 20 upstream impacts across six entry-function groups; acquisition/store-factory consumers were inspected. The index initially lagged by four delivery commits; it was refreshed before implementation, with unchanged source definitions verified. No UNKNOWN result was used as a safety conclusion.

After edits: CodeGraph synced ten executable files (six added, four modified), 142 nodes. GitNexus 1.6.12 rebuilt with a process-local 1 GiB buffer: **10,987 nodes / 27,052 edges / 277 clusters / 510 flows**. Full structured staged change output: **66 changed symbols / 7 affected flows / 12 files / aggregate HIGH**. All returned changed symbols are in this prototype, its proof/config or runner. The seven inspected processes cover command/connect/create/disconnect/join/leave serialization and join→commit→serviceTime. Scoped store/session/transport impacts were LOW; they do not override pre-edit CRITICAL or aggregate HIGH.

SHA-256 content for all nine executable changed/new source, test, proof, runner and config files matched both GitNexus file hashes and CodeGraph `files.content_hash`. Graph extraction still omitted 456 entry candidates and 1,208 callees, with 19 budget-cut walks. The structured change response had no partial/truncated flag; extraction limits and dynamic store-factory callers still require direct source/test inspection. Raw risk is retained rather than treated as production clearance.

Separate code reviews used final staged tree `ca8204011d8a41ced45c139f98bb20cae7358cde` against the fixed base. **Standards: 0 actionable findings. Spec: one README inconsistency corrected, 0 remaining**. Both independently passed the five SQL cases. Runtime blobs stayed unchanged while README was corrected to distinguish file retries from SQL fencing and local SQL from hosted acceptance:

| File | Reviewed Git blob |
| --- | --- |
| `session.ts` | `7f14d43c9254d1952ff45c3d7b95618bf2375c26` |
| `storage.ts` | `fbd20ce5c2a90260db4d1770348cee0491eca65f` |
| `postgres.ts` | `4252826bbac519bf22279aee6b563677870029ec` |
| `transport.ts` | `543cfa60e5b913d368e8eb345d7a87763ab14c29` |
| `m0-postgres.proof.ts` | `6b48007a69a0fb706903664b2c1444ca71d98fb0` |

## Next boundary

Knowledge maintenance lint passed: 104 Markdown pages, 475 relative file links, three heading anchors, 472 pinned GitHub citations/459 line locators and 97 local Git objects; 35 sources, two scoped pages and 34 relations resolved. Existing 28 source identities were retained. Separate knowledge review additionally corrected the session page's stale file-only commit wording and explicitly scoped prior clock executions to their original `fbe60f6` revision. Mechanical validity does not certify every semantic claim or mutable external endpoint.

Extend other pending request families/bot ownership through actual engine authorities; permanent explicit-leave bot replacement still remains. A hosted-provider experiment requires separately authorized provisioning and current account/free-tier/TLS/connection/sleep/retention checks. The local direct SQL proof alone does not select Neon/Render or close M0.4. Keep M0.1/M0.3/M0.4, full content/media, competitive strength, five-by-ten load, timing SLOs and release gates open. No main merge or production deployment occurred.
