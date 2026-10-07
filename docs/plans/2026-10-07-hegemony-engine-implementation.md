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

Status: Part 1 gate passed; native reveal/hide edge contracts under source verification before implementation.

## Subsequent parts

Scheduler, pipelines, enabled content, adapters/UI/AI and final Standard retirement follow the approved spec, each gated independently. Production cutover has not happened merely because foundational library tests pass.
