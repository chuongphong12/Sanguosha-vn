# Room::useCard: normal entry, history and conversion

Date: 2026-10-16. Source authority: QSanguosha-QuocChien 2.3.43-beta2,
commit `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. This note refines the
[admission/response audit](card-admission-and-response-audit.md) for the proposed
Part 4aa wrapper. It records inspected native behavior and design obligations;
it does not approve an implementation, execute native code, or certify playability.

## Boundary

`Room::useCard` is the normalized card-use wrapper. Its direct inputs are a
`CardUseStruct` and `add_history`, whose C++ default is `true`. It does not
implement a universal actor, phase, material-ownership, skill-availability,
pattern or target-legality validator. Its own active admission gate is the
handling-method limitation/recast condition below. `CardUseStruct::isValid`
only returns `card != NULL`; its availability/target code is commented out.
Sources: [wrapper][use], [default argument][default], [isValid][valid].

Do not route every response through this wrapper. `askForUseCard` does enter it;
`askForCard(MethodUse)` runs a separate direct response-use lifecycle, and
`askForCard(MethodResponse)` emits CardResponded. Dying Peach combines response
validation with `useCard(..., false)`. Those paths and Nullification have distinct
after-hook contracts, documented in the [earlier audit](card-admission-and-response-audit.md#distinct-response-lifecycles).
Sources: [askForUseCard][askuse], [askForCard][askcard], [Peach][peach].

## Native order and snapshots

| Stage                   | Exact behavior                                                                                                                                                                                                                                                                                           | Owner                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Entry copy              | Copy the incoming use, reparse its card serialization, add incoming card flags, then replace parsed-card tags with a copied incoming tag map.                                                                                                                                                            | [room.cpp 4189–4197][entry]                                                        |
| Provenance              | Reset `m_addHistory=false`; set `m_isHandcard` only when the original parsed card has at least one material and every material belongs to the original `use.from` in hand. A physical card contributes effective ID; a virtual card contributes subcards. False provenance is metadata, not a rejection. | [4199–4214][entry]                                                                 |
| Limitation              | Return false when the parsed card is limited at its handling method, unless it can recast and is not limited at MethodRecast. No call to `Card::isAvailable`, target filtering or Slash availability occurs here.                                                                                        | [4216–4218][entry]                                                                 |
| Pre-validation captures | Capture the original parsed card's history key: LuaSkillCard uses `#` plus object name; all others use class name. Capture the pre-validation actor's Slash count.                                                                                                                                       | [4220–4226][before]                                                                |
| Validation              | Call `card_use.card->validate(card_use)`. This receives a mutable use and can rewrite `from`, `card`, `to` and other fields, independently of the returned card pointer. A null return exits false before history/onUse/after-hook. Effects already performed by validation survive.                     | [4228–4230][before], [signature][signatures], [reveal example][reveal]             |
| History                 | Inspect the **post-validation** `card_use.from` phase. In Play, when caller add_history is true, set `m_addHistory=true`, increment the pre-validation history key on that actor, and additionally increment `ViewAsSkill_<returned getSkillName()>Card` for a nonempty returned-card skill name.        | [4232–4239][before]                                                                |
| Identity                | Compare the **post-validation** `card_use.card->getRealCard()` with the returned card pointer. This is private native identity, not class/name/material or JSON equality.                                                                                                                                | [4242][normal], [base identity][cardidentity], [wrapper identity][wrappedidentity] |
| Same-real branch        | Possibly wrap a delayed trick; set repeat-Slash flag; synchronize physical wrapper; call current local card's onUse, then current local card's validateAfter with the local use.                                                                                                                         | [4242–4261][normal]                                                                |
| Converted branch        | Copy the post-validation outer use into `new_use`, replace only its card with the returned pointer, recurse `useCard(new_use)` with default history=true, ignore the inner boolean, then call the outer local card's validateAfter(new_use).                                                             | [4262–4266][normal], [default][default]                                            |
| Result                  | Reaching the end returns true. An inner false does not turn the outer result false, and does not suppress the outer after-hook.                                                                                                                                                                          | [4262–4266][normal], [4308][catch]                                                 |

The history actor and repeat-Slash flag actor can therefore differ from the actor
whose Slash count was captured. Calling the outer hook receiver “the original
raw card” unconditionally is inaccurate: validation can rewrite the outer local
`card_use.card`. Preserve separate identifiers for pre-validation snapshots,
post-validation local use, returned validation card, and converted child input.
Source: [4220–4266][before-normal].

`validateAfter` also accepts a mutable use. `onUse`, by contrast, accepts a const
use reference; base `Card::onUse` immediately copies it before sorting targets and
dispatching events. Its event-local mutations do not automatically become the
wrapper's local after-hook argument. Similarly, the recursive wrapper copies its
input, so inner-local use changes do not automatically overwrite the outer
`new_use` supplied to the outer hook. This is a value-snapshot distinction;
shared card objects, player state and room state can still change. Sources:
[signatures][signatures], [base onUse copy][onuse], [wrapper copies][before-normal].

ShowHeadCard and ShowDeputyCard demonstrate eager validation effects: they reveal
a general and then return null. False must not mean transactional rollback.
Source: [standard-package.cpp 723–742][reveal].

## Parsing, identity and metadata

Physical `Card::toString` emits the ID. Its virtual form includes object name,
skill name, suit, number, subcards and showSkill. `Card::Parse` selects distinct
SkillCard, DummyCard, LuaSkillCard, virtual-card and physical-ID branches; ordinary
physical IDs resolve to `Sanguosha->getCard(id)->getRealCard()`. Native virtualness
is `m_id < 0`, not simply “has materials”. Sources: [serialization][serialize],
[parse and virtualness][parse].

Base `getRealCard()` returns `this`; WrappedCard returns its underlying `m_card`.
The wrapper therefore needs private stable real-card identity across serialization
and resumable storage. Descriptor equality cannot establish conversion identity;
two identical-looking cards may still be distinct returned objects. Sources:
[base][cardidentity], [wrapped][wrappedidentity], [identity branch][normal].

Entry copies flags through `setCardFlag` and assigns a copied tag map **after**
reparsing. It does not promise to clone every runtime property of the incoming
card. A port should document the supported serialization metadata, private flags
and tags separately instead of labeling an arbitrary descriptor spread as a
complete native parser implementation. Source: [entry][entry], [parse][parse].

`getSkillName()` defaults `removePrefix=true`: a leading underscore is removed
for the returned-card ViewAsSkill history key. Raw `_skill` metadata and the
resolved `skill` history name must not be conflated. Sources:
[default flag in card.h 107][skilldefault], [card.cpp 360–366][skillname],
[history call][before].

## History and repeat Slash

Player history increments are signed integer additions, `history[name] += times`.
Slash count is the sum of Slash, ThunderSlash and FireSlash histories, each
defaulting to zero. There is no lower-bound clamp in either method. The room
history adapter treats key `.` as clearing ordinary history while retaining
`Analeptic`, and times=0 as clear-that-key, then sends the history command.
Those clearing/notification semantics belong to the
history boundary, not a second wrapper lifecycle. Sources:
[player.cpp 1427–1457][history], [room.cpp 2179–2198][roomhistory].

The ordinary branch sets `Global_MoreSlashInOneTurn` when the current local card
is Slash, caller add_history is true, and the **captured pre-validation Slash
sum** is greater than zero. There is **no explicit Play-phase condition** on that
flag, whereas history increment has a Play-phase condition. Do not re-read the
post-increment count for this test. Source: [history and normal branch][before-normal].

Crossbow is not a condition in Room::useCard. `Slash::IsAvailable` separately
checks limitations and, for PLAY or `@@rende_basic`, weapon availability versus
materials, Crossbow, canSlashWithoutCrossbow and residue/specific-assignee
allowances. Other reasons can return true after the initial limitation test.
Porting wrapper history does not establish this card-specific admission contract.
Sources: [Slash availability 41–97][slashavailable], [wrapper][use].

## Delayed-trick and physical-wrapper synchronization

In the same-real branch only, the **returned** card qualifies for delayed-trick
wrapping when it is DelayedTrick, virtual and has exactly one subcard. Native
clones the card, takes over that material's WrappedCard, broadcasts its updated
card, then sets the wrapper showSkill. This is observable card-state work before
onUse, not merely a notification. Source: [room.cpp 4243–4249][normal].

`Engine::cloneCard(const Card*)` uses the runtime class, suit, number and flags,
then effective ID, unstripped skill name and object name. WrappedCard::takeOver
replaces the underlying card, gives it the physical wrapper ID, and changes the
wrapper object name, suit, number and skill name. Replacing a prior underlying
card marks it modified. It does not copy arbitrary tag maps in this method.
Sources: [cloneCard 587–597][clone], [takeOver 36–51][takeover].

After the delayed-trick step, the wrapper checks **current local
card_use.card** physicalness. For a physical card it broadcasts its WrappedCard
update when modified, otherwise a reset, before onUse. It does not replace the
local virtual card descriptor with the material's wrapper merely because a
delayed-trick wrapper was updated. Source: [4243–4260][normal].

A callback that does nothing cannot demonstrate wrapper synchronization parity.
Before implementation, explicitly choose whether to include a normalized private
physical-card wrapper store/update contract in 4aa, or to publish a narrower
supported-card scope with delayed-trick wrapping deferred. Any unsupported case
must remain explicit at the trusted catalog boundary; do not silently report
native success while skipping the required state transition. This is a design
recommendation based on the preceding source, not native behavior itself.

## Interruption boundary

The try block begins **after validation and history**. Only StageChange and
TurnBroken thrown within it run special cleanup: discard the current local
card's table cards; trigger CardFinished under Global_ProcessBroken; remove
Qinggang and selected temporary flags from alive players; discard all randomized
deck cards currently on table or in judge area; clear their using flags; rethrow.
Other trigger events rethrow without that cleanup. No rollback of validation or
history appears. Sources: [try boundary 4228–4241][before], [catch 4269–4302][catch].

Consequently scheduler interruption/retained-frame handling is not equivalent to
native unwind parity. It is valid to scope 4aa to normal completion, provided
native cleanup is explicitly pending and interrupted paths cannot be advertised
as completed native uses. The wrapper's after-hook is skipped when its onUse or
recursive child throws through it; a child false is a distinct normal result
and still permits the outer hook. Source: [normal and catch][normal-catch].

## Proposed minimal source-faithful normal path

This is a proposal for review, not approval to code:

1. A trusted normalized operation resolves reparse metadata, resource materials,
   real identity, ancestry/Lua class, handling method/recast and hook identities.
   Public payload names or booleans do not establish these facts.
2. Preserve pre-validation key/count/provenance and post-validation mutable use
   separately; apply the exact gate, signed history additions and identity branch.
3. Dispatch actual existing 4y/4z onUse children; keep one local wrapper after-hook
   snapshot, plus converted recursion with default true and ignored child boolean.
4. Persist every progress stage and private identity through JSON pause/restore;
   use the existing scheduler's actor, stale/replayed reply protections. These
   are web persistence obligations, not claims about native JSON behavior.
5. Decide the physical-wrapper store and native unwind scope before claiming
   coverage. Keep play/response legality, package runtime registration and
   production setup-to-victory integration outside this wrapper contract.

Regression obligations: no/mixed/non-owned/all-hand materials; normal versus
recast limitation; eager-null validation; mutable validation actor/card/targets;
Lua/original key and returned skill prefix; Play and non-Play with add_history
true/false; negative and combined Slash histories; repeat-Slash outside Play;
same-real versus identically described distinct identity; conversion with outer
history=false; inner denial with outer true and outer after-hook; local/event
snapshots; physical update/reset and delayed-trick state transition if in scope;
pause before/after validation, history, onUse, recursive use and after-hook;
nested use, wrong actor, stale/replayed reply, and no duplicated costs/history.
These are proposed test requirements derived from the source and existing web
continuation boundary; they do not prove all package cards or playable matches.

## Graph receipt and limitations

Graph-first queries used installed GitNexus LocalBackend against the native
checkout before deep source reads. Exact contexts resolved useCard 4187–4309,
Parse 501–669, getSlashCount 1432–1437, addPlayerHistory 2179–2198, base and wrapped
getRealCard, takeOver, base validate, getSkillName and isCardLimited. Ambiguous
getRealCard/takeOver names were resolved by file; cloneCard returned both
source-owned overloads and exact implementation was then inspected.

Native index lastCommit matches the pin: 871 files, 34,663 nodes, 52,694 edges,
317 processes. Indexed SHA-256 hashes match current bytes for all eleven files
cited below: room.cpp/h, card.cpp/h, wrappedcard.cpp/h, player.cpp, engine.cpp,
structs.cpp, standard-basics.cpp and standard-package.cpp. HEAD matches the pin;
native worktree is clean. No native edit, indexing or execution was performed.

GitNexus reports unresolved receiver call sites: useCard 2, getSlashCount 1,
addPlayerHistory 3, getRealCard 9, validate 1, getSkillName 45 and isCardLimited 2.
Those results are lower bounds. takeOver and Parse report exact extraction, but
missing incoming edges do not negate the directly inspected callers. C++ virtual
dispatch, callbacks and package behavior are not exhaustively traced by these
receipts. This research does not replace implementation pre-edit impact checks.

[use]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4187-L4309
[entry]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4189-L4218
[before]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4220-L4241
[before-normal]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4220-L4266
[normal]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4242-L4266
[normal-catch]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4242-L4302
[catch]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4269-L4308
[default]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.h#L127
[valid]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.cpp#L261-L306
[askuse]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1850-L1905
[askcard]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1610-L1848
[peach]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2034-L2064
[serialize]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L423-L432
[parse]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L496-L669
[cardidentity]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.h#L165-L168
[wrappedidentity]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/wrappedcard.h#L104-L108
[signatures]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.h#L169-L175
[onuse]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L746-L756
[reveal]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L723-L742
[skilldefault]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.h#L107
[skillname]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L360-L366
[history]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L1427-L1457
[roomhistory]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2179-L2198
[slashavailable]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-basics.cpp#L41-L97
[clone]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/engine.cpp#L587-L597
[takeover]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/wrappedcard.cpp#L36-L51
