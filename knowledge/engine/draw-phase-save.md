# Draw-phase owner recovery

M1.3.5c.2g at game [2da345ba350dbcdada28d8504fcd623a86725bdc](https://github.com/chuongphong12/Sanguosha-vn/blob/2da345ba350dbcdada28d8504fcd623a86725bdc/src/game/hegemony/draw-phase.ts), fixed base 70b9fb9db9472085e4c8bdfa2fcce490550e0993, follows [approved C2](../specs/hegemony-match-v3-save.md). Native authority remains ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. See [live Draw phase](draw-phase.md), [free-chain recovery](free-chain-save.md), [drawing](card-drawing.md) and [checkpoint](../reviews/2026-11-16-hegemony-m135c2g-draw-phase-save.md).

## Captured cursor contract

The actual draw-phase operation supplies save/result hooks. Its immutable rule input captures a known original target; own prompt/answer/cleanup reject. Initial null state has no queued/result children and is preflighted through phaseInput. Resumed state has exactly stage/target/shared/count, stages1 through6 and the same original target. Stages1/2 retain count0. Stage1 shared must be an int32 initial count reachable from 2+3*Jieyue: shared-2 is int32 and divisible by3. Decoding never recomputes the live phase, mark or FirstRound flags after effects.

Stage2 deliberately preserves arbitrary JSON shared state returned from DrawNCards. The live owner validates it only after the first free-chain. This preserves real earlier effects before the native late invalid-count fault; a structurally readable snapshot does not promise future successful gameplay. Stages3 through6 require signed int32 count equal to shared; stage3 also requires positive count.

Stages1/5 require queued/completed DrawNCards/AfterDrawNCards with the captured target; event data may have been rewritten. Stages2/4/6 require a free-chain child with null input. Stage3 requires exact draw-cards input: one target, one captured count and empty reason, without extra direction. Event/operation result slots must match; absent children are accepted only for actual abandoned unwind frames. Own retained result is null. Result validation parses immutable rule input without rechecking historical live phase/marks/flags.

## Composition and limits

[44 new cases](https://github.com/chuongphong12/Sanguosha-vn/blob/2da345ba350dbcdada28d8504fcd623a86725bdc/tests/hegemony/draw-phase-save.test.ts) compose actual Draw owner, free-chain, draw-cards/get-n-cards/draw-card, movement and kill-player through JSON/read/resume. Swap-pile and game-over are registered as dependencies; these44 cases do not exercise pile exhaustion or terminal game results. Event observers, owner, queue predicates, kill-validator and companion/maxHP policies remain fixtures. Three drains are observed with explicit fixture marks; their firstshow3 instrumentation is not a native firstshow eligibility claim.

Cases cover budgets1/2/7/10000, event and movement/reveal prompts, signed/nonpositive counts, phase/mark/flag changes after capture, surrender death before hand transfer, AfterDrawNCards rewrites, late invalid count after an earlier reward, interruptions and malformed cursors/children/results. Baseline95/3, finalfocused174/5, full2977/112; typecheck/build pass, lint0 errors/42 prior warnings. Source Standards0/Spec0; Spec independently ran64 Draw-phase cases. All pre-existing run/validate/unwind callback AST and the complete emitted scheduler remain equal to base.

The standalone createDrawPhaseRule uses a separate GameRule bridge without a skill codec; coverage rejection is tested explicitly. This checkpoint does not add its codec or modify the common bridge. Composed profiles must retain a single shared Proceeding bridge, without also registering the standalone Draw rule. Remaining startup/battle/bridge coverage, aggregate Room/configuration/root decoding, public match v3 and all release gates remain open. This advances Group1; it does not complete Group1 or enable production. PR33 stays draft.

## Later shared GameRule bridge recovery

The [M1.3.5c.2h contract](game-rule-save.md) adds pure bridge skill validation and closes a forged candidate-target replay gap. Earlier missing-bridge claims apply to their pinned revision; complete owner/profile/Room/public-v3 and release gates remain separate. Keep one shared Proceeding bridge in composed profiles.
