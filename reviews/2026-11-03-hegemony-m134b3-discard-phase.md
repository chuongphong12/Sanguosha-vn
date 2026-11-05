# M1.3.4b.3 — Discard phase and mandatory hand selection

Date:2026-11-03. Fixed game base48b089bb175e6f0c46315bf4be40b41581c78e1c; inspected [sourced173185cdddd31bab7c16a79158e43020387c6d3](https://github.com/chuongphong12/Sanguosha-vn/commit/d173185cdddd31bab7c16a79158e43020387c6d3); input knowledgee3680115f915d32e32c05358fa4b8e1593ef7d47; nativece4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. [Approved B checkpoint4](../specs/hegemony-turn-unwind.md) continues through [Discard library](../engine/discard-phase.md). Two new operations and two test suites; no existing kernel, profile, application/M0 or dependency change. Full composition, match-v3 and release gates remain pending.

## Executed checks and review

Baseline223/223 in4 existing phase-body/reward/movement/cleanup suites. Behavioral REDs preceded the nonprompted discard, multi-card selection, trusted timeout, token phase, strict own-property request validation, focus notice, restored partial selection, reset without unintended discard and stale source fence. Initial empty import/stub failures are not substituted for behavioral evidence. One test expectation was corrected to existing top-first discard pile ordering; it was a fixture correction, not an engine fix.

Reset initially discarded cards when the actor merely reset a selection after eligibility changed. Standards identified it by source review and the parent independently reproduced it with a RED; the Spec axis also examined it. It now reprompts and requires explicit confirmation. Spec also identified that a deferred movement could otherwise pick up a card from another zone; a budget-one injected invalid mutation established RED, and the operation now pins its source. Revalidation of actor/eligibility at answer consumption protects a manually injected saved-answer condition; normal public resume runs its first step synchronously. None of these tests establishes that arbitrary state writes during yield are allowed or safely handled: the single-writer owner remains an integration requirement.

Final local check passed2546 tests/101 files, typecheck and0 lint errors/42 existing warnings. Build passed with the same production-module bytes before the final test-only addition; final fullcheck covers that addition. Exact reviewed source treece19b182c079de1791d893808df18652e82ec471: Standards and Spec reviews, including final deltas,0 actionable findings. Actual movement/reward-token cost/phase bridge are real; maxCards/isJilei/auth/token choice/focus/notifications are explicit fixtures or adapters. No new browser/provider/native runtime/full-match execution is asserted.

## Graph evidence and bytes

Pre-edit handCount LOW8, addGeneralMark LOW7, shufflePileCards LOW4; generalMark CRITICAL20 and ruleInput CRITICAL49 were warned and reused without modification. GitNexus movement LOW7 but CodeGraph depth2 reached86 nodes/133 edges; createRewardTokenCostOperation UNKNOWN and its source callers were checked. Final one-worker clean rebuild indexed13,260 nodes/32,805 edges/306 clusters/492 flows after the default worker process crashed and the CLI rejected a zero-worker attempt. Whole-slice detect_changes: HIGH,183 changed symbols/14 affected processes/4 files; the parent inspected all54 flow steps, none missing IDs. CodeGraph's phase factory reaches3 nodes/3 edges, admission factory5/6. GitNexus reports UNKNOWN for both new factories; direct source/test searches confirmed bounded present consumers, not complete dependency absence.

Extraction globally omitted560 entry candidates and1,203 callees, cut17 budget walks, and left42 cross-language property links unresolved. Two older luck-transfer callable sets exceeded32; inventory/font files were size-excluded. These limits remain unresolved even though all four source, GitNexus and CodeGraph hashes matched:

| File | SHA-256 |
| --- | --- |
| src/game/hegemony/discard-phase.ts | a7c41c95c4da8e21f638cc15ccdd9f190f28ff391a48a7fe5af35fd4801992e4 |
| src/game/hegemony/rule-discard.ts | a89c12f35f5c798fe18a2c6f2096b4ab71effd66f37a683c0ef11b74e51c4171 |
| tests/hegemony/discard-phase.test.ts | 2c414720de839de711fec2c6acc4d55ae349dc398cf84b12ef9a1d3a4c5dc029 |
| tests/hegemony/rule-discard.test.ts | 8bfd85c3846530a37dcd401ea69515756f512b7a52984dfb6f8b55f3709253f1 |

## Delivery

Source [CI41596777634](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/41596777634) passed both jobs at PR head d173185cdddd31bab7c16a79158e43020387c6d3, synthetic merge c45f8ec into main3cb751449afcd98748a4cebcc54fd5414e5fbce9. It ran2,546/101 with0 lint errors/42 old warnings and verified preceding knowledge e368011 offline/upstream. Canonical lint/reviews and later imported-head CI remain separate checks. [PR33](https://github.com/chuongphong12/Sanguosha-vn/pull/33) remains draft; this checkpoint is not a production switch or a complete match. Next integrate the bounded phase/turn profile and M1.3.5 match-v3, then address the full approved content/session/bot/media/load/cutover gates.

Mechanical lint completed with130 Markdown pages,741 relative file links,3 heading anchors,589 pinned citations,522 line locators and159 local Git objects;0 errors. Registry totals133 sources/12 scoped pages/141 relations preserve all123 prior sources/11 page records/131 relations exactly. These checks establish reference existence and bounded scope, not semantic or native-runtime certification.

Independent canonical Standards and Spec reviews found0 actionable findings after correcting the native forceToDiscard overload locator, review attribution and coverage metadata (reviewed metadata tree6226750d58391a949544bfbc136c122cee116479). This final receipt-only delta is reviewed before publication. Integration-head CI remains a later, separate check.
