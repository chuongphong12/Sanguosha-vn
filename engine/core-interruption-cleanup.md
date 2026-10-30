# Protected core interruption cleanup

Inspected game [9024429ba89e7a21b090734d51a2d042e85d7928](https://github.com/chuongphong12/Sanguosha-vn/blob/9024429ba89e7a21b090734d51a2d042e85d7928/src/game/hegemony/room-use-card.ts). This is M1.3.2 of the accepted [five-checkpoint B design](../specs/hegemony-turn-unwind.md), using the [opt-in scheduler](scheduler-unwind.md). See the [checkpoint](../reviews/2026-10-28-hegemony-m132-core-unwind.md) for actual executions and reviews. Existing M0/M1.2/production profiles still freeze; no application begins using this policy merely because these handlers exist.

## Native owner boundaries

Only TurnBroken and StageChange enter these catches. GameFinished maps to game-over and leaves their catch bodies unexecuted. Eager HP, history, movement and child effects remain; unwind is not rollback. Saved normal continuation determines whether a protected region was entered. An invalid stage rejects explicitly.

| Owner | Protected region and cleanup |
| --- | --- |
| [damage](https://github.com/chuongphong12/Sanguosha-vn/blob/9024429ba89e7a21b090734d51a2d042e85d7928/src/game/hegemony/damage.ts) / [native Room](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4490-L4573) | ConfirmDamage and Predamage are outside. From DamageForseen through DamageComplete, remove is_chained/CurrentDamageStruct and clear the entire damage stack; do not synthesize DamageComplete or restore HP. |
| [CardUsed](https://github.com/chuongphong12/Sanguosha-vn/blob/9024429ba89e7a21b090734d51a2d042e85d7928/src/game/hegemony/card-used.ts) / [native GameRule](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L562-L611) | Pre-action/TargetChoosing/TargetConfirming are outside. Protected Jink/TargetRecord/TargetChosen/TargetConfirmed/use catches remove the current captured local use's Jink key unconditionally, including non-Slash. Do not restore the normal Jink backup. The local is captured before target events and refreshed before use, matching native local versus QVariant reload boundaries. |
| [Room use](https://github.com/chuongphong12/Sanguosha-vn/blob/9024429ba89e7a21b090734d51a2d042e85d7928/src/game/hegemony/room-use-card.ts) / [native Room](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4269-L4303) | Validation/history precede the try. Wrapping/onUse/validateAfter/recursive conversion are inside. Invoke required room-use-cleanup with the owner's original entry; missing operation is a composition error. |

Damage cleanup preserves unrelated tags, including transfer state. CardUsed requires explicit live resource metadata; absence fails instead of pretending cleanup succeeded. Default freeze registries never run these hooks automatically.

## Room cleanup order and resources

1. Select only the original use's material IDs currently on table, matching [getCardIdsOnTable](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L6620-L6645); move through actual movement with UNKNOWN reason, actor/skill/single target and force-visible metadata.
2. Set original source Global_ProcessBroken, emit actual CardFinished with cloned original use, then unset the original source flag only if the event returns. A rewritten event payload affects its GameRule child, not this Room owner's local entry.
3. Capture living seats after CardFinished. For each captured actor, delete Qinggang once, snapshot flags once, remove Global_GongxinOperator locally and *_InTempMoving with optional notification operations. Do not rescan new flags or re-delete new tags after resume. Before removing/notifying a captured flag, check live presence: native [setPlayerFlag](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2240-L2248) suppresses a missing minus-flag notification. A later death does not remove an actor already captured for iteration.
4. Reset original Engine catalogue flags for all registered physical cards, including disabled entries. Filter enabled IDs in supplied Engine order and shuffle with the single saved pileRandom authority; persist that shuffled order before any sweep child can pause.
5. Recheck each shuffled ID's live zone. Actual movement sends table/judge cards to discard; delayed areas are excluded. Remove only current wrapped using, preserve other wrapper flags/face, set modified=true and issue its optional notification. [WrappedCard::setFlags](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/wrappedcard.cpp#L71-L77) sets modified on this mutation.

Engine flags and Room wrappers are separate authorities: [getCard/getEngineCard](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/engine.cpp#L547-L579) versus [getRandomCards](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/engine.cpp#L961-L999). The new RoomUseCleanupGame.engineCardFlags ledger represents original-card flags; it must not be substituted by clearing all live wrapper flags. Rules supply discard zone, ordered physical catalogue with explicit enabled bans/conversions and notification operations. Validate duplicate IDs, material membership, unique physical locations, wrappers/flags, actors/tags, discard identity and mulberry32-v1 uint32 RNG before starting. A disabled catalogue entry can exist outside the active Room unless used as a material. This is an explicit profile contract; application initialization is a later checkpoint.

Portable shuffle is deterministic web behavior, not C++ qrand bit parity. Even cleanup of an empty virtual use executes CardFinished and the eligible global sweep. An empty enabled pool resets Engine flags without advancing RNG or clearing live wrapped flags.

## Resume and new interruption

Cleanup uses the same scheduler, prompts, movement and ID/RNG authority. Stage, actor/flag snapshots, shuffled pool and current sweep ID are private JSON continuations. Advance before each child so accepted answers/yields do not repeat a completed action. Wrong/stale/duplicate responses retain the existing prompt boundary rules.

A fresh interruption inside material movement, CardFinished, a notice or the sweep freezes again. Explicit unwind of that new receipt abandons a catch already running; it never restarts its remaining body. Inner converted uses catch before outer uses. A new Room use invoked inside a running outer CardFinished catch can complete its own catch, then abandon the old outer catch. Consequently ProcessBroken, temporary tags or wrapper flags can legitimately remain when native control never reaches their cleanup. No extra finally step is invented.

## Evidence and remaining work

[102 new tests](https://github.com/chuongphong12/Sanguosha-vn/blob/9024429ba89e7a21b090734d51a2d042e85d7928/tests/hegemony/core-unwind.test.ts) cross actual dispatch/unwind/resume/continue seams. Boundary matrices inject interruption fixtures; composed cases run actual damage/HP, CardUsed, Room use, movement and CardFinished handlers with supplied card/content/transport authorities. Five JSON/budget pause boundaries exercise material movement, CardFinished, player notice, sweep movement and card notice. Additional tests cover conversion/nested catch, rewritten/consumed CardFinished, life/flag iteration, non-Slash Jink, initially unmodified wrappers, removed-later-flag notification, missing composition and malformed stage.

These are bounded normalized compositions, not full matches, complete package enablement, native runtime differential, new browser/network durability or competitive bot proofs. Next is M1.3.3 phase lifecycle and actual GameRule cleanup; M1.3.4 turns/recovery/bodies and M1.3.5 match v3 remain required. No-treasure policy and all M0/content/media/room/provider/load/cutover gates remain open.

## Later phase lifecycle slice

[M1.3.3a phase lifecycle](phase-lifecycle.md) adds native sequence/change/execute/skip/insert/query as a separate library slice. It reuses current Room.playerPhases and the existing scheduler. At the M1.3.3a source input, GameRule cleanup was pending; its later implementation is linked below; turns/recovery/bodies and match v3 remain M1.3.4–5. Current application profiles and production registration are unchanged. Historical evidence above retains its named revision.

## Later complete phase library checkpoint

[M1.3.3b cleanup](phase-cleanup.md) now completes the library phase checkpoint together with [lifecycle](phase-lifecycle.md). It adds real typed/history/limitation/skill/ImperialOrder effects, with declared metadata/filter/request/presentation adapters. Current application and production profiles remain unchanged; actual turn/recovery/body ownership and match v3 remain M1.3.4–5. Earlier evidence retains its named source revision.
