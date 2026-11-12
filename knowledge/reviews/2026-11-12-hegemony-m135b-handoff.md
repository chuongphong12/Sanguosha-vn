# M1.3.5b — Trusted startup-to-battle handoff

Date:2026-11-12. Source 1cf3b03c53b54e4b74fc8bf85c52be884fccc122, fixed game base d20092745fa4e3e9e98440dbab1e173b8a2825c1, input knowledge 8906647032b254641add0e01d2d5bdc54e8cc3e0, native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. Exact reviewed source tree fb4f5ead6dedfc0b2a392f00bd03bff6e9c33aa1. [Contract](../engine/match-handoff.md), [accepted B scope](../specs/hegemony-turn-unwind.md). Two new source/test files; no existing kernel, application, scheduler, profile or dependency changed.

## Executed validation and review

Baseline57/57 in existing match/turn-owner suites. Final focused106/106 includes49 new handoff cases. Final full lint/typecheck/test (maxWorkers=2) passed2635/104 with0 errors/42 prior warnings; build passed on the same final source/test bytes. Tests/timeouts were not weakened. Both Standards and Spec source reviews found0 actionable findings at the exact tree above.

Behavioral RED preceded the new handoff. During its implementation, an initial reset overwrote trusted face-down/ledger state; pre-existing data are now preserved. Missing boundary checks initially allowed invalid or repeated transfer; preflight now rejects before committing. Reuse of the startup-global table was caught by RED and fenced. The initial limitation check rejected a valid optional undefined method value; it now matches the real limitation authority. A test fixture offered reveal without registering show-general; selecting it failed with Unknown scheduler operation, then adding the actual show-general owner and explicit package hooks fixed the fixture. These are new-slice/fixture corrections, not evidence of old production defects.

The target ES library lacks Object.hasOwn, so the guard uses the existing hasOwnProperty convention; no TS target/config change occurred. A preliminary shell read ended with an access-violation exit and was retried successfully; it is not a successful validation receipt. No native runtime differential execution is claimed.

## Graph and exact bytes

Pre-edit match factory and turn-owner factory UNKNOWN; Room constructor LOW2, with exact source callers checked. CodeGraph turn-owner factory3 nodes/4 edges before edits. Clean one-worker force/no-parse-cache rebuild completed with13,586 nodes/33,920 edges/292 clusters/494 flows. Final change analysis: medium,126 changed symbols/1 process/2 files, no empty changed IDs and0 empty IDs in3 inspected steps. The reported process is handoffMatchTurn → createPhaseBodyRule → damageRule: it builds declared rule metadata, not an execution of damage gameplay.

The new handoff factory remains UNKNOWN in GitNexus; CodeGraph finds2 nodes/2 edges, and direct source imports currently identify the new test suite only. No absent edge is interpreted as unused or as proof of complete dependency absence. Global extraction omits566 entry candidates and1221 callees, cuts17 walks, leaves42 cross-language property links unresolved, exceeds32 in two older luck-transfer candidate sets, and excludes size-capped inventory/font files.

Source/GitNexus/CodeGraph SHA-256 all match:

- src/game/hegemony/match-handoff.ts: a9638d5e5fbb57ed3f0ab64f02ffd4709c89688a413781b1ef0ddcc4507a0bb9
- tests/hegemony/match-handoff.test.ts: 0261fd04a3952dd26136eb3c3b74c9ccc215c83530058d8284e5692a817451bc

## Scope and publication gates

The tests prove the named internal handoff and first-turn scenarios, including actual startup prompts and physical conservation; they do not implement complete public v3 save/answer/view or setup-to-terminal acceptance. Synthetic policies, injected conditions and unsupported combat/native/provider paths remain explicit in the contract. Source CI, canonical lint/reviews, publication/import/pin and integration-head CI are separate actual checks; future successes are not inferred. [PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33) remains draft; main/production are not switched.

## Final pre-publication receipts

Mechanical lint passed136 Markdown pages/790 relative file links/3 anchors,597 pinned citations/523 line locators/166 local Git objects;0 errors. Registry totals141 sources/15 scoped pages/149 relations preserve all138 previous sources/14 page records/146 relations exactly. These checks establish references and bounded scope, not semantic or native-runtime certification.

[Source CI43172636883](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43172636883) passed both jobs at head1cf3b03c53b54e4b74fc8bf85c52be884fccc122, synthetic mergefd064ce into main3cb751449afcd98748a4cebcc54fd5414e5fbce9. Default CI ran2635/104 with0 lint errors/42 prior warnings and verified preceding knowledge8906647 offline/upstream. Imported-head CI remains separate.

Independent canonical Standards0/Spec0 reviewed the15-file draft at treeea7e30761157d0aaaebd35418d85bd12cb1b9fe7. This receipt-only delta is reviewed before publishing; it does not assert later integration success.
