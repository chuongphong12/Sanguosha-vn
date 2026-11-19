# M1.3.5c.2c — movement recovery checkpoint

Date:2026-11-16. Source 86dab10c58d808db8acf6adaf45d0221702da392, fixed base e263cf9122b440ffc14e65e2b92c225216b7b4a6, final source-reviewed tree f53bb338bd80647f0a7cd4a0369771e37a1d4e93; input knowledge d096694db87e83da409dc588d7775ad00dc9fbb9. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/movement-save.md), [accepted route](../specs/hegemony-match-v3-save.md).

## Scope and checks

Actual move-cards gains save/result codecs for its event-stage cursor, canonical metadata, historical request sources, retained packet homogeneity/order/merge relation and completion. The previous player-draw fixture codec/bypass is removed; those tests now decode actual movement internally. Generic game JSON copies and fixture skill/event/filter policies are not complete Room/application/native or storage recovery.

Baseline73/3; finalfocused153/5 includes44 new cases. Final full suite2834/108 passed, typecheck/build passed, lint0 errors/42 prior warnings. No assertion or timeout weakened. Source Standards0/Spec0 at f53bb338bd80647f0a7cd4a0369771e37a1d4e93; Spec independently ran85/85 recovery cases.

Initial RED rejected missing handler coverage. Spec then reproduced two accepted corruptions: mixed-visibility separated packets replaced with one merged notification packet, and retained cross-owner packets reversed while the merged batch remained sorted. Both REDs now reject. A positive regression retains distinct groups after incoming last-hand flags are overwritten; the implementation validates each packet independently instead of reconstructing groups from merged notifications. The earlier preliminary checks were superseded by the final full run after these corrections.

Runtime preservation receipts (equal base/current SHA-256):

- movement.ts: existing execution/preflight/unwind callback ASTs; 2c258c981e6313a3a8b20930514c12a69d8d9b69889c06207dccce3b6510a47b
- movementHelpers: all 17 pre-existing movement helper function ASTs; 43d108f8cd71690ade72cb0c8c8d1213c43a259b0564d7b48f19fbf10f2f37b8
- scheduler.ts: complete emitted interpreter; 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

## Graph and identity

Fresh pre-edit GitNexus impact resolves movement factory LOW/7 symbols (internal match and M0 prototype callers), execution helper LOW/1; CodeGraph pre-impact101 nodes/168 edges. Final graph 13,914 / 35,033 / 297 / 488 nodes/edges/clusters/flows. Change summary {"changed_count":42,"affected_count":1,"changed_files":3,"risk_level":"medium"}; no empty changed IDs or per-result truncation flags. CodeGraph depth3 resolves 103nodes/173edges. The affected three-step path was inspected: validateSave → normalizeMoves → validZone, all in movement.ts with resolved IDs/paths. The two pre-existing helpers have unchanged ASTs; only the opt-in validation hook is new. Extracted paths are not runtime execution receipts or complete dynamic-consumer coverage.

All changed source/GitNexus/CodeGraph hashes match:

- src/game/hegemony/movement.ts: f6a728e8f56e873d44899cb044719ffce58e26d59d4913c9fb4a362d681672ed
- tests/hegemony/movement-save.test.ts: 2997704a9df1787c62d5f86b89cdf769cb4100604fdfa97299c78d5f0eef7ba6
- tests/hegemony/player-draw-save.test.ts: 346c8b2e8a7054bad351f923c7c2fe730f8b2e015ac7f5d34a622eca7f7afc6a

Global extraction limits: 588 omitted entry candidates,1203 omitted callees,17 budget-cut walks;42 unresolved cross-language property links, two older luck callback sets above cap32 and size-excluded inventory/font files. Source/test inspection supplements graph gaps; missing edges do not prove no consumers.

## Delivery gates

Canonical lint/reviews/publication/import/pin and source/integration CI are separate subsequent receipts. Complete profile/Room/settings/root validation, public v3, full-match and production gates remain open. No main merge or cutover occurs here.

## Pre-publication receipts

Mechanical lint passed 145 Markdown pages, 868 relative file links, 3 anchors, 610 pinned citations, 523 line locators and 179 local Git objects, with 0 errors. Registry totals 154 sources / 19 pages / 162 relations preserve all prior 151 / 18 / 159 records exactly. Reference resolution does not certify every semantic or external-endpoint claim.

Canonical Standards 0 / Spec 0 reviewed the 15-file draft at tree 35b7713f77a27778e3e97b5a7862d28a7e13e6aa. This receipt-only delta receives review before publication.

[Source CI 43800429830](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43800429830) passed both jobs at head 86dab10c58d808db8acf6adaf45d0221702da392: 2,834 tests / 108 files, typecheck, 0 lint errors / 42 prior warnings, and preceding knowledge d096694 verified offline/upstream. Publication/imported-head CI remain later gates and are not inferred here.
