# Quốc Chiến architecture and integration boundary

This page describes the game source baseline recorded in [source-baseline.json](../source-baseline.json). Code paths below belong to that game checkout, not this knowledge repository. The target is Quốc Chiến against the [pinned native authority](../rules/source-authority.md); the production application has not completed that migration.

## Stack that remains useful

| Layer                | Verified implementation at the source baseline                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Language and tooling | TypeScript, ES modules, Node 22; `package.json`, `tsconfig.json`                                                            |
| Rendering            | PixiJS 8, shared navigation/audio/resize utilities under `src/engine/`, application screens and components under `src/app/` |
| Match transport      | boardgame.io 0.50.2; `src/client/MatchClient.ts` selects local or Socket.IO transport                                       |
| Server               | `server/server.ts` creates a boardgame.io server                                                                            |
| Build and assets     | Vite, AssetPack and `scripts/cache-assets.mjs`; see [asset provenance](../assets/provenance.md)                             |
| Verification         | Vitest rule/integration suites and Playwright browser infrastructure; configured in `package.json`                          |

The rendering shell and transport are reusable infrastructure. Existing Standard catalogues, roles, legal-action generation and skill controls are not Quốc Chiến contracts merely because the infrastructure can display them.

## Runtime truth

`server/server.ts` still registers `TqsGame`. `src/client/MatchClient.ts` uses the same game in both remote and local clients, including its bot setup. `src/game/TqsGame.ts` still names it `tam-quoc-sat-standard-2013` and imports the legacy setup, card engine and skill registry. These paths document unfinished cutover; Standard is not the target rules authority.

The separate `src/game/hegemony/` library contains paired setup, identity and normalized resumable gameplay operations. `HegemonyState` in `types.ts` ends at `selecting-generals | ready`; `index.ts` explicitly defines `ready` as paired setup, not a playable match. The richer operation-specific game interfaces are not one registered boardgame.io game state. Production must establish coherent authority between them rather than serialize fixture objects directly to clients.

## Internal rules execution

`src/game/hegemony/scheduler.ts` separates native trigger events from internal operations. Its public library seam consists of scheduler creation, operation/event dispatch, viewer-specific prompt retrieval and prompt resume. Registries hold executable skill/operation handlers outside persisted state; frames, continuations and shared event data contain JSON values. Registry versions must match the saved scheduler version.

Operations compose movement, card-use resources and dispatch, cancellation/Nullification, Slash responses, damage/recovery/rescue, death/burial/victory, general reveal/hide, relationships, careerist recruitment and reward-token methods. Part 4y adds a separate [SkillCard onUse envelope](skill-card-on-use.md); Part 4z composes it with actual [shared execution](skill-card-execution.md), retaining transport/package/reference authorities. These are normalized contracts with supplied package and transport adapters, not a complete selectable native card/general catalogue.

The scheduler validates responder, prompt ID, frame identity, offered choices and registry version before accepting a reply; order prompts additionally refresh occurrence eligibility. Existing regression examples are in `tests/hegemony/scheduler.test.ts` and `tests/hegemony/reward-tokens.test.ts`. This library protection does not establish authentication or replay safety for a future network adapter without integration tests.

Completed child operations and eager mutations are not globally rolled back when a later invariant fails. Interruptions currently freeze frames; operation-specific exception unwind and native cleanup must be completed and tested before claiming uninterrupted/aborted-match parity. An event's consumed return is interpreted by its caller; it is not automatically a whole-game cancellation.

## Privacy and UI boundary

`projectHegemonyState` in `src/game/hegemony/index.ts` hides other players' candidates and unshown slot IDs, hides unrevealed kingdom/alliance and omits other players' `initialKingdom`. `getTriggerPrompt` returns a cloned prompt only to its expected responder. Neither function is a full production battle projection today.

Future UI and bots must consume authoritative legal choices and player-specific projections. Hidden names, head/deputy identity, kingdom/alliance, card zones, scheduler frames and private notifications must not escape through asset aliases, thumbnails, tooltips, accessibility labels or logs. A native reference feature is eligible for a web control only after the corresponding state/action/prompt contract is enabled and projected safely.

## Production gates

The [port plan](../plans/hegemony-port.md) tracks work remaining after the normalized foundation. Production registration requires a complete playable slice, deterministic command/response and phase integration, operation cleanup, an explicit enabled-content manifest, player projection, local/online/bot/UI consumers and match-level validation. Remove legacy registration and Identity code only after the replacement passes those gates. Do not reinterpret old Standard matches or saved states as Quốc Chiến.

Test totals and graph metrics belong to revision-labelled checkpoints, not durable architecture. Source-derived fixtures establish only their tested contracts. Native runtime differential testing requires running the pinned reference implementation; unit or legacy browser tests cannot substitute for that evidence.
