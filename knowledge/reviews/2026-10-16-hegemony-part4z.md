# Part 4z — shared SkillCard execution

[Ticket #17](https://github.com/chuongphong12/Sanguosha-vn/issues/17) implements the next shared-execution slice after isolated Part 4y. See the [current contract](../engine/skill-card-execution.md) and [pinned native investigation](../research/skillcard-shared-execution.md). This checkpoint does not certify admission/response or production play.

## Source identities

- Implementation base: game `cecfe2a5f05572b7dad1633663c0f6ac92f826e5`, completed local Part 4y plus its final knowledge pin.
- Source/test commit: game `2d902402f456aa72cf51b6b777e7102c09fa1c8d`, local branch `codex/hegemony-skillcard-execution`. Game-branch publication is not asserted.
- Native authority: QSanguosha-QuocChien 2.3.43-beta2 `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`; local HEAD and reference cleanliness were verified.

| File                                          | Git blob                                   | SHA256                                                             |
| --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `src/game/hegemony/card-effect.ts`            | `2c53c308049c5265606effe47a55cb2ac20ffaf5` | `e5584c2f7d4802197b1d8589a97c6950e80d057f7d0cc7b9674df7422a19d4c6` |
| `src/game/hegemony/card-on-use.ts`            | `b4808a8983671e6afd3d7ee9841b5cac6391d0f7` | `440b4057dc1ed2ae8e2bfd6526796d4e8cce4eccbe65dd4a0b35a1d36d447d8f` |
| `src/game/hegemony/card-resources.ts`         | `2c51c8b2a873a85db93129d7a3771c3d64fe1239` | `2fd40931d9e39ef168c5ee7fd98953cdfde4d24cd79dbe0ca0dff9e09578215b` |
| `src/game/hegemony/card-use.ts`               | `61b2ecf5c355ec83ffd2dc5288ee9980143d877e` | `34cc358ba4ab785454b17849ef9b671809ad4c11cd4eaa7f892b953a821f8231` |
| `src/game/hegemony/card-used.ts`              | `c2fcaeb1a7549a9e602bbb576aa2bce310217d36` | `e146062441829d0142ca293b26702dfdf4822d0489a52ab15fda16e0354519f4` |
| `src/game/hegemony/skill-card-on-use.ts`      | `d114d7a77d3d78b3ecded6c6fed4e1ecf1c81336` | `bd70d6e2333126c9d4e9b1058385f4ff70ee5bfebc4deb5b61d7e96e66293f0d` |
| `src/game/hegemony/slash.ts`                  | `b12d6246ce94a43a62e9cad343e81654e4ba11f0` | `dd4f2d99fc55dfb54733e4e61ea3afa57e4b6dc158e4bd3dbd46ffb43ca3635a` |
| `tests/hegemony/skill-card-execution.test.ts` | `b248e8bf2a9bbc9df1b897598fcb93e0263e6f86` | `2eccf8c63504f92e54708812bf2ab973c78fe456932a695b5a425dd20f8c9a89` |

Seven game source files and one new regression file changed. Dependency manifests/lock, scheduler, movement, reward-token bodies, damage/recovery bodies and production runtime were not edited. Later subtree imports change only documentation and its lock.

## Actual operations and supplied authorities

| Boundary            | Actual behavior exercised                                                                                            | Remaining fixture or limitation                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Entry/envelopes     | SkillCard onUse/default cost and narrow non-Skill entry; both late shared result reloads                             | Earlier rich SkillCard metadata and pre-dispatch non-Skill restrictions remain explicit; no admission/history  |
| Shared GameRule     | Actual CardUsed target dispatch, preAction/use void boundaries and CardFinished cleanup                              | Package override/reference selection supplied by fixtures                                                      |
| Resources/effects   | Current reference flags/tags, Jink preparation/restoration, wrapped cleanup, common use/effect/GameRule CardEffected | Live package identity/ancestry and full pointer/subcard mutation remain external                               |
| HP                  | Actual damage/HP and recovery operations accept SkillCard references; null damage reference stays null               | Selected effect adapter, not enabled Jieyin or other general content                                           |
| Four reward tokens  | Actual marks/cost, use bodies, fill-hand and fixed-pile movement through actual CardUsed                             | Package routing, sufficient fixed deck, choices, reveal/post-show and transport are fixtures; no recycling/RNG |
| Nested execution    | Actual SkillCard within SkillCard; actual token Peach onUse/effects/recovery; direct Careerman FirstShow.use         | Permission and production content registration remain absent                                                   |
| Privacy/persistence | JSON continuations, actor-filtered prompts, public/private FirstShow fixture notices                                 | Authoritative traces/state/results remain private; no complete battle projection/transport certification       |
| Interruptions       | All three reasons retain paid costs and freeze remaining work                                                        | Native exception unwind/restoration remains a later gate                                                       |

## Executed source validation

- Baseline docs verification: exit 0 against canonical `c5f6ceb168e3ac0bc61d258d0c91a62f15a6cb29`.
- Fresh baseline `npm run check`: exit 0, 71 files / 1,636 tests; lint/typecheck pass, 42 inherited warnings and zero errors.
- Initial public composition failed behaviorally with Invalid card use at actual CardUsed validation after real SkillCard dispatch/cost. The shared execution reader/consumer changes made that tracer pass. Missing imports/handlers were not counted as red evidence.
- Independent Spec review found whole-card replacement failing after common effects because the SkillCard outer reader still demanded skill-only metadata. Four full replacements at TargetChoosing and two at CardFinished reproduced six failures with Invalid SkillCard descriptor before normal completion. The fix uses the shared descriptor only for late results; original/post-Pre snapshots remain rich SkillCard uses. All six then passed.
- Focused final new suite: 51/51 pass. Combined with unchanged 4y envelope suite: 100/100 pass. Public tests cover targetless overridden use/preAction, target snapshots, four type rewrites plus Slash, wrapped/latest/same-key reference storage, effect nullification/dead/multiple recipients, ignored Confirmed rewrites, recovery/damage references, nested uses, four token costs/draws, token Peach and Careerman FirstShow, ten shared-operation/event reload locations plus four token movement reloads, malformed early/late payloads, invalid/stale/wrong-actor/replayed/registry replies and all three interruptions.
- Test-fixture assumptions corrected against existing contracts: scheduler freshness uses prompt IDs rather than an invented revision property; interruption reason is game-over; new discard batches prepend to the discard pile. These were not engine bugs or separate behavior-red claims.
- Final `npm run check`: exit 0, 72 files / 1,687 tests, lint/typecheck pass with the same 42 inherited warnings and zero errors. Final `npm run build`: exit 0 after the review fix. The final full check followed the last test-only correction to the remaining-target room-tag assertion. Source bytes were unchanged after the final build; source/test bytes were unchanged after the final full check and exact-byte delta reviews.
- Staged whitespace and exact-byte review checks passed. Source/test identities above are the reviewed bytes, not an inference from a later documentation-only commit.

## Independent reviews

- Standards: initial seven-file review zero findings; final eight-file re-review zero documented violations/actionable Fowler smells. Independent final focused run 51/51 pass.
- Spec: initial one P2 full-descriptor replacement gap. Corrected and re-reviewed: zero remaining findings; independent final combined run 100/100 pass. Entry guards, native local/shared snapshots, actual versus fixture authorities and production exclusions checked separately.
- Durable contract/research/index review: both axes reported zero findings. The documentation now explicitly states that both envelopes accept shared descriptors late, retaining original/post-Pre SkillCard metadata.
- Final checkpoint/source-baseline review: both independent axes reported zero findings against the prepared record and source-baseline, confirming all eight committed blob/SHA256 identities and saved graph summary. Their review does not certify the explicitly pending publication/import/clone steps.

## Graph integrity and limits

Graph-first exploration and pre-edit impact preceded changes. Exact Hegemony CardUse alias, readCardUse, readCardEffect and readSlashCard impacts were CRITICAL; the shared decoder reaches damage/dying/recovery as well as effects. Low-level owner/factory impacts were also checked. Three GameRule factories returned UNKNOWN; independent CodeGraph callers and explicit imports found nine existing Hegemony suites, so UNKNOWN was not treated as unused. CodeGraph's baseline readCardUse impact had 57 nodes / 83 edges. Before the review fix, CodeGraph factory impact for SkillCard onUse resolved six nodes / eight edges and only the existing/new fixture callers.

Final GitNexus 1.6.12 index-only rebuild succeeded with 8,128 nodes / 21,370 edges / 212 clusters / 509 flows. Indexed HEAD was implementation base cecfe2a while the staged source/test bytes were indexed. All eight indexed SHA256 values matched both reviewed worktree bytes and staged Git blobs. Exact definition contexts for readExecutionCardUse, readCardUse, readSlashCard and createSkillCardOnUseOperation resolve the intended Hegemony files with epistemic=exact. Staged detect_changes reports 213 changed indexed symbols, eight changed files, 39 affected flows and CRITICAL risk. Focused result has no partial/truncated flags; the complete response was inspected from its saved artifact rather than relying on a truncated terminal display. The affected decoder/resource/scheduler paths justify broad existing regression and source review, not new production wiring.

Final CodeGraph 1.6.0 sync/status: exit 0, 250 files / 2,991 nodes / 15,112 edges, complete extraction, zero pending changes/refs, no worktree mismatch or reindex recommendation. Its shared-reader callers resolve the seven expected source modules, including both envelopes and generic reference decoding.

Whole-repository GitNexus extraction still omits 334 entry candidates and 1,204 callees; 19 walks hit budget. Thirteen cross-language property sites are not linked and a font larger than 512 KiB is skipped. Some transitive callback flows reach build/server entry paths, so flow counts are not precise production routing claims. Focused exact definitions/hashes, the independent graph, direct imports/source and public regressions support this checkpoint. Unrelated untracked audit/old review files were preserved and excluded from source commits.

The initial GitNexus incremental rebuild after the review fix failed while copying properties because its 256 MiB buffer pool was exhausted. No source change was made to address the tool failure. A force/index-only retry used a process-local 2 GiB buffer setting; its actual completion and integrity checks are recorded above. Global extraction limits remain explicit rather than being interpreted as an all-clear.

## Knowledge delivery

- Canonical relative-link validation passed: 44 Markdown files / 150 relative links. Documentation whitespace checks passed.
- npm run docs:test exited 0: five real-Git tests passed, covering ordinary clone/switch/worktree, explicit pin/offline verification, malformed/stale locks and false provenance, edit preservation and broken links. This run took about 282 seconds; the CLI implementation was not changed.
- Prepared canonical snapshot `38e3166d2fee39b00264e8310f2155a262986d85` was published successfully and imported by the supported `npm run docs:sync -- <full-SHA>` command. The game lock was committed at `c80ae21d73a5ad68e779a572956bf9ee7da76e8b`; its documentation tree was `b7cffcd7a72ad193d0ecb2bee11c402afbcc3055`.
- Offline `npm run docs:verify` and published-canonical `npm run docs:verify:upstream` both exited 0 against that prepared snapshot. The game delta after the source commit contained only knowledge files and its lock.
- An ordinary local clone of game checkpoint `c80ae21d73a5ad68e779a572956bf9ee7da76e8b` contained the 4z contract immediately. Switching to the 4y baseline restored its old knowledge lock and removed the 4z contract; switching back restored the exact 4z pin and file. All three offline verifications passed and the validation clone stayed clean. This verifies local checkpoint checkout behavior, not remote publication of the game branch.
- This sealing record adds only actual delivery results after those checks. Its containing canonical SHA/tree is recorded in the final game lock rather than self-embedded here. Final snapshot verification must use that lock. No game PR, game-branch publication, remote game CI or production deployment is asserted.

## Remaining dependency

Admission/history, phase/skill ownership, availability/material/target legality and distinct play/response-use/pure-response entry paths are next. Live packages/reference/transport authorities, complete lifecycle/unwind, enabled content, filtered production battle views, native runtime differential and full-match E2E remain separate gates. Standard retirement remains at the approved playable-replacement cutover.
