# Release M0 — publication and initial research checkpoint

Date: 2026-10-22. This is a research/documentation checkpoint, not a completed manifest, implemented session, prototype result or release approval.

## Inputs and publication

- Game inspected at `1fc4ff20bf261c3b7cf85c9d5c6c3a4b90e4cbae`; gameplay source remains the existing 4ae revision. Its remote availability is not asserted.
- Native authority: `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`, 2.3.43-beta2. Knowledge base: `c471bbe0e020be55750691365e54a3cf911b715a`.
- Reviewed staged knowledge tree before adding this evidence record: `3a1bf905b9dc8f6a1892ffaf663c9f1a85733ee9`. The research reports and data in that tree are the reviewed inputs, not an unqualified review of future edits.
- Published the accepted [release specification](https://github.com/chuongphong12/Sanguosha-vn/issues/25), [decision map](https://github.com/chuongphong12/Sanguosha-vn/issues/26) and six M0 children. Read-back verified complete bodies, native parents/blockers and the two research assignments. The original preparation check covers 15 Markdown files, 41 relative file links, 40 stories and the six-ticket acyclic dependency graph without redundant direct edges; it does not verify URL fragments or run prototypes.

## Deliverables and boundaries

| Deliverable                                                                   | Evidence and remaining scope                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Manifest investigation](../research/2026-10-22-m0-manifest-investigation.md) | 176 ordinary candidate general definitions in 12 packages; 179 C++ physical allocation expressions; 418 direct attachments / 416 normalized skill IDs. These counts are not the enabled roster/deck or port completeness. Runtime profile, dependency closure and per-ID handler/UI/bot/test/media mapping remain open.                                        |
| [Session contract](../research/2026-10-22-m0-session-contract.md)             | Authority/adapter map, committed command→actor-view seam, create/setup/provisioning/result/host/control/deletion transitions and proposed acceptance traces. Installed boardgame.io 0.50.2 has observable output before storage completion; adapter options were inspected, not executed. No provider is selected and no durable-session prototype has passed. |
| [Asset inventory](../research/2026-10-22-m0-assets-inventory.md)              | All 2,433 tracked resource files / 182,828,266 bytes retained as path/size/SHA evidence. Alias targets exist; per-content completeness, decoding/UI use and usage permissions remain unresolved.                                                                                                                                                               |

Accepted Q25–Q28 policies are recorded in the [session decision comment](https://github.com/chuongphong12/Sanguosha-vn/issues/28#issuecomment-6336872514). In particular Q26 deletes on the last **online** human's explicit Leave despite another participant's remaining grace. Q29 excludes Joy, Disaster and jile_card. Q30 confirms ordinary Quốc Chiến without a Vương Triều Chiến/treasure flow: LordEXCard remains disabled; the separate LordEX general candidates are retained. None of these decisions changes gameplay code in this checkpoint.

## Executed checks

- Reconciled the static counts, unique general IDs and direct attachment ownership. Compared 56 native source hashes and seven extension hashes against the pinned checkout. Stored raw/candidate JSON hashes match their report and each other.
- Re-read every tracked resource's bytes/size/hash and checked its tracked exact path; total and alias-source hash match the inventory. These are file integrity checks, not rendering/audio or rights acceptance.
- Formatting of authored Markdown/configuration and the asset JSON, plus relative-path checks, passed. The raw/candidate JSON exports are intentionally retained byte-for-byte for their original SHA identities; they were parsed and integrity-checked instead of reformatted (including them in Prettier reports two style warnings). Source-baseline JSON and all three investigative JSON artifacts parse successfully. `git diff --check` passed.
- Graph discovery used GitNexus and CodeGraph bound to the exact game/native checkouts. Their limits, one lock-only stale game index and selected-file hash reconciliation are recorded in the research reports. Final GitNexus `detect_changes` returned zero changed symbols, zero affected processes and risk `none` for the unchanged game worktree. This does not certify future session adapters.
- No engine tests/build, native executable differential, browser gameplay, network/storage fault tests or load benchmarks were run for this documentation-only slice. Earlier 4ae results remain scoped to their original checkpoint.

## Separate reviews

**Standards:** zero findings. Independent review reconfirmed the inventories/source hashes, installed bundle identity and local-only reference qualifications. Extractor scripts and raw graph receipts still in the original machine's Temp directory are explicitly labelled local evidence; a clean-clone extraction toolchain is not claimed.

**Spec:** one initial finding: the session table omitted explicit start, terminal-result and host-transfer transitions required by the session ticket. Added those transitions, successful-create/once-only provisioning detail and four observable traces. Independent follow-up reported zero residual findings. The openly unfinished manifest remains unfinished; the session traces are proposals for prototype acceptance, not passing tests. A subsequent parent audit clarified that the first staged-Master adapter is the prototype route within the accepted boardgame.io stack; the alternative standalone session protocol is only a bounded experiment and cannot authorize a stack change. Separate Standards and Spec follow-ups against `1672a1163d273680f5f677b5e9b7e46ab8e6d8a3` both reported zero residual findings for this clarification.

## Next gate

Keep the [manifest ticket](https://github.com/chuongphong12/Sanguosha-vn/issues/27) open until the enabled manifest, full dependency/readiness mapping and reviewable content list are delivered. The [session ticket](https://github.com/chuongphong12/Sanguosha-vn/issues/28) now has a reviewed contract to assess before its dependent bot/storage prototypes. No blocked prototype, main merge or deployment is certified or performed by this record.
