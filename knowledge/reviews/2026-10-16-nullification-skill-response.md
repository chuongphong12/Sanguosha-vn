# Raw SkillCard Nullification conversion — #18

[Issue #18](https://github.com/chuongphong12/Sanguosha-vn/issues/18) repairs the reproducible compatibility gap found in the [post-4z audit](2026-10-16-hegemony-admission-audit.md). The user's continuation approved this bounded repair. Generic Room::useCard/history and other response entries remain later work. This record supersedes the audit's pending-repair status only at the new source revision; the audit remains historical evidence.

## Source identities and implementation

- Implementation/review base: game `5ed160023c8d1b1cf9ad8746ba45c778528df301`, sealed admission audit with unchanged 4z engine source.
- Source/test commit: game `89b8e5d130ffdc9ad9d53f494bfa4f400f8b5d46`, local branch `codex/hegemony-nullification-skill-response`. Game branch publication is not asserted.
- Native authority: QSanguosha-QuocChien 2.3.43-beta2 `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, unchanged from the verified audit pin. See the [native entry investigation](../research/card-admission-and-response-audit.md).

| File | Git blob | SHA256 |
| --- | --- | --- |
| `src/game/hegemony/nullification.ts` | `cf4590765d33d8cf847b01a118c7ffa962dfee58` | `eb7c814d4152d549d5f284bb161c291460491a1aa5959b871cecca3d6cee4833` |
| `tests/hegemony/nullification.test.ts` | `1c6f511f491f14fd5d3af91bad0f6eaf4fd984c6` | `7a36703aec5f7bad3db4d3288505cafdcec7f0ebb2f4cc4e12a076aaa1d28c3a` |

Only the response reader and Nullification's own post-PreCardUsed/post-CardUsed descriptor reloads switch to readExecutionCardUse. The shared reader itself and unrelated strict non-Skill onUse entry are unchanged. Registered private resource references remain required. Raw rich metadata/reference are retained for original validateAfter; classification, physical materials, reveal and counter identity still use the validated reply. No fake basic/trick coercion, history wrapper, enabled package or production permission is added.

Native source checks support accepting SkillCard before conversion: the race verifier at room.cpp 1233–1242 checks Parse, not TypeSkill or ordinary-play availability; room.cpp 1332–1358 saves the original card and calls validateInResponse before Heg classification. The direct lifecycle/original validateAfter follows at 1423–1500. Miewu is a concrete conversion example at mol.cpp 127–155, but no Miewu runtime or cost is implemented here. Base validateInResponse can retain the original card, so the direct lifecycle must also tolerate a trusted validator returning a SkillCard.

## Actual integration and fixture boundaries

| Boundary | Actual exercised behavior | Fixture or remaining authority |
| --- | --- | --- |
| Entry/conversion | Public dispatch reaches raw SkillCard validation and accepts ordinary/Heg conversion or retained SkillCard | Private package converter, resource ancestry and race proposals are supplied fixtures |
| Shared execution | Actual CardUsed operation/GameRule, CardFinished cleanup and physical movement in the ordinary conversion tracer | Nullification's empty use override and reference selection are explicit adapters |
| Identity/materials | Raw material stays in hand when returned card uses a different material; returned material is discarded; original metadata/flags and after-hook identity survive | Stable private references, not live native pointers/subcard mutation |
| Retry | Null conversion refreshes race, does not move rejected material or call its after-hook; empty refreshed race returns false | Conversion's own eager effects are not assumed to roll back |
| Persistence/privacy | JSON reload at validation, reveal and after-hook; actor-filtered prompts; wrong actor/stale/invalid/registry/replayed answers reject without mutation or duplicate completion | No network race/production battle projection certification |
| Invalid data | Six raw/converted reference/type/material/flag rejection cases precede movement/after-hook | Descriptor/reference validity is distinct from gameplay ownership/legality |
| Interruption | Three reasons retain an explicit conversion fixture marker and stop remaining lifecycle | Marker is not an actual Miewu payment; native exception unwind remains pending |

## Executed validation

- Fresh unchanged baseline npm run check: exit 0, 72 files / 1,687 tests; typecheck/lint pass with 42 inherited warnings and zero errors.
- First public behavioral red: raw SkillCard conversion failed with Invalid card use at readResponse before validateInResponse. Switching only the raw/converted response decoder made that tracer green.
- Second public behavioral red: trusted validation retaining the SkillCard failed at the own post-PreCardUsed narrow reader. Switching its two own shared-event reloads made the complete direct lifecycle green. These are behavior failures through registered operations, not missing imports/handlers.
- Seventeen permanent public dispatch/resume cases were added. Final focused command: node node_modules/vitest/vitest.mjs run --config vitest.config.ts tests/hegemony/nullification.test.ts tests/hegemony/card-on-use.test.ts. Exit 0: 96 Nullification plus 43 unchanged non-Skill onUse tests, 139 total.
- Final npm run check: exit 0, 72 files / 1,704 tests; typecheck/lint pass with the same 42 inherited warnings and zero errors. Final npm run build: exit 0, Vite 1,149 modules. Source/test bytes were unchanged after these checks.
- Staged whitespace check passed. All two committed blob/SHA256 identities match the independently reviewed and graph-indexed bytes.

## Independent reviews

- Standards: zero documented violations or actionable Fowler smells. Independent new-case run: 17 passed, 79 old declarations skipped.
- Spec: zero missing/incorrect requirements or scope creep against approved #18. Independently reran both focused suites: 139 passed. Raw/converted identity, retained SkillCard, null retry, private references and unrelated onUse guard checked separately.
- Canonical contract/checkpoint/source-baseline reviews: Standards zero findings; Spec zero findings. Both verified current versus historical scope, exact source/test identities, native semantics, fixture boundaries and honest pending delivery claims. Publication/import checks were outside those prepared-content reviews.

## Graph integrity and limits

Pre-edit exact readResponse and runNullification impacts were LOW, each with one direct caller / one flow in the intended file. CodeGraph independently resolved readResponse -> runNullification -> operation factory (three nodes / two edges). The shared reader's existing CRITICAL impact (ten direct dependents / 21 flows) was known; that reader was not edited.

Final GitNexus 1.6.12 index-only rebuild succeeded using the process-local 2 GiB buffer setting: 8,206 nodes / 21,504 edges / 211 clusters / 509 flows. Indexed commit was implementation base 5ed1600 with the staged fix bytes indexed. Both indexed SHA256 values match worktree bytes and committed blobs above. Exact contexts resolve readResponse and runNullification in the intended Hegemony file. detect_changes scope=all reported 14 changed indexed symbols, two changed files, four affected flows and MEDIUM risk; those flows are HasNullification, IsOnline, Race and ValidateResponse. No focused partial/truncated flags were present; the complete saved response was inspected.

CodeGraph 1.6.0 final sync/status exited 0: 250 files / 2,993 nodes / 15,178 edges, complete extraction, zero pending changes/refs, no mismatch or reindex recommendation. Native source was unchanged; native graph evidence remains the revision-scoped audit, not a newly certified native CodeGraph run.

Whole-repository GitNexus still omits 334 entry candidates / 1,204 callees and cuts 19 walks. Thirteen cross-language property sites remain unlinked and a font larger than 512 KiB is skipped. Focused definitions/hashes, independent graph and actual public regressions supplement those limits; no complete-callgraph or production routing guarantee is claimed. Preexisting unrelated untracked audit/old review files were preserved and excluded from commits.

## Knowledge delivery and remaining work

Final canonical relative-link validation passed: 47 Markdown files / 161 relative links; whitespace checks passed. Prepared canonical snapshot `ecae2bff9d38d94f05709e07375fdae9eace76e9` was published successfully and imported through npm run docs:sync with its full SHA. Game checkpoint `551bfcf178b539b02224ec88afa4e87df0b1bfa8` pins its tree `2c67ea315ddd9ad09ec9270df5493a7ce79b9a5e`. Offline npm run docs:verify and published-canonical npm run docs:verify:upstream both exited 0. The game delta after the source commit contains only the five knowledge files and their lock.

An ordinary local clone of game checkpoint `551bfcf178b539b02224ec88afa4e87df0b1bfa8` included the new fix checkpoint immediately. Switching to audit base `5ed160023c8d1b1cf9ad8746ba45c778528df301` restored the old `223b8647011d4f86988bf706d1eeb3319cc75a43` knowledge pin and removed the new checkpoint; switching back restored the exact prepared pin and checkpoint. All three offline verifications passed and the clone stayed clean. This validates local clone/checkout behavior, not remote game branch publication. Knowledge tooling was unchanged; its prior five real-Git tests remain revision-scoped evidence in the [4z checkpoint](2026-10-16-hegemony-part4z.md), not a new run here.

This sealing record adds actual delivery results after those checks. Its containing canonical SHA/tree belongs in the final game lock rather than self-embedded here; final snapshot verification must use that lock. No new game PR, remote game CI, deployment, native runtime differential or full-match E2E is asserted. Issue #18 stays open while the source branch is local.

Next is the separately scoped 4aa Room::useCard wrapper: native validation/conversion/history semantics must remain distinct from authoritative web command legality. Other askForCard MethodUse/MethodResponse, rescue composition, phase progression, live package/transport authorities, interruption unwind, enabled content and production cutover remain separate gates.
