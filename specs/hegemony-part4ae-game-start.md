# Part 4ae — global GameStart and initial dealing

Issue: [specification #24](https://github.com/chuongphong12/Sanguosha-vn/issues/24).

Status: approved expanded B, 2026-10-22: global GameStart plus actual luck-card state/transfer owner. The broadcast collection and private notification adapters remain explicitly outside the implemented transport authority.

Game baseline: `72185df4b4408b790b2d60a0cc6e8a42dc2d12e9`.
Native authority: `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, QSanguosha 2.3.43-beta2.
Continue from [actual player drawing](../engine/card-drawing.md) and [Draw phase](../engine/draw-phase.md).

Primary-source details and hash/graph evidence: [GameStart and luck-card investigation](../research/2026-10-22-game-start.md).

## Problem and intended boundary

The normalized engine can acquire and draw cards and execute the Draw-phase body, but has no global GameStart owner. A GameStart event is not interchangeable with the normal Draw phase. Paired setup `ready` is still not a playable battle.

The next slice supplies the global GameRule body and actual initial drawing. It does not claim to port the entire Room/RoomThread startup, dynamically construct every package's trigger table, or synchronize paired setup into all private battle authorities.

## Two implementation approaches

**A — considered, then extended by the approved B: global GameStart, actual initial draw, explicit luck-card boundary.** Implement the native global body's branches and order, actual authoritative limited-mark writes, room FirstRound and actual draw-cards. Catalogue/configuration, private view and notification delivery remain named trusted adapters. Validate this layer before its concrete luck-card consumer.

**B — approved: A plus the actual luck-card state owner.** Also implement eligibility capture, bounded repeat rounds, all returns before shuffle, persisted portable RNG, ordered redealing and native wrapper/location changes. The broadcast request round and private notification transport remain explicit adapters. Tests must not substitute a sequence of ordinary actor prompts for native simultaneous broadcast and common timeout. B is larger because native luck cards bypass ordinary atomic movement and have their own privacy/metadata policy.

Both reuse the already approved public dispatch/resume seam, validate dependent layers before advancing, and retain full tests/build and separate Standards/Spec reviews. Selecting B does not imply that production broadcast/timeout authorities are implemented.

## Global owner contract — included in A and B

1. Add a separate GameStart GameRule bridge. Preserve SkipGameRule consumption before target dispatch. The global null-target branch must run; per-player GameStart remains a distinct branch and does not deal again. Keep the existing nonnull-target GameRule helper unchanged.
2. Preserve native order: optional start lightbox (3500); conditional private next-alive deputy view; startup delay (3000); initialize eligible limited-skill marks; set room FirstRound=true; normal-mode initial draw; optional luck-card child when the configured limitation is positive (default zero).
3. Require initialized current-general authority, matching the native assertion, and enumerate the player's current visible skill list through a trusted skill authority, including frequency, limit-mark names and lord-skill eligibility. Do not narrow this to only the head general's printed skills or silently skip malformed missing-general state. The owner applies the native gates, sends the owner-only initial mark notice, then commits each eligible mark to 1. Preserve repeated qualifying entries without invented deduplication. Do not delegate the entire marking algorithm to a callback or infer lord eligibility solely from a public role string.
4. Private deputy viewing must use actual private identity authority and the native recipient/next-alive traversal, not the setup projection or unrestricted reveal commands. Drop the next alive player's first tagged general name and privately log/view the remaining list to the viewer. A view notice does not publicly show that general. Notification and delay children may suspend; their payloads stay inside trusted private operation state.
5. Capture the native registration order when the initial draw call is reached, not the current-player-first/alive-filtered order of the existing allPlayers helper. Delegate to actual draw-cards with count 4 and empty reason. Its existing recipient/capacity/recycle/movement gates remain authoritative.
6. custom_scenario skips the native conditional deputy-view and draw-four branches; it does not automatically skip lightbox, delay, limited marks, room FirstRound or optional luck cards.
7. Emit neither DrawNCards nor AfterDrawNCards and add no free-chain child. Do not replace this owner with the 4ad Draw-phase operation.
8. A fresh repeated GameStart follows native behavior again; do not invent an idempotency guard. Resuming one suspended event must not repeat a committed mark, delay, draw or luck call. Interruptions preserve earlier eager state and freeze frames under the existing scheduler contract.

## Additional luck-card owner — B only

1. Run the native pause boundary once, then capture eligible non-AI players using an explicit trusted native-equivalent AI authority. Preserve the native initial list and its order; do not invent later alive/AI eligibility rechecks.
2. For each configured round, request all remaining participants as one broadcast round. The trusted transport adapter supplies per-player ready/payload outcomes; the actual owner keeps only ready=true with a strict boolean true payload. Missing/not-ready/false/malformed responses permanently eliminate that participant. Only successful affirmative responders remain eligible for another round. Do not expose another player's response or hand through public prompts. Zero/negative limits and an empty participant list do not run request rounds.
3. Publicly log every accepted invocation before returning any hands; private request payloads and hand identities remain private. Snapshot each accepting player's current hand count at its native return boundary. Return all such hands before one shuffle; preserve prepend order, including reversal within each returned chunk. Do not collapse the sequence into per-player return-and-immediate-redraw. Empty hands do not automatically suppress the remaining round lifecycle.
4. Keep native manual card-location/wrapper policy. Return reason is PUT with player actor and luck_card skill; redeal uses the native default UNKNOWN/empty reason, not DRAW. Do not manufacture BeforeCardsMove/CardsMoveOneTime or ordinary atomic-arrival visible clearing.
5. Reuse actual get-n-cards with its count notice disabled for ordered redealing, completing each player's manual hand transfer before acquiring the next batch. Existing Fetch/capacity/recycle/terminal behavior remains real. Preserve native per-owner return versus observer-filtered redeal notification visibility; broadcast the latest pile count after all redeals in that round.
6. Reuse the persisted portable RNG policy, with literal source-derived shuffle vectors; exact Qt/qrand stream parity remains excluded. Do not confuse startup's AVAILABLE_CARDS shuffle of a copy with a shuffle of the actual draw pile.
7. Persist rounds, participants, decisions, counts, card IDs and mutation stage as JSON. Reject stale/wrong/replayed replies at the established public boundary; preserve already committed returns or redeals after a later interruption.

## Test and evidence plan

Tests run through real scheduler events and registered operations. Actual draw, Fetch, reservations, swap/RNG, movement and terminal handlers are required; catalogue/configuration/private delivery and (for B) the broadcast collection adapter are explicitly labelled fixtures.

- Global null-target dispatch, nonnull-target no-deal, SkipGameRule once, event consumption, real player registration order and empty reason.
- Optional lightbox/deputy-view gates and recipient privacy; exact delay/mark/tag/deal/luck ordering.
- Limited/nonlimited/empty-mark/lord-skill cases, pre-existing mark reset, dead/removed recipients under their actual native owner gates.
- Normal/custom_scenario/luck enabled and disabled combinations; initial deal emits no DrawNCards/AfterDrawNCards/free-chain.
- Immediate/late shortage, real recycling, retained eager state, nested event effects, JSON pauses at every external child and no duplicate resume effects.
- A: enabled luck branch dispatches the named child at the correct boundary; no claim that a fixture child implements redealing.
- B: initial eligibility, all-send request-round contract, decline/invalid/timeout elimination, repeat limit, all returns then one shuffle, exact card order/reason/location/visible/filter policy, private notifications and ordered redeal through real acquisition.

For each layer: failing public behavior test first, minimal implementation, focused suite/typecheck and current knowledge. Then full check/build, index rebuild/hash/identity/affected-flow validation, independent Standards and Spec reviews, source commit, reviewed canonical knowledge publication, subtree pin, offline/upstream verification and clone/old-checkout/return validation.

## Existing dependencies and impact

Both indexes match the inspected draw/scheduler/shared-reader bytes at this baseline. GitNexus index was refreshed to the exact worktree HEAD. New draw/getNCards factories have LOW indexed impact. Existing room-tag reader is CRITICAL (17 direct / 8 selected processes), ruleInput CRITICAL (17/9) and allPlayers HIGH (8/4); these shared implementations are not proposed for modification. The new bridge handles the global target directly, and initial dealing uses raw registration order instead of allPlayers. Dynamic operation dispatch and graph extraction limits require runtime composition tests; a zero selected-process count is not evidence that an operation is unused.

## Explicit exclusions

Full Room/RoomThread startup; dynamic trigger-table/package discovery and per-player startup skill execution; whole setup-to-battle authority synchronization; actual network broadcast/deadline machinery; remaining phase/turn owners; complete catalogue/content; full native notification transport; native exception unwind; production registration/UI/bots; exact Qt RNG and full-match/native differential certification.

The approved lifecycle preserves the existing public test seam. After the scope decision, synthesize the accepted specification/ticket and execute it using that route; the writing-plans skill is not installed in this repository.
