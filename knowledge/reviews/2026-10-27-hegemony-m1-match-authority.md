# M1.1 — Internal authoritative match and setup handoff

Date: 2026-10-27. Fixed base: `7b3e6c485f49736ecb3433f10bc151259d8d492e`; implemented source: [`1e705eff4ca1252f0cf771615d5847820a9c8fd3`](https://github.com/chuongphong12/Sanguosha-vn/commit/1e705eff4ca1252f0cf771615d5847820a9c8fd3). Input knowledge: `aaef9e6557f96a3c5215ed5a2f201a4c4fad5618`. Native authority remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. The user approved A, one match authority and internal M1.1 implementation alongside open M0. The [bounded specification](../specs/hegemony-match-authority.md) and [compiled contract](../engine/match-authority.md) retain the scope; no release requirement was reduced.

## Result and authority

| Concern | Implemented | Remaining authority/gate |
| --- | --- | --- |
| Match aggregate | create/apply/view/restore; paired setup consumed into one Room and scheduler | Internal application interface; no production consumer |
| Initial facts | Actual names versus hidden display, selected private kingdom/role, source-derived HP/marks and hidden-lord/companion distinctions | Supplied content/general/physical metadata and ordered initial deck |
| Global startup | Actual GameStart/draw/movement; configured luck return/shuffle/redeal; nested prompts | Supplied package skill predicates, trusted luck collection and presentation timing |
| Projection | Public facts plus own hand/names/marks/opaque choices; viewer/target-private notices | Full gameplay/session/Pixi projection not yet integrated |
| Recovery | Pure cloned candidate; JSON prompt continuation; schema/rules/content/registry/settings binding; composition/inventory checks | Auth, durable commit/receipts, network/process/provider recovery remain separate |
| Terminal/interrupt | Existing Room gameResult and scheduler interruption determine view stage; eager state/frames retained | Initial winner/per-player RoomThread startup, full phase/turn and native cleanup remain open |

Only four new source/test files were added. Existing kernel operations, production server/client/game registration and dependencies are unchanged. Prepared means the global startup event has drained, not a playable turn. The independent M0 two-seat response-v4 socket/store fixture remains distinct from this internal 2–10-seat match interface.

## Tests and executions

Fresh baseline setup/GameStart suites: **40/40 passed**. The initial new seam RED could not import the absent match module. Subsequent behavior RED cases reproduced missing implicit lord CompanionEffect, a private extra notice field reaching a spectator, acceptance of a restored second setup authority, startup-settings drift under unchanged registry version, and an incorrect hidden-lord flag. Each was corrected and its regression passed. A test initially referenced a nonexistent lose-HP helper; it was corrected to the existing real DamageDone operation, without adding a fake engine path.

- Final `npm run check`: **92 files / 2,190 tests passed**, typecheck passed, lint **0 errors / 42 existing warnings**.
- Final `npm run build`: passed at reviewed source bytes.
- New public match suite: **21/21 passed**, including every count 2–10, source-derived HP/marks, privacy before/after handoff, actual movement prompt and DamageDone HP, partial/pending/terminal JSON restore, wrong/stale/unoffered replies, duplicate selection, explicit incompatible versions/settings, and both luck choices.
- In the two-seat luck cases, acceptance executes actual return/shuffle/redeal and advances saved RNG; decline preserves exact initial hand/RNG. Physical IDs remain conserved and the other actor keeps its hand. The all-player collection adapter is explicitly internal; this does not exercise real concurrent network collection or establish luck coverage for every seat count.
- Local source checks and staged whitespace passed. Both reviewers independently reran the final21-case suite.

The actual loss-of-HP child is composed during a paused startup movement; after restore, the current Room HP appears in actor projection with no stale setup copy. This does not claim the full damage/rescue/turn pipeline or general gameplay commands. No new M1 Socket.IO/browser/SQL/full-match proof was executed. Earlier M0 PostgreSQL/Chromium results remain attributed to their own checkpoints.

## PR and remote CI

[Draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33) targets main. At pre-M1 head 7b3e6c4, a nonmutating merge-tree against main3cb7514 succeeded. [CI40446098053](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/40446098053) passed knowledge/checkout and lint/typecheck/tests; its frontend Vercel preview passed. The source remains a foundation integration, not an enabled target mode.

At implemented M1.1 head 1e705ef, [CI40468356597](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/40468356597) also succeeded for knowledge/checkout and lint/typecheck/tests; its logs confirm 92 files/2,190 tests and 42 existing warnings. The [Vercel deployment](https://vercel.com/chuongphong12s-projects/sanguosha-vn/3wPDM8hTqL8Xupk64xSpJdgBk8mr) completed. These checks are scoped to that head and its then-pinned aaef9e6 knowledge. Later imported snapshots require their own checks. A frontend preview cannot certify the separate M1 Room/session/turn path or backend hosting. PR stays draft; no main merge or production cutover occurred.

An independent wider review at 7b3e6c4 inspected merge seams, production isolation, setup/startup/projection and previously reviewed prototype slices across a 139-commit/265-file inventory. It found no new actionable engineering defect within that inspected scope, but explicitly did not re-audit every earlier handler/test/research dataset. It is not exhaustive release certification.

## Graph and byte verification

Pre-edit graph results for setup/projection/GameStart factories were UNKNOWN; direct import/call inspection confirmed current test/prototype consumers rather than treating empty edges as unused. New match entry points initially had no indexed definition. Existing scheduler entry impacts were LOW; these scoped values do not certify application readiness.

CodeGraph indexed all four new files (47 nodes), then refreshed the three corrected files (43 nodes). Final GitNexus forced rebuild: **11,371 nodes / 28,163 edges / 275 clusters / 528 flows**. Structured staged output: **215 changed symbols / 36 affected processes / 4 files / raw CRITICAL**, no result partial/truncated flag. All four executable source/test SHA-256 values matched actual bytes, GitNexus metadata and CodeGraph hashes at the reviewed tree. All236 returned flow-step rows had IDs and only the new match/setup/scheduler and existing prototype paths; no changed symbol was outside the four files.

GitNexus impact for createHegemonyMatch still reports UNKNOWN/no resolved callers, while its context surface resolves the incoming test fixture. This tool-surface discrepancy remains explicit. Direct imports plus independent CodeGraph impact (three nodes/three edges: factory, test fixture, test file) establish the current internal test consumer. createMatchRoom had LOW/two upstream impacts and notice allowlisting LOW/one; none waives aggregate CRITICAL. Extraction still excludes 467 entry candidates/1,230 callees/26 budget-cut walks; two older callable sets exceeded their 32-candidate cap and cross-language field links remain incomplete. No absence-of-flow or full parity claim follows.

The earlier wider PR comparison at merge-base936d965 listed7,971 changed symbols/185 processes/265 files/raw CRITICAL but capped the displayed symbols at 1,000. Increasing an unsupported limit did not remove that cap. A supplementary uncapped graph query used the same parsed/coalesced diff ranges and reconciled all 7,971 distinct symbols, with zero unparsed headers/empty IDs. That supplement does not change the raw tool truncation flag, extraction limits or bounded human-review coverage.

## Standards

Independent reviewer: **0 actionable findings** across all four new files and final corrections. Checked Room authority, cloned application, startup composition, private projection/notices, JSON/configuration compatibility and scope. Final focused suite 21/21 and whitespace passed. No justified smell findings.

## Spec

Independent reviewer: **two behavior findings and one coverage gap corrected; 0 remaining**. Persisted startup settings prevent configuration drift; hidden actual lord initializes lord=true while generalLord=false; both accepted/declined luck traverse the restored public seam. Final focused suite 21/21 passed. Full RoomThread startup/turn/session remain explicitly outside M1.1.

Both reviews pinned staged tree `bc4de31ad6397a5ef9a480b00b8d378183b6c367` against the fixed base. Neither reviewer edited files.

| File | Reviewed Git blob |
| --- | --- |
| match.ts | `59e040c19ed324a8784d67dacdd5d2a0bc7ead15` |
| match-room.ts | `7af70ac5028b55cbe1ec5c25f7a815d74d29e98b` |
| match-notice.ts | `380357635b795beecfa0dde82a7a34242515cf38` |
| match.test.ts | `27cc9c10bbf2f372ff842b04192fd58165db55c2` |

## Release frontier

Next is the scoped native startup/phase/turn owner and interruption cleanup, then complete phase bodies/request/rescue/winner orchestration and real session consumers. M0 manifest/bot/provider/representative-load/decision work remains open. Complete agreed content/media, competitive actor-only bots,2–10-seat desktop rooms, hosted recovery and 5×10 acceptance, cutover/rollback and release review are still required. No 100% claim, native runtime differential or release completion is established by this checkpoint.
