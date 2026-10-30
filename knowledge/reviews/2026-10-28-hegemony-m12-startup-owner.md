# M1.2 — Native startup owner and static trigger registries

Code/checks/reviews completed 2026-10-27; publication/knowledge resumed 2026-10-28. Fixed source base 37d6e811d91a77072572205353435f78d51ecff6; implemented [4cad85771d797f1d960e2faf1f6dcfdb6ac032a4](https://github.com/chuongphong12/Sanguosha-vn/commit/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4). Input knowledge 67956ab2c3a0d03fd8375dcf01ae090212e1b711; native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. User approved [A](../specs/hegemony-startup-owner.md). [Current contract](../engine/startup-owner.md) is distinct from these revision-scoped receipts.

## Result

The application now owns actual initial winner → global GameStart → eligible per-player GameStart → prepared. Winner/global/over and player/complete stages use separate static global/full registries; the switch occurs only after the global root drains. Room and monotonic scheduler IDs remain intact. Real get-winner binds current relation helpers, including dead-lord lookup, and named reveal/careerist children. Terminal startup runs actual game-over before dealing. Schema-v2 persists cursor/classification and rejects v1 or incompatible root/table/settings. Restore can consume completed roots/drive unfinished idle stages without replaying completed startup.

Only match-startup.ts, match.ts and match.test.ts changed: 746 insertions/27 deletions. Existing normalized kernel, generic scheduler, production server/client/game registration, M0 coordinator and dependencies are unchanged. Full table means supplied profile handlers; package discovery/content/presentation and ordered initial deck remain explicit authorities.

## Tests and review

- Baseline: 2,190 tests/92 files passed before this slice. TDD reproduced incorrect early inclusion/order of player handlers and acceptance of a forged player cursor/full table over an active global root. Both regressions were corrected.
- Final focused match suite: **30/30 passed**, including multiple private startup prompts, fresh eligibility, idle-only switch/monotonic IDs, terminal-before-deal, completed-root recovery, schema/classification/root rejection and all prior assertions. Both reviewers independently reran these 30 cases.
- Final npm run check: **2,199 tests/92 files passed**, typecheck passed; lint **0 errors/42 existing warnings**. npm run build and staged whitespace passed at the reviewed source bytes.
- Dealing/startup tests cover every count 2–10. Luck acceptance/decline still uses a two-seat collection adapter. Winner-condition tests inject trusted serialized one-alive or shown-faction states through restore and execute real winner/reveal/careerist/game-over operations. They do not prove normal all-hidden setup reaches terminal or cover a new recruitment prompt. General package/filter/UI hooks remain explicit fixture adapters.

One test initially expected an ordinary record hook from a rule-type skill. Its fixture was corrected to a non-rule skill against existing scheduler semantics; no kernel change was made. No new M1 network, SQL/browser/provider, full-turn/full-match or native runtime differential test was run. Earlier M0 receipts retain their own revisions.

### Standards

Independent reviewer: **0 actionable findings** across the three files. Reviewed stage/root validation, static tables, idle-only switch, monotonic IDs, cloned application, privacy and continuation; independent 30/30 and whitespace passed. No justified additional Fowler smell finding.

### Spec

Independent reviewer: **0 actionable findings**. Checked native startup order, table classification, fresh eligibility, terminal/no-deal, root recovery and schema/cursor/registry coherence. Trusted injected conditions and no-recruitment branch remain bounded; independent 30/30 passed.

Both pinned staged tree a11da44b6aa6e97031be2ce05bb875d27572c23c against the fixed base; neither edited source.

| File | Reviewed Git blob |
| --- | --- |
| match-startup.ts | d05469f8a11cbdb9bda28cf6768363a5dd01fd40 |
| match.ts | 5966479a89163ee41a34d2c380d4c1629c74aad4 |
| match.test.ts | 0a40ee3a6b66c7e318fb4db0085d915fe0f0a9fa |

## Graph and byte checks

Pre-edit GitNexus factory/winner/reveal impacts were UNKNOWN; direct imports/source and CodeGraph established bounded test consumers. Existing scheduler impacts were LOW. Final GitNexus rebuild: **11,465 nodes/28,490 edges/274 clusters/528 flows**. Structured staged delta: **92 changed symbols/36 affected processes/3 files/raw CRITICAL**, no partial/truncated result flag. All 254 returned flow steps had IDs; changed symbols stayed inside the three files. Actual bytes, GitNexus metadata and CodeGraph hashes agree for all three files:

| File | SHA-256 |
| --- | --- |
| match.ts | 935a619702f7140b42beec5e6f367ce5c4fa3758e445c7671a91724ab9c1c00d |
| match-startup.ts | 9946d4c2c2c34437c7cf3d449c03783eb394e6fae63a44bcb5f7787c505b4f54 |
| match.test.ts | 14728b9cd8245abade9ba3c05d169027a6d28b719b2ac14463648cc71bc6ea81 |

CodeGraph startup-owner upstream traversal returned five nodes/five edges for owner/factory/test consumers. GitNexus createMatchStartup and createGetWinnerOperation impacts were LOW/one each. createHegemonyMatch impact remains UNKNOWN/zero resolved callers while context resolves its test reference. Direct imports plus CodeGraph establish that internal consumer; the tool-surface discrepancy is not graph clearance.

Extraction limits remain: 471 excluded entry candidates, 1,233 skipped callees, 26 budget-cut walks; older luck-transfer callable sets exceeded the 32-candidate cap, 42 cross-language field links remain incomplete, and oversized native-inventory/font files are skipped. Scoped LOW results/hash equality do not waive aggregate CRITICAL or certify full architectural/native parity. The [earlier M1.1 report](2026-10-27-hegemony-m1-match-authority.md) retains its own wider-PR capped/uncapped reconciliation evidence.

## Publication and next gate

Source 4cad85771d797f1d960e2faf1f6dcfdb6ac032a4 was pushed to [draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33) on 2026-10-28. [CI40616168219](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/40616168219) passed at source4cad857: knowledge snapshot/checkout and lint/typecheck/tests. Its logs confirm 92 files/2,199 tests and 42 existing warnings. The Vercel preview was still pending when this receipt was recorded. Knowledge import and later heads require their own checks; this run used the previous67956ab snapshot. No main merge or production cutover occurred.

Next is full phase/turn ownership and native interruption cleanup with real phase bodies/request/rescue/winner orchestration, then real session consumers. M0 manifest/bot/provider/load/decision gates, full agreed content/media, competitive actor-only bots,2–10-seat desktop rooms, hosted recovery/5×10 acceptance and cutover/rollback remain open. Prepared startup is not a playable release.
