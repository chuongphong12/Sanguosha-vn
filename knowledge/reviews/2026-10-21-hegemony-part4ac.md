# Part 4ac — Room judgment and draw pile

## Authority and revisions

- Accepted expanded B: [specification #22](https://github.com/chuongphong12/Sanguosha-vn/issues/22)
  and [local specification](../specs/hegemony-part4ac-judge-and-draw.md).
- Native: `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, clean reference checkout;
  [research and six matching native hashes](../research/2026-10-21-room-judge.md).
- Source review base: `b52a77dcaf40030454c3e9b6d016ca858d66d67b`.
- Implemented game commit: `94c4ca53c4abd1733886b2c7f97078ef51332efd`,
  branch `codex/hegemony-card-admission`; publication of this game branch is not asserted.

## Delivered behavior

[Actual draw/reservations/recycling](../engine/draw-pile.md) precedes
[Room judgment and its three GameRule stages](../engine/judgment.md). The owner
composes actual movement, result, [retrial](../engine/retrial.md) and representative
Guicai/Guidao acquisition, cost, reveal and replacement. Each layer was validated
and its knowledge updated before proceeding to its consumer.

The private reserved draw zone preserves unique physical location and native
owner/place semantics while excluding already-drawn IDs from available order.
Recycling follows native forward modulo shuffle, terminal timing, mapping and
notice order, with the explicit portable `mulberry32-v1` stream. Qt bitwise stream
equivalence is not established by this implementation.

## Real authorities and adapters

| Area        | Authority exercised                                                                           | Remaining adapter or limit                                                       |
| ----------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Control     | Actual scheduler dispatch/resume and JSON frames                                              | Network authentication, timeout and application routing                          |
| Draw        | Actual Fetch, available/reserved selection, swap count and recycling                          | Trusted seed/setup/configuration provisioning; batch getNCards/drawCards/dealing |
| Randomness  | Actual persisted versioned RNG and independently worked literal transcript vectors            | Exact Qt runtime/qrand stream not pinned or certified                            |
| Terminal    | Actual registered game-over interrupts with `.`                                               | Native exception-specific unwind remains separate                                |
| Judgment    | Actual original/shared identity, tag nesting, actor snapshot, start/result/finish and Luoshen | Catalogue/canonical metadata and ExpPattern grammar fixtures                     |
| Replacement | Actual Guicai/Guidao, request/retrial/movement/result operations                              | Eligibility, codec, request parsing and generic reveal delivery fixtures         |
| Delivery    | Named initial/result/animation/delay/final notices, resumable once                            | Client notification rendering, transport and configured delay duration           |
| Product     | Isolated normalized engine library                                                            | Production still registers Standard2013; no match/UI/bot enablement              |

## Red/green and executed validation

Tests use the approved public scheduler seam, not direct calls to handler bodies.
Initial draw dispatch returned null instead of physical ID zero; recycling then
failed on exhausted pile; pending judgment dispatch initially left card null.
Each behavior was implemented and its focused tests rerun. Native packet inspection
also exposed missing effective ID/reason in the animation notice; the regression
failed before those fields were added.

Independent Spec review found one P2: the final owner log unnecessarily called the
ready-only reader after a FinishJudge listener could clear its card. A new test
failed with `Judge requires a ready card` after real disposal. The final log now
reads the original pending object and cached result; strict ready validation is
retained wherever a card is actually required. Both reviewers rechecked the fix.

Final executed commands, all exit 0:

- `npm run test -- tests/hegemony/judge.test.ts tests/hegemony/draw-pile.test.ts tests/hegemony/retrial.test.ts`:
  **97 tests / 3 files**; independently repeated by Spec reviewer.
- `npm run check`: **2,006 tests / 79 files**, typecheck passes, lint has **0 errors / 42 inherited warnings**.
- `npm run build`: TypeScript and Vite build pass on final source.
- `git diff --cached --check`: pass before source commit.
- Baseline before implementation: retrial and movement **189 tests / 9 files**.
  New coverage is **50 tests**: 16 draw and 34 judgment cases.

Coverage includes ID zero/top/bottom, real reserved-card movement, nested draw,
both-empty and limit equality, append, unchanged wrappers/no movement hooks,
one-card RNG consumption, literal seeded replay, latest notice count, terminal
handler returning rejection; pending/ready, pattern cache, Luoshen, captured actor
order, event consumption/replacement, current metadata, nested judges/counters,
real skill replacement and repeated event/notice JSON suspension with stale,
wrong-actor and replayed replies rejected. Interruptions retain eager state.

## Graph evidence and limitations

Graph queries were bound to the exact engine checkout. Existing `readJudge` was
HIGH before edits (5 direct callers/4 selected processes). `allPlayers` was HIGH
(7 direct callers/4 processes); it was reused unchanged. `damageRule` was MEDIUM
and reused unchanged for the three GameRule bridges. Cache predicates were LOW
before their parameter types narrowed to the fields actually read.

Final GitNexus 1.6.12 forced rebuild: **314 files, 9,689 nodes, 24,601 edges,
238 clusters, 522 extracted processes**. CodeGraph 1.6.0: **265 files, 3,350 nodes,
17,172 edges**, complete, no pending refs/changes, mismatch or reindex recommendation.
All five changed file hashes match both indexes; empty graph IDs = 0.

Post-change `readJudge` is CRITICAL (11 direct callers/6 selected processes) and
`readPendingJudge` CRITICAL (4 direct callers/7 processes), reflecting shared use
by the new owner/stages and existing result/retrial/skills. Exact caller contexts,
CodeGraph depth-three impacts and the 13 affected process step lists were inspected;
the full regression includes their existing consumers. New operation factories have
LOW indexed impacts with their actual test registration callers.

Staged detection: **300 changed symbols / 13 affected indexed processes / 5 files**.
Cumulative since `21d693e4c9c046b30085fc11a6a434d4d8bb3e31`:
**1,450 symbols / 53 affected indexed processes / 53 files**. GitNexus's 1,000-symbol
listing cap was resolved using bounded exact-path Cypher and its exported original
diff-hunk parser; all returned IDs and affected process counts match the complete
listing. This resolves the listing cap, not all extraction limits.

The analyzer reports 388 candidate entry points not ranked, 1,254 callees skipped
at branching limits, 18 walks cut by budget, and cross-language unresolved property
sites. Dynamic operation-name dispatch is not a full static call graph. These are
retained limits, not evidence of absent behavior or exhaustive game coverage.
The changed owners/factories and shared readers were separately resolved with exact
symbol contexts, CodeGraph callers, pinned native body inspection and public runtime
tests. Whole-codebase flow enumeration and native differential parity are not claimed.

Machine-local receipts in Windows Temp: `tqs4ac-explore.json`,
`tqs4ac-shared-impact.json`, `tqs4ac-result-impact.json`, `tqs4ac-graphs.json`,
`tqs4ac-cg-*.json`, `tqs4ac-codegraph-status-final.json`,
`tqs4ac-gitnexus-final.log`, `tqs4ac-check-final.log`, `tqs4ac-build-final.log`.

## Independent review and reviewed bytes

Standards: **0 actionable findings**, including the correction.
Spec: **1 P2 corrected, 0 remaining actionable findings**, with independent 97-test run.

| Game file                          | Final SHA256                                                       |
| ---------------------------------- | ------------------------------------------------------------------ |
| `src/game/hegemony/draw-pile.ts`   | `0b3fd2fc0b410a62fb4ad07b4bb3a82680e4e34f65d868bc6c65da8dba949175` |
| `src/game/hegemony/judge.ts`       | `9747f92e424949538759a94d000bd3a2a87bea770b12a396c004ab943f7db4fd` |
| `src/game/hegemony/retrial.ts`     | `ce59cd49e167461a5d7739a668b5cab7bf18adb8533d08059b236e2f22feace2` |
| `tests/hegemony/draw-pile.test.ts` | `a333ead0bc467a4c9b8d521701fdd82b898e8393f8314af9c21ddde9c6ceefae` |
| `tests/hegemony/judge.test.ts`     | `ec1e6c339dee6d60f11b0eb0b508b78bba4670a13377bde44397af522b760ab9` |

Canonical knowledge review: Standards found one detached Markdown table row,
corrected before publication, with **0 remaining findings**; Spec **0 findings**.
Formatting passes for all 12 changed documents/metadata files; **74 Markdown files /
288 relative path links** pass. These checks precede publication and subtree pinning.
Offline/upstream verification
and a fresh-clone/old-branch/return check validate the delivered snapshot; those
receipts identify its actual published commit without a self-referential SHA here.

## Remaining work

Next scope batch getNCards/drawCards and concrete draw/dealing consumers, followed
by phase/turn/unwind and live package/application integration. Other retrial
packages, complete pattern/catalogue, exact Qt streams, filtered battle projection,
production transport/UI/bots and full-match/native differential testing remain
separate. This checkpoint does not certify 100% game coverage or production readiness.
