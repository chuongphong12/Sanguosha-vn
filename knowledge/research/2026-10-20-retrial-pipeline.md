# Part 4ab.3: expanded retrial pipeline

Research dated 2026-10-20. The user explicitly chose **“Mở rộng cả pipeline retrial”** after the [None/Discard proposal](2026-10-20-method-none-discard.md). Its recommended bounded option A is therefore superseded for this implementation scope. This note specifies the additional native contracts: acquisition-only retrial, the Room replacement operation, and representative Guicai/Guidao cost/effect composition. It does not claim every retrial package is ported or that implementation has passed tests.

Inspected game baseline: `cc219dfd4a1df9290d5400fb558fc60a1ddedc96`; previous MethodResponse implementation: `ea8c98cd13224d26207458e281a127a3ba221e6d`; canonical published knowledge baseline: `cccb130a3fd2dc1fe80704239b9bcc27016f2d13`. All native citations below pin QSanguosha-QuocChien 2.3.43-beta2 at `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.

## Three distinct owners

1. **askForCard with isRetrial=true** acquires and validates a response, synchronizes a physical wrapper and emits ChoiceMade. It suppresses the normal MethodUse/Response execution envelope. It does not replace a judge card or invoke response-after.
2. **Room::retrial** replaces the judge's canonical physical card and atomically moves the replacement plus old judge card. Its conditional CardResponded has isRetrial=true. It does not recompute the cached judge result.
3. **Guicai/Guidao cost and effect** ask using that flag, perform their own notices/table response event, save a card string in a stack, later pop/parse it and call Room::retrial, then recompute judge result. Their cost-phase CardResponded has isRetrial=false.

Collapsing these owners creates duplicate movement, wrong flags, incorrect result timing or wrong original/validated identity. Source ownership: [askForCard](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1610-L1848), [Room::retrial](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L7934-L7980), [Guicai](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-wei-generals.cpp#L100-L186), [Guidao](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-qun-generals.cpp#L939-L1034).

## Acquisition-only retrial flag

The native flags and branch ordering remain authoritative:

- Keep the method's ordinary room reason: MethodResponse is response, MethodUse is response-use, None/Discard unknown. isRetrial does not introduce another use reason.
- Suppress CardAsked for isRetrial=true. Still clear continuing, consume the shared provided slot and preserve provided/AI/human distinctions, validation-null retry defaults and safe null normalization.
- Successful validateInResponse may convert the original selected card. Synchronize the validated physical wrapper before ChoiceMade, regardless of retrial.
- Suppress ordinary MethodUse/Response log/emotion/broadcast and the subsequent owned-card skill notice, direct movement/reveal/use/response/finish events and original after-hooks. Still emit ChoiceMade and return the validated card.
- MethodDiscard precedes the !isRetrial execution guard, so it still performs its request-skill log/notice and direct discard. None remains no automatic movement. The forbidden bare Slash pattern applies only to MethodUse, including when retrial=true.
- Validation-null recursion retains the retrial flag but resets omitted request skillName/provision options. It does not call an original after-hook for a failed conversion.

See [guards and acquisition, room.cpp:1614–1685](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1614-L1685), [post-choice branching:1730–1740](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1730-L1740) and [retry:1842–1847](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1842-L1847). Retrial acquisition is an internal capability, not a newly trusted client descriptor path.

## Judge state and result semantics

[JudgeStruct, structs.h:388–415](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L388-L415) contains who, card, pattern, patterns, good, reason, time_consuming, negative, play_animation and a cached private result enum. [Constructor/result implementation, structs.cpp:196–230](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.cpp#L196-L230) initializes who/card null, pattern '.', good true, time_consuming false, negative false, play_animation true and result UNKNOWN. QString/QStringList members have their ordinary empty defaults.

`updateResult` computes cached GOOD iff `good == ExpPattern(pattern).match(who, card)`; otherwise BAD. `isGood()` requires a computed result, and isBad negates it. `isEffected()` is negative ? isBad() : isGood(). **negative does not change the cached GOOD/BAD result.** The overload isGood(candidateCard) computes that match directly for AI without updating the cached state.

A web normalization should keep a JSON-stable shared judge identity, with an explicit unknown/good/bad cached state and a named trusted pattern matcher where the native ExpPattern implementation is not yet available. Supplying that matcher is not evidence that every native expression is implemented. Judge result recomputation is real module behavior, not a fixture callback that merely declares success. Reject unknown judge IDs, missing canonical card/effective ID and malformed fields before new irreversible work; do not emulate native null dereferences/assertion failure.

The surrounding [Room::judge, room.cpp:469–500](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L469-L500) holds a JudgeStruct pointer, wraps it in QVariant, emits StartJudge, iterates AskForRetrial over a captured getAllPlayers list until a trigger consumes, then FinishRetrial and FinishJudge. Shared judge content mutations are visible through the pointer. This outer loop and its GameRule drawing/finishing behavior must not be conflated with merely adding replacement support; preserve current implemented outer orchestration or explicitly label the boundary if it remains external.

StartJudge GameRule draws/moves the initial card and updates result. FinishRetrial logs the final card, may change pattern to the first matching alternative, and sends animation without recomputing result there. FinishJudge conditionally discards the current judge-zone card, with a Luoshen exception. See [gamerule.cpp:932–981](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L932-L981). These details provide boundaries, not an instruction to silently expand this slice into all judging content.

## Room::retrial replacement sequence

The full native sequence at [room.cpp:7934–7978](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L7934-L7978) is:

1. Null incoming card returns immediately.
2. Capture `triggerResponded = owner(incoming.effectiveID) == responder` and `isHandcard = triggerResponded && place(effectiveID) == hand`.
3. Capture oldJudge from the shared judge; assign judge.card to the room's canonical physical card at incoming.effectiveID **before logging or movement**.
4. Build new-card move: one effective physical ID to judge.who's judge zone, reason RETRIAL(responder, skillName, empty event).
5. Build old-card move: oldJudge.effectiveID from judge.who to responder hand when exchange=true, otherwise to null/discard. Reason OVERRIDE(responder, skillName, empty event) for exchange; JUDGEDONE(responder, empty skillName, empty event) otherwise.
6. Emit ChangedJudge with skillName, responder, judge.who and incoming effective ID.
7. Submit both moves together, new-card move first, old-card move second, force-visible=true.
8. If the captured triggerResponded is true, emit CardResponded targeted at responder. Its card is the incoming parsed/virtual card, who is the **then-current** judge.who, isUse=false, isHandcard=captured, isRetrial=true, and m_data is default QVariant (normalize null).
9. Return without updating result or invoking any validation/after-hook.

Atomic movement child events may mutate shared judge state or move records; this owner must not rebuild the captured old-card/move/ownership snapshot after suspension. Its already eager judge.card assignment is not rolled back by the current interruption policy. Event consumption/rewrites do not replace this owner's original card identity or trigger gate. Do not automatically reassign judge.card to a card chosen by a movement event or recompute result in the core owner; callers own their later update.

### Effective physical ID versus incoming descriptor

[Card::getEffectiveId, card.cpp:88–96](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L88-L96) returns the first subcard for a virtual card, -1 for zero subcards, or its own ID for a physical card. Room::retrial moves only this single effective ID into judge; it does not move every virtual material. The optional CardResponded still carries the original incoming virtual/parsed card. The judge.card uses [Engine::getCard, engine.cpp:555–571](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/engine.cpp#L555-L571), which resolves the canonical card in the current room, rather than an immutable engine template.

A normalized implementation should safely reject an incoming non-null response with no valid effective physical ID, and state this divergence from unsafe native inputs. A multi-material virtual incoming card is valid if its references and material locations are valid: core replacement still uses just the first effective ID, leaving other materials wherever package cost/movement put them. Do not falsely clean them all up as ordinary MethodResponse would.

## Guicai and Guidao representative package composition

The package eligibility gates stay explicit. Guicai is an AskForRetrial TriggerSkill, requires its base skill eligibility and has a hand/equip/hand-pile availability test. Guidao additionally checks available black equipment if kongcheng and no hand pile. Request admission still must enforce actual allowed card patterns and conversion/skill rules, rather than trusting arbitrary descriptors. See [Guicai:100–113](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-wei-generals.cpp#L100-L113) and [Guidao:939–962](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-qun-generals.cpp#L939-L962). If catalogue eligibility remains an adapter, label it; implementing cost/effect is not implementing every package admission predicate.

Cost behavior, from [Guicai:116–163](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-wei-generals.cpp#L116-L163) and [Guidao:965–1012](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-qun-generals.cpp#L965-L1012):

- Capture the shared judge pointer; build prompt from its current who, skill name, reason and current card effective ID. Ask responder for pattern '..' for Guicai or '.|black' for Guidao, MethodResponse, original event data, captured who and isRetrial=true.
- Null reply returns false with no package table movement/stack entry. Successful reply is the validated card returned by acquisition, not the original preconversion selection.
- Emit package #InvokeSkill and #Class_Resp logs, notifySkillInvoked and broadcastSkillInvoke. These belong to package cost, not the suppressed generic response notification branch. They do not imply ordinary showSkill/Huashen or original-card after-hook.
- After those notices, compute hand provenance using just the card's current effective ID owner/place. This is not the generic all-materials-in-hand algorithm.
- Move **all** current returned card materials to table with RESPONSE(responder, package skillName, empty event), using null source player so movement infers actual sources; no force-visible argument is passed, so native uses forceMoveVisible=false.
- Then construct CardResponseStruct with the returned card and the captured judge object's current who. isUse=false and isRetrial=false are constructor defaults; assign the effective-ID hand provenance and the original event data. Emit CardResponded. Consumption or payload replacement does not cancel package stack insertion.
- After the event, append the returned card's **current serialized string** to the responder's per-skill stack (`guicai_cards` or `guidao_cards`). Return true. Nested instances require LIFO behavior; do not flatten it to one slot or an effect-local card captured before CardResponded.

Native move defaults are declared in [room.h:385–391](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.h#L385-L391). Event rendering visibility and movement force visibility are distinct; package table movement's default false differs from core replacement's explicit true.

For the normalized package table record, use explicit open=true while retaining forceVisible=false. Native notification takes its move list **by value** ([room.cpp:5777–5795](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L5777-L5795)). Its recipient copy becomes open whenever from/to is public table and the reason is not SWAP, independently of the force flag ([room.cpp:5795–5812](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L5795-L5812)). Thus these Guicai/Guidao RESPONSE table moves are public to all notified players even with forceMoveVisible=false.

That recipient-copy assignment does not initialize the server's event field. Constructors leave the server scalar open uninitialized ([structs.h:252–310](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L252-L310)); merging copies it into the one-time move array ([room.cpp:5059–5065](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L5059-L5065)). BeforeCardsMove is dispatched before notification ([room.cpp:5163–5208](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L5163-L5208)); later CardsMoveOneTime uses the earlier merged snapshots, not the notification copies ([room.cpp:5298–5311](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L5298-L5311)). Explicit normalized event open is therefore a deterministic JSON policy, not native uninitialized server boolean parity. It must not turn the separate force visibility flag on; existing movement still owns subsequent trigger rewrites.

Guicai/Guidao use default TriggerSkill priority 3. The base constructor clears the per-event priority map ([skill.cpp:556–560](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/skill.cpp#L556-L560)); getPriority returns 3 and getDynamicPriority falls back to it when no event override exists ([skill.cpp:573–583](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/skill.cpp#L573-L583)). Neither pinned package class overrides these values.

Generic successful-cost reveal and Huashen handling belong to RoomThread between cost and effect. It calls cost, then only if cost succeeds calls the owning player's showSkill with the resolved position, records JustShownSkill if shown, and conditionally drops the Huashen card; effect runs afterward ([roomthread.cpp:468–492](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L468-L492)). Compose the scheduler's successful-cost reveal seam at that point. Acquisition suppression and the absence of ordinary card reveal inside package cost do not suppress this generic skill reveal responsibility, and the wrapper must not duplicate it after replacement.

Effect behavior, from [Guicai:166–184](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-wei-generals.cpp#L166-L184) and [Guidao:1015–1033](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-qun-generals.cpp#L1015-L1033):

- Empty stack returns false.
- Pop and persist the stack before parsing. Reparse the stored card string via trusted private card authority; parse failure returns false without replacement/result update and does not put the entry back.
- Read the judge pointer from the **current effect event data**, rather than assuming the cost-phase event still points at that same judge. Call Room::retrial on the parsed card, exchange=false for Guicai and true for Guidao.
- After replacement completes, updateResult on that captured judge object, then return false. This is not a response-after hook.

Serialization can use a trusted internal equivalent of Card::toString/Parse, but it must preserve the observable serialize-after-event and parse-at-effect boundary, nullable parse result, canonical physical lookup and nested stack order. [Card::Parse, card.cpp:501–668](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L501-L668) supports physical numeric IDs, virtual descriptors and SkillCards. For a numeric ID, it resolves the current room card's real card, not a frozen cost-phase clone. A JSON descriptor/reference plus a private codec can normalize the storage safely without reproducing the entire C++ parser, provided the adapter boundary is explicit and tested.

Because package cost moves the card to table before Room::retrial, the core's owner-at-entry gate is normally false and it does not emit a second retrial-flagged response. If a child event leaves/gives the effective ID to the responder, the core's captured gate can instead be true. Test both states; never hardcode “exactly one response” for all inputs.

## Complete source callsite inventory

A restricted literal inventory of all src C++ `retrial(` calls found five package calls plus the Room definition. Graph contexts did not resolve those callers, so source inspection supplies the inventory rather than claiming graph exhaustiveness.

| Package caller                                                                                                                                                               | Variant                                                                                                                                                                                 | Scope disposition                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Guicai](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-wei-generals.cpp#L116-L182)         | Response-acquire → table response/stack → retrial(false) → result update                                                                                                                | Representative wrapper in approved expanded slice                           |
| [Guidao](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-qun-generals.cpp#L965-L1031)        | Black Response-acquire → table response/stack → retrial(true) → result update                                                                                                           | Representative wrapper in approved expanded slice                           |
| [Huanshi, mol.cpp:607–669](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/mol.cpp#L607-L669)         | Similar nonexchange wrapper, separate availability/package policy                                                                                                                       | Additional package remains distinct                                         |
| [Midao, lord-ex.cpp:503–568](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/lord-ex.cpp#L503-L568)   | '@@midao' rice-pile selection, cost response hand provenance forced false, exchange replacement                                                                                         | Additional pile/phase package remains distinct                              |
| [Kongyun, comic.cpp:2502–2566](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/comic.cpp#L2502-L2566) | Red judge acquires hand card then immediate retrial(true) during cost; otherwise takes draw-pile-bottom card and custom old-judge-to-draw-bottom moves, with later effect result update | Additional custom replacement path, not covered by core Room::retrial alone |

No complete-package claim follows from this inventory. Lua/custom extension or runtime indirection may add behavior beyond this restricted pinned src C++ scan.

## Acceptance matrix

1. **Acquisition flag:** exercise each method with retrial true/false, suppressed normal events/notices/after-hooks, wrapper update and ChoiceMade retained, null/retry/provided branches, MethodUse Slash restriction, and MethodDiscard continuing to discard. Existing MethodUse/Response regressions must remain green.
2. **Core nonexchange/exchange:** actual scheduler and two-card atomic movement; eager canonical judge assignment; response/retrial/override/judgedone reason fields; current old judge card; forced visibility; optional response defaults and no automatic cached result update.
3. **Core card identity:** physical, virtual one/multiple materials, raw SkillCard conversion input, unknown/missing effective ID rejection; incoming event card distinct from canonical physical judge card; only first effective physical ID moves into judge, without inventing cleanup for other materials.
4. **Provenance gates:** capture owner/hand before children, including hand/equip/table/other-owner materials; later child changes cannot recompute the response gate. Postmovement recipient comes from the same shared judge object's current who. Response consumption/rewrites do not replace owner card identity or add duplicate replacement.
5. **Judge result:** explicit unknown/good/bad, good flag true/false, negative isEffected inversion, pattern matcher called with current who/card/pattern; no automatic core update, wrapper updates only after core completion. Shared judge state persists through JSON and event snapshots via stable reference.
6. **Representative costs:** exact Guicai/Guidao pattern/prompt snapshots and retrial ask; validated rather than original response; package notices; effective-ID hand provenance; all-material table movement with normalized open=true/forceVisible=false; false retrial response with original event data; serialize after CardResponded; LIFO insertion regardless of event consumption. No ordinary card reveal/onUse/history/after-hook is inserted inside cost. Priority is 3, and the separate scheduler successful-cost skill reveal/Huashen step runs before effect without duplication.
7. **Representative effects:** empty stack, pop-before-parse, parse-null consumption, current effect judge identity, exchange selection, later cached result update, false return; nested cost/effect stacks and round-trip canonical physical lookup. Table state normally suppresses the core's extra response; explicitly exercise a changed-owner alternative.
8. **Persistence and movement mutation:** suspend/resume at request/notices/table movement/response/core log/atomic movement/result update. Preserve captured old-card/moves/ownership and visible eager judge mutation. Wrong actor, stale/replayed prompts and registry mismatch do not double-consume or double-move. Current interruption keeps eager effects/frozen frames; native exception unwind is still separate.
9. **Boundaries:** real normalized replacement/result logic and representative cost/effect wrappers, with admissions, pattern grammar, card codec, canonical metadata, package notices/eligibility and production registration labelled as exact remaining adapters. Existing outer judge flow must be composed or explicitly marked external; not silently recreated as a callback proving full native parity.

## Evidence and limits

Native graph-first exact contexts resolved Room::retrial, Guicai cost, Guidao effect, JudgeStruct and updateResult. Room::retrial has no indexed incoming callers/processes, and the package contexts omit actual ask/retrial call edges. This is a graph coverage limitation, not absence of package behavior. Receipt: `tqs4ab3-retrial-graph.json` in Windows Temp. Source inventory and pinned citations independently substantiate the missing edges.

The native checkout is clean at the authority commit; existing index metadata lastCommit matches it. Current SHA256 hashes also match indexed fileHashes:

| File                                    | SHA256                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| `src/server/room.cpp`                   | `08a3abecf8534642fff67a3a3f437a6cd90a1e7603051ae06f5c3314060ad2df` |
| `src/server/room.h`                     | `0e3ad72cd2ff318ed1e2e4769bae03fef3d1e87249853018b349c2e0a543df33` |
| `src/core/structs.cpp`                  | `2427eed782f7d3ef2d01e4cafc8205139eda5173756b74d3ad08c0901b50c8a1` |
| `src/core/structs.h`                    | `44ecaa77ee801f1fe6d7b05726d76addf3defd8d4db08a0a5c87ba84db125ad4` |
| `src/core/card.cpp`                     | `9a79637c1b375462cf04610757e328397720bc4bca4d5fc9316b2152bc37c34c` |
| `src/core/engine.cpp`                   | `de62c7c6fd9dd9ac4ea962e6d4d093408b8733f7e3c1459720ce20806f1a76c0` |
| `src/core/skill.cpp`                    | `054fe5a146db399677040b9bd6cdc2f8aa6b8446d1335ff6fcf32b498fc5f905` |
| `src/server/roomthread.cpp`             | `1642f0794fb31413f3af10288ed70af7b6fbdbb94ab8f061bc2bce0699486a06` |
| `src/package/standard-wei-generals.cpp` | `2969590ae342b9e4fae3d65fd318304587026910e51d623b700ca2875ab606b5` |
| `src/package/standard-qun-generals.cpp` | `3b5b0db3f0d70ea9866541acaf5648212b6d7f6c609337e5071b621274ab171c` |
| `src/package/mol.cpp`                   | `5ec9999d149ff3f33e8c351f9de0ba2b8366a3b9e75bb55192fec4bf1e16f61f` |
| `src/package/lord-ex.cpp`               | `b0da35579523166c16b0fc629c78bf24bbb98b579e0617ab23a8e0c49aa03c77` |
| `src/package/comic.cpp`                 | `b0ce68d8837af7ba6cf88a6507791d87768b6f75639d79717abec10707cec131` |
| `src/server/gamerule.cpp`               | `807428c4d1ce39efbee0ac209298e3d059c03593accf63081cfe0cc420ce7a7a` |

No index rebuild, engine edit, native execution or new gameplay test was performed by this research worker. The accompanying implementation must provide its own impacts, behavioral test receipts and two review results.
