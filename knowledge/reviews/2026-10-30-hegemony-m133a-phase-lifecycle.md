# M1.3.3a — Phase lifecycle slice

Date:2026-10-30. Fixed game base3cbea1d62b017c6a72e1926bf02419daa810b0b7; implemented [e55e15b37b90fa764de21cd2c94b2e488030d6d8](https://github.com/chuongphong12/Sanguosha-vn/commit/e55e15b37b90fa764de21cd2c94b2e488030d6d8). Input knowledgeb6b09c1034c2abfc0948fb2de9778f9267577072; nativece4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. [Accepted B](../specs/hegemony-turn-unwind.md) already authorizes this slice. [Compiled lifecycle](../engine/phase-lifecycle.md). M1.3.3 stays open for actual GameRule cleanup; M1.3.4–5 and release scope are unchanged.

## Implementation and TDD

Only new phases.ts and phases.test.ts change. One current Room phase authority, separate native queue/state/index, play/direct/execute operations and package skip/insert/query helpers compose the existing scheduler. No existing production/application/kernel implementation was edited.

Existing baseline210/210 in four Draw/general/movement/death suites passed. First RED lacked the new module; subsequent RED reproduced missing direct-change/dead routing, missing skip/insert helpers, skipped-current-NotActive early termination and lost old index on dead entry. Each received minimal behavior fixes. A missing-child assertion initially expected the wrong existing scheduler error text; the test expectation was corrected without changing scheduler behavior.

Final focused66/66 in two suites includes46 new cases and20 existing Draw cases. Final npm run check:2,364 tests/95 files, typecheck passed, lint0 errors/42 pre-existing warnings. Final npm run build and staged whitespace passed. Independent source Standards and Spec reviews each found0 actionable findings at tree276ae13d7a488e81a16992f21ea64a97f02b955b; each independently passed66/66 and made no edits.

The first full run, while graph analysis was also running, timed out at25 seconds in the existing M0 SIGKILL/Jink restore test (2,363 passed/one failed). The unchanged test then passed in isolation:one passed/nine skipped,4.90 seconds total. A fresh full run after indexing completed passed2,364/95 in36.21 seconds at the same source bytes. No prototype, test timeout or test configuration was edited. Contention is a plausible explanation, not an established root cause; this timing limitation is retained rather than reported as a fixed prototype defect.

Trace children establish the phase protocol at dispatch/resume/helper seams; separate Draw composition exercises real children. Full check reruns existing M0 Socket.IO loopback regressions, but adds no new phase network/browser/SQL/provider/bot-policy/native-runtime or full-match proof. No competitive AI/package/full-turn/production claim follows.

## Graph evidence

Pre-edit new factory/cleanup names were absent/UNKNOWN, not unused. Existing draw factory's GitNexus caller walk was UNKNOWN while CodeGraph resolved its three-node/three-edge test composition. Query-only deathOrder was HIGH15 for the later cleanup dependency and was not edited or introduced as this slice's dependency. Final CodeGraph resolves createPhaseOperations to new test setup, three nodes/four edges. Source imports only scheduler types. Final GitNexus impact remains UNKNOWN/zero resolved callers for the factory, skipPhase, insertPhase and isPhaseSkipped; CodeGraph and explicit text references identify their test consumers. Text/context corroboration remains distinct from a complete graph.

Final staged summary:176 changed symbols/3 affected processes/2 files/raw MEDIUM. All176 symbol records/three process records were returned, all11 flow steps have IDs and structured partial/truncated flags are absent. Rebuilt with --force --no-parse-cache:12,190 nodes/30,066 edges/280 clusters/540 flows. Extraction still drops494 entry candidates/1,253 callees/25 budget-cut walks. Two older luck-transfer callable candidate sets exceed32,42 cross-language field links remain unresolved, and the large inventory/font files remain size-excluded. No source modification to GitNexus was made; hash agreement and passing tests do not waive these gaps or UNKNOWN.

| File | SHA-256; source = GitNexus = CodeGraph |
| --- | --- |
| src/game/hegemony/phases.ts | e383a237a41ef23da25191a35796073d83045cc42cda79f420105746861ce773 |
| tests/hegemony/phases.test.ts | bf551b1a58728bb2ba18c8474432a50ae2c55be851e71223eec12fc9cc56afeb |

| File | Reviewed Git blob |
| --- | --- |
| src/game/hegemony/phases.ts | d89e23cc250071978f3655060329aec184c16e27 |
| tests/hegemony/phases.test.ts | c99149f2f5e93fe0318fe69c85ddc5714b8d3a67 |

## Delivery and next dependency

Source is delivered through [draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33). [CI40989733895](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/40989733895) passed both jobs at e55e15b; logs confirm95 files/2,364 tests and42 existing warnings. That run verified the preceding b6b09c1 knowledge snapshot. Each later import head needs its own observed CI result. Reviewed canonical knowledge publication/import/lock verification are separate; no later CI success is inferred here. No main merge or production enablement occurred.

Continue M1.3.3 with actual GameRule cleanup before M1.3.4: phase/history/typed-mark clearing, card limitations and temporary skill batch mutation/deferred events, and real ImperialOrder effects under the no-treasure policy. This slice is an internal validation boundary, not a reduction of the five-checkpoint design.
