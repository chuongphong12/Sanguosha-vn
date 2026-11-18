# M1.3.5c.2h — shared GameRule bridge recovery

Date:2026-11-18. Source d2e6a6d279b74f4f5d3a47ca6046bf2f86356511; fixed base 1cb2d5ecc1050127dbac0fe76ce715f40617dc8d; reviewed source tree d01eb24f52838b9f7a2696ced7d4ecd4fb492122; input knowledge a1f89db44a5e9c2ef2fb65516e8d8b8d1b92cc0f. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/game-rule-save.md), [approved scope](../specs/hegemony-match-v3-save.md).

## Scope and validation

Pure bridge hook validates fixed occurrence identity, stable unselected target/key, selected cursor and exact queued/retained operation inputs. It preserves live SkipGameRule/target/data timing and wrapper projections. Result-producing DamageDone/reveal/winner tests are explicit fixtures; actual Draw-owner/drawing/movement/drain/abandonment composition is separate. Recycling/terminal owners are registered dependencies, not new-case coverage. Complete wrapper child/result semantics remain dependent on their actual codecs.

Baseline476/7; finalfocused509/8 includes33 new cases and strengthened existing standalone Draw recovery. Full3010/113/typecheck/build passed; lint0 errors/42 prior warnings. Initial missing-hook RED preceded implementation. Initial source Standards0/Spec1 at a923f51866fb22e367524eacfb909618ffc7cae0: forged stable unselected candidate target/key could delegate twice. A public RED regression reproduced acceptance; the fix constrains only recorded/unselected targets and retains legitimate active-skill retargeting. Final Standards0/Spec0 at d01eb24f52838b9f7a2696ced7d4ecd4fb492122; Spec independently ran77/77 cases. No weakened assertions/timeouts.

Equal base/current preservation receipts:

- damage-rule.ts: all pre-existing run/validate/unwind/effect callback AST; SHA-256 868e153149c0513b153ed1f4dbd8738492aeebc627160e33fde5ca0a704ca385
- scheduler.ts: complete emitted interpreter; SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

## Graph evidence

Fresh pre-impact damageRule MEDIUM16/13 direct/oneprocess; ruleInput CRITICAL53 was explored and left unchanged. Known factory consumers include damage/dying/death/reveal/judge/victory and shared Proceeding. The affected handoffMatchTurn → createPhaseBodyRule → damageRule path was inspected; it still uses one Proceeding bridge. Final GitNexus 14,175 / 35,704 / 303 / 488 nodes/edges/clusters/flows; change summary {"changed_count":43,"affected_count":1,"changed_files":3,"risk_level":"medium"}. CodeGraph depth3 61 nodes/124 edges. Affected process step receipts are inspected separately; absent edges are not proof of no consumers. Changed source/GitNexus/CodeGraph hashes match:

- src/game/hegemony/damage-rule.ts: 83811a456f8486ef2d5d88f6baf02757343b4590a1267b720000b39844040c69
- tests/hegemony/game-rule-save.test.ts: 89ac260169474c9366e1b4f9b0c8fabb8c9d5ea5ecc825187d3e199f6dcbe269
- tests/hegemony/draw-phase-save.test.ts: 97d2830a5a7fea7656e098b2a6fed9e86c1d72b6c7e3e6b9ae72b2937763b44d

Global extraction omits599 entry candidates/1207 callees and cuts17 walks; cross-language, callback and inventory/font size caps remain explicit. AST/source/regression evidence supplements graph gaps.

## Delivery gates

Previous Draw integration CI43837735726 passed at 1cb2d5ecc1050127dbac0fe76ce715f40617dc8d with knowledge a1f89db44a5e9c2ef2fb65516e8d8b8d1b92cc0f verified offline/upstream. Canonical lint/reviews/publication/import/pin and this slice's source/integration CI are later separate receipts. Remaining startup/battle/phase owners, aggregate Room/configuration/root decoding, public v3 and release acceptance remain open. No main merge or cutover occurs here.

## Extraction receipt detail

All three affected process steps were inspected: handoffMatchTurn → createPhaseBodyRule → damageRule. The handoff still rejects the standalone Draw rule when the shared Proceeding bridge is installed; no composition guard changed. Post-impact remains MEDIUM16. Final change summary reports43 changed symbols/one affected process/three files; CodeGraph resolves61 nodes/124 edges.

The force rebuild completed graph analysis, but Const.const_fts failed due to a WAL/checkpoint file rename error. A subsequent --repair-fts attempt also reported the missing Const index. Full-text/BM25 search remains degraded. After the writer exited, graph detect_changes/impact/process queries succeeded; changed source/GitNexus/CodeGraph hashes match. This checkpoint does not claim that keyword search was repaired.

## Pre-publication receipts

Mechanical lint passed155 Markdown pages,960 relative file links,3 anchors,621 pinned citations,523 line locators and190 local Git objects, with0 errors. Registry165 sources/24 pages/173 relations preserves all prior162/23/170 records exactly; the source path check confirms only the three approved source/test files changed. Local reference resolution does not certify every semantic claim or external endpoint.

Canonical Standards0/Spec0 reviewed the15-file draft at tree74e26f261207f40fc5ea3ff420e3424a8620dff6. This receipt-only delta receives both reviews before publication.

[Source CI44223360226](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/44223360226) passed both jobs at d2e6a6d279b74f4f5d3a47ca6046bf2f86356511:3,010 tests/113 files, typecheck,0 lint errors/42 prior warnings, and preceding knowledge a1f89db verified offline/upstream. Publication/imported-head CI remain separate later gates, not inferred here.
