# Opt-in general-show question recovery

M1.3.5c.2k at game [d7b6cb0c3ba1a62a880aedbedccb6ec51cec8e89](https://github.com/chuongphong12/Sanguosha-vn/blob/d7b6cb0c3ba1a62a880aedbedccb6ec51cec8e89/src/game/hegemony/ask-general-show.ts), fixed base e147e4c4156835dfec25ad163e23d3e54f8445d7, follows [approved C2](../specs/hegemony-match-v3-save.md) and the user-approved C2k question/ChoiceMade scope. Native authority remains ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. See [phase bodies](phase-bodies.md), [RoundStart owner](round-start-save.md) and [checkpoint](../reviews/2026-11-19-hegemony-m135c2k-ask-general-show-save.md).

## Opt-in profile contract

GeneralShowRules.save requires both pure validateLord(target,operation) and validateNotice(notice,operation) contracts for mapped children. Function references are copied at construction. Decoder reads do not invoke canShow, lordAvailable, changeToLord or notify. Profiles must version this opt-in, enableLordConversion and trusted mapping semantics. Default profiles retain their original eight-field cursors and no hooks; there is no inferred old-save migration or production activation.

Base cursor fields are target/reason/change/stage/choices/choice/changeLord/lordChoice, bound to immutable request input. Six reachable native offer vectors are accepted in their original order, ending with literal cancel; raw null cancellation remains disallowed. A captured offer containing both-generals but no head-generals option proves that head was already shown initially, so changeLord must be false. Deputy-only/cancel can still legitimately retain changeLord=true when head eligibility was false but the original head unshown. Reads enforce that historical cross-field constraint without querying current shown state or eligibility.

| Persisted stage | Boundary |
| --- | --- |
| 1 | Primary prompt or accepted answer |
| 2 | Primary ChoiceMade child |
| 3 | Head show-general child |
| 4 | Deputy show-general child |
| 5 | Mapped reveal notification, with ninth notice field |
| 7 | Lord-conversion prompt or accepted answer |
| 8 | Lord ChoiceMade child |
| 9 | Mapped lord-conversion child |

No other stage persists. Prompts must match the saved target/offers and canCancel=false; accepted answers must be offered and match their stage. Nonprompt stages reject own prompts/answers. ChoiceMade children require the original event name/recipient while permitting payload rewrites or consumption; locally accepted decisions remain authoritative. Fixed show-general children bind target/head/triggerEvent=true/sendLog=false/ignoreRule=true with exactly five input keys. Mapped lord/notice children use the explicit pure contracts. Missing children are accepted only during actual abandonment; cleanup is unsupported. Retained owner results are booleans with valid immutable requests.

At stage5, a detached GeneralRevealNotice(kind/target/head/deputy) snapshot is captured before the live notify call and stored only if a child is returned. Notice validation uses these historical names, never current displayed names. A null notification completes without such a continuation. The existing live shown-state gates remain in place; no extra head check is added after the nested lord prompt. Unstarted saves do not run live preflight policies. Aggregate Room/configuration/history authenticity remains separate.

## Evidence and limits

[92 new cases](https://github.com/chuongphong12/Sanguosha-vn/blob/d7b6cb0c3ba1a62a880aedbedccb6ec51cec8e89/tests/hegemony/ask-general-show-save.test.ts) run the actual question and ChoiceMade scheduler, including actual shared GameRule → Proceeding → RoundStart → question composition. Budgets1/2/7/10000 and JSON/read/resume cover all eight stages, primary/lord decisions, six offer vectors, early already-shown return, captured eligibility, changed live shown gates, rewritten/consumed ChoiceMade, nested responder, wrong/unoffered/stale/null replies, notice snapshots, malformed saves and all three interruption reasons. Decoder reads leave serialized inputs and live callback counters unchanged.

Show-general, lord-conversion and notification child bodies/codecs are explicitly fixtures. Their eager identity/name changes and ack prompts exercise owner handoffs and actual scheduler unwind; they do not certify native child behavior, package/lord conversion, production presentation or public match admission routing. Actual child codecs must be supplied before a complete profile can be restored.

Baseline72/2; finalfocused164/3; full3168/116, typecheck/build pass; lint0 errors/42 prior warnings. Initial Spec finding on contradictory offer/lord eligibility was RED-confirmed and fixed; final source Standards0/Spec0 at 2e6ae78dbf3b48f75079c1e9ee70cff9f9664021. Spec independently ran164/164 related tests. Legacy JSON behavior is compared across primary paths plus positive lord conversion/notification, preserving eight-field format. Notification case4 extraction/capture intentionally changes its AST; preservation proofs exclude that case and rely on paired behavior tests there. The complete emitted scheduler is unchanged.

Actual show/lord/notification codecs, Judge/remaining phase/startup/battle owners, aggregate Room/configuration/root decoding, public match v3 and full-match/release gates remain open. Keep one shared Proceeding bridge. Group1 remains in progress; PR33 stays draft, with no main merge/cutover.
