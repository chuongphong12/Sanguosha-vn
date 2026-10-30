# Part 4ad — batch drawing design

Status: approved expanded B, 2026-10-21: core acquisition/player drawing/fill-hand
plus the normalized Draw-phase owner with three actual freeChain boundaries.
Source baseline: game `db62db9f63e30595e1dfa80fcf41a4eeca8dc6a3`, native
`ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f` (2.3.43-beta2).
Continue from [draw pile](../engine/draw-pile.md) and
[Room judgment](../engine/judgment.md), not the retired Standard rules.

See the [native drawing investigation](../research/2026-10-21-card-drawing.md).

## Problem Statement

The engine can draw one physical card for judgment but cannot yet acquire a batch,
draw into player hands or execute the normal Draw phase without fixture-owned rules.

## Solution

Implement actual Room getNCards and single/multiple-recipient drawCards over the
existing scheduler, reservations, RNG and physical movement. Compose the existing
fill-hand operation with the actual draw operation; do not substitute array slicing
or a callback implementing the draw rules in tests.

Add the Draw-phase owner described below, while keeping initial dealing and full
phase/turn scheduling separate. DrawCards itself emits
neither DrawNCards nor AfterDrawNCards; those belong to a different native owner.

## User Stories

1. As a player, I want multi-card acquisition to preserve native pre-swap order.
2. As a player, I want insufficient cards to end the game at the correct boundary.
3. As a skill owner, I want one Fetch hook per actual selected card.
4. As a player, I want top and bottom draws to return the right ordered cards.
5. As a multi-recipient effect, I want all cards reserved before one atomic transfer.
6. As a developer, I want count/direction fallback and skipped recipient indices preserved.
7. As a reform effect, I want the exact dead-player exception without extra guards.
8. As a fill-hand consumer, I want the actual positive deficit drawn once.
9. As a player, I want draw reasons, wrapper flags and visibility preserved.
10. As an active player, I want DrawNCards to modify the phase count.
11. As a player, I want surrender/reveal/reward effects resolved at all three freeChain boundaries.
12. As a skill owner, I want AfterDrawNCards to receive the captured count even when nonpositive.
13. As a reconnecting player, I want JSON restoration without duplicate acquisition or payment.
14. As a developer, I want current knowledge, tests and two independent reviews for each layer.

## Native contracts to preserve

| Owner              | Required behavior                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| getNCards          | If requested count exceeds available draw, compare against draw+discard before Fetch; insufficient total ends the game immediately. Otherwise recycle even with nonempty available draw. Then call actual drawCard for each requested ID.                |
| Batch result       | Return reserved IDs in selection order. Top/bottom default top. Count <=0 selects nothing, but requested final pile-count notification still occurs.                                                                                                     |
| Notifications      | updatePileNumber=false suppresses only getNCards' own final count; nested swap notices still run. Count is read at its native delivery boundary, not invented from the request.                                                                          |
| drawCards inputs   | Snapshot ordered recipients, nonempty counts and optional per-index direction list. Reuse the last count if shorter than recipients; missing direction defaults top. Single-recipient use normalizes to a one-element list.                              |
| Recipient gate     | Advance input index even for dead/zero-count recipients. Check alive when visiting each recipient; exact reason `reform` permits dead recipients. There is no removed guard.                                                                             |
| Atomic transfer    | For each eligible recipient run actual getNCards with count updates disabled, accumulate moves, then run exactly one actual move-cards transaction after all recipients have been processed. Do not precheck capacity for the sum across all recipients. |
| Failure            | A later recipient's terminal shortage preserves earlier eager reservations; no recipient has received a hand transfer yet. Follow existing frozen-stack interruption policy.                                                                             |
| Reason/visibility  | DRAW actor=recipient, skill=request reason, eventName empty; forceVisible=false. Use deterministic normalized open=false for hand privacy; native raw CardsMoveStruct.open is uninitialized, so raw event-bool parity is not claimed.                    |
| Empty transactions | An explicit nonempty count list with no recipients, or all skipped recipients, still invokes actual empty movement and its native-style event lifecycle. Reject an empty count list rather than emulate native assertions.                               |
| Wrapper state      | Compose existing wrapped-card movement policy for arrival flags and filtering. Do not manually reset flags during selection or recycling.                                                                                                                |

Native update-pile during drawCards belongs inside movement: after source removals,
before lose updates, mappings, get updates and GET notification. The existing web
movement module deliberately leaves per-recipient transport/count notifications as
an adapter/integration boundary. The core drawing layer preserves that boundary and does not fake
an extra post-drawCards count notice. GetNCards' own explicit count notice is real.

## Interface and implementation approach

- Add a registered get-n-cards operation alongside draw-card/swap-pile. Request:
  count, optional updatePileNumber and fromUp; result: ordered physical IDs.
- Add a registered draw-cards owner with a canonical recipient/count/direction-list
  request and reason. A one-recipient list covers the single-recipient owner without
  duplicating the algorithm. Destination lookup requires a unique recipient hand zone.
- Keep callbacks/registry outside JSON state. Persist loop cursor, captured lists,
  returned IDs and pending move records in continuations. Existing reservations
  remain the unique physical source until actual movement commits.
- Keep movement, getAllPlayers, result and RNG algorithms unchanged. The new owner
  reuses movement rather than widening its critical shared implementation.
- Existing fill-hand input/shortfall semantics remain; its draw adapter delegates
  to the registered actual draw-cards owner.

## Accepted B — also include the normalized Draw-phase owner

Scope B includes all of A plus the native Draw phase's own orchestration, with
current phase/mark authority stated explicitly. Start with 2 + 3 * JieyueExtraDraw,
clear Global_FirstRound, trigger DrawNCards, run freeChain, capture the rewritten
integer, draw only when positive, run freeChain, emit AfterDrawNCards with the
captured integer even when nonpositive, then run freeChain a third time.
The phase draw supplies an empty reason under the native ServerPlayer default.

Use the existing actual free-chain operation and its separately stated package/
reveal/kill adapters. Event consumption does not skip the owner's subsequent work;
there is no invented alive/removed guard in the phase body. Inner drawCards keeps
its own alive gate. This does not implement the complete phase scheduler or
GameStart/initial dealing, which have different event families.

The selected B closes the immediate Draw-phase consumer and adds mark/flag,
mutable count and three surrender/reveal/reward boundaries to the same delivery.
Validate A fully before advancing to that dependent layer.

## Public test seam and acceptance

Reuse the approved dispatch/resume seam with actual draw, recycle, terminal,
movement and wrapped-card operations. Test pre-swap vs per-card Fetch timing,
capacity failure, zero/negative counts, top/bottom, current count notice and swap
notices, per-recipient fallback/index/death/reform behavior, one atomic transfer,
empty transaction, visibility/flags, retained reservations on later failure, nested
effects and repeated JSON restore with wrong/stale/replayed answers rejected.

Integrate actual fill-hand and at least one existing reward/careerist consumer at
the same seam. For B add source-derived count/flag/event order, all three actual
free-chain boundaries, count rewrites, consumption, zero/negative counts, inner
death gating and JSON restore cases.

Baseline: 269 tests / five relevant files pass before implementation. Graph-bound
file hashes match; current movement factory is CRITICAL (39 direct indexed
callers), getAllPlayers HIGH (8 callers), draw/swap/fill factories LOW. No edit to
the shared movement or getAllPlayers helper is proposed. Record graph limitations
and obtain exact pre-edit impacts for any additional selected owner.

## Delivery and exclusions

For approved B: update canonical knowledge per validated layer, test-first
implementation, focused checks, full check/build, current graph/hash/flow review,
independent Standards and Spec reviews, source commit, reviewed knowledge publish,
subtree pin and clone/switch verification.

This slice does not enable production, implement initial dealing/full turns, add
whole movement transport, port every package, change the portable RNG policy,
implement native exception unwind or certify Qt/full-match parity.
