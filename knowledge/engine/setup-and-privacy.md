# Paired setup and player privacy

Baseline: game `4b19fddcb6547066de0db0ae078c0db7642877ba`; native authority is [pinned separately](../rules/source-authority.md). Web contracts live in `src/game/hegemony/index.ts`, `types.ts` and `identity.ts`; public cases are `tests/hegemony/setup.test.ts` and `identity.test.ts`.

## Pair selection

`createHegemonySetup` clones the supplied normalized catalog and player offers. It validates unique general IDs, nonempty/unique kingdoms, positive integer head/deputy HP contributions and valid dealt offers. The adapter supplies definitions, bans and dealing policy; the setup module does not translate or enable the complete native catalog.

`selectGeneralPair` validates actor, payload, offer membership, distinct head/deputy, bans and already-selected generals before mutation. Pair compatibility is directional: a careerist cannot be deputy; a careerist head uses the deputy's kingdoms; an ordinary pair uses their intersection. An ambiguous intersection needs an explicit valid kingdom. Max HP is `floor((head.headMaxHp + deputy.deputyMaxHp) / 2)` using already-adjusted slot contributions; those inputs are not the two printed HP totals.

Successful selection sets two private slots, initial kingdom and HP atomically. All selected players produce status `ready`; this is the end of paired setup, not a battle start. Timeout/default pair choice, card dealing, battle authority creation and routing are adapters still to be supplied.

Native evidence: `src/core/general.cpp` `compareKingdomsWith` (line 136), `src/server/serverplayer.cpp` paired max HP (line 1324), and `src/server/room.cpp` pair/kingdom/hidden setup (line 3694) at the selected pin.

## Projection is a security boundary

`projectHegemonyState(state, viewer)` returns copied player-specific state. Only the owner gets hidden slot IDs, candidates and an `initialKingdom` property. Other players get a slot ID only when that slot is shown; hidden public kingdom/alliance are null. Spectators and unknown viewers receive the same redaction as nonowners. The general catalog and banned pairs are excluded. Returned arrays and alliance objects must not alias authoritative storage. JSON reload preserves selected/private setup state.

The UI must consume this filtered view. Hidden names must not enter thumbnails, asset URLs, hover text, accessibility labels, effects or DOM metadata. Never pass raw scheduler frames, operation children, physical ledgers or private battle identity objects to the client merely because they are serializable. A battle view and requester-only notification channel still need their own concrete integration.

## Setup identity versus battle identity

The setup-oriented `revealHegemonyGeneral`, `concealHegemonyGeneral`, `areHegemonyFriends` and `willBeHegemonyFriend` are authoritative domain APIs, not arbitrary player moves. They preserve owner initial kingdom and copied projections, handle first-reveal majority/dead-lord decisions, plain versus grouped careerists, and directional hidden-friend prediction. Majority counts use original registration size and include shown deceased faction members. Only an exposed lord head supplies the reveal exception; an exposed lord can restore matching plain careerists, while recruited groups stay separate.

Concealing the last shown slot stores native kingdom `god`; later reveal retains this nonempty value rather than silently restoring `initialKingdom`. Prediction reads actual head/lord authority and can differ from the eventual alliance. It is not a public-knowledge bot API.

Native evidence: `src/server/serverplayer.cpp` `showGeneral`/`hideGeneral` (1753/1939); `src/core/player.cpp` `getSeemingKingdom`, `getLord`, `isFriendWith`, `willBeFriendWith` (922/1795/2209/2231).

The later [general lifecycle](generals-and-relations.md) implements scheduler-based show/hide, retained scenario visibility, displayed-name distinctions and private native relations. It is a separate, richer authority model. Do not substitute the simpler setup helpers for battle `hasShownGeneral`/relations, and do not assume setup data and battle identity facts synchronize themselves. Production must build that bridge explicitly.
