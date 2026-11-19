# M1.3.4b.1 — RoundStart/Judge and Proceeding bridge

Date:2026-11-02. Fixed game base87bfb61b5541260f45aa5d009856dd801a3c14ed; [source2c39ca61f3ede09e86f45e764d4f3a7b414f83f4](https://github.com/chuongphong12/Sanguosha-vn/commit/2c39ca61f3ede09e86f45e764d4f3a7b414f83f4); input knowledgeed4bb3cc6b226e1f4996c03da57d66c749b0afa0; nativece4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. [Accepted B checkpoint4](../specs/hegemony-turn-unwind.md) continues through [this library slice](../engine/phase-bodies.md), not completion of Play/Discard, match v3 or production. Only two new modules and one test file change; existing kernels/profiles/applications/M0/dependencies are unchanged.

## Executed evidence

Baseline143/143 in existing turn/general/effect suites. REDs established missing RoundStart helper, missing optional lord-choice branch, missing Judge operation, malformed duplicate-head metadata and the late-disableShow regression. A discard-order fixture expectation was corrected to the existing top-first pile contract, not presented as an engine fix.

Initial source review: Standards0 findings at66a4a7bb780d7350cf2ec2c0d4124f0888c8d590. Parent header inspection and Spec review identified a P2: native showGeneral defaults ignore_rule=true, but both children passed false. A behavioral RED reproduced suppression after ChoiceMade changed disableShow. Both calls were corrected; final Standards0/Spec0 unresolved findings at treea099d49907d5e8e037ef41d7d66e2d85ed3539ea. Source reviews were read-only; fullcheck/build receipts below are parent executions.

Final focused181/181 across4 suites includes38 new tests. npm run check passed2,486/98 with typecheck and0 lint errors/42 existing warnings; build passed. A prior2,485/98 run passed before the additional RED fix and is not substituted for the final run. Full checks/build completed before final indexing. Actual phase/reveal/Draw/movement/Room-effect/cancellation/free-chain are distinguished from fixture presentation, conversion handoff and package card methods. Full regression reruns existing M0 Socket.IO tests; no new browser/SQL/provider/bot-policy/native-runtime/setup-to-terminal test was run.

## Graph and bytes

Pre-edit ruleInput returned CRITICAL40, damageRule MEDIUM14: both were query/reuse-only and unchanged; the warning was communicated. New factory names were absent/UNKNOWN. CodeGraph's damageRule walk reached39 nodes/78 edges. Final compared summary is rawmedium,202 symbols/5 processes/3 files with17 flow steps and no missing IDs or structured partial/truncated flag. Global extraction limits and UNKNOWN walks remain separately recorded before publication; none is waived by matching hashes.

| File | SHA-256 (source = GitNexus = CodeGraph) | Reviewed Git blob |
| --- | --- | --- |
| src/game/hegemony/phase-bodies.ts | 3db9eca4404e7137d22e4da15fb4bdb9ac2d576cfebbf4242c098e4fcf83c6a6 | 0b7c68304bbb2b28a54cdea6c8207ef938411bfb |
| src/game/hegemony/ask-general-show.ts | e3c95fd86c285f0548328a59e5e65d64ae8615a66a2d1c6223412bf550bda743 | 2fd8e91bca6d7f9bb001428526c27a3ce1a61574 |
| tests/hegemony/phase-bodies.test.ts | 83064ced2e7d7ad2e1bc1ce382b8cb9a297630f84b1c5455724c170fc9e5a5ab | b2eac86daab159bb939d6f3aa5b6c37d9fe65d0b |

## Knowledge and delivery

Final clean GitNexus rebuild (--force --no-parse-cache) indexed12,934 nodes/31,809 edges/306 clusters/510 flows. Extraction dropped548 entry candidates/1,222 callees and cut22 budget walks;42 cross-language property links remain unresolved, two older luck-transfer callable sets exceed32, and inventory/font files remain size-excluded. All three new factory/rule impact walks remain UNKNOWN. CodeGraph resolves each operation factory through setup/phase-bodies.test.ts at3 nodes/3 edges. These results and hash agreement do not establish complete dependency capture or production safety.

Mechanical lint, registry preservation, independent knowledge reviews and actual source CI are recorded before publication. A source-head CI verifying preceding knowledge does not verify the later imported snapshot; the integration head requires its own actual run. Use [draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33); no main merge or production enablement occurred.

Mechanical lint passed126 Markdown pages/702 relative file links/3 heading anchors,574 pinned GitHub citations/516 line locators/151 local Git objects,116 sources/10 scoped pages/124 relations;0 errors. All108 prior sources/9 page records/applicability/116 relations are unchanged. Production/dependency/other-kernel diff is empty outside the two new modules and test. Reference integrity does not certify every semantic claim or external endpoint.

Source [CI41379323456](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/41379323456) passed both jobs for PR head2c39ca61f3ede09e86f45e764d4f3a7b414f83f4. CI checked synthetic merge dd595fd into main3cb751449afcd98748a4cebcc54fd5414e5fbce9, with2,486 tests/98 files and0 lint errors/42 existing warnings, verifying preceding knowledgeed4bb3cc6b226e1f4996c03da57d66c749b0afa0. The final source removes one unused test type import after the behavioral correction; final fullcheck/graph hashes and both review deltas cover that cleanup. The earlier build used identical production-module bytes. Forthcoming import verification remains separate.

Next: real Play activation/admission and Discard/token/rule-discard bodies, then M1.3.5 aggregate owner/restore/projection and complete internal minimal-profile matches. Broader release gates remain unchanged.
