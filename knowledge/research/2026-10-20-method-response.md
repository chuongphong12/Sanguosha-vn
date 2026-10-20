# Part 4ab.2: MethodResponse request lifecycle

Investigation dated 2026-10-20. Game inspected at `9fec1e3dc4d4fcb9aac66f71413b189329bb68a0` (4ab.1 implementation `416bc11380eb1b7c21b864efb4964b8e5c510251`), with canonical knowledge at `4c83fc030fc01192d533575e3f0ad2caf7fea073`. Native authority remains QSanguosha-QuocChien 2.3.43-beta2 at `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. This is research and acceptance guidance, not evidence that the proposed operation has shipped.

## Finding and scope

MethodResponse needs its own direct execution envelope, composed with the acquisition/provision/retry behavior already implemented for MethodUse. Its response reason, payload, movement reason, after-hook and provision-sensitive cleanup differ. Do not infer the lifecycle from card name: ArcheryAttack requests Jink using MethodResponse, whereas the existing Slash defense entry requests Jink using MethodUse. Duel requests Slash using MethodResponse. The current [MethodUse contract](../engine/direct-card-use.md) and [4ab matrix](2026-10-20-part4ab-response-matrix.md) retain their authority for 4ab.1.

Recommended next slice: a registered MethodResponse request operation with real scheduler and movement, using the same room-wide provided-card slot and preserving the existing MethodUse API. An independent response factory can share explicit acquisition contracts without turning MethodUse into a silently broader public API. Permanent implementation must follow its approved design and exact-symbol impacts; this note does not prescribe a speculative generic framework.

## Native contract

All source links below are pinned to the authority commit rather than a moving branch.

### Acquisition and retries

`Room::askForCard` sets the requested pattern and `CARD_USE_REASON_RESPONSE`, emits CardAsked for MethodResponse/MethodUse unless retrial or continuing, clears continuing, then consumes provided state before requesting a card. Provided state includes explicit null; a dead player with an empty slot takes the no-card branch. Native calls the limitation predicate on provided/AI selections, while human parsing/admission is a separate branch. See [entry and acquisition, room.cpp:1610–1669](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1610-L1669).

Retain the safe 4ab.1 normalization: provided null/dead empty slot returns nil without invoking a non-null limitation callback. Non-null conversion runs on the original selected card. A validation-null result sets continuing and recurses without ChoiceMade for that failed conversion. The recursive native call retains actor/pattern/prompt/data/method/to/isRetrial but omits skill name and isProvision, so they reset to their defaults. Default declarations are [room.h:421–424](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.h#L421-L424); recursion is [room.cpp:1842–1847](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1842-L1847).

`provide` is one room-wide slot, not a slot per operation kind or cursor; the native assertions reject duplicate provision even when the first value was null. Both request factories must therefore use the existing `provideCard` state. Nested requests may consume that shared value. See [room.cpp:7815–7821](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L7815-L7821).

### Provenance and snapshots

After successful response validation and wrapped-card/log notifications, native computes hand provenance from the validated card's then-current physical material IDs **before ChoiceMade**. It is true only for a nonempty set entirely owned by the responder in hand; zero-material, mixed-zone or another player's material makes it false. ChoiceMade follows; owned-skill notice follows ChoiceMade; actual initial movement IDs are read **after** those steps. These two snapshots must remain separate even if ChoiceMade mutates material metadata or locations. See [room.cpp:1671–1746](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1671-L1746).

### CardResponseStruct payload

The MethodResponse branch constructs `CardResponseStruct resp(card, to)`, assigns hand provenance and original request data, and wraps it for CardResponded. The recipient is the nullable `to` argument; the responder is the event target, not a fallback recipient. The relevant constructor sets `m_card`, `m_who`, `m_isUse=false`, `m_isRetrial=false`. Native constructors do not initialize m_isHandcard, but this entry explicitly assigns it before use. `m_data` is a QVariant overwritten by the caller's supplied request data. See [structs.h:436–483](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/structs.h#L436-L483) and [room.cpp:1801–1806](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1801-L1806).

A normalized JSON payload should represent all these defined values explicitly, including nullable recipient and data. It must not claim undefined native constructor fields as default booleans. The card descriptor/reference is private engine data and should retain rich metadata through the existing resource contract.

### Response execution and ownership

The sequence is:

1. Capture initial IDs from the current validated card after ChoiceMade and skill notice; construct the response snapshot.
2. Move each captured material to table atomically and openly with S_REASON_RESPONSE and current skill/position/general movement metadata.
3. Run showSkill and conditional Huashen drop.
4. Dispatch CardResponded targeted at the responder with the captured response payload.
5. Unless isProvision, resolve current materials of the original validated card and discard only those still on table, with the response movement reason.
6. Invoke the **original selected card's** `validateInResponseAfter(player)`.
7. Return the original validated card identity (with current private metadata where the web resource contract resolves mutable native identity).

Owning source: [room.cpp:1801–1847](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L1801-L1847). The base hook defaults to a no-op, but virtual/package overrides remain meaningful: [card.cpp:984–996](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L984-L996).

CardResponded's trigger return and rewritten QVariant are not read back by this owner. Consumption may stop subsequent event listeners under scheduler policy, but does not cancel this owner's cleanup or after-hook. Event payload replacement must not replace the returned response, the original-card after-hook identity, or the validated identity used for cleanup. Materials already moved elsewhere by child events must not be discarded twice. Cleanup must not freeze the initial ID snapshot or follow an event replacement card.

isProvision skips only final table discard. It does not skip initial movement, reveal, CardResponded, after-hook or return. MethodResponse does not dispatch PreCardUsed, CardUsed or CardFinished, add Room/onUse history, or execute the MethodUse cardNotTriggerCardFinished flag-clearing/suppression path. Native has no flag-clearing step in this branch. Unsupported MethodNone/Discard/retrial execution and rescue remain distinct later slices.

## Concrete package callers

- [ArcheryAttack::onEffect, standard-tricks.cpp:140–158](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-tricks.cpp#L140-L158) asks `jink` with MethodResponse, effect data, and source-or-null recipient. A non-null result prevents damage. This source establishes a caller contract; adding a test composition does not constitute a full ArcheryAttack package port.
- [Duel::onEffect, standard-tricks.cpp:323–372](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/package/standard-tricks.cpp#L323-L372) asks `slash` with MethodResponse, effect data and opponent recipient, including sequential Wushuang requests. Non-null replies swap the participants; null exits toward damage. MethodUse's forbidden bare `slash` pattern must not be accidentally copied to MethodResponse.

## Acceptance cases for implementation

1. Dispatch/resume a registered MethodResponse operation through real scheduler/movement. Exercise Jink and Slash patterns; assert response reason, exact CardAsked/ChoiceMade/CardResponded ordering, movement response reasons, and absence of envelope-added use/finish/history.
2. Exercise shared explicit-null/non-null provision, duplicate rejection, dead-actor behavior, AI limitation and human-adapter distinctions, conversion to a distinct registered identity, validation-null retry defaults, and nested cross-method provision/room-state behavior. Keep all existing MethodUse behavior and API tests green.
3. Assert response payload fields, nullable recipient/data, false use/retrial flags, and hand provenance for physical, virtual, zero-material, mixed and other-owner materials. Move/change materials during ChoiceMade to prove pre-choice provenance and post-choice initial IDs are independent.
4. Mutate CardResponded payload and consume the event; prove original validated return, original selected after-hook and current validated-material cleanup remain independent. Include distinct references, rich metadata, SkillCard conversion, material mutation and child movement away from table.
5. Provision true leaves current response materials on table but still performs all other steps. Show flags remain intact even when a MethodUse finish-suppression flag is present. Conversion-null retry resets provision false.
6. JSON pause/restore at request/validation/notifications/reveal/CardResponded/movement/after-hook must not duplicate payment or effects. Wrong actor, stale/replayed prompts and registry mismatch must fail under scheduler rules. Keep native interruption unwind explicitly deferred rather than inventing rollback.
7. Compose a small caller-owned request/result operation reflecting an actual ArcheryAttack or Duel contract. Identify package, damage and UI fixtures explicitly. This does not enable production game content or a network request gateway.

Catalogue admission, transport/authentication, AI normalization/delay, package conversion, reference metadata, wrapped/log notices, skill/reveal/Huashen and native movement metadata remain named adapters. A completed library operation cannot by itself establish playable Quốc Chiến or full package parity.

## Investigation evidence

Native checkout was clean at the pinned commit. Graph metadata lastCommit matches it; no index rebuild occurred. Graph-first queries identified askForCard overloads, then exact UID context resolved the nine-argument implementation at room.cpp:1610–1848. The graph resolved only the five-argument wrapper as an incoming CALLS edge, so direct source verification was necessary for package callers; graph absence is not proof of no caller. The compound query returned definitions but no processes. No native runtime or new gameplay test was executed by this investigation worker.

SHA256 hashes below were computed from inspected bytes and equal the existing native index's fileHashes:

| File                              | SHA256                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| `src/server/room.cpp`             | `08a3abecf8534642fff67a3a3f437a6cd90a1e7603051ae06f5c3314060ad2df` |
| `src/server/room.h`               | `0e3ad72cd2ff318ed1e2e4769bae03fef3d1e87249853018b349c2e0a543df33` |
| `src/core/structs.h`              | `44ecaa77ee801f1fe6d7b05726d76addf3defd8d4db08a0a5c87ba84db125ad4` |
| `src/core/card.cpp`               | `9a79637c1b375462cf04610757e328397720bc4bca4d5fc9316b2152bc37c34c` |
| `src/package/standard-tricks.cpp` | `409ffb8f632ac04c42ec8eb24c9adee3c97247579952f407ba393b81e87835b6` |

Local graph receipts are `tqs4ab2-native-graph.json`, `tqs4ab2-native-detail.json` and `tqs4ab2-native-askcontext.json` in the task's Windows Temp directory; source links and hashes above make the note independently checkable without relying on these temporary receipts.
