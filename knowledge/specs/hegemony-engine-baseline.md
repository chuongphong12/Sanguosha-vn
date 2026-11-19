> Accepted design baseline, originally `docs/superpowers/specs/2026-10-07-hegemony-engine-design.md` at game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Historical planning statements describe that design revision; use [current port plan](../plans/hegemony-port.md) for implementation status. Original game blob: `01e589e03bc3c24c0c3c20002f498c27d719cf4d`.

# Quốc Chiến engine — approved direction

The user approved implementation in successive parts on 2026-10-07, with knowledge rebuild, code validation and test updates before advancing. The sole target rules baseline is QSanguosha-QuocChien 2.3.43-beta2, commit ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f.

## Scope and boundaries

Replace Standard Identity 2013 completely at production cutover. Keep TypeScript, PixiJS and boardgame.io. During development, the working legacy adapter remains until the Hegemony replacement can complete a playable match; no dual-mode product is intended.

The source analysis and retirement inventory are in `docs/reviews/2026-10-07-hegemony-engine-replacement-analysis.md`. Implement independently from native behavior; do not copy native executables, assets, generated wrappers or whole Lua packages into the application.

Public seams: setup/paired-general selection, authoritative command dispatch and continuation resume, legal actor choices, player-specific projection. Test these boundaries with source-derived expectations, not private helper calls. The user approved these seams as part of proceeding with the proposed design.

## Milestones

1. Two-general domain and setup: distinct offered pair, compatible kingdoms including directional careerist and dual-kingdom rules, ban pairs, unique physical generals, head/deputy-adjusted HP, serializable state, no Identity fields, no candidate/hidden-slot leakage.
2. Public identity and relationships: slot-specific reveal/hide transitions, revealed faction, majority and lord-general exceptions, plain versus recruited careerists, unknown-player relationships, private/public separation. Domain transitions do not masquerade as complete skill/winner event dispatch.
3. Resumable trigger scheduler: priority, record/triggerable/cost/reveal/effect ordering, owner-selected trigger order, consumed occurrence identity, eligibility refresh, nested prompts and explicit unwind. Data-only frames in state; handlers outside state.
4. Card/movement/phase/damage/dying/death/reveal/winner pipelines integrated with scheduler; deterministic RNG and validation of stale/duplicate/out-of-turn replies. Preserve native event ordering and cleanup contracts.
5. Content manifest and a complete playable Hegemony slice, then boardgame.io/local/online/bot/Pixi migration. Unimplemented content must not be selectable. All enabled content needs rule tests; partial roster is reported explicitly.
6. Cutover and retirement: remove all old runtime imports/registration, role tables, Identity setup/skill handlers/types and obsolete tests, after replacement coverage passes. Old saves/matches cannot be reinterpreted as Hegemony.
7. Remaining source packages/scenarios, each with its own conformance and integration checkpoint.

## Checkpoint gate for every part

Write a failing behavior test, implement minimally, run the focused suite, lint/typecheck/full regression suite and build where appropriate. Rebuild both GitNexus and CodeGraph, inspect new symbols/processes and limits, run graph change analysis before commit, review standards and spec separately, fix findings and revalidate affected behavior. Record commands, results and incomplete scope in the implementation ledger before advancing.

HIGH/CRITICAL impact is reported before edits. UNKNOWN, partial and truncated graph results require investigation and supplementary verification; zero callers cannot justify deletion. No unrelated user changes or index files are committed.

## Source discrepancies and parity

Use pinned executable semantics unless an explicit deviation is approved. The careerist recruitment bonus discrepancy stays documented and must be covered before enabling recruitment. Do not claim runtime differential testing without executing a reference engine. Source-derived fixtures and regression tests are useful but do not prove every package interaction or 100% coverage.

The 18 conformance scenarios in the analysis are acceptance requirements for the complete core; an early milestone passing its narrower tests does not satisfy later pipeline or production migration requirements.
