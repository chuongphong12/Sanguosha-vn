# RoundStart and Judge phase bodies

Inspected [phase owner](https://github.com/chuongphong12/Sanguosha-vn/blob/2c39ca61f3ede09e86f45e764d4f3a7b414f83f4/src/game/hegemony/phase-bodies.ts) and [reveal request](https://github.com/chuongphong12/Sanguosha-vn/blob/2c39ca61f3ede09e86f45e764d4f3a7b414f83f4/src/game/hegemony/ask-general-show.ts) at game2c39ca61f3ede09e86f45e764d4f3a7b414f83f4, under [accepted B scope](../specs/hegemony-turn-unwind.md). This is M1.3.4b.1, a validated library slice, not complete M1.3.4 or a playable match. [Checkpoint](../reviews/2026-11-02-hegemony-m134b1-phase-bodies.md) owns executed evidence. Native [GameRule](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L159-L269) remains pinned to2.3.43-beta2.

## One Proceeding bridge

createPhaseBodyRule uses the existing priority-zero GameRule guard once, before null target. Its phase-proceeding operation reads current Room.playerPhases and delegates to round-start-phase, judge-phase, draw-phase, play-phase or discard-phase. Start/Finish/NotActive Proceeding remain empty; none is rejected. In the composed profile this rule replaces createDrawPhaseRule: registering both would duplicate rule handling. Existing profiles and standalone Draw behavior are unchanged.

Draw delegates to the real existing operation, including its own three free-chain boundaries. Remaining Play/Discard operations are required but absent in this slice: dispatch fails explicitly rather than treating those phases as complete. No old production/application/M0 profile is switched. These trusted operations are not new player-facing controls.

## RoundStart and accepted reveal

RoundStart computes change from current HaventShowGeneral>0 and Global_RoundCount==1, then invokes ask-general-show with GameRule_AskForGeneralShow. This request implements RoundStart's fixed head/deputy/both/refusable policy, not every parameter combination of native askForGeneralShow.

Follow [ServerPlayer](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/serverplayer.cpp#L2163-L2230) and [raw shown/all-shown gates](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L2096-L2114): all-shown returns false without a prompt. Otherwise capture canShow for each slot, offer each unshown allowed slot, offer both whenever both slots can show even if one is already shown, and offer cancel. An all-blocked unshown player still has the cancel choice. Predicates receive separate game snapshots and must return booleans. Only the responding actor receives the scheduler choices.

When change is enabled by the caller/config and head is unshown, inspect actual head names in the native current-first other-player list; matching living actual heads block conversion. Existing allPlayers retains its native null-current quirk. Missing required actual-head metadata fails. The package lordAvailable predicate resolves the candidate lord_ name's existence/banned package; capture that eligibility before the first answer. If head/both was selected and head remains unshown after ChoiceMade, ask yes/no for changetolord when eligible. A yes invokes the required changeToLord child before head reveal. The conversion body remains an explicit package adapter; the tests establish handoff/order, not complete lord transformation/HP/skill behavior.

Each choice emits actual ChoiceMade(skillChoice:reason:answer), preserving its locally accepted answer despite event consumption or rewrites, matching [Room::askForChoice](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1128-L1177). Raw malformed/unoffered replies are rejected by the web scheduler rather than invoking native transport-timeout fallback. No new service clock or bot timeout is introduced.

Reveal head before deputy using the real show-general operation and live shown flags at the native gates. Both calls set triggerEvent=true, sendLog=false and ignoreRule=true: [the native declaration](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/serverplayer.h#L238) makes that last value the default for the native three-argument calls. A late disableShow after an accepted choice therefore does not suppress the reveal. Do not add another head check after the nested lord choice. Finally send one reveal log from current displayed names and return true for a noncancel choice, even if a later show was a no-op. Cancellation returns false. Notification delivery, prompt text/layout, slot sharing and presentation remain explicit adapters; this does not enable a new UI control.

## Captured Judge list and live physical cards

Judge captures the target's delayed-zone physical IDs once, takes the last first and checks alive only at the native loop boundary. The normalized interface permits zero or one delayed zone per actor; multiple such zones are rejected rather than inventing their order. Current phase changes do not cancel an already executing Judge loop. Newly added delayed cards wait for a later invocation. A captured card relocated elsewhere is still processed from its current physical location by actual movement.

Resolve the current physical descriptor, move the captured ID openly to the configured table with NATURAL_MOVE provenance (actor and trick name in the skill field), then resolve the wrapper again and invoke real card-effect with null source and false multiple/nullified/disresponsive flags. Require exactly that physical material ID. If the Room boolean is false, invoke the required card-specific onNullified child for the same physical ID; then real free-chain before the next loop gate. A consumed PostCardEffected does not replace the Room caller's saved result. Death during movement still reaches the current effect/nullified tail, then stops at the next loop boundary.

Physical card descriptor discovery and card-specific onEffect/onNullified behavior remain package authorities. Tests use real Room effect/cancellation/movement/free-chain and explicit fixture package children; they do not port every delayed-trick judgment or Nullification package. Existing normalized mutable-pointer/resource boundaries remain in force.

## Persistence and integration

Private continuations retain captured choices/lord eligibility/accepted answers, list/index/current ID and stage. Advance before suspending children; JSON/cooperative resume cannot replay movement, choices, reveal or callbacks. New interruptions keep eager state; these native callers have no catch hook, so trusted unwind departs their frames without fabricating nullified effects or completing pending cards. Match v3 still owns reason classification, aggregate restore, root validation and filtered projection.

[38 tests](https://github.com/chuongphong12/Sanguosha-vn/blob/2c39ca61f3ede09e86f45e764d4f3a7b414f83f4/tests/hegemony/phase-bodies.test.ts) cover reveal/cancel/lord gates, saved choices versus live flags, native default regression, nested actor prompts with JSON/budgets and invalid/stale replies, captured/relocated/new delayed cards, live wrapper resolution, cancellation/terminal tail, death/phase mutation, three interruption reasons, Draw once and required missing children. They are not an all-package/all-seat/full-match/native-runtime certificate. Play/Discard bodies remain next, then M1.3.5 v3 handoff and minimal-profile full matches. All M0/content/bot/media/room/provider/load/UI/cutover gates remain open.

## Later Play slice

[M1.3.4b.2](play-phase.md) now supplies the required play-phase operation at its own inspected revision. The preceding missing-Play statements describe this page's original M1.3.4b.1 input; Discard and aggregate match-v3 remain pending. No old profile is switched.

## Later Discard slice

[M1.3.4b.3](discard-phase.md) supplies the required discard-phase and mandatory hand-discard operations at its own inspected revision. Earlier missing-Discard statements refer to their historical inputs. The complete composed match and match-v3 owner are still pending.
