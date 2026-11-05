# Death, rewards, victory and careerists

Baseline: game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Owning modules under `src/game/hegemony/` are `death.ts`, `burial.ts`, `death-rule.ts`, `victory.ts`, `careerist.ts`, `careerist-choice.ts` and `fill-hand.ts`. Public cases are `tests/hegemony/death.test.ts`, `careerist.test.ts` and relation compositions in `general-relations.test.ts`. Native source: [selected pin](../rules/source-authority.md), `room.cpp` killPlayer/gameOver/doCareeristRule (364–607/8340–8403), `gamerule.cpp` 873–932/1036–1159, `serverplayer.cpp` bury/throwAllCards/fillHandCards (136–223).

## Authoritative identity and ordering

DeathGame adds a native living-player list separate from fixed seatOrder, mutable seat numbers, acquired head/deputy skill sets, history, private identity facts and optional gameResult. Head/deputy names, actual head kingdom, current kingdom/role and lord variants are private authority. Later [general relation getters](generals-and-relations.md) supply concrete hasShown/friendship/lord semantics; narrow fixture facts are not a complete production authority bridge.

`deathOrder` is current-first including dead when current is known, raw registration when null. Reward/winner code must preserve each native snapshot rather than replace all loops with one “living players” shortcut.

## Kill and burial sequence

`kill-player` captures getAllPlayers before marking original victim dead, adjusts seats after its living-list index and removes one original victim. A repeated call for an absent/dead victim follows native index behavior and decrements the whole living list; signed validation applies. BeforeGameOverJudge → original HP=0/HpChanged(null) → GameOverJudge precedes Death. Ignored consumption and Death.who rewrites do not redirect original HP or victim identity.

Death visits the original snapshot, using current alive-or-original-victim eligibility. Clear acquired head/deputy skill sets only, then BuryVictim at original victim; innate general skills are not detached. DeathFinished reuses the same snapshot/eligibility. Nested death/revival does not replace outer snapshots or skip ordinary burial.

`bury` clears flags and history except Analeptic, delegates throw-all-cards, clears marks **after** that child, delegates private-pile clearing, captures both actual general names and releases each unless containing `sujiang`, then clears limitations. Flags added during throwing persist. Both names are captured before release callbacks, not refreshed individually. Native physical wrappers, private/general pile storage, used-general catalog and limitations remain registered adapters; fixtures use real movement for their physical part.

## BuryVictim and reward/punishment

BuryVictim captures latest DeathStruct before burial, then reads current SkipNormalDeathProcess. True skips killer marks/reward/lord conversion only after burial already ran. Captured killer gets signed multi_kill_count increment even when hidden/dead. Missing count defaults zero; supplied null/malformed/overflow rejects. Current NoRewardPunishFlag suppresses reward and is removed; otherwise delegate reward.

Reward skips dead or wholly hidden killers, using authoritative hasShown. Current friendship makes the killer discard all hand/equipment. Enemy reward is three only for exact plain role `careerist`; other roles draw one plus victim friends in native getOtherPlayers(victim). With known current, living recipients are captured. With null current, raw registration includes dead and a dead except is not removed, so even victim itself can contribute. Grouped careerists do not automatically take the exact plain-careerist branch.

Post-reward lord conversion requires current displayed head lord and original recipient equal captured Death.who. Capture include-dead current order, exclude original, then inspect each current kingdom/role/visibility. Shown matching plain identities become careerist; hidden matches receive private notification without authoritative role mutation. Existing careerist-prefixed roles stay separate. Public notification must not disclose hidden identities.

## Winner and terminal decisions

BeforeGameOverJudge reveals original event recipient head then deputy, rechecking each visibility and using trigger_event=false/sendLog=false. GetWinner sorts a living-list snapshot by full current-first registration and captures its first survivor. One survivor reveals hidden slots and collects current friends across raw registration, including dead allies.

For multiple survivors, pair compatibility checks shown friendship, hidden-to-shown directional prediction, or actual head kingdom equality when both hidden. It then derives current live lord kingdoms, rejects a hidden registered player when any live lord exists, exempts lord kingdoms and scans faction counts. A dead lord adds ten per member. A hidden living majority is checked at that member's traversal position; exactly half is accepted. Do not replace this order-dependent behavior with a final faction-total formula.

Compatible multiple survivors invoke careerist-rule. True postpones victory. False reveals captured survivors without a new alive check and collects friends of captured first player. GameOverJudge invokes terminal for any nonnull string, including empty. `game-over` writes gameResult and interrupts game-over, so real terminal processing stops killPlayer **before Death/detachment/burial**. A fake normally returning terminal fixture does not represent that stopping behavior.

## Careerist forced reveal and recruitment

`careerist-rule` captures current-first living membership once; later death does not remove members. Empty returns false. Shown head skips before consulting remaining visibility. Exact seeming kingdom careerist or noncareerist actual head skips; retained scenario visibility is part of seeming identity. A qualifying hidden actual-careerist head eagerly sets result true and GlobalCareeristShow=true, delegates show head with trigger_event=false/sendLog=true/ignore_rule=true, clears tag on normal return and names group `careerist_<current actual head>`. Interrupted show retains tag true and skips post-show group assignment.

Only an original snapshot with more than two enables recruitment. Current careerist-prefixed role or Player::isLord skips a candidate, including coherent hidden actual-head lord state. Actual careerist head permits only no; otherwise offer no then yes. Choice skill is GameRule:CareeristAdd, prompt `@careerist-add:<leader>`, full display choices yes+no. Nonstring/timeout/invalid raw result falls back no. Native percent-prefix validation preserves full answer: `yes%metadata` is valid choice input but fails the caller's exact `yes` test. Emit ChoiceMade before applying captured reply; consumption/rewrites do not replace it, and later eligibility is not rechecked.

Exact yes sets private scenario_role_shown=true, writes captured group and stops that leader's recruitment loop. Every other reply fills **decliner's** hand to four then invokes real recover1; forced-no candidates also get these bonuses. Leader/acceptor do not get the refusal bonus. `fill-hand` draws only current positive shortfall for an alive target, preserving excess; physical draw/RNG/recycling remain external. Recovery independently checks current eligibility. A forced reveal keeps result true even if leader later dies or nobody accepts.

Public compositions include failed rescue through actual death/burial/reward movement, successful rescue with actual death registered but bypassed, concrete show/hide/relationship use, recruitment pauses and later winner completion. All retain scheduler exact-once/eager interruption rules. Concrete catalog/pile/limitation/draw/choice/transport adapters, general removal/transformation, offline surrender/statistics/next-mode policy, exception unwind and production cutover remain incomplete. No native runtime differential or complete production E2E result is claimed.
