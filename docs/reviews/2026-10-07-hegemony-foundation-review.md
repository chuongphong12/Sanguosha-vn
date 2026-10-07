# Hegemony foundation checkpoint reviews

Two independent review agents assessed standards and spec against fixed baselines. These are static/source-based reviews, supplemented with the executed checks in the implementation ledger. They do not establish complete native parity or production Hegemony E2E coverage.

## Part 1 — paired setup

Fixed baseline: main 936d9656f1875a51af8cc6d4ccaa9504a1487a9a. Completed commit: fb7eb45.

### Standards

No actionable standards findings. The create/select/project boundary stays focused on paired setup. Selection validates before mutation; projection constructs independent, explicitly redacted data. Tests exercise the approved public seams with independent expected values and do not call private helpers. The documentation distinguishes ready setup from a playable match.

### Spec

No actionable spec findings. Distinct offered pairs, directional careerist/dual-kingdom compatibility, symmetric bans, physical-general uniqueness, slot-adjusted HP, hidden IDs/candidates, copy isolation and JSON reload satisfy the scoped requirements. Native compatibility and HP calculations match the pinned source. Gameplay, reveal handling, production dealing and legacy retirement are deferred milestones.

Summary: Standards 0 findings; Spec 0 findings. No outstanding issue in either axis.

## Part 2 — identity domain

Fixed baseline: fb7eb45. Review covers the staged identity module, model/projection changes and identity tests; the final shared guard was reviewed separately before committing.

### Standards

No hard documented-standard violations or privacy/copy defects. One low-priority possible Duplicated Code finding identified the repeated readiness/membership/slot guard in reveal and conceal. It was fixed by the typed isReadyIdentitySlot helper, preserving the distinct shown-state checks. The reviewer confirmed no remaining actionable findings. Public tests and persisted recruitment fixtures stay within the approved seams; differing native lord scans remain separate intentionally.

### Spec

No actionable spec findings. Slot-specific reveal/conceal, original-seat majority, living/dead lord exceptions, careerist groups, asymmetric forecasts and native hide/re-reveal behavior match the scoped source contracts. Owner-only initial kingdom supports reconnect without spectator leakage. Invalid/repeated transitions are atomic; projection copies data. Both focused suites passed independently: 36 tests. Scheduler dispatch, reveal restrictions, preshow/marks, burial conversion, recruitment operations and UI migration are deferred.

Summary: Standards 1 low-priority judgment finding resolved, 0 outstanding; Spec 0 findings, 0 outstanding. No outstanding issue in either axis.

## Part 3 — trigger scheduler

Fixed baseline: 5333bdc. Review covers the staged standalone scheduler and its public dispatch/resume/projection tests. Both reviewers rechecked the fixes independently.

### Standards

No outstanding actionable findings. Shared advanceActor removes duplicated progression. Recursive validation protects event inputs and yielded continuations; invokeTriggerHandler checks supported event rewrites before persistence and restores previous payload data on programming error. The final rewrite regressions cover record and effect hooks. The distinct Wake marker shares the existing visibility policy while automatic global selection stays limited to Compulsory. No remaining actionable Fowler smells were found.

### Spec

No outstanding actionable findings. Initial reconciliation and order resume preserve offered identities, remove invalidated occurrences and allow cancellation according to the valid offered list; full post-attempt refresh discovers newly eligible occurrences without re-recording. Native record ordering, nested continuation, priority, occurrence identity and event consumption are exercised at the approved public seam. Both reviewers' reload/order findings were fixed with regressions. The spec reviewer independently passed all 36 focused tests. Operation-specific unwind, package adapters and gameplay integration remain deferred.

Summary: Standards 0 outstanding findings; Spec 0 outstanding findings. This is approval of the scoped scheduler checkpoint, not complete native/gameplay parity.
