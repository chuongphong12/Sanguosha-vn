# Application-owned native startup

Inspected game [4cad85771d797f1d960e2faf1f6dcfdb6ac032a4](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/src/game/hegemony/match-startup.ts), native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. The user accepted [approach A](../specs/hegemony-startup-owner.md): two static registries with an application-owned cursor. [M1.2 execution evidence](../reviews/2026-10-28-hegemony-m12-startup-owner.md) is separate from the contract. This extends the [one-authority match](match-authority.md); the generic scheduler is unchanged.

## Order and registry boundary

Native [RoomThread::run and constructTriggerTable](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L84-L220) register GameRule/global skills, check the initial winner, emit global GameStart, construct the full trigger table and conditionally emit player GameStart in registration order. TurnStart follows this sequence and remains outside M1.2.

[createMatchStartup](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/src/game/hegemony/match-startup.ts) owns winner → global → players → complete, or winner → over. Winner/global/over use the startup-global registry. Player startup and complete use startup-full. Both tables share actual operations; only skill definitions differ. Global includes the built-in GameStart bridge and explicitly classified supplied global skill IDs. Full includes all supplied profile handlers, not all native packages. Duplicate/unknown global IDs are rejected; the sorted classification is persisted.

The owner consumes the expected completed root before advancing. Only after the global root has drained does it change scheduler.registryVersion to the full table. It preserves scheduler.nextId and Room facts. Frames, prompt or interruption block advancement. Eligibility is read from a fresh cloned current Room before each seat; global/acquired-skill changes therefore affect later eligibility. The supplied predicate still owns native package discovery.

## Actual winner composition

The match installs actual [get-winner/game-over](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/src/game/hegemony/victory.ts) with [general relations](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/src/game/hegemony/general-relations.ts) and supplied named [show-general](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/src/game/hegemony/general.ts)/[careerist-rule](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/src/game/hegemony/careerist.ts) operations. Lord lookup includes dead lords, as [native getWinner](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L1058-L1151) requires. A string result, distinct from null, leads to real game-over before global dealing. Reveal/careerist children can suspend through the existing scheduler. Their package/UI boundary operations must be composed; the owner does not replace them with a fake winner result.

## Persistence and projection

[Match schema v2](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/src/game/hegemony/match.ts) persists the cursor, startup settings and sorted global IDs alongside rules/content/registry identities. Restore rejects v1, classification/settings drift, a cursor/table mismatch and an active root inconsistent with its stage/target. It checks the existing Room/card inventory and sole-authority boundary. Executable callbacks are not serialized and must be versioned by the profile owner.

Restore may advance an unfinished idle stage or consume a completed-root checkpoint after validation. It leaves pending frames/prompts/interruptions paused; complete does not replay. Replies use the saved stage's table. IDs remain monotonic across the switch and JSON continuations. This is trusted persistence validation, not authentication, durable commit or crash-safe publication.

Prepared now means all eligible startup stages completed, rather than only global GameStart drained. Starting follows the cursor. Finished follows Room.gameResult; interrupted retains eager effects/frames. Full phase/turn ownership and native exception cleanup remain required before a playable match.

## Evidence boundary

[Match tests](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/tests/hegemony/match.test.ts) cover the public application seam with synthetic content and explicit package/presentation adapters. Actual startup/dealing for 2–10 seats remains covered; accepted/declined luck remains a two-seat collection test. New winner-condition cases inject trusted serialized native-condition fixtures through restore: they execute real winner/reveal/careerist/game-over children, but do not establish a normally created all-hidden 2–10-seat match reaching a terminal result. The careerist child takes its no-recruitment branch; no new recruitment-prompt coverage is claimed. General package/filter/UI hooks remain explicit fixture adapters, including the pre-show prompt hook.

No production, M0 Socket.IO/store, hosted-provider, full-match or native runtime differential integration was added. The [release gates](../plans/hegemony-release.md) remain open.
