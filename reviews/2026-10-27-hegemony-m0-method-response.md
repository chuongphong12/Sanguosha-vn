# M0.3/M0.4 — Fixture ArcheryAttack and actual MethodResponse

Date: 2026-10-27. Fixed game base: `4f7b68c8389424e5123ef12cd77dd7d92f2aac49`; implemented source: [`3c835ce7a4ebdf89e1754d150a3dc31040977e58`](https://github.com/chuongphong12/Sanguosha-vn/commit/3c835ce7a4ebdf89e1754d150a3dc31040977e58). Input knowledge: `5d34a74dadc773e2c5c0529682a2319b8fb9196f`. Native authority remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. This bounded continuation of the approved M0 session/bot prototypes adds a real fixture card caller for a second request family; it does not close M0.3/M0.4 or enable production Quốc Chiến.

## Result and authorities

| Concern | Actual execution | Explicit fixture boundary |
| --- | --- | --- |
| Play | Generated per-card legality → existing admission/Room history/card use | Eight synthetic cards, two adjacent 4-HP living seats, fixed seat-0 Play |
| ArcheryAttack | Fixed targets at admission; caller expands other living seats and invokes shared card-on-use | Physical card 2; no prohibition/skill catalogue |
| Response | Existing ask-card-response/MethodResponse → physical Jink movement → CardResponded/cleanup/after-hook | Plain physical Jink only; no conversions or broader skills |
| Decline | Actual normalized one-point normal damage, native card-constructor defaults | No lethal/rescue or full turn |
| Session/bot | Existing Master, actor-only offers, generation/revision/receipt checks, automatic deadline/Leave bot | No autonomous full-match or competitive-strength claim |
| Recovery | Existing atomic file/optional SQL state, continuation and receipt before publication | Local durability experiments, no hosted provider/failover acceptance |

Slash still uses MethodUse/JinkEffect/SlashMissed. Archery's Jink uses MethodResponse/CardResponded and does not run those Slash response events. Public outcomes expose the event name, not private event data. Archery is available after the fixture Slash allowance is spent and does not consume that allowance. Nullification is explicitly disabled by the fixture cancellation authority; adding the trick does not certify complete trick/AOE semantics. [Native investigation](../research/2026-10-27-m0-method-response.md) pins the definitions and distinguishes the caller from unchanged normalized library behavior.

Save identity is **`PROTOTYPE-ce4e62b-response-v4`**. Physical card 2 has changed meaning; old clock-v3 (and earlier) documents are rejected rather than reinterpreted. Start a fresh scratch file or new SQL `M0_STORE_NAME`. No automatic migration, destructive reset or older-code rollback proof is supplied.

## Validation executed

Baseline ordinary prototype suite: **37/37 passed**. Initial RED: the integration test could not find a Vạn Tiễn Tề Phát offer. Implementation made the real session flow pass. A later discard expectation was corrected from `[1, 2]` to top-first `[2, 1]` against pinned native prepend semantics; no movement-kernel patch was required.

- `npm run check`: **91 files / 2,169 tests passed**, including **44 ordinary prototype tests**; typecheck passed; lint **0 errors / 42 existing warnings**.
- `npm run build`: passed at final source bytes.
- `npm run prototype:m0:postgres`: **8/8 passed**, using separately owned disposable loopback PostgreSQL containers.
- `npm run prototype:m0:browser`: **12/12 Chromium checks passed**, including three new Archery/MethodResponse controls, spent-Slash availability and pending-response refresh checks.
- Staged whitespace checks passed. No `src/`, production `server/server.ts`, package manifest or dependency-lock changes occurred.

The seven added ordinary tests cover actual Socket.IO MethodResponse success/decline and later Slash legality; owner privacy; wrong/stale/unoffered responses; controller takeover; duplicate receipt/payload collision; real file-write failure with no speculative publication and one retry; online deadline control retention; permanent-bot MethodResponse followed by recovery/MethodUse with revoked human rights; and old-save rejection with writer-lease release. The trusted clock replaces only OS scheduling; actual engine/Master/storage paths execute.

The new SQL case kills/restarts the actual game process while MethodResponse is pending, restores the exact prompt/hand, commits a response while withholding its application ACK, then kills/restarts again and receives the existing receipt with one CardResponded/material cost. This is **application-ACK loss**, not deliberate loss of a SQL COMMIT reply. Earlier SQL failure/fencing, checkpointed-uptime, network/failover and precision limits remain in the [SQL](2026-10-26-hegemony-m0-postgres.md) and [clock](2026-10-26-hegemony-m0-service-clocks.md) reports.

The browser plays/defends Slash, draws again, plays physical Archery 2 after Slash history is spent, refreshes the response owner's tab, and spends that owner's generated Jink offer without HP loss. This proves the bounded real controls rather than a manually constructed client card payload.

## Graph verification

Pre-edit impact: fixtureCard **HIGH/6**, battlePrompt **CRITICAL/9**, actorObservation **CRITICAL/13**, and smaller named entry points LOW. Inline registry callbacks/name-resolution UNKNOWN results were investigated through actual admission/onUse/effect/scheduler definitions and composition; UNKNOWN was not treated as unused or safe.

CodeGraph synced eight executable files (one added, seven modified), refreshing 147 nodes. All eight executable source/test/proof SHA-256 values matched actual bytes, GitNexus file metadata and CodeGraph content hashes. HTML has no CodeGraph index coverage; direct loader/control inspection and real Chromium execution supplement it.

The first incremental GitNexus output reported 66 changed symbols/352 affected processes/raw CRITICAL. Direct queries found empty IDs shared by 4,015 Property, 743 Section and 1,874 Function nodes; every returned affected-process binding was through the README heading. This was an index identity defect, not evidence that production setup had changed. Independent CodeGraph impacts remained scoped to prototype callers/tests (battlePrompt eight nodes/nine edges; fixtureCard seven nodes/seven edges).

A full forced GitNexus rebuild with a process-local 1-GiB buffer restored unique IDs: **11,118 nodes / 27,341 edges / 271 clusters / 512 flows**, no empty-ID nodes. The final structured comparison explicitly against **4f7b68c**, rather than the now-empty committed staging area, reports **101 changed symbols / 25 affected processes / 10 files / raw CRITICAL**. All 122 returned flow-step rows were inspected: prototype archery/battle/engine/session plus actual normalized ask-card-use/card-command/card-on-use/card-resources/damage-rule/scheduler. No changed symbol was outside the prototype/test paths. Scoped impacts remain HIGH/CRITICAL; repairing the index does not lower code risk.

The graph still excludes **458 entry candidates / 1,208 callees / 19 budget-cut walks**. The structured comparison had no partial/truncated flags, but extraction limits remain. An absent returned flow does not prove absence of a dependency, full native equivalence or production safety. No tool dependency/configuration change was needed for the rebuild.

## Independent source review

Both reviewers examined final staged tree `62d2d491ca50f862961060f5af7beaaef42981f0` against fixed base 4f7b68c. **Standards: 0 actionable findings. Spec: 0 actionable findings.** Each independently passed the targeted prompt/deadline/storage suites (**24/24**); Spec also reran actual SQL (**8/8**) and confirmed owned-container cleanup. Neither reviewer edited files.

| File | Reviewed Git blob |
| --- | --- |
| `archery.ts` | `e9dfc38c2a6841105b95db5fc9105c04dd61a04c` |
| `battle.ts` | `64cfc1f7f63f0c4b5c0bb57a6c087040f5f83921` |
| `engine.ts` | `4a00ccc3054a6185b005618dce3d5534d71da4f9` |
| `m0-prompt.test.ts` | `5ccb47c207c86fcfd8a147200b06d7baf740fba2` |
| `m0-deadline.test.ts` | `a877a7d656f3f797918bf02b1a4104e45a703b21` |
| `m0-postgres.proof.ts` | `10bd439dd8a7a86b452cb0c8b2ca5c63248b28d3` |
| `m0-storage.test.ts` | `edc4de1a7319c4846ba8d0a8dc6f38a92fdab5da` |
| `browser-proof.ts` | `19e478f51fc8260e41b9d1a0594a33b8c35b33c9` |
| `demo.html` | `ed68f81af5a77f99ddfe366ba94f26d2cb97ac3d` |
| Prototype `README.md` | `7fc3de4e358e381519a0567c6be41d72c47ec6f2` |

## Remaining boundary

Knowledge ingest advances only the bounded session applicability and adds immutable response-v4/native source records; earlier GameStart/source identities and historical checkpoints remain. Mechanical checks and independent knowledge review are recorded in [the maintenance journal](../log.md). They do not certify all other pages or establish remote CI success.

Other selection/discard/skill/reveal/rescue/Nullification families, full turns, production multi-seat integration, complete manifest/media, competitive bots, measured five-by-ten load, hosted recovery/timing SLOs and release gates remain open. No main merge, provider provisioning or production deployment occurred.
