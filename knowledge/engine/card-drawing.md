# Batch acquisition and player drawing

Part 4ad follows the approved expanded B in
[specification #23](https://github.com/chuongphong12/Sanguosha-vn/issues/23) and
the [native drawing investigation](../research/2026-10-21-card-drawing.md).
It builds on [draw-card, reservations and recycling](draw-pile.md).

## Batch acquisition

`get-n-cards` accepts signed int32 count, updatePileNumber (default true) and fromUp
(default true). It returns ordered physical IDs, retaining the private draw
reservations rather than moving them into a hand. It checks capacity once before
the first Fetch: if count exceeds available draw, total draw+discard shortage
terminates through actual game-over; otherwise run actual swap-pile even with
nonempty draw. Then call actual draw-card once per requested ID.

The loop and accumulator persist as JSON. Each child reads the latest available
pile, so nested Fetch effects can consume or reorder cards. A late interruption
keeps earlier reservations and suppresses the final success count notice. After
the loop, optionally deliver one update-pile with the latest available length.
Zero/negative counts skip selection but still send the requested count notice.
Disabling that notice does not suppress notices from a nested swap.

Validation uses the public dispatch/resume seam, actual child operations and
source-derived capacity/order/persistence cases.

## Player-hand transfer

`draw-cards` snapshots players, nonempty counts, optional fromUps and reason
(default empty). A one-element players/counts request is the single-recipient
case. A short count list repeats its last entry; a missing direction defaults top.
Input indices advance even for skipped slots, duplicates remain ordered, and each
slot checks current alive state before selecting positive counts. Exact reason
`reform` permits dead recipients; removed state is not checked.

Each eligible slot invokes actual get-n-cards with its own count notices disabled,
accumulates a movement record, and only then visits the next slot. Once all slots
finish, invoke one actual move-cards transaction, even if no moves accumulated.
A later shortage preserves earlier reservations without transferring earlier
hands. There is no after-acquisition alive recheck. DRAW uses actor recipient,
skill equal to reason, empty eventName, open=false and forceVisible=false.
Actual wrapped-card movement clears visible and applies destination filtering.

This owner emits no DrawNCards/AfterDrawNCards and fabricates no post-movement
pile count. Native movement-owned notifications/visibility remain the existing
transport integration boundary; deterministic open=false is not a claim about
native uninitialized event fields. Swap notices still occur as children.

Actual fill-hand composition keeps its own alive/positive-deficit gate, captures
the deficit once and delegates to real draw-cards. The halfmaxhp token's actual use
body also composes real drawing with its native reason. Test request/catalogue/
filter metadata remain explicitly private adapters. The [Draw-phase owner](draw-phase.md)
composes this layer after its separate validation. The [global GameStart owner](game-start.md) uses actual draw-cards with registration order, four cards and empty reason; [luck redeals](luck-cards.md) use direct acquisition and their own manual transfer instead of draw-cards.
