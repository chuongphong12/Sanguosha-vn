# M1.3.5c.2d — fill-hand recovery checkpoint

Date:2026-11-16. Source f9046375c483881079b853935d988fd0bd056b5e, fixed base 51c584cc12eb9afff72ddf4b4f90a21022755219, source reviewed tree bba7b477bb0e25143e3d30edb4b845a71c8059b1; knowledge input b62250fa6d044d98ddc54550d9d5ee545c9f6d4f. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/fill-hand-save.md), [accepted C2](../specs/hegemony-match-v3-save.md).

## Implemented scope and checks

Optional validateDrawSave enables snapshot continuations/save hooks for fill-hand; legacy profiles retain true and no hooks. A factored immutable request parser avoids repeating historical life/hand decisions during recovery. Decode validates captured input/deficit, child mapping and null results without calling the live draw mapper. The new opted-in continuation is intentional; this slice does not claim all runtime ASTs are unchanged. Existing default behavior is covered by legacy and full regression tests; shared scheduler/other handlers are not edited.

Baseline231/4; finalfocused261/5 includes30 new cases. Finalfull2864/109, typecheck/build passed; lint0 errors/42 prior warnings. Source Standards0/Spec0 reviewed bba7b477bb0e25143e3d30edb4b845a71c8059b1; Spec independently ran115/115 related recovery cases. No assertion/timeouts weakened. Initial RED reported missing operation-codec coverage before implementation.

Tests cover actual draw/movement, captured deficit despite nested gain/life changes, prompts, game-over/unwind, unstarted fixture-owner child, skipped paths, corrupt snapshots/children/results and legacy compatibility. Fixture adapter validation and skill/event policies are not whole enabled-package or Room authenticity proof. No implicit old-save migration or production activation occurs.

## Graph evidence and limits

Fresh GitNexus factory impact remains UNKNOWN with no resolved callers; that is unresolved, not an all-clear. CodeGraph pre-impact resolves47 nodes/69 edges, and direct import inspection finds seven test files; no production registration is changed. fillInput LOW/2 resolved symbols and FillHandRules LOW/3 were checked before editing.

Final graph 13,967 / 35,165 / 298 / 488 nodes/edges/clusters/flows. Change summary {"changed_count":40,"affected_count":3,"changed_files":2,"risk_level":"medium"}. CodeGraph depth3 resolves49 nodes/74 edges. Three extracted paths were inspected: run → fillInput → fillRequest → dyingPlayer/readSlashInteger, and run → fillInput → readSlashAlive. All11 steps have resolved IDs/paths. The three terminal helpers and shared scheduler are unchanged; these extracted paths are not complete dynamic-consumer coverage. Source/GitNexus/CodeGraph hashes match:

- src/game/hegemony/fill-hand.ts: ac20c4fefb8653dae5657e56969fc261a0e65fec8095136d4a0baf2557a4929a
- tests/hegemony/fill-hand-save.test.ts: 82a43465003d09585187468546be514fc55b549eb26a34baf8f384382ca54bda

Global extraction limits: 590 omitted entry candidates,1207 omitted callees,17 budget-cut walks;42 unresolved cross-language property links, callback candidate caps and size-excluded inventory/font files remain explicit. Graph paths are not runtime receipts or complete dynamic coverage.

## Delivery gates

Canonical lint/reviews/publication/import/pin and source/integration CI are distinct later receipts. Remaining handler codecs, aggregate Room/configuration/root validation, public v3, full-match and production release gates stay open. No main merge or cutover occurs here.

## Pre-publication receipts

Mechanical lint passed 147 Markdown pages, 887 relative file links, 3 anchors, 612 pinned citations, 523 line locators and 181 local Git objects, with 0 errors. Registry totals 156 sources / 20 pages / 164 relations preserve all prior 154 / 19 / 162 records exactly. Reference resolution does not certify every semantic claim or external endpoint.

Canonical Standards 0 / Spec 0 reviewed the 15-file draft at tree c29f2ed0ba5e3ad97f85aa435ae470fa44ba235f. This receipt-only delta receives review before publication.

[Source CI 43802569773](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43802569773) passed both jobs at head f9046375c483881079b853935d988fd0bd056b5e: 2,864 tests / 109 files, typecheck, 0 lint errors / 42 prior warnings, and preceding knowledge b62250f verified offline/upstream. Publication/imported-head CI remain later gates, not inferred here.
