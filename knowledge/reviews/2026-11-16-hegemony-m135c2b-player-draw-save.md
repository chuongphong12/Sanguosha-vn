# M1.3.5c.2b — player-draw recovery checkpoint

Date: 2026-11-16. Source 13cd4a2557a8934541d6d4d4aaa009ac63b1c604; fixed game base 79c18e6d1caae00d12a9ad395c049781f0c43253; source reviewed tree a1b22d2e728909b4a66927aa504576ed2942f20a. Knowledge input 06664b990e0db4715423e56b3dacdd56b482e14c. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/player-draw-save.md), [approved scope](../specs/hegemony-match-v3-save.md).

## Behavior and evidence

Actual draw-cards gains pure save/result hooks without changing runtime/preflight callbacks or shared scheduler. They bind captured options/progress/transfers/child requests, exact reform mandatory prefixes and null completions. No current alive recheck is used for historical slots. Ordinary skipped-slot history remains outside this cursor's proof.

Baseline 72/72 across three existing suites; final focused 190/190 across five files includes 41 new cases. Final full suite 2790/107 passed, typecheck/build passed, lint 0 errors/42 prior warnings. No assertion/timeouts weakened. Actual acquisition, movement runtime and game-over unwind are tested; active movement decoding explicitly rejects under a boundary-only fixture codec. No complete movement/Room/profile/public-v3/native full-match or production recovery is certified.

Initial RED rejected the missing handler codec. Later REDs exposed object-order false rejection, coercible stage acceptance and matching fabricated parent/child physical IDs. The first full run overlapped newly added reform RED tests and reported 2788 pass/2 fail; that run is not the final receipt. Spec review independently reproduced omitted mandatory reform transfers through the public decoder. Two acquired/moved regressions failed before the exact prefix-cardinality fix, then passed. Final source Standards 0/Spec 0 reviewed a1b22d2e728909b4a66927aa504576ed2942f20a; Spec independently ran all 41 new cases.

Runtime preservation: draw-cards pre-existing run/validate/unwind callback AST SHA-256 d8669da4cc17825686fbb9c73814af4fc3772887a317ddc2a1c63cbba9ddc3cd; complete emitted scheduler SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1; both equal base.

## Graph scope

Fresh pre-edit GitNexus resolves draw-cards LOW,7 impacted symbols, direct internal match and M0 engine with prototype dependents. A separately probed fill-hand symbol is UNKNOWN and was not edited. No absence of edges is treated as proof of no consumers. Post-edit change summary: {"changed_count":18,"affected_count":0,"changed_files":2,"risk_level":"low"}. Affected extracted steps are recorded in the local graph artifact; zero processes does not establish no impact. Both changed file hashes match source/GitNexus/CodeGraph:

- src/game/hegemony/draw-cards.ts: c67c236093b5ae8a0dc8b3bfcadccca336b442c1056124acf3fcc560e4aab657
- tests/hegemony/player-draw-save.test.ts: 298aa85e6e630365bce7cbee6efe8517aecbd0335ac0917b2b48017bf493f6f0

The fresh graph contains 13,858 nodes / 34,881 edges / 297 clusters / 491 flows. CodeGraph independently resolves 41 nodes / 59 edges at depth 3, including drawing, phase, match and test consumers. GitNexus reports zero extracted affected processes, so there are no affected process steps to inspect. This is not proof of no impact.

Global extraction omits 584 entry candidates and 1,220 callees, cuts 17 walks, leaves 42 cross-language property links unresolved and caps two older luck callback sets at 32 candidates; inventory/font files exceed the size cap. The local graph artifacts retain these limits. Tests/source imports supplement these gaps, not replace them with an all-clear.

## Delivery gates

Canonical lint, independent document reviews, publication/import/pin and source/integration CI are separate subsequent receipts. No main merge or production activation occurs here. Next are actual movement and remaining handler codecs, aggregate Room/configuration/root validation, then public v3/routing/projection and full-match/release gates.

## Pre-publication receipts

Mechanical lint passed 143 Markdown pages, 850 relative file links, 3 anchors, 607 pinned citations, 523 line locators and 176 local Git objects, with 0 errors. Registry totals 151 sources / 18 pages / 159 relations preserve all prior 149 / 17 / 157 records exactly. This establishes reference resolution and bounded source scope, not every semantic claim or external endpoint.

Independent canonical Standards 0 / Spec 0 reviewed the 15-file draft at tree e1a06b7d37e5a3690bd51accb2a7fe34e0fdb96a. This receipt-only delta receives review before publication.

[Source CI 43794241347](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43794241347) passed both jobs at head 13cd4a2557a8934541d6d4d4aaa009ac63b1c604: 2,790 tests / 107 files, typecheck, 0 lint errors / 42 prior warnings, and preceding knowledge 06664b9 verified offline/upstream. Publication/imported-head CI are later gates and are not inferred from source CI.
