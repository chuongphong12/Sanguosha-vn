# SkillCard integration: source boundaries for Part 4y

Status: research supporting the approved isolated onUse checkpoint (approach A);
this note does not certify implementation or shared GameRule integration.

Date: 2026-10-15. Native authority: QSanguosha-QuocChien 2.3.43-beta2,
commit `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. The reference checkout's
HEAD matched this pin and `git status --short` was empty before and after reading.
Web comparison: `b75b603d4e14e523605126cf7acc3e318608a139`.

## Finding

SkillCard participates in the common `Card::onUse` event envelope. It changes the
cost branch and may override `use`; it is not an alternative lifecycle that skips
`CardUsed`. CompanionCard, HalfMaxHpCard, FirstShowCard and CareermanCard override `extraCost`
and `use`, while inheriting the common `onUse`. A staged web implementation can
therefore add a normalized envelope with an explicit CardUsed adapter, but must
not claim common GameRule/CardFinished/resource/effect support until those
readers and adapters accept the new domain.

Sources: [SkillCard declaration](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.h#L251-L270),
[delegating onUse and default cost](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L1123-L1138),
[reward-card implementations](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L416-L721).

## Graph evidence and its limits

GitNexus 1.6.12 native status matched `ce4e62b`, all 871 covered files, with the
current analyzer identity. Graph-first queries for `SkillCard` and `useCard`
located card.cpp/card.h/package definitions; the `useCard` process hits were UI
flows, not proof of the complete server pipeline. Qualified C++ spellings
`SkillCard::onUse` and `Room::useCard` were not found; file-qualified contexts
`onUse --file src/core/card.cpp` and `useCard --file src/server/room.cpp`
resolved the intended implementations. `askForCard --file src/server/room.cpp`
was ambiguous between the 5- and 9-argument overloads, then both overload bodies
were read directly.

Native contexts are lower bounds: onUse omitted one receiver-typing call site,
useCard omitted two, and the package use context omitted one. The package context
also groups identically shaped C++ methods; its displayed line span alone is
insufficient to identify every override. Empty process lists are not evidence of
no callers. Direct pinned source reads supplied the dispatch, override and cost
facts below. No function/class was edited.

Web graph contexts located `readCardUse`, `createCardOnUseOperation` and
`createRewardTokenUseOperation`. `readCardUse` has incoming readers from effects,
resources, CardUsed, nullification and Slash. The reward operation's indexed
caller was its test registry. This confirms that widening the shared reader has
a larger review surface than adding a separate normalized envelope; it does not
establish a production SkillCard integration.

## Native defaults and targets

| Boundary                | Verified behavior                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Construction            | `SkillCard()` invokes `Card(NoSuit, 0)`; Card's default `target_fixed` is false. Card sets `mute=false`, `will_throw=true`, `has_preact=false`, `can_recast=false`, `transferable=false`; its initial handling method is therefore `MethodDiscard`. |
| Type                    | SkillCard returns `skill_card` for type and subtype, and `TypeSkill` for type id.                                                                                                                                                                   |
| Default target legality | `targetsFeasible` accepts any list when target-fixed, otherwise requires a nonempty list. Default `targetFilter` selects one non-self player. These are selection contracts, not server-side assertions automatically run by onUse.                 |
| Default validation      | `validate` and `validateInResponse` return `this`; their after-hooks do nothing. SkillCard adds no generic validation override.                                                                                                                     |
| Default use             | SkillCard does not override `Card::use`. The inherited method walks targets through `room->cardEffect`, with nullification/disresponsive snapshots. Package SkillCards can replace that method.                                                     |

Sources: [constructor declaration](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.h#L84),
[Card defaults](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L42-L48),
[target methods](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L712-L740),
[SkillCard type](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L1078-L1105),
[validation](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L973-L997),
[default use](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L897-L925).

## Common onUse order, snapshots and consumption

1. Copy the use struct and capture `player = card_use.from`; record skill position
   if applicable; sort the initial targets by action order; emit the use log.
2. Capture physical material ids from the initial card (subcards for a virtual
   card, effective id otherwise), and create the shared QVariant event data.
3. Dispatch `PreCardUsed`, then reload local `card_use` from the event data.
4. For a non-Skill card, move the initially captured material ids to table with
   a use reason. For a SkillCard, call its virtual `extraCost(room, card_use)`;
   do not also perform the non-Skill table movement. Both branches subsequently
   perform the source's skill-reveal work.
5. Dispatch `TargetSelected` unless `this` has `slashDisableExtraTarget`.
6. Dispatch `CardUsed`, then `CardFinished`, using the shared event data and the
   originally captured `player` as event target.
7. Find ids of the original `this` card that are still on table and discard only
   those. Finish the skill-position bookkeeping.

`used_cards` is captured before PreCardUsed; it is not rebuilt if that event
changes the card. Local `card_use` is reloaded immediately after PreCardUsed,
but is not reloaded after TargetSelected/CardUsed/CardFinished. Thus final cleanup
uses the original card's surviving table ids and the after-Pre local snapshot for
its reason, while the shared QVariant can carry later event changes. A normalized
implementation should represent these distinct snapshots explicitly rather than
use one mutable object for all stages.

The skill-position push key is the initial card's `getSkillName(true)` plus the
captured original player's name, and its appended value is the initial skill
position. The final pop tests the after-Pre card's position and uses that card's
`getSkillName(true)` plus the original player's name. A rewrite can therefore
produce different keys; silently forcing them to one key would change the pinned
source. HuanshenSkillChecking is set and cleared on the after-Pre `from`, whereas
showSkill and the post-show Huashen drop use the originally captured player with
the after-Pre card's show-skill/position. The drop occurs only if show-skill is
nonempty and that player has shown `huashen`.

The source has further post-show branches for RuleTheWorld, Conquering,
ConsolidateCountry and Chaos, including a reveal choice and CompleteEffect flag.
These must either be supplied by a named source-derived adapter or explicitly
remain outside this checkpoint. Original card identity is distinct from saying
all flags on that native object are immutable: the later slashDisableExtraTarget
test is made on `this` at that stage.

`Card::onUse` does not branch on the bool returned by these `trigger` calls.
`RoomThread::trigger` can consume the current event by setting `broken`, skip
remaining rules, and returns that bool. Consuming one of these events therefore
does not itself cancel the outer onUse stages. In particular, consuming CardUsed
before GameRule may suppress `use`, while the enclosing onUse still advances to
CardFinished. Exceptions such as TurnBroken/StageChange are a different unwind
path and cannot be equated to event consumption.

Sources: [onUse setup/material snapshot](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L746-L791),
[cost branch and reveal](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L793-L871),
[dispatch and cleanup](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L873-L895),
[table-id filtering](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L6620-L6642),
[event consumption](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L616-L665),
[exception cleanup](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4269-L4301).

## CardUsed is still generic GameRule

GameRule's CardUsed case has no TypeSkill exclusion. It runs any pre-action,
then TargetChoosing and TargetConfirming when there are targets, reloading the
use from event data at the explicit source boundaries. TargetConfirming iterates
a copy and checks membership against the current target set. It then performs
Slash-specific Jink bookkeeping, TargetRecord, indexed TargetChosen and
TargetConfirmed, reloads the use again, sets nullified/disresponsive tags, and
calls the virtual `card->use`. A targetless SkillCard still reaches `use`; the
target-event blocks are conditional, the final virtual dispatch is not.

The loops use local snapshots for their bounds/target selection while updating
shared data inside them. This is not a blanket instruction to recompute or
re-sort all targets after every event. CardFinished also performs generic flag
cleanup, with additional non-delayed trick and Slash cleanup.

Sources: [CardUsed GameRule](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L537-L613),
[CardFinished](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L615-L627).

## Room::useCard is not a complete legality validator

Room::useCard parses a fresh card from serialization, copies flags and tags,
computes whether all physical materials were in the source's hand, checks card
limitations, and invokes `validate(card_use)`. It records Play-phase history when
requested. If validation returns the same real card it calls onUse and then the
original card's validateAfter. If validation returns another card it recursively
calls useCard with that replacement and then the original validator's after-hook.
A null validation result returns false.

This body does not enforce every view-as availability/target contract. Moreover,
the active `CardUseStruct::isValid` body ignores the pattern and only checks a
non-null card; the longer skill/target validation is commented out. Treat these
as native implementation facts, not as permission to trust unvalidated network
input in the web engine. The `m_isHandcard` calculation classifies materials; it
does not by itself reject arbitrary ownership/zone selections.

Sources: [Room use validation/history/dispatch](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4187-L4267),
[active isValid and commented checks](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.cpp#L261-L306).

## Response and response-use are different entry points

| Entry                      | Validation and dispatch/material boundary                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| askForCard, MethodResponse | Sets RESPONSE reason, calls validateInResponse, moves response materials to table, reveals skill as applicable, dispatches CardResponded, discards remaining table materials unless isProvision, then calls validateInResponseAfter. It does not call SkillCard onUse/extraCost or CardUsed.                                                                                                                                                        |
| askForCard, MethodUse      | Sets RESPONSE_USE reason and still calls validateInResponse. It dispatches PreCardUsed, moves captured materials to table, reveals skill, dispatches CardUsed and normally CardFinished, cleans surviving table ids, then calls validateAfter. It does not call Card::onUse, does not dispatch TargetSelected here, and does not run SkillCard::extraCost here. The cardNotTriggerCardFinished flag selects explicit cleanup instead of that event. |
| askForUseCard              | Parses a target-bearing CardUseStruct, sets RESPONSE_USE, applies the weak active isValid check, then calls Room::useCard. A useCard false result retries this prompt.                                                                                                                                                                                                                                                                              |
| askForSinglePeach          | Uses response validation, then passes a target-bearing use to Room::useCard with add_history=false, then calls validateInResponseAfter. This is the relevant entry for a CompanionCard used to save a dying player; it is not the pure MethodResponse path.                                                                                                                                                                                         |

askForCard's MethodDiscard overload delegates to MethodDiscard, which directly
discards the validated card; MethodNone and retrial avoid the normal response
dispatch block. The requested handling method and entry point matter separately
from the class being named SkillCard. A generic wrapper must not route all
responses through onUse merely because they share some events.

Sources: [askForCard overload/reason/validation](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1604-L1674),
[discard and MethodUse](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1714-L1800),
[MethodResponse and retry](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1801-L1847),
[askForUseCard](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1850-L1905),
[askForSinglePeach](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2003-L2066).

## Costs, reward overrides and privacy

Default SkillCard::extraCost discards the card's physical materials directly
with S_REASON_THROW and open=true if willThrow is true. It is not the normal
non-Skill move-to-table use cost. A package extraCost override replaces that
default. The four reward cards remove their mark instead; their view-as skills
are ZeroCardViewAsSkill, so callers must not manufacture physical costs for them.
Their marks are removed after PreCardUsed and before CardUsed's eventual use.
These four cards replace the default cost; Careerman consumes `@careerist`,
not a mark named after the skill. Cost and use must remain separate continuation boundaries to avoid charging
again when a choice or nested operation resumes.

In that default extraCost, `this` is the after-Pre SkillCard on which the virtual
call was made. Thus its materials can differ from the initially captured
non-Skill table-move ids. The throw reason uses after-Pre `from` as actor and the
after-Pre card's skill name; its event/general metadata is empty unless a skill
position is present, in which case it uses that source's actual head name for
`left`, actual deputy name otherwise. The move is from that source to unowned
discard and is explicitly open. Actual general names are private authority even
when needed for internal reason metadata; do not expose the raw reason object
as a public notice. A cost/show child return must not replace the shared event
QVariant data: the native calls are side-effect calls, not event-data assignments.

Companion is target-fixed and either uses a generated Peach on the current dying
player when its conditions permit, or selects self-Peach versus drawing two.
HalfMaxHp is target-fixed and draws one. FirstShow is not target-fixed: it selects
one other player with an unrevealed general if any alive sibling has one;
otherwise its feasible target count is zero. Its use fills the user's hand to
four, then optionally asks which hidden general slot to view. Other players get
the fact/slot of the viewing action; the actual general name and view-generals
notification are sent only to the viewer. This is private knowledge, not a reveal.

Careerman is target-fixed, supports the dying-player Peach path, and otherwise
offers draw-one, draw-two, available self-Peach and conditionally FirstShow. Its
FirstShow branch chooses from all alive players with an unrevealed slot,
including self, then directly invokes a stack FirstShowCard's `use`. That direct
call does not consume `@firstshow` or dispatch a second FirstShow onUse envelope.
Consequently, composing another full token onUse for that branch would charge
and dispatch events that the native branch does not perform.

The common use log asks SkillCard::toString(hidden=true) when TypeSkill and
willThrow=false. That serialization omits suit/number/subcard ids, but can still
contain show_skill and user_string. It is not an all-purpose privacy projection.
The normalized web event/cursor should stay server-side; client-facing views
must use the existing projection boundary and never expose private materials or
general names simply because the outer envelope is public.

Sources: [default cost and hidden serialization](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L1107-L1138),
[common log](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L756-L765),
[Companion](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L416-L472),
[HalfMaxHp](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L474-L508),
[FirstShow legality/cost/private view](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L523-L619),
[Careerman cost and direct FirstShow use](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L622-L721).

## Proposed smallest verifiable checkpoint

The user accepted the isolated envelope boundary in the [Part 4y design](../specs/hegemony-skillcard-integration-draft.md): add a normalized
SkillCard onUse envelope alongside the existing non-Skill reader. Keep original,
after-Pre and evolving event data distinct; perform a supplied extraCost exactly
once; dispatch TargetSelected/CardUsed/CardFinished in the native order; clean
only original materials that remain on table. Make the CardUsed package-use
adapter an explicit named dependency. A minimal reward integration can exercise
HalfMaxHp's extraCost and existing use operation without claiming every reward,
general skill, response or common GameRule effect is now wired.

Meaningful acceptance evidence would cover pause/serialize/resume before and
after cost, consumption of PreCardUsed/CardUsed without aborting the enclosing
envelope, targetless use, original-versus-mutated material snapshots, and no
private payloads in projected views. A real extraCost/mark and use/draw adapter
should be included in at least one integration case; event names alone prove
only envelope dispatch. Tests must state whether the CardUsed adapter ran or an
earlier trigger consumed the event.

The alternative is widening the shared CardUse domain and auditing all its
readers, resource keys, CardUsed/CardFinished rules, card-effect and
nullification consumers. That is a larger checkpoint with a separate evidence
matrix. Simply adding `skill` to readCardUse's accepted type array would not
establish correct costs, package overrides, response routing or secrecy.

Current web evidence: [non-Skill reader and onUse envelope](https://github.com/chuongphong12/Sanguosha-vn/blob/b75b603d4e14e523605126cf7acc3e318608a139/src/game/hegemony/card-on-use.ts#L15-L220),
[existing package-use boundary](https://github.com/chuongphong12/Sanguosha-vn/blob/b75b603d4e14e523605126cf7acc3e318608a139/src/game/hegemony/reward-tokens.ts#L506-L517),
[common Card::use boundary](https://github.com/chuongphong12/Sanguosha-vn/blob/b75b603d4e14e523605126cf7acc3e318608a139/src/game/hegemony/card-use.ts#L1-L95).

Excluded unless separately specified: full Room::useCard validation/history and
replacement recursion; all askForCard/askForUseCard/Peach response routes;
TurnBroken/StageChange unwind; reveal/huashen/trick-show adapters; all package
SkillCard target rules and overrides; production registry/UI cutover. Keeping
these exclusions explicit preserves the distinction between a normalized port
slice and a playable native-equivalent engine.

Scope decision: the user selected the isolated envelope plus named adapters as
Part 4y. Shared-domain expansion and native play/response admission remain later
gates. This choice selects the engineering checkpoint; it does not change the
source facts or certify gameplay beyond the eventual implemented tests.
