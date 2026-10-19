# Room use and authoritative card requests

Part 4aa implements the normalized normal path of `Room::useCard` and a separate authoritative Play/targetful response-use request. Owning game modules are `src/game/hegemony/room-use-card.ts` and `card-command.ts`; public scheduler, submission and JSON-resume regressions are in `tests/hegemony/room-use-card.test.ts`, `card-command.test.ts` and `card-command-token.test.ts`. See the [source baseline](../source-baseline.json), [native wrapper investigation](../research/room-use-card-entry.md), [request investigation](../research/targetful-command-admission.md) and [checkpoint](../reviews/2026-10-19-hegemony-part4aa.md).

## Normal Room wrapper

`room-use-card` receives a trusted `{use, reference, addHistory?}` operation. It reparses through private package authority, applies incoming resource flags while preserving unrelated parsed flags, and replaces the parsed tag map with a copy of incoming tags. Its hand provenance is true only for nonempty parsed materials all held in the original actor's hand. Empty, foreign or mixed materials make provenance false; that flag alone does not reject use. Handling-method limitation rejects only when recast cannot bypass it.

Validation is a resumable child returning null or `{entry, validated}`. Its local entry and returned card are distinct: validation can change the local source, targets or card independently of the returned card pointer. Null retains eager validation effects and returns false without wrapper history, onUse or after-hook.

The wrapper captures the pre-validation history key (Lua `#objectName`, otherwise class name) and signed sum of Slash/ThunderSlash/FireSlash history. In the post-validation actor's Play phase, caller `addHistory` records that captured key and the returned card's normalized `ViewAsSkill_<name>Card` key. Each actual increment precedes its notification. This is the wrapper's increment behavior, not a complete low-level history clearing API.

Private metadata supplies object identity separately from resource reference and serialized descriptor. Same-real comparison uses local `realIdentity` versus returned `identity`. A normal path invokes the local card's onUse and its after-hook with the saved wrapper use; mutable onUse events and void child results do not replace that snapshot. Repeated Slash flags use the captured count and caller history option even outside Play.

A returned virtual single-material DelayedTrick takes over the actual physical wrapper's five face fields and modified state. Physical flags, tags and unrelated wrapper data survive; update notification occurs before assigning showSkill. A physical local card emits update or reset according to its current modified state. Conversion recurses with default history enabled, ignores inner false, then runs the outer card's after-hook with the outer converted-use snapshot. Inner local rewrites do not replace outer arguments.

## Authenticated staged request

`createCardCommandAdmission` supplies a registered `card-use-request` operation, actor-only view and public submission gateway. The operation is an internal server entry; it is not a client dispatch API. Response-use composes as a child of an existing operation. Do not start another root while a stack is active.

Trusted authentication context is separate from the public reply. Only `{id, choice}` is accepted; actor, descriptors, resources, flags and manual target arrays are not accepted from a player. The authentication provider remains an integration authority. The fixture session adapter is not a deployed login system.

The private request captures actor, reason, context epoch, pattern, method, history option and cancellation policy. Play additionally requires the living active actor in Play. Response-use binds to its expected living responder and request context without imposing that responder's Play phase. The context authority must invalidate superseded epochs; phase progression and removal of superseded requests remain enclosing orchestration responsibilities.

Card/material offers come only from supported versioned private catalogue authorities. Enabled/availability, skill/ViewAs permission, pattern matching and material accessibility are checked against current state. Each material must have one physical location; declared package permissions may allow equipment or private piles. Unsupported repeated/multi-vote target metadata and offers with prefilled manual targets are not advertised. These callbacks are mandatory authorities, not a ported complete native catalogue.

Opaque choice tokens bind private card offers, ordered target prefixes and final confirmation. Target filtering/prohibition runs incrementally in order; final confirmation also checks feasibility. Target-fixed cards have an empty manual target list. The card policy owns alive, distance, faction and implied-recipient rules; there is no universal alive-target restriction.

Every public reply checks authentication, strict shape, current request and scheduler freshness. Intent-advancing replies additionally revalidate the selected offer/materials and ordered target prefix. Back/cancel may discard a stale selection while the request context remains valid; they never enter Room or pay cost. Rejected replies preserve game and scheduler state.

Play emits PlayCard before input. Confirm emits ChoiceMade and ignores its consumption/payload rewrite, then revalidates current eligibility and targets before Room execution as an additional web authority policy. Room false retains eager effects and refreshes offers with a new prompt; it is distinct from cancellation and successful use. Response-use decline emits `cardUsed:<pattern>:<prompt>:nil`. An empty cancellable offer set exposes an explicit decline choice; an empty noncancellable set returns unavailable. Dispatch/resume true means scheduler progress, not card-use success; private operation completion carries used/cancelled/invalidated/unavailable status.

Only the bound actor receives display labels and choice tokens. Raw descriptors, material IDs, hidden names, ledgers, continuations and operation completions remain private. Saved JSON preserves request bindings, targets, generations and scheduler prompt identities; registries/callbacks stay external. Future network integration must expose this gateway rather than raw scheduler resume or internal operations.

## Remaining authorities and release gates

Parsing, identity/ancestry, card availability, skill ownership/ViewAs policy, pattern matching, legal material selection, target semantics, validation, card-specific onUse/after methods and notifications are supplied private authorities. The tests compose real onUse/GameRule/resource/movement operations and real token cost/use; they do not enable a complete package or production command.

Native exception unwind is excluded: turn-broken, stage-change and game-over preserve eager changes and freeze uncompleted frames. Direct MethodUse/MethodResponse/askForCard and rescue rerouting remain distinct work, as do phase loops, content manifests, RNG/dealing, application authentication/network/UI/bot integration and complete-match E2E. Production still registers Standard2013. No native runtime differential, all-packages or playable Quốc Chiến claim follows from this library checkpoint.
