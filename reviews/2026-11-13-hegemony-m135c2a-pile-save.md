# M1.3.5c.2a — actual pile save codecs checkpoint

Date: 2026-11-13. Source 87df5894d23d854736fd51fb8fb5a4fe5fe95d7b, fixed base a68e2236795d5b7d50a2b0b0e13af9528f8038d4, reviewed tree eae8ac8bdc04087191b404bfdf95462c9306a221. Knowledge input 5c7f0e1b1783f178c9ec5bfd79306a02ca101287; native ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2 unchanged. [Contract](../engine/pile-save.md), [accepted route](../specs/hegemony-match-v3-save.md).

## Behavior and authority

Four actual handler factories now expose pure save/result codecs. The shared codec supplies detached queued-child/precise abandonment context and accepts the real cleared effect-false checkpoint. Existing run/preflight/unwind callback ASTs in draw-pile/victory are unchanged; complete emitted scheduler interpreter also matches base. Fixtures own notification acknowledgement, nested Fetch and cleanup-owner schemas. There is no complete startup/battle profile or Room decoder, public v3, native executable, browser/network/store/provider/load or playable release proof.

## Executed checks and reviews

Baseline: 139/139 in four existing pile/batch/player/death suites. Final focused 253/253 includes 37 new pile-save cases and 77 preceding shared-decoder cases. Full lint/typecheck/test with maxWorkers=2 passed 2749/106; lint 0 errors/42 prior warnings; build passed. Final source Standards 0/Spec 0 at the exact tree above. No test timeouts/assertions weakened.

Behavioral RED began with actual handlers rejected for missing codec coverage. Subsequent REDs covered queued-child direction/name contradictions, cursor/progress, missing child, silent noticed state, terminal predicates and typed swap counter. Actual nested Fetch reproduced a C1 false rejection at a real effect-false checkpoint, then passed after the localized shared-guard correction. The initial live-cleanup fixture hit a notification before its intended child; providing available draw material fixed the harness. A later mutation deliberately restored overbroad abandonment and failed the intended rejection assertion; exact source bytes were restored and all final checks ran on the reviewed tree. This is distinct from claiming that the earlier fixture failure alone proved the guard bug.

Standards initially 0; Spec identified the silent noticed contradiction and agreed that active cleanup descendants must not be treated as abandoned. Both were corrected with regression coverage, as were deterministic terminal predicates. The final source review axes have no remaining actionable findings.

Runtime preservation receipts:

- draw-pile.ts: all pre-existing run/validate/unwind callback AST; equal SHA-256 00c7a659bae56a3587c21df4d6716ddb776d45cf6525e99a83b09752b9241f39
- victory.ts: all pre-existing run/validate/unwind callback AST; equal SHA-256 0abc730405fc62a086cc052415024ac9f3cec951f2b8b68b9793a759ae432e87
- scheduler.ts: complete emitted interpreter; equal SHA-256 7145efe3bc9cf5d84b314bd063703e01a69b1e07d0a8e9c601fe666eb9f9b2d1

## Graph evidence

Pre-edit actual factories LOW (pile factories7 resolved symbols, terminal factory1); shared OperationHandler/TriggerSkill CRITICAL (93/92 symbols,6/5 processes). Warnings preceded shared-contract edits. Shared codec UNKNOWN was supplemented by source imports/tests. Clean one-worker force/no-parse-cache rebuild: 13,817 / 34,754 / 295 / 491 (nodes / edges / clusters / flows).

Final change summary: {"changed_count":86,"affected_count":0,"changed_files":5,"risk_level":"low"}. Per-result partial/truncated flags are absent; changed/step IDs and affected paths are checked separately. All five source/GitNexus/CodeGraph hashes match:

- src/game/hegemony/draw-pile.ts: 7b2399bbdefd7789df173b5613ce2a565ad85eb5aa01a8dd3bf91cb0794481a4
- src/game/hegemony/victory.ts: 78b02aecb07d5d8d20a1ff2c65dbefe6844f0ffbb09a026e969df6b19a5d679b
- src/game/hegemony/scheduler.ts: 3b906c16f4229380bbaf3efc11c5b441550dded7a540ffc7a26a5ce7398dbc3f
- src/game/hegemony/scheduler-save.ts: e53e93845997fe52a06dde82d78a232c080583f3f913e7e4904e7f38a5510886
- tests/hegemony/pile-save.test.ts: e84108f7816b4b039c9843acf757437ab6abcee3e7817001249a5989d4916393

Global unresolved extraction: 582 omitted entry candidates, 1220 omitted callees, 17 budget-cut walks,42 cross-language property links, two older luck callback sets above cap 32 and size-excluded inventory/font files. No missing edge is a proof of no consumers, and extracted paths are not runtime execution receipts.

## Delivery gates

Canonical lint/reviews/publication/import/pin and source/integration CI are separate actual receipts. Keep PR #33 draft; next are remaining actual profile codecs and aggregate Room/configuration/root decoding, then public v3/routing/projection/combat-to-terminal. No main/production gate closes here.

The final change query reports zero affected processes, so there are no extracted affected steps to inspect. This is not an all-clear: CodeGraph finds 4 decoder nodes / 6 edges, and direct source imports identify both decoder test suites; complete dynamic-consumer coverage remains unresolved.

## Canonical pre-publication receipts

Mechanical lint passed 141 Markdown pages, 832 relative file links, 3 heading anchors, 605 pinned citations, 523 line locators and 174 local Git objects, with 0 errors. Registry totals 149 sources / 17 pages / 157 relations preserve all prior 144 / 16 / 152 records exactly. These checks establish references and bounded source scope, not every semantic or external-endpoint claim.

[Source CI 43371739922](https://github.com/chuongphong12/Sanguosha-vn/actions/runs/43371739922) passed both jobs at head 87df5894d23d854736fd51fb8fb5a4fe5fe95d7b: 2,749 tests / 106 files, typecheck, 0 lint errors / 42 prior warnings, and preceding knowledge 5c7f0e1 offline/upstream. Imported-head CI remains separate.

Independent canonical Standards 0 / Spec 0 reviewed the 15-file draft at tree f37f8c7310a502b731f59e8181296226c9b14fd7. This receipt-only delta is reviewed before publication; later publication/integration success is not inferred here.
