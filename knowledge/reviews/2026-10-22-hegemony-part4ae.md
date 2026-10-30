# Part 4ae — global GameStart and luck cards

## Authority and reviewed revisions

- Accepted expanded B: [specification #24](https://github.com/chuongphong12/Sanguosha-vn/issues/24) and [local specification](../specs/hegemony-part4ae-game-start.md), approved 2026-10-22.
- Native: `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, release 2.3.43-beta2; clean reference checkout and [eleven matching native file hashes](../research/2026-10-22-game-start.md).
- Source review base: `72185df4b4408b790b2d60a0cc6e8a42dc2d12e9`.
- Implemented game commit: `17c61c710e236637e9ed9829a4893babb6401b06`, branch codex/hegemony-card-admission. Publication of the game branch is not asserted.
- Canonical knowledge review base: `8c58e4334e56d3e4049598101e712fbd6318450c`.

## Delivered behavior and authority boundaries

[Global GameStart](../engine/game-start.md) was validated before [manual luck transfers](../engine/luck-cards.md), then the round owner and actual global composition. Each layer used the approved public dispatch/resume seam, focused tests/typechecking and a canonical knowledge update before advancing.

| Area              | Actual authority exercised                                                                                                                 | Remaining adapter or limit                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Global rule       | Separate null-target bridge, SkipGameRule, lightbox/view/delay order, Limited gates and actual mark writes, FirstRound and initial drawing | Trusted current-general, player-visible skill/lord metadata, settings and next-alive authority             |
| Initial hand      | Actual draw-cards/get-n-cards/Fetch/reservations/recycling/movement/game-over; raw registration order, four cards, empty reason            | Full setup-to-battle provisioning and native movement transport                                            |
| Luck rounds       | Pause boundary, initial non-AI snapshot, strict reply survivor filtering, repeat limit and all accepted logs before returns                | Actual pause/network implementation and AI/connection-state authority                                      |
| Collection        | One registered batch-round child with private normalized ready/payload outcomes                                                            | Simultaneous all-send, common server deadline, authentication and native packet serials                    |
| Physical transfer | Actual ordered whole-hand return, in-flight owner/place, destination filtering, one shared shuffle and ordered sequential redeal           | Trusted original/filter catalogue and recipient-specific notification delivery                             |
| Randomness        | Existing persisted mulberry32-v1 policy and source-derived literal transcript cases                                                        | Exact Qt/qrand bitwise stream and native runtime differential                                              |
| Persistence       | Actual scheduler/operation children, JSON restore and wrong/stale/replayed/registry-mismatched reply rejection                             | Native exception unwind and application reconnect/timeout routing                                          |
| Product           | Isolated normalized engine library                                                                                                         | Full Room/RoomThread and per-player package startup, remaining phases/turns; Standard2013 still registered |

GameStart is not the normal Draw phase. The global branch handles optional private deputy viewing, delay, player-level visible Limited skills (head/deputy/acquired, not just head catalogue), notify-before-set-to-one marks, room FirstRound, normal drawing and positive-limit luck in native order. custom_scenario skips default drawing and conditional deputy view, while retaining other startup work and optional luck. It emits no DrawNCards/AfterDrawNCards/free-chain. A fresh repeated GameStart follows native behavior again; resume alone must avoid duplicates.

Luck retains only ready=true and strict boolean true replies. Missing/not-ready/malformed/false replies permanently eliminate a participant, rather than retry validation. All accepted public logs precede returns; return counts are captured at the native per-player boundary. All hands return before one shuffle, then actual get-n-cards(update=false) and manual hand transfer finish each redeal before the next acquisition. A later shortage preserves earlier completed hands.

Return reason is PUT/player/luck_card; redeal is UNKNOWN with empty string fields. The manual path retains filtering but omits ordinary atomic-arrival visible clearing and movement events. A private configured transit zone preserves unique physical location and native mapping before destination inventory addition during suspended get delivery. It is excluded from available draw order and normal hand inventory. Delivery adapters introduce no gameplay actions. In-flight state remains with frozen frames after interruption; native cleanup/unwind is not fabricated.

## Executed validation and red/green evidence

Final commands exited 0 on the reviewed source:

- Baseline: relevant existing suites **127 tests / 4 files**.
- New focused suites: `npm run test -- tests/hegemony/game-start.test.ts tests/hegemony/luck-transfer.test.ts tests/hegemony/luck-cards.test.ts`: **64 tests / 3 files**, independently repeated by Spec reviewer. Breakdown: 16 global startup, 15 manual transfer, 33 round/composition cases.
- Shared-owner regression during implementation: manual transfer, startup, existing draw-pile and wrapped movement **83 tests / 4 files**.
- `npm run check`: **2,125 tests / 85 files**, typecheck pass, lint **0 errors / 42 inherited warnings**.
- `npm run build`: TypeScript/Vite build pass.
- `git diff --cached --check`: pass before source commit.

Initial public GameStart returned without the expected initial hand; custom startup incorrectly drew instead of preserving only its initialization branch. The private-view test also failed before that branch existed. Manual transfer initially left the original hand unchanged. The luck owner initially retained the old hand rather than the source-derived shuffled/dealt IDs. Each public behavior failure preceded its real implementation. A collection fixture originally coalesced null to an empty map, masking an adversarial adapter-result test; it was corrected to preserve null before the final pass.

Coverage includes global/player targets and SkipGameRule; optional private view/lightbox; marks, duplicate skill entries and lord gates; normal/custom/luck combinations; real shortage with retained startup state; fresh repeats versus resume; return prepend order; actual original/refilter/visible behavior; empty packets/piles; no invented alive/removed gate; strict ready/payload cases; eligibility snapshot before later connection/alive changes; bounded survivor rounds; logs and all returns before first Fetch; literal seed-one five-card permutation and persisted state; sequential late shortage; real global/round composition; ten parameterized JSON suspension boundaries and stale/wrong/duplicate/registry-mismatched replies. Fixture prompts suspend a diagnostic adapter completion and do not represent serial player luck requests.

## Graph evidence and limits

Queries bind the exact engine worktree. Both indexes match all nine reviewed file SHA256 values; empty GitNexus IDs = 0. Existing room-tag reader was CRITICAL (17 direct / 8 selected processes), ruleInput CRITICAL (17/9), allPlayers HIGH (8/4), and setGeneralMark HIGH (3/3) before reuse. Those helper bodies remain unchanged. The global bridge avoids the nonnull-only helper and raw initial drawing avoids current-relative allPlayers. Wrapper preparation was LOW (one direct/one process), swap factory LOW (three direct), and pile validation MEDIUM (six direct/one process) before their scoped changes. The shared shuffle extraction retains the existing arithmetic/stream.

Forced GitNexus 1.6.12 rebuild: **337 files / 10,230 nodes / 25,433 edges / 249 clusters / 513 extracted processes**. CodeGraph 1.6.0: **278 files / 3,463 nodes / 17,805 edges**, complete with no pending changes/references, mismatch or reindex recommendation. New factories have LOW indexed impacts and real test registration callers. Wrapper preparation now has two direct/two selected process consumers; shared mark/tag reader impacts reflect the new owner without a rewrite of those readers.

Staged change detection: **266 changed symbols / 4 affected indexed processes / 9 files**, medium risk. All four step lists were inspected. Cumulative since `21d693e4c9c046b30085fc11a6a434d4d8bb3e31`: **1,968 changed symbols / 60 affected indexed processes / 77 files**, critical risk. The 1,000-symbol result cap was resolved using exact-path Cypher plus the exported original diff-hunk parser; all symbol IDs and affected-process totals match the complete indexed listing.

This does not remove extraction limits: 407 of 607 entrypoint candidates were not ranked, 1,223 callees were skipped at branching limits, 18 walks were cut by budget, and 39 cross-language property sites were declined. Dynamic operation names are not a complete static call graph. The readDrawPiles export alias has three source call sites in the new luck modules that do not appear in piles' six indexed direct callers; the export binding, actual calls, compiled runtime and second graph were inspected. One heuristic wrapper callback trace ends at a judge-test matches function; that name correlation is not a runtime dependency on the judge fixture. Exact owner contexts, supplied callback policies, CodeGraph impacts, native bodies and public composition tests supplement these lower-bound/overapproximate paths.

Machine-local Windows Temp evidence: tqs4ae-explore.json, tqs4ae-selected-impact.json, tqs4ae-native*.json, tqs4ae-web-research.json, tqs4ae-graphs.json, tqs4ae-cg-_.json, tqs4ae-codegraph-status.json, tqs4ae-gitnexus.log, tqs4ae-start-_-red.log, tqs4ae-transfer-red.log, tqs4ae-luck-red.log, tqs4ae-focused.log, tqs4ae-check.log and tqs4ae-build.log. These local receipts are not downloadable repository artifacts.

## Independent source review and exact bytes

Standards: **0 actionable findings**. Spec: **0 actionable findings**, with independent **64-test / 3-file** pass. Staged diff hash-object: `032acaf511ab807d8ba6dcd13cd504a8e46cb9ae`; SHA256: `2160b1a2fe1227f122143872f803f67b674e43f0f176fb37555abda15df11e00`. No source changes followed those reviews.

| Game file                            | Final SHA256                                                     |
| ------------------------------------ | ---------------------------------------------------------------- |
| src/game/hegemony/draw-pile.ts       | ea682f98b0bac017f4805a9d6e4148dcdd8780f185551914f80ae6af33c90046 |
| src/game/hegemony/wrapped-cards.ts   | 3ceec9cddf6355586bb6e09eec0cb6edcf35e9f5342e11c878aec28cbeb6e884 |
| src/game/hegemony/game-start.ts      | 9cba5538d5ae066cde13a7b43a5b2e4b50cb578cd948a889198998c11aa298e5 |
| src/game/hegemony/luck-cards.ts      | 063f8d120b95c83661bb1ad849d7ca76d7ff2dc461f9ab4d6d94ac5c70776107 |
| src/game/hegemony/luck-transfer.ts   | fea72eddaa3a2eebceb1cbf067707640b5c8340477b76b583cd960a898da568e |
| tests/hegemony/game-start.test.ts    | 362bef347eae55039fffbd611d3f471828106f62dbc2c99e1955dbc406bd0014 |
| tests/hegemony/luck-cards.test.ts    | 75d4ad03c83c846381c84d622d563c2fbb84fa469341e9f39e99f888d2fb9c5a |
| tests/hegemony/luck-transfer.test.ts | d80a5dc30d119ef5253c60a40afa59ee0dfc4d4a9afdb3f2a86dc3c49a2d6ecc |
| tests/hegemony/luck-support.ts       | 58af615f08e68341ed838e99eb3a75c0c22f80dc8c68aa1512d55c1c0ab53bff |

Canonical knowledge review against `8c58e4334e56d3e4049598101e712fbd6318450c`: Standards **0 actionable findings**; Spec **0 actionable findings** across all 17 changed/new files. Formatting passes for those 17 files; **84 Markdown files / 354 relative path links** and whitespace checks pass. Published commit/tree identity and offline/upstream plus fresh-clone/old-checkout/return verification are recorded by the delivery receipts, avoiding a self-referential documentation commit here.

## Remaining work

Next scope remaining phase/turn owners and complete startup/package orchestration. Full setup-to-battle synchronization, enabled catalogue/skill manifests, actual broadcast/private notification/authentication/timeout transport, native unwind, filtered battle view/UI/bots and full-match/native differential testing remain separate. This checkpoint does not certify a production match or 100% coverage.
