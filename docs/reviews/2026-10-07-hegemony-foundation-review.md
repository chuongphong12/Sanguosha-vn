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

Fixed baseline: 35915de. The first two reviewer attempts hit a service usage limit; both independent reviews later completed against commit d7263b4 and rechecked the final refactor. Validation uses the public dispatch/resume seam.

### Standards

The independent reviewer found no hard violations and two low-priority possible Duplicated Code findings: the per-card `Map` grouping loop in `separateMoves`/`mergeMoves`, and current-first seat rotation in `livingActors`/`mergeMoves`. Shared `groupCards` and `actionOrder` remove the repeated mechanisms while leaving classifier keys and alive filtering explicit. The reviewer rechecked both fixes and found no remaining actionable Standards issue. A new type-only fixture parameter also caused one lint warning; it was removed without changing test behavior.

### Spec

The independent reviewer found zero actionable native/spec findings against pinned `room.h:514–617` and `room.cpp:192–216, 4597, 5000–5142, 5163–5205, 5492–5524`; 79 focused tests passed independently. A manual red/green regression had already caught reordered but structurally equal reason objects changing the last-hand packet; canonical JSON comparison fixed it. The reviewer confirmed the Standards refactor preserves classifier keys, card traversal, action order and alive filtering. Deterministic zone-key tie behavior and deferred package rewrites remain documented scope limits.

Summary: Standards 2 judgment findings resolved, 0 outstanding; Spec 0 independent findings, 0 outstanding. The manual reason-comparison issue was resolved before independent review.

## Part 4d — scenario-card discard rewrite

Fixed baseline: 08fa34a. Independent Standards and Spec reviewers inspected the uncommitted four-class rewrite through the public movement dispatch seam against pinned `room.cpp:5163–5205, 5317–5489, 5492–5515`.

### Standards

No actionable finding. Injected card-class metadata is confined to the external operation configuration; the movement helper is local and single-purpose. Existing callers without scenario metadata retain their operation registration.

### Spec

One native-conformance defect resolved: rerouting a card already in WuGu back to WuGu left a same-place packet. The first public-dispatch regression failed with `Stale card movement`; the reviewer's adjacent distinct-key WuGu case also failed by committing a move that native breakdown omits. The final guard compares physical place, and both regressions confirm an empty Confirm packet and unchanged physical storage. The reviewer found no other issue in the scoped four-class branch. A scenario-specific prompt/reload case would add coverage, although the generic classified movement path already tests JSON resume.

Summary: Standards 0 findings; Spec 1 finding resolved, 0 outstanding. Other `cheakMoveData` branches, wrapped-card hooks and production/catalog integration were outside this review.

Correction from Part 4e: the Part 4d review above omitted native `changeMoveData`'s replacement-admission order. Empty generated WuGu packets do not remove original IDs. The earlier assertion of an empty Confirm packet and unchanged storage was incorrect; both regressions now expect the original discard movement to complete.

## Part 4e — SixDragons movement rewrites

Fixed baseline: fb27896651cfb510570a1e8b890e5195f48e9ea5. Independent reviewers inspected the external Horse/slot configuration, post-Before snapshot rewrites, normalized replacement reasons and public dispatch/resume regressions against the approved scoped plan and pinned ce4e62b native source.

### Standards

Zero actionable findings on the initial diff and final recheck. Replacement ownership is recorded only after generated packets survive normalization, preserving residual originals when generated replacements are no-ops. Configuration stays outside serializable game/continuation state; no unrelated production registration or equipment lifecycle changes were introduced.

### Spec

One finding resolved across two branches: generated discard-to-discard and WuGu-to-WuGu no-ops had removed the original movement despite native `changeMoveData` retaining it. Four red/green regressions cover identical and distinct shared-zone keys. The reviewer rechecked both fixes and independently passed 57 movement tests across five files, with zero remaining scoped findings. Combined scenario/SixDragons configuration coverage was suggested as an optional addition, without a demonstrated composition defect.

Summary: Standards 0 findings; Spec 1 finding resolved, 0 outstanding. The review covers physical movement rewrites; Horse card-use availability, equipment lifecycle, other package branches and production integration remain deferred.

## Part 4f — ImperialEdict physical pile routing

Fixed baseline: 1e1261316726914af6914b3ddc1316a631b2e50b. Independent Standards and Spec reviewers checked the uncommitted diff and public dispatch/resume regressions against the approved design, Part 4f ledger scope and pinned ce4e62b native movement/pile code. Nineteen new cases now include the subsequent deceased-recipient correction. There are no issue references or new commits in this checkpoint; the approved repository spec is the review authority. The optional issue-tracker configuration document is absent (`/setup-matt-pocock-skills` configures that workflow); it is not needed to fetch the already-local spec.

### Standards

Zero hard violations and zero actionable smell findings, including the final deceased-recipient recheck. The helper reuses replacement admission, normalization and commit safeguards. Three independently optional external package configurations extend the existing factory without speculative API restructuring. The optional Horse filter and normalized equip-owner invariant justify the narrowed non-null assertions. Tests stay at the approved dispatch/resume seam and no production adapter/content is enabled.

### Spec

One P2 finding resolved after the initial zero-finding review: supplemental source inspection traced `findPlayerbyobjectName` and discovered its default exclusion of deceased recipients (`room.h:336`, `room.cpp:2604–2612, 5451–5452`). The Spec reviewer independently confirmed the issue and acknowledged the missed lookup indirection. Two red/green cases cover already-dead and Before-deceased recipients; a third mixed case preserves SixDragons behavior. The reviewer rechecked the branch-specific guard and independently passed all 36 package rewrite cases, with zero outstanding findings. Native generated same-owner/same-special-place no-ops and UNKNOWN reason were also checked; normalized `null` and documented deterministic `open: false` remain valid for this scoped adapter. Eager logical pile bookkeeping, direct card use, attach/trick skills and client visibility are deferred; these tests do not establish full ImperialEdict gameplay parity.

Summary: Standards 0 findings; Spec 1 P2 finding resolved, 0 outstanding. Full checkpoint validation and graph limits are recorded separately in the knowledge note.

## Part 4g — ImperialOrder discard diversion and pending room tags

Fixed baseline: 333782e2a5a12d81223808ea19eb853d4fe1fee9. Independent reviewers inspected the uncommitted movement/docs diff and the explicitly read new ImperialOrder test file against the approved design, Part 4g ledger and pinned ce4e62b source. The existing local spec supplies review authority; optional issue-tracker setup remains unnecessary for this checkpoint.

### Standards

Zero hard violations and zero actionable heuristic smells. The existing discard rewrite is extended surgically, JSON object guards fit the trigger-data contract, and the narrowed configuration assertion follows the matching-card guard. A fourth optional external package configuration follows the existing movement factory without speculative API restructuring. Tests use the approved dispatch/resume seam with real scheduler handlers and literal source-derived expectations. No private-helper tests, internal mocks or unrelated production registration. GitNexus's initial inability to resolve the renamed helper is explicitly a refresh limitation, not evidence that it is unused; final graph checks are recorded in the knowledge note.

### Spec

Zero findings. Native `room.cpp:5400–5405` requires both exact USE reason and ancestry of the used card, permitting virtual cards. Eager tag writes (`:5409–5410`) precede generated breakdown and Confirm; the last eligible scanned ID overwrites earlier IDs. WuGu generated no-ops retain original discards and pending tags (`:5326–5346, 5509–5512`). Public tests cover final Before payloads/consumption, preserved tags, mixed package ordering, normalized metadata, JSON resume and stale nested parents. The reviewer independently passed 3 suites / 54 tests (30 ImperialOrder, 19 ImperialEdict, 5 scenario). NotActive invocation/reset, ImperialEdict introduction and direct use/choice effects are correctly deferred. Visibility remains normalized, without a native wire-parity claim for uninitialized `open`.

Summary: Standards 0 findings; Spec 0 findings. Full validation and remaining graph limits are recorded in the knowledge note; this review establishes scoped routing/tag conformance rather than complete ImperialOrder gameplay.

## Part 4h — normalized wrapped-card lifecycle

Fixed baseline: 535cd19df0085481b33f6d6a71290ce7e61af94f. Independent Standards and Spec reviewers inspected the uncommitted diff and new wrapped-card tests against the approved scoped plan and pinned ce4e62b source. The existing local spec supplies review authority. Pure eligible package filters and authoritative metadata remain external/unregistered foundation contracts.

### Standards

Zero documented hard violations and zero actionable Fowler smell findings, including the final packet-boundary recheck. Synchronous metadata preparation uses an isolated inventory snapshot and stages storage until successful physical/wrapped commit. The fifth optional registry configuration extends the existing factory without speculative restructuring. Retained data-only lifecycle packets address a concrete correctness requirement; extracting the existing comparator into `sortMoves` avoids duplication. Delayed restoration at get and add represents distinct native lifecycle moments. Public dispatch/resume tests contain no private-helper tests or internal mocks.

### Spec

One finding resolved after the initial zero-finding review: the root's supplemental source audit found that reconstructing physical packets from merged OneTime notifications lost distinct reason/last-handcard boundaries and reset cards together that native refilters separately. Two direct/JSON Confirm resume regressions failed red, then passed when the continuation retained native-ordered separated `cardPackets`. A source-order rewrite guard also passes. The Spec reviewer independently confirmed the native distinction (`room.cpp:5078–5143, 5242–5251`), acknowledged the initially missed grouping detail and reran all 36 wrapped tests, with zero remaining scoped findings. Full ViewHas/TriggerSkill eligibility, wrapped pointers/subcards, client reset/update visibility, equipment hooks, dynamic ancestry adapters and enabled gameplay remain deferred.

Summary: Standards 0 findings; Spec 1 finding resolved, 0 outstanding. Full checkpoint validation and graph limits are recorded in the knowledge note; this is source-derived normalized lifecycle conformance, not native differential or production E2E parity.

## Part 4i — normalized non-Skill onUse lifecycle

Fixed baseline: 0569a49eb93addc92710a2555a702cd4a443cd27. Independent reviewers inspected the uncommitted docs diff and explicitly read both new untracked onUse source/test files against the Part 4i plan and pinned ce4e62b source. The approved local spec supplies review authority; optional issue-tracker setup is not required for this checkpoint.

### Standards

Zero documented hard violations and zero actionable Fowler smell findings. The original, post-Pre and latest event snapshots serve distinct contracts, and cursor stages follow the existing movement operation convention. The narrowed post-Pre assertion follows a stage invariant. Outer material-location checks serve pure preflight before frame allocation; moving them into private movement helpers would broaden this slice without a demonstrated need. The operation composes existing child operations, and tests observe public dispatch/resume, payloads and inventory without mocks/private-helper assertions. The reviewer independently passed the then-current 42 focused tests. A supplemental current-actor sorting case adds coverage without changing the reviewed implementation.

### Spec

Zero findings. Native `card.cpp:746–895`, the void `moveCardsAtomic` wrapper (`room.cpp:5144–5154`) and current-place table lookup (`:6620–6644`) support the ordering, independent snapshots, original-source targeting, reason provenance, consumption/cancellation and remaining-original-material cleanup. Nested operations and JSON resume preserve continuation boundaries; the reviewer independently passed the then-current 42 cases. Source/card identity mutation, GameRule target/effect and flag/tag cleanup, SkillCard/package hooks and interruption unwind are explicit deferred requirements rather than implemented gameplay. No production registration or scope creep was found.

The reviewer also confirmed the supplemental 43rd case distinguishes sorting from the room's current player rather than the card source: `sortByActionOrder`/`CompareByActionOrder`/`getFront`/`getAllPlayers(true)` rotate seats from current (`room.cpp:192–215, 4597–4604, 8260–8264`; `serverplayer.cpp:1684–1688`). No implementation changed and no new finding was raised.

Summary: Standards 0 findings; Spec 0 findings. Full checkpoint validation and graph limits are recorded in knowledge; this is the common normalized event/material lifecycle, not complete card-use or native runtime differential parity.
