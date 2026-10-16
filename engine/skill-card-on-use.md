# Isolated SkillCard onUse

Part 4y adds `src/game/hegemony/skill-card-on-use.ts`, exercised through public scheduler dispatch/resume in `tests/hegemony/skill-card-on-use.test.ts`. The selected [native authority](../rules/source-authority.md) remains ce4e62b. [Source investigation](../research/skillcard-integration.md) records the exact C++ definitions and response-entry distinctions. [Checkpoint](../reviews/2026-10-15-hegemony-part4y.md) records revision-specific validation.

## Scope and input authority

`skill-card-on-use` accepts an initial SkillCard descriptor. It does not establish phase, skill possession, material ownership, availability, target legality, history or response-entry permission. The existing non-Skill `card-on-use` entry and `readCardUse` still reject SkillCards. Part 4z adds an explicit [shared execution domain](skill-card-execution.md) for GameRule/resources/effects and accepts in-GameRule replacements on return to the envelope. The additional SkillCard onUse metadata remains separately validated.

`SkillCardUse` adds `skillPosition`, `showSkill` and `willThrow` to the normalized card descriptor. Its skill name is the already normalized native `getSkillName(true)` result; raw underscore-prefix parsing is not performed here. Copies preserve package-supplied JSON identity metadata. Registries and descriptor callbacks remain outside serialized state. This checkpoint uses stable descriptor metadata, with current original-card flags/materials supplied by the explicit `cardState` identity adapter. It does not reproduce every mutation of a native card pointer or wrapper object.

Preflight rejects malformed player/target/card fields, duplicate or invalid material IDs, nonunique initial physical storage, invalid shared table/discard destinations and malformed required private room tags. A known deceased seat is not automatically illegal here. Pure card-state and actual-general callbacks receive isolated copies and validated outputs; late malformed values preserve prior eager state.

## Event envelope and snapshots

Capture the original source/card identity separately from the evolving event use. Before sorting/logging, append a nonempty original skill position to private room history keyed by normalized original skill name plus original source. Sort initial targets by action order; later rewrites retain supplied order. Use-log delivery is an explicit adapter. Its `hidden` flag is true for the initial SkillCard with `willThrow=false`; this flag alone is not a privacy projection.

Capture original card materials from the identity adapter after the log child and before PreCardUsed. Dispatch PreCardUsed and reload the local post-Pre use exactly at that boundary. Set HuanshenSkillChecking on that post-Pre source. If the post-Pre card is a SkillCard, invoke its supplied extraCost operation (or skip when the supplied cast/dispatch adapter returns null). If it is now non-Skill, move the pre-captured original materials to the table with use reason metadata. That branch does not call SkillCard extraCost.

Reveal through `showSkill` on the original captured player, using post-Pre showSkill/position. Clear the checking flag on the post-Pre source after normal reveal return. The required `afterShow` child owns native Huashen removal, trick-show package branches and their authority; these behaviors are not silently implemented by an empty fixture.

Read the original card's current flags through `cardState`; skip TargetSelected only for its slashDisableExtraTarget flag. Then dispatch CardUsed and CardFinished. All these events retain the original player as recipient, while shared event data can carry rewritten source, targets and card. Event consumption ends that event according to the scheduler but does not cancel the outer envelope. Operation child return values are void at these boundaries and never replace shared use data.

After CardFinished, query the original card identity's current materials and discard only IDs still physically on table. Do not sweep unrelated cards or materials already claimed by children. Cleanup reason keeps original source/skill/card name and the post-Pre local target/use snapshot. Later event rewrites cannot replace that local reason. Finally pop a nonempty position history using the post-Pre skill name/position and original source. A rewritten key can intentionally leave the original history entry behind, matching the source's distinct push/pop lookups.

## Default and overridden extra cost

`skill-card-extra-cost` implements the default normalized SkillCard cost: when willThrow is true, move its supplied post-Pre material IDs directly to discard with open=true and throw reason. Actual head/deputy name metadata comes from the private `generalName` adapter, using the post-Pre source and skill position. When willThrow is false, no throw/general-name lookup occurs. A package override replaces this default; it does not run in addition to it.

The four existing reward-token cost operations can be composed here. They consume their native marks, including careerman's @careerist, independently of token use. The HalfMaxHp fixture CardUsed adapter reaches the existing token-use operation and actual fixed-pile draw movement. That evidence verifies the stated composition; it does not make the fixture CardUsed bridge a production GameRule handler or implement deck replacement/recycling.

## Continuations, privacy and remaining integration

Each event and registered operation is a serializable child boundary. JSON reload and rejected replies must not repeat completed costs, child effects, reveals, movement commits or final history cleanup. Turn-broken, stage-change and game-over freeze the existing scheduler frames and preserve eager costs, flags and histories. Native exception unwind and interrupted-path restoration remain later work.

The new module returns authoritative use data to its private caller. It does not publish a battle view or notifications. Raw descriptors, frames, private cost metadata and room history must remain server-side. `notifyUse`, reveal and post-show callbacks are transport/package authorities; tests verify prompt routing and omission of private metadata from the tested results, not complete production projection safety.

Part 4z now composes actual shared GameRule CardUsed/CardFinished, resources and effects; see [the shared execution contract](skill-card-execution.md). The preceding HalfMaxHp fixture-bridge evidence describes Part 4y only. The next dependency is generic admission and distinct response entry integration. Generic legality, Room::useCard validation/history, pure response versus response-use entry points, enabled content, UI/network registration, native runtime differential and full-match E2E remain required before production enablement.
