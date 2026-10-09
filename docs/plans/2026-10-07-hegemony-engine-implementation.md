# Quốc Chiến staged implementation ledger

Branch: `codex/hegemony-engine`, starting from main `936d9656f1875a51af8cc6d4ccaa9504a1487a9a`. Target: native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f.

The requested `writing-plans` transition skill is not present in the available skill roots. This checked-in plan captures the approved design using the available implement/TDD/review workflows. The user's explicit instruction to proceed supersedes additional intermediate approval requests from brainstorming.

## Baseline

- `npm run check`: PASS, 40 files / 287 tests; 42 pre-existing lint warnings, zero errors.
- Existing main engine is Standard 2013 and remains active until the Hegemony core and consumers are migrated.
- Preserve user changes in the primary checkout, previous research notes and `audit-codegraph-status.json`.

## Part 1 — paired setup and projection

Implement a Hegemony-only domain module behind create/select/project entry points. Inject source-normalized general definitions and player-owned offers at this boundary; dealing/shuffle and production catalog wiring belong to later parts. Reject malformed/nonoffered/reused/banned/incompatible pairs without partial mutations. Compute HP from head/deputy-specific contributions, keep both slots hidden, redact others' candidates/IDs and return independent view data. Setup ends at `ready`, not a fabricated playable state.

Test one setup slice first, then selection/rejection/HP/privacy/reload cases. Rebuild graph and validate the checkpoint before adding reveal/relations.

Status: complete. 24 focused tests; full check 41 files / 311 tests, typecheck/lint and production build pass. GitNexus and CodeGraph rebuilt; structured staged change analysis has no partial/truncated flags and reports low risk. Separate standards/spec reviews have zero actionable findings. Details and graph limits are recorded in `docs/knowledge/hegemony-engine.md`.

## Part 2 — identity transitions and relationships

Implement source-normalized reveal/hide transitions and relation predicates through the same domain boundary. Include majority/lord-general/deceased faction membership and careerist group semantics. Keep these domain transitions separate from the later GeneralShown/GeneralHidden scheduler integration; do not expose raw low-level hide as an unrestricted player command.

Status: complete. Full check: 42 files / 323 tests, typecheck/lint and production build pass. GitNexus rebuilt: 2,799 nodes / 9,775 edges / 239 flows; CodeGraph: 185 files / 1,697 nodes / 7,204 edges. Standards/spec reviews have zero outstanding findings. Twelve identity-domain tests cover reveal/conceal, majority/careerist/lord cases, deceased members, persisted recruitment groups, forecast semantics, malformed/no-op transitions, privacy and re-reveal. GeneralShown/GeneralHidden dispatch, skills/preshow/marks, death burial conversion and recruitment operations remain later pipeline work.

## Part 3 — resumable trigger scheduler

Status: complete. 36 focused cases and 43 files / 359 full-suite tests pass; typecheck/lint and build pass. Both final review axes have zero outstanding findings. GitNexus/CodeGraph rebuilt with search recovery; all seven reported affected scheduler flows inspected. Staged graph assessment remains HIGH and has no partial/truncated response flags; global index limits and the resolved test-caller UNKNOWN are recorded in the knowledge note. The separate scheduler uses data-only event frames and a version-pinned external handler registry. Test the approved dispatch/resume seam for dynamic priority bands, current-first order including deceased seats, record-before-triggerable interleaving, player trigger ordering, compulsory visibility, non-card precedence, occurrence multiplicity and ordered target prefixes, refreshed eligibility, nested record/cost/reveal/effect, JSON reload and invalid replies. Event consumption returns only from that event; stage/turn/game interruption freezes parents for later operation-specific cleanup.

The registry is normalized package metadata, not a ported or selectable skill catalog. Its triggerable hooks are pure and stable occurrence IDs/order indices survive refresh. Native encoded-string edge cases must be audited when translating actual packages. CardFinished/material/phase cleanup, GeneralShown identity/skill integration and transport command policies remain Part 4 or later.

## Part 4a — operation frames and physical movement kernel

Scope: implement a typed operation frame, dispatch/resume/nested return through the approved authoritative seam, then the normalized hand/draw/discard/table kernel of native `moveCardsSub`. Operations are separate from trigger events; package skills cannot subscribe to an internal operation as though it were a native event. The version-pinned registry owns pure preflight validation and external continuation handlers.

Source: `room.cpp:5163–5315`. Before events can consume/cancel the whole movement. Confirm events share their mutable notification data but its rewrites/consumption do not alter the committed batch. Remove all sources, then add destinations once; draw-top/discard prepend per card, draw-bottom appends. Post events share their rewrites and return that data without retroactive movement. Each foreach snapshots living action order anew; the trigger scheduler within each event still includes deceased seats.

This is a physical kernel over normalized packets, not the full native move API: native merge/source classifiers and last-hand/origin/open metadata, equip/judge/private/WuGu piles, `cheakMoveData` special-card rewrites, wrapped-card lose/get filters, transport notifications/visibility and operation-specific unwind remain subsequent slices. No catalog or production adapter is enabled. The adapter must not expose raw card zones, frames or operation completions to clients. A stale precommit physical mapping is a rejected kernel invariant; any already-completed child movement remains committed. Cleanup/recovery of programming/invariant errors is still deferred, rather than claiming that a whole nested transaction rolls back.

Status: complete for this scoped kernel. 27 movement + 3 operation cases, together with all 36 prior scheduler cases, pass. Full check: 45 files / 389 tests, typecheck/lint and production build pass; 42 inherited warnings, no added warnings/errors. Tracer tests began red, including fresh living-stage snapshots, atomic invalid input, duplicate physical storage, stale nested Before/Confirm mapping, aligned no-op filtering and draw-bottom ordering. Separate reviews resolved two Standards findings and one Spec finding; both final axes report zero outstanding findings. GitNexus and CodeGraph rebuilt; structured staged analysis reports 13 affected flows and HIGH risk, retained with scoped inspection and explicit global index omissions in the knowledge note. Additional movement metadata/zones and all other gameplay pipelines remain outstanding.

## Subsequent parts

Pipelines, enabled content, adapters/UI/AI and final Standard retirement follow the approved spec, each gated independently. Production cutover has not happened merely because foundational library tests pass.

## Part 4b — movement metadata and extra physical zones

Scope: extend the normalized physical packet with source/destination place and named-pile data, preserved origin, per-card visibility and final-hand-loss metadata. Accept equip, delayed-trick, judge, named private pile and WuGu storage without claiming card-specific install/lose/get hooks. Keep this authoritative packet behind the existing dispatch/resume seam; client projection and native merge/separate adapters remain separate gates.

Status: complete for the scoped physical metadata/zones. Five new red/green metadata/zone cases plus the existing movement/operation/scheduler tests pass; full check is 46 files / 394 tests, typecheck/lint and production build pass with the same 42 inherited warnings and zero errors. GitNexus and CodeGraph rebuilt after review fixes. Structured staged assessment finds six affected flows, HIGH risk, retained and scoped in the knowledge note; global graph omissions remain. Independent Standards/Spec reviews each resolved one finding and report zero outstanding issues. Native packet classification, card-specific hooks, visibility projection and production integration remain later gates.

## Part 4c — source classification, remerge and action order

Scope: at the existing public `move-cards` dispatch/resume seam, form native-like OneTime packets by owner/destination before BeforeCardsMove, then separate the rewritten packets by physical source place/pile, visibility, reason and last-hand metadata before recomputing owner-wide hand depletion and remerging for Confirm/commit/post. Preserve concrete zone keys for physical storage and deterministic tie order. Do not enable package move rewrites or production registration in this part.

Status: complete for this scoped packet-classification slice. Eight new public-dispatch regressions and the full check pass: 47 files / 402 tests, typecheck/lint and production build, with 42 inherited warnings and zero errors. The independent Standards review identified two low-priority duplication judgments; both were resolved and rechecked. The independent Spec review found zero actionable issues and independently passed 79 focused cases. GitNexus and CodeGraph were rebuilt; staged graph risk and global index limits are recorded in the knowledge note. Package-specific rewrites, visibility projection and production integration remain later gates.

## Part 4d — scenario-card discard rewrite

Scope: inject immutable card-class metadata through the unregistered movement operation and reroute `RuleTheWorld`, `Conquering`, `ConsolidateCountry` and `Chaos` from discard to WuGu after BeforeCardsMove, before separation/Confirm. Preserve reason and per-card source/visibility alignment, remove a rewritten same-zone no-op, and reject a missing WuGu destination without changing physical storage. This is one native `cheakMoveData` branch, not the full special-card or wrapped-card pipeline.

Status: complete for this scoped scenario-card branch. Five public-dispatch regressions cover the rule, including two same-WuGu no-op variants. Full validation passed: 48 files / 407 tests with four Vitest workers, lint/typecheck and production build; 42 inherited lint warnings, zero errors. Independent Standards review found zero issues; independent Spec review found one same-WuGu no-op defect, fixed with red/green regressions for identical and distinct zone keys. Graph results and residual risk are recorded in the knowledge note. ImperialOrder, SixDragons, ImperialEdict, wrapped-card lose/get hooks, client visibility and production integration remain later gates.
