# Knowledge reconciliation before the next M0 slice

Date: 2026-10-26. Scope: documentation ingest/lint and current navigation, with no game behavior change. The user requested checking knowledge status and updating the latest knowledge before continuing implementation.

## Inputs and branch reconciliation

- Game checkout: `codex/hegemony-m0-prototypes`, `da4b78aa57d64d02008683e47c26ddbb943be7ed`. Its verified input knowledge lock points to `0204d2a3feb1cdebf549aa9400862018a10a060a`.
- Runtime implementation: `bc3ceb996054cf6fc42f0204f553bf279e13899b`. Comparing it with the game checkout across `src/`, `server/`, `tests/`, `scripts/`, `package.json` and the dependency lock shows no changes. The later game commits deliver documentation.
- Canonical knowledge before maintenance: `0204d2a3feb1cdebf549aa9400862018a10a060a` on `codex/hegemony-release-m0`.
- Additional published schema: `142c391e371430454114e61faebeb040e637429c`, `codex/knowledge-maintenance-schema`. This branch and the M0 branch share older base `c471bbe0e020be55750691365e54a3cf911b715a`; the schema is not a replacement tree for current M0 knowledge.
- Native authority stays at `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, 2.3.43-beta2. The schema's GameStart source identities keep their own older scoped game revision.

The six-file schema commit was merged additively on the current knowledge branch. All M0 ADRs, plans, inventories/data and prototype checkpoints remain present. Neither older branch's entire tree was substituted for the other. This preserves both parents and their evidence history.

Fetched game refs contained no newer runtime implementation than the input above. Knowledge `main` still identifies its own 4ae baseline; the maintenance schema also exists as an open PR against that branch. This refresh combines compatible knowledge on the branch consumed by the current game and pins that reviewed result, without claiming a game-main cutover or changing another branch's applicability.

## Findings resolved

1. **Maintenance conventions missing from the consumed snapshot.** Added the approved AGENTS ingest/query/lint schema, source registry, journal and GameStart evidence pilot from the published schema branch. Retained its distinction between access, assertions, historical test executions and actual enabled production behavior.
2. **Current frontier was stale.** The port plan still called the session contract the immediate frontier after Q31 approval and M0.2 closure. It now directs readers to the actual local Slash/Jink slice and next independent service-time prompt/disconnect clocks. Manifest M0.1 and prototypes M0.3/M0.4 remain open.
3. **Latest prototype was difficult to find from durable contracts.** Added the [local session contract](../engine/prototype-session.md) and linked it from the README, overview, architecture, scheduler, Room/admission, direct-card request, Slash and roadmap pages. The separately named fixture game is distinguished from production registration. No full-match, automatic bot, provider or release-readiness claim is added.
4. **Default remote query could select the wrong game knowledge.** AGENTS/README now explicitly use the verified game lock for work in a game checkout; the standalone default-main query remains available. Added scoped M0 source/page records while retaining the original GameStart source identities and initial coverage baseline.
5. **Obsolete provisioning prose.** Retained the schema's replacement of “repository must be created” with the correct separation between knowledge publication, source publication and remote CI. Asset provenance now points to the existing M0 hash/mapping research without promoting inventory to complete media or permission evidence.

## Whole-corpus coverage and retained history

The maintenance inventory examines every tracked Markdown page, local inline file/heading pointers, pinned GitHub file/line citations resolvable from the local repositories, registry source/page references and relation metadata. Primary sources include the immutable game/native blobs and existing revision-labelled decisions/reviews. The added contract's source registry covers only its stated source-inspection scope; other pages keep their own citations.

Historical research and test checkpoints retain their original revisions, dates, execution totals and then-pending statements. They are not rewritten to the latest date/test count. In particular, the [pending Jink checkpoint](2026-10-23-hegemony-m0-pending-jink.md) owns the reported 2,143 tests/build/browser evidence and raw aggregate CRITICAL graph result. No new gameplay, native runtime differential, full-match, strength or provider test execution is asserted by this documentation audit.

The original hosting investigation retains its 2026-10-23 access date. A separate [2026-10-26 official-document refresh](../research/2026-10-26-m0-hosting-refresh.md) rechecks mutable provider facts and captures additional Fly/Railway/Neon caveats without claiming their exact change dates. Provider/region selection, account eligibility, zero-spend configuration and runtime feasibility remain unverified; recheck mutable terms at the provisioning decision. These dated provider citations are outside the scoped GameStart/session source registry, not immutable provider guarantees. Manifest research retains accepted Q29/Q30 exclusions and static candidate counts, rather than calling them an enabled roster/deck. Per-ID handlers, UI/bot/media coverage and asset permission evidence remain unresolved release work.

## Verification and graph boundary

Reproducible local lint and source-access receipts are stored under the task's Temp evidence directory with the names `tqs-knowledge-lint-2026-10-26.*` and `tqs-knowledge-source-access-2026-10-26.*`. They distinguish local object/anchor checks from remote access and semantic review.

The staged corpus lint passed for **102 Markdown pages, 453 inline relative file links, three relative heading anchors, 467 pinned GitHub citations including 459 line-range locators, and 82 unique local Git objects**. Registry checks passed for **20 sources, two scoped pages and 19 relations** with no missing IDs/endpoints, malformed applicability or self-supersession. An additional inbound-link scan found zero Markdown pages without incoming inline links, excluding root README. These are mechanical/source-identity checks, not validation of all semantic claims or of every external website. `git diff --cached --check` passed; the diff contains Markdown/JSON only.

All 20 registered immutable sources were accessible: 19 via first-party GitHub APIs and the pinned Karpathy gist via its raw revision URL after repeated gist API HTTP 502 responses. The fallback returned HTTP 200 with SHA-256 `dc3efe98ae62f23dd08acad13aba2e95287beb20b6bec2f4af0423557fe37401`; the API failures remain in the receipt. Accessibility does not establish semantic correctness.

`npm run docs:test` passed all five existing tool tests: full-SHA import/offline verification, ordinary clone/branch/worktree restoration, stale/malformed lock and provenance rejection, preservation of local edits on failed sync, and broken internal-link rejection. No executable test/tool source was changed. Gameplay test executions remain attributed to their historical checkpoints.

GitNexus resolved the current `answerBattle` caller and `battlePrompt`/`resumeTriggerPrompt` callees. Its metadata was four commits behind the game checkout; ten relevant current file hashes independently matched both GitNexus and CodeGraph, including the prototype and shared admission/scheduler/Slash/damage/server files. The runtime source diff from `bc3ceb9` to the game delivery commit was empty. CodeGraph reported a complete index with no pending source changes/references. This does not establish freshness for every indexed document. The documentation repository itself has no code graph. No absent edge or stale graph result was used as evidence of no dependency, and no function/class was edited. This is a source/navigation maintenance result, not new graph safety or production clearance.

## Independent reviews

Standards: **zero actionable findings** across the 21 changed documentation files against fixed base `0204d2a3feb1cdebf549aa9400862018a10a060a`. The reviewer checked source roles, game-lock routing, historical scope, journal order and preservation of the M0 tree, and independently reran the corpus lint.

Spec: **zero actionable findings** against the user's knowledge refresh request. The reviewer traced the actual session source, confirmed the unchanged runtime diff, retained the M0/native/production gates, and independently reran the lint.

Both reviewed staged tree `5bcb0e14e4db26419c9a2ba7d68bcaaa0fc9f67d` before this review receipt was appended. Key reviewed blobs remain `f4d349e12c80d898e950db2f9a8e6251df38d406` (AGENTS), `dde37d5207c2b37d07a97befce5a94a45c300642` (source registry), `420e8cbea17c607bbbc16e026b6484b587c62321` (session contract) and `951b8e06b012899ea3944bf1fdbe888a9803106c` (hosting refresh). This receipt adds no implementation or new validation claim beyond the reported reviews.

## Remaining work

Continue with the [next bounded session slice](../engine/prototype-session.md#evidence-and-next-boundary): independent durable 60-second decision/disconnect clocks excluding downtime. Keep the accepted gate order: source/knowledge, public-seam tests, typecheck/build, matching graph evidence and separate Standards/Spec review. Registry coverage is still scoped; this audit does not certify every semantic claim across all releases or every external endpoint.
