# Knowledge repository options: factual prerequisites

Research date: 2026-10-15 (Asia/Saigon). Working source: `codex/hegemony-engine` at `4b19fddcb6547066de0db0ae078c0db7642877ba`.

Status: accepted design from the grill-with-docs interview. Q1–Q10 are confirmed; Q9 replaces the Q3 submodule selection with a separate repository plus subtree, and Q10 authorizes the complete migration design below. Implementation is tracked by game GitHub spec #10 and dependent tickets #11–#14. The research sections retain the facts observed before migration; they are not a statement of later publication status.

## Storage and integration are separate decisions

| Mechanism | Verified behavior | Consequence for the interview |
| --- | --- | --- |
| Independent knowledge repository | A Git repository can exist separately; embedding it requires an additional integration mechanism. Submodules specifically embed another repository while retaining separate history. [Git submodules](https://git-scm.com/docs/gitsubmodules.html) | Choosing a second repository does not itself choose submodules. Link-only access or an explicit local checkout are also possible policies. |
| Submodule | The parent tracks a gitlink containing the expected child commit and a `.gitmodules` path/URL mapping. [Git submodules](https://git-scm.com/docs/gitsubmodules.html) | A game revision can pin an exact documentation revision; updating it requires a parent pointer change. |
| Subtree merge | Git can import a second project's files into a parent subdirectory and subsequently merge upstream changes. The files then appear as ordinary files in the parent tree. [Pro Git: subtree merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging#_subtree_merging) | This keeps documentation bytes in the game checkout; it does not accomplish removing those bytes from the current game tree. Synchronization still needs an explicit policy. |

The final column contains implications for this project, not approved architecture.

## Checkout and automation

Ordinary cloning does not populate submodule files. Use `git clone --recurse-submodules`, or initialize an existing checkout with `git submodule update --init --recursive`. Ordinary update restores the recorded commit; `git submodule update --remote` instead follows the configured remote branch before a new parent pointer is committed. [Pro Git: submodule checkout and updates](https://git-scm.com/book/en/v2/Git-Tools-Submodules)

Therefore any build, validator, or agent needing child documents must deliberately populate them. A link-only repository need not be downloaded for a game-only build. These are workflow implications; this research did not change CI or verify hosting-provider checkout behavior.

GitHub Actions' automatically created `GITHUB_TOKEN` is limited to the repository containing the workflow. Making another repository private introduces a separate authorization requirement for reading its contents; increasing the first repository's `permissions` alone does not grant access to the second. A GitHub App installation token or another appropriately scoped credential is needed when the default token cannot provide required permissions. [Token boundary](https://docs.github.com/en/actions/concepts/security/github_token), [additional authentication](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)

## Links and version drift

GitHub resolves Markdown relative links from the current file and branch; `/` starts at the current repository root. Moving a document between repositories requires auditing its source links, images, and links back to code. Relative links should not be assumed to cross a repository boundary automatically. [Relative links](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes#relative-links-and-image-paths-in-markdown-files)

A URL using `blob/main/...` follows the branch's changing contents. A URL using an exact commit ID identifies that file version. Therefore historical checkpoints can preserve their source evidence with commit links even when live documentation moves; code/doc compatibility still needs an explicit mapping if no gitlink is used. [Permanent links](https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files)

## History import without rewriting game history

GitHub documents filtering a folder in a **new clone** with `git filter-repo --path ...` or `--subdirectory-filter ...`, then pushing the result to a new repository. This isolates filtering from the original source repository. The documented result does not retain the original repository's branches and tags automatically. [Splitting a folder](https://docs.github.com/en/get-started/using-git/splitting-a-subfolder-out-into-a-new-repository)

Project implications: extracting selected documentation history in a disposable clone and removing/replacing documentation through a normal game commit can preserve published game history. Old game commits still contain their historical documentation; this is not a history-size reduction. A snapshot-only import preserves current content but does not copy the earlier document commit graph. Paths previously renamed or spread across several directories require a separate history-selection audit before claiming complete retention.

## Live GitHub authority check

Read-only GitHub CLI checks on 2026-10-15:

- `gh api user`: signed-in identity `hudson-porters`, type `User`.
- `gh api repos/chuongphong12/Sanguosha-vn`: public repository; default branch `main`; owner `chuongphong12`, type `User`; effective `pull`, `push`, `triage` true; `admin`, `maintain` false.

These API observations apply to the current session, not a promise of future permission. No token value was requested or recorded.

GitHub's repository-creation API creates repositories either for the authenticated user or for an organization where the user is a member. `chuongphong12` is a different personal account, not an organization. Consequently the current session's push access to the game does not authorize creating a sibling repository in that personal namespace through those endpoints. Its owner would need to create/provision that repository or another accepted owner must be chosen; no creation was attempted. [Repository creation endpoints](https://docs.github.com/en/rest/repos/repos#create-a-repository-for-the-authenticated-user)

## Confirmed interview decisions — Q1–Q8

- Priorities: keep documentation aligned with the source revision and make the game repository tidier.
- Audience: developers and AI agents share one knowledge source.
- Integration at Q9: a separate canonical knowledge repository, imported into the game as a Git subtree at `knowledge/`. This supersedes Q3's submodule selection to satisfy ordinary clone and branch-switch behavior; documentation bytes remain tracked in the game.
- Content boundary: move knowledge/rules research, specifications/plans/reviews/checkpoints, architecture/handoffs and asset provenance. Retain README, AGENTS/CLAUDE, minimal workflow configuration and `.agents/skills` in the game repository so bootstrap remains available without initializing the submodule.
- Hosting: public `chuongphong12/Sanguosha-vn-knowledge`, under the same owner as the game. The creation-authority constraint above remains unresolved; no creation was attempted.
- Knowledge authority at Q6: build one current Hegemony-first knowledge base. Assess old documents, retain shared knowledge that remains valid, and replace obsolete Standard 2013 rules and architecture claims with verified Hegemony knowledge. Do not maintain two competing current manuals.
- History at Q7: create a fresh knowledge repository with an initial curated snapshot; do not import document history. Published game history remains intact.
- Checkout requirement at Q8: documentation must accompany clone and branch checkout. Q9 accepts subtree to meet that requirement on migrated branches without hook installation or submodule initialization.

## Curation boundaries established by the source assessment

The selected native rules baseline remains QSanguosha-QuocChien 2.3.43-beta2 at `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. Rewriting documentation around that target does not establish that the web runtime has completed its migration.

At the working source revision, `server/server.ts` and `src/client/MatchClient.ts` still use `TqsGame`; `src/game/TqsGame.ts` identifies that runtime as `tam-quoc-sat-standard-2013`. The Hegemony entry point describes paired setup, and its top-level status remains `selecting-generals | ready`. Current knowledge must distinguish native reference rules, implemented normalized contracts, fixture validation, and pending production integration.

- Rewrite the current architecture and rules knowledge from verified Hegemony contracts; retain the real stack and integration boundaries.
- Revalidate shared asset provenance and engineering guidance before carrying them forward.
- Derive a concise current roadmap from the implementation plan. Treat old checkpoint reports as revision-specific evidence, never as current runtime certification.
- Omit obsolete Standard handoffs, UI inventories and audit reports from current normative knowledge. Historical evidence can be referenced at fixed game revisions once those revisions are published.
- Preserve unrelated untracked documents and local work; the tracked file inventory defines the migration manifest.

## Final design confirmed

Q9 confirms separate repository plus subtree. Q10 confirms the complete layout, version contract, synchronization workflow and acceptance checks below and authorizes implementation. Existing GitHub Issues tracking, scoped validation and separate Standards/Spec review decisions remain in effect.

## Native Git guarantees for always-present documentation

Follow-up research for the user's requirement that documentation is loaded on clone and branch changes. The coordinator reports the latest content direction as fresh, Hegemony-first curated knowledge with no history import. The earlier history-import section is background information only.

`git clone --recurse-submodules` initializes and clones children, equivalent to `git submodule update --init --recursive` after cloning. Do not use `--remote-submodules` for commit pinning: it chooses remote-tracking state instead of the recorded child SHA. `--no-checkout`, `--bare`, or `--mirror` suppress recursive population. [git-clone](https://git-scm.com/docs/git-clone)

`submodule.recurse=true` defaults recursion on for checkout/switch and other named commands, but explicitly does **not** apply to clone. Local bootstrap or global opt-in can enable it; a versioned configuration file does not activate that setting on another machine. [git-config](https://git-scm.com/docs/git-config#Documentation/git-config.txt-submodulerecurse)

`git checkout --recurse-submodules` and `git switch --recurse-submodules` update active children to the recorded commit and detach their HEAD. Without recursion their worktrees are not updated. Checkout refuses to overwrite child modifications unless forced; automatic synchronization should retain that protection. [git-checkout](https://git-scm.com/docs/git-checkout), [git-switch](https://git-scm.com/docs/git-switch)

Recursion should not be treated as initialization of every newly encountered child. Use `git submodule update --init --recursive` when a branch introduces an uninitialized child; it clones missing registered children and fetches missing commits. After an existing URL changes in `.gitmodules`, `git submodule sync --recursive` updates registered local URLs before updating. A branch without the gitlink cannot provide knowledge there; historical branches need a separate policy. [git-submodule](https://git-scm.com/docs/git-submodule)

Client hooks are not copied during clone. Versioning `.githooks/post-checkout` alone is insufficient: Git must already be configured through `core.hooksPath` or local hook installation. Hooks can also be disabled through `core.hooksPath`. [Pro Git: hooks](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks), [hook configuration](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corehooksPath)

An installed `post-checkout` hook runs after checkout/switch, clone, and `worktree add`, unless checkout was suppressed. Its failure changes the command exit status but cannot undo the checkout. It can initialize/synchronize after bootstrap; it cannot bootstrap itself on an arbitrary fresh clone. [githooks](https://git-scm.com/docs/githooks#_post_checkout)

Worktree creation needs its own population/validation step or an already installed applicable hook. The Git manual explicitly lists incomplete submodule support among worktree limitations; successful ordinary checkout does not establish every worktree operation is covered. [git-worktree limitations](https://git-scm.com/docs/git-worktree#_bugs)

### Recommendation for the requirement conflict

These alternatives record the trade-off investigated before Q9. The user selected the second alternative:

- Keep the selected submodule if “always loaded” means a supported workflow: recursive clone, explicit one-time bootstrap, non-forcing synchronization after branch/worktree changes, and exact child SHA validation. CI must initialize explicitly. Arbitrary plain Git commands can bypass this workflow.
- If it literally means every fresh plain `git clone` and ordinary branch switch with no setup or extra command, ordinary tracked documentation or a subtree snapshot on every supported branch provides parent-tree bytes. This would change the earlier submodule decision and retain documentation bytes in the game repository.

Repository configuration alone cannot guarantee the literal plain-clone requirement for submodules. Network/access failures and locally modified documents must be surfaced, not hidden by forced updates.

## Accepted final design — Q10

### Ownership, layout and branch scope

`chuongphong12/Sanguosha-vn-knowledge` is the public canonical documentation repository with a fresh initial commit. Its root content is imported into `knowledge/` in the game, using a squashed subtree import so the game receives the curated snapshot without importing previous documentation history.

The knowledge repository contains:

- `README.md`: navigation, authority boundaries and contribution/synchronization instructions.
- `CONTEXT.md` and `adr/`: domain terminology and meaningful accepted decisions.
- `rules/`: pinned native source authority and researched Hegemony rules.
- `engine/`: current implemented contracts, projection/privacy, architecture and integration gaps.
- `roadmap/`: current implementation status, remaining dependencies and links to canonical GitHub specification/tickets.
- `research/`, `reviews/` and `assets/`: reusable source research, revision-scoped validation evidence and provenance.
- `specs/` and `plans/`: reusable accepted design and plan artifacts; current requirements/tickets remain canonical in the existing game GitHub Issues tracker.
- `source-baseline.json`: the game revision used for this curation and the full native reference revision. This records the reviewed input; it does not certify later code automatically.

The game keeps a concise README, AGENTS/CLAUDE bootstrap, `.agents/skills` and the four existing `docs/agents/` workflow configuration files. Bootstrap pointers direct readers to `knowledge/`; root domain paths remain small pointers where required by the installed skills. Do not modify reusable skill internals just to relocate project documentation.

The migration starts from `codex/hegemony-engine` at the reviewed baseline, on a scoped migration branch. It does not silently merge the engine into main or attach Hegemony implementation claims to main's different source. The separate repository-cleanup PR remains separate. Later integration into another supported game branch must carry the appropriate knowledge snapshot and pointer updates in that branch's normal review.

### Curation manifest

| Existing material | Proposed handling |
| --- | --- |
| `docs/knowledge/hegemony-engine.md` and the Hegemony design | Rewrite into current `rules/`, `engine/` and `specs/`; retain the pinned authority and explicit unsupported boundaries. |
| Hegemony implementation plan | Derive a concise `roadmap/` and current `plans/`; remove accumulated command output and duplicated checkpoint totals from normative knowledge. |
| Hegemony replacement analysis, foundation review and Part4p–4x checkpoints | Preserve useful revision-scoped evidence under `research/` or `reviews/`; keep original reviewed revision labels and do not present historical totals as current certification. |
| `ARCHITECTURE.md` | Rewrite verified common infrastructure and Hegemony boundaries into `engine/`; replace old root content with the appropriate bootstrap link if needed. |
| `docs/assets/provenance.md` | Revalidate shared provenance and move to `assets/`; distinguish verified assets from the pending Hegemony catalog audit. |
| Standard handoffs, UI inventory, SKILL_CONFORMANCE and pre-Hegemony audits | Exclude obsolete normative content from the new repository; retain only independently verified shared lessons. The original game history preserves old reports. |
| README, AGENTS/CLAUDE, four `docs/agents/` files, skills | Retain operational bootstrap and update links needed for the new layout. |
| Unrelated untracked files and external references | Leave untouched; do not import them implicitly. |

After content and link validation succeeds, remove superseded tracked documentation through an ordinary game commit. No game history rewrite or asset migration is included.

### Version and update contract

The game tracks a small `knowledge.lock.json` outside the subtree containing the canonical repository URL and full imported documentation commit SHA. The subtree files must match that commit's exported tree; there are no game-specific edits inside the imported snapshot. Keeping this lock outside the subtree avoids a document commit needing to contain its own SHA.

For subsequent changes, prepare and review the knowledge change first, publish the exact documentation commit, then import that commit into the related game change and update the lock. Related source changes and the imported snapshot are reviewed together in the game PR. Do not automatically import moving `main` on checkout, or automatically push documentation during build.

Documentation records the actual game revision that was inspected as evidence, not a future merge SHA. A subsequent code change requires reviewing the affected contracts; a snapshot match alone proves content synchronization, not semantic correctness. Fixed source links may only use published revisions; do not publish apparently permanent links to the currently unpushed engine commit.

Dirty subtree edits, missing upstream commits or conflicting imports stop synchronization with an actionable error. Do not force-reset user work. Updating docs can require network access; ordinary checkout and game build use the already tracked files without fetching the knowledge repository.

### Verification and delivery slices

1. Curate the new local knowledge repository and a source-to-document manifest; inspect old/current authority labels, content links and bootstrap coverage. Preserve original evidence when it is carried forward.
2. Integrate the reviewed snapshot with a lock and an explicit synchronization/verification command. Check initial import, exact-tree validation, stale/missing lock rejection and local-edit preservation in temporary fixture repositories.
3. Update bootstrap and links; validate plain clone and ordinary branch switches between two migrated fixture revisions with distinct documentation snapshots. Historical branches that predate migration keep their historical layout; this change cannot add files retroactively.
4. Run appropriate existing typecheck, tests and build after project integration; run graph change analysis and independent Standards/Spec review against the fixed migration base. Record one checkpoint and link it from the roadmap.

Verify intra-knowledge links, game bootstrap links, source-reference targets, fresh clone/worktree contents and exact imported bytes. A missing upstream or unavailable credential is reported explicitly; a zero result from an unresolved graph query is not a pass.

Prepare the reviewable local content before owner-only provisioning. On 2026-10-15, the target repository returns HTTP 404 to the current CLI identity `hudson-porters`; the session cannot create a repository in another personal account's namespace. The owner must provision the selected repository and grant push access before publication. Do not create under another owner as a workaround, request credentials, merge PR #9, or merge the engine into main as part of this design.

The retained-document manifest is refined during the content pass; every final deletion must map to a replacement, intentionally excluded obsolete material, or preserved historical evidence. Q10 approved this complete scope and workflow. The authoritative requirements and acceptance seams are in [GitHub spec #10](https://github.com/chuongphong12/Sanguosha-vn/issues/10).
