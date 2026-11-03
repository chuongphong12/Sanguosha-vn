# Play phase activation and rejected Room attempts

Inspected game [1f5a99747619dd78f2f5ed15906c13df4747b798](https://github.com/chuongphong12/Sanguosha-vn/commit/1f5a99747619dd78f2f5ed15906c13df4747b798) under [accepted B checkpoint4](../specs/hegemony-turn-unwind.md). [Play owner](https://github.com/chuongphong12/Sanguosha-vn/blob/1f5a99747619dd78f2f5ed15906c13df4747b798/src/game/hegemony/play-phase.ts), [admission](https://github.com/chuongphong12/Sanguosha-vn/blob/1f5a99747619dd78f2f5ed15906c13df4747b798/src/game/hegemony/card-command.ts) and [public-seam tests](https://github.com/chuongphong12/Sanguosha-vn/blob/1f5a99747619dd78f2f5ed15906c13df4747b798/tests/hegemony/play-phase.test.ts) implement M1.3.4b.2 as a library slice. [Checkpoint](../reviews/2026-11-03-hegemony-m134b2-play-phase.md) owns actual executions and review/graph limits. Discard, match-v3 and production/full-match gates remain pending.

## One Room and one command gateway

Register createPlayPhaseOperation as play-phase alongside the [single Proceeding bridge](phase-bodies.md), actual card-use-request, room-use-card and free-chain. Replace the standalone Draw rule when composing the bridge; do not register both rules. No current application, M0 or production registry is changed. Missing admission/free-chain fails explicitly, retaining any eager effects already committed.

The trusted operation accepts the same target/data envelope as the other bodies; null target is empty. PlayPhaseGame intersects the existing Room/general/phase state with CardCommandGame. The active command profile requires currentPlayer to be a string; an idle/null-current aggregate match must narrow or establish that authority before using this profile. The operation is not a public player command.

Following [GameRule Play](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L208-L223) and [Room::activate](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L6155-L6228), each iteration checks alive, asks the pendingSurrender adapter for any required child, consumes Global_PlayPhaseTerminated (preserving other flags), checks current phase Play, then emits the pushPile broadcast through the notification adapter. [addPlayerHistory with null player](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2179-L2197) broadcasts only: no actor ledger is incremented for pushPile. Dead actors stop before surrender/flag handling; a living termination flag is consumed before the phase gate.

The owner captures the context adapter's current epoch after notification and invokes actual card-use-request with reason play, empty pattern, method use, addHistory=true, canCancel=true and returnOnRoomFailure=true. Admission alone emits PlayCard and ChoiceMade and calls Room. There is no second wrapper call or duplicate event in the phase owner. Existing web eligibility/material/target revalidation remains stronger than native transport acceptance; do not bypass admission.submit for player card choices.

## Attempt result and free-chain

The new optional request boolean returnOnRoomFailure is accepted only for Play. When true, Room false returns private status rejected instead of refreshing the request internally. The owner treats used and rejected alike for actual free-chain, then begins a fresh activation, including a fresh pushPile and PlayCard. This preserves eager validation effects and allows reveal rewards to drain even when Room refused the card. Wrapper false spends no successful-use history/material by itself. Native useCard's boolean does not skip GameRule's freeChain.

Absent/false leaves the existing Room-false retry behavior intact, including existing response-use consumers. Response-use cannot opt into this Play policy. Cancelled, invalidated and unavailable end the enclosing body without a per-attempt free-chain. Normal phase lifecycle still supplies its own existing free-chain/End boundaries. Ending the current phase after a completed card does not undo that card's effects or its free-chain tail.

## Persistence, privacy and limits

The saved cursor keeps target and the advanced stage before every child. Existing scheduler JSON continuation and cooperative work budgets preserve notifications, accepted use, movement/history and free-chain at most once. Interruption freezes first; trusted opt-in unwind abandons the loop rather than restarting activation. Core protected card-use cleanup remains separately owned by its registered handlers; this slice's interruption tests throw at PlayCard, not a newly demonstrated full protected-use cleanup path.

Player replies use the actor-bound admission view/submit interface. Wrong actors, stale IDs, unoffered choices and forged reply fields do not progress the request. Nested fixture prompts use scheduler resume only for their own actor/choices; that is not permission to expose raw scheduler resume to a client. Public choices omit private descriptors, offer identities and context ledgers.

| Real implementation exercised | Explicit adapter or fixture | Still pending |
| --- | --- | --- |
| Phase execute/Proceeding, admission, Room, onUse, CardUsed/CardFinished, card-use, movement, free-chain/reveal reward | Context epoch, authentication, package catalogue/availability/target/material/validation/onUse/after/effect, pending-surrender handoff and notifications | Complete package policy/damage within this new composition, surrender transport/decision owner, service pause/timeout, match-v3 routing/restore, online/UI/production |

The test card supplies an implied recipient and a trace/reveal-mark effect; it is not a ported package or damage proof. The surrender fixture only proves ordering/handoff, not full surrender behavior. No native executable, setup-to-terminal match, hosted provider, new browser or bot-policy benchmark was run. All broader [release gates](../plans/hegemony-release.md) stay open.
