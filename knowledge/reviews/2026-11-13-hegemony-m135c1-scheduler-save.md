# M1.3.5c.1 — shared scheduler save codec checkpoint

Date: 2026-11-13. Game 9adedb305a364b00eb0e49564dc693058039e21e; fixed base c2d4e7eb5069bfcd3143ee736f6b88da9548adbd; exact reviewed tree 455d57670cb9de476807c84a7e8a395a8a5b48cf. Knowledge input 6b45f7f28f9e24a58d45721d0645a63719bc84ef; native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. [Contract](../engine/scheduler-save.md), [approved B mechanism](../specs/hegemony-match-v3-save.md). Source changes exactly scheduler.ts, scheduler-save.ts and scheduler-save.test.ts.

## Real/fixture boundary

Real: existing dispatch/event/operation/resume/cooperative continuation/unwind, frame allocation, actor-choice derivation and the new decoder/hooks. Fixture: paid-operation/skill/event schemas, cleanup acknowledgement and synthetic game counters. No actual native executable, core/package codec, Room decoder, combat-to-terminal, browser, socket/store/provider/load or production proof. Generic decoder cannot validate arbitrary Room or verify historical authenticity.

## Executed validation

Baseline scheduler 53/53. Final focused 130/130 includes 77 new decoder cases. Full lint/typecheck/test (maxWorkers=2) passed 2712/105; lint 0 errors/42 prior warnings. Final build passed. Validators see copied arguments; pending prompts decode without replaying paid work. Real cleanup JSON checkpoints run budgets 1/2/7/10000.

Behavioral RED preceded implementation and each review correction. Initial missing-module collection failure is distinct from the later actual unimplemented-decoder behavioral RED. New-code REDs rejected incomplete envelope/table/occurrence checks, optional false markers, invalid deep cursor/results and key-order-sensitive prompt comparison. Typecheck caught a test fixture mixing different game generics, corrected without a cast. These are new-slice defects/fixtures, not previously published production bugs.

Initial Standards found 1 duplication judgement call; fixed by reusing actorChoices without changing its body. Initial Spec found 4 issues (prompt unavailable to validators, actor rotation, tied skill order, cross-prefix IDs), then 1 nested-stack relation, then 2 reason/policy checks; all have regression tests and were corrected. Final independent Standards 0/Spec 0 at the exact tree above. In-progress checks that overlapped edits are not final receipts; the delivery-named logs and exact hashes identify final checks. No assertions/timeouts were weakened.

Compiled scheduler output comparison removes only the new actorChoices export and comments/types: equal SHA-256 489b2a348b6ba221128ae6ffdafff3abfb1ab35fdbb43216425a78dcc8ac8ef9. This proves interpreter-byte preservation under that explicit normalization, not all runtime/package correctness.

## Graph evidence

Pre-edit shared contracts/frame types CRITICAL (81–95 resolved symbols,4–6 processes depending on type); resumeTriggerPrompt HIGH 7/4 processes; actorChoices HIGH 15/4 processes. Risks were reported before edits. Existing interpreter bodies/profiles were preserved. New factory initially absent/UNKNOWN; no zero was treated as unused. Direct source and CodeGraph checks supplement extraction limits.

Final change summary: {"changed_count":112,"affected_count":4,"changed_files":3,"risk_level":"medium"}. The result has no partial/truncated flags, no empty changed IDs and no empty IDs among 17 inspected steps. Four affected paths are M0 move, card submit, discard submit and discard timeout through the unchanged actorChoices body; this is not evidence of executing those gameplay flows. Source/GitNexus/CodeGraph hashes:

- src/game/hegemony/scheduler.ts: 2bcc1e346a13a53ce1451737061c8040508dff2686a1cb4cbaaf5e56aa85103d; GN 2bcc1e346a13a53ce1451737061c8040508dff2686a1cb4cbaaf5e56aa85103d; CG 2bcc1e346a13a53ce1451737061c8040508dff2686a1cb4cbaaf5e56aa85103d
- src/game/hegemony/scheduler-save.ts: 37876aeb81381092541322ace8f035ce7b71c41575b9420f05452e4701dd6c91; GN 37876aeb81381092541322ace8f035ce7b71c41575b9420f05452e4701dd6c91; CG 37876aeb81381092541322ace8f035ce7b71c41575b9420f05452e4701dd6c91
- tests/hegemony/scheduler-save.test.ts: 7677d91085b14100a5bdc332341bee965050795fde31dc0043db2ab53ebb0951; GN 7677d91085b14100a5bdc332341bee965050795fde31dc0043db2ab53ebb0951; CG 7677d91085b14100a5bdc332341bee965050795fde31dc0043db2ab53ebb0951

A clean force/no-parse-cache one-worker rebuild completed: 13,713 nodes / 34,394 edges / 293 clusters / 491 flows. Unresolved global extraction: 575 omitted entry candidates, 1,220 omitted callees, 17 budget-cut walks, 42 cross-language property links; two older luck callbacks exceed cap 32, and inventory/font size caps remain. Graph completeness is not claimed. Artifacts are TEMP/tqs-m135c1-{delivery-*,postgraph-2026-11-13.json,interpreter-proof-2026-11-13.json}; local ephemeral artifacts are supplementary, this checkpoint is the durable scope record.

## Publication and next dependency

Canonical lint/reviews/publication, game import/pin and source/integration CI are separate delivery gates, never inferred from tests or a journal entry. PR #33 remains draft; no main/production transition. Next implement actual enabled profile codecs and aggregate Room decoding before public v3 routing/projection and combat-to-terminal.

## Canonical pre-publication receipts

Mechanical lint passed 139 Markdown pages, 815 relative file links, 3 heading anchors, 600 pinned citations, 523 line locators and 169 local Git objects, with 0 errors. Registry preserves all 141 sources / 15 page records / 149 relations from the input snapshot; totals are 144 / 16 / 152. A Standards finding corrected the new test source kind to test_code; historical identities are unchanged. These checks do not certify all semantic claims or external endpoints.

[Source CI 43350101924](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43350101924) passed both jobs at head 9adedb305a364b00eb0e49564dc693058039e21e: 2,712 tests / 105 files, typecheck, 0 lint errors / 42 prior warnings, and preceding knowledge 6b45f7f offline/upstream. It checks a synthetic PR merge candidate. Imported-head CI is a separate later receipt.

Canonical draft tree 2afdbd7853f17d238f52d0b9907d66d5d0a83d3b received Standards 1 (source-kind classification, corrected) / Spec 0. This classification, whitespace and receipt delta is re-reviewed before publication; later publication/integration success is not inferred here.
