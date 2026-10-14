# Part 4s review

Fixed baseline: `70b8918604bbdc004a6a1398f663ddc942e98a5d`. Two independent read-only reviewers examined the death/burial/reward/victory modules against the approved Part 4s plan and native source pinned at `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.

## Standards

Initial review: zero documented violations or actionable Fowler smells. The repeated reveal condition occurs in distinct native snapshot/continuation loops; extracting their orchestration would add complexity. Independent 87/87 focused cases, typecheck and whitespace checks pass. The diff preserves the approved serialized operation seam, independent literal expectations, surgical scope and explicit private adapter gates. Final re-review of the supplemental case and knowledge reports zero findings; independent 88/88 focused cases pass.

## Spec

Initial review: one P2 coverage gap, no implementation defect or scope creep. The planned success/failure rescue coverage had only failed rescue registered with the actual kill operation. Previous 4r success cases used the deferred kill fixture. A new public damage → successful SinglePeach → recovery case retains the actual death registry and asserts positive HP/alive, no death/burial/reward, preserved acquired skills/history/living seats/physical resources and completed dying/damage cleanup. It uses a virtual zero-material fixture response and an explicit package use adapter composed with actual Room recovery; it does not duplicate or claim the native card package's use implementation. Focused suite is now 88/88, with typecheck pass.

Other inspected semantics match the scoped source: original/shared snapshots, separate living seats, acquired-only detachment, Analeptic history, null-current/dead-except reward counting, hidden role notification, lord conversion, winner traversal and dead-lord weighting, terminal interruption before Death. Final Spec and documentation re-review: zero unresolved findings; one coverage P2 resolved. Independent 88/88 focused cases pass.

Parent regression validation also corrected supplied null kill-count handling (only missing defaults to zero). Its public failing regression now passes. An initial resource fixture expected packet order instead of native per-card discard prepend; the independent literal was corrected to `[5,4,3,2,1]`. Null-target rule tests initially omitted the required dispatch actor; they now assert successful dispatch with a known actor. Scheduler and shared readers remain unchanged.

Recruitment/doCareeristRule, concrete throw/discard/draw wrappers, pile/catalog/limitation state, general/relationship adapters, native pointer identity, transport, exception unwind and production integration remain explicit gates. This checkpoint does not establish native differential or production Hegemony E2E parity. Full validation and graph limitations are recorded in the Part 4s knowledge checkpoint.

Final full validation: 65 files / 1,212 tests, lint/typecheck and production build pass; 42 inherited warnings, zero errors. Both graphs are current; all five source/test hashes match validated bytes. An incremental graph with blank IDs was rejected and repaired by a forced rebuild. All 24 valid affected flow IDs / 95 ordered steps were inspected. CRITICAL staged risk, UNKNOWN factories, ambiguous property coverage, lower-bound interface consumers, property-dispatch misattribution and global omissions remain recorded in knowledge.
