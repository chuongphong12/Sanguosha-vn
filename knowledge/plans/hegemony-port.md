# Quốc Chiến port plan

This is the current roadmap derived from the source baseline in [source-baseline.json](../source-baseline.json), not a replay of past session logs. The sole target is the [pinned Quốc Chiến source](../rules/source-authority.md). Keep TypeScript, PixiJS and boardgame.io; replace the old Identity product at the final cutover.

## Foundation already present

| Checkpoint group | Implemented scope | Boundary still requiring integration |
| --- | --- | --- |
| Parts 1–2 | Paired setup/projection and identity-domain transitions/relationships | `ready` is setup completion, not battle; injected offers/catalogue need production dealing and authority wiring |
| Part 3 | Serializable trigger scheduler, handler registry and dispatch/resume | Package handlers and network command/timeout policy are external |
| Parts 4a–4h | Normalized physical movement, packet classification, selected special-card routing and wrapped-card lifecycle | Full package/equipment hooks, transport visibility and interruption cleanup |
| Parts 4i–4o | Common non-Skill card-use/resource/effect/cancellation and Nullification response/counter contracts | Live card/package identity, overrides and enabled content |
| Parts 4p–4s | Slash/Jink, damage/HP/chain, dying/rescue/recovery, death/burial/reward/victory pipelines | Concrete package predicates, commands, phase orchestration and full-match wiring |
| Parts 4t–4w | Careerist recruitment, show/hide/reveal rewards and private visibility/relationship consumers | Production authority synchronization, package/notification policy and remaining general operations |
| Part 4x | Normalized halfmaxhp, companion, firstshow and careerman token methods | Generic SkillCard legality/event/cost/use and response integration before registration |

These checkpoints complete their stated library slices. They do not certify every native package, a production battle or a full-match E2E run. Current architecture and privacy boundaries are described in [architecture](../engine/architecture.md).

## Next dependency and remaining work

1. **Specify and implement generic SkillCard integration.** Preserve availability/target checks, extra cost, event/cost/use and response legality as distinct native callback boundaries. Compose existing reward-token methods through public dispatch/resume tests before enabling tokens. Do not broaden the common non-Skill CardUse contract implicitly.
2. **Complete core lifecycle composition.** Wire phase/turn progression and remaining normalized behavior, including deferred ImperialOrder/end-of-turn work and general removal/transformation as required by enabled content. Implement interruption/unwind and resource cleanup; test exceptions, consumed events, nested prompts and reload at relevant boundaries. Preserve eager child effects according to the native contract rather than assuming transaction rollback.
3. **Define enabled content and a playable slice.** Pin package/card/general metadata, legal actions, identities and RNG/dealing. Only selectable content with executable handlers and conformance coverage may enter the manifest. Audit package overrides and source discrepancies; any approved departure from native executable semantics must be explicit. The careerist recruitment-bonus discrepancy needs coverage before production enablement.
4. **Integrate the application.** Establish the registered Quốc Chiến boardgame.io state, authenticated moves and continuation responses; synchronize private authorities. Implement reconnect/timeout behavior, projection, local/online/bot consumers and Pixi controls. Drive controls from actual engine contracts and test hidden information across view, notifications and assets.
5. **Validate complete matches and cut over.** Exercise setup through winner with enabled content, multiple actors, invalid/stale/duplicate replies, nested skills, deaths and reconnect/reload. Run source-derived conformance scenarios and native runtime differential tests where claimed. Replace server/client registration, then remove Standard roles/setup/handlers/types and obsolete tests. Old matches/saves require an explicit incompatibility/migration policy.
6. **Port the remaining packages/scenarios in bounded slices.** Each enabled addition gets its own source authority, tests, integration/privacy checks and checkpoint. Report a partial roster honestly; do not label an unported source package supported.

These are dependency groups, not fixed-duration tickets or a claim that six small coding sessions remain. Content breadth and cross-package interactions need specification before a reliable completion estimate.

## Gate before advancing each slice

- Rebuild relevant knowledge from the pinned primary source; define observable acceptance cases and remaining adapters.
- Query GitNexus/CodeGraph before exploring dependencies or editing existing functions. Investigate UNKNOWN and partial/truncated output; report HIGH/CRITICAL impact before edits.
- Start with failing public-boundary behavior tests, implement the smallest change, and validate focused cases, lint/typecheck, full regression and build as appropriate.
- Rebuild both graphs, inspect affected flows and record extraction limits. Obtain separate Standards and Spec reviews, fix findings and revalidate affected behavior.
- Store commands, revision-specific results and limitations once in a checkpoint. Update this roadmap and durable contracts without turning current knowledge into an accumulating test-count log.

The original full-core acceptance set remains required: its 18 conformance scenarios were defined in the baseline replacement analysis. Passing narrow fixtures does not satisfy those complete-core scenarios or establish 100% coverage. Consult the preserved revision-labelled evidence for their exact definitions; do not derive acceptance rules from obsolete Standard audits.
