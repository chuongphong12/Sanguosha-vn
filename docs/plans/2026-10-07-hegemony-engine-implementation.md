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

## Subsequent parts

Pipelines, enabled content, adapters/UI/AI and final Standard retirement follow the approved spec, each gated independently. Production cutover has not happened merely because foundational library tests pass.
