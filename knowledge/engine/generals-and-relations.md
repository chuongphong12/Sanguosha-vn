# General lifecycle and private relationships

Baseline: game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Web owners: `src/game/hegemony/general.ts`, `general-identity.ts`, `general-relations.ts`. Public suites: `tests/hegemony/general.test.ts`, `general-relations.test.ts`, with careerist/death/winner compositions. Native references at the [selected pin](../rules/source-authority.md): `serverplayer.cpp` showGeneral/hideGeneral (1753–2031), `player.cpp` canShow/isLord/getLord/preshow/visibility/friendships (204–218/488/1795–1808/2099–2153/2209–2260), `room.cpp` general change/refilter (5945–5990), Room getLord (6644–6652).

## Three different identities

GeneralGame holds actual room-tag names (`generalNames`), displayed slot names (`displayedGenerals`) and normalized catalog facts (`generalCatalog`) alongside death/careerist identity authority. Actual and displayed are different: `anjiang` is a present hidden general, while empty deputy means no native general2. Catalog kingdom/double-kingdom/lord and actual/current lord facts must stay coherent; an actual hidden lord head still implies resolved Player::isLord.

These objects are private, not view DTOs or unrestricted reveal/hide commands. [Setup projection](setup-and-privacy.md) and battle authority do not synchronize automatically. Production adapters must update all corresponding facts at their native lifecycle boundary before package consumers can rely on them.

## Show operation

`show-general` captures actual names and first-time hasShownOneGeneral, including retained scenario_role_shown. It skips empty actual names and gates by displayed `anjiang`, not merely shown boolean. All four input booleans default true. canShow is consulted only when ignoreRule=false, with an isolated snapshot.

Order: preshow adapter → shown/displayed commit → change adapter with initial hand/equip refilter → skills/marks/skin adapter → current identity decision → scenario_role_shown=true → log/rolebox adapter → GeneralShown(head boolean), or DFDebut(null) when triggerEvent=false → final current hand/equip refilter. sendLog=false independently suppresses reveal log. Consuming or rewriting event data does not cancel the void-method tail. Cursors persist captured name, flags and first-show state through pauses.

Identity uses current native facts: first head reveal preserves current kingdom; a displayed careerist head forces careerist kingdom while preserving careerist-prefixed role. First deputy reveal falls back only from empty kingdom. A double-kingdom deputy reads displayed head kingdom, which can be anjiang/god, not actual hidden head. Native mapping is wei→lord, shu→loyalist, wu→rebel, qun→renegade, god→careerist; other strings pass through. Those internal role strings do not introduce Standard 2013 win conditions.

GlobalQuanjiaShow bypasses majority/dead-lord conversion. Count current-first other registered seats including dead and stop at an exposed same-seeming-kingdom lord; majority is strictly above half original registration. Player::getLord(true) prefers actual-head lord self, otherwise exposed same-current-kingdom lord among registration siblings then self. A revealed head current-isLord converts matching exact plain careerists, including dead; recruited groups remain distinct.

## Hide operation

`hide-general` gates current displayed name and ignores actual-name tags. It sends disabled preshow with temporary hiding flag, commits shown=false, removes hiding without restoring an earlier value, changes display to anjiang and delegates change/disconnect effects. Reread opposite shown boolean afterward; if false, store kingdom god/role careerist. Retained scenario_role_shown does not reset. Then conceal log → GeneralHidden(head boolean) → final refilter → enabled preshow/notify. Nested reveal may therefore retain an already-committed identity reset. Dead targets are not skipped.

Initial and final refilters are separate adapter calls over current resources. Disable-show, per-skill preshow, gender/Bianhua, sharing/disconnect/Duanchang/limited marks, skins and actual filters/notifications remain concrete adapters. Preshow bundles skill-map changes and notification; its internal native atomic flag/skill-map steps are not separately modeled. Interruptions preserve prior commits without manufactured final callbacks or unwind.

## Visibility, seeming kingdom and friendship

`hasShownGeneral` is true for retained scenarioRoleShown, shown head, or shown deputy with nonempty displayed name. Scenario/head short-circuit deputy lookup. Empty deputy is absent; anjiang is present. The property table and consumed displayed metadata validate at their boundaries.

`seemingKingdom` is private: hidden returns empty; exact careerist or careerist_ group returns role; otherwise current kingdom. `areGeneralFriends` first accepts self, otherwise requires both authoritative shown identities. Exact plain careerists are never mutual friends. Any careerist-prefixed role compares exact role strings; ordinary roles compare current kingdom. The broader careerist prefix in friendship versus narrower careerist_ in seeming kingdom is intentional; do not unify them by cleanup.

`willBeGeneralFriends` is directional prediction: accept self/current friendship; reject hidden target or already-shown nonfriend; read hidden actor's actual head kingdom. Count raw siblings including deceased. A living resolved Player::isLord provides exception; otherwise count shown non-plain-careerist matching seeming kingdom, starting at one for actor, and reject strictly above half original registration. Finally compare target seeming kingdom. It differs from reveal assignment's dead-lord rule and is not a public-knowledge UI/AI query.

`generalRoomLord` implements Room::getLord: first displayed-head lord in raw registration with current kingdom and requested dead inclusion. It does not return actual-hidden lord self merely because Player::getLord does. Keep Room lookup, Player lookup and resolved isLord distinct.

Death winner/reward, post-burial lord conversion and careerist seeming identity consume pure copied-state hasShown callbacks, bound to this authority in general fixtures. A recruited player may keep both slots hidden while scenario identity enables ally punishment and group victory. Slot-specific forced reveal remains slot-specific. These corrections resolve the earlier slot-only authority gap for the implemented private consumers; they do not supply production synchronization, public projection, executable package content, remove/transform-general or transport.
