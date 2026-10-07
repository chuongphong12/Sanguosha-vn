# Hegemony engine knowledge

Baseline: QSanguosha-QuocChien 2.3.43-beta2, ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. Scope decisions and acceptance gates are in `docs/superpowers/specs/2026-10-07-hegemony-engine-design.md`.

## Paired setup boundary

`src/game/hegemony/index.ts` exports createHegemonySetup, selectGeneralPair and projectHegemonyState. It has no runtime import from the old engine, no Identity roles, and no production registration yet. The adapter will provide normalized definitions and dealt offers later.

Flow: create isolated catalog/offers → validate pair without mutation → assign two private slots, initial kingdom and combined HP → ready after all players choose → explicit player-specific projection.

Native evidence:

- `src/core/general.cpp:136`: compareKingdomsWith is directional. Careerist cannot be deputy; a careerist head matches deputy kingdoms; normal pairs use the intersection.
- `src/server/serverplayer.cpp:1324`: max HP is integer division of head contribution + deputy contribution by two. Definitions contain already-adjusted slot contributions.
- `src/server/room.cpp:3694`: paired selection is followed by initial kingdom selection and hidden identity setup. The new boundary combines the pair and unambiguous/explicit kingdom choice atomically; adapter/UI dealing and timeout/default policy are deferred.

Only owners receive private slot IDs, candidates and (from Part 2) their initialKingdom for reconnect. Spectators and unknown viewer IDs receive redacted views. Projection excludes the private catalog, bans and opponents' initialKingdom; objects/arrays do not alias authoritative state. JSON reload preserves pending selection.

## Part 1 checkpoint — 2026-10-07

- Red/green focused tests: 24 paired setup, atomic rejection, malformed payload, careerist/double kingdoms, HP, privacy/copy and reload cases.
- Full check: 41 files, 311 tests passed; typecheck and lint passed, 42 inherited lint warnings.
- Production build passed. No runtime adapter changed, so this is not an E2E proof of playable Hegemony.
- GitNexus rebuilt: 2,776 nodes / 9,658 edges / 237 flows. CodeGraph rebuilt: 183 files / 1,681 nodes / 7,042 edges.
- Structured staged detect_changes: 80 changed indexed symbols, six files, low risk, no reported partial/truncated response. CodeGraph affected-test query identified setup.test.ts. Tests and type metadata contribute to the symbol count.
- Global process extraction still reports omitted entry points/callees/flows. The targeted setup seam is supplemented with CodeGraph and verified source/imports; no claim that the whole repository graph is complete.
- Standards review: zero actionable findings. Spec review: zero actionable findings.

## Identity domain boundary

`src/game/hegemony/identity.ts` provides revealHegemonyGeneral, concealHegemonyGeneral, areHegemonyFriends and willBeHegemonyFriend through the public Hegemony entry point. These are authoritative domain operations, not unrestricted client moves. GeneralShown/GeneralHidden and filters/marks/preshow are not yet dispatched by this layer.

Native evidence: `serverplayer.cpp:1753` reveal, `:1939` conceal, `player.cpp:2209` friendship, `:2231` forecast, `:922` seeming kingdom and `:1795` lord lookup.

Source details now covered:

- First reveal assigns the public faction unless majority/dead-lord rules make the player a careerist; counting includes deceased shown faction members and uses original seat count.
- Only an exposed lord head gives the reveal exception. Revealing a lord restores plain careerists with matching kingdom; recruited groups remain distinct.
- A careerist head overrides its deputy-assigned public kingdom. Plain careerists never ally with each other; persisted named groups ally by group ID regardless of original faction.
- Hiding the last shown slot resets the native stored kingdom to god. Subsequent reveal retains that nonempty kingdom; the port preserves this pinned behavior rather than silently restoring initialKingdom. Hidden public views still show null kingdom/alliance.
- Native willBeFriendWith is an asymmetric authoritative prediction using actual primary head kingdom and actual living lord metadata. It can disagree with later friendship for dual-kingdom/careerist/hidden-lord cases. It is not a bot-public-knowledge API or an equivalent substitute for isFriendWith.
- No-op/invalid transitions are rejected without mutation. Owner-only selected initial kingdom survives concealment and JSON reload; view alliance objects are copied.

## Part 2 checkpoint — 2026-10-07

- 12 identity-domain tests plus 24 setup tests pass. Full check: 42 files / 323 tests; typecheck/lint and production build pass. No added lint warnings.
- Standards: one low-priority duplicate-guard finding fixed, no outstanding findings. Spec: no findings. See `docs/reviews/2026-10-07-hegemony-foundation-review.md`.
- GitNexus rebuilt after the shared-guard refactor: 2,799 nodes / 9,775 edges / 239 flows. The shared guard resolves with exact context and both transition callers. CodeGraph: 185 files / 1,697 nodes / 7,204 edges. Global process extraction remains a lower bound; targeted context and source checks supplement it. Structured staged detect_changes reports 24 changed symbols in seven files, low risk, with no partial/truncated flags.

## Next seam

The trigger scheduler must preserve typed parent frames, priority bands, record/cost/reveal/effect stages, consumed occurrence identity, eligibility refresh, nested prompts and explicit event/turn/game interruption semantics. Define a data-only continuation boundary before connecting the domain operations to live card pipelines.

All later pipelines, skills/content manifests, UI/AI/transport migration and Standard 2013 retirement remain outstanding.
