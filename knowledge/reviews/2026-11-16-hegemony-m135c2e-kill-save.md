# M1.3.5c.2e — kill-player recovery checkpoint

Date:2026-11-16. Source 9bb63cf979f7f21060c8f23225d0bf6657399c96, fixed base 5a4ab37871eede44877705c604a277d10d24b535, reviewed tree 01f7fb5cb05eecc9751d3b1814d591fd1f169431; input knowledge 1fa96e73453837310a507e2b606b17b5afaf272e. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/kill-save.md), [approved scope](../specs/hegemony-match-v3-save.md).

## Checks and scope

Baseline218/3; finalfocused253/4 includes35 new cases. Finalfull2899/110/typecheck/build passed; lint0 errors/42 prior warnings. Source Standards0/Spec0 at 01f7fb5cb05eecc9751d3b1814d591fd1f169431; Spec independently ran123/123 kill/death cases. No assertions/timeouts weakened. Initial RED was missing codec coverage. An initial trace fixture produced no entries; observation moved to its effect before final validation, distinct from a codec failure.

Real kill-player, nested kills, scheduler and game-over/unwind are exercised with fixture observer/owner/event policies. The constant GameOverJudge→game-over fixture does not select a native winner. No death GameRule, actual burial/rewards, complete profile/Room or production recovery is certified. Request parsing is factored intentionally; full execution state machine and scheduler remain preserved:

- death.ts: complete runKill function AST; equal base/current SHA-256 8dcdce98d6d3e332041102416512024f5fdc2a5e9f3887710ec4516410347540
- scheduler.ts: complete emitted scheduler interpreter; equal base/current SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

## Graph

Pre-edit runKill CRITICAL/10 impacted symbols/6 processes was warned before editing; its body was not changed. Factory UNKNOWN is unresolved, supplemented by CodeGraph46 nodes/67 edges and four checked-in test import files. killInput LOW/7 was checked before parser factoring. Final graph 14,013 / 35,294 / 299 / 488 nodes/edges/clusters/flows; change summary {"changed_count":29,"affected_count":0,"changed_files":2,"risk_level":"low"}. CodeGraph depth3 resolves48 nodes/70 edges. No affected process steps were extracted by the final change query; there are no such steps to inspect. This is not an all-clear, especially given the CRITICAL pre-impact on runKill. The unchanged execution AST, factored parser source, direct imports, CodeGraph and actual regression tests supplement the missing paths without proving complete dynamic coverage. All changed hashes match:

- src/game/hegemony/death.ts: b3c421e43822daf8b289139c0250764ec6b2ddc750b1e38429ee8e80a9eee138
- tests/hegemony/kill-save.test.ts: baa326e7a48bf640c89a30a32d9750910bf92e1bb59f51e1f09d420b828ae93a

Global extraction omits594 entry candidates/1207 callees and cuts17 walks;42 cross-language property links, callback caps and inventory/font size caps remain explicit. UNKNOWN/missing edges are not an all-clear.

## Delivery gates

Canonical lint/reviews/publication/import/pin and source/integration CI are distinct later receipts. Free-chain, remaining phase/startup/battle handlers, aggregate Room/configuration/root validation, public v3 and full-match/production gates stay open. No main merge or cutover occurs here.

## Pre-publication receipts

Mechanical lint passed 149 Markdown pages, 904 relative file links, 3 anchors, 614 pinned citations, 523 line locators and 183 local Git objects, with 0 errors. Registry totals 158 sources / 21 pages / 166 relations preserve all prior 156 / 20 / 164 records exactly. Reference resolution does not certify every semantic claim or external endpoint.

Canonical Standards 0 / Spec 0 reviewed the 15-file draft at tree 51ca66a27ca71e19a3710c8436f30c99ee248df5. This receipt delta and a wording clarification about fixture BuryVictim callbacks receive review before publication.

[Source CI 43826531647](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43826531647) passed both jobs at head 9bb63cf979f7f21060c8f23225d0bf6657399c96: 2,899 tests / 110 files, typecheck, 0 lint errors / 42 prior warnings, and preceding knowledge 1fa96e7 verified offline/upstream. Publication/imported-head CI remain later gates, not inferred here.
