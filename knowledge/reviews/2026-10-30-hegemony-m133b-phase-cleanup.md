# M1.3.3b — GameRule phase cleanup

Date:2026-10-30. Fixed game base0bc9bb27f2b37958415db14124869faf546376fd; inspected [652056e30eafd4faa4198e34d86fc9d33adec0c4](https://github.com/chuongphong12/Sanguosha-vn/commit/652056e30eafd4faa4198e34d86fc9d33adec0c4). Input knowledge50ed52f7a83ac288cf51db7c6f0c3becab33b117; nativece4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. Approved [B checkpoint3](../specs/hegemony-turn-unwind.md); [compiled cleanup contract](../engine/phase-cleanup.md). Together with M1.3.3a this completes the library phase checkpoint; M1.3.4/5 and release gates remain open.

## Source and tests

Only five new modules and one new test file change. Added typed mark/limitation authorities, phase GameRule effects, real Room skill batch plus its limited-mark/filter GameRule dependency, ImperialOrder onEffect and required Room HP loss. Existing scheduler, phase controller, applications, production and dependencies are unchanged. Metadata, filter, request and presentation adapters remain explicit; no content profile is enabled.

Baseline236/236 across four existing phase/general/movement/death suites passed. New public dispatch/resume tests were developed through RED/green slices for missing mark/limit/phase/skill/ImperialOrder operations. Initial review reproduced five defects: missing RemoveStateChanged before turn tags, owned-only detach missing visible/non-equipment filtering, absent skill-event GameRule dependency, malformed removed truthiness bypass and foreign force-discard candidates. Each has a reproduced RED and corrected behavior. Additional own RED cases reject malformed refilter metadata in both skill owners. Early fixture active-player argument/notice filtering and an unsupported replaceAll typing issue were corrected separately, without changing existing engine modules or compiler settings.

- Focused229/229 across four suites, including48 new cases; typecheck passed.
- Final npm run check:2,412 tests/96 files; lint0 errors/42 pre-existing warnings. Final build/staged whitespace passed. Full check completed before graph analysis to avoid concurrent heavy indexing.
- Final source Standards:0 documented breaches/0 actionable smells; Spec:0 actionable findings. Both reviewed tree e93b9a2bac03c0e8e7dc3bf3eab24b0fe65e819d. Final Spec independently passed48/48 and docs verification; Standards independently checked docs/whitespace and did not rerun full test/build. Initial final-review workers hit a usage limit; fresh read-only reviews later completed on the same tree. No review success is inferred from the earlier failed workers.
- Full check reruns existing M0 Socket.IO loopback regressions. No new M1.3 network/browser/SQL/provider/bot-policy/native-runtime or full-match execution was performed. Filter delegation is tested with an explicit adapter; lethal loss tests a missing required rescue child rather than claiming complete rescue/winner coverage.

## Graph and byte evidence

Pre-edit new names were absent/UNKNOWN and checked against source/CodeGraph rather than called unused. Existing deathOrder HIGH15/damageRule MEDIUM14 were query-only unchanged dependencies. CodeGraph identifies the new factories through test setup/equipment setup; final scoped impact receipts are separate from the aggregate graph. UNKNOWN and extraction limits remain explicit.

Final structured staged summary:327 symbols/15 processes/6 files/raw high. All45 returned flow steps have IDs, no structured partial/truncated flag. Clean rebuild used --force --no-parse-cache:12,535 nodes/30,748 edges/291 clusters/534 flows. Extraction still drops522 entry candidates/1,254 callees/24 budget-cut walks;42 cross-language property links remain unresolved, two older luck-transfer callable sets exceed32, and the large inventory/font files remain size-excluded. GitNexus impact is UNKNOWN for the six new operation factories and hasRoomCardLimitation; ownsRoomSkill resolves LOW/one. CodeGraph phase cleanup reaches four nodes/five edges through the new test setup/equipment setup; skill factories reach four nodes/five–six edges. These limitations are not waived. Hashes below match actual source, GitNexus and CodeGraph.

| File | SHA-256 |
| --- | --- |
| src/game/hegemony/phase-state.ts | 73366150d9aaea3b3ad7d59193f231b9dea3edde2d5d347bc0f74d8b1bc9d871 |
| src/game/hegemony/phase-cleanup.ts | f6c606af7855f0bfeb3713b33586078dbead41d6be7546ac5f75180b64fee6bf |
| src/game/hegemony/room-skills.ts | fdee932c4fb8a8eaf4ccc01774bdb7c022bf87ffd2665b452de7c6cd7e02055b |
| src/game/hegemony/imperial-order.ts | 8ca5287fb40669d473a307db639f8ea36e89bc4b9595961e7aa385aad491265f |
| src/game/hegemony/hp-loss.ts | 07bbbb663078087ddc384cecb1ab3b7916511a0e5c60364722caf7095066988c |
| tests/hegemony/phase-cleanup.test.ts | b0e5b665bfb62c16942de28b601fd9eef74deb3b1d4fce71ab28b7b4d86affd8 |

| File | Reviewed Git blob |
| --- | --- |
| src/game/hegemony/phase-state.ts | a1849d26f69024ccc736bce2f1d75c71399f5748 |
| src/game/hegemony/phase-cleanup.ts | 8e042ba7a82b1f937189cff5473147c3c06bdfd3 |
| src/game/hegemony/room-skills.ts | 731805545cf02f96c93bd710e5c958b93b16c3eb |
| src/game/hegemony/imperial-order.ts | f0d606f5794b318f50836ebd33db0793e84ef568 |
| src/game/hegemony/hp-loss.ts | 4533973288564a75822d06a7df14188ff005091a |
| tests/hegemony/phase-cleanup.test.ts | 815453351aa4df7a8730289d70cf5c92888eb710 |

## Delivery and next checkpoint

Source [CI41028444507](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/41028444507) succeeded at652056e30eafd4faa4198e34d86fc9d33adec0c4: both Knowledge snapshot and checkout and Lint, typecheck and test passed, with2,412 tests/96 files and0 lint errors/42 existing warnings. That run verified the preceding knowledge50ed52f7a83ac288cf51db7c6f0c3becab33b117; it does not verify the forthcoming import.

Mechanical knowledge lint passed across122 Markdown pages,663 relative file links,3 heading anchors,557 pinned GitHub citations/505 line locators and145 local Git objects; registry100 sources/8 scoped pages/108 relations,0 errors. All88 previous source records,7 page records/applicability and96 relations remain unchanged. Production/dependency/other-kernel diff is empty outside the five new owners and test. These checks validate reference integrity and scope, not every semantic claim or external endpoint. Initial independent knowledge Standards and Spec reviews each found0 actionable findings at treef549bf2f0330b8c6fc6a7c3bc217d8d851e6d90a; these execution receipts form a final review delta before publication.

Publish through [draft PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33). Each source/import head requires its own actual CI result. Canonical review/publication/import/lock verification are separate; no future delivery success is inferred here. No main merge or production enablement occurred.

Next M1.3.4 supplies real TurnStart, normal/extra/round progression, recovery owner and remaining phase bodies. M1.3.5 integrates match v3 and internal minimal-profile full matches. Complete content, competitive bots/media, rooms2–10, provider/load/storage/UI and cutover/rollback remain release gates.
