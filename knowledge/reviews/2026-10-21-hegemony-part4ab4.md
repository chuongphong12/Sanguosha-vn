# Part 4ab.4: SinglePeach through actual Room

Source/test commit `3dff86d2a37f0b10c18e280c0bfac4cfc915c180`, reviewed against fixed base `c487311be37dbe47da35a438e8fdd29b02bdc85d`. The user approved option A: replace the use callback with a fixed Room child retaining accepted reference and outer history=false. [Specification #21](https://github.com/chuongphong12/Sanguosha-vn/issues/21), [native research](../research/2026-10-21-single-peach-room.md) and [current contract](../engine/single-peach.md) define the accepted seam. Native authority remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.

## Implemented result and authorities

| Concern           | Real implementation exercised                                                                                                               | Remaining adapter / exclusion                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| SinglePeach owner | Request/response validation/retry, ChoiceMade, UsedBySecondWay, fixed registered Room child and original response after-hook                | Input/parse/focus/transport, native MethodUse legality, conversion, card string and current metadata authorities               |
| Room              | Actual parse/flag/tag bridge, ordinary limitation/validation, normal use, converted recursion/history and ordinary after-hook               | Concrete package metadata/parse/conversion/hooks; policies in the shared test helper are fixtures around the real wrapper      |
| Card execution    | Actual normal/SkillCard onUse, shared GameRule/resources/effects, physical table/discard movement and recovery                              | Concrete Peach/Analeptic/ViewAs effects, skill eligibility/reveal/notifications and package catalogue remain explicit fixtures |
| Rescue and death  | Actual enclosing rescue loop, repeated asks after ineffective use, existing actual death registry retained in successful-rescue bypass test | Wansha/prohibition/lock and package authorities; not complete native content or match certification                            |
| Persistence       | Actual scheduler operation/event/movement JSON restore, prompt rejection and eager interruption state                                       | Native unwind, full-match reconnect, production authentication/network/UI/bots                                                 |

Only runtime module `peach-response.ts` changed. The use callback is removed, `resolve` supplies copied-state current metadata, and shared `resolveResponse` enforces accepted/original reference identity and current storage flags. The existing response after policy remains named validateAfter but owns native validateInResponseAfter. Room's own ordinary validateAfter stays separate. Original, accepted and Room-converted reference identities are independently retained.

Room false still leads to original response after and nonnull accepted return. Outer false suppresses only outer history; Room conversion child defaults true. Current metadata is reread after ChoiceMade, before raw after and after that hook for final return. There is no new HP/alive guard after acceptance, no generic CardAsked/provider/pattern mutation and no second use by AskForPeaches.

## Executed validation

- Existing focused baseline: **202 tests** across dying/death/Room, exit 0. Behavioral red: registering actual Room while making the old callback throw exposed the legacy use bypass. Direct Room composition made that public-dispatch test pass. A later behavioral red exposed frozen accepted flags after CardFinished; current resource resolution made the regression pass.
- Initial research incorrectly inferred that readSlashCard rejected SkillCards. Two composition tests for raw/validated SkillCard passed before any decoder edit. Inspection confirmed its existing readExecutionCardUse delegation. The research and issue were corrected; decoder and outer rescue consumer remain unchanged. This is regression protection, not a decoder repair claim.
- Final focused suite: **223 tests**, including **21 added regressions**; exit 0. Coverage includes actual Room false branches, next ask/refusal, ordinary conversion and child history, raw/accepted/converted identities and hook ordering, current materials and flags, wrapped identity, mutation isolation, identity substitution rejection, pattern preservation, target becoming healthy/dead after ChoiceMade, actual movement reload and all three interruption reasons after payment.
- Existing operation/event pause tests now compose actual Room. Added Room ordinary-validation/after pauses and registry mismatch rejection; movement cases suspend for the selected observer at real table and discard boundaries. Native movement broadcasts to multiple observers; observer events are not counted as repeated payment. Actual normal CardFinished may add its own tags, so preservation assertions do not require an invented empty tag map.
- Final `npm run check`: exit 0, **77 files / 1,956 tests**, typecheck passed; **42 inherited lint warnings / zero errors**. Final `npm run build`: exit 0. Tested/reviewed final LF bytes below were fixed before these full checks. Staged whitespace check passed.
- Canonical link/content review, publication, subtree offline/upstream verification and fresh local clone → old checkout → return checks accompany delivery. The game lock identifies the exact published knowledge commit/tree; no remote game CI is inferred from local checks.

## Independent Standards and Spec reviews

Standards: **0 actionable findings**, including the documented standards and baseline smell review. Spec: **0 actionable findings** against option A and #21; the Spec reviewer independently ran all **223 focused tests**, exit 0. Both independently confirmed these final hashes:

The subsequent canonical knowledge review covered all 12 changed/new files: Standards **0 findings**, Spec **0 findings**. Both reviewers independently verified **69 Markdown files / 260 relative links**. Publication and subtree/checkout verification are additional delivery checks.

| File                                    | SHA256                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| `src/game/hegemony/peach-response.ts`   | `2ef0bae7ace8bf665048b798c28607760912eb2df35d00da2cf78e49cdef9a27` |
| `tests/hegemony/dying.test.ts`          | `517a9f78215fc0077b8a010ea9f102522a5404278c92c9ef1f6f577ae803a862` |
| `tests/hegemony/death.test.ts`          | `51e027c50ec6b036c2bf846b952bb55a4c633adad416ac5818f4161b6b96a866` |
| `tests/hegemony/fixtures/peach-room.ts` | `f78419332a9e09d20d7bce9faf471cd85dbd66bfb2001fe9beae4a7918d8ea57` |

## Graph checks and explicit limits

Graph queries were bound to the exact engine worktree. The initial index was one documentation-lock commit behind; byte equality was verified for inspected source, then a zero-source-change refresh brought its commit label current. Pre-edit exact SinglePeach/runSingle, outer rescue, Room factory and test setup impacts were LOW. Existing shared metadata/decoder helpers had HIGH/CRITICAL impacts and were reused without changing their bodies. CodeGraph independently resolved the direct fixtures/test consumers.

Final GitNexus **1.6.12 full rebuild**: **307 files / 9,370 nodes / 23,998 edges / 232 clusters / 530 processes**, no empty symbol IDs. Runtime and both changed test-suite hashes match GitNexus and CodeGraph. GitNexus hardcodes the `fixtures` directory in its default ignore filter (`ignore-service.js:119`), so it omits the new helper. That omission was not treated as unused: independent CodeGraph byte identity and helper impact resolve its actual dying/death test callers and fullRegistry. No tooling filter change or unrelated source move was introduced.

Post-change exact impacts: SinglePeach factory LOW (four direct), runSingle LOW (one), Room factory LOW (four); unchanged resolveResponse HIGH (four direct / four selected processes), unchanged readSlashCard CRITICAL (eight / eleven). Staged detect_changes: **66 symbols / four files / three processes / MEDIUM**, no partial/truncated result within the indexed scope. The helper's separate CodeGraph coverage remains explicit.

Cumulative comparison from `21d693e4c9c046b30085fc11a6a434d4d8bb3e31`: **1,134 symbols / 45 files / 47 processes / CRITICAL**. The raw cumulative listing hit the tool's hard 1,000-symbol cap. Supplemental bounded exact-path graph queries using the original exported diff/hunk overlap logic recovered all **1,134 unique IDs**, containing every listed ID; separate process-edge queries recovered the same **47 process IDs**. Raw truncation and complete supplements are retained together. This does not recover globally unextracted flows or the omitted helper.

The three selected exact process IDs (`proc_134_run`, `proc_135_run`, `proc_136_run`) trace SinglePeach run → runSingle → limitation/request/response validation. They are heuristic acquisition traces, not extraction of registered Room/event dispatch; real composition tests provide that evidence. Global extraction drops **373 entry candidates / 1,270 callees**, cuts **18 walks**, leaves **25 cross-language property sites** unresolved and skips one oversized font.

CodeGraph **1.6.0**: **261 files / 3,283 nodes / 16,778 edges**, complete state, no pending changes/refs, worktree mismatch or reindex recommendation. All four file hashes match its source records. Local receipts: Temp `tqs4ab4-red-room.log`, `tqs4ab4-red-metadata.log`, `tqs4ab4-focused-final.log`, `tqs4ab4-check.log`, `tqs4ab4-build.log`, `tqs4ab4-gitnexus-final.log`, `tqs4ab4-codegraph.log`, `tqs4ab4-graphs.json`, `tqs4ab4-helper-impact.json` and primary-source receipts linked in the research. Source pins/tests/hashes are durable attribution; temporary logs are not game assets.

## Delivery and next dependency

Source is committed locally on codex/hegemony-card-admission. Canonical knowledge is reviewed/published before full-SHA subtree import; clone/switch verification checks committed source and matching docs travel together. No game push, PR/main merge, deployment, native runtime differential or production readiness is asserted.

Next scope outer Room::judge draw/start/actor iteration/finish composition. Other retrial packages, phase/turn/unwind, enabled content/dealing, production private authorities/commands/views/UI/bots and complete-match conformance remain separate. Production still registers Standard2013.
