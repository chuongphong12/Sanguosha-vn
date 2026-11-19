# Opt-in RoundStart owner recovery

M1.3.5c.2j at game [590c161c2d540f87abd1e1319c2f49fc805f6c80](https://github.com/chuongphong12/Sanguosha-vn/blob/590c161c2d540f87abd1e1319c2f49fc805f6c80/src/game/hegemony/phase-bodies.ts), fixed base a39b50b5201bd5c1f98988f69cf15f82dfb65534, follows [approved C2](../specs/hegemony-match-v3-save.md). Native authority remains ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. See [phase bodies](phase-bodies.md), [Proceeding recovery](phase-proceeding-save.md) and [checkpoint](../reviews/2026-11-19-hegemony-m135c2j-round-start-save.md).

## Captured request decision

PhaseBodyRules.saveRoundStart:true is captured at construction, independently of saveProceeding. It enables pure save/result hooks only for round-start-phase and replaces its post-request true cursor with exactly {change:boolean}. A profile must version this opt-in and trusted policy semantics. Default callers retain boolean cursors/no hooks and live JSON continuation; no old-profile migration or production registration is implied.

The live owner still computes change from HaventShowGeneral>0 and Global_RoundCount===1, then requests ask-general-show with original target, reason GameRule_AskForGeneralShow and that captured boolean. Decoder reads never recalculate the decision from current marks or phase, resolve cards or invoke nullified adapters. An unstarted frame remains structurally readable with a future invalid mark; the existing live integer check still faults only when execution reaches it. Aggregate Room validation remains separate.

Input uses unchanged ruleInput with original known target or null and ignored inner payload. Own prompt/answer/event result/cleanup reject. A null cursor cannot have queued/retained children. A resumed cursor has exactly one boolean change field and requires nonnull input target. Its queued/retained operation must be ask-general-show, with exactly the three original target/fixed reason/captured change fields. Missing children are accepted only during actual abandonment. Retained RoundStart results must be null. The acquisition child's boolean remains ignored by the live owner, which returns null after either true or false.

## Evidence and limits

[34 new cases](https://github.com/chuongphong12/Sanguosha-vn/blob/590c161c2d540f87abd1e1319c2f49fc805f6c80/tests/hegemony/round-start-save.test.ts) compose actual shared GameRule → Proceeding → RoundStart with JSON/read/resume at budgets1/2/7/10000. The ask-general-show operation in this test profile is an explicitly labeled acquisition fixture: it records the request, prompts its target with ack, and returns a boolean or interrupts. These tests do not implement or validate actual ChoiceMade, show-general, lord conversion or reveal notification recovery. Prompt target propagation and unwind are exercised through this fixture, not through a public match admission/router.

Cases cover native literal mark vectors, captured true/false after mark/phase mutation, another seat as request target, retained child request/result checks, null-target completion, malformed cursors/children/results, nested prompt/abandonment, standalone RoundStart opt-in, legacy JSON continuation and explicit rejection of missing Judge codec coverage.

Baseline70/2, finalfocused104/3, full3076/115; typecheck/build pass; lint0 errors/42 prior warnings. Source Standards0/Spec0 at 7503c9dc946aaa2be33cdea7eb9389da91940654; Spec independently ran104/104 related cases. Existing callbacks match base after folding saveRoundStart=false, including unchanged existing Proceeding behavior; the opt-in request metadata intentionally differs. The complete emitted scheduler interpreter is unchanged.

Actual acquisition/reveal/lord/notification codecs, Judge/remaining phase/startup/battle owners, aggregate Room/configuration/root decoding, public match v3 and full-match/release gates remain open. Keep one shared Proceeding bridge. This advances Group1 without completing it; PR33 remains draft and no main merge/cutover occurs.
