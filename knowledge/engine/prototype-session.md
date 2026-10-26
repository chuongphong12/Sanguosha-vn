# Local session and pending Slash/Jink contract

Inspected source: game `bc3ceb996054cf6fc42f0204f553bf279e13899b`, delivered with its knowledge pin at `da4b78aa57d64d02008683e47c26ddbb943be7ed`. The runtime source trees are identical between those commits. Native authority remains [ce4e62b, 2.3.43-beta2](../rules/source-authority.md). This contract describes the isolated M0 experiment under `server/prototypes/hegemony-m0/`, not the production `TqsGame` registration or a complete Quốc Chiến match.

## Executed authority chain

The [engine composition](https://github.com/chuongphong12/Sanguosha-vn/blob/bc3ceb996054cf6fc42f0204f553bf279e13899b/server/prototypes/hegemony-m0/engine.ts) registers an actual boardgame.io 0.50.2 Master-compatible game. Its [battle adapter](https://github.com/chuongphong12/Sanguosha-vn/blob/bc3ceb996054cf6fc42f0204f553bf279e13899b/server/prototypes/hegemony-m0/battle.ts) connects existing Play admission → Room use/history → Slash → direct ask-card-use/MethodUse → Jink/material movement → SlashMissed or normal damage/HP. These remain the distinct [admission](room-use-and-admission.md), [direct request](direct-card-use.md), [Slash/Jink](nullification-and-slash.md) and [scheduler](scheduler.md) contracts; Play admission is not substituted for every request family.

The game uses eight synthetic physical cards, two living adjacent seats with 4 HP each, a fixed seat-0 Play context and one plain Slash allowance. Availability, reference metadata and no-skill hooks are fixture authorities. There are no production catalogues, skills, equipment, conversions, full turns, lethal/rescue integration or native deck-manifest claims. The v2 prototype save identity rejects older draw-only scratch saves.

## Command, commit and receipt

The [session owner](https://github.com/chuongphong12/Sanguosha-vn/blob/bc3ceb996054cf6fc42f0204f553bf279e13899b/server/prototypes/hegemony-m0/session.ts) authenticates the secret-bound seat, live controlling tab and generation before accepting a normalized draw/play/answer command. New intent requires the current game revision. Answer intent contains only the prompt ID and offered choice; the server supplies card metadata, materials and actor authority.

Commands serialize through one local writer. Master storage/subscriber/transport output is staged; raw Master packets are discarded. Game state, pending scheduler frames, RNG state, metadata, controller generation and actor-scoped receipt are saved together by file write → fsync → rename. Only after commit can the transport return a fresh actor projection. This persistence boundary stages library mutations; it does not change the library's eager child/late-error semantics.

Receipt identity includes the normalized payload. An identical accepted intent retry returns its receipt and current actor view; the same ID with another prompt/choice is a collision. Controller authorization still precedes receipt lookup. A new stale intent, wrong actor/prompt, unoffered Jink or prior controller cannot resume the pending decision. Unrelated drawing is rejected while the scheduler is occupied.

The store is a same-machine scratch file with a local PID writer lease. This establishes neither power-loss durability, distributed coordination, an external database transaction nor a durable event outbox. Serialized RNG state is present, but this slice has no shuffled-draw progression/recovery proof.

## Projection, transport and bot

The [loopback transport](https://github.com/chuongphong12/Sanguosha-vn/blob/bc3ceb996054cf6fc42f0204f553bf279e13899b/server/prototypes/hegemony-m0/transport.ts) binds commands to its socket's authenticated seat and does not register stock lobby/sync handlers. Unknown/deleted rooms do not implicitly recreate. Last-online explicit Leave deletes the room even with another offline member; an explicitly departed credential loses its return right. Grace clocks and automatic replacement are still absent.

Actor views allow only own hand, public hand counts/HP/discard/outcome names and owner-only choices. Raw frames, tags, resources, RNG, private request data and opponent hand identities are excluded. A secondary same-seat tab sees the same actor information read-only; explicit takeover advances generation and fences the prior controller.

The [pure bot policy](https://github.com/chuongphong12/Sanguosha-vn/blob/bc3ceb996054cf6fc42f0204f553bf279e13899b/server/prototypes/hegemony-m0/bot.ts) receives only an actor observation and versioned per-seat memory. The test client explicitly invokes a Jink choice and submits it through the human command boundary. No automatic server bot worker, persisted live bot memory, whole-seat takeover or competitive-strength result is implemented.

## Evidence and next boundary

The [public transport tests](https://github.com/chuongphong12/Sanguosha-vn/blob/bc3ceb996054cf6fc42f0204f553bf279e13899b/tests/prototypes/m0-prompt.test.ts) contain use/decline, privacy, wrong/stale/controller rejection, competing answers, failed real writes and two actual process-kill/restart cases. [Chromium source](https://github.com/chuongphong12/Sanguosha-vn/blob/bc3ceb996054cf6fc42f0204f553bf279e13899b/server/prototypes/hegemony-m0/browser-proof.ts) exercises real prompt controls and refresh while waiting. Assertions in source are distinct from executions: the [2026-10-23 checkpoint](../reviews/2026-10-23-hegemony-m0-pending-jink.md) owns the reported 2,143-test/build/browser/review evidence and retained aggregate CRITICAL graph risk. The 2026-10-26 knowledge audit did not rerun those game tests.

Next is durable service-time prompt/disconnect policy: independent 60-second clocks, no prompt reset on disconnect, server downtime excluded, and current prompt/controller fencing for scheduled bot work. These are approved requirements, not present timers. Other request families, actual external-store/provider recovery, complete content, full matches, competitive bots, load acceptance and production cutover remain open under [M0 and the release plan](../plans/hegemony-release.md).
