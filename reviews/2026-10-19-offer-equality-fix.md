# Offer equality repair

Game source/test commit: `2267afb2d01d4ae9252bed7694c0dbf1534a8625`, reviewed against `18957a5b592dabf4e27e6d2e886134b69bd1148d` on 2026-10-19. User approved repair option B in the [28-flow diagnosis](../research/2026-10-19-critical-flow-diagnosis.md). Native authority remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`; this fix concerns the web admission JSON binding policy, not an additional native rule.

## Behavior and boundaries

`currentOffer` previously rejected an unchanged offer when a private provider constructed object keys in another insertion order. The private `offerSignature` helper now recursively serializes object members in deterministic code-unit key order. Arrays retain order and every JSON field remains in the binding. No ID/version-only shortcut, public API, package authority, shared descriptor reader or scheduler change was introduced.

The tests use the existing real dispatch → actor-only view → opaque-token submit → Room operation seam. Authentication, catalogues, legality, metadata and notification adapters retain their documented fixture status; movement, scheduler, Room/onUse, history and token-cost operations retain their existing real implementations. No live package, production login/transport, native runtime differential or complete-match E2E claim follows. See the [current contract](../engine/room-use-and-admission.md).

## Executed validation

- Baseline: 49 tests across `card-command`, `card-command-token` and `room-use-card` passed before edits.
- Red: a permanent public-submission test failed with expected `true`, received `false`, when nested object order changed across JSON restoration. It ran against the unchanged engine, not a mocked comparator.
- Green: the same test passed after the 13-line source diff. Two positive scenarios cover root/entry/card reordering before a reply and during ChoiceMade, restoring game/scheduler JSON before both replies. Completion is used, the real material reaches discard and history increments once.
- Twenty-eight negative cases cover selection and confirmation with changed ID, version, label, resource, target policy, card name/class/type/skill, material value/order, flag value/order and additional null metadata. They preserve game/scheduler state, hand materials and history on rejection. Existing actor/phase/epoch/permissions/prohibition/back/cancel and real token-cost regressions also pass.
- Final focused run: 79 tests / three files, exit 0. Original temporary diagnostic probe also became green without its canonicalizing provider workaround. Its separate forged-order guard assertions still pass.
- Final `npm run check`: exit 0, 75 files / 1,783 tests, typecheck passed, 42 inherited lint warnings and zero errors. An earlier check caught two optional-property accesses in the new fixture; fixture non-null assertions corrected them before final checks and re-review.
- Final `npm run build`: exit 0. `git diff --check` and staged whitespace check passed. Source and test bytes remained identical through graph checks and commit.

## Independent reviews

Standards reviewer: zero documented violations or actionable Fowler smells. Spec reviewer: zero missing/incorrect requirements or scope creep. Both rechecked after the two fixture type corrections and confirmed the exact source/test SHA256 values below. The positive scenarios distinguish shallow-only sorting; negative scenarios distinguish an ID/version-only shortcut. Full validation above was executed by the main agent, not inferred from reviewer approval.

| File | Reviewed/tested SHA256 |
| --- | --- |
| `src/game/hegemony/card-command.ts` | `8599c55c004b040e90d74712fa82f335ce753eadced408d4a58e0ccfae03421b` |
| `tests/hegemony/card-command.test.ts` | `a93be4580f0d689bf9daabc6b01ec3a9bb0df814337ceb273de4bdb1b1b146b4` |

## Graph evidence

Before source editing, exact-worktree GitNexus impact of `currentOffer` was LOW: two direct callers, `submit` and `run`, in one Hegemony module. The source edit stays at that boundary.

Final forced GitNexus 1.6.12 index: 288 files / 8,750 nodes / 22,606 edges / 220 clusters / 531 processes. Both indexed SHA256 values match the table and independent CodeGraph file hashes. Source and helper impact remain LOW; helper has one direct caller. Delta `detect_changes(scope=all)` before the source commit: eight indexed symbols / two files / ten affected processes / HIGH, with no partial/truncated response flags. This warning was explicitly retained before committing.

Those ten selected traces are Run → Check, Run → MaterialAllowed, Run → Offers, Run → OfferSignature, Submit → MaterialAllowed, Submit → Offers, Run → IsRecord, Submit → IsRecord, Run → ReadExecutionCardUse and Submit → ReadExecutionCardUse. They share current-offer binding and unchanged eligibility/resource guards, covered through the public regression seam. This is targeted evidence, not exhaustive path certification.

The full comparison from Part 4aa base `21d693e4c9c046b30085fc11a6a434d4d8bb3e31` now reports 516 indexed symbols / 21 files / 29 processes / CRITICAL. The new selected trace ends at OfferSignature; process enumeration IDs can shift. The earlier 28-path ledger remains historical. Do not interpret the aggregate classification as 29 diagnosed bugs or suppress it after this repair.

Graph extraction still omits 347 entry candidates and 1,210 callees, cuts 19 walks, leaves 13 cross-language property sites unlinked and skips one oversized font. Nonpartial query results do not certify graph completeness. CodeGraph 1.6.0 is complete for its extraction model: 255 files / 3,113 nodes / 15,765 edges, zero pending changes/refs, no worktree mismatch or reindex recommendation. Its affected-tests query identifies the two command suites; the Room suite was additionally exercised.

Local execution receipts: Temp `tqs-offer-fix-check-final.log`, `tqs-offer-fix-build-final.log`, `tqs-offer-fix-graphs.json`, `tqs-offer-fix-probe.json`; permanent regressions and recorded hashes above are the durable evidence. The diagnostic script's old literal scope label refers to writes by that script; its follow-up run explicitly consumed the modified engine.

## Delivery

The source/test fix is committed locally. Canonical knowledge and its game snapshot must accompany publication; their exact documentation SHA/tree is recorded by the game lock. Source commit publication, game PR/main merge and deployment are not asserted by this checkpoint. Production still registers Standard2013, and the remaining release gates in the current roadmap are unchanged.
