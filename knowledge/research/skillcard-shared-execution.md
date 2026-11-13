# SkillCard shared execution: native contract for Part 4z

Status: source investigation for the next checkpoint after the isolated 4y
onUse envelope. This document defines native behavior and proposed verification;
it does not certify that the web implementation or production supports it.

Date: 2026-10-16. Authority: QSanguosha-QuocChien 2.3.43-beta2, commit
`ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. The native checkout matched that
commit and had an empty `git status --short` before and after this investigation.
The preceding [4y investigation](skillcard-integration.md) retains admission,
response, cost and original/local/event snapshot distinctions.

## Finding and smallest truthful scope

The native GameRule CardUsed, CardFinished, inherited Card::use and
Room::cardEffect paths accept Card generally. SkillCard changes the cost and
can replace virtual use/onEffect behavior; it does not skip the generic target
pipeline merely because its type is skill. The next checkpoint can widen the
shared execution payload/readers/resources to include SkillCard, connect the
existing onUse operation to real GameRule and reward-token use operations, and
validate those combinations through dispatch/resume. This is distinct from
admitting a legal play/response command or enabling a production package.

Sources: [SkillCard delegation](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L1123-L1137),
[GameRule CardUsed/Finished](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L537-L627),
[default Card::use](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L897-L925).

## Graph evidence and limitations

Graph-first GitNexus queries for SkillCard, CardUsed and cardEffect located
definitions in card.cpp, structs.h and room.h. No process was returned; this
is not evidence that no execution path exists. File-qualified cardEffect
context was ambiguous between the four-argument and CardEffectStruct overloads;
the exact one-argument uid resolved room.cpp:4445–4464 and reported only the
other overload as an incoming call. Card::use's context explicitly reports a
**lower bound**, with one receiver-typing use call site omitted and no indexed
incoming calls. Its visible outgoing methods omit the source's room->cardEffect
call. Direct reads of the owning pinned bodies establish the dispatch facts.

GitNexus status reports matching native HEAD, matching analyzer identity and
all 871 covered files up to date. Initial CLI syntax attempts failed; the
successful positional-symbol queries and exact-uid context above supplied
the evidence. No native source, graph configuration or game implementation
was changed by this investigation. The parent checkpoint must separately
refresh web impact analysis before editing shared readers or existing methods.

## GameRule CardUsed snapshots and dispatch

There is no TypeSkill exclusion in the CardUsed case:

1. Read local `card_use` from shared event data. Invoke that card's pre-action
   when it has one; initialize local targets from the local use.
2. If the initial local source exists and targets are nonempty, dispatch
   TargetChoosing to that source. Reload local use and targets. Iterate a
   copy of those targets; before each TargetConfirming, check membership in
   the updated target list. Reload that list after each event and stop when
   it becomes empty. This is not a fresh action-order sort after each event.
3. Reload local use again. If this card is a Slash, back up its current Jink
   list, then initialize one Jink per current target under the source/card
   string key. SkillCard does not inherit this behavior merely by entering
   the generic path.
4. With a source and targets, dispatch TargetRecord. TargetChosen and
   TargetConfirmed loop lengths and confirmed recipients come from the local
   snapshot, while each iteration obtains current shared data and assigns its
   index. Rewrites do not silently change these local loop bounds.
5. Reload local use after these target events. Add `_ALL_TARGETS` for
   GlobalCardUseNullified and `_ALL_PLAYERS` for GlobalCardUseDisresponsive.
   Store nullification on the room and disresponsive data on the current card;
   write this use back into shared data. Call the **current card's virtual use**,
   including when its target list is empty.
6. Restore the saved Jink list only when that backup is nonempty. The ordinary
   CardFinished path subsequently removes the final Slash's Jink key. The
   TurnBroken/StageChange catch removes the local card/source Jink key and
   rethrows; it does not turn interruption into normal completion.

The event calls in this body do not branch on their boolean result. Event
consumption can stop later subscribers of that event, but cannot be invented
as an outer CardUsed cancellation return. A subscriber consuming CardUsed
before GameRule can prevent GameRule from being reached, a different boundary.

Sources: [CardUsed complete body](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L537-L613),
[trigger consumption](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L616-L665).

### Rewritten type and identity

An entry SkillCard may be replaced by a basic/trick/Slash card in shared event
data, or an ordinary card by a SkillCard. Each explicit reload above determines
which type is tested and which virtual use executes. Do not lock the whole
operation to its initial category. Conversely, do not broaden class-specific
Slash, non-delayed-trick or response protocol branches into all-card behavior.
Slash bookkeeping selected before target-record events can differ from final
virtual dispatch selected after them; tests should cover rewrites at both
boundaries rather than only before CardUsed begins.

CardFinished reloads its use independently, clears flags on **that card**, removes
HegNullificationTargets only for a non-delayed trick, notifies alive players
that nullification asking ended, and removes a Jink key only for a Slash.
`clearCardFlag(const Card*)` clears the supplied object's flags and additionally
the effective physical card's flags when nonvirtual. It does not discard physical
materials or erase every card tag. The shared nullification/disresponsive tags
must not acquire an invented universal restore/clear lifecycle. Original onUse
material cleanup remains a separate stage on its original identity.

Sources: [CardFinished](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L615-L627),
[clearCardFlag overloads](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2466-L2485),
[flags versus tags](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L1045-L1062),
[original onUse cleanup](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L873-L895).

## Inherited use and effects

SkillCard does not override Card::use; it inherits the target walk unless its
package overrides use. Default use snapshots room nullification and card-local
disresponsive lists before iteration. For each target it constructs an effect
with this card identity, source, target, multiple, nullified and disresponsive.
It sets a room `targets` tag keyed by card serialization to the remaining
non-nullified targets, invokes cardEffect and finally removes that tag. A
targetless default use invokes no effect; a targetless override still executes.
The multiple field comment in structs.h says it does not make sense for
SkillCard, but the actual inherited body still assigns `targets.length() > 1`.

Room::cardEffect creates shared effect data. If the **original effect target**
is alive or the original card is a Slash, it dispatches CardEffect and then
CardEffected to that original target. CardEffect's result is ignored.
CardEffected's result determines the return: unconsumed returns true; consumed
returns false, possibly clearing Global_NonSkillNullify on the original target.
The local variable is named `cancel`, but its boolean must not be interpreted
as true meaning cancelled. PostCardEffected always runs, even for a dead
non-Slash target that skipped the first two events, and receives shared data.

GameRule CardEffected reads its own current effect snapshot:

- A non-Slash effect marked nullified logs nullification and consumes the event.
  This includes SkillCard.
- Only TypeTrick enters Room::isCanceled and its Nullification machinery.
  Default SkillCard must not open a Nullification prompt merely because its
  inherited effect uses the common engine.
- Otherwise dispatch CardEffectConfirmed on a separate QVariant made from that
  local effect. This caller does **not** reload the effect from that QVariant or
  branch on its boolean. Finally invoke the local card's onEffect if the local
  target is alive or that local card is a Slash. Callback mutations to game
  state can change the alive check; replacing confirmed-event payload does not
  replace the local effect used by onEffect.

Sources: [default use/onEffect/isCancelable](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L897-L934),
[effect struct](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L64-L76),
[Room::cardEffect](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4434-L4464),
[GameRule CardEffected](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L794-L815),
[cancellation ownership](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1195-L1230).

## Reward overrides are virtual use, not default per-target effects

The four normalized rewards replace extraCost and use. Compose their actual
registered methods through the shared GameRule virtual-use seam; do not execute
their override and then also run inherited Card::use.

| Card          | Cost                | Actual use behavior                                                                                            |
| ------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| CompanionCard | Remove `@companion` | Nested Peach on a permitted current dying target; otherwise self Peach if available and chosen, else draw two. |
| HalfMaxHpCard | Remove `@halfmaxhp` | Draw one, despite an empty target list.                                                                        |
| FirstShowCard | Remove `@firstshow` | Fill hand to four, then optionally privately inspect one still-hidden head/deputy of the first target.         |
| CareermanCard | Remove `@careerist` | Dying Peach or chosen draw-one/draw-two/self-Peach/FirstShow behavior.                                         |

Careerman's FirstShow branch explicitly constructs FirstShowCard and calls
**its use directly**. It does not pay `@firstshow`, invoke a second onUse,
dispatch a second generic target pipeline, or apply FirstShow's separate
target-admission rules. Its candidate set includes all alive players with
unshown generals, potentially itself. Companion/Careerman Peach branches instead
call Room::useCard on a generated basic Peach and therefore represent nested
ordinary use, not SkillCard onEffect. Actual names inspected by FirstShow are
sent only to the user who inspected them; public observers receive only the
inspection metadata.

Sources: [Companion and HalfMaxHp](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L416-L488),
[FirstShow cost/use/privacy](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L523-L593),
[Careerman including direct-use branch](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L622-L690).

## Shared card references and narrow protocols

DamageStruct and RecoverStruct hold `const Card*`, without a basic/trick/equip
restriction. This is an actual SkillCard recovery requirement: JieyinCard's
onEffect sets `recover.card = this` and calls Room::recover for both players.
A shared reference decoder reused by recovery must preserve a SkillCard
descriptor rather than silently drop/reject it. Room::recover dispatches generic
PreHpRecover/HpRecover without a card-type gate. Generic damage references have
the same structural domain; Slash-specific Qinggang cleanup remains guarded
by `isKindOf("Slash")`.

Do not automatically attach an originating SkillCard to every skill-caused
damage: Qiangxi, for example, invokes the reason-string DamageStruct overload,
not the card overload. Represent the reference actually supplied by the
native caller. Widening a generic decoder does not authorize SkillCard as a
Jink, Slash, Nullification, Peach response, card admission, or ordinary onUse
entry; those methods retain their own type/ancestry/entry-point contracts.

Sources: [DamageStruct](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L35-L62),
[RecoverStruct](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L362-L369),
[Jieyin concrete recovery](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-wu-generals.cpp#L649-L660),
[generic recovery caller](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4408-L4432),
[damage and Slash guard](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4480-L4499),
[Qiangxi named reason](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-wei-generals.cpp#L884-L887).

## Verification obligations for the web checkpoint

Use real registered GameRule/resources/effect/reward operations for integration
claims, with a fixture-labelled adapter only where no concrete package exists.
Verify targetless overrides, default multi-target effect ordering, costs paid
once, original versus rewritten source/card identities, skill↔ordinary and
skill↔Slash rewrites at each reload boundary, current-reference flag cleanup,
nullification/disresponsive resources, dead-target and consumed-event returns,
CardEffectConfirmed's local-snapshot behavior and general SkillCard recovery
references. Pause/reload around generic target events, nested use, reward choice,
effects and cleanup; wrong/stale/duplicate replies must not repeat committed
cost or effects. Include Careerman's direct FirstShow use and private-view
projection. Preserve all existing ordinary onUse and response rejection cases.

Native admission/history/target ownership, play versus response validation,
production content/transport, full exception unwind and complete-match E2E
remain subsequent gates. Source fixtures and operation regression tests cannot
be reported as native runtime differential parity or 100% playable coverage.
