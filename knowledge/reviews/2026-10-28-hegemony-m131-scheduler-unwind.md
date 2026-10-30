# M1.3.1 — Opt-in unwind interpreter and cooperative yield

Date: 2026-10-28. Fixed base 37c3d178766e23e4a497e67c9088ff1fc3376b45; implemented [32d3e5f68b9d07af9ab6e1cb3f1291939094edd8](https://github.com/chuongphong12/Sanguosha-vn/commit/32d3e5f68b9d07af9ab6e1cb3f1291939094edd8). Input knowledge551bc994d5092b33f135996eef04dd484ab3bc60. The user explicitly approved [B with scheduler-owned opt-in unwind](../specs/hegemony-turn-unwind.md). This checkpoint is only the first of five; [compiled interface](../engine/scheduler-unwind.md).

## Result and evidence boundary

Only scheduler.ts and a new scheduler-unwind.test.ts changed. Registry opts into cleanup; default profiles retain freeze. Added separate normal/cleanup continuation roles, inside-out traversal, cleanup children/private prompts, fresh-throw identity fencing and distinct unwind completion. Budgeted work can yield/JSON-restore/continue without replaying committed stages. Old production/M0/M1 profiles do not opt in, and native core catch bodies, phases/turns and match v3 are not implemented here.

## TDD and executions

Baseline scheduler/operations:39/39 passed. Initial RED lacked unwindTriggerInterruption. Behavioral RED cases then reproduced profile-drift prompt acceptance, same-frame stale interruption receipt reuse, malformed cleanup ownership, omitted boundary acceptance, unknown operation abandonment and a normal receiver regression introduced in the first implementation. Each was corrected. Old receiver behavior is preserved; new throws have opt-in-only monotonic IDs.

- Final focused execution:56/56 across three files, including17 new cases and39 existing cases; both reviewers independently passed it.
- Final npm run check: **2,216 tests/93 files**, typecheck passed, lint0 errors/42 existing warnings. An earlier run had one new unused test-binding warning; it was removed before the final run.
- Final npm run build and staged whitespace: passed at the final reviewed bytes.
- Trace handlers exercise the actual interpreter/seams. They are not actual Room/damage/CardUsed cleanup handlers or full-match/native runtime proofs. Full check reran existing M0 Socket.IO loopback regressions; no new M1.3 network integration proof or standalone browser/SQL/provider/bot-policy run was performed.

## Standards

Independent review found two correctness defects: omitted boundary could run normal work; missing saved operation handler could be popped as no-catch. Both received reproduced RED tests and guard fixes. **0 remaining actionable findings** after final delta; no additional justified Fowler smell finding. Focused56/56/whitespace passed. Reviewer also independently retested the omitted-boundary cooperative-yield variant: rejected without effects.

## Spec

Independent review found the same two defects against owner/continuation invariants. Both corrected; **0 remaining actionable findings**. Independently verified the cooperative-yield reproducer and focused56/56. Both reviewers pinned tree7571e05a9e91b76038fb3fb8831cfbc8465797e8 against the fixed base; neither edited files/indexes.

## Graph integrity and risk

Pre-edit GitNexus impacts: OperationHandler CRITICAL/67 and TriggerScheduler CRITICAL/83. Scheduler entry/function traversals were LOW; that did not waive shared-interface risk. CodeGraph dispatcher depth2 reached72 nodes/134 edges/46 paths. New interface entry points had no pre-existing definition; no empty/UNKNOWN result was treated as clearance.

Final structured staged summary: **190 changed symbols/17 affected processes/2 files/raw CRITICAL**. All190 symbol records and17 process records were returned; no result partial/truncated flag was present. All79 returned flow steps had IDs. Definitions/steps and scoped impacts are retained in the local receipt, not treated as native/runtime proof.

| File | SHA-256; actual bytes = GitNexus = CodeGraph |
| --- | --- |
| src/game/hegemony/scheduler.ts | c4867430d05e7baa15e9d57fb6a1782914139639d9cc1da6523e2d9b8cfc2b5f |
| tests/hegemony/scheduler-unwind.test.ts | b6b79bc4b66e7fc3d22b9ab4aa5564751187b8e8739c841f31d7a7031de19784 |

Final clean rebuild used --force --no-parse-cache: **11,676 nodes/28,934 edges/277 clusters/530 flows**. An earlier incremental receipt had1,032 empty IDs in1,598 flow steps and reported179 symbols/352 processes; it was not accepted as the final graph receipt. Rebuilding without parser-cache replay at the same source bytes produced the complete IDs/counts above. No GitNexus package source was modified.

GitNexus impact for the two new entry points remains UNKNOWN/zero resolved callers; its context surface resolves the new test references. Independent CodeGraph unwind traversal reaches two nodes/two edges; continue-work reaches three nodes/four edges, confined to scheduler/new tests. The discrepancy remains explicit. Type impacts are still CRITICAL: OperationHandler71, TriggerScheduler86. These values do not waive aggregate risk.

Extraction excludes475 entry candidates/1,241 callees/26 budget-cut walks. Two older luck-transfer callable candidate sets exceed32;42 cross-language field links remain incomplete, and the large native inventory/font files remain excluded by the size cap. Hash agreement does not establish complete dependency capture or safe production cutover.

| File | Reviewed Git blob |
| --- | --- |
| scheduler.ts | 788e2bd928bdb27b3bd8cac0341dd4ec6d521391 |
| scheduler-unwind.test.ts | f38cd4ed06322c9ac7371ba2bfa3215f8ad4347a |

Canonical knowledge is reviewed separately against its own fixed base/tree.

## Delivery and next gate

Source is published through [draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33). At32d3e5f, [CI40624482292](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/40624482292) passed knowledge/checkout and lint/typecheck/tests; logs confirm93 files and42 existing warnings. This run used the preceding551bc99 knowledge snapshot. The Vercel frontend preview was pending when checked. Canonical knowledge publication/import/lock and later-head CI checks are performed separately; no future remote success is inferred.

Next: M1.3.2 real protected core catches. It may begin only after this checkpoint's reviewed canonical snapshot is imported/pinned. M1.3.3–5 and all M0/content/bot/media/rooms/hosting/load/cutover gates remain required. No main merge or production enablement occurred.
