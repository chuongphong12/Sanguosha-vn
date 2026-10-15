# Part 4x checkpoint

Requirements: [GitHub #8](https://github.com/chuongphong12/Sanguosha-vn/issues/8). Baseline `d8dcd7b2c33108a1739098d8ff487c9f13b6b788`. Native reference is `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, locally verified. The accepted seam remains private public-operation dispatch/resume, not a new client command.

## Reviewed source

The exact source/test snapshot is identified by Git blob IDs; the containing commit also includes this checkpoint.

| Path                                 | Git blob                                 |
| ------------------------------------ | ---------------------------------------- |
| src/game/hegemony/fill-hand.ts       | 70aa4ecc38a3b7762d1f8fc8a24d86525419e475 |
| src/game/hegemony/reward-tokens.ts   | 351a3f917e781e2ae9436c3bde8566d13c86e37d |
| tests/hegemony/reward-tokens.test.ts | 0fcf5ab4c44b77bb10c0c26f64281142aa62c663 |

Existing handCount is exported without changing its body. New normalized operations implement enabled/target methods, cost and overridden token use. Shared scheduler/readers, legacy engine and production routing are unchanged. Source-derived contracts are recorded in [knowledge](../knowledge/hegemony-engine.md#part-4x--reward-token-package-methods).

## Authorities and adapters

| Boundary                | What was exercised                                                                         | Remaining authority                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Scheduler               | Actual dispatch, child/event stack, JSON reload, private prompts and rejected replay       | Production request/transport registration                                   |
| Rewards                 | Actual freeChain grants all four token marks                                               | Companion and slot-HP metadata predicates are fixtures                      |
| Cost/use                | Actual separate normalized operations; cost clamps, use does not recheck marks             | Native SkillCard envelope, phase/ownership/response legality                |
| Draw/fill               | Actual fill-hand and movement with fixed fixture pile                                      | Draw replacement, deck recycling/shuffle and native draw service            |
| Peach                   | Actual virtual card descriptor and actual recovery through fixture onEffect                | Full Peach CardUse/material/response lifecycle; fixture recovery card=null  |
| Choice/player selection | Offered snapshot, current roster, normalized replies and actual scheduler pauses           | AI/human parsing, percent matching, timeout/random fallback and ChoiceMade  |
| General inspection      | Actual-name authority, AI flag order, no names in public notice, requester-only descriptor | Qt notification transport; raw private state/frames must never be projected |

## Validation

- Baseline `npm run check`: exit 0, 69 files / 1,477 tests; 42 inherited warnings and zero errors.
- Tracer behavior failures were observed after successful dispatch for draw-one, extraCost, response enabling, companion choice, firstshow private delivery, careerman self-target and firstshow targets. Each was followed by a focused green run. Missing-handler/import failures were not counted as behavioral evidence.
- Focused public cases: 110 passed. Includes freeChain→all four cost/use paths, actual hand movement/recovery, late/current state, absent deputy, normalized predicate copies, malformed boundaries, nine JSON pause locations, wrong actor/stale/invalid/cancel/registry/replayed replies and all three interruptions.
- Two test assertions initially assumed the wrong existing prompt/interruption shape; corrected against the scheduler contract. Those failures are fixture corrections, not engine regressions.
- Final `npm run check`: exit 0, 70 files / 1,587 tests; lint/typecheck pass, 42 inherited warnings and zero errors. No source/test changes followed this validation.
- `npm run build`: first attempt exit 1 on boardgame.io/client resolution while an incidental reviewer pnpm launch was installing dependencies. That launcher was stopped without source/manifest/lockfile edits. The direct resolution check succeeded; the same build command then passed, exit 0. No application workaround or dependency change was added.
- `git diff --cached --check`: exit 0. Checkpoint Markdown formatting passes. Independent Spec focused run: 110/110 pass using the existing direct Vitest entry, without dependency installation.

## Independent reviews

- Standards: zero documented hard violations and zero actionable smell judgments on source and final test addition.
- Spec: zero actionable code findings; independent 110/110 focused tests pass.
- Documentation: independent Standards and Spec each report zero actionable findings. The optional face-up wording clarification was applied. Final validation/graph results are filled from collected outputs, not from pending process status.

## Graph integrity and limitations

Pre-edit GitNexus exact handCount impact: LOW, three dependents; its implementation is unchanged. Existing generalMark/setGeneralMark impacts were LOW (8/7). readSlashInteger is CRITICAL (93), but its body is unchanged. Missing hasShownAllGenerals and new factory lookups returned UNKNOWN; manual definitions/import inspection establishes new-file scope, not general graph completeness. CodeGraph confirms no pre-existing reward-token symbols and supplements mark/fill consumers. No UNKNOWN result was used as proof of safety.

Forced GitNexus index-only rebuild: exit 0; 246 files / 7,764 nodes / 20,526 edges / 203 clusters / 504 flows. Process-local worker-timeout/buffer overrides were used, with no repo or installed-tool configuration changes. Its metadata HEAD equals the baseline; SHA256 matches for all three changed source/test files and ten existing engine/test files. Nine exact Function IDs were verified: the four new operation factories, runToken, allShown, rescueTarget, hiddenPlayers and existing fill-hand handCount. CodeGraph rebuild/status: exit 0, 245 files / 2,888 nodes / 14,421 edges; complete, pending changes 0, no worktree mismatch or reindex recommendation.

Staged detection: 255 changed indexed symbols across six files, 14 affected flows, HIGH risk; targeted response has no error/partial/truncated flag. All 14 Process IDs and 57 ordered steps were queried and inspected. They cover enabled/target queries through hiddenPlayers/allShown/deputyPresent/readDeathIdentity/livingPlayers, token-use to the declared draw/Peach callback properties, cost to mark/integer readers, and existing fill-hand hand counting. Callback terminals are declared interfaces, not proof of concrete production registration; private notifications and remaining branches are established by public fixture compositions, not inferred from absent graph edges.

Final exact handCount impact is HIGH (8) after adding token consumers; runToken is LOW (1), RewardTokenRules LOW/lower-bound (3). The unqualified handCount query is ambiguous/UNKNOWN and was resolved by exact Function ID. The factory remains UNKNOWN despite its definition; CodeGraph resolves five nodes, and current imports/registration confirm test consumers only. Those supplements bound this checkpoint; they do not make the graph complete.

Global extraction omissions remain unresolved: 319 of 519 candidate entries omitted, 19 budget-cut walks, 1,179 dropped callees, five cross-language property sites and one oversized font skipped; zero ranked entries unexplored, depth-capped traces or deduplicated flows dropped. An absent flow or dynamic caller is not evidence that it does not exist. The inherited generic scheduler/property-dispatch limits remain; no native differential or E2E completeness claim follows from these results.

## Remaining scope

This checkpoint does not enable production tokens, remove Standard, implement the full SkillCard envelope or prove native runtime differential/E2E parity. Next dependency is source-derived SkillCard onUse/event/cost/use integration and generic request legality. Concrete draw/Peach/request/transport adapters, setup-to-battle synchronization, package content, token UI, general removal/transformation and exception unwind remain separate gates.
