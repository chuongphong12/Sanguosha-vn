# E2E validation — 2026-10-06

Branch: `codex/fix-standard-rules-engine`. Baseline: `e7f2917ef40cfe96ce78e8a58645315f45e31604`.

## Validation scope

Playwright runs Chromium against the local Vite frontend and the real boardgame.io server. Remote cases use independent browser contexts and credentials. Tests click HTML controls and Pixi hit targets; read-only client snapshots verify resulting state.

| Area                | Covered behavior                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Lobby               | Create and automatically join a room; render waiting-room roster                                                       |
| Waiting room        | Host/guest settings permissions; prohibit starting below four players; layout at 1280×720                              |
| Room resizing       | Five joined clients reduced to four seats; excluded client sees an explanation without crashing                        |
| Reconnect           | Reload in waiting room preserves identity and roster; reload during play preserves identity, exact hand IDs and seats  |
| Remote match        | Four clients select generals, start play, toggle the log, discard and advance the turn                                 |
| Private state       | Opponent hand IDs and unrevealed roles stay hidden; authoritative deck/effect stack absent from player views           |
| Hot seat            | General selection, role reveals, handoffs and optional turn-start prompts                                              |
| Card flows          | Sát targeting/response/damage; Nam Man ordered responses; Thuận Thủ card selection; Ngũ Cốc ordered picks              |
| AI and victory      | Real seeded game with three bots, human UI responses and discards, deaths, actual winner and return to lobby           |
| Browser lifecycle   | Remove a hovered card or destroy its dashboard while a verified tween is running                                       |
| Result presentation | An existing isolated presentation case injects an ended client view; the separate real-game case proves engine victory |

The two lifecycle cases exercise public Pixi/Dashboard APIs in the browser. Card-removal input is a cloned player view; these are component regression cases, not authoritative game moves. The real-winner test does not inject engine state or bypass moves.

## Defects repaired

1. Starting a reduced-capacity room left the excluded client's viewer absent from `G.players`; MainScreen accessed its hand and crashed. State updates and rendering now display an explanation and an exit control for that client.
2. A complete real match reproduced Motion writing `y` to a destroyed `CardView`. A temporary browser probe identified the target in two repeated matches. Dashboard now stops tweens before removing cards or destroying children and prevents new tweens after teardown begins. Runtime exceptions are no longer suppressed by the E2E error collector.

Test drivers were also corrected for current response labels, optional skills owned by a different player, and discard limits including Vọng Tôn. Every remote client in the full-match and room-resizing scenarios is checked for runtime errors.

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
npm run test:e2e
npm run check
npm run build
```

`test:e2e` typechecks E2E files before running Playwright. One worker limits simultaneous WebGL clients. Failed cases retain screenshots; CI retries retain traces. The dev server uses `BROWSER=none` to avoid opening unrelated interactive tabs.

## Results

- Animation regressions: **6/6 passed**, three scenarios repeated twice, including two real matches without runtime exceptions.
- `npm run check`: **40 files / 287 tests passed**, lint had no errors, application typecheck passed.
- `npm run build`: **passed**.
- E2E TypeScript project: **passed** before browser runs.
- Complete Chromium run: **17/17 passed in 7.3 minutes**, with zero retries in the local run. All runtime-error assertions passed.
- Standalone engine verification with two workers: **40 files / 287 tests passed in 23.83 seconds**, without the worker-cleanup warnings seen during concurrent graph indexing.

The earlier reload failure captured the client still on its asset-loading screen when the 20-second wait expired. Reload now has a 45-second startup budget, with exact hand/identity assertions retained and verified in the complete run.

Local evidence in this worktree: `playwright-report/index.html`, `.references/e2e-complete.log`, `.references/e2e-animation-green.log`, `.references/e2e-unit-bounded.log`, `.references/e2e-build.log`, and `.references/e2e-graph-changes-full.json`. The real-game victory screenshot is in the seeded-match folder under `.references/e2e-complete-results`. These generated artifacts are ignored by Git; the test source and this report are committed.

## Graph verification

CodeGraph impact checks preceded edits to MainScreen and Dashboard and to existing test helpers. MainScreen impact covered 92 nodes / 168 edges; Dashboard covered 57 nodes / 69 edges. CodeGraph was synchronized after the source changes.

GitNexus 1.6.12 reindexed the working tree: **2,650 nodes, 9,446 edges, 101 clusters and 226 flows**. Structured `detect_changes(scope=all)` reports **17 changed symbols, 70 affected processes, 10 changed files, risk `critical`**. This reflects the central rendering path; it is not a test failure or a guarantee of correctness. Both changed production classes were manually reviewed and exercised by the browser regressions.

The index reports process-generation limits (78 candidate entries dropped, 95 entries untraced, 683 callees skipped and 62 flows dropped) and five cross-language field anchors it could not resolve. Absence from this graph does not establish that a dependency or execution path is absent. Configuration/package files and anonymous test bodies are also checked directly; their absence from symbol results is not treated as cleared risk.

## Standards

No unresolved documented-standard violations or actionable Fowler smells in the current diff. The earlier hover-test finding was resolved by locating real CardView bounds, verifying hover and a running tween inside `pointerenter`, and triggering teardown in that event.

## Spec

No unresolved actionable findings against the E2E request. Reload now compares actual card IDs, the full-game scenario reaches an engine-produced winner, and the report distinguishes component lifecycle cases from gameplay. The final complete browser run passed all 17 scenarios.

## Limits

Passing the tested scenarios is not proof that every feature or possible combination works 100%. This run does not verify Firefox/WebKit, mobile devices, a deployed Vercel build, network-loss recovery, room passwords, all general/card combinations, or production credential/session behavior. Rule-level coverage is provided separately by the engine test suite. Lint has 42 existing warnings and no errors.
