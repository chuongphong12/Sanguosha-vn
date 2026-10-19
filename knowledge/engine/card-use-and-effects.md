# Common card use, resources and effects

Baseline: [current source metadata](../source-baseline.json). Part 4z explicitly extends shared execution to SkillCards; see [the execution domain and adapters](skill-card-execution.md). Owning source is `src/game/hegemony/card-on-use.ts`, `card-used.ts`, `card-resources.ts`, `card-use.ts`, `card-effect.ts` and `card-effected.ts`; corresponding `tests/hegemony/card-*.test.ts` exercise public operations and compositions. Native authority: [pinned source](../rules/source-authority.md), `src/core/card.cpp` 746–934, `src/server/gamerule.cpp` 537–629/794–816, `src/server/room.cpp` 4445–4463/6620–6644.

## Non-Skill onUse owns original materials

`card-on-use` captures the original card/source/materials, a separate post-PreCardUsed use and the latest shared event use. Initial targets sort by current action order; later event rewrites retain their supplied order. Original materials are captured before PreCardUsed; post-Pre use supplies put-on-table reason data. Material movement composes the real `move-cards` operation, including package rewrites.

TargetSelected, CardUsed and CardFinished preserve their caller-specific consumption policy: consuming an event or canceling the put child does not automatically cancel the whole onUse lifecycle. Empty virtual materials still emit empty put notifications; empty cleanup emits no movement. CardFinished occurs before fallback discard and can claim materials through nested operations. Cleanup discards only original materials still physically on a table zone, using original source/card identity and the local post-Pre snapshot for reason fields. Unrelated table cards and rewritten replacement materials are not swept up.

Preflight validates adapted card/use shape, source/targets, basic/trick/equip type, unique nonnegative integer materials, initial unique physical storage and shared table/discard configuration. Ownership, ordinary availability, target legality and card-specific preparation remain package/caller authorities. The separate [Part 4aa Room wrapper](room-use-and-admission.md) provides normalized parser/history/conversion normal paths around it; native exception unwind remains pending. SkillCards enter their separate onUse envelope. Its initial/pre-dispatch non-Skill guard remains narrow; result reloads after shared CardUsed/CardFinished accept the explicit execution domain, including a rewritten SkillCard.

## CardUsed target snapshots

Priority-zero GameRule `card-used` runs after players in that band; earlier CardUsed consumption skips GameRule's pipeline while outer onUse can still finish. Optional pre-action precedes Choosing. Its void result and the registered use child's result do not replace shared use; only target events rewrite use data.

Post-Choosing targets form the fixed Confirming candidate list. Each candidate is visited only if still present in latest targets; additions do not extend the loop, and empty targets stop confirmation. Post-confirmation source/targets then define Record and fixed-length indexed Chosen/Confirmed loops. Later rewrites change the event payload but not those loop lengths, captured Chosen source or Confirmed recipients. The latest payload gets each loop index before dispatch and reaches the final use child, even with no targets. Known dead targets are not silently filtered. Consumption of these target events is ignored by this native caller.

## Resource identity and normal cleanup

`card-resources.ts` separates reference object IDs from current native string keys. Distinct virtual references can share a key while retaining different flag/tag storage. Wrapped references point to physical wrapper storage with canonical numeric-ID keys. These are normalized identities, not native mutable pointers/subcards.

Before Record, a post-confirmation Slash source's `Jink_<key>` list is backed up and replaced with one `1` per target. Only a nonempty backup is restored after the use child, at the latest shared source/card/current key, even if rewrites selected a non-Slash. Empty/absent/non-list native backups normalize to empty. This snapshot is separate from [Slash's per-target consumption](nullification-and-slash.md).

Global card flags append `_ALL_TARGETS` and `_ALL_PLAYERS` to latest nullified/disresponsive lists without deduplication. Preparation eagerly writes room `CardUseNullifiedList` and card `CardUseDisresponsiveList`; nested uses do not restore them. Missing normalized lists default empty; supplied null/malformed lists reject.

Priority-zero CardFinished clears latest reference flags, removes `<key>HegNullificationTargets` only for a nondelayed trick and latest source `Jink_<key>` only for Slash. Other tags, including effect lists, remain. Wrapped modified state survives `clearFlags`. Earlier consumption skips GameRule cleanup, while outer fallback material movement can still occur. No interrupted-path cleanup is inferred.

## Common Card::use and Room cardEffect

`card-use` snapshots source/card/ordered targets and the current room/card effect-list tags at entry. Payload lists reach effects only through the earlier resource preparation. Each original target gets `multiple`, nullified and disresponsive booleans. Before each child, `targets<current key>` receives the remaining original targets minus nullified entries; dead seats remain in that list. The original reference's current key is reread for each write and final removal, even with zero targets. Key changes can leave earlier tags behind; nested same-key use deletes its tag without restoring the outer one. Child rewrites do not replace snapshots.

`card-effect` retains its original local effect/recipient separately from mutable event data. If the original recipient is alive at entry or the original current ancestry is Slash, it emits CardEffect then CardEffected; it does not recheck after CardEffect. Payload recipient rewrites do not redirect those recipients, and CardEffect consumption is ignored. Unconsumed CardEffected returns true; consumption returns false and removes Global_NonSkillNullify from the original recipient. Dead non-Slash skips those two events and returns false. Every normal path emits PostCardEffected at the original recipient; terminal consumption/rewrites are ignored. Nullable sources remain null.

## Priority-zero CardEffected

GameRule captures latest shared effect on entry. A nullified non-Slash consumes immediately. Otherwise a current trick delegates cancellation. Cancellation true adds Global_NonSkillNullify once to the local recipient and consumes. False/non-trick emits CardEffectConfirmed, then calls onEffect only if that local recipient is currently alive or current ancestry reports Slash. A recipient killed during cancellation still reaches Confirmed before this late check. Nullified Slash continues to its SlashEffected rule.

Confirmed sees a separate clone; its consumption/rewrites do not replace local effect or outer event data. Cancellation must return boolean; onEffect is void. Normal GameRule completion returns false to the trigger, making the enclosing Room result true. A recipient rewritten before GameRule can retain its cancellation flag while Room cleans only its original recipient's flag. Preserve these result/identity distinctions.

All resource ledgers, materials, frame payloads and callback snapshots are authoritative-only. Descriptor factories/predicates receive copies and remain external to JSON state. Late malformed outputs preserve earlier eager tags/committed movement. Package effects, live ancestry/discovery/conversion, full use legality/history, SkillCard admission/response integration, transport and exception unwind remain separate gates. [Cancellation and responses](nullification-and-slash.md) and [HP flow](damage-and-rescue.md) provide later normalized seams, not automatic production registration.
