# Part 4y checkpoint — isolated SkillCard onUse

Requirements: [GitHub #16](https://github.com/chuongphong12/Sanguosha-vn/issues/16). User approved approach A, isolated onUse with separate validation for each part, on 2026-10-15. [Design](../specs/hegemony-skillcard-integration-draft.md), [native investigation](../research/skillcard-integration.md) and [current contract](../engine/skill-card-on-use.md) distinguish this checkpoint from complete generic SkillCard integration.

## Source identities

- Implementation base: game `ad36b5a8212275b0fa8b3d2128b3daeaa52f4527`, the merged knowledge delivery on `codex/hegemony-engine`.
- Source/test commit: game `eb769fc52bfd8af4811cf6b8e200e0b6a2530c32`, committed locally on `codex/hegemony-skillcard-on-use`. Game publication is not asserted by this report.
- Native authority: QSanguosha-QuocChien 2.3.43-beta2 `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. Local native HEAD matched and reference files were clean.

| Reviewed file                              | Git blob                                   | SHA256 of indexed/reviewed bytes                                   |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| `src/game/hegemony/skill-card-on-use.ts`   | `a63f4c6986fd9b7d98fbd9aeed5decc60f3d88b0` | `4843571c855b650303c46086a389efa3c9fac862ecd0132f629af84804783d6e` |
| `tests/hegemony/skill-card-on-use.test.ts` | `c1d06911d32eaa51e8c790af931f0a46771262b5` | `b66555746162d4380fa34370b2de9d5ad4ab9d347da24349d1cddeb84bdbb133` |

Only these two game source/test files changed. Existing non-Skill readers, scheduler, movement, token operations, legacy runtime, dependency manifests/lock and assets were not edited. Later knowledge import changes the tracked documentation snapshot/lock; source validation below applies to the exact blobs above.

## Implemented authority and supplied adapters

| Boundary               | Real behavior exercised                                                                                       | Remaining authority or limitation                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Scheduler              | Public dispatch/resume, event/operation nesting, JSON reload, prompt routing and replay rejection             | Production authentication/transport and registry deployment                                                     |
| onUse                  | Original, post-Pre and shared-event snapshots; initial action order; flags/history; events and normal cleanup | Stable normalized descriptor metadata; native pointer mutation outside explicit current flags/materials adapter |
| Default cost           | Actual throw/discard movement and willThrow distinction                                                       | Actual-general metadata supplied privately; full package cost overrides and ownership legality                  |
| Token cost             | Actual mark consumption for all four existing token operations                                                | Enabled/target/phase/request legality remains separate                                                          |
| HalfMaxHp use          | Existing token-use operation plus actual fixed-pile draw movement                                             | CardUsed bridge is a named fixture; draw replacement, recycling and RNG are absent                              |
| Original card identity | Supplied current-material/current-flag callback, validated copies; claimed materials are not swept            | Production card catalogue/reference mapping                                                                     |
| Reveal and post-show   | Correct child order and captured player versus post-Pre source distinctions                                   | Fixture showSkill/afterShow do not implement Huashen removal, trick quartet branches or complete reveal content |
| Logging/privacy        | Explicit hidden flag, requester-only prompt routing, no actual names in tested completion/prompt values       | Actual transport redaction and complete filtered battle projection                                              |
| Interruptions          | All three reasons freeze frames and retain paid marks/flags/position history                                  | Native operation-specific unwind/restoration is not implemented                                                 |

## Executed validation

- Baseline `npm run docs:verify`: exit 0 against previously pinned canonical `27134851bdbc140fabbeb5b1959c9d8574da3d6a`.
- Baseline `npm run check`: exit 0, 70 files / 1,587 tests, lint/typecheck pass; 42 inherited warnings and zero errors.
- Tracer red evidence followed successful public dispatch. Observed behavior failures for missing event/cost envelope, initial sort/history/flag timing, original cleanup, post-Pre non-Skill cost branch, original live flag lookup, default throw movement and malformed-input atomicity. Focused green runs followed their implementations. Import/missing-handler failures were not counted as behavior evidence.
- Final focused direct Vitest run: 49/49 passed. Covers four token costs, HalfMaxHp use/draw composition, normal/default costs, captured versus current identity/materials, child result isolation, consumed events, nested uses, malformed early/late boundaries, eight log/cost/reveal/event reload locations and two actual movement reloads, invalid/stale/wrong-actor/cancel/registry/replayed replies, and all three interruptions.
- Two test assumptions were corrected against existing scheduler/movement contracts: an unknown dispatch actor returns false before validation; BeforeCardsMove runs for multiple recipients, so the pause fixture selects one recipient. Those are fixture corrections, not claimed engine regressions.
- Final `npm run check`: exit 0, 71 files / 1,636 tests; lint/typecheck pass with the same 42 inherited warnings and zero errors. `npm run build`: exit 0. No game source/test changes followed these commands or the exact-byte reviews.
- `git diff --cached --check`: exit 0 before the source commit. Reviewer blob hashes, staged/worktree blobs and GitNexus file SHA256 values matched.

Knowledge publication, import, link checking and snapshot verification are recorded separately below. Baseline docs verification alone does not certify a new snapshot.

## Knowledge delivery validation

- Prepared canonical snapshot `ac209fc7405a07f5c070aa9ea2a9843a7ff2c370` was imported through `npm run docs:sync -- <full-SHA> --from <local-canonical-repository>`; import and `npm run docs:verify -- --from <local-canonical-repository>` both exited 0. The corresponding game lock was committed.
- Canonical publication to the selected public knowledge repository succeeded; `git ls-remote` confirmed main at that exact prepared SHA. `npm run docs:verify:upstream` then exited 0 against the published canonical commit/tree.
- Canonical relative-link check passed: 41 Markdown files and 131 relative links. Documentation diff whitespace and formatting checks passed.
- `npm run docs:test` exited 0: all five real-Git tests passed, including ordinary clone, branch switch, worktree, offline verification, malformed/stale locks, false provenance, local-edit preservation and broken links. This local run took about 275 seconds; no CLI implementation change was made for its duration.
- This sealing record is a documentation-only update after those checks. The final imported canonical SHA/tree belongs in the game's `knowledge.lock.json`; this report does not self-embed its containing commit. Source/test bytes remain the reviewed blobs above. Game-branch publication, a new game PR and production deployment are not asserted.

## Independent reviews

- Source Standards: zero hard violations and zero actionable smell findings. Independent 49/49 focused run and baseline knowledge verification passed.
- Source Spec: zero findings against ticket #16, approved scope and pinned native caller semantics. Independent 49/49 focused run passed.
- Durable documentation Spec: no code/contract discrepancies. The reviewer required advancing source-baseline.json from 4x to the actual 4y source commit; applied before publication.
- Durable documentation Standards: one wording ambiguity said the research recommendation was unapproved after scope approval. Replaced it with the approved-design link. No other actionable findings.

## Graph integrity and limits

Graph-first native and web exploration preceded source reads. Initial new factory lookup returned UNKNOWN; CodeGraph and explicit path inventory found no preexisting definition, establishing new-file scope rather than proving general absence of consumers. Existing readCardUse impact was CRITICAL (67 dependents, 21 flows), and readRecipientFlags was CRITICAL (43 dependents, 12 flows). Their bodies were not changed. createCardUsedOperation returned UNKNOWN; direct imports/calls identified nine Hegemony suites, so that result was not treated as unused or safe to broaden.

GitNexus 1.6.12 index-only rebuild: exit 0, 7,898 nodes / 20,967 edges / 210 clusters / 508 flows. Indexed HEAD was the implementation base ad36b5a while it indexed the staged additions; SHA256 receipts for both added files matched the reviewed source exactly. Staged detection reported 158 changed indexed symbols, two changed files, four affected flows and medium risk. No partial/truncated flags were present in that focused response. The four affected flows are the new validation/run paths to readUse, strings and materials. Exact factory contexts resolve the intended file/definition; only the new test registry/file is reported as a caller. CodeGraph independently resolves the same caller scope.

CodeGraph sync: exit 0; final status complete with 249 files / 2,958 nodes / 14,818 edges, pending changes zero, pending refs zero, no worktree mismatch and no reindex recommendation.

Whole-repository GitNexus flow extraction remains incomplete by its explicit budget: 333 entry candidates and 1,203 callees omitted; 19 walks cut by budget. Thirteen cross-language property sites were not linked; one generated/vendor font over 512KB was skipped. These limits are not converted into a clean whole-architecture claim. Focused exact definition/hash checks, the independent graph, public behavior tests and direct source comparisons support this additive checkpoint only. No existing source function/class was edited.

## Remaining work

Shared SkillCard-aware GameRule CardUsed/CardFinished/resources/effects, then generic legality and the distinct play/response entry points, are the next integration dependencies. No production control/content, complete phase orchestration, exception unwind, native runtime differential or full-match E2E is enabled or certified. Standard retirement remains at the approved playable-replacement cutover.
