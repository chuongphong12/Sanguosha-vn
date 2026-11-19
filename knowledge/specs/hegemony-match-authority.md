# M1.1 — One internal match authority

Approved 2026-10-27: the user selected approach A, one authoritative state and a one-time setup-to-Room handoff, and authorized internal M1.1 implementation while M0 remains open. The approved [release scope](../plans/hegemony-release.md) is unchanged. This is the bounded first integration slice, not approval of a reduced external release or every subsequent M1 implementation ticket.

## Problem and choice

Paired setup previously ended at ready, while the M0 prototype independently initialized a fixed battle. Neither composed the application from selection into its normalized Room. Keeping both setup and battle models writable would require synchronizing HP, life, general identity/exposure, faction changes and recovery at every mutation.

Use one private versioned aggregate. Before handoff it owns setup and the server-supplied deck. The last valid pair selection consumes these into one Room plus scheduler. After handoff, HP/life/identity/cards/result and actor projection use that Room. Old setup identity helpers cannot independently mutate the battle.

## Interface and invariants

- The application-facing module provides create, apply, view and restore. Callers bind the authenticated actor; command input cannot set arbitrary HP/phase/identity/card descriptors. Network admission, durable storage and receipts remain separate integration work.
- Existing paired selection enforces offers, pair legality and uniqueness. Startup happens once on the transition out of setup; invalid, repeated or stale replies cannot redeal the current match.
- Compose actual global GameStart/drawing/movement and configured luck operations. Catalogue, package predicates, ordered initial deck, presentation timing and trusted luck collection are explicit authorities, with internal fixtures labelled.
- Persist schema/rules/content/registry identities and exact startup configuration. Registry code stays external. Incompatible saves/configurations fail explicitly; neither response-v4 scratch saves nor Standard saves are silently interpreted as this match.
- Commands operate on a cloned candidate. Caller-visible input is retained on rejection/error; accepted scheduler state can be serialized at a prompt and resumed. Native interruptions retain their eager state and frames; this slice does not invent cleanup or rollback.
- Actor views allow only valid public facts and that actor's hand/choices/marks/private startup notices. Raw Room/scheduler/tags/deck and other actors' hidden information stay private. Presentation fields are rebuilt from an allowlist.

## Acceptance

1. Source-derived setup-to-Room HP, identity, initial hidden names and marks are exact, including actual-lord and companion distinctions. No independently writable setup remains after handoff.
2. Validate configured seat counts2–10. Synthetic internal catalogues do not establish a frozen release roster.
3. Actual startup supports suspend → JSON restore → resume without repeating costs/dealing. Exercise accepted and declined luck through actual return/shuffle/redeal behavior where configured.
4. Privacy holds before/after handoff, during pending startup and restore. Post-handoff projection reads current Room facts.
5. Schema/rules/content/registry/configuration mismatch is rejected. No prototype migration is implied.
6. Full turn, production registration, complete content and release readiness remain unclaimed.

Execution and independent reviews are recorded in [the checkpoint](../reviews/2026-10-27-hegemony-m1-match-authority.md); [the compiled contract](../engine/match-authority.md) describes resulting behavior.

## Next dependency

Full RoomThread initial-winner/per-player startup, native phase/turn ownership, phase bodies and interruption cleanup require subsequent scoped implementation. Then connect complete matches to the real session/Pixi consumers and finish content/bot/media/provider/load/cutover acceptance. M0 measurement and decision gates remain open; this internal work does not waive them.
