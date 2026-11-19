# Luck-card state and manual transfer

Approved Part 4ae B follows the [GameStart specification](../specs/hegemony-part4ae-game-start.md) and [pinned native investigation](../research/2026-10-22-game-start.md). It keeps manual luck-card transfer separate from ordinary atomic movement.

## Manual transfer layer

The registered luck-transfer operation returns a whole ordered hand to the available pile or redeals selected IDs from the private draw-reserved zone. It validates current unique locations and wrapped metadata before allocating a frame. Return prepends each original ID, reversing that hand chunk; redeal appends IDs in acquisition order. PUT/actor/luck_card belongs to return, while redeal uses UNKNOWN and empty string fields.

Lose delivery precedes source removal, native owner/place mapping and wrapped update; get delivery precedes destination inventory addition. A configured private transit zone preserves unique physical storage and the in-flight native owner/place through JSON suspension. It is not available draw order or the normal hand inventory. Between delivery children the scheduler remains occupied; trusted notification adapters deliver data and do not introduce gameplay actions. On a get-boundary interruption, the in-flight mapping persists with the frozen stack; native unwind remains outside this slice.

The existing wrapped-card pipeline now has an explicit manual-arrival policy: loss/destination filtering remains real, while ordinary atomic-arrival visible clearing is omitted. Default atomic movement semantics are unchanged. Empty packets skip filtering while retaining the owner's delivery boundaries. No BeforeCardsMove/ConfirmMoveCards/PreCardsMoveOneTime/CardsMoveOneTime is fabricated by manual transfer. Return delivery is private to the returning actor; redeal delivery requires normal recipient-specific masking by the trusted transport adapter.

## Round owner

The actual luck-card owner first crosses the pause boundary, then captures registered participants whose trusted native-equivalent AI authority is absent. It does not add an alive/removed gate or rebuild that initial eligibility list. Each positive remaining round asks all surviving participants through one trusted broadcast collection operation. Only per-player ready=true and strict boolean true payloads survive; missing, false, malformed and not-ready responses are permanently dropped. An invalid top-level collection result violates the adapter contract rather than becoming a gameplay retry.

Every accepted invocation is publicly logged before any hand return. Counts are captured at each player's return boundary. All hands return in participant order before one native forward-modulo shuffle over the available pile, using the shared persisted portable RNG. The owner then acquires each captured count through actual get-n-cards(update=false) and completes its manual redeal before acquiring the next participant's batch. A later shortage preserves earlier completed hands. A completed round broadcasts the current available pile length, then rechecks the configured limit and surviving list.

No accepted users means no shuffle/redeal/final count. Accepted zero-card hands still follow the empty transfer and round lifecycle; an empty pile does not cause get-n-cards(0,false) to invent terminal failure. Initial dealing and normal Draw-phase count events remain separate owners. Source-derived literal RNG transcripts, interruption and public JSON dispatch/resume cases cover these boundaries and actual GameStart composition.

The collection adapter owns simultaneous all-send, common server deadline, authentication and connection-state normalization; diagnostic test prompts only suspend that adapter and do not simulate sequential user luck prompts. Notification adapters own native recipient masking, visibility and offline delivery. These fixtures do not establish production broadcast/privacy transport. Private transit/mapping state and raw operation frames must not enter public projections. Full startup/turn integration, native unwind, enabled packages, exact Qt RNG and full-match certification remain outside this slice.
