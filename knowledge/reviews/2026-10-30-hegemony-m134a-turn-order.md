# M1.3.4a — TurnStart, normal/extra turns and recovery roots

Date:2026-10-30. Fixed game basee25f432a76227402037b139088660d94b8f1e630; inspected [33f27aa1da6d74d8d50acb7ba1dabdefcbe9f554](https://github.com/chuongphong12/Sanguosha-vn/commit/33f27aa1da6d74d8d50acb7ba1dabdefcbe9f554); input knowledge54d385d1a7045c78bf25e27de4ac43f265aa71a2; nativece4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. Approved [B checkpoint4](../specs/hegemony-turn-unwind.md) is split vertically: this slice provides [turn roots](../engine/turn-order.md); remaining phase bodies are4b and aggregate match ownership is5. It does not close M1.3.4.

## Source and validation

Only two new library modules and one test file change; scheduler, existing kernels, application/M0/production registration and dependencies are unchanged. faceUp and turnOrder are new required private profile authorities; no old state is silently migrated. Normal root boundaries permit one TurnStart, skip or advance per invocation; the v3 trusted host still must pump/classify/validate them.

Baseline111/111 in phase lifecycle/cleanup/scheduler-unwind. Behavioral REDs established missing TurnStart module, face-down handling, SkipGameRule/BattleRoyal, normal-order module, round cleanup and recovery operation before their implementations. A fixture hand-zone name and prompt-answer call shape were corrected separately; the interruption test was adjusted to target the mark notice after the earlier history notice, not labelled an engine defect.

Final focused147/147 in4 suites includes36 new cases. Full npm run check passed2,448 tests/97 files, typecheck and0 lint errors/42 existing warnings. npm run build passed. Full checks completed before final indexing. New tests use actual phase/Draw/movement/RNG/free-chain/cleanup; presentation and custom trigger listeners are declared fixtures. Existing M0 Socket.IO regressions rerun in the full suite; no new browser/SQL/provider/bot-policy/native-runtime or setup-to-terminal execution was performed.

Final Standards0 documented breaches/actionable smells and Spec0 findings at reviewed tree0f774ed95e402c515af7be460e48c014e6648d69. Spec independently passed36/36; Standards source/contract review did not rerun the full suite. Both reviewed scoped M1.3.4a, not deferred4b/5. Review limitations do not waive those gates.

## Graph and byte evidence

Pre-edit new factories were absent/UNKNOWN. Existing phase/cleanup/mark/unwind factories had UNKNOWN walks, while dispatchTriggerEvent returned LOW/five. CodeGraph found createPhaseOperations consumers across four nodes/six edges and the new factories' bounded test consumers after indexing; shared helpers were reused unchanged. UNKNOWN is unresolved, not unused or safe. Final structured staged changes:raw medium,166 symbols/4 processes/3 files,12 returned flow steps with IDs and no structured partial/truncated flag. Global extraction caps/gaps remain separately recorded below; structured completeness does not establish global completeness.

Final clean GitNexus rebuild (--force --no-parse-cache) indexed12,718 nodes/31,325 edges/298 clusters/523 flows. Global extraction dropped536 entry candidates/1,254 callees and cut24 budget walks;42 cross-language property links remain unresolved. The two older luck-transfer callable sets exceed32, and the large inventory/font files remain size-excluded. All three new factory/rule impact walks remain UNKNOWN. CodeGraph resolves each operation factory through setup/turns.test.ts at three nodes/three edges. These consumers and matching hashes do not waive those gaps. No architectural or production safety certificate is inferred.

| File | SHA-256 (source = GitNexus = CodeGraph) | Reviewed Git blob |
| --- | --- | --- |
| src/game/hegemony/turn-start.ts | d69985fc724b420df795aa7484f8abcd77dd12345ec4ef40e51d6f30c0964701 | 1811c3e13d77e000e0fc0f45d33e6d47e2889870 |
| src/game/hegemony/turn-order.ts | 138512696533c2f1ed28c6974e65b6f7d265fbbdc7cef1ab66c8b5009629b898 | dcdf180a6af0fa51ac39a7fa559593dc42fce600 |
| tests/hegemony/turns.test.ts | 07dabfbbc43131270aac116b563a767c9578eb41f0d982cfe4276469ebc8136d | d4b043e706a3a9b25b0f47dcd61206bc67d1c946 |

## Knowledge and delivery

Mechanical lint passed124 Markdown pages/683 relative file links/3 heading anchors,566 pinned GitHub citations/511 line locators/148 local Git objects,108 sources/9 scoped pages/116 relations;0 errors. All100 prior source records/8 page records/applicability/108 relations remain unchanged. Production/dependency/other-kernel diff is empty outside the two new owners and test. Reference integrity does not certify every semantic claim or external endpoint.

Source [CI41032583614](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/41032583614) passed both jobs for PR head33f27aa1da6d74d8d50acb7ba1dabdefcbe9f554. CI checked GitHub's synthetic merge ff7d94c into main3cb751449afcd98748a4cebcc54fd5414e5fbce9, with2,448 tests/97 files and0 lint errors/42 existing warnings. It verified preceding knowledge54d385d1a7045c78bf25e27de4ac43f265aa71a2, not the forthcoming import.

Mechanical lint, registry preservation and independent knowledge reviews are recorded before publication. Source/import CI each require their actual result; no future delivery success is inferred. Publish through [draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33), retaining the source/import distinction. No main merge or production enablement occurred.

Next M1.3.4b supplies the remaining core phase bodies; M1.3.5 supplies actual v3 handoff/pump/answer routing/projection/restore/terminal and fault ownership. Full release gates remain unchanged.
