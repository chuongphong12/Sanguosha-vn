# Part 4ab.3: None/Discard and complete normalized retrial composition

The user approved the expanded retrial option on 2026-10-20. The published requirements are [specification #20](https://github.com/chuongphong12/Sanguosha-vn/issues/20). This design implements that choice using the existing public scheduler dispatch/resume seam, real physical movement and private resource authorities. Baseline game is `cc219dfd4a1df9290d5400fb558fc60a1ddedc96`. Native authority is `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`; owning contracts are in [None/Discard research](../research/2026-10-20-method-none-discard.md) and [retrial pipeline research](../research/2026-10-20-retrial-pipeline.md). This is an accepted implementation design, not a completion checkpoint.

## Problem and observable outcome

The existing direct request owner supports MethodUse and MethodResponse but rejects None/Discard/retrial. Consequently a selection-only caller cannot keep its card, a discard cost cannot request the native direct THROW movement, and a retrial skill cannot acquire a card without prematurely running ordinary response execution. Judge replacement, exchange and result timing also lack normalized composition.

Implement all three owners in order: acquisition and selection; shared judge replacement/result; representative Guicai/Guidao cost/effect. Keep ordinary MethodUse/Response behavior and their existing factory calls compatible. New operations remain private engine capabilities. Production registration does not change.

## Design

### 1. Acquisition and selection

Extend the existing shared acquisition implementation with explicit None/Discard factories and optional retrial request state. Selection rules require only their actual acquisition/metadata/notification dependencies; Discard additionally needs its discard destination. None does not require table, reveal, use or after-hook adapters. Existing Use/Response factories remain callable with their current policies.

None/Discard set unknown room reason, emit no CardAsked, retain validation/wrapped synchronization/ChoiceMade, and never run use/response/finish/reveal/after. None bypasses the limitation predicate by native policy and leaves materials alone. Discard moves current post-choice materials directly to discard with THROW(actor), no skill/general metadata or table intermediate, even when retrial/provision is true. Accepted notification context identifies method, retrial flag and request skill name so delivery can distinguish wrapper synchronization from method-specific logs. Ordinary notification packets retain their existing shape.

isRetrial suppresses CardAsked and normal Use/Response execution/notices while retaining wrapper synchronization, conversion, ChoiceMade and return. Retry preserves this flag and resets request skill/provision defaults. The one room-wide provision slot is shared by all factories. Catalogue, patterns, client authentication, human parse and AI normalization stay explicit admission adapters.

### 2. Shared judge and Room replacement

Introduce a private JSON judge ledger keyed by stable judge IDs. Event/operation data carries the ID, so cost/effect and nested serialized continuations retain shared identity. A judge contains the source-defined fields and explicit unknown/good/bad result cache. Result recomputation performs good == patternMatch(current who/card/pattern); negative only affects isEffected. A trusted matcher provides the unported expression grammar, not the cache/result algorithm.

The core replacement operation accepts responder, nullable incoming registered card, judge ID, skill name and exchange flag. Null card returns without replacement. For a real card, validate physical identity/location and canonical resource lookup; capture owner/hand, old judge and movement records; assign the canonical effective-ID card to the shared judge before notices/movement. Move only the first effective physical ID to judge, and old judge to responder hand (OVERRIDE with skill) or discard (JUDGEDONE without skill), as one real two-record atomic movement with force visibility true. New-card reason is RETRIAL with skill.

After movement, use the captured owner gate to optionally emit CardResponded with the incoming card, current who of the captured judge ID, captured hand flag, isUse=false/isRetrial=true and null data. The core never recomputes result. Child event rewrites/consumption do not replace captured identity, old card or trigger gate. Missing effective ID, invalid canonical physical identity, malformed judge or ambiguous physical location reject safely; native null dereferences/assertions are not reproduced.

### 3. Guicai/Guidao cost and effect

Provide real normalized cost/effect implementations composed with the existing TriggerSkill scheduler. Eligibility/ownership of enabled general skills remains a named package adapter; this is not automatic production registration. Guicai asks '..', Guidao '.|black', using MethodResponse with retrial=true. Prompt snapshots capture current judge who/reason/effective ID. After acquisition returns the validated card, package notices run, then effective-ID hand provenance is captured and all current materials move to table with RESPONSE(package skill), force visibility false. Package CardResponded has isRetrial=false, the captured judge object's current who and original event data.

After that event, serialize the current returned card through a private codec and push to the actor's per-skill LIFO stack. Cost returns true; null acquisition returns false with no stack entry. The existing scheduler then performs generic successful-cost skill reveal/Huashen through an explicit adapter before effect; this is distinct from ordinary card reveal suppressed during acquisition. Native TriggerSkill default priority is 3. Package table movement uses deterministic open=true with native force visibility false, normalizing public table notification visibility without claiming parity with the native uninitialized server event boolean. Effect pops/persists before parse; empty stack or parse-null returns false. It resolves the current event's judge ID, runs actual core replacement with exchange false for Guicai/true for Guidao, then recomputes that captured judge's result and returns false. The codec must preserve serialize-after-event, parse-at-effect and canonical current physical identity; it is not a frozen cost-phase clone or a complete native parser claim.

## Verification sequence

1. Selection/retrial acquisition: public behavioral red/green, old Use/Response regressions, flags/provider/retry and actual direct THROW movement metadata, then focused tests/typecheck.
2. Core replacement/result: public red/green with exchange/nonexchange, canonical versus virtual identity, effective-ID-only movement, provenance/recipient snapshot timing, cached result timing, nested/shared judge IDs, malformed inputs and real movement pause/restore; focused tests/typecheck.
3. Skill composition: actual AskForRetrial TriggerSkill cost/effect with request, notifications, movement, CardResponded, codec and stack cases; separate acquisition versus package versus core response counts; JSON pauses, event mutation/consumption, stale/wrong-actor/replayed/registry-mismatched replies and eager interruption state. Validate Guicai and Guidao end to end through this seam.
4. Full lint/typecheck/regression/build, refreshed GitNexus/CodeGraph and byte identity, separate Standards/Spec review and corrections, source commit and canonical knowledge publication/pin/clone-checkout verification.

## Boundaries

Outer StartJudge/AskForRetrial iteration/FinishRetrial/FinishJudge drawing and disposal remain a separate orchestration contract; this slice takes an existing shared judge and supports actual registered retrial skills on its AskForRetrial event. Additional Huanshi/Midao/Kongyun wrappers, generic expression grammar, live codec/catalogue/skill ownership/admission/notifications, production network/UI/bots, native exception unwind and complete-match/native differential certification remain outside this slice. Tests must label these adapters and must not describe this slice as all-package or playable-game parity.
