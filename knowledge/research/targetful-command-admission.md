# Targetful play and response-use admission

Date: 2026-10-16. Primary source: QSanguosha-QuocChien 2.3.43-beta2, commit
`ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. This research supports selected
approach B for Part 4aa: the [Room::useCard wrapper](room-use-card-entry.md) plus
normalized targetful command/request admission. It is not a claim of implemented
production commands, package completeness or native runtime execution.

## Native server ownership

`Room::activate` does the following, in order:

1. Handles pause/surrender; clears Global_PlayPhaseTerminated and sets a null
   output card when that flag exists; returns early outside Play.
2. Broadcasts the pushPile history command, triggers PlayCard, focuses the player,
   and sets current pattern empty and reason PLAY.
3. Obtains AI or human input. For human input, failed/null requests return;
   parsing sets the actor from the server-selected player. Cheat/surrender retry
   branches are native infrastructure, not ordinary card-use behavior.
4. Sets the use reason PLAY, calls weak isValid, emits ChoiceMade with a QVariant
   copy of the local use, then returns. It does not itself call Room::useCard.

Source: [room.cpp 6155–6220][activate]. GameRule's Play loop repeatedly calls
activate while alive, uses a non-null result then frees its chain, and stops
when the card is null. Source: [gamerule.cpp 209–219][playloop].

`Room::askForUseCard` asserts that method is **not MethodResponse**; sets current
pattern to the requested pattern and reason RESPONSE_USE; obtains the reply;
sets the local use reason RESPONSE_USE; and, for a non-null valid use, triggers
ChoiceMade before calling `useCard(card_use, addHistory)`. A wrapper false retries
the **whole request** with the same actor, pattern, prompt, notice index, method
and addHistory. A successful wrapper returns the local requested card pointer,
not the converted card returned inside the wrapper. Sources:
[room.cpp 1850–1898][askuse], [wrapper][wrapper].

Cancellation/invalid input instead emits ChoiceMade with the string
`cardUsed:<pattern>:<prompt>:nil` and returns null. For AI the refusal string is
`.`; for humans it is a null reply. A human non-null reply still must parse to a
non-null card to pass the weak isValid condition. Source: [1859–1904][askuse].

Both activate and askForUseCard ignore the boolean returned by ChoiceMade and do
not assign its mutable QVariant payload back to their local use. Event
consumption therefore does not cancel the native request/use path, and replacing
the event's use fields does not rewrite the local wrapper input. Shared room,
player or card-object effects remain possible. Source: [activate 6215–6220][activate],
[askForUseCard 1892–1898][askuse].

The current reason/pattern is set before asking. These shown server functions do
not restore a previous reason/pattern on return; do not describe a scoped
push/pop restoration as literal native behavior. Any web continuation-local
context should explicitly identify its own lifetime. Sources: [activate][activate],
[askForUseCard][askuse].

## What the server does not validate here

`CardUseStruct::isValid` ignores its pattern and returns only `card != NULL`.
Skill availability and targetsFeasible logic are commented out. tryParse checks
the array/string wire shape, parses the card, and resolves target names; it does
not implement ordered target legality or card/pattern matching. Sources:
[structs.cpp 261–342][parse]. Room::useCard's active limitation/recast gate and
conversion/history behavior are a separate [wrapper contract](room-use-card-entry.md).

Therefore a strict authoritative web command adapter is a deliberate improvement
at the web command boundary. It must not be presented as a native universal
server-side validator already present in these routines. Do not convert source
comments or native client controls into false server-parity claims.

## Native client checks and ordered targets

The client provides useful behavior to preserve in an authoritative policy:

| Client owner         | Actual behavior                                                                                                                                                                                                                                   | Source                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Card enablement      | Playing calls card.isAvailable. Responding/RespondingUse inspect the card handling method, changing Use to Response only for Responding, then check limitations. Discard checks MethodDiscard.                                                    | [roomscene.cpp 1361–1376][enable] |
| Fixed/response modes | Target-fixed cards and specified non-targetful response modes disable target selection and enable confirmation directly.                                                                                                                          | [1401–1417][enable]               |
| Candidate targets    | Calls targetFilter with the existing selected-target list and a maxVotes output; enables a candidate only when not prohibited and maxVotes > 0. Already selected items have their own selection treatment.                                        | [1451–1483][targets]              |
| Selection order      | Appends a newly selected player to selected_targets. After deselection it rechecks remaining targets, clearing selection when invalid. Confirmation uses targetsFeasible.                                                                         | [1487–1515][targets]              |
| Submit               | Sends the selected card only when targetFixed or targetsFeasible.                                                                                                                                                                                 | [2503–2509][submit]               |
| View-as submit       | Pending card must be non-null and isAvailable before useCard is called.                                                                                                                                                                           | [2511–2520][submit]               |
| Wire targets         | onPlayerResponseCard serializes target names only for non-targetFixed cards; target-fixed cards send an empty target list. It also serializes card metadata/skill position, clears response pattern in response status, and returns to NotActive. | [client.cpp 711–742][wire]        |

These checks are client controls, not a security boundary. In particular, base
targetsFeasible returns true for target-fixed cards regardless of target list;
otherwise it requires a nonempty list. Base targetFilter accepts the first
non-self target; the maxVotes overload derives 0/1 from it. Package overrides
own richer rules. Source: [card.cpp 712–739][base-targets].

An ordered-prefix policy can reproduce ordinary selection: test each proposed
target against the already accepted prefix, apply prohibition with that prefix,
then run final feasibility. Do not sort targets before admission; card onUse may
later sort them according to its separate execution contract. Repeated/voted
targets require explicit maxVotes support rather than assuming every native
card accepts a unique target set. Likewise no universal “all targets must be
alive” rule follows from these generic functions; specific card policy owns it.
This is a recommended web contract derived from [target selection][targets],
not a claim that every package override has been ported.

## View-as availability, patterns and limitations

ViewAsSkill::isAvailable rejects an invoker lacking the skill and matching flag,
except TransferSkill. PLAY delegates to isEnabledAtPlay; RESPONSE and RESPONSE_USE
delegate to isEnabledAtResponse(pattern); unknown reason rejects. Base play
availability requires an empty response_pattern; base response availability
requires a nonempty response_pattern exactly equal to the requested pattern.
Base Nullification availability returns false. Package overrides can replace
these predicates. Source: [skill.cpp 350–379][viewas].

Do not require ownership of a skill merely because an effective card's skillName
is nonempty: that metadata can describe another producer's effects. The view-as
producer/availability authority must be distinguished from returned-card history
metadata. The need for this distinction follows from the separate
[ViewAsSkill availability][viewas] and [returned-card history][wrapper] paths;
it is a web modeling recommendation.

The native client treats a trailing `!` as non-refusable and strips **one**
trailing `!` or digit for its auxiliary pattern processing. It preserves the
original requested pattern in room state. The request method determines
RespondingForDiscard, RespondingUse, Responding, or RespondingNonTrigger status.
These presentation conventions are not generic server pattern matching.
Source: [client.cpp 1085–1146][client-pattern].

ExpPattern is a separate native pattern engine: `#` separates alternatives;
factors use `|`, with card ancestry/object name/effective ID expressions, suit,
number and optional material-place factors. A pure card-name equality test is
not its complete implementation. ViewAsSkill's base exact response_pattern
comparison is also not interchangeable with ExpPattern card matching.
Sources: [exppattern.cpp 29–170][expression], [view-as response][viewas].

Player::isCardLimited is also distinct: MethodNone bypasses; SkillCard at its
own handling method checks materials against limitations; other cases inspect
the card. It additionally handles physical non-skill Peach in BattleRoyal and
removed-player MethodUse. No subset of these rules should silently become the
whole native limitation contract. Source: [player.cpp 1744–1775][limits].

## Proposed bounded normalized web seam

The following is a design recommendation for approach B, separate from native
facts. Authentication, phase ownership, package catalog, complete patterns and
per-card target rules remain private authorities with explicit tested contracts.
Adding injectable predicates alone does not prove production implementations.

Use an internal targetful request operation carrying server-owned actor, reason,
pattern, handling method, prompt context and addHistory. The client selects
opaque options, not its own card descriptor, actor, validation hook or permission
booleans. Before emitting ChoiceMade or calling the wrapper, verify:

1. The current actor/request/phase authorization through the private policy;
   wire identity must not override the bound actor.
2. A registered catalog selection and accessible materials, plus the appropriate
   view-as producer eligibility, reason/pattern and limitation policy.
3. Known targets in submitted order, sequential targetFilter/prohibition and
   final targetsFeasible. Normalize target-fixed cards to empty submitted targets
   because that matches the native client wire representation; do not infer this
   from base targetsFeasible alone.
4. Current-state validity at final submission and again after any yielding
   event boundary where effects could invalidate authorization. A failed strict
   policy must prevent wrapper effects. This revalidation is additional web
   policy, not native ChoiceMade payload behavior.

To use a scheduler that accepts string choices, prefer private stable selection
IDs and staged prompts: choose card selection; append/remove target IDs; offer
finish only when the current prefix is feasible; offer cancellation according
to the server-owned policy. Recompute options after state changes/retries and
bind them to the active request/version. This avoids enumerating every ordered
card/target tuple and avoids changing scheduler input shape as the first choice.
The selected ID must resolve through private persisted request data after JSON
restore; exposing serialized private descriptors as option labels risks hidden
information leaks. Scheduler compatibility still needs implementation inspection.

For the initial supported policy, explicitly exclude target-vote/duplicate
selection modes if the normalized target contract cannot represent them.
Reject unsupported catalog entries before presenting them; never silently
deduplicate or claim all targetable skills supported. Preserve separate play
end-turn, response-use refusal and wrapper-false full-request retry semantics.
Native askForUseCard returns the requested raw card on success; retain that
identity separately from the wrapper's converted execution card.

Tests should exercise actual scheduler dispatch/resume and wrapper children,
actor/version/replay rejection, JSON restore, malformed/unknown selection IDs,
permission/pattern/availability failures, stale accessible materials, ordered
target prefix and prohibition, target-fixed empty targets, infeasible finish,
ChoiceMade consumption and local payload snapshots, revalidation after yielding
ChoiceMade, refusal, eager-null conversion retry with refreshed options, Play
request termination, successful raw-result identity, and no repeated costs/history.
Name fixture authorities as such; passing fake allow-all predicates is not
evidence of full package legality, production authentication or playable matches.

## Graph and validation receipt

Native GitNexus contexts preceded deeper source reads: activate, askForUseCard,
ViewAsSkill::isAvailable, RoomScene enableTargets/updateTargetsEnablity/
updateSelectedTargets/useCard, client onPlayerResponseCard/askForCardOrUseCard,
base targetsFeasible/targetFilter, RoomThread::trigger and ExpPattern::match.
Ambiguous overloads were localized by owning file; initial guessed names/paths
for RespondingSkill/ExpPattern failed and file inventory led to the actual
src/package/exppattern.cpp context. Empty graph results were not absence proof.

The prior native receipt remains pinned: index lastCommit and clean HEAD are
`ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, with 871 files, 34,663 nodes,
52,694 edges and 317 processes. Resolved lower-bound contexts report dropped
receiver sites: ViewAs availability 2, RoomScene useCard 2, targetsFeasible 1,
ExpPattern::match 5. Source inspection establishes the behaviors above; graph
caller coverage does not establish complete package dispatch or legality.
Indexed SHA-256 hashes match current bytes for all nine cited source files:
room.cpp, gamerule.cpp, structs.cpp, roomscene.cpp, client.cpp, card.cpp,
skill.cpp, exppattern.cpp and player.cpp. Native HEAD and cleanliness were
rechecked after research.
No native execution, code edit, indexing, commit or push was performed.

[activate]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L6155-L6220
[playloop]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L209-L219
[askuse]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1850-L1905
[wrapper]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4187-L4309
[parse]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.cpp#L261-L342
[enable]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/ui/roomscene.cpp#L1361-L1449
[targets]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/ui/roomscene.cpp#L1451-L1515
[submit]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/ui/roomscene.cpp#L2503-L2520
[wire]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/client/client.cpp#L711-L742
[base-targets]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L712-L739
[viewas]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/skill.cpp#L350-L379
[client-pattern]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/client/client.cpp#L1085-L1146
[expression]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/exppattern.cpp#L29-L170
[limits]: https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L1744-L1775
