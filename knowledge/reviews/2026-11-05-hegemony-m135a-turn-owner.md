# M1.3.5a — Trusted turn owner

Date:2026-11-05. Game 46025ce4653373ecbe3f796bd96093a56c0ee358, fixed base 9235157e2c9ae64d73fe9cc679f8ee9f6cbec605, input knowledge 18bac319cffc7964297a7b0ee3c4cf7a22d23206, native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. Exact reviewed tree c8c3f21ee79a39ee5c3bf9df5b9a2f1ac48d0dd0. [Contract](../engine/match-turn.md), [accepted design](../specs/hegemony-turn-unwind.md). Four source/test paths only: one new owner, one new test suite and a test-fixture extraction. No old kernel/profile/scheduler/dependency changed.

## Validation and reviews

Baseline79/79 in match/composed-turn/turn-root suites. Behavioral RED preceded owner dispatch, yield continuation, unwind classification, profile/saved-boundary rejection and strict completion values. A real budget-one empty-stack unwind checkpoint initially failed the new validator; allowing the persisted finalization boundary fixed it. These are defects found while developing the new owner, not claims of older production defects.

Final focused40/40 includes27 new cases and13 preserved composed-turn cases. Full lint/typecheck/test with maxWorkers=2 passed2586/103,0 errors/42 existing warnings. No timeout or assertion was weakened. A preceding default-worker run passed2584 before the final two rejection tests; another default run under concurrent build/index timed out8 tests across5 old/new suites. The bounded-worker run supersedes that failed local attempt for validation. Source CI and later integration CI remain separate actual receipts. Build passed on the final owner/test-body bytes before only an unused shared-fixture import was removed; the final bounded fullcheck covers that import cleanup.

Standards0/Spec0 after all deltas at c8c3f21ee79a39ee5c3bf9df5b9a2f1ac48d0dd0. Spec/parent found that rejected trusted scheduler continuation returned false like an actor pause; two saved-inner-operation REDs for yield/interruption established the issue. requireProgress now throws on rejected dispatch/continue/unwind, preserving candidates on these rejections. All prior13 test bodies and extracted fixture bodies were checked byte-for-byte after exports/line-ending normalization.

## Graph and source boundaries

Pre-edit match factory UNKNOWN, startup factory LOW1; CodeGraph match factory3 nodes/3 edges. Extracted test functions UNKNOWN, with direct local callers confirmed. Force/no-parse-cache one-worker rebuild was used; an earlier worker startup crash recovered on its self-heal attempt. Final graph reports medium,145 changed symbols/3 processes/4 files; 22 process steps inspected, no empty IDs. New owner factory UNKNOWN remains unresolved; CodeGraph finds3 nodes/4 edges through the new test fixture only.

Reported Command/Move/Pulse paths join M0 property calls to match.view/compatible and the new validate. Source inspection shows M0 battlePrompt uses admission.view and match.ts binds its owner to createMatchStartup; neither imports match-turn. These graph candidates are ambiguous property-name links, not evidence that M0 now executes the new owner. Direct imports of createMatchTurn are currently confined to its test suite. No absent edge is treated as proof of complete dependency absence.

Global limits: 564 entry candidates and1207 callees omitted,17 walks cut;42 cross-language property links unresolved, two older luck-transfer candidate sets exceed32 and inventory/font files are size-excluded. Final source/GitNexus/CodeGraph SHA-256 agree for all four files:

- src/game/hegemony/match-turn.ts: c710a198067fe69252e53d82f7169478b57ebb9d75c447eadb43243a80d7abd3
- tests/hegemony/match-turn.test.ts: 27fab4fcd12afabf680218e060f7254ba9b414dbc7d9c5172fb0b732b800f1df
- tests/hegemony/composed-turn-support.ts: 53a590992a750fce43533f82bda8fd247721fde61417837f3a7bcc1a0b81ea81
- tests/hegemony/composed-turn.test.ts: 8890f7cbe9d81fcf146f6bd8ece1ce1471e31d8a517127860e9a174f43e3991f

## Delivery and open gates

Synthetic package/decision/auth/presentation policies, three seats and injected invalid-save cases remain explicit. A synthetic package calls real game-over; there is no combat-to-winner/full-match proof. Native executable, browser and hosted provider were not run. Canonical lint/reviews, source CI, publication/import/pin and integration-head CI are recorded separately before their respective gates. [PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33) stays draft; M1.3.5 is incomplete until public application handoff/routing/restore/projection and actual setup-to-terminal scenarios pass.

## Final pre-publication receipts

Mechanical lint passed134 Markdown pages/772 relative file links/3 heading anchors,594 pinned citations/522 line locators/164 local Git objects;0 errors. Registry totals138 sources/14 scoped pages/146 relations preserve all134 previous sources/13 page records/142 relations exactly. These are reference/scope checks, not semantic or native-runtime certification.

[Source CI41966055210](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/41966055210) passed both jobs with its default check configuration at head46025ce4653373ecbe3f796bd96093a56c0ee358, synthetic merge2ef0f84 into main3cb751449afcd98748a4cebcc54fd5414e5fbce9. It ran2586/103 with0 lint errors/42 prior warnings and verified preceding knowledge18bac319 offline/upstream. Imported-head CI remains a later separate check.

Canonical full review at tree5ac45788443cba90b7b228eb44ed4bb212852ce7 found one Standards wording error and0 Spec findings. The contract now states explicitly that Room cleanup applies to TurnBroken/StageChange and GameFinished skips it. The correction at tree13c5f44fe3ae75d6a08e891e44a9e277f0858d85 and this receipt-only delta are reviewed before publication; future integration success is not inferred.
