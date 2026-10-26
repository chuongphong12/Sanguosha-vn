# M0.3/M0.4 — Explicit Leave and permanent bot ownership

Date: 2026-10-26. Fixed game base: `3b546e712fcf31fdb5e5b894d38a8f8eea4d9c51`; implemented source: [`b00ab435c1c37e982f675a80070c2b5d449a6a78`](https://github.com/chuongphong12/Sanguosha-vn/commit/b00ab435c1c37e982f675a80070c2b5d449a6a78). Input knowledge: `5e40b2aea81a0c94d18383f0bb9b6a62af1f26a0`. Native pin remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. The user approved the bounded proposal: preserve the character under bot control when another human remains, revoke the departed human, retain last-online deletion, restore committed control/prompt/memory and prevent duplicate/hidden-information bot decisions. These implement the existing Q25/Q26 policy in the isolated fixture; M0.3/M0.4 stay open.

## Authority and resulting behavior

| Concern | Implemented boundary | Limitation |
| --- | --- | --- |
| Started Leave | Null human credential hash + bot mode + increased generation in one committed document | Fixture starts at its first accepted engine command, not production paired setup |
| Character/decision | Keep character/cards/pending prompt and existing per-seat memory; reuse actual actor-only worker/Master path | Only supported plain Jink/cancellable Play; no full-turn autonomy or new request family |
| Human rights | Old credential and every prior tab cannot read, reconnect, take control or command | Guest fixture credentials; no accounts or production roster/host UX |
| Presence/lifetime | Only credential-bearing humans enter presence/offline grace; bots/revoked connected tabs cannot preserve the room | Existing service-time checkpoint precision limits remain |
| Recovery/failure | File/SQL atomically persist assignment with game, prompt, memory and receipts; cleanup follows successful commit | SQL uncertainty still fences the owner and requires restart/reload; no hosted-provider acceptance |
| Before start | Existing member release/rejoin behavior retained; post-start joins still frozen | No new host transfer or complete multi-seat setup integration |

The only runtime file changed is prototype `session.ts` (17-line diff). No engine-library function, production registration, card catalogue, bot policy, dependency or storage-adapter implementation changed. Clock-v3's session Member now permits null credentials for permanent bots; older application-code rollback is not certified. Temporary offline bot takeover retains a non-null human credential and remains reclaimable; explicit Leave does not.

Permanent takeover commits before the next worker pulse; it does not wait another human sixty-second deadline. A scheduled pulse or an already-due serialized mutation can execute the actual offered response. Last-online explicit Leave still deletes immediately, overriding offline human grace. A passive final-human disconnect uses the existing sixty-second window; bots cannot extend it. No rules death/removal is introduced by Leave.

## Tests and validation executed

Baseline: 29 ordinary prototype tests passed before editing. First RED reproduced the bug: after Leave and the worker pulse, the departed actor still held physical Jink 1 rather than spending it, leaving the request abandoned. The same test passed after retaining permanent bot membership.

- `npm run check`: **91 files / 2,162 tests passed**, typecheck passed; lint **0 errors / 42 existing warnings**. Includes 37 ordinary prototype tests.
- New `m0-leave.test.ts`: **7/7 passed**. After broad regression, its first assertion was strengthened to execute/assert the scheduled Jink before any rejected reconnect mutation could itself drain the worker; the final seven-case file was rerun successfully.
- `npm run prototype:m0:postgres`: **7/7 passed**, including two new Leave cases; Spec reviewer independently reran all seven in a separately owned disposable container and confirmed cleanup.
- `npm run prototype:m0:browser`: **9/9 checks passed** on default file storage, retaining the actual Chromium prompt/privacy/refresh/OS heartbeat checks. These existing browser checks do not directly exercise the new Leave path; that path is exercised through actual Socket.IO tests below.
- Production build and staged whitespace checks passed. Runtime bytes remained unchanged during the final assertion-only test tightening.

Seven new public-session cases cover automatic Jink with old-tab revocation; cancelling a departed Play owner's request without changing cards/HP; permanent assignment and revoked rights across two restart boundaries with one engine effect; pre-start seat release/rejoin; human-only passive empty-room expiry; and both human-answer/Leave queue orders. The controlled clock replaces only trusted OS scheduling; actual Master, engine and disk execute. Source and tests are pinned in [the session contract](../engine/prototype-session.md).

The new real Socket.IO/file fault case prevents writing the temporary document by creating a directory at its path. Failed Leave emits no speculative view and preserves the exact human prompt/control; retry succeeds once storage recovers, then the old credential is rejected.

The two new real SQL cases prove:

1. Explicit Leave commits, game processes are SIGKILLed/replaced, the old credential remains revoked, and the remaining human observes one actual Jink effect. After another restart, last-human Leave deletes even with a permanent bot; another writer rejects the old room link and credential.
2. A real SQL CHECK constraint rejects Leave without publication. After removing it and opening a new writer, the original human regains the exact pending prompt/hand and can control the seat; only a subsequently committed Leave revokes that right.

Existing per-seat memory is preserved by the unchanged complete-document commit and by avoiding any reset/delete in Leave. This slice does not add a repeated multi-prompt tactical-memory/seed conformance experiment, competitive-strength proof or a full bot match. Local SQL, application-ACK and prior clock limitations remain those in the [SQL](2026-10-26-hegemony-m0-postgres.md) and [clock](2026-10-26-hegemony-m0-service-clocks.md) checkpoints; their original executions remain historical.

## Graph and independent review

Before edits, named prototype leave impact was LOW (one wrapper caller), while human/presence synchronization was **CRITICAL** (20 upstream impacts) and authentication impact **CRITICAL** (10). Context linked session/transport/benchmark/browser/tests. The index initially lagged four delivery commits and was refreshed before implementation; UNKNOWN was not used as evidence of safety.

After editing, CodeGraph synced four executable files (one added, three modified), refreshing 122 nodes; the final assertion-only delta refreshed its one file/16 nodes. GitNexus 1.6.12 rebuilt with the process-local 1 GiB buffer: **11,042 nodes / 27,288 edges / 274 clusters / 510 flows**. Full structured staged result: **50 changed symbols / 7 affected flows / 5 changed files / aggregate HIGH**. The seven inspected flows cover command/connect/create/disconnect/join/leave deadline synchronization and Leave authentication. No returned changed symbol falls outside the prototype/test paths. Scoped LOW impacts do not waive pre-edit CRITICAL or aggregate HIGH.

All four executable changed/new source/test SHA-256 hashes matched both GitNexus file metadata and CodeGraph `files.content_hash` at the final bytes. Extraction still omitted 456 entry candidates and 1,208 callees, with 19 budget-cut walks. Structured change output had no partial/truncated flag. These extraction limits, fixtures and dynamic execution require direct source and behavior checks; graph output is not complete parity or production clearance.

Both independent reviewers confirmed final staged tree `53f7d069b7c1e29348f5c237587291cb8b7f45a7` against the fixed base, including the final timer-before-rejected-mutation assertion. **Standards: 0 actionable findings. Spec: 0 actionable findings.** Standards independently passed Leave/prompt suites (13/13); Spec passed three targeted suites (23/23) and real SQL (7/7). No reviewer edited files.

| File | Reviewed Git blob |
| --- | --- |
| `session.ts` | `6a27b61fc52b8407965b1214ff46fe4c64b1aecc` |
| `README.md` | `3e8570dd8d215095ed72378d10ce92df62a69f15` |
| `m0-leave.test.ts` | `bc864296cbe0dae75a3f2c5f880726823beabde4` |
| `m0-prompt.test.ts` | `5871507c69b772606fe151696d99a14dd518298f` |
| `m0-postgres.proof.ts` | `99d5532d20b743ca08346f26eaa44a5eb9177ebc` |

## Remaining boundary

Knowledge maintenance checks passed: 105 Markdown pages, 489 relative file links, three heading anchors, 475 pinned GitHub citations/459 line locators, 101 local Git objects, 39 sources, two scoped pages and 38 relations. All 35 prior source identities were retained. Separate knowledge review corrected a stale SQL execution caption so the original `816191d` report and current Leave evidence retain distinct revisions. Mechanical validity does not certify all semantic claims or hosted behavior.

Extend actual response/selection/discard/skill/reveal/rescue/Nullification families through their distinct authorities, then full-turn bots and production multi-seat lifecycle. M0.1 manifest/media, competitive strength, actual five-by-ten load, hosted recovery/provisioning, timing SLOs and release gates remain open. The supported Leave handoff does not complete all bot/session work or enable production Quốc Chiến. No main merge or deployment occurred.
