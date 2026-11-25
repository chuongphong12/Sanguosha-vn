# Direct response entry points: native evidence for Part 4ab

Date: 2026-10-20. Authority: QSanguosha-QuocChien 2.3.43-beta2 at
`ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. This is research and proposed
acceptance criteria, not implementation approval or a claim that the web engine
already implements these routes. Native source was inspected, not executed.

## Evidence integrity and graph limitations

The native checkout is
`C:/Users/Tran.Trong.Nhan/.codex/worktrees/standard-rules-audit/tqs-boardgame/.references/qsanguosha-upstream`.
HEAD and `.gitnexus/meta.json.lastCommit` both equal the authority pin; native
`git status --short` was empty before and after investigation. GitNexus 1.6.12
reports 871 files, 34,663 nodes, 52,694 edges and 317 processes. All graph queries
were bound to that absolute repository path, not the ambiguous game repository
name. No index rebuild was necessary.

Graph-first evidence used `query` for `askForCard askForSinglePeach provide`,
Cypher for exact overload identities and callers, then `context` with the full
nine-argument overload UID. It found the convenience wrapper and eight process
memberships, but its incoming CALLS rows omitted the concrete Slash/Jink and Duel
callers below. The graph therefore locates symbols; owning source establishes
actual call semantics. Raw Cypher line positions are zero-based; source links
below use verified one-based lines. The index File.content representation is
flattened, so source-byte verification uses `meta.fileHashes`, not graph-rendered
content.

Exact current SHA256 values, each equal to the indexed `fileHashes` value:

| Native source                     | SHA256                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| `src/server/room.cpp`             | `08a3abecf8534642fff67a3a3f437a6cd90a1e7603051ae06f5c3314060ad2df` |
| `src/server/room.h`               | `0e3ad72cd2ff318ed1e2e4769bae03fef3d1e87249853018b349c2e0a543df33` |
| `src/server/gamerule.cpp`         | `807428c4d1ce39efbee0ac209298e3d059c03593accf63081cfe0cc420ce7a7a` |
| `src/package/standard-tricks.cpp` | `409ffb8f632ac04c42ec8eb24c9adee3c97247579952f407ba393b81e87835b6` |
| `src/package/standard-equips.cpp` | `3a3466b539a989c0c62fd6731f32e95115753c9f509952505d8380a77b4c8436` |
| `src/core/card.cpp`               | `9a79637c1b375462cf04610757e328397720bc4bca4d5fc9316b2152bc37c34c` |
| `src/core/structs.cpp`            | `2427eed782f7d3ef2d01e4cafc8205139eda5173756b74d3ad08c0901b50c8a1` |
| `src/core/structs.h`              | `44ecaa77ee801f1fe6d7b05726d76addf3defd8d4db08a0a5c87ba84db125ad4` |
| `src/core/player.cpp`             | `7b82baaec99ebdc2e213bb5a5d602cf1b66ba9c99a047ab2373fb82d8b1a68a1` |

## Do not route by card name or reason enum alone

| Concrete caller                                | Native entry                                         | Consequence                                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slash defense, one or multiple Jinks           | `askForCard(..., MethodUse, slasher)`                | Direct response-use lifecycle; no generic Room::useCard call. Each requested Jink completes its own lifecycle before the caller checks effectiveness. |
| ArcheryAttack Jink                             | `askForCard(..., MethodResponse, source)`            | CardResponded lifecycle, despite the same Jink card name.                                                                                             |
| SavageAssault Slash and Duel alternating Slash | `askForCard(..., MethodResponse, source/opponent)`   | Response lifecycle. Duel's Wushuang branch asks twice before swapping responder.                                                                      |
| Targetful skill/Slash response-use             | `askForUseCard`, possibly through `askForUseSlashTo` | Generic Room::useCard path; not direct askForCard(MethodUse).                                                                                         |
| Dying save                                     | `askForSinglePeach`                                  | validateInResponse plus Room::useCard(use,false), then response after-hook.                                                                           |

Sources: [SlashProceed](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L835-L861),
[AOE responses](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-tricks.cpp#L112-L159),
[Duel](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-tricks.cpp#L322-L373),
[targetful entry](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1850-L1923),
[Peach entry](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2003-L2067).

## Acquisition, validation and retry are a separate upstream lifecycle

The five-argument convenience overload explicitly supplies MethodDiscard, null
recipient, non-retrial, supplied skill name and non-provision. The full overload's
header defaults are also MethodDiscard, null recipient, false retrial, empty skill
name and false provision. Calling askForCard without an explicit method is not a
response-use request. A debug assertion forbids pattern `slash` with MethodUse
and directs callers to askForUseSlashTo.

The full overload sets current pattern and derives current room reason from
method. CardAsked receives only `[pattern,prompt]`, and fires only for MethodUse
or MethodResponse, non-retrial and not `continuing`. Its boolean trigger result
is ignored. Afterward the continuing flag is cleared; a provided card or dead
player branch precedes AI/human acquisition. `provide` is a single-slot room
facility guarded by assertions, sets both the pointer and has_provided marker,
and acquisition resets both. A provided or AI card passes a limitation check;
the human parse branch does not perform the same check at that point. A web
adapter must retain authoritative admission, rather than copying this asymmetry
as permission to trust client cards. EightDiagram is a live CardAsked provider:
a successful red judgment constructs a virtual Jink and provides it.

No acquired card emits the nil ChoiceMade result and returns null. Otherwise the
original card is retained as `_card`, then validateInResponse can return a
different card. A null conversion sets continuing and recursively retries the
full overload, forwarding player/pattern/prompt/data/method/recipient/retrial but
**not skill_name or isProvision**: their header defaults take effect. The retry
skips CardAsked once via continuing; failed conversions can already have package
side effects. A normalized retry cursor must explicitly represent that reset,
not silently retain all initial options or claim failed conversion is rollback.

Sources: [overloads/defaults](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.h#L421-L426),
[acquisition](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1604-L1674),
[retry](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1842-L1847),
[provide](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L7815-L7822),
[EightDiagram](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-equips.cpp#L291-L350).

## Post-validation common boundary and snapshots

On non-null conversion, a nonvirtual validated card synchronizes its wrapped
representation. Logging/emotion/broadcast differ by method and retrial. Hand
provenance is then computed from validated materials and their actual owner/place:
nonempty and entirely in actor hand means true; empty/foreign/equipped means
false. This occurs before ChoiceMade. ChoiceMade uses the validated card string.
Only afterward does the code collect material IDs for MethodUse/MethodResponse,
so copying every material snapshot before ChoiceMade would change behavior.
Skill invocation notification precedes this material collection.

A retrial skips normal MethodUse/MethodResponse consumption and after-hooks.
MethodNone also skips consumption. MethodDiscard moves validated materials to
discard with THROW reason, then returns without either response after-hook.
No branch here is the generic SkillCard onUse or Room::useCard wrapper.

Source: [validated response/common branches](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1676-L1737).

## Direct MethodUse: minimal useful first slice

After successful response validation/common processing:

1. Build a local CardUseStruct with validated card, actor and no targets; build a
   separate mutable QVariant event payload from it. Trigger PreCardUsed.
2. Move the previously collected validated material IDs to table atomically,
   using USE reason, validated skill name, and actual head/deputy name when skill
   position exists. Zero materials skip movement.
3. Show validated card's showSkill/position; if nonempty and huashen is shown,
   drop the associated Huashen card. These operations must support suspension and
   child triggers without duplicate effects.
4. Trigger CardUsed with the existing mutable event payload. The default GameRule
   can process target mutations and calls the event card's `use`; this is an
   event dispatch dependency, not an explicit askForCard call to `onUse`.
5. Inspect `cardNotTriggerCardFinished` on the local original validated card. If
   absent, trigger CardFinished with mutable event payload. If present, skip the
   event and perform local-card flag/nullification/Jink-tag cleanup explicitly.
6. Recompute the original validated card's current material IDs, select those still on table and discard
   those with USE reason. A material taken elsewhere by a trigger is not
   discarded again. Invoke **original pre-conversion `_card->validateAfter`**
   with the local CardUseStruct, then return the validated card.

Important separation: PreCardUsed/CardUsed may replace the QVariant payload, but
askForCard never reads it back into its local CardUseStruct. Subsequent events
receive the mutated payload; local flag checks, cleanup and original-card
validateAfter retain their own local references. Ordinary CardFinished GameRule
uses the event payload; its fallback bypass in askForCard uses the local card.
The return values of these trigger calls are not branch/cancel gates here.

No Room::useCard call, history increment, generic card validate, validateInResponseAfter
or explicit onUse occurs in this direct path. Do not infer history policy from
CardUseStruct.m_addHistory's default true value. Its C++ default constructor does
**not initialize m_reason, m_isHandcard or index**, and this path does not assign
them. The separately computed hand provenance is assigned only to MethodResponse.
A TypeScript port must choose/document deterministic normalized values instead
of claiming parity with uninitialized C++ fields.

Sources: [direct lifecycle](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1721-L1800),
[default struct](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.cpp#L238-L259),
[struct fields](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L98-L123),
[GameRule CardUsed/CardFinished](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L537-L630),
[table filter](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L6620-L6642).

## MethodResponse and rescue remain distinct follow-up slices

MethodResponse constructs CardResponseStruct(validated card, recipient), sets
hand provenance and original request data, moves materials to table with RESPONSE
reason, reveals/drops Huashen, then triggers CardResponded. Constructor defaults
set isUse=false and isRetrial=false. It does not read modified event payload back.
If non-provision, it discards only original validated materials still on table;
provision leaves them there for the caller. The original pre-conversion card's
validateInResponseAfter runs even for provision. No PreCardUsed/CardUsed/CardFinished,
Room::useCard/history or validateAfter runs in this branch.

askForSinglePeach sets RESPONSE_USE reason, obtains one card, checks MethodUse
limitation, validates in response, emits ChoiceMade, sets UsedBySecondWay on the
validated card, calls Room::useCard(use,false) targeting the dying player, then
calls original validateInResponseAfter. It ignores useCard's boolean result and
returns the validated card; null response conversion retries. This entry does
not run CardAsked/provide or set current pattern. The surrounding dying protocol
owns CurrentDying stack, per-saver currentdying property, rescue repetition,
Wansha/CannotHelp/prohibition/lock gates, AskForPeachesDone and eventual death.
Calling the one-card helper alone does not implement rescue completeness.

Sources: [response lifecycle](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1802-L1840),
[response struct defaults](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L436-L484),
[one Peach](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2003-L2067),
[dying orchestration](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L244-L304),
[rescue gates/repetition](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L664-L707).

## Proposed acceptance matrix and adapter boundary

The smallest meaningful dependency slice is **validated direct MethodUse execution**:
server-owned original/validated card references, actor, validated resources and
common-stage completion feed a resumable lifecycle. It can be tested with trusted
fixtures without first porting all acquisition, retry, MethodResponse and rescue.
That would be a deliberate partial contract, not a complete askForCard helper or
an enabled production response button. The existing targetful response-use
admission must remain separate. Acquisition/public offers and CardAsked/provide
can then wrap this seam with authenticated actor-only tokens.

| Acceptance family        | Required evidence before completing its slice                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Basic direct-use order   | ChoiceMade boundary, PreCardUsed, atomic table movement, reveal/drop, CardUsed, CardFinished, remaining-table discard, original validateAfter in that order.                                                             |
| Original vs conversion   | Different original/validated cards; original validateAfter receives local validated-card use; no generic validate/history/response after-hook accidentally fires.                                                        |
| Mutable event payload    | PreCardUsed changes card/from/targets; subsequent event payload sees changes, local resource/finish-skip/after-hook snapshot does not silently become payload.                                                           |
| Material movement        | Physical, virtual multi-material, virtual empty; a child trigger obtains one table material; cleanup discards only remaining originals exactly once.                                                                     |
| Finish bypass            | Normal event cleanup uses event card; bypass suppresses CardFinished and clears local card flags/tags/notifications, then table cleanup and after-hook still run.                                                        |
| Suspend/resume           | Child event, material move and reveal/drop pauses at each boundary; JSON round-trip; no repeated movement, event, payment or after-hook; pending reference identities remain server-owned.                               |
| Acquisition follow-up    | Provider, human, AI and nil replies; CardAsked conditions; continuing retry exactly once; retry defaults for skill/provision; failed validation effects retained explicitly.                                             |
| MethodResponse follow-up | isUse=false, request data/recipient/provenance; CardResponded only; provision retains table materials; original response after-hook; retrial/none/discard keep separate semantics.                                       |
| Rescue follow-up         | Self/other saves, repeated saves at negative HP, failed/null conversion, prohibition/Wansha/CannotHelp, target dies or recovers mid-hook, wrapper false and conversion recursion, CurrentDying/currentdying restoration. |

The native askForCard method contains no local exception recovery around these
operations. Do not claim native TurnBroken/StageChange unwinding or transactional
rollback from normal-path resumability; interruption handling is a separate
contract. Base validation/after-hooks are no-ops; package-specific hooks own their
side effects. A pure lifecycle fixture can validate scheduling, but it does not
prove package content, complete response legality, or native/web differential
behavior. Source: [base hooks](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L979-L997),
[entire direct request owner](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1610-L1848).
