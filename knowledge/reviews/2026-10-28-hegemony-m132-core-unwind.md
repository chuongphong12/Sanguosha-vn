# M1.3.2 — Protected core catches

Date: 2026-10-28. Fixed game base 5e525b335975726a4d8f09a5a2db0ed9b52daf8f; inspected [9024429ba89e7a21b090734d51a2d042e85d7928](https://github.com/chuongphong12/Sanguosha-vn/commit/9024429ba89e7a21b090734d51a2d042e85d7928). Input knowledge cebbdee6204583e2f82cd5a998055ef5c1b28476. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f; approved [B design](../specs/hegemony-turn-unwind.md). This completes only checkpoint2; [compiled contract](../engine/core-interruption-cleanup.md).

## Scope and TDD

Changed three operation owners and one new core-unwind test file. Added actual damage/CardUsed hooks and a resumable Room cleanup operation. Introduced the required original Engine flag ledger and explicit ordered/filtered physical catalogue instead of resetting Room wrappers incorrectly. Current application/production profiles, scheduler implementation, dependencies and unrelated kernel modules are unchanged.

Baseline:204/204 in four existing damage/CardUsed/Room/resource suites. The new cases were developed at approved public scheduler seams. Review reproduced three defects with RED regressions: non-Slash catch left its Jink key (two failures, game-over negative control passed); removing wrapped using failed to set modified (one failure); a previously removed captured temp flag emitted an extra prompt after JSON resume (one failure). Each received a surgical correction and green focused rerun.

## Executed checks

- Final focused:306/306 in five files, including102 new cases and204 existing cases.
- Final npm run check:2,318 tests/94 files, typecheck passed, lint0 errors/42 existing warnings. Final npm run build and staged whitespace passed.
- Two independent source reviews resolved all three findings at tree3afb1ccd5e0133039081d24c3d1f95b3bfbdaa5c: Standards0 remaining, Spec0 remaining. Final independent reruns passed306/306 in five suites (Standards) and323/323 in six (Spec). Reviewers did not edit/index files; their earlier305/305 and265/265 runs concern earlier bytes.
- Full check reruns existing M0 Socket.IO loopback regressions. No new M1.3 network integration or standalone browser/SQL/provider/bot-policy/native-runtime execution was performed. Boundary fixtures and actual normalized child compositions are distinguished in the contract; no full-turn or release certification is inferred.

## Graph and byte evidence

Pre-edit impacts for the three existing owner factories:LOW/four each; runCardUsed LOW/one. readCardReference is reused unchanged with CRITICAL98 recorded; this is not a modified helper or an all-clear. CodeGraph runDamage depth3 reaches11 nodes/14 edges; factory10/14. The new cleanup has GitNexus impact UNKNOWN/zero resolved callers; CodeGraph resolves createRoomUseCleanupOperation → realCleanup/new test,3 nodes/4 edges, and text confirms its only composition is the new test. UNKNOWN is retained, not relabeled unused/low.

Final staged summary: 280 changed symbols/10 affected processes/4 files/raw HIGH. All280 symbol records and10 process records were returned; all38 flow steps have IDs; structured partial/truncated flags are absent. Final rebuild used --force --no-parse-cache:11,987 nodes/29,597 edges/274 clusters/537 flows. Extraction still drops481 entry candidates/1,252 callees/25 budget-cut walks. Two older luck-transfer callable candidate sets exceed32;42 cross-language field links remain unresolved, and the large native inventory/font files are skipped by the size cap. These limits are not waived. Hashes below agree across final source, GitNexus and CodeGraph.

| File | SHA-256 |
| --- | --- |
| src/game/hegemony/damage.ts | 68564a98e3ef202557fb1c55b28ae65fa1ed1598033ddf543bd7b28f16da1e3e |
| src/game/hegemony/card-used.ts | 6b2519cbd63f91f5f3d745e4ee7047e7fee03b5032d4bc9201e7a44c7ba60b68 |
| src/game/hegemony/room-use-card.ts | 24e546bb8d19a41335fd6bae5cb058e950cbb577296dfda464e481d363f7a8ae |
| tests/hegemony/core-unwind.test.ts | 0a4eda49e3409cf6014afaae69c2c6cbcf159ef46e9b07f021445bdf10e8cc47 |

| File | Reviewed Git blob |
| --- | --- |
| src/game/hegemony/damage.ts | 51ea3d190cf023bb4fd813e78629324e75992319 |
| src/game/hegemony/card-used.ts | e6669e27ac3a71581f07d5bf6e810c67a1c5050f |
| src/game/hegemony/room-use-card.ts | a36912029f4824721c0283a46ed5823ebc98ee3f |
| tests/hegemony/core-unwind.test.ts | a34f9c520ab14672974277e07550dd4b5b4d131b |

The earlier graph receipt during review had mixed old/new file hashes and was not accepted as final. Rebuilding and byte comparison are required after fixes. Graph raw HIGH/UNKNOWN, extraction caps, unresolved links and the absence of production callers remain limitations; passing tests/hash agreement do not waive them.

## Delivery and next checkpoint

Published source through existing [draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33). At9024429, [CI40651148311](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/40651148311) passed both lint/typecheck/tests and knowledge/checkout jobs using the preceding cebbdee knowledge snapshot. Each later import head requires its own observed remote CI result. Canonical knowledge review/publication/import/lock checks are separate from source checks; this report does not predict later CI success. Preceding M1.3.1 delivery5e525b3 passed CI40625170013.

After this reviewed snapshot is pinned, continue M1.3.3 phase sequence/change/skip/insert and actual GameRule phase/history/typed-mark/limitation/temporary-skill/ImperialOrder cleanup. Turns/recovery and match v3 follow. No main merge or production enablement occurred; full release gates remain open.
