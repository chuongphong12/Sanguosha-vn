# Engine boundaries

This snapshot describes the web code at the game revision in [source metadata](../source-baseline.json), against the [selected native source](../rules/source-authority.md). Quốc Chiến is the target game model. The running web application still registers the legacy `TqsGame`: `server/server.ts` and `src/client/MatchClient.ts` import it, and `src/game/TqsGame.ts` names it `tam-quoc-sat-standard-2013`. The isolated library checkpoints do not perform the runtime cutover.

The new `src/game/hegemony/` modules provide paired setup and independently registered normalized scheduler operations. `src/game/hegemony/types.ts` defines setup status as `selecting-generals | ready`; `src/game/hegemony/index.ts` explicitly states that **ready is not a playable match**. No implemented library operation should be presented as an enabled player command without a production action, legality and privacy adapter.

## Read by subsystem

| Contract                                                     | Main web modules                                                                                              | Public regression files under `tests/hegemony/` |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [Setup and privacy](setup-and-privacy.md)                    | `index.ts`, `types.ts`, `identity.ts`                                                                         | `setup.test.ts`, `identity.test.ts`             |
| [Scheduler](scheduler.md)                                    | `scheduler.ts`                                                                                                | `scheduler.test.ts`, `operations.test.ts`       |
| [Movement and wrappers](movement.md)                         | `movement.ts`, `wrapped-cards.ts`                                                                             | `movement*.test.ts`                             |
| [Card use and effects](card-use-and-effects.md)              | `card-on-use.ts`, `card-used.ts`, `card-resources.ts`, `card-use.ts`, `card-effect.ts`, `card-effected.ts`    | corresponding card test files                   |
| [Isolated SkillCard onUse](skill-card-on-use.md)             | `skill-card-on-use.ts`                                                                                        | `skill-card-on-use.test.ts`                     |
| [Nullification and Slash](nullification-and-slash.md)        | `card-cancellation.ts`, `nullification.ts`, `slash.ts`, `slash-response.ts`                                   | corresponding cancellation/response test files  |
| [Damage and rescue](damage-and-rescue.md)                    | `damage.ts`, `damage-rule.ts`, `dying.ts`, `dying-rule.ts`, `peach-response.ts`, `recovery.ts`                | `damage.test.ts`, `dying.test.ts`               |
| [Death and careerists](death-and-careerist.md)               | `death.ts`, `burial.ts`, `death-rule.ts`, `victory.ts`, `careerist.ts`, `careerist-choice.ts`, `fill-hand.ts` | `death.test.ts`, `careerist.test.ts`            |
| [General lifecycle and relations](generals-and-relations.md) | `general.ts`, `general-identity.ts`, `general-relations.ts`                                                   | `general.test.ts`, `general-relations.test.ts`  |
| [Reveal rewards and tokens](reveal-rewards-and-tokens.md)    | `general-rule.ts`, `general-rewards.ts`, `reward-tokens.ts`                                                   | `general-rule.test.ts`, `reward-tokens.test.ts` |

Module paths in the table are relative to `src/game/hegemony/`. These tests use the actual public dispatch/resume boundary, with explicit adapters for unported content and transport. They are useful conformance evidence, not proof of a complete native match or production E2E parity. Historical test totals and graph counts belong in revision-specific reviews, not current contracts.

## Shared invariants

- Authoritative state and continuations are JSON data. Registries, callbacks and package code live outside persisted state and are version-pinned by the scheduler.
- Physical card IDs have one physical location. Reference identity, current string keys, wrapper faces and movement notification groups remain distinct concepts.
- Native local snapshots and mutable event data often differ. Preserve captured source, recipient, material and loop snapshots exactly where the owning caller does; later child rewrites do not universally replace them.
- Preflight rejects malformed selected inputs before allocating a frame. Late boundary errors preserve earlier committed children and eager state. This is not a rollback transaction.
- Turn-broken, stage-change and game-over interruptions freeze their stack and eager effects. Native exception-specific unwinding is still a separate implementation gate.
- Private head/deputy identities, scenario authority, raw card ledgers, resources, event payloads, frames and operation completions are not client state. The setup projection is not a complete battle projection.

Sources: the exported interfaces and dispatch/resume implementation in `scheduler.ts`, authoritative types in `movement.ts`, `card-resources.ts`, `death.ts` and `general-identity.ts`, and projection in `index.ts` at this snapshot.

## Remaining integration gates

Concrete package/catalog discovery, all card/skill legality, shared SkillCard GameRule/resource/effect execution, the generic askForCard lifecycle, actual draw/recycling/RNG policy, movement visibility notifications, equipment installation/uninstallation, general removal/transformation, full older GameRule guard integration, exception unwind and native mutable pointer/subcard adapters remain incomplete. The separate SkillCard onUse checkpoint retains explicit execution/reveal/transport adapters. ImperialOrder's pending diversion tags do not implement its NotActive effects. Setup-to-battle private authority synchronization, filtered battle views, authoritative routing, UI/AI/network migration, native differential tests and Standard runtime retirement remain required before production cutover.

Evidence: external adapter interfaces across the modules above; absence of battle status in setup types; unchanged `TqsGame` production registration. A later implementation must narrow this list using inspected code and new validation, never by carrying forward a checkpoint's old “next seam” paragraph.
