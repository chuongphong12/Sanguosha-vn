# GitNexus 1.6.12: diagnosing the Part 4aa CRITICAL report

Status: researched on 2026-10-19; classification and recommendations only. No game code, installed tool, Git history, or upstream repository was changed. The main investigator refreshed the ignored local index during diagnosis; this research worker only inspected the installed distribution and primary upstream sources and wrote this note.

## Question and conclusion

The current refreshed report compares game base `21d693e4c9c046b30085fc11a6a434d4d8bb3e31` with HEAD `18957a5b592dabf4e27e6d2e886134b69bd1148d`: 510 changed indexed symbols across 21 changed files, 28 affected indexed processes, summary risk `critical`, with neither `partial` nor `truncated` set. The report is a change-impact warning. Its payload does **not** classify each of the 28 processes as a critical defect. Distinguishing the aggregate warning from an engine failure does not discharge the warning: the affected paths still require source verification and behavioral evidence.

Initial reproduction artifact: `C:/Users/Tran.Trong.Nhan/AppData/Local/Temp/tqs4aa-critical-repro.json`; command: run `node C:/Users/Tran.Trong.Nhan/AppData/Local/Temp/tqs4aa-critical-repro.mjs` in the game worktree. Initially it observed 474 symbols, before the main investigator refreshed the index to include later documentation nodes. The script intentionally exits 1 when the reported critical warning is reproduced. This detects the reporting symptom, not an independently demonstrated game defect. Current refreshed evidence is in `C:/Users/Tran.Trong.Nhan/AppData/Local/Temp/tqs4aa-critical-current-index.json`. The main investigation owns the individual path/contract/test assessment; see the companion [critical-flow diagnosis](2026-10-19-critical-flow-diagnosis.md).

## Version and evidence identity

- Installed package: `gitnexus@1.6.12`, read from `C:/Users/Tran.Trong.Nhan/AppData/Roaming/npm/node_modules/gitnexus/package.json`.
- Package registry metadata, read using `npm view gitnexus@1.6.12 version gitHead dist.integrity dist.tarball --json`, identifies source commit `c4ecf398de637cf779ab2238e69958cfd5d601ce` and integrity `sha512-Wz++hOW73SkluTkQLJbRIT8+IW649Kmf4mI+99ZxzcQg2Nl47sSjlfe89NN/q0uutGTvbVeXaYMHRDSznDsk5g==`. No package install/update was performed.
- Actual installed `dist/mcp/local/local-backend.js` SHA-256: `c421d9cfd6af419ee3ad210a27f1158385a35f73f22cd2aeafc49ca3cd3ec506`.
- Actual installed `dist/core/ingestion/process-processor.js` SHA-256: `a8731c880c60f5ffa687d51466196b70634ce5a68e085c4a73299c8c87e3d615`.
- The matching [pinned backend source](https://github.com/abhigyanpatwari/GitNexus/blob/c4ecf398de637cf779ab2238e69958cfd5d601ce/gitnexus/src/mcp/local/local-backend.ts#L5652-L5666) and [pinned process extraction source](https://github.com/abhigyanpatwari/GitNexus/blob/c4ecf398de637cf779ab2238e69958cfd5d601ce/gitnexus/src/core/ingestion/process-processor.ts#L28-L33) were opened from the official upstream. Mutable upstream `main` was also accessible and differed in file size; it is not the authority for what ran locally. This note makes no claim that 1.6.12 is the latest release.

The original local graph metadata had `lastCommit` equal to the base above, despite byte-fresh source. The main investigation verified exact indexed/current SHA-256 matches for all four files appearing in the 28 paths: `card-command.ts`, `scheduler.ts`, `card-resources.ts`, and `card-on-use.ts`. It then reconstructed the ignored local index at current HEAD: `meta.lastCommit` now exactly matches `18957a5b592dabf4e27e6d2e886134b69bd1148d`, with 288 files, 8,743 nodes, 22,564 edges, and 530 processes. The four source hashes, all 28 process IDs/names and their 112-step membership stayed unchanged, so `C:/Users/Tran.Trong.Nhan/AppData/Local/Temp/tqs4aa-critical-process-map.json` remains valid.

Refreshed control comparisons from `tqs4aa-critical-current-index.json`:

| Compared scope | Changed symbols | Changed files | Affected processes | Risk |
| --- | --- | --- | --- | --- |
| Full Part 4aa, base `21d693e4c9c046b30085fc11a6a434d4d8bb3e31` | 510 | 21 | 28 | critical |
| Documentation-only, base prefix `0ac` recorded in the artifact | 55 | 16 | 0 | low |
| Current working changes, all scope | 0 | 0 | 0 | none |

None of these three responses reported `partial` or `truncated`. The increase from 474 to 510 reflects inclusion of later documentation nodes, not additional affected gameplay processes. Commit-label staleness is therefore falsified as the cause of this CRITICAL result. Completeness is still limited: the refreshed extraction retains global omissions of 347 entry candidates, 1,210 callees, 19 budget-cut walks, and 13 cross-language sites; an exact-HEAD stamp does not establish complete runtime coverage. This research worker did not access or rebuild the database.

## Exact detect_changes classification

Installed `dist/mcp/local/local-backend.js:4770-4785` reads only the number of distinct affected process IDs plus query degradation when computing this result:

```js
const processCount = affectedProcesses.size;
const risk = queryDegraded
  ? 'unknown'
  : processCount === 0
    ? 'low'
    : processCount <= 5
      ? 'medium'
      : processCount <= 15
        ? 'high'
        : 'critical';
```

Thus 28 intact process matches necessarily produce `critical`; no failed test, data corruption, runtime exploit, or numerical code-quality score is an input to this expression. The separate `impact` operation calls `scoreImpactRisk` and must not be interpreted using these `detect_changes` thresholds. The official pinned backend contains the same classification ladder. [Primary source](https://github.com/abhigyanpatwari/GitNexus/blob/c4ecf398de637cf779ab2238e69958cfd5d601ce/gitnexus/src/mcp/local/local-backend.ts#L5651-L5666)

The zero-count row above applies to a nonempty diff that reaches classification. The earlier no-diff return is separate and can report `none`; this note does not conflate those outcomes (installed backend `4554-4566`).

A deterministic throwaway harness extracts the **actual expression** from the installed file, evaluates it, and checks the boundaries. It does not reproduce guessed thresholds:

```powershell
node C:/Users/Tran.Trong.Nhan/AppData/Local/Temp/tqs4aa-risk-calculator.mjs
```

Observed exit 0: `9 exact installed-expression checks passed`.

| Distinct process count | Query degraded | Actual classification |
| --- | --- | --- |
| 0 | false | low |
| 1 and 5 | false | medium |
| 6 and 15 | false | high |
| 16 and 28 | false | critical |
| 0 and 28 | true | unknown |

This harness is a classification test, not a game regression test. It reads a known local installed statement using `new Function`; it must not be generalized to execute untrusted source. Its printed SHA-256 matches the distribution identity above.

## What affected_processes means

The installed backend maps git diff hunks to indexed nodes by overlapping source ranges (`local-backend.js:4587-4719`). It excludes `BasicBlock` IDs but is not restricted to functions: the initial 474-symbol observation comprised 267 Properties, 171 Functions, 19 Sections, 11 TypeAliases, 5 Interfaces, and 1 Const. These historical type counts describe the initial artifact, not a claimed type histogram for the current 510-symbol result. Nested declarations and enclosing functions can both be touched. Neither total represents that many independent edited functions or demonstrated bugs.

For every changed symbol ID it queries existing `STEP_IN_PROCESS` edges (`4721-4739`), upserts a Map by process ID, and adds changed steps (`4751-4768`). Each process item has `id`, heuristic `name`, `process_type`, `step_count`, and `changed_steps`; there is no item-level severity. The summary count is the Map size, not the sum of changed steps or the count of processes known to have failed. The 1,000-symbol listing cap does not cap the set used for process classification (`803-813`, `4786-4815`). [Pinned implementation](https://github.com/abhigyanpatwari/GitNexus/blob/c4ecf398de637cf779ab2238e69958cfd5d601ce/gitnexus/src/mcp/local/local-backend.ts#L5601-L5666)

`changed_steps` is assembled from query results, not guaranteed to be sorted. Sort by the numeric `step` when displaying an execution path and fetch the complete process membership to identify the unchanged steps. Do not infer the full call chain or source identity from the shortened label alone.

The installed CLI optionally slices `changed_symbols` and `affected_processes` for `--limit` after the backend has computed its summary (`dist/cli/tool.js:290-307`). Therefore a short CLI listing does not reduce the underlying risk count. The root reproduction uses the backend payload and contains all 28 items.

## Why the process list is not exhaustive gameplay coverage

These are static, heuristically selected traces, not recordings of all runtime interleavings. The installed process extractor uses eligible CALLS edges, confidence at least 0.5, and excludes explicitly heuristic edge reasons (`process-processor.js:287-328`). It ranks candidate entry functions/methods, excludes test-file entry points, and retains at most 200 candidates (`330-407`). Depth, branching, trace budget and endpoint deduplication can discard alternate paths. The official pinned implementation exposes counters for these limits. [Primary source](https://github.com/abhigyanpatwari/GitNexus/blob/c4ecf398de637cf779ab2238e69958cfd5d601ce/gitnexus/src/core/ingestion/process-processor.ts#L56-L97)

Exact installed behavior important for this repo:

- Defaults are depth 10, branching 4, minimum 3 steps (`17-22`). Comments in the upstream TypeScript interface mention older defaults; the actual default object is authoritative.
- The real indexing pipeline overrides the default process budget of 75 with `Math.max(20, Math.round(symbolCount / 10))` (`dist/core/ingestion/pipeline-phases/processes.js:19-28`, `95-103`). A claim that this repo globally stops at 75 processes would be incorrect.
- The walker has a 12-trace budget per entry at branching 4; it can save depth-capped prefixes and cycle endpoints (`process-processor.js:434-524`).
- It removes contained traces, keeps one longest representative per entry/terminal pair, and ranks selected terminals (`89-206`, `638-726`). Alternate routes with the same endpoints need independent inspection when semantically important.
- IDs include an enumeration index (`230`), so index regeneration can change a process ID even when its conceptual path is similar. Record source symbol IDs and file/line identities as well as `proc_*` labels.

Consequently `partial:false` on this detect_changes response means the response's parsing/query path did not disclose degradation. It does **not** imply that earlier graph construction discovered every caller, data flow, card rule, or interrupted/resumed game state. Process-extraction truncation and unresolved/dynamic dispatch evidence remain separate review obligations. Fetch/ORM sinks are the recognized meaningful endpoint types in this extractor; pure game-domain boundaries are not automatically recognized as business endpoints (`123-137`, `531-550`).

The official historical [issue #2915](https://github.com/abhigyanpatwari/GitNexus/issues/2915) describes a different detect_changes failure involving thousands of hunks and a native crash. It is not evidence that these 28 matches are caused by that bug: the present report completed and returned an intact summary. Likewise an inline source comment referring to #2283 is not sufficient to claim the linked PR diagnoses this occurrence. Do not prescribe a version upgrade from those references alone.

## Recommended response and fix options

1. **Retain the aggregate warning and provide a reproducible disposition for all 28 paths.** For each unique path, record exact symbol identities, source-hash match, contract under test, current passing evidence, negative scenario, and unresolved coverage. Group common prefixes for explanation while preserving an unabridged 28-row ledger. A warning can remain `critical` after careful review because the shipped classifier measures the size of the affected surface. Passing tests reduce uncertainty about behavior, not the count-based score.
2. **Fix any independently reproduced engine failure at its real public seam.** First make its original request/dispatch/resume scenario fail deterministically; test stale offers, authenticated actor binding, target policy changes while paused, conversion/history semantics, retry versus cancellation, and actual movement/cost hooks where the path reaches them. Apply the smallest source fix only after impact analysis and rerun that original reproducer plus impacted suites. A test that exercises a helper without the affected caller chain cannot clear the caller-chain concern.
3. **Treat tool/report improvements as separate work.** If a specific graph edge or source mapping is demonstrated wrong, preserve a minimal graph/source fixture and compare against the pinned package before proposing upstream correction. A later project-owned report can separate broad change impact, confirmed defects, and unresolved evidence, while retaining raw GitNexus output and pin/hash identity. This is a reporting improvement proposal, not an implemented override of the safety gate.

Do not lower thresholds, exclude the new engine paths, split comparisons to hide the cumulative 28-process surface, or edit installed global tool code merely to get a noncritical label. Reindex only to repair demonstrated stale/missing graph data, then retain before/after evidence. An independently reproduced correctness failure takes priority over score reduction; if none is found, say that none was demonstrated in the assessed cases rather than claiming 100% runtime correctness.

## Delivery boundary

This note establishes the tool's real classification and its limits. It does not assert that the game is ready for production, that all 28 paths are safe, or that a particular engine defect has been fixed. The main diagnostic report must supply the actual source review and behavior-specific reproductions for those conclusions. No implementation or tool upgrade was requested or performed here.
