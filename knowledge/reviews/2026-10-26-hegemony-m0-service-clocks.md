# M0.3/M0.4 — Independent service-time clocks

Date: 2026-10-26. Fixed review base: game `c075cbd7909393ba552b5a56fceaa5b41597198a`; implemented source: [`fbe60f6b911956d2b432840f0cfe8970218acd35`](https://github.com/chuongphong12/Sanguosha-vn/commit/fbe60f6b911956d2b432840f0cfe8970218acd35). Input knowledge: `0b57dd50eccf3e5920636830346265267be62e97`. Native authority remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f` (2.3.43-beta2). The user authorized continuing the previously identified clock slice; Q27 and the accepted [session contract](../research/2026-10-22-m0-session-contract.md) establish independent prompt/disconnect clocks and downtime exclusion. M0.3/M0.4 remain open.

## Implemented boundary

| Concern | Executed implementation | Limit |
| --- | --- | --- |
| Prompt | New prompt gets 60 seconds; a second-59 disconnect does not reset it; online expiry executes one decision and retains human control/generation | Only current fixture plain Jink and cancellable Play requests |
| Seat | Independent offline grace; expiry changes control/generation; retained human can reclaim at a serialized boundary | No permanent replacement of explicitly departed members or full autonomous turn worker |
| Empty room | Last passive human disconnect starts 60 seconds; expiry deletes before bot work; explicit last-online Leave still deletes immediately | Two-seat local fixture, no host or production multi-room UX |
| Recovery | Persisted elapsed service time; new monotonic origin at readiness; prompt/seat remainders retained; fresh room return grace | Only checkpointed uptime survives; no exact crash-time accounting or timing SLO |
| Effects | Shared actual Master/admission/Room/Slash/MethodUse/movement path; state, deadlines, memory, authority and receipts commit together | Local file fsync/rename and PID lease; no external SQL/distributed lease/power-loss proof |
| Publication | Timer and human results pass through serialized post-commit actor projection | Loopback Socket.IO; no stock Master packets, production route or complete battle projection |
| Scheduling | Default monotonic OS clock and one-second checkpoint scheduling; no client clock RPC | Controlled-clock tests are not provider latency measurements; delayed queues/writes can delay execution |

The game save identity is `PROTOTYPE-ce4e62b-clock-v3`; older scratch saves are intentionally rejected. The fixture still has eight synthetic cards, two adjacent living seats, fixed Play, one plain Slash, 4 HP and no lethal/rescue/full turns/packages. No `src/`, production server registration or package/lock dependency changed. Production remains Standard 2013.

## Verification executed at this source

The first public-session regression failed before implementation: after disconnect at second 59 and advancing one second, the pending Jink remained unspent. It passed after implementing the deadline owner. Testing controls only the trusted OS scheduling boundary; actual Master, engine, local disk and transport execute.

- `npm run check`: **89 files / 2,153 tests passed**, typecheck passed; lint **0 errors / 42 existing warnings**.
- Focused `tests/prototypes/m0-deadline.test.ts`: **10/10 passed**, also independently executed by each reviewer. The full regression includes all 28 prototype tests.
- Dedicated prototype TypeScript check and `npm run build`: passed.
- `npm run prototype:m0:browser`: **9 checks passed** using actual Chromium contexts, HTTP/Socket.IO, own prompt controls, refresh, Jink/privacy and default OS heartbeat countdown publication.
- Staged whitespace check passed; inspected diff confirms no production source/registration change.

The ten new regressions cover second-59 disconnect; online one-off answer; arbitrary new monotonic origin with saved prompt remainder; empty-room grace independent of bot work; preserved seat remainder plus fresh recovery room grace and exact-expiry rejection; secondary-tab presence/control; actual failed deadline write/no publication/retry once; human/timeout ordering; failed recovery write releasing the writer lease; and actual loopback timeout publication after commit. Existing actual SIGKILL/restart tests also assert positive committed prompt remainder. No real sixty-second provider timeout or full-match timing acceptance is claimed.

Only successful clock checkpoints retain uptime. The one-second scheduling interval is not a hard precision bound under CPU, queue or disk delay. Stop/crash can give back uncommitted uptime, and prolonged checkpoint failures can enlarge the gap. This behavior is an explicit prototype limitation to resolve/measure at the external-store boundary.

## Graph analysis and limitations

Before editing, GitNexus resolved upstream `createPrototype` LOW (4 consumers), `startProofServer` LOW (2) and `chooseBot` LOW (1 known benchmark caller). CodeGraph supplied test consumers omitted by the GitNexus impact query. Ambiguous identity symbols were inspected by actual path/import; UNKNOWN was not accepted as proof of safety. The HTML loader/browser boundary was inspected directly because CodeGraph does not index that template.

After editing, CodeGraph sync passed (2 files added, 6 modified, 183 refreshed nodes). GitNexus's first index failed with LadybugDB's exhausted 256 MiB buffer pool. A process-local `GITNEXUS_LBUG_BUFFER_POOL_SIZE=1073741824` retry with `node .gitnexus/run.cjs analyze --index-only --force` succeeded: **10,916 nodes, 26,900 edges, 271 clusters, 514 flows**. No committed tool/dependency configuration changed.

The full structured staged `detect_changes` response reported **111 changed symbols, 40 affected processes, 10 changed files, aggregate CRITICAL**. Returned changed symbols all belong to the prototype source/test paths. The affected process list includes command/connect/create/disconnect/join/leave/view paths through deadline synchronization, serviceTime, queue and actual engine prompt access. This shared session/deadline dependency is material; the aggregate risk is retained. Scoped `createPrototype`/`startProofServer` remained LOW, while `synchronizeDeadlines` was **CRITICAL** (19 upstream impacts, 6 affected entry-function groups); scoped LOW queries do not override the aggregate.

Actual SHA-256 content for session, deadlines, transport and the new deadline test matched both GitNexus `meta.fileHashes` and CodeGraph `files.content_hash`. Index extraction still reported 451 excluded entry candidates, 1,211 skipped callees and 19 budget-cut walks. The structured change response had no partial/truncated flag, but absence of a graph flow remains insufficient evidence that a path does not exist. Source inspection, public-boundary regression and two independent reviews supplement these limits; they do not establish complete architecture or native parity.

## Independent review

Both reviewers used the same staged ten-file diff against fixed base `c075cbd7909393ba552b5a56fceaa5b41597198a`, before commit, and independently passed the ten deadline tests.

- **Standards:** 0 actionable findings; separate reviewer checked documented standards and Fowler smell heuristics.
- **Spec:** 0 actionable findings; separate reviewer checked the approved bounded clocks, downtime/recovery policy, actual engine effects, authority/privacy, fault behavior and explicit remaining gates.

Reviewed Git blobs, unchanged in the committed source:

| File | Git blob |
| --- | --- |
| `server/prototypes/hegemony-m0/session.ts` | `a1a692bd44ef5d07c1b8c0cf8fa863c62b0dd839` |
| `server/prototypes/hegemony-m0/deadlines.ts` | `b3411814822cdcbcdcce2039b8f890bd12b096b3` |
| `server/prototypes/hegemony-m0/transport.ts` | `578a2e320d521b7e2ba126e86382e8cbc890ea56` |
| `tests/prototypes/m0-deadline.test.ts` | `66257a52af4ee19b3259e12d2437e6fcb5601d86` |

The separate knowledge Standards review found one stale README current-frontier claim (clocks still described as next). The README paragraph/catalog were corrected to this slice and its remaining boundaries; historical reports and source identities were retained. Documentation review and mechanical lint do not change the scope of the game test results above.

## Next boundary

Continue M0.1's reviewed manifest and M0.3/M0.4's broader request-family/bot ownership integration and actual external-store/provider recovery. Measure scheduling/checkpoint precision rather than assuming a one-second bound. Permanent explicit-leave replacement, full turns, complete content/media, competitive strength, 2–10-seat matches, actual five-by-ten load and release gates remain open. No main merge or production deployment follows from this checkpoint.
