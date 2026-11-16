# Player-draw save codec

M1.3.5c.2b implements the actual draw-cards handler codec at game [13cd4a2557a8934541d6d4d4aaa009ac63b1c604](https://github.com/chuongphong12/Sanguosha-vn/blob/13cd4a2557a8934541d6d4d4aaa009ac63b1c604/src/game/hegemony/draw-cards.ts), fixed base 79c18e6d1caae00d12a9ad395c049781f0c43253. It follows the [approved shared-scheduler route](../specs/hegemony-match-v3-save.md) and [pile-codec subset](pile-save.md). Native authority remains ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2; live [drawing semantics](card-drawing.md) are unchanged.

## Validated contract

The pure save hook reads the existing normalized operation input, binds captured players/counts/directions/reason and accepts only null initial state or actual persisted acquired/moved stages. Transient next never persists. It rejects direct prompt/answer, event children and cleanup state. Active cursors require their queued or completed operation child; only genuinely abandoned frames may have no child.

For acquired state, index identifies the last selected input slot, target/count match it, and the count is positive. Prior transfer records must match an ordered subsequence of earlier slots with their original counts. Exact reform cannot skip any positive-count slot regardless of life, so its complete positive-count prefix is mandatory. Historical alive decisions for ordinary draws cannot be reconstructed from current state and are not replayed. The captured final target/count must match the last accumulated transfer, or empty/zero when none exists. A moved cursor has visited all input slots.

Each accumulated record has nonempty unique safe nonnegative physical IDs present somewhere in the validated physical ledger, the correct unique hand destination, open=false and exact DRAW actor/skill/eventName fields. Extra transfer/reason fields reject. The codec does not require those cards still be reserved after movement or nested effects, and does not certify historical provenance or the aggregate ledger/catalogue itself.

The immediate acquisition child must be get-n-cards with the captured count, slot direction (default top) and updatePileNumber=false. The movement child must be move-cards with forceVisible=false and the same raw transfers; object-key ordering is irrelevant. Child/result codecs retain their own responsibility. A draw-cards result validates its existing input and requires null. Validation never executes drawing, movement, a notification or scheduler work.

## Evidence and remaining boundary

[41 new tests](https://github.com/chuongphong12/Sanguosha-vn/blob/13cd4a2557a8934541d6d4d4aaa009ac63b1c604/tests/hegemony/player-draw-save.test.ts) use actual scheduler, pile, game-over and movement runtime. A private fixture event validator covers acquisition; a boundary-only movement test codec accepts the queued null cursor/result shape and explicitly rejects active movement cursors. Tests skip decoding only inside actual movement, run that body normally, then resume decoding at its returned result. This is parent handoff/recovery evidence, not an actual movement save codec.

Cases cover top/bottom/default directions, repeated last count, skipped/duplicate recipients, exact reform, zero/negative counts and empty recipients, changed life state after acquisition, shortage with earlier reservations and game-over unwind, corrupt cursors/child requests/transfers/results and reordered equivalent JSON. Known transcript: recipients a/b/c with counts1/2 (last repeated) and bottom only for a receive [11], [0,1], [2,3]. Decoder input remains unchanged in rejection/isolation checks. The exact source [checkpoint](../reviews/2026-11-16-hegemony-m135c2b-player-draw-save.md) records RED/GREEN, review and graph limits.

Existing run/preflight callbacks and emitted scheduler interpreter match the fixed base. Old profiles do not opt into restore through these hooks. Actual movement, fill-hand, startup/battle/general/package codecs, aggregate Room/settings/catalogue/root binding, public v3 and full-match/release acceptance remain pending. PR33 stays draft.

## Later actual movement recovery

The [M1.3.5c.2c contract](movement-save.md) adds actual movement codecs and replaces the prior player-draw test-only movement boundary with real decoding at its own source revision. This does not complete remaining profile/Room/public-v3/release gates; earlier revision-scoped evidence retains its scope.
