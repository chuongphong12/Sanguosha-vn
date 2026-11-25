# Opt-in general reveal owner recovery

M1.3.5c.2l at game [4b9a78541c82f36a1348a962fb1567800a708db5](https://github.com/chuongphong12/Sanguosha-vn/blob/4b9a78541c82f36a1348a962fb1567800a708db5/src/game/hegemony/general.ts), base 9f376b752d95a5e4c4d7fba12747a153d601cdf5, follows [approved C2](../specs/hegemony-match-v3-save.md). Native authority remains [ServerPlayer::showGeneral](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/serverplayer.cpp#L1753) at2.3.43-beta2. See [question owner](ask-general-show-save.md), [general lifecycle](generals-and-relations.md) and [checkpoint](../reviews/2026-11-25-hegemony-m135c2l-show-general-save.md).

## Profile contract

GeneralRules.saveShow opts only show-general into save/result validation. It requires a pure validateChild(reveal,operation) callback, copied at factory construction. The callback receives detached copies of the validated ShowGeneralContinuation and pending mapped operation. It must enforce the trusted profile's preshow/change/skills/notify/filter mapping semantics without executing live adapters. Profiles must version these semantics and catalogue identity. Hide-general has no new hooks; old profiles keep their original cursor and runtime with no automatic migration.

The unchanged eight-field continuation contains target/head/triggerEvent/sendLog/ignoreRule/name/first/stage. Request fields bind to normalized immutable input, including existing default-true flags. name must resolve in the profile catalogue and first must be boolean. Neither is recomputed from current actual/displayed names or shown flags: nested children may already have changed them. This codec does not authenticate historical Room state or certify a profile catalogue by itself; application Room/configuration validation remains required.

| Persisted stage | Pending boundary |
| --- | --- |
| preshown | Mapped preshow(target,head,true), before identity/display changes |
| changed | Mapped change(target,head,name), after display/shown/lord property changes |
| skills | Mapped skills(target,head,true) |
| notified | Mapped notify(target,head,true,sendLog), after faction/role/scenario changes |
| event | GeneralShown or DFDebut according to triggerEvent |
| filtered | Mapped filter(target) |

No finished stage persists for show-general. Owned prompts/answers/cleanup are rejected. Initial null continuations cannot have child work. Operation stages require queued or retained mapped children; event stage requires matching event name/recipient. Trigger payload rewrites/consumption remain allowed. Missing children are accepted only during actual scheduler abandonment. Owner results must be null and have valid immutable input. Reads do not invoke canShow or live mappings and do not run the lifecycle.

## Evidence and remaining work

[56 new tests](https://github.com/chuongphong12/Sanguosha-vn/blob/4b9a78541c82f36a1348a962fb1567800a708db5/tests/hegemony/show-general-save.test.ts) use actual show-general identity lifecycle and scheduler/save decoder, JSON read/resume at each queued/retained boundary, default/head/deputy flags, DFDebut/no-log, captured name/first after live state changes, event rewriting/consumption, malformed cursors/children/results/owned work, nested responder rejection, early exits and all three interruption reasons across six child boundaries. Paired legacy/new execution compares game and scheduler state at each yield. Actual Proceeding → RoundStart → ask-general-show → ChoiceMade → both reveal owners compose in the new test.

Package/presentation preshow/change/skills/notify/filter bodies/codecs and the event observer remain explicit fixtures. Thus skill sharing/marks/Duanchang/skin/refilter effects are not certified by this slice. Actual mapped children, lord conversion, notification owner and hide-general recovery remain separate. Existing C2k fixture-based evidence remains historical to its pinned revision.

Baseline204/3; focused260/4; full3224/117/typecheck/build passed; lint0 errors/42 prior warnings. Exact source tree e4168748a98afa34ee846038b8afb2dabf33b1bc passed separate Standards0/Spec0 reviews; independent Spec reran260/4 and Standards56/1. Runtime AST proof preserves runShow/runHide/input/displayed/hide factory and existing run/validate callbacks; complete emitted scheduler is unchanged. Graph UNKNOWN remains unresolved and is supplemented by direct source/import/test evidence, not treated as an all-clear.

Remaining startup/battle/phase codecs, aggregate Room/configuration/root decoding, public match v3, full native matches2–10 and release gates remain open. Keep one shared Proceeding bridge. Group1 is in progress; PR33 stays draft and production remains unchanged.
