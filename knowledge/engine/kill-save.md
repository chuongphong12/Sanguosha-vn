# Actual kill-player recovery

M1.3.5c.2e, game [9bb63cf979f7f21060c8f23225d0bf6657399c96](https://github.com/chuongphong12/Sanguosha-vn/blob/9bb63cf979f7f21060c8f23225d0bf6657399c96/src/game/hegemony/death.ts), fixed base 5a4ab37871eede44877705c604a277d10d24b535; native authority ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. This is the next dependency under [approved C2](../specs/hegemony-match-v3-save.md), before free-chain and Draw-phase recovery. See [live death contract](death-and-careerist.md) and [checkpoint](../reviews/2026-11-16-hegemony-m135c2e-kill-save.md).

## Save contract

The actual kill-player factory now exposes save/result hooks. Null unstarted work validates its normal preflight without executing eager changes. Resumed states and results parse only the immutable original target/damage request; they do not re-run living-list/index/seat-underflow preflight against an already modified world. The request parser is factored from killInput while the complete runKill state-machine AST is unchanged.

Cursor stage/target/shared/players/index has exactly five keys. Original target remains bound to the request. Captured players must be known, unique and a cyclic ordered subset of registration order; empty rosters and original victims absent from a repeated-dead call are valid. Current alive/current-player authority cannot replace that historical snapshot. Before/hp/judge require index0; death uses index1..length; finished index0 means BuryVictim, later indices mean DeathFinished at the last visited captured seat. Runtime eligibility may skip currently dead recipients; saved progress identifies the emitted child, not a replayed liveness decision.

The initial Before shared payload matches original {who,damage}, independent of JSON object-key order. Later shared JSON may be rewritten by events; HpChanged rewrites remain ignored by the existing owner. Expected queued/completed event names and targets bind to the cursor stage/index. Direct prompt/answer/operation-child/cleanup state rejects; prompts of nested skills belong to their codecs. A missing event child is allowed only for genuinely abandoned unwind work. Return values must be null.

Validation does not enforce that a revived victim remains dead/HP0, that skills stay empty after BuryVictim callbacks, or that physical damage-card ownership stays at its earlier location. Existing damage syntax validation is reused. Aggregate Room/configuration/root binding and historical authenticity remain separate requirements; this does not certify every enabled death package.

## Evidence and limits

[35 new cases](https://github.com/chuongphong12/Sanguosha-vn/blob/9bb63cf979f7f21060c8f23225d0bf6657399c96/tests/hegemony/kill-save.test.ts) use actual kill-player/scheduler/game-over work through JSON/read/continue/resume/unwind at budgets1/2/7/10000. They cover all six event prompts, eager seat/HP/acquired-skill changes once, Before payload and HpChanged rewrite handling, nested actual kills, revival and acquired skills added by BuryVictim fixture callbacks, null-current ordering, empty/repeated-dead rosters, signed seat minimum, normalized card-null damage and corrupt cursor/input/child/result states. Observer/owner/event policies are fixtures. A fixture maps GameOverJudge to actual game-over('wei'); this proves terminal interruption, not native faction winner selection.

The fixture does not register actual death GameRule/bury/reward handlers: flags/history remaining untouched is a statement about kill-player alone. Physical damage-card/combat-to-terminal, burial, free-chain, phase/startup/battle registries and whole Room/public-v3/release integration remain pending. Shared scheduler interpreter is unchanged; PR33 stays draft.
