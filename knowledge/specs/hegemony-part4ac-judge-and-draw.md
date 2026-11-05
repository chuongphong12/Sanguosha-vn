# Part 4ac: Room judgment and draw pile

Status: approved expanded B, 2026-10-21. The user approved actual drawCard,
FetchDrawPileCard, recycling, reservations and RNG in addition to the judgment
owner and three GameRule stages. Authority: pinned ce4e62b and the
[native investigation](../research/2026-10-21-room-judge.md).

## Problem Statement

Retrial currently requires a ready judgment supplied by a caller. The engine
cannot yet start a judgment from the draw pile, offer retrials in native order,
finish its result or recycle an exhausted pile without a fixture owning those rules.

## Solution

Implement actual resumable Room judgment and draw operations, composed with the
existing scheduler, card resources, movement, result and Guicai/Guidao operations.
Validate each dependent layer before advancing to the next.

## User Stories

1. As a judged player, I want the next physical card drawn exactly once.
2. As a skill owner, I want FetchDrawPileCard before the draw chooses a card.
3. As a nested effect, I want cards already drawn reserved so I cannot draw them again.
4. As a player, I want an exhausted draw pile recycled using the native order policy.
5. As a replay consumer, I want persisted RNG state and deterministic shuffle results.
6. As a player, I want empty piles and the configured swap limit to end the game at the correct time.
7. As a judged player, I want a pending null-card judgment to become ready through actual movement.
8. As a retrial skill owner, I want the native captured actor order and consumption rules.
9. As a player, I want FinishRetrial pattern selection to preserve the cached result.
10. As a Luoshen owner, I want a good judgment retained instead of discarded.
11. As a reconnecting player, I want JSON resume without repeated draws, shuffles, payments or notices.
12. As a developer, I want malformed state rejected safely and all surviving adapter boundaries documented.

## Implementation Decisions

- Keep physical cards uniquely located in the existing card-zone ledger. A private
  reserved zone has native DrawPile owner/place semantics but is excluded from
  available draw order; subsequent actual movement removes the reservation.
- Draw emits FetchDrawPileCard with null target/data, ignores consumption and reads
  the latest pile. Top/bottom selection removes one ID from available order before
  canonical lookup and movement. Physical ID zero is valid.
- Recycling appends a forward Fisher–Yates shuffle of discard to available draw;
  consume one RNG integer for each card, including the last. Preserve wrapped
  state and do not emit movement hooks. Reset notice precedes updated pile count.
- Persist a versioned mulberry32 RNG with unsigned 32-bit state and a 31-bit
  nonnegative output for native-style modulo selection. This is the portable web
  stream authority, not a claim of bitwise Qt qrand parity; the reference has no
  exact Qt runtime pin. No ambient Math.random or time reads during execution.
- Both-empty ends before SwapPile increment; the configured limit defaults to five,
  uses limit+1 and equality after increment. Terminal execution must interrupt.
- Add pending judgment state without weakening the existing ready-only retrial
  reader. Preserve original owner judgment identity separately from mutable event
  judgment identity. Capture StartJudge's current packet after draw returns.
- Room increments its judge tag, emits StartJudge, snapshots getAllPlayers order,
  loops AskForRetrial until consumed, emits FinishRetrial, decrements the latest
  tag, then emits FinishJudge and the original object's optional final log.
- GameRule stages own actual initial movement/result, result-pattern selection and
  final disposal. FinishRetrial never recomputes the cache; FinishJudge retains
  good Luoshen irrespective of negative. JUDGE/JUDGEDONE carry reason as eventName
  and empty skill. A card no longer in a judge zone is not discarded again.
- Package catalogue/canonical metadata, ExpPattern grammar, skill eligibility,
  codec, reveal and transport/delay delivery remain explicit named adapters.

## Testing Decisions

Use the already approved public scheduler dispatch/resume seam, actual movement,
result and retrial skills. Observe returned results, authoritative state and
public event/notification packets. Cover pending/ready boundaries, nested draw,
terminal timing, seeded replay, top/bottom, shared packet replacement, consumption,
actor snapshots, Luoshen, metadata, real skill replacement and JSON restoration.
Keep each red/green slice small; run focused checks and update knowledge before
advancing. Finish with full check/build, exact graph validation and independent
Standards and Spec reviews.

## Out of Scope

Native exception unwind/rollback; full Qt RNG stream parity; getNCards/drawCards
batch policy; extra retrial packages; complete pattern/catalogue implementations;
production transport/UI/bots, Standard retirement and full-match parity.

## Further Notes

This is an engine foundation slice. Passing its acceptance tests does not establish
production playability or complete Quốc Chiến coverage.
