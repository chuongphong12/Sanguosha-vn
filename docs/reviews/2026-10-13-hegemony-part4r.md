# Part 4r review

Fixed baseline: `2b9a210fcfc34c599b6e61a5421c13bc3b660676`. Two independent read-only reviewers examined the scoped dying/rescue/recovery implementation against the approved Part 4r plan and native source pinned at `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.

## Standards

Initial and final reviews: zero actionable documented violations or Fowler smells. The modules use the existing dispatch/resume seam, serialized cursors and explicit package/response/death adapters. Only three shared damage-rule helper exports change; their bodies, shared readers and scheduler remain unchanged. Independent final focused validation: 90/90 tests pass.

## Spec

Initial review: one P2. PostHpReduced treated every JSON object as DamageStruct, rejecting non-damage lose-HP or RecoverStruct payloads. Three public regressions failed before the fix. The documented JSON adapter now identifies damage-shaped objects by an own damage or nature field, validates those records, and uses a null damage reason for other values. Two additional public regressions retain rejection of malformed partial damage records. Native QVariant metatype identity remains an adapter gate.

Final re-review: zero unresolved findings; one P2 resolved. Independent final focused validation: 90/90 tests pass. Original Room recipient versus shared dying.who, seat snapshots, saver property restoration, rescue restrictions, first CannotHelp removal, single-Peach retry/use/after ordering, recovery and serialized interruption state match the scoped contract.

During additional parent validation, a public red regression exposed response-use reason not being reset after null validateInResponse. Native recursively re-enters askForSinglePeach and resets it before the next request. The retry now does the same; both final reviewers examined this behavior.

Death/burial/rewards/victory, package legality/conversions, transport/AI, native pointer identity, exception unwind, production routing and native differential/E2E parity remain deferred. The test kill adapter proves delegation and sequencing; it is not a port of killPlayer.

Final full validation and graph limitations are recorded in the Part 4r knowledge checkpoint.

Final full check: 64 files / 1,124 tests, lint/typecheck and production build pass; 42 inherited warnings, zero errors. CodeGraph is current, and GitNexus hashes match all six changed source/test files. All 60 staged affected flow IDs / 231 ordered steps were inspected. CRITICAL staged risk, UNKNOWN factories, lower-bound interface callers, unanchored callbacks, false AssetPack property-dispatch attribution and global omitted flows remain explicitly recorded in knowledge.
