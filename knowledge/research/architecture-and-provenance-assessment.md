# Architecture and provenance curation assessment

Assessed against the game revision recorded in [source-baseline.json](../source-baseline.json). This note explains which shared knowledge was retained when replacing the old Standard documentation with the current Quốc Chiến knowledge base. It makes no claim of a new engine validation run.

## Evidence and disposition

| Earlier material | Finding verified in the source baseline | Disposition |
| --- | --- | --- |
| `ARCHITECTURE.md` stack overview | `package.json`, Vite configuration and `src/engine/` confirm TypeScript/PixiJS/boardgame.io infrastructure | Rewrite as [current architecture](../engine/architecture.md); remove dated graph/test/catalogue totals and Standard normative rules |
| `HANDOFF.md` session/skill notes | Those descriptions concern old Identity handlers; the registered `TqsGame` remains legacy while the replacement library is separate | Exclude as a current rule reference; do not transfer skill semantics merely by matching names |
| `HANDOFF-UI.md` rendering handoff | Pixi application/screens/assets remain; its catalogue and control descriptions are not Hegemony contracts | Retain only verified infrastructure and projection-driven UI principles |
| `docs/assets/provenance.md` | AssetPack input/output paths and aliases are verifiable; blanket permission claims lack per-asset evidence in that note | Replace with [provenance assessment](../assets/provenance.md), retaining explicit unresolved rights and content-mapping gates |
| `docs/plans/2026-10-07-hegemony-engine-implementation.md` and approved Hegemony design | Source modules and checkpoint scopes confirm normalized work through 4x, with production registration deferred | Derive [current port plan](../plans/hegemony-port.md); retain original checkpoint results only as revision-specific evidence |
| Old Standard rules audits | Earlier failures are about another mode/revision and cannot certify Hegemony | Exclude their normative rules and pass/fail assertions from current knowledge |

## Reusable lessons rechecked in current Hegemony code

The old handoff's nondeterministic-test diagnosis illustrates why a random optional prompt must not be mistaken for a completed phase. The new roadmap therefore requires explicit phase/command integration and deterministic fixtures; it does not claim that the old Standard fix implements the missing Hegemony phase pipeline.

Two broader safeguards are directly visible in the replacement code: `resumeTriggerPrompt` checks actor/ID/version/offered choices, and `getTriggerPrompt` returns responder-only cloned data. `tests/hegemony/scheduler.test.ts` includes malformed/foreign/stale/duplicate reply and JSON-reload cases; `tests/hegemony/reward-tokens.test.ts` includes private-view and resume cases. These sources support preserving the validation/privacy principles, not importing old Standard conformance conclusions.

`projectHegemonyState` omits other players' initial kingdom and hides unshown slot IDs/candidates as appropriate. That projection belongs to paired setup; richer battle authority and transport notifications still require integration tests. Source existence, a fixture registry and a visible UI alias are three different kinds of evidence.

## Method and limits

Graph-first GitNexus queries for `hegemony` and `assets` located the library, plan and alias/build flows. Direct reads checked package versions, server/client registration, setup/status/projection, scheduler guards, relevant tests and asset generation. A tracked Git-tree inventory counted asset inputs; no art or audio was copied into this repository.

This was a source-derived documentation assessment. It did not execute a native QSanguosha runtime, retest all gameplay, clear asset rights or establish production parity. Graph results do not validate Markdown links or permissions; direct evidence was needed for those questions. All current claims are bounded by the source baseline, and later code changes require revalidation.
