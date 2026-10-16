# Card admission, history and response: native audit after Part 4z

Date: 2026-10-16. Authority: QSanguosha-QuocChien 2.3.43-beta2, commit
`ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. This is source research and a
proposed decomposition, not implementation approval or certification of the web
engine. The native checkout was clean before and after the audit and HEAD matched
the pin. No native execution or native/web differential run was performed.

## Principal finding

There are more than three execution routes. The reason enum distinguishes play,
response-use and response, but **response-use is not a unique lifecycle**:
`askForUseCard` enters `Room::useCard`, while `askForCard(MethodUse)` directly runs
its own lifecycle after `validateInResponse`. A dying Peach has a third composite
route: response validation, `useCard(..., false)`, response after-hook.

The native server's `CardUseStruct::isValid(pattern)` is **not a legality gate**:
it ignores the pattern and returns only `card != NULL`. The checks for skill
availability and target feasibility below it are commented out. Neither the
commented code nor native client checks may be reported as an active universal
server-side admission rule. A future authoritative web command validator should
be specified separately from a faithful normalized `Room::useCard` port.

Sources: [isValid](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.cpp#L261-L306),
[reason enum](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L96-L120).

## Evidence and owning boundaries

| Owner                    | Active behavior                                                                                                                                                                                               | Pinned source                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GameRule Play phase      | While alive, activate; if a card exists, useCard then freeChain; null card ends the loop.                                                                                                                     | [gamerule.cpp 209–219](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L209-L219)                                                                                                                                                                                                                                                                                                                       |
| Room::activate           | Checks phase termination and Play phase; sets empty pattern and PLAY reason; obtains/parses reply; calls weak isValid; emits ChoiceMade. Does not itself execute onUse.                                       | [room.cpp 6155–6220](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L6155-L6220)                                                                                                                                                                                                                                                                                                                           |
| CardUseStruct::tryParse  | Checks array/string wire shape, parses card, resolves target names. No active target feasibility or pattern matching here. Name resolution is not an ownership or legality proof.                             | [structs.cpp 308–342](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.cpp#L308-L342)                                                                                                                                                                                                                                                                                                                           |
| Room::useCard            | Reparse/copy card flags and tags; derive handcard provenance; limitation/recast gate; capture history key and Slash count; validate; history; dispatch same or converted card; after-hook.                    | [room.cpp 4187–4267](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4187-L4267)                                                                                                                                                                                                                                                                                                                           |
| Room::askForUseCard      | RESPONSE_USE reason; parse targetful use; weak isValid; ChoiceMade; useCard(addHistory); recursively ask again when it returns false. Asserts method is not MethodResponse.                                   | [room.cpp 1850–1905](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1850-L1905)                                                                                                                                                                                                                                                                                                                           |
| Room::askForCard         | MethodResponse selects RESPONSE; MethodUse selects RESPONSE_USE. Both can emit CardAsked, then validateInResponse. MethodUse enters a direct lifecycle; MethodResponse emits CardResponded.                   | [room.cpp 1610–1848](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1610-L1848)                                                                                                                                                                                                                                                                                                                           |
| Room::askForSinglePeach  | Limitation check, validateInResponse, UsedBySecondWay, useCard(use,false), then original validateInResponseAfter; retry after null conversion.                                                                | [room.cpp 2003–2067](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2003-L2067)                                                                                                                                                                                                                                                                                                                           |
| Card base validation     | validate and validateInResponse return this; their after-hooks do nothing. Package overrides own conversion effects.                                                                                          | [card.cpp 973–997](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L973-L997)                                                                                                                                                                                                                                                                                                                                 |
| Player limitation        | MethodNone bypass; for SkillCard at its own handling method, inspect each material against limitations; otherwise inspect card. Also handles BattleRoyal physical Peach and removed players for MethodUse.    | [player.cpp 1744–1775](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L1744-L1775)                                                                                                                                                                                                                                                                                                                         |
| ViewAsSkill availability | Requires skill or matching flag except TransferSkill; PLAY calls isEnabledAtPlay; both response reasons call isEnabledAtResponse(pattern). Base response implementation uses exact response_pattern equality. | [skill.cpp 350–375](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/skill.cpp#L350-L375)                                                                                                                                                                                                                                                                                                                               |
| Native client            | Playing checks isAvailable; responding adjusts method/limitations; target controls call targetFilter, prohibition and targetsFeasible. These are UI checks, not evidence that Room::useCard performs them.    | [roomscene.cpp 1361–1376](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/ui/roomscene.cpp#L1361-L1376), [1451–1509](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/ui/roomscene.cpp#L1451-L1509), [2503–2508](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/ui/roomscene.cpp#L2503-L2508) |

## Room::useCard ordering and important snapshots

1. Copy the input use, reparse the input card's serialized string, copy its flags
   and tags. Reset `m_addHistory=false`; compute `m_isHandcard` from the original
   material set and actual ownership/place. Empty materials mean false. A material
   not in the user's hand sets the provenance flag false; this loop does **not**
   reject the use merely because provenance is false.
2. Evaluate the pre-validation card's handling-method limitation. Reject only when
   that limitation applies and recasting is unavailable or also limited.
3. Capture history key from the pre-validation card: LuaSkillCard uses `#` plus
   objectName; otherwise class name. Capture the user's existing sum of Slash,
   ThunderSlash and FireSlash histories before validation.
4. Invoke `card_use.card->validate(card_use)`; null returns false. Validation can
   mutate state even on null: ShowHeadCard/ShowDeputyCard reveal a general then
   return null. Therefore false is not a rollback guarantee.
5. If the possibly modified use.from is in Play and the caller's add_history is
   true, set m_addHistory and increment the captured original-card key. If the
   returned card has a nonempty skill name, increment
   `ViewAsSkill_<returned skill name>Card`. This occurs **after** validation and
   **before** onUse/recursive conversion.
6. If `card_use.card->getRealCard() == returnedCard`, take the ordinary branch:
   optional delayed-trick wrapping, repeat-Slash flag, wrapper synchronization,
   onUse, then the current card's validateAfter.
7. Otherwise copy the validated use, replace its card, and recursively call
   useCard(new_use) with the C++ default `add_history=true`. This does **not**
   forward an outer false. The recursive boolean result is ignored; afterward
   invoke the outer card's validateAfter(new_use). The outer call still returns
   true when it reaches the end, even if the inner call returned false.

Sources: [useCard](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4187-L4267),
[default argument](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.h#L127),
[Slash history](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L1427-L1457),
[reveal validation](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-package.cpp#L723-L742).

The repeat-Slash flag in the ordinary branch checks current card ancestry,
caller add_history and the captured Slash count; it has **no explicit Play-phase
condition**, unlike history increment. The virtual one-material delayed-trick
branch wraps the material, broadcasts its new card and transfers showSkill before
onUse. A descriptor comparison by JSON equality is not equivalent to native
`getRealCard()` identity. A normalized port needs a private card identity/metadata
authority, not a public client assertion that conversion is unchanged.
Source: [ordinary branch](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4241-L4267).

Miewu is a concrete conversion example: validate delegates to validateInResponse;
that loses a wuku mark, sets MiewuUsed, constructs the selected card with its
materials and skill name; after-validation draws a card. These effects belong to
the package validation hooks, not to the generic use operation. Source:
[mol.cpp 127–155](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/mol.cpp#L127-L155).

## Distinct response lifecycles

| Entry                                | Validation                                    | Execution                                                                                                                | History/after-hook boundary                                                                    |
| ------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Play via activate/GameRule           | Room useCard validate                         | Card-specific onUse and shared 4y/4z execution                                                                           | Room useCard owns history and validateAfter                                                    |
| askForUseCard, RESPONSE_USE          | Room useCard validate                         | Same generic wrapper and card-specific onUse                                                                             | addHistory parameter; false retries full request                                               |
| askForCard(MethodUse), RESPONSE_USE  | Original card validateInResponse              | Direct PreCardUsed, table movement, reveal/drop, CardUsed, CardFinished or special cleanup, validated-card table discard | No Room useCard/history call; original card validateAfter(local card_use)                      |
| askForCard(MethodResponse), RESPONSE | Original card validateInResponse              | Table movement, reveal/drop, CardResponded; optional table discard                                                       | No CardUsed/CardFinished or generic history; original validateInResponseAfter                  |
| askForSinglePeach                    | validateInResponse then Room useCard validate | UsedBySecondWay; Room useCard(use,false)                                                                                 | Response after-hook outside useCard; conversion recursion can restore default history behavior |

Sources: [askForCard](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1671-L1847),
[askForUseCard](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1850-L1905),
[dying Peach](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2034-L2064).

Concrete callers prevent conflating names with behavior: Slash defense asks for
Jink with **MethodUse**, while Duel asks for Slash with **MethodResponse**;
askForUseSlashTo calls askForUseCard with MethodUse. Sources:
[Jink defense](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L835-L850),
[Duel](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-tricks.cpp#L337-L362),
[targetful Slash request](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1907-L1923).

In askForCard, CardAsked runs only for MethodUse/MethodResponse, non-retrial and
not continuing. Provided/AI cards explicitly pass an isCardLimited check before
validation; the human parse branch shown does not perform that same check there.
After null validateInResponse, continuing is set and askForCard recurs with its
shown argument list, not every original optional argument forwarded. Do not
invent uniform path gates from comments or APIs with similar names.
Source: [request branches and retry](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1633-L1674),
[retry](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1842-L1846).

MethodUse uses an original local CardUseStruct and an event QVariant. It does not
read event mutations back into the local card_use in the shown code. It checks
the original local card for cardNotTriggerCardFinished and uses the validated
card for remaining table-material cleanup. MethodResponse captures handcard
provenance and stores `to`, response data and card into CardResponseStruct;
isProvision prevents the final table discard, not initial table movement or
CardResponded. Retrial/MethodNone/MethodDiscard have separate branches.
Source: [direct lifecycles](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1714-L1839).

## Availability, patterns and target checks

Card::isAvailable checks card limitation/recast availability. Card's default
targetsFeasible permits any targets for target-fixed cards and a nonempty list
otherwise; default targetFilter accepts the first non-self target. Subclasses
replace these rules. Slash::IsAvailable includes history/residue/Crossbow and
reason/pattern conditions; this is not just a universal once-per-turn boolean.
Sources: [base targets](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L712-L739),
[base availability](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L973-L977),
[Slash availability](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-basics.cpp#L41-L97).

A server-authoritative web request boundary should separately specify ownership,
actor/prompt authorization, accessible materials, known targets, pattern matching,
ViewAsSkill availability, ordered targetFilter/prohibition and targetsFeasible.
This is a proposed safety contract, **not a claim that pinned Room::useCard already
checks them all**. Package allow-lists/private authorities must resolve actual
card ancestry, identity, handling method and validation operation. Public card
names, client-supplied isAvailable or class strings cannot establish those facts.

## Exception boundary

Room::useCard catches StageChange and TurnBroken thrown inside its try block,
performs table cleanup, triggers CardFinished under Global_ProcessBroken, clears
selected temporary flags/tags and table/judge cards/using flags, then rethrows.
The validate call and history mutation precede the try block. The cleanup branch
does not roll back validation/history. Other trigger events are rethrown without
this special cleanup. This is a separate unwind contract: a resumable scheduler
interruption label does not by itself implement the native exception cleanup.
Source: [catch and rethrow](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4228-L4302).

## Proposed independent slices and regression obligations

No slice below is marked approved or implemented by this note.

1. **Normalized Room::useCard wrapper**, smallest dependency after 4z. Private
   authorities resolve reparse/identity/handling method/limitations, validation
   operation and onUse dispatch. Port handcard snapshot, original history key,
   returned-card skill history, conversion recursion, after-hook and boolean
   result behavior through public dispatch/resume. Keep wire parsing, interactive
   admission and package catalogs explicit adapters. Decide whether delayed-trick
   wrapping and native unwind are in the slice or explicitly deferred; neither
   may silently pass as implemented by a no-op callback.
2. **Targetful play/askForUseCard admission adapters**. Distinguish active native
   checks from the agreed authoritative web checks; patterns, ViewAsSkill and
   target legality need a written contract. Test prompt authorization, stale and
   replayed input, cancellation, conversion-false retry and changing state.
3. **Direct askForCard MethodUse lifecycle**. Preserve response validation,
   PreCardUsed/event-local snapshots, original cleanup and validateAfter.
4. **Pure response and compound rescue integration**. Preserve CardResponded,
   provision/retrial/method differences and dying-Peach composite hooks, without
   accidentally charging Room::useCard history twice.
5. **Exception unwind and broader package legality coverage**, if not included in
   earlier slices. Must have independent source-backed tests before claiming
   native exception parity or complete legal command admission.

For slice 1 test at least: all materials in hand, mixed/non-owned/no materials;
normal versus recast limits; denied gate leaves history/onUse untouched; null
validation with retained eager effects; same real-card identity versus a returned
conversion; Lua/original key and returned skill key; Play versus non-Play and
add_history false; Slash/FireSlash/ThunderSlash totals; repeat-Slash flag outside
Play; inner conversion denied but outer success and after-hook; outer false not
forwarded recursively; wrapper/flags/tags preservation; JSON pause before/after
validation/onUse/after-hook; nested use; invalid/stale/replayed replies; no duplicate
history or cost after resume. Use actual existing 4y/4z children and actual player
history where implemented; label metadata/conversion fixtures honestly.

For later slices test MethodUse Jink versus MethodResponse Duel Slash, targetful
response-use versus direct response-use, CardAsked continuing suppression,
provided/AI/human branch distinctions, null conversion retry, CardResponded data,
isProvision and retrial, original versus mutated event snapshots, special finish
suppression, remaining-material cleanup, response after-hook and rescue composite
ordering. None of these tests alone proves all package skills or production play.

## Graph evidence and limits

Graph-first GitNexus query for Room useCard/askForCard/response/history preceded
source reads. Context resolved exact definitions for room.cpp useCard 4187–4309,
askForUseCard 1850–1905, askForCard full overload 1610–1848, activate 6155–6220,
structs.cpp isValid 261–306, and skill.cpp isAvailable 350–363. Qualified C++
`Room::name` queries did not resolve; file-filtered names and full overload UID
were used. Context linked askForUseCard and recursive useCard into useCard;
package polymorphism and receiver typing remain lower bounds.

Native index metadata: 871 files, 34,663 nodes, 52,694 edges, 317 flows;
lastCommit equals the source pin, dirtyPaths empty. SHA-256 fileHashes matched
current bytes for room.cpp, gamerule.cpp, structs.cpp, card.cpp, skill.cpp,
player.cpp, roomscene.cpp, mol.cpp, standard-package.cpp and standard-basics.cpp.
Definition ranges were checked against numbered source. No native edit or index
rebuild was needed. The CodeGraph command launched inside the nested reference
resolved its parent web index (250 files), so it was **not used as native graph
evidence**.

GitNexus labels useCard a lower bound with two unresolved receiver call sites,
validate one, availability two, and addPlayerHistory three; virtual dispatch and
package callers are not exhaustively represented. The full askForCard overload
has an exact context result but only one resolved incoming wrapper: that does
not invalidate directly inspected Duel/Jink callers. These graph receipts locate
ownership; direct pinned source establishes behavior. No empty caller set or
UNKNOWN risk is treated as proof of absence. This research did not edit functions,
so it does not substitute for pre-edit impact analysis in implementation.

## Additional response-use boundary: Nullification race

Nullification uses another direct lifecycle, not Room::useCard. Its human race
verifier only checks that the reply card string parses to a non-null Card. It
contains no `isKindOf("Nullification")` check and no TypeSkill rejection. The
winner is parsed again, its raw card is saved as `_card`, and
`validateInResponse(repliedPlayer)` is invoked; null conversion restarts the
race. Only the returned card is examined for HegNullification handling.
Sources: [race verifier](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1233-L1242),
[winner and conversion](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1332-L1358).

Miewu provides concrete supported intent for raw SkillCard conversion here:
viewAs constructs a MiewuCard with the original material and chosen user string;
its isEnabledAtNullification explicitly permits the skill with wuku remaining,
Miewu not used and a non-nude player. validateInResponse constructs the chosen
replacement card. Thus a normalized raw-response reader that rejects every
SkillCard _before_ its private validation/conversion hook can exclude a native
path. This does not authorize arbitrary client-supplied SkillCards: the web
catalog, eligibility and actor/prompt boundary must remain authoritative.
Sources: [Miewu conversion](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/mol.cpp#L127-L145),
[viewAs and nullification eligibility](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/mol.cpp#L158-L198).

The nullification route snapshots n_use from PreCardUsed data, moves the validated
card materials, reveals, uses CardUsed consumption plus its current nullified
list to derive success, and can recursively counter-nullify. It always then
emits CardFinished, discards remaining validated-card materials, and calls
**the original raw card's validateAfter(n_use)**, despite having used
validateInResponse for conversion. It does not call validateInResponseAfter in
this route. Preserve these asymmetrical hook names and snapshots deliberately.
Source: [direct nullification lifecycle](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1423-L1500).

Required follow-up regression: raw registered SkillCard -> private
validateInResponse -> ordinary/Heg Nullification; null conversion repeats the
race without running use lifecycle; malformed/unregistered payload rejection;
JSON pause/restore at conversion; cost/hook exactly once; original versus
converted references and metadata; CardUsed-consumed versus nullified success;
original validateAfter rather than response-after. Do not widen an unrelated
non-Skill onUse entry simply to make this raw conversion input parse.

Graph-first askForNullification context resolves room.cpp1244–1251 and links to
_askForNullification; verifyNullificationResponse resolves1233–1242. The latter
has no graph incoming calls even though the source passes its method pointer to
doBroadcastRaceRequest at1316–1317, illustrating the callback resolution limit.
