# Knowledge migration validation checkpoint

Requirements: [spec #10](https://github.com/chuongphong12/Sanguosha-vn/issues/10), approved interview Q1–Q10. Delivery slices: [#11](https://github.com/chuongphong12/Sanguosha-vn/issues/11), [#12](https://github.com/chuongphong12/Sanguosha-vn/issues/12), [#13](https://github.com/chuongphong12/Sanguosha-vn/issues/13), [#14](https://github.com/chuongphong12/Sanguosha-vn/issues/14).

## Reviewed identities and boundaries

Migration base: game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Independently reviewed game snapshot: `21edfb217ab1d2edd9cad90d2dca2a9ead87ec8e`, branch `codex/knowledge-subtree`. Initial curated knowledge commit: `ef07bb714851a3dc98c9ce6602b89998ab35c520`, tree `672f2eefd9db4bea3afca98fc15092f0fdcc0ae2`. This checkpoint and its index link are added after those reviews; the final game lock records the subsequently imported documentation commit. No self-referential final merge SHA is asserted here.

| Reviewed game path | Git blob |
| --- | --- |
| `scripts/knowledge.mjs` | `0c3ae0572c2a0cd4cb057a6ba512d9ed53c48fc1` |
| `scripts/tests/knowledge.test.mjs` | `f00cab399378f7f2a0cdbe5190d4671fb46190f0` |
| `.github/workflows/ci.yml` | `fa672bb99923101598f7e89c05324c96f940ef59` |
| `package.json` | `fdac2e98f513849efbc513bd080a372e748f8ea2` |

The diff leaves `src/`, `server/`, existing game `tests/`, `.agents/skills` and the dependency lock unchanged. Game runtime behavior and assets are outside this migration. The sole rules target remains [pinned Quốc Chiến](../rules/source-authority.md); production still registers Standard 2013 pending the accepted playable replacement gate.

## Curation and navigation

The [manifest](../research/migration-manifest.json) accounts for all 33 original tracked root/doc Markdown files: seven retained bootstrap documents, one rewritten architecture pointer and 25 superseded paths removed through normal game commits. Replacements were checked before deletion; unrelated local diagnostic and feasibility files were preserved. No published history was filtered.

Current contracts are split by subsystem, supported shared infrastructure/provenance is revalidated, and obsolete Standard normative content is excluded. Eleven Hegemony research/review files retain their original scope under historical notices. Fifteen early checkpoint sections and three inline validation groups were extracted from the former knowledge monolith; the superseded Part 4d result is explicitly labelled. Original paths/blob identities remain recoverable in game history.

Before initial import, the curation check validated 36 Markdown files, 110 internal file links and all 33 manifest entries with zero errors, including absence of machine-local Windows paths. Source-path checks inspected the game and pinned native checkout. CLI verification additionally checks the actual game bootstrap and imported knowledge links. Link checks establish file targets; they do not establish all external URL availability or every heading-anchor behavior.

## Executed checks

Executed locally on Windows with Node 22 and Git; all named successful checks exited 0.

| Check | Evidence and scope |
| --- | --- |
| Before changes: typecheck and game suite | Passed; 70 files / 1,587 tests |
| After code changes: `npm run check` | Passed lint/typecheck/game suite; 70 files / 1,587 tests, 0 lint errors and 42 inherited warnings |
| `npm run build` | Passed production frontend build and asset processing |
| `npm run docs:test` | Passed 5 public CLI integration tests, using real temporary repositories; approximately 336 seconds in this Windows environment |
| Offline snapshot verification | Passed against the actual imported game subtree |
| Explicit local-upstream verification | Passed against the separate local knowledge repository; exact requested commit and tree matched |
| Formatting and diff checks | New scripts pass Prettier; migration diff passes `git diff --check` |

The first public import/verify test failed before the CLI existed, then passed. The broken-navigation test failed because the CLI accepted a missing target, then passed after link validation was added. The final five-case suite ran after that change.

The real-Git cases cover: initial full-SHA import and offline verification; subsequent snapshot update; plain clone without the original documentation commit object; ordinary switch between distinct snapshots; separate worktree restoration; malformed/missing/stale lock; modified or extra subtree files; a false commit/tree provenance pair; missing commit and moving-branch rejection; preservation of local drafts, game HEAD and prior lock on rejected sync; and broken internal navigation. No forced reset, remote push or user credential capture occurs.

## Graph evidence and limits

GitNexus 1.6.12 was queried before edits. New files and Markdown/package/workflow nodes produced UNKNOWN or absent caller evidence; this was supplemented by direct bootstrap/CI/package references, a tracked-tree inventory and public subprocess tests. UNKNOWN was not treated as an all-clear.

After implementation, GitNexus indexed 7,721 nodes / 20,633 edges / 504 reported flows at the reviewed game revision. Structured pre-commit detection covered 38 symbols / 37 files; structured comparison from the migration base covered 172 symbols / 66 changed files, low reported risk and no partial/truncated result flag. All changed symbol paths were documentation or the two new CLI/test scripts. The reported zero affected flows is not proof of no consumers: script invocation crosses subprocess/package-script boundaries.

Whole-repository extraction remains incomplete: 325 candidate entry points dropped, 1,179 callees omitted, 19 walks cut by budget; 13 cross-language property sites were not linked. One large binary font was intentionally skipped. These global limitations remain recorded. Exact source diffs, direct invocation inspection and integration tests bound this documentation/tooling change without claiming a complete whole-game graph.

CodeGraph 1.6.0 was rebuilt: 247 files / 2,919 nodes / 14,545 edges, extraction version 25, complete state, zero pending refs/changes and no worktree mismatch. Its affected-test query for the CLI returned no static dependents; tests execute the CLI by path through a subprocess, so that zero is supplemented by the actual five-case run. Markdown content and canonical-host permissions are outside that graph model.

## Standards

Independent reviewer: **0 documented-standard breaches; 0 actionable code smells** in `4b19fdd…21edfb2`. Reviewed project standards, CLI safety/full SHA/tree pins, offline versus upstream limits, real Git tests, CI/bootstrap, curation manifest and authority boundaries. No independent graph reads were performed during the coordinator's writer phase.

## Spec

Independent reviewer: **0 actionable findings** in `4b19fdd…21edfb2`. Fresh Hegemony-first repository, squashed subtree/lock, retained bootstrap/skills, update workflow, historical labels and clone/switch/worktree behavior match the approved design. No engine cutover, automatic main merge, asset migration or history import was found. Remote availability/CI is not certified by this review.

## Publication boundary

The canonical remote is [chuongphong12/Sanguosha-vn-knowledge](https://github.com/chuongphong12/Sanguosha-vn-knowledge). After local validation/review, the coordinator found an existing owner session in the browser account switcher and created the approved public, empty repository under `chuongphong12`. The GitHub API confirmed public visibility and an empty repository. The CLI remains `hudson-porters`: read is available, push is false, and `git push --dry-run origin main` was rejected with HTTP 403. No credentials were extracted or shared.

The browser's collaborator settings require owner email verification in GitHub sudo mode. The owner must finish that verification and grant the publishing account write access, or publish the prepared local repository themselves. No collaborator permission was changed by the coordinator. After access exists, publish the canonical documentation commit first, run the game upstream verifier against that remote, then publish the scoped migration branch for review. Canonical commit publication and remote-dependent CI remain unverified; no engine/main or cleanup-PR merge is part of this operation. No game branch was pushed while its required canonical commit was unavailable.

Passing fixtures/builds do not establish full native match parity, Hegemony production readiness, asset reuse permission, remote Vercel success or 100% gameplay coverage. The [current port plan](../plans/hegemony-port.md) retains those separate gates.
