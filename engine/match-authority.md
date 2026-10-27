# Internal match authority and setup handoff

Inspected game [`1e705eff4ca1252f0cf771615d5847820a9c8fd3`](https://github.com/chuongphong12/Sanguosha-vn/commit/1e705eff4ca1252f0cf771615d5847820a9c8fd3), native ce4e62b/2.3.43-beta2. Scope: approved [internal M1.1](../specs/hegemony-match-authority.md). [Execution/review evidence](../reviews/2026-10-27-hegemony-m1-match-authority.md) is separate from this contract.

## One authority, small application interface

[createHegemonyMatch](https://github.com/chuongphong12/Sanguosha-vn/blob/1e705eff4ca1252f0cf771615d5847820a9c8fd3/src/game/hegemony/match.ts) returns:

| Method | Meaning |
| --- | --- |
| create | Validate supplied content/deck/seat configuration and create paired setup |
| apply | Apply an actor-bound pair choice or current prompt answer to a cloned candidate; return null on ordinary rejection |
| view | Project a filtered actor/spectator view; never return the private aggregate |
| restore | Load JSON with matching schema/rules/content/registry/startup settings and Room/scheduler/card-inventory checks |

Before handoff, the aggregate has phase setup, the setup state and a server-supplied ordered deck/RNG state. The last valid pair selection creates one Room and scheduler, dispatches global GameStart and removes setup/deck from the root. After handoff, the normalized Room maps are the gameplay authority. An extra restored setup/deck alongside Room is rejected. A callback registry and executable functions are not persisted.

Schema is hegemony-match-v1 with rules hegemony-ce4e62b, explicit content/registry versions and persisted image/viewDeputy/mode/luckLimit settings. Current mode is the normalized ordinary hegemony branch. Restore under changed startup settings fails even if the registry version is unchanged. This is not a migration of M0 response-v4/clock-v3 or legacy saves.

## Native initial facts

The [Room constructor/mapping](https://github.com/chuongphong12/Sanguosha-vn/blob/1e705eff4ca1252f0cf771615d5847820a9c8fd3/src/game/hegemony/match-room.ts) retains seat order, life, shared HP/maxHP, actual general names, initial private kingdom/role, card zones/resources/history and portable pile RNG. Displayed slots start at anjiang while actual names remain private. Room becomes current at the first registered seat, with phases not-active; this does not run a turn.

- [Native chooseGenerals](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L3694-L3795) distinguishes actual names, displayed anjiang and owner-only kingdom/role. [startGame](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4724-L4779) supplies shared HP, HalfMaxHpLeft, HaventShowGeneral/HaventShowGeneral2 and companion initialization.
- [General::isCompanionWith](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/general.cpp#L375-L382) includes both explicit companion directions and the implicit matching-kingdom lord relation. CompanionEffect cannot rely only on a literal pair list.
- [Player::isLord](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L488-L490) calls [getLord](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L1795-L1808): an actual lord head is its own lord even while hidden. Initial lord/actualHeadLord are true for that head; generalLord remains false for displayed anjiang. The [placeholder](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L838-L840) is internal, absent from selectable module content.

The initial ordered deck and physical metadata are supplied by a server content adapter. This module does not claim native initial shuffle/manifest parity. Subsequent configured luck uses the actual normalized movement/shuffle/RNG operations.

## Startup, projection and continuation

The module registers actual global GameStart, drawCards/getNCards/drawCard/swap-pile, movement and game-over operations. Supplied skill/package handlers may yield nested prompts. A configured luck flow requires its operation; trusted collection/transfer/package hooks remain explicit. The new module does not call the independent M0 socket/store coordinator.

View stage is derived: setup; starting while frames remain; prepared when global startup has drained; interrupted for a retained nonterminal interruption; finished when Room has a result. **Prepared does not mean a playable match or complete RoomThread startup.** Initial winner checking and per-player startup from [RoomThread::run/constructTriggerTable](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L84-L220), full phases/turns and native interruption cleanup remain pending.

View exposes public HP/life/hand counts, shown general/kingdom facts, own actual names/hand/marks and owner-only opaque prompt choices. [Startup notice allowlisting](https://github.com/chuongphong12/Sanguosha-vn/blob/1e705eff4ca1252f0cf771615d5847820a9c8fd3/src/game/hegemony/match-notice.ts) rebuilds declared fields before recording/projection. Known-general/view-generals are viewer-private; set-mark is target-private. Recording a presentation request is not real UI animation or timed delay execution.

Invalid/repeated pair selection, wrong/stale/unoffered prompt replies and incompatible versions/settings do not advance the current aggregate. JSON restores pending scheduler state without invoking GameStart again. Restore is version/composition/inventory validation, not a network authentication or durable-storage implementation. Registry/configuration semantics must be versioned by their owner; physical identities remain distinct from catalogue indexes.

Production [server](https://github.com/chuongphong12/Sanguosha-vn/blob/1e705eff4ca1252f0cf771615d5847820a9c8fd3/server/server.ts), [MatchClient](https://github.com/chuongphong12/Sanguosha-vn/blob/1e705eff4ca1252f0cf771615d5847820a9c8fd3/src/client/MatchClient.ts) and [TqsGame](https://github.com/chuongphong12/Sanguosha-vn/blob/1e705eff4ca1252f0cf771615d5847820a9c8fd3/src/game/TqsGame.ts) are unchanged. Complete content, legal gameplay commands, private-view UI/session integration, competitive bots, art/audio, hosted recovery/load and cutover remain [release gates](../plans/hegemony-release.md).
