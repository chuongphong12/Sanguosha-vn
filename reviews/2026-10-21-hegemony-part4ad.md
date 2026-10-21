# Part 4ad — batch drawing and Draw phase

## Authority and revisions

- Accepted expanded B: [specification #23](https://github.com/chuongphong12/Sanguosha-vn/issues/23) and [local specification](../specs/hegemony-part4ad-card-drawing.md).
- Native: clean pinned reference `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, release 2.3.43-beta2; [research and eight matching native hashes](../research/2026-10-21-card-drawing.md).
- Source review base: `db62db9f63e30595e1dfa80fcf41a4eeca8dc6a3`.
- Implemented game commit: `9f84bd0152d9fafed5cc6e30533989e2d6f86495`, branch codex/hegemony-card-admission. Game branch publication is not asserted.

## Delivered behavior and authority boundaries

Each dependent layer was implemented test-first, validated through actual scheduler dispatch/resume and typechecking, then its canonical knowledge updated before moving to the next. [Batch/player drawing](../engine/card-drawing.md) builds on [4ac draw reservations and recycling](../engine/draw-pile.md); [Draw-phase orchestration](../engine/draw-phase.md) composes those real operations.

| Area          | Actual authority exercised                                                                                                                  | Remaining adapter or exclusion                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Acquisition   | get-n-cards pre-swap/capacity, per-card Fetch, top/bottom, actual draw/swap/game-over, persisted reservations and portable RNG              | Trusted setup/seed; exact Qt stream parity                                                           |
| Hand transfer | Captured recipient lists, native count/direction fallbacks, live per-slot gate/reform, one real atomic movement including empty transaction | Whole native movement transport/count delivery                                                       |
| Consumers     | Actual fill-hand deficit and halfmaxhp token use body composed with real draw-cards                                                         | Catalogue, request/eligibility/filter metadata fixtures; other token branches are not certified here |
| Phase         | Exact draw phase, JieyueExtraDraw, player Global_FirstRound, DrawNCards/AfterDrawNCards, all three real free-chain drains                   | Other phase bodies, phase start/end and full turn scheduler                                          |
| Free chain    | Actual queued GeneralShowed/reward grants and real kill-player surrender composition                                                        | Package metadata/reveal delivery and broader burial/victory product                                  |
| Persistence   | Actual dispatch/resume, JSON continuation restore, wrong/stale/replayed response rejection                                                  | Network authentication, timeout/application routing, native exception unwind                         |
| Product       | Isolated normalized engine library                                                                                                          | Initial dealing/luck cards and production integration; Standard2013 still registered                 |

Batch capacity is checked before any Fetch; late child shortage preserves earlier reservations. Multiple recipients acquire in order before the single hand-transfer transaction, so a later shortage leaves earlier hands untouched. Counts are signed; nonpositive acquisition still optionally reports current pile size. Recipient indices advance across skipped entries, duplicates remain, short counts repeat the last and missing directions default top. No aggregate capacity precheck or extra removed/after-acquisition alive guard was added.

DRAW reason uses recipient actor, request reason as skill and empty eventName. Deterministic normalized open=false preserves hand privacy; native raw uninitialized open is not claimed equivalent. The owner adds no fabricated post-drawCards pile notice: native delivery belongs inside movement, which remains the stated transport boundary.

The phase removes the player flag, triggers mutable DrawNCards, drains free-chain, captures the rewritten integer, draws positive counts with the native empty reason, drains again, emits AfterDrawNCards with that captured count even when nonpositive or transfer is skipped, and drains a third time. Event consumption is not owner cancellation. Invalid rewritten counts reject after earlier eager effects; suspended frames preserve stage/count to avoid duplicate work.

## Executed validation

All final commands exited 0:

- Baseline before implementation: five relevant files, **269 tests**.
- Final focused: `npm run test -- tests/hegemony/draw-phase.test.ts tests/hegemony/player-draw.test.ts tests/hegemony/batch-draw.test.ts`: **55 tests / 3 files** (13 batch, 22 player drawing, 20 phase); independently repeated by Spec reviewer.
- `npm run check`: **2,061 tests / 82 files**, typecheck passes, lint **0 errors / 42 inherited warnings**.
- `npm run build`: TypeScript/Vite build passes on the final source.
- `git diff --cached --check`: pass before source commit.

Public dispatch initially failed with an empty batch rather than [0,1], absent hand transfer, and absent phase draw respectively. Each real operation then passed its focused tests before the dependent layer was implemented. A surrender-composition test exposed a fixture request field error (who versus target); the fixture was corrected to the actual kill-player contract without changing that engine.

Coverage includes ID zero, pre-swap with a nonempty pile, immediate/late shortage and retained reservations, suppressed batch notices versus swap notices, nested Fetch mutations, current count, invalid lists and nonpositive counts, empty movement, duplicate recipients and fallback indices, dead/reform/removed behavior, eager interruption, wrapper visibility/filtering, actual fill-hand/token composition, three actual reward drains, surrender death, mutable/consumed events, signed count arithmetic, SkipGameRule/phase guards and repeated JSON suspension.

## Graph evidence and limits

Exact checkout binding and SHA256 equality were checked against both indexes for all seven changed files. Empty GitNexus IDs = 0. Pre-edit movement was CRITICAL (39 direct callers), readRecipientFlags CRITICAL (23/12 selected processes), generalMark HIGH (7/4), and allPlayers HIGH (8/4); risks were reported and all those shared implementations remain unchanged. New owners reuse the existing scheduler/movement/free-chain contracts.

Final forced GitNexus 1.6.12 index: **325 files / 9,924 nodes / 24,970 edges / 242 clusters / 517 extracted processes**. CodeGraph 1.6.0: **271 files / 3,399 nodes / 17,454 edges**, complete without pending changes/references, mismatch or reindex recommendation. Exact contexts and depth-three CodeGraph impacts identify the new factories' test registration consumers. Factory LOW impacts do not mean dynamic operation dispatch is absent.

Staged detection: **196 changed symbols / 6 affected indexed processes / 7 files**, high risk. All six step lists were inspected, covering the new operation run bodies and their count/phase readers. Cumulative since `21d693e4c9c046b30085fc11a6a434d4d8bb3e31`: **1,675 symbols / 59 affected indexed processes / 64 files**, critical risk. The 1,000-symbol listing cap was resolved with bounded exact-path Cypher plus the exported original diff-hunk parser; all symbol IDs and process totals match the complete indexed listing.

Post-change readRecipientFlags is CRITICAL (25 direct / 11 selected processes), generalMark HIGH (8/4); exact caller contexts include the new phase reader and the unchanged existing effect, damage, death, dying, reveal and reward consumers. The full regression covers existing consumers. No shared helper rewrite was required.

Extraction limits remain: 398 of 598 entrypoint candidates not ranked, 1,233 callees skipped at branching limits, 18 walks cut by budget and 39 declined cross-language property sites. Exact source/native bodies, registration contexts, the second graph and real public dispatch tests supplement these limits. This is not exhaustive static flow enumeration, whole-match coverage or native differential certification.

Machine-local evidence in Windows Temp: tqs4ad-explore.json, tqs4ad-phase-context.json, tqs4ad-wrapped-context.json, tqs4ad-native-graph.json, tqs4ad-native-exact.json, tqs4ad-graphs.json, tqs4ad-cg-*.json, tqs4ad-codegraph-status.json, tqs4ad-gitnexus.log, tqs4ad-check.log and tqs4ad-build.log. These are local receipts, not durable downloadable repository artifacts.

## Independent review and reviewed bytes

Source Standards: **0 actionable findings**. Source Spec: **0 actionable findings**, with independent **55-test / 3-file** pass. The fixed review base is listed above; no source changes followed those reviews.

| Game file                          | Final SHA256                                                     |
| ---------------------------------- | ---------------------------------------------------------------- |
| src/game/hegemony/draw-pile.ts     | 4e305d6e7206c986aaeb5effea61ed9deb1e810d16a261dc3990ed88e2029d8e |
| src/game/hegemony/draw-cards.ts    | ef21c936c271ebae84f496c8d3f1782ef2c3e3f634e2910f7ddad384250fcb0c |
| src/game/hegemony/draw-phase.ts    | 7f13a80fb0cd8a4d17bf81e6b7be1b76db5ec913740a574dee38db96d253092c |
| tests/hegemony/batch-draw.test.ts  | 6c520262445ed78e01a7adc6d63dc6e8c1168caab006b8d685c575263f1770b3 |
| tests/hegemony/player-draw.test.ts | bc4a86fc652d2f164ae6e23b0ac663d8635a8e9e02d06692333d90731739a73f |
| tests/hegemony/draw-phase.test.ts  | 0d95c871bce038d3e1307a8b588526425eb4be1299de83e82ef6fd3e22c417f4 |
| tests/hegemony/drawing-support.ts  | 39406fc3ea35d548ad67fb3e94f86271b45f2bffe948b45aae74ee1d58ee552f |

Canonical knowledge review against `1d20ef341182d469a46eb786425b7edd2b07968f`: Standards **0 actionable findings**; Spec **0 actionable findings** across all 13 changed/new files. Formatting passes for those 13 files; **79 Markdown files / 315 relative path links** and whitespace checks pass. Published pin/tree identity and offline/upstream plus fresh-clone/old-branch/return checks are recorded by delivery receipts, avoiding a self-referential documentation commit here.

## Remaining work

Next scope GameStart/initial dealing and remaining phase/turn owners, followed by enabled content and application integration. Luck cards, complete package/authentication/catalogue authorities, native unwind, private battle projection, movement transport/UI/bots and full-match/native differential testing remain separate. This checkpoint does not certify production readiness or 100% coverage.
