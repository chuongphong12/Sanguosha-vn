# M1.3.5c.2k — general-show question recovery

Date:2026-11-19. Source d7b6cb0c3ba1a62a880aedbedccb6ec51cec8e89; fixed base e147e4c4156835dfec25ad163e23d3e54f8445d7; reviewed source tree 2e6ae78dbf3b48f75079c1e9ee70cff9f9664021; input knowledge 791f7216fe2447d23a58fa1dc06ca485666cddf9. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/ask-general-show-save.md), [accepted scope](../specs/hegemony-match-v3-save.md).

## Scope and checks

Opt-in save contracts copy pure lord/notice validators, validate eight persisted stages and capture the stage5 notice before the live mapper. Reads do not recompute eligibility or invoke live adapters. Actual question/ChoiceMade/shared owners compose; show/lord/notification child implementations remain explicit fixtures. Legacy eight-field/no-hook JSON behavior stays supported, without inferred save migration. Complete child/profile/Room/native full-match acceptance remains separate.

Initial RED was missing operation codec coverage. Baseline72/2; finalfocused164/3 includes92 new cases. Finalfull3168/116/typecheck/build passed; lint0 errors/42 prior warnings. Initial Standards0/Spec1 at tree4fb75eeea18a169aa4de9cd9766d3d7e9d5108fa: both offered without head implies originally shown head and cannot have changeLord=true. A public decoder RED reproduced acceptance; the corrected guard uses captured offers only, preserving valid deputy-only eligibility. Final Standards0/Spec0 at 2e6ae78dbf3b48f75079c1e9ee70cff9f9664021; Spec independently ran164/164. No weakened assertions/timeouts.

Bounded preservation receipts:

- ask-general-show.ts: existing run/validate callbacks excluding notification case4; case4 refactor/capture is intentional, legacy semantics verified by paired JSON tests; SHA-256 ff9014aa1604240f088c36ae03ea7d026495b484f6379990238e0a74046b80cc
- scheduler.ts: complete emitted scheduler interpreter; SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

Full raw callback AST equivalence is not claimed. Case4 now names/copies the notification before calling the same live adapter; paired legacy/new JSON behavior tests cover the intentionally refactored case.

## Graph evidence

Fresh factory pre-impact UNKNOWN0 remains unresolved; context resolves three existing caller functions/import files and CodeGraph pre-impact10 nodes/14 edges. GeneralShowRules LOW1 was checked before editing. Final force/no-parse-cache GitNexus 14,422 / 36,438 / 308 / 488 nodes/edges/clusters/flows; change summary {"changed_count":100,"affected_count":2,"changed_files":2,"risk_level":"medium"}. CodeGraph depth3 12 nodes/18 edges. Extracted affected steps are inspected separately. Source/GitNexus/CodeGraph hashes match and changed/step IDs are nonempty:

- src/game/hegemony/ask-general-show.ts: f3dc47dfc5926016631cd03de28d835b7bad606919f4b644f9770ad8e5522e20
- tests/hegemony/ask-general-show-save.test.ts: 17d7de4f58169e8a2822b0956d09cb6743eec37495d42c1f1201c621ea11946f

Global extraction omits605 entry candidates/1207 callees and cuts17 walks; cross-language, callback and inventory/font size caps remain explicit. Source/tests supplement graph gaps; missing edges cannot prove absence of consumers. The prior inconsistent incremental-index receipt remains historical; this checkpoint uses a fresh force rebuild.

## Delivery gates

Prior RoundStart integration CI44460142089 passed at e147e4c4156835dfec25ad163e23d3e54f8445d7 with knowledge 791f7216fe2447d23a58fa1dc06ca485666cddf9 verified offline/upstream. Canonical lint/reviews/publication/import/pin and this slice's source/integration CI are later separate receipts. Actual child codecs and remaining owners, aggregate Room/configuration/root decoding, public v3 and release acceptance remain open. No main merge or production cutover here.

## Inspected graph and final cleanup detail

All seven extracted process steps have complete IDs and were inspected: question run → shown → readDeathIdentity → dyingPlayer, and question run → allPlayers → readSlashAlive. The shown/input helper bodies are unchanged, and the imported helpers/shared scheduler/phase owners are byte-identical to base. CodeGraph post-impact resolves12 nodes/18 edges; the final source/test hashes match both indexes.

Final source tree2e6ae78dbf3b48f75079c1e9ee70cff9f9664021 differs from the corrected review tree76422e320f162b6240ee1a1702c639fa2ca9cd20 only by removal of an unused type-only test import. Owner logic and assertions are unchanged; lint returned to the prior42-warning baseline. Final full tests/typecheck/build and force graph were rerun after cleanup, with no empty changed/step IDs. Source Standards0/Spec0 reviewed the final exact tree.

## Pre-publication receipts

Mechanical lint passed161 Markdown pages,1,015 relative file links,3 anchors,627 pinned citations,523 line locators and196 local Git objects, with0 errors. Registry171 sources/27 pages/179 relations preserves all prior169/26/177 records exactly; only the two approved source/test paths changed. Local reference resolution does not certify every semantic claim or external endpoint.

Canonical Standards0/Spec0 reviewed the15-file draft at tree3e1f3785efb25c96b7b71d6379d54eb5aea8d30a, including child-fixture limits and bounded notification-case preservation. This receipt-only delta receives both reviews before publication.

[Source CI44478523090](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/44478523090) passed both jobs atd7b6cb0c3ba1a62a880aedbedccb6ec51cec8e89:3,168 tests/116 files, typecheck,0 lint errors/42 prior warnings and preceding knowledge791f721 verified offline/upstream. Publication/imported-head CI remain separate later gates, not inferred here.
