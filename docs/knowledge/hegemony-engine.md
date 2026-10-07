# Hegemony engine knowledge

Baseline: QSanguosha-QuocChien 2.3.43-beta2, ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. Scope decisions and acceptance gates are in `docs/superpowers/specs/2026-10-07-hegemony-engine-design.md`.

## Paired setup boundary

`src/game/hegemony/index.ts` exports createHegemonySetup, selectGeneralPair and projectHegemonyState. It has no runtime import from the old engine, no Identity roles, and no production registration yet. The adapter will provide normalized definitions and dealt offers later.

Flow: create isolated catalog/offers → validate pair without mutation → assign two private slots, initial kingdom and combined HP → ready after all players choose → explicit player-specific projection.

Native evidence:

- `src/core/general.cpp:136`: compareKingdomsWith is directional. Careerist cannot be deputy; a careerist head matches deputy kingdoms; normal pairs use the intersection.
- `src/server/serverplayer.cpp:1324`: max HP is integer division of head contribution + deputy contribution by two. Definitions contain already-adjusted slot contributions.
- `src/server/room.cpp:3694`: paired selection is followed by initial kingdom selection and hidden identity setup. The new boundary combines the pair and unambiguous/explicit kingdom choice atomically; adapter/UI dealing and timeout/default policy are deferred.

Only owners receive private slot IDs and candidates. Spectators and unknown viewer IDs receive redacted views. Projection excludes the private catalog, bans and initialKingdom; objects/arrays do not alias authoritative state. JSON reload preserves pending selection.

## Part 1 checkpoint — 2026-10-07

- Red/green focused tests: 24 paired setup, atomic rejection, malformed payload, careerist/double kingdoms, HP, privacy/copy and reload cases.
- Full check: 41 files, 311 tests passed; typecheck and lint passed, 42 inherited lint warnings.
- Production build passed. No runtime adapter changed, so this is not an E2E proof of playable Hegemony.
- GitNexus rebuilt: 2,776 nodes / 9,658 edges / 237 flows. CodeGraph rebuilt: 183 files / 1,681 nodes / 7,042 edges.
- Structured staged detect_changes: 80 changed indexed symbols, six files, low risk, no reported partial/truncated response. CodeGraph affected-test query identified setup.test.ts. Tests and type metadata contribute to the symbol count.
- Global process extraction still reports omitted entry points/callees/flows. The targeted setup seam is supplemented with CodeGraph and verified source/imports; no claim that the whole repository graph is complete.
- Standards review: zero actionable findings. Spec review: zero actionable findings.

## Next seam

Reveal/hide and current/future friendship use native showGeneral/hideGeneral/isFriendWith/willBeFriendWith. Domain transitions must be distinguished from GeneralShown/GeneralHidden skill dispatch until the scheduler is connected. Native hide/re-reveal kingdom behavior needs precise source verification; do not assume it restores the original faction.

All later pipelines, skills/content manifests, UI/AI/transport migration and Standard 2013 retirement remain outstanding.
