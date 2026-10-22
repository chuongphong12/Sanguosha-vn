# Global GameRule GameStart

The approved [Part 4ae specification](../specs/hegemony-part4ae-game-start.md) adds the global GameRule startup body; [native research](../research/2026-10-22-game-start.md) distinguishes it from Room/RoomThread setup and per-player package startup.

The dedicated priority-zero bridge consumes SkipGameRule before target handling. Only null-target GameStart runs the owner. The older nonnull-target GameRule helper remains unchanged. Startup uses optional lightbox and private next-alive deputy notices, delay, player-level visible Limited skill initialization, room FirstRound, actual initial drawing and optional luck-card invocation in native order.

Current general initialization is a precondition, not a missing-general skip. Trusted metadata supplies the player's current head/deputy/acquired visible non-equipment skill list and lord-skill eligibility. The owner gates Limited/nonempty limit mark, sends owner-only mark notice, then writes 1. Duplicate qualifying entries are not deduplicated. Per-player marks use the existing authoritative general mark table.

Private deputy viewing removes the first tagged general name from the next alive player's private list and delivers the remainder only to the designated viewer. This does not show a general publicly or synchronize a complete persistent battle knowledge model. Catalogue, next-alive authority, settings and notice/delay delivery are explicit trusted adapters; fixture payloads remain inside private frames and are not public player projections.

FirstRound is a room tag, distinct from the player's Global_FirstRound flag. Normal initial drawing delegates to actual draw-cards with raw registration order, count four and empty reason. custom_scenario suppresses the conditional deputy view and default draw, while retaining other initialization and positive-limit luck invocation. No DrawNCards/AfterDrawNCards or free-chain is added.

Continuations capture per-viewer names, per-player skill lists, pending mark commits and the current startup stage. Resume does not repeat prior notices, mark commits or drawing. A separately dispatched fresh GameStart follows native behavior again; there is no new idempotency gate. Earlier eager effects survive interruption and later acquisition failure.

The global owner composes the [actual luck-card state and transfer owner](luck-cards.md) when its configured limitation is positive, including in custom scenarios. Public dispatch/resume exercises that composition with real draw/acquisition/movement/terminal operations. Whole RoomThread startup, dynamic package discovery, paired-setup synchronization, actual network/private delivery, full turns and production remain separate.
