# Actual pile-operation save codecs

Game [87df5894d23d854736fd51fb8fb5a4fe5fe95d7b](https://github.com/chuongphong12/Sanguosha-vn/blob/87df5894d23d854736fd51fb8fb5a4fe5fe95d7b/src/game/hegemony/draw-pile.ts), base a68e2236795d5b7d50a2b0b0e13af9528f8038d4. M1.3.5c.2a implements the first actual-handler subset under the [selected B recovery route](../specs/hegemony-match-v3-save.md). Native authority remains ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. See the [checkpoint](../reviews/2026-11-13-hegemony-m135c2a-pile-save.md) and existing [live pile contract](draw-pile.md).

## Implemented subset

- draw-card validates its existing direction input, null/Fetch/swap continuation, queued or completed Fetch/swap child and scalar reserved-card result. ID zero and noncontiguous IDs are valid.
- get-n-cards validates normalized count/direction/update flags, cursor stage and partial/completed unique reserved IDs, deterministic child name/input, result count, batch exhaustion and the notified-versus-silent branch. A persisted noticed cursor requires updatePileNumber=true; a silent branch returns immediately. Queued draw direction must match its parent batch.
- swap-pile validates declared pile zones, integer SwapPile/limit, cursor and child states, actual empty-pile/limit terminal condition and null result. Its ignored input contract is preserved. Notification children remain the configured adapter's responsibility; validation never calls notify to regenerate an operation.
- [game-over](https://github.com/chuongphong12/Sanguosha-vn/blob/87df5894d23d854736fd51fb8fb5a4fe5fe95d7b/src/game/hegemony/victory.ts) validates string input and its non-yielding/non-returning cursor contract. Any saved return result or queued child is invalid. Binding gameResult/winner to aggregate terminal ownership still belongs to application Room/root validation.

These hooks do not activate restore in existing profiles. A complete registered profile must still supply all other operation/skill/event codecs before createTriggerSaveCodec accepts it. draw-cards/movement/phase/turn/startup/general/package codecs and whole-Room/configuration validation are not implemented by this subset.

## Shared context and valid boundaries

[FrameSaveContext](https://github.com/chuongphong12/Sanguosha-vn/blob/87df5894d23d854736fd51fb8fb5a4fe5fe95d7b/src/game/hegemony/scheduler.ts) adds an optional detached immediate child plus abandoning flag to both operation and skill save hooks. The [shared decoder](https://github.com/chuongphong12/Sanguosha-vn/blob/87df5894d23d854736fd51fb8fb5a4fe5fe95d7b/src/game/hegemony/scheduler-save.ts) checks the child envelope first and computes abandonment relative to the live cleanup boundary: ancestors below it are abandoned; the cleanup owner and new descendants remain active. During boundary-null traversal all retained frames are being abandoned. Child-presence checks relax only for actually abandoned work, because traversal may already have popped its child. Active cleanup-emitted draw work must still have its expected queued/completed child.

Actual nested Fetch exposed a valid C1 checkpoint after an effect returns false: selected is cleared while recorded/stage=effect and current-band consumed identity remain. The decoder now permits this cleared-step boundary, retaining rejection of an unconsumed initial-stage forgery. A missing/non-string unwind boundary is rejected. Existing interpreter work, RNG/shuffle and handler run/preflight bodies are unchanged.

## Evidence and limits

[37 new cases](https://github.com/chuongphong12/Sanguosha-vn/blob/87df5894d23d854736fd51fb8fb5a4fe5fe95d7b/tests/hegemony/pile-save.test.ts) use real pile/game-over/scheduler operations and known mulberry32 transcript vectors. Notification acknowledgement, nested Fetch and cleanup-owner handlers are explicit fixtures. JSON/read/resume covers top/bottom, count 0/negative, ID 0/noncontiguous, silent updates, repeated notification boundaries, exhausted/limit/empty-single terminal branches, abandoned unwind, live cleanup work and nested draws. Corrupted cursor/options/material/results/children reject without changing candidates. A mutation restoring the overbroad abandonment rule is caught by the cleanup regression.

The tests prove raw pile acquisition/reservation and the named terminal paths, not player hand movement, actual game winner via combat, every package or native Qt RNG parity. Generic scheduler/game copies are not full application restore. Application decoding must still bind catalogue/settings/RNG/resources/Room/seat/root identities, and persistence/authentication/idempotency, competitive bot, browser/provider/load/media and release gates remain open. PR #33 stays draft.
