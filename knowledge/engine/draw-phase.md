# Draw-phase owner

Approved Part 4ad B adds the normalized Draw-phase body and its priority-zero
EventPhaseProceeding GameRule bridge. See [spec #23](https://github.com/chuongphong12/Sanguosha-vn/issues/23),
[native research](../research/2026-10-21-card-drawing.md) and
[actual batch/player drawing](card-drawing.md).

Private `playerPhases` is current phase authority. Only exact `draw` is handled;
other string phases return without draw work. The existing shared GameRule bridge
consumes SkipGameRule before its null-target guard. This is not a full phase
scheduler or a substitute for ServerPlayer executePhaseEvent's start/end gates.

At entry, compute 2 + 3 * JieyueExtraDraw, with signed int32 checks for both product
and sum instead of reproducing C++ overflow. Remove the player's Global_FirstRound
flag before emitting DrawNCards with that count. Ignore event consumption as an
owner cancellation gate, but preserve the final rewritten event data.

Run actual free-chain, then decode/capture the rewritten integer. If positive,
invoke actual draw-cards for that one player with the native empty reason. Run
actual free-chain again, emit AfterDrawNCards with the captured count even if zero,
negative or no hand transfer occurred, then run actual free-chain a third time.
After-event data changes do not change the captured count or cancel the final drain.

No extra alive or removed guard is added to the phase owner. DrawCards independently
applies its alive gate, so a surrender death during the first drain can prevent
transfer while AfterDrawNCards still reports the captured positive count.

The registry uses the actual free-chain owner, including queued GeneralShowed,
reward grants and real kill-player composition. Package eligibility/general
metadata and event-producing test skills remain explicit adapters, not a claim
that every reveal/surrender package or the full death/victory product is enabled.
Invalid rewritten counts reject after earlier eager flag/reward effects; interrupts
freeze those effects/frames under the existing scheduler policy. JSON continuations
retain the captured count and stage, preventing duplicate draws/reward grants.

The separate [GameStart](game-start.md) and [luck-card owners](luck-cards.md) supply initial drawing. Full phase/turn progression, movement transport,
whole enabled content, native unwind and production registration remain separate.
