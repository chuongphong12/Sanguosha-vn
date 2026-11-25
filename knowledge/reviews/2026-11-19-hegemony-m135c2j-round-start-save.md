# M1.3.5c.2j — RoundStart owner recovery

Date:2026-11-19. Source 590c161c2d540f87abd1e1319c2f49fc805f6c80; fixed base a39b50b5201bd5c1f98988f69cf15f82dfb65534; reviewed source tree 7503c9dc946aaa2be33cdea7eb9389da91940654; input knowledge 96065f5876057323dff988a47218ac97784427a2. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/round-start-save.md), [accepted scope](../specs/hegemony-match-v3-save.md).

## Scope and checks

Independent saveRoundStart:true captures the live change decision and enables exact request/result validation, preserving default boolean/no-hook behavior. Decode does not rerun marks/phase or move the live integer fault gate. Actual shared GameRule/Proceeding/RoundStart compose with an explicitly fixture acquisition operation. Its ack prompt/boolean/interrupt exercise request propagation and real scheduler unwind; actual ChoiceMade/reveal/lord/notification recovery is not claimed. Judge/full factory/Room/profile/native full-match acceptance remains separate.

Initial RED was missing operation codec coverage. Baseline70/2; finalfocused104/3 includes34 new cases. Finalfull3076/115/typecheck/build passed; lint0 errors/42 prior warnings. Source Standards0/Spec0 at 7503c9dc946aaa2be33cdea7eb9389da91940654; Spec independently ran104/104 cases. No weakened assertions/timeouts. Tests include standalone opt-in independence and legacy JSON continuation, not implicit save migration.

Equal preservation receipts (opt-in request metadata intentionally differs):

- phase-bodies.ts: legacy/default run/validate/unwind/effect callback AST, folding saveRoundStart=false; opt-in capture metadata intentionally differs; SHA-256 03344909b392e65bf41467e638a760652d09565568fd341fa1f127bbb526388e
- scheduler.ts: complete emitted interpreter; SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

## Graph evidence

Fresh factory pre-impact UNKNOWN0 remains unresolved. Context exposes seven incoming call/file edges across six existing import files; CodeGraph pre-impact16 nodes/24 edges supplements the gap. PhaseBodyRules LOW4 was checked. Common mark/input helpers, shared rule/Proceeding runtime and the actual acquisition/reveal implementations were not edited. Final GitNexus 14,301 / 36,082 / 307 / 488 nodes/edges/clusters/flows; change summary {"changed_count":47,"affected_count":1,"changed_files":2,"risk_level":"medium"}. CodeGraph depth3 18 nodes/28 edges. Extracted affected steps, if any, are inspected separately; empty extraction cannot prove no consumers. Changed source/GitNexus/CodeGraph hashes match:

- src/game/hegemony/phase-bodies.ts: 46b480a68cdcb8659a09e7bc4f63e931d87928ec23d295b784bdbbdfe905c9e3
- tests/hegemony/round-start-save.test.ts: e0cd8a2b33dfcf645df144371a43d1cadf8c5c07ab3e7995d4ab3ec61a3c4834

Global extraction omits603 entry candidates/1207 callees and cuts17 walks; cross-language, callback and inventory/font size caps remain explicit. Source/AST/regression evidence supplements graph gaps. The preceding bounded keyword-search receipt remains revision-scoped; graph hashes alone do not certify search health.

## Delivery gates

Prior Proceeding integration CI44455900498 passed at a39b50b5201bd5c1f98988f69cf15f82dfb65534 with knowledge 96065f5876057323dff988a47218ac97784427a2 verified offline/upstream. Canonical lint/reviews/publication/import/pin and this slice's source/integration CI are separate later receipts. Actual acquisition/reveal codecs and remaining owners, aggregate Room/configuration/root decoding, public v3 and release acceptance remain open. No main merge or production cutover here.

## Graph differential receipt

The first incremental analysis produced inconsistent identity evidence:7 changed symbols,383 affected processes,CRITICAL96 factory impact,one empty changed UID and1,245 empty-ID process steps out of1,608. Unrelated Standard setup/build paths were attributed to the factory. This snapshot was retained and excluded from the final evidence used to approve the change; the CRITICAL signal was reported before committing.

With source hashes unchanged, a full --force --no-parse-cache rebuild returned47 changed symbols,one affected process,MEDIUM change risk,zero empty changed UIDs andthree steps with complete IDs. The inspected path is RoundStart run → generalMark → readSlashInteger. The helpers and actual acquisition/reveal implementations are byte-identical to base; mark vectors and deferred integer-fault tests cover this path. CodeGraph post-impact resolves18 nodes/28 edges, with all changed file hashes matching source/GitNexus/CodeGraph.

Factory-target impact remains UNKNOWN0. This bounded differential isolates an inconsistent incremental-index result; it does not prove the underlying GitNexus issue permanently fixed or erase graph extraction limits. Future evidence with empty IDs must be treated as incomplete and rebuilt/checked, rather than used as an all-clear or an automatic blast-radius certificate.

## Pre-publication receipts

Mechanical lint passed159 Markdown pages,997 relative file links,3 anchors,625 pinned citations,523 line locators and194 local Git objects, with0 errors. Registry169 sources/26 pages/177 relations preserves all prior167/25/175 records exactly; only the two approved source/test paths changed. Local reference resolution does not certify every semantic claim or external endpoint.

Canonical Standards0/Spec0 reviewed the15-file draft at tree6c2edfc4ee906cec3a7a1ab4f0585e3bc38a4dcb, including the explicit graph differential and acquisition-fixture limits. This receipt-only delta receives both reviews before publication.

[Source CI44459464142](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/44459464142) passed both jobs at590c161c2d540f87abd1e1319c2f49fc805f6c80:3,076 tests/115 files, typecheck,0 lint errors/42 prior warnings and preceding knowledge96065f5 verified offline/upstream. Publication/imported-head CI remain separate later gates, not inferred here.
