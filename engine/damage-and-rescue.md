# Damage, dying, rescue and recovery

Baseline: game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Web owners: `src/game/hegemony/damage.ts`, `damage-rule.ts`, `dying.ts`, `dying-rule.ts`, `peach-response.ts`, `recovery.ts`. Public coverage: `tests/hegemony/damage.test.ts` and `dying.test.ts`, including real movement/common-card compositions with fixture response/effect adapters. Native references are at the [selected pin](../rules/source-authority.md): `room.cpp` 244–305/2003–2068/4389–4569, `gamerule.cpp` 653–792/859–870, `structs.h` Damage/Dying/Recover, and `player.cpp` setHp/canRecover/Qinggang handling.

## Signed damage and local versus shared packets

`Damage` carries nullable source/recipient/card, signed integer amount, normal/fire/thunder nature, chain/transfer/by_user/prevented booleans, reason/transfer_reason and flags. SlashHit priority-zero builds amount from `addcardinality + drank + 1` and each matching AddDamage_List entry; duplicates count. Every arithmetic step must remain a representable signed integer, not just the final total. Missing cardinality/list defaults zero/empty. This normalized validation does not emulate QVariant coercion or native undefined arithmetic.

Room damage skips initially null/dead/removed recipients and nulls an initially dead source. ConfirmDamage runs only for nonchain/nontransfer damage; its consumption is ignored. Room refreshes its local snapshot after ConfirmDamage, then emits Predamage, DamageForseen, source DamageCaused and DamageInflicted. It refreshes local again before Inflicted and clears the local recipient's stale TransferDamage tag first. Event data remains shared, while most subsequent dispatch/armor cleanup uses the captured local source/recipient.

Predamage consumption cleans armor and returns without completion. Later prevention cleans armor, optionally recursively delegates the local recipient's new transfer damage, marks latest shared damage prevented, sets SkipGameRule and emits DamageComplete. The transfer child is void; it cannot replace parent data. Successful Inflicted pushes the **pre-Inflicted local snapshot** to damageStack while CurrentDamageStruct receives post-Inflicted shared data. PreDamageDone and DamageDone consumption is ignored by Room, though earlier consumption can prevent the priority-zero DamageDone rule itself. Damage/Damaged use captured local recipients plus current Global_DFDebut flags. DamageComplete uses latest shared recipient.

Normal completion pops the stack and restores the **oldest** remaining snapshot, native `first()`, not the immediate parent's latest packet. Interrupted frames preserve eager HP/tags/stack without native catch cleanup.

## HP and chain rules

Priority-zero DamageDone nulls a newly dead source in shared data and subtracts signed amount from the **event recipient's** HP even when payload.to differs. HP is not clamped; zero/negative damage still emits HpChanged(null). After that child, current chained elemental recipients unchain and emit ChainStateChanged. Nonchain elemental damage increments is_chained; PostHpReduced receives shared damage. PostHpReduced rewrites propagate; HP/chain notification rewrites do not replace damage.

DamageComplete captures its latest local packet, skips prevented packets, decrements positive is_chained for elemental nonchain damage, snapshots current-first living seats and rechecks current chained state before each recursive child. Chain copies clear transfer, transfer_reason and damage flags, retaining other packet and card data. Child returns/rewrites do not replace that local packet. After fanout, a fresh getAllPlayers snapshot controls Global_DFDebut clearing/events. A null current player preserves raw registration including dead seats for getAllPlayers; elemental fanout requires known nonnull current.

The damage/dying/death/general rule factories that use the shared `damageRule` helper consume one-shot SkipGameRule before null-target handling. This is not proof that every older rule factory has been migrated to the same entry guard.

## Entering dying

`enter-dying` captures original target separately from mutable Dying.who. It eagerly sets Global_Dying and appends original target to CurrentDying, then dispatches Dying over a fixed seat snapshot. Consumption stops that loop. Original alive/HP determines whether rescue begins, using a fresh saver snapshot.

Before each saver, recheck original target HP/alive, save saver's currentdying string, set original name, emit AskForPeaches and restore that saved string. AskForPeaches consumption does not abort Room's saver loop. AskForPeachesDone always follows an entered rescue branch, even if a saver recovered/killed the original. Then clear original flag, remove one original name from latest CurrentDying and emit QuitDying even for a dead original. Death during the earlier Dying loop leaves Global_Dying as native does. Nested properties/list changes follow these save/remove-one rules rather than broad state restoration.

PostHpReduced skips positive event-recipient HP before parsing reason. A JSON record with an own `damage` or `nature` field is normalized Damage and must validate; unrelated values, including recovery objects, produce null dying damage. Arbitrary JSON objects are not guessed into QVariant metatypes. Child dying rewrites do not replace parent damage data.

## Rescue asks and one Peach

AskForPeaches captures latest Dying.who/damage and requires known nonnull current. An adapter supplies shown active Wansha, Peach prohibition and lock predicates. Wansha/CannotHelp are tested once; each loop tests current prohibition, lock, then dying-player alive. A nonnull response retries using current HP; null ends that saver. No saver-alive guard is invented. AskForPeachesDone removes only the first current CannotHelp in registration order; alive/nonpositive event recipient delegates kill with latest dying damage. Healthy/dead recipients bypass that parse.

`ask-single-peach` sets response-use before **every** request, including validation-null retry. External input owns human/AI parsing and needed signed `1 - HP` count. MethodUse limitation precedes validateInResponse; null validation retries original saver/who. Refusal/limitation emits ChoiceMade with empty card suffix. Accepted validation emits current needed count/card string, marks validated reference UsedBySecondWay, delegates card use with addHistory=false, invokes validateAfter on the original parsed reference and returns the validated card. AskForPeaches does not use it again. ChoiceMade cannot redirect captured identities.

## Recovery is its own native path

`recover` checks alive/wounded/CannotRecover/removed once at entry. Signed recovery permits nullable who/card. PreHpRecover consumption aborts without parsing its rewrite. Otherwise add latest recovery to current HP with signed overflow validation, cap at current maxHp, emit HpChanged(null) even for zero and HpRecover with post-Pre data. No entry eligibility recheck follows a late death/removal/full-HP change. HPChanged rewrites do not replace recovery. Negative recovery can lower HP without PostHpReduced; do not route it through damage by analogy.

Raw HP metadata, CurrentDying, damage stacks and private response properties are not player projections. Concrete Wansha/Peach legality, package conversion/discovery, generic askForCard, actual draw/network/AI input, native pointers/subcards, notifications and exception unwind remain adapters. [Death/burial](death-and-careerist.md) is implemented as a later normalized seam; successful rescue compositions explicitly keep that real death registry present and show it is bypassed. These fixtures do not establish playable production Quốc Chiến or native runtime differential parity.
