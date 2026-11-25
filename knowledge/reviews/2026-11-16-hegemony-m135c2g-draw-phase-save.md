# M1.3.5c.2g — Draw-phase owner recovery

Date:2026-11-16. Source 2da345ba350dbcdada28d8504fcd623a86725bdc; fixed base 70b9fb9db9472085e4c8bdfa2fcce490550e0993; reviewed source tree d037aca25fbe37da6464aa3b70a86cc88417f26a; input knowledge 7a1e41fda365f568a17d5246a98869e2cd71d857. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/draw-phase-save.md), [approved scope](../specs/hegemony-match-v3-save.md).

## Validation

Initial RED was missing operation save codec coverage. Baseline95/3; finalfocused174/5 includes44 new cases and preceding free-chain/draw/kill recovery. Full2977/112, typecheck/build passed; lint0 errors/42 prior warnings. Source Standards0/Spec0 at d037aca25fbe37da6464aa3b70a86cc88417f26a; Spec independently ran64/64 new/existing Draw-phase tests. No weakened assertions or timeouts.

Actual owner, drawing, movement, free-chain, death and unwind compose; observer/event/queue/owner/predicate policies remain fixtures. Firstshow3 queue instrumentation does not certify native eligibility. Arbitrary shared data at stage2 is intentional: invalid count fails only after the first drain, retaining its real earlier reward. Captured count survives After event rewrites and phase/mark/flag mutations. Standalone Draw-rule bridge coverage rejection remains explicit; the common Proceeding bridge is unchanged.

Equal base/current preservation receipts:

- draw-phase.ts: all pre-existing run/validate/unwind callback AST; SHA-256 058606bdb521082084974418d7ad147f843fa5f7530c5a0a2bcefc2ef15ce838
- scheduler.ts: complete emitted interpreter; SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

## Graph evidence

Factory pre-impact UNKNOWN remains unresolved; CodeGraph15 nodes/22 edges and six existing import files supplement it. phaseInput LOW2/oneprocess was checked; standalone rule UNKNOWN was not edited. Common damageRule was explored separately (MEDIUM16/13 direct/oneprocess), not changed. Final GitNexus14,111 nodes/35,542 edges/300 clusters/488 flows; change summary {"changed_count":25,"affected_count":0,"changed_files":2,"risk_level":"low"}. CodeGraph depth3 resolves17 nodes/25 edges. No affected process steps extracted; no inference of no consumers. Source/AST/regression evidence supplements missing edges. Changed source/GitNexus/CodeGraph hashes match:

- src/game/hegemony/draw-phase.ts: c35259fa3917be11dd85ffe13496a2123e879936ad985fb27309e58b2b0e9ed4
- tests/hegemony/draw-phase-save.test.ts: 76e6c58f9d660dec7045be433c5905368b18de1e9e14f42114090813116d1b8e

Global extraction omits597 entry candidates/1207 callees and cuts17 walks;42 cross-language property links, callback and inventory/font size caps remain explicit. Missing edges are not an all-clear.

## Delivery and remaining work

Previous free-chain integration CI43833467330 passed at 70b9fb9db9472085e4c8bdfa2fcce490550e0993, with knowledge 7a1e41fda365f568a17d5246a98869e2cd71d857 verified offline/upstream before this slice began. Canonical lint/reviews/publication/import/pin and this slice's source/integration CI are separate later receipts. Remaining actual startup/battle/bridge handlers, Room/configuration/root decoding and public v3 remain Group1 work. No main merge, production cutover or release gate closes here.

## Pre-publication receipts

Mechanical lint passed 153 Markdown pages, 941 relative file links, 3 anchors, 618 pinned citations, 523 line locators and 187 local Git objects, with 0 errors. Registry totals 162 sources / 23 pages / 170 relations preserve all prior 160 / 22 / 168 records exactly. Reference resolution does not certify every semantic claim or external endpoint.

Canonical Standards 0 / Spec 1 evidence-scope finding reviewed the initial 15-file draft at tree c2a4cda004b0ec86ac4651f49cebc788b99a9936. The exercised-handler list was corrected: swap-pile/game-over are registered dependencies, without new-case recycling/terminal coverage. This receipt and correction receive both reviews before publication.

[Source CI 43836564177](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43836564177) passed both jobs at head 2da345ba350dbcdada28d8504fcd623a86725bdc: 2,977 tests / 112 files, typecheck, 0 lint errors / 42 prior warnings, and preceding knowledge 7a1e41f verified offline/upstream. Publication/imported-head CI remain later gates, not inferred here.
