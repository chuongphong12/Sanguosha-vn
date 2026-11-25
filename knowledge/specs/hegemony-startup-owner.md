# M1.2 — Accepted startup-owner scope

Accepted by the user in the implementation conversation on 2026-10-27: **A — owner application, hai registry tĩnh**. This records that explicit choice; it does not infer a business owner or authorize production cutover. The reviewed input was game 37d6e811d91a77072572205353435f78d51ecff6 and knowledge 67956ab2c3a0d03fd8375dcf01ae090212e1b711. Implementation is [4cad85771d797f1d960e2faf1f6dcfdb6ac032a4](https://github.com/chuongphong12/Sanguosha-vn/blob/4cad85771d797f1d960e2faf1f6dcfdb6ac032a4/src/game/hegemony/match.ts); the [contract](../engine/startup-owner.md) and [checkpoint](../reviews/2026-10-28-hegemony-m12-startup-owner.md) describe implementation and evidence separately.

## Problem and alternatives

M1.1 directly emitted global GameStart after setup. Native [RoomThread](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L84-L220) checks the initial winner first, then global GameStart, then per-player startup under the complete table. Running all package handlers in the early global table would change ordering.

- A, accepted: an application-owned startup cursor and two immutable executable registries; change the saved table identity only when idle, retaining monotonic IDs.
- B, rejected for this slice: extend the shared scheduler for dynamic trigger-table construction. That larger shared contract is unnecessary for the bounded startup sequence.

## Required behavior

1. Keep create/apply/view/restore and consume setup into one Room once. Drive initial-winner → global → eligible players → prepared, stopping at prompts/interruption/result.
2. Compose actual existing winner, reveal, careerist and game-over operations; a terminal initial result prevents dealing. Keep named package/relationship authorities explicit.
3. Global includes only GameRule/global definitions; full includes the supplied profile. Check current eligibility after global and before each player. Validate IDs/duplicates; classification and callback semantics require profile versioning.
4. Persist schema-v2 cursor and stage-bound registry identity; reject v1 explicitly. Never switch an active scheduler. Restore/reply must retain Room/RNG/IDs and avoid duplicate effects or dealing.
5. Preserve actor privacy and existing HP/identity/luck/notice contracts. Prepared covers startup only. Full phases, turns and native interruption cleanup are later work.

## Acceptance

Use real child operations for winner/nonwinner, native ordering/classification, current eligibility, multiple private prompts and JSON continuation. Reject wrong/stale/unoffered/duplicate replies and incompatible schema/cursor/table/configuration; verify input isolation and no redeal/reset. Run focused/typecheck/full checks/build, both graph tools and separate Standards/Spec reviews. Update, review and import canonical knowledge before the next implementation slice.

The full release scope and M0 gates remain unchanged. No main merge or production enablement follows this slice alone.
