# Physical movement and wrapped cards

Baseline: game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Owning source: `src/game/hegemony/movement.ts` and `wrapped-cards.ts`. Public cases live in `tests/hegemony/movement*.test.ts`, including classification, metadata, scenario, SixDragons, ImperialEdict, ImperialOrder and wrappers. Native references below refer to the [pinned source](../rules/source-authority.md), primarily `src/server/room.cpp` 4982–5774 and `src/core/structs.h`.

## Physical ledger and event sequence

`createCardMovementOperation` supplies `move-cards`. Input is `{ moves: [{ ids, to, from?, bottom?, reason?, ... }] }`; the authoritative store maps concrete zone keys to place, owner and physical IDs. Supported places are hand, equip, delayed, judge, special, draw, discard, table and wugu. Player places require a seat owner; shared places have none; special piles require a name. IDs have one physical source.

Canonical packets retain per-card source zones, physical source places, named piles, visibility, origins, destination metadata and `lastHandcard`. Supplied source hints must match current physical storage even after nested movement. A package may deliberately replace a Before packet without hints to rederive current sources; an untouched packet cannot silently rebase. Same-zone no-ops remove aligned entries from every per-card array, except draw-to-bottom rearrangement.

The owning sequence (`room.cpp` `moveCardsAtomic`, 5163–5315) is:

1. Normalize initial packets and emit BeforeCardsMove for each living actor. Consumption cancels the whole outer movement.
2. Apply the current Before result, package rewrites, separation, origin/last-hand calculation and notification merging. Emit ConfirmMoveCards for each living actor. Confirm payload rewrites propagate among confirmations but do not retarget the fixed physical batch.
3. Validate sources again; stage all source removals before destination additions on a copied ledger. Commit one validated physical/wrapper state. Draw-top and discard prepend per card, reversing input-group order; draw-bottom, hand and table append as specified.
4. Emit PreCardsMoveOneTime then CardsMoveOneTime with shared rewritten data. Post consumption or rewrites cannot undo the commit.

Living actor order is current-first and freshly snapshotted for each movement stage; the general trigger frame itself can still visit deceased seats. Nested committed children survive a later stale outer-source rejection. Confirm prompts retain an uncommitted outer batch through JSON reload; exact-once resume does not pay a nested cost twice. Interrupted frames retain whether the physical commit occurred, without manufactured cleanup.

## Classification is normalized, not native pointer order

Native classifiers live in `src/server/room.h` 514–617, with merge/separate logic in `room.cpp` 5000–5142 and breakdown at 5492–5524. Initial cards merge by source owner and concrete destination. After Before rewrites, separation considers source owner/place/pile, destination, visibility, structurally equal JSON reasons and incoming last-hand flag. Owner-wide hand depletion is then calculated before merge/action ordering.

An ownerless source uses destination owner for current-first ordering; wholly ownerless packets go last. Equal action-order ties retain input order. Different draw-top/bottom destinations remain distinct. Merged packets keep their first reason because the native merge key omits reason. Concrete zone keys remain distinct where native owner/place identity could coincide. This deterministic contract does not emulate a non-total Qt pointer comparator or native wire serialization.

## Package rewrites

All rewrites occur after Before and before Confirm. Their configuration comes from package adapters, not enabled native content.

| Branch | Implemented semantics | Explicit boundary |
| --- | --- | --- |
| Scenario cards | RuleTheWorld, Conquering, ConsolidateCountry and Chaos destined for discard divert to wugu, preserving reason and aligned per-card metadata. | A generated wugu-to-wugu no-op leaves the original discard move intact, even across distinct concrete keys for shared wugu. |
| SixDragons | Recipient's post-Before equipment snapshot determines horse eviction and incoming-horse discard. Generated defensive/offensive/special horse order follows native equipment order; reason is `{ kind: "put", actor: recipient, skill: "SixDragons" }`. | Simultaneously arriving SixDragons is not already equipped. An equipped horse scheduled to leave still participates in the snapshot. Repeated generated physical IDs reject. No equipment-use legality or install hooks are implied. |
| ImperialEdict | A living recipient's incoming equip card routes into its exact special pile `ImperialEdict`; fresh reason is null and normalized visibility defaults false. | A dead recipient retains the equip request without pile validation. Native eager logical-pile membership is not reproduced by duplicating the physical ledger before commit. |
| ImperialOrder | Discard diverts to wugu except exact normalized use reason with `use.cardClass === "ImperialOrder"`, representing nonnull native used-card ancestry; virtual use can qualify. | Eager `imperialOrder: { invoke, cardID }` tags are written before replacement breakdown/Confirm/commit. Last eligible normalized scan card wins, including a generated no-op. These side effects survive a later outer rejection and are not queued or rolled back. |

Source: `room.cpp` 5317–5489 (`changeMoveData`/`cheakMoveData`), `src/package/standard.h` Horse/SixDragons and `src/core/player.cpp` horse order. Original IDs are removed only when their generated replacement survives physical breakdown. This rule corrects an earlier checkpoint's mistaken scenario no-op interpretation.

ImperialOrder's NotActive consumption, hidden-player choices/effects and absent-ImperialEdict insertion remain unported (`gamerule.cpp` 456–510; `strategic-advantage.cpp` 1141–1223). ImperialEdict direct actions/attached skills and eager logical pile bookkeeping also remain separate gates. Static fixture classes must eventually agree with current wrapped-card ancestry.

## Wrapped-card lifecycle

Separated physical `cardPackets` remain in the serializable continuation; reconstructing them from merged Confirm notifications loses reset/filter boundaries. At commit, native order is all removals → lose updates → all mappings → get updates → additions/final flags. The JSON adaptation stages valid metadata synchronously with physical storage before post events (`room.cpp` 5242–5284).

- Modified cards ending in discard reset to their engine face while preserving wrapper flags/tags and clearing modified; later final movement visibility updates can mark them modified again.
- Delayed tricks restore original suit/number while retaining converted class/name/skill. Player-source lose handling and shared-source addition have distinct native restoration moments.
- Recipient hand/equip/judge/special packets are refiltered even when the recipient is dead. Ordered eligible pure filters run over the whole packet, with passes bounded by filter count; a match keeps the pass nonconverged even when output is unchanged.
- Filters receive isolated inventory and all-destination mappings, representing native before-add observation without violating one-location storage. Discovery of FilterSkills, hidden/shown eligibility, ViewHas and package conversion remains adapter work.

Native evidence: `room.cpp` 5733–5774 and 5987–6062; `src/core/roomstate.cpp` 40–50; `src/core/wrappedcard.cpp` 36–76. JSON wrappers store face, suit/number, skill, modified, flags and tags; they do not model real-card pointers or live subcards. `forceVisible` is independent of packet `open`. A throwing filter or invalid face leaves staged physical/wrapper storage unchanged, preserving prior children and eager rule tags.

All raw zones, wrappers, package snapshots and movement payloads remain server-private. Equipment install/uninstall, delayed-trick hooks, full package semantics and per-recipient movement visibility/network notification adapters are required before this ledger can support playable content.
