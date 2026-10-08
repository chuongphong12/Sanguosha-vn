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

## Part 4a — operation frames and physical movement kernel

Fixed baseline: 2f94f2a. Review covers the separate operation frame/handler path, hand/draw/discard/table movement kernel, public dispatch/resume tests and scoped documentation. Both independent reviewers rechecked the fixes.

### Standards

Two findings resolved: the nested movement fixture initially defined a callback that it then overwrote; it now constructs the real guarded callback directly. Shared canDispatch and invokeWithValidData centralize dispatch admission and payload snapshot/validation/restoration while preserving distinct typed contexts. Source hints are checked against each original card index before no-op filtering. No remaining actionable Standards findings.

### Spec

One P2 finding resolved: a nested Before movement could make the outer packet silently derive a new source, unlike the documented stale-source invariant. Canonical from hints are now validated after both Before and Confirm children. Regressions preserve the committed child transfer and prevent another outer debit, including mixed-source no-op filtering. Explicit Before replacement packets without hints can deliberately derive current sources. The reviewer independently passed 66 focused movement/operation/scheduler cases. No remaining actionable Spec findings or misleading full-engine parity claim.

Summary: Standards 2 findings resolved, 0 outstanding; Spec 1 finding resolved, 0 outstanding. Native packet classification/metadata, additional zones, package modifiers, wrapped-card filters, transport visibility, cleanup/error recovery and production integration remain deferred.

## Part 4b — movement metadata and additional physical zones

Fixed baseline: 212bd83. Two independent reviewers checked the staged metadata/zone diff against repository standards and pinned ce4e62b native movement code, then rechecked the fixes.

### Standards

One low-priority possible Duplicated Code finding was resolved. `CardZone.place` and the runtime allowed-place list initially repeated the same literals; the allowed-place tuple now defines the type. The reviewer found no hard standards violations or further actionable smells after the fix.

### Spec

One P2 native-conformance finding was resolved. The first version preserved the initial `originTo` when a BeforeCardsMove hook redirected `to`. Native `_separateMoves` derives origin fields again from the rewritten packet before Confirm; the code and public regression now do the same. The reviewer independently passed all 71 focused tests and found no other actionable scoped issues.

Summary: Standards 1 judgment finding resolved, 0 outstanding; Spec 1 P2 finding resolved, 0 outstanding. This review covers physical metadata/zones, not equipment effects, package move rewrites, card visibility projection or a playable Hegemony runtime.

## Part 4c — movement packet classification

Fixed baseline: 35915de. The two independent review attempts could not run because the agent service returned a usage-limit error. This checkpoint therefore has a manual two-axis review only; independent review remains a gate before proceeding to Part 4d.

### Standards — manual review

The staged diff stays inside the unregistered movement module, its public-dispatch tests and checkpoint notes. It preserves data-only continuations and tests externally observable event packets, physical storage and JSON reload. `oneCardMove`/`appendCard` share per-card array handling rather than duplicating it across classifiers. `reasonKey` structurally compares JSON objects independent of field insertion order. No actionable standards issue was found in manual review; this does not substitute for the required independent review.

### Spec — manual review

The initial owner/destination merge, Before rewrite separation, owner-wide hand depletion, second merge and current-first sort were checked against pinned `room.h:514–617` and `room.cpp:192–216, 4597, 5000–5142, 5163–5205, 5492–5524`. A red/green regression caught reordered but structurally equal reason objects changing the last-hand packet; canonical JSON comparison fixes it. Tests also cover source place/pile and visibility alignment, draw-top/bottom distinction, ownerless order and reload. The documented deterministic zone-key adapter intentionally does not emulate native pointer/QMap tie ordering or package card rewrites.

Summary: manual Standards 0 outstanding findings; manual Spec 1 issue resolved, 0 outstanding. Independent Standards/Spec review is pending because both reviewer attempts hit the service usage limit.
