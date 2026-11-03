# M1.3.4b.2 — Play phase activation

Date:2026-11-03. Fixed game base8c7b510f62b8aae586e5fa637685c6ec562fd1d7; [source1f5a99747619dd78f2f5ed15906c13df4747b798](https://github.com/chuongphong12/Sanguosha-vn/commit/1f5a99747619dd78f2f5ed15906c13df4747b798); input knowledge9b251b3d7a2b86a23bdc2614d9bd1a316e99e21a; nativece4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. [Approved B checkpoint4](../specs/hegemony-turn-unwind.md) continues through [this library slice](../engine/play-phase.md). One new module, one new test suite and a seven-line admission opt-in (with six new admission tests) change; no production/M0/profile/dependency change. Discard and M1.3.5 remain required.

## Executed checks and reviews

Baseline93/93 in three existing admission/token/phase-body suites. Behavioral RED: a real rejected Room attempt remained inside admission instead of returning a rejected completion; corrected with an optional Play-only request boolean. Play RED after successful dispatch of a stub body failed because no actor prompt appeared; the missing-module import failure before that was not used as behavioral evidence. Added22 Play tests and6 admission tests. The package fixture needed its implied recipient to exercise the real card-use target loop; that fixture correction is not an engine defect.

Final npm run check passed2,514 tests/99 files, typecheck and0 lint errors/42 existing warnings. npm run build passed on the same source bytes. An earlier focused112/112 in four suites preceded the final9 added regression cases; final fullcheck includes all28 additions. Existing M0 Socket.IO regressions rerun in the suite; no new browser/SQL/provider/bot/native-runtime/full-match execution is claimed.

Independent source Standards0 and Spec0 actionable findings reviewed exact staged treea1fac175c8a77a775acda2feffa6f53794f2a113 against the fixed base; committed source has that same tree. The Spec axis read pinned native Git blobs; neither reviewer claimed to run tests. Parent executions supply the receipts above.

## Graph evidence and exact bytes

Pre-edit createCardCommandAdmission LOW4; CodeGraph depth2 reached5 nodes/7 edges. ruleInput CRITICAL47 and readRecipientFlags CRITICAL55 were warning/reuse-only, unchanged; their shared-helper risk was communicated. createPhaseBodyOperations/createFreeChainOperation UNKNOWN walks required source/context confirmation. New Play factory now remains UNKNOWN in GitNexus; CodeGraph finds its test setup at3 nodes/3 edges. UNKNOWN does not mean unused or safe.

Clean GitNexus --force --no-parse-cache rebuild:13,067 nodes/32,122 edges/305 clusters/503 flows. Global extraction omitted550 entry candidates and1,213 callees, cut21 walks;42 cross-language property links and two old luck-transfer callable sets over32 remain unresolved. Large inventory/font files are size-excluded. Whole-slice detect_changes scope all: HIGH,126 changed symbols,12 affected processes,4 files;46 resolved flow steps,0 missing IDs, no per-result partial/truncated marker. The parent inspected all affected steps: admission context/inPlay, offer/material/resource binding, signature and target feasibility/filter/prohibition paths. Global omissions still limit coverage. Factory impact LOW and whole-slice HIGH measure different scopes; neither waives the other.

| File | SHA-256, source = GitNexus = CodeGraph |
| --- | --- |
| src/game/hegemony/play-phase.ts | 892c2b6a122a95f9c4ca10ec20bd206682987e284e57762f143bad73d7a9ca9b |
| src/game/hegemony/card-command.ts | f4304b70d92f06b1e089adbaeb157755511e3e356d620c3d4b1529fd177e96f5 |
| tests/hegemony/play-phase.test.ts | 153d79c55096b5f24ecbfc124ca1eafa79957df8abab68f7390076a289e53180 |
| tests/hegemony/card-command.test.ts | ca3f3302cb708c420dde0811b9f33b9484cc180e3b7a2a3b6a6290e8baf33af2 |

## Knowledge and delivery

The source commit is published on the existing draft PR33 branch. Source [CI41568108094](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/41568108094) passed both jobs at PR head1f5a99747619dd78f2f5ed15906c13df4747b798, synthetic merge341fb27 into main3cb751449afcd98748a4cebcc54fd5414e5fbce9. It ran2,514/99 with0 lint errors/42 old warnings and verified preceding knowledge9b251b3 offline/upstream. Canonical knowledge lint/reviews and later integration-head CI remain separate checks. This record does not assert a future import or CI result. Main remains unmerged; no production mode changed. [Draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33).

Next: Discard/token/rule-discard body, then aggregate match-v3 and setup-to-terminal acceptance. All manifest/content/media/bot/room/provider/load/UI/cutover gates remain unchanged.

Mechanical lint passed128 Markdown pages/721 relative file links/3 heading anchors,581 pinned GitHub citations/519 line locators/155 local Git objects,123 sources/11 scoped pages/131 relations;0 errors. All116 prior source records/10 page records and applicability/124 relations are unchanged. Code scope is exactly the four reviewed files; production/dependencies/other kernels are unchanged. These checks establish reference integrity and bounded scope, not complete semantic correctness or native-runtime parity.

Independent canonical knowledge Standards and Spec reviews each found0 actionable findings across14 staged files at tree66f8786562492af2e02fb9c3845d942eeb471ef0. This added receipt requires a final delta review before publication; it does not establish the future game import or CI.
