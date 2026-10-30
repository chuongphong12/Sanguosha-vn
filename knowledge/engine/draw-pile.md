# Draw pile and reservations

Part 4ac, [specification #22](https://github.com/chuongphong12/Sanguosha-vn/issues/22),
implements actual `draw-card` and `swap-pile` scheduler operations. See the
[pinned native investigation](../research/2026-10-21-room-judge.md).

The private physical ledger has distinct available draw, reserved draw and discard
zone keys. Both draw zones have null owner and `draw` place. Drawing removes one
ID from available order and reserves it without movement hooks; actual subsequent
`move-cards` locates and removes that reservation. This preserves native DrawPile
mapping while preventing nested effects from choosing the same card again. These
zones are authoritative private state, not player projections or new public places.

`draw-card` accepts `fromUp` (default true). It emits FetchDrawPileCard with null
target and null data, ignores consumption and checks the latest available pile.
If empty, it runs real `swap-pile` before selecting top/bottom. ID zero is valid.
It does not itself implement batch acquisition, canonical card lookup or pile-count
updates belonging to other native callers.

`swap-pile` terminates through registered actual `game-over` with winner `.` when
both logical piles are empty, before changing SwapPile. Otherwise increment the
latest room tag and end if equal to configured limit+1 (default 6, enabled only
when positive). Reserved cards are excluded from both-empty. A returning terminal
handler is rejected; it cannot permit draw/shuffle to continue.

Recycle uses native forward Fisher–Yates modulo selection with one integer per
discard card, including the final card. The web stream is explicitly
`mulberry32-v1`, serialized unsigned 32-bit state, integer output equal to the
unsigned mulberry32 result shifted right once. Seed/state 1 produces integers
1346631033, 5874916, 1132683893, 2106790910, 2079575701; five cards 0–4 become
3,1,4,0,2 and final state 567894474. Seed provisioning remains trusted match setup;
execution never reads time or ambient randomness. This is portable deterministic
web authority, not established bitwise Qt qrand stream parity.

Append recycled discard to existing available draw. Preserve wrapped metadata,
flags and tags; do not call movement or emit movement hooks. Clear discard, deliver
reset-pile, then read the latest available count for update-pile. Named delivery
children can suspend and restore JSON without reshuffling. Physical malformed or
ambiguous locations reject safely. Scheduler interruption retains eager state;
native exception unwind is outside this slice.

Validation uses public dispatch/resume, actual movement and terminal operation,
seeded transcript vectors and JSON restoration. Exact test totals, reviewed source
and final validation are in the [revision checkpoint](../reviews/2026-10-21-hegemony-part4ac.md).

Part 4ad adds the separate actual [getNCards/player draw owner](card-drawing.md)
and [Draw phase](draw-phase.md). Single-card drawing keeps its original semantics.
