# Shared SkillCard execution

Part 4z composes the [SkillCard onUse envelope](skill-card-on-use.md) with the existing shared GameRule, resources and effect operations. [Ticket #17](https://github.com/chuongphong12/Sanguosha-vn/issues/17), the [pinned-source investigation](../research/skillcard-shared-execution.md) and [checkpoint](../reviews/2026-10-16-hegemony-part4z.md) define its scope and evidence. Game code is attributed by [source-baseline.json](../source-baseline.json).

## Execution and entry domains

`CardUse` in `src/game/hegemony/card-on-use.ts` now explicitly describes basic, trick, equip and skill cards for shared execution. `readExecutionCardUse` validates that domain, known source/target seats, unique recipients/material IDs and normalized card strings/flags. It preserves extra JSON metadata by cloning. This reader establishes shape, not permission to play a card.

`readCardUse` remains the non-SkillCard guard used at the existing `card-on-use` entry and its pre-dispatch reloads. `skill-card-on-use` still validates its additional skillPosition/showSkill/willThrow metadata separately. After shared CardUsed execution and CardFinished, both envelopes accept the shared domain when reading back results, so an in-GameRule rewrite to a SkillCard can finish. Original and post-Pre SkillCard snapshots keep their required onUse metadata. A whole-card replacement after shared execution needs only the shared descriptor; old skill-only fields are not copied onto it. This does not broaden the pre-CardUsed entry contract or implement native admission/conversion.

The shared reader is used by CardUsed validation, its event reloads and GameRule result, CardFinished, common Card::use resource loading, CardEffect validation, and the generic card-reference decoder currently named `readSlashCard`. That decoder is also used by damage/recovery; its name does not imply that every referenced card has Slash ancestry.

## Source-preserving composition

Native GameRule CardUsed has no TypeSkill exclusion. The existing [target snapshots and resource rules](card-use-and-effects.md) therefore apply to SkillCards too. Optional preAction and overridden use are void child operations. Targetless uses still call them. Consumed target events do not cancel the outer SkillCard; consuming CardUsed before GameRule skips its body while the envelope can finish normally.

Reference identity, current native string key and descriptor type remain distinct. Current supplied ancestry controls Jink preparation and Slash-specific cleanup; current NDTrick ancestry controls HegNullificationTargets cleanup. Normal CardFinished clears only the latest reference's flags, retaining unrelated reference storage and other tags. Wrapped-card faces/modified state survive that cleanup. Resource preparation and common effects preserve the existing original/local/shared snapshots across skill/basic/trick/equip/Slash rewrites.

Default SkillCards inherit common Card::use; package overrides are dispatched by the supplied registry. Common effects derive multiple from the captured target count. A dead non-Slash recipient gets PostCardEffected without CardEffect/CardEffected. A nullified non-Slash SkillCard is consumed by GameRule CardEffected. A SkillCard does not automatically become a trick or invoke trick cancellation. CardEffectConfirmed rewrites do not replace the local onEffect payload.

Generic recovery/damage references can retain a SkillCard descriptor and reference. The concrete native JieyinCard recovery sets recover.card=this. The recovery test composes actual recovery with such a reference; the damage tests exercise explicit SkillCard and null references through actual damage/HP operations. This is not a claim that Jieyin or a damaging general package is enabled. Do not attach an origin card where the native package uses a null/reason-only damage overload.

## Actual operations and remaining adapters

`tests/hegemony/skill-card-execution.test.ts` registers actual onUse/default cost, movement, CardUsed/GameRule, resources/CardFinished, common use/Room effects/GameRule CardEffected, damage and recovery operations. Nested SkillCard and Peach uses pass through these registered operations. All four existing reward-token cost/use bodies are exercised through actual CardUsed; Careerman's direct FirstShow.use branch does not create a second envelope or spend @firstshow.

The reference-to-class mapping, package dispatch, reveal/post-show, choice/target selection, cancellation result and notification delivery are named fixtures. The fixed-pile draw fixture delegates actual movement and real fill-hand, but assumes sufficient cards and does not implement draw replacement, recycling or RNG. Token Peach composes actual non-Skill onUse, common effects and recovery with its Peach reference. FirstShow actual names appear only in the requester-only private fixture; public notices and actor-filtered prompts omit them. Raw authoritative game state, traces and operation completions remain private.

JSON reload tests pause at shared operations, target/finish events, recovery and actual token draw movement. Invalid/stale/wrong-actor/replayed/registry-version replies cannot repeat completed work. Turn-broken, stage-change and game-over retain paid costs and freeze incomplete frames; no native exception unwind or synthetic CardFinished is added. Malformed early inputs reject before shared effects/resources mutate; malformed late effect data leaves earlier paid movement committed.

## Next dependency

Admission/history, phase and skill ownership, availability/material/target legality, and distinct play/response-use/pure-response paths remain a separate slice. Live catalogue/identity authorities, full mutable native pointers, production registration/privacy/transport, exception unwind, native runtime differential and full-match E2E remain later gates. Production still uses Standard2013 until the approved playable-replacement cutover.
