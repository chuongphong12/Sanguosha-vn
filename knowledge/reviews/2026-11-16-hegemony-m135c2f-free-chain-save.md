# M1.3.5c.2f — free-chain recovery checkpoint

Date:2026-11-16. Source 2e1972108e11873338468a20dc28ca9a4f896a65; fixed base 8382cd6cb5c37b2174182fc00a37a4db23133226; reviewed source tree 544e0d23ae01b4ab894791f88ef29c7530dd3dea; input knowledge 6164a8cccc4db4a1d58b496e4578a48e9374a9bd. Native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/free-chain-save.md), [approved scope](../specs/hegemony-match-v3-save.md).

## Scope and checks

Optional validateKillSave enables captured surrender identity and explicit child validation. Legacy profiles retain four-field cursor/no hooks; opted-in pending kills add killTarget, removed before reveal. Read does not run kill mapping/reward predicates or recheck historical queues. Actual live award rules remain unchanged; optional runFree metadata is intentional.

Baseline202/3; finalfocused271/5 includes34 new cases and35 preceding kill recovery tests. Finalfull2933/111/typecheck/build passed; lint0 errors/42 prior warnings. Source Standards0/Spec0 at 544e0d23ae01b4ab894791f88ef29c7530dd3dea; Spec independently ran69/69 free-chain/kill cases. Initial RED was missing operation codec coverage. No assertion/timeouts weakened. Actual nested drains, kill-player and unwind run; mapper/predicate/catalogue/observer/owner/event policies remain fixtures, not complete death GameRule or package/Room recovery.

Equal base/current preservation receipts:

- general-rewards.ts: complete award function AST; SHA-256 77049d0c70ba44310bac2d6cecf843dcf613d21e220626f43f959bb5aa8e4b46
- scheduler.ts: complete emitted scheduler interpreter; SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

## Graph and provenance

Factory pre-impact UNKNOWN remains unresolved; direct imports in four existing test files and CodeGraph46 nodes/67 edges supplement it. FreeChainRules MEDIUM/10 symbols/1 process, runFree LOW/1 and award LOW/2 were checked before editing. Final graph 14,068 / 35,419 / 301 / 488 nodes/edges/clusters/flows; change summary {"changed_count":39,"affected_count":0,"changed_files":2,"risk_level":"low"}. CodeGraph depth3 resolves48 nodes/72 edges. No affected process steps were extracted; this is not proof of no consumers. Source/AST/regression evidence supplements graph gaps. Changed hashes match source/GitNexus/CodeGraph:

- src/game/hegemony/general-rewards.ts: 3b5df7bb866d28836988b7ad85fa9117065939bd7f89b0b36e5f50aa5b613908
- tests/hegemony/free-chain-save.test.ts: a48008c60436746072eebc6d853028ae9f0db772baaeb39e517441ff3c88dc01

Global extraction omits595 entry candidates/1207 callees and cuts17 walks;42 cross-language property links, callback caps and inventory/font size caps remain explicit. Missing edges are not an all-clear.

## Delivery gates

Canonical lint/reviews/publication/import/pin and source/integration CI are distinct later receipts. Next is Draw-phase recovery, then remaining startup/battle handlers, aggregate Room/profile/root decoding and public v3. Group1, complete matches and production release remain open; no main merge/cutover occurs here.

## Pre-publication receipts

Mechanical lint passed 151 Markdown pages, 922 relative file links, 3 anchors, 616 pinned citations, 523 line locators and 185 local Git objects, with 0 errors. Registry totals 160 sources / 22 pages / 168 relations preserve all prior 158 / 21 / 166 records exactly. Reference resolution does not certify every semantic claim or external endpoint.

Canonical Standards 0 / Spec 0 reviewed the 15-file draft at tree 4e1f3b6bce4cb7901e04c7d62bf7a06c6e792afa. This receipt-only delta receives review before publication.

[Source CI 43831819866](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43831819866) passed both jobs at head 2e1972108e11873338468a20dc28ca9a4f896a65: 2,933 tests / 111 files, typecheck, 0 lint errors / 42 prior warnings, and preceding knowledge 6164a8c verified offline/upstream. Publication/imported-head CI remain later gates, not inferred here.
