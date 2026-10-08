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

## Trigger scheduler boundary

`src/game/hegemony/scheduler.ts` exposes createTriggerScheduler, dispatchTriggerEvent, resumeTriggerPrompt and getTriggerPrompt. The scheduler is independent of the legacy event bus and production adapters. Event names and occurrences are normalized package inputs; this is not an enabled native skill catalog.

Native evidence: `roomthread.cpp:224–666`, `room.cpp:192`. Stable event-specific priority bands run current-player-first including deceased seats, with game/scenario rules after player actors. Ordinary record hooks precede their triggerable hook; records, costs, reveal and effects can retain data-only continuations under child events and prompts. Handlers and the version-pinned registry stay outside persisted state.

Triggerable hooks must be pure. Package adapters supply stable occurrence IDs and stable ordered-target indices. Identity includes actor, owner, slot, target and copy; target-group consumption includes the selected prefix. Shown/global/equipment Compulsory and Wake occurrences prevent cancellation, their hidden non-global/non-equipment occurrences remain optional. Only global Compulsory receives automatic selection, and non-card triggers precede card triggers. Native encoded-string/package-specific edge cases still require conformance review during content translation.

Initial offers are reconciled to surviving collected keys after record hooks and at order resume; a later record cannot introduce an earlier skill before an attempt. Full eligibility discovery happens after each cost/effect attempt without re-recording. A cost refusal consumes its occurrence without revealing or running an effect. A successful cost waits for reveal children before effect.

Prompts carry a monotonic ID, parent frame, responder and permitted choices. Malformed, stale, duplicate, wrong-player or wrong-registry replies cannot execute a stage. Only the responder receives a copied prompt; event payloads and private frame continuations stay authoritative. The future command router must exclude unrelated state-changing commands while a prompt is pending.

Event consumption returns a child result to its parent; stage-change, turn-broken and game-over freeze the frame stack for operation-specific unwind. This layer does not perform CardFinished/material/phase cleanup. Recursive boundary validation rejects nonfinite numbers and cyclic data. Handler-rewritten event data is validated before yielding/completion and restored on programming error; this is not a rollback transaction for arbitrary game mutations by faulty handlers.

## Part 3 checkpoint — 2026-10-07

- 36 focused scheduler cases pass. Full check: 43 files / 359 tests; typecheck/lint and production build pass, with the same 42 inherited lint warnings.
- Separate standards/spec review found and resolved initial-offer refresh/cancellation, malformed JSON continuation and duplicated progression issues; both final axes have zero outstanding findings.
- Final GitNexus rebuild: 3,245 nodes / 10,661 edges / 107 clusters / 279 flows; CodeGraph: 187 files / 1,734 nodes / 7,472 edges. Full rebuild recovered the earlier Windows FTS checkpoint failure; keyword query now succeeds. Reconciliation has exact context; CodeGraph confirms the final Wake guard.
- Structured staged detect_changes: 402 changed symbols across five files, seven affected flows, HIGH risk, no reported partial/truncated response flags. All seven listed flows were inspected and remain inside the new scheduler. The HIGH assessment is retained, not waived because the library is unregistered.
- dispatchTriggerEvent impact reports UNKNOWN due to missing test caller edges. CodeGraph identifies scheduler.test.ts; a supplementary source/import search confirms no production consumers. This resolves the specific caller uncertainty, not all graph omissions. Global process extraction remains truncated (97 dropped entry points, 69 unexplored, 73 dropped flows, 765 omitted callees); source and public-seam tests supplement the scoped assessment.

## Operation and movement boundary (Part 4a)

`dispatchTriggerOperation` and a separate operation handler registry extend the existing dispatch/resume seam. Event and operation frames have distinct discriminants. Operations yield events, other operations or responder-only prompts; event consumption returns through `child`, while operation values return through `operationChild`. A root operation uses `operationCompletion`, without fabricating a native trigger event. Continuations remain JSON data and handlers remain outside state. Pure preflight rejects invalid root input before allocating a frame. An operation's rewritten payload receives the same JSON validation/restoration policy as an event payload; arbitrary handler game mutations are not rollback transactions.

`createCardMovementOperation` supplies `move-cards` for an authoritative store of hand, draw, discard and table zones. A request has `{ moves: [{ ids, to, from?, bottom?, reason? }] }`; source zones are resolved from unique physical storage. Canonical packets include per-card `from[]`; supplied hints must match physical storage, including after nested Before/Confirm movement. Packages may deliberately replace Before packets without hints to derive current sources, but untouched packets cannot silently rebase. Same-zone moves are omitted except moving a draw card to the bottom; parallel source indices stay aligned during omission. All source removals precede destination additions on a copied store; only a validated batch replaces the authoritative zones. Actor order is current-first among living players, freshly snapshotted for each movement stage; the trigger frame itself still visits all seats.

Pinned `room.cpp:5163–5315` ordering:

1. BeforeCardsMove for each living player; consumption cancels the whole operation.
2. Normalize the rewritten batch, then ConfirmMoveCards for each living player. Confirm rewrites are passed among confirmations but ignored by the physical commit.
3. Commit once. Draw-top and discard prepend per card (reversing the input group); draw-bottom appends in input order. Hands/table append.
4. PreCardsMoveOneTime then CardsMoveOneTime for each living player, sharing rewritten data. Post rewrites and consumption cannot undo the physical commit.

Nested cost movement can suspend before or after commit, survive JSON reload and return to the suspended skill without paying again. Interruptions retain the stack and the corresponding committed/uncommitted storage. No CardFinished/material/phase cleanup is inferred from freezing that stack.

Only the physical kernel is implemented: native merge classifiers, source action sorting, origin/last-hand/open metadata, equip/judge/private/WuGu piles, special ImperialOrder/SixDragons/ImperialEdict and scenario-card rewrites in `cheakMoveData`, wrapped-card reset/filter hooks and network notification visibility remain later work. The input batch order is normalized by a future package adapter; current test fixtures exercise this kernel rather than claiming native packet normalization. A stale mapping during Confirm is rejected before any outer debit; committed nested children are preserved and error recovery is deferred. Raw zone IDs, frame payloads and operation completions are authoritative-only; the current paired-general projection never includes them. No selectable content, UI, AI or transport integration has changed.

## Part 4a checkpoint — 2026-10-07

- Red/green regressions and focused suites: 27 movement cases, 3 operation cases and the 36 existing scheduler cases pass. Full check: 45 files / 389 tests; typecheck/lint and build pass, with 42 inherited lint warnings and zero errors.
- Independent Standards review resolved duplicate admission/payload policies and an overwritten fixture callback. Spec review resolved silent source rebasing during a nested Before movement; canonical hints now reject stale Before and Confirm packets. Both final axes report zero actionable findings; Spec independently reran all 66 focused cases.
- GitNexus rebuilt: 3,460 nodes / 11,137 edges / 113 clusters / 298 flows. CodeGraph: 190 files / 1,777 nodes / 7,690 edges. GitNexus resolves the movement factory's test caller and handler reference; CodeGraph identifies the three affected test files. Source/import inspection confirms only scoped Hegemony/test consumers, with no production registration.
- Structured staged assessment before final ledger bookkeeping: 218 changed symbols across eight files, 13 affected flows, HIGH risk, with no reported partial/truncated response flags. The flows cover event/operation dispatch to movement normalization, living order, JSON validation, handler execution and completion, plus resume ordering/forced choice. They were inspected and stay in the Hegemony scheduler/movement boundary. HIGH is retained, not downgraded because the module is unregistered.
- Global process extraction remains incomplete: 105 dropped entry points, 55 unexplored, 16 budget-cut walks, 783 omitted callees and 64 dropped flows. Interface/callable-handler boundaries and omitted test-caller edges require CodeGraph, source inspection and the public dispatch/resume traces as supplements. This checkpoint does not claim a complete repository graph, native runtime differential validation, complete movement parity or playable production Hegemony.

## Part 4b — movement metadata and additional physical zones

The normalized `move-cards` packet now carries per-card visibility, physical source place and named-pile metadata, destination place/pile, reclassified origin metadata, and `lastHandcard`. Native evidence is `src/core/structs.h:223–249` and `src/server/room.cpp:4982, 5107–5142, 5163–5315` in the pinned clone. A Before rewrite may redirect `to`; native `_separateMoves` then resets origin fields from that rewritten packet before Confirm. The last-hand flag is recomputed after Before from the source hand inventory and the ordered packets, before Confirm. A same-zone no-op removes the corresponding indices from every per-card array. The packet's `from`/`originFrom` values are internal zone keys; owner-pointer translation remains the future native packet adapter's job.

Physical storage accepts equip, delayed-trick, judge, named special and WuGu zones in addition to hand/draw/discard/table. Player zones require a seat owner; shared zones have no owner; special piles require a name. These are storage and event metadata only. Native `serverplayer.cpp:482–554` equipment install/uninstall, delayed-trick card hooks and package card/slot rules are not yet implemented. No player-specific visibility projection exists for movement payloads; they remain authoritative server data.

Focused public-dispatch regressions cover Before redirection/origin reclassification, per-card `open`, last-hand flags across packets, no-op alignment, additional-zone round trips, named-pile metadata, and atomic rejection of invalid visibility/private piles. The existing JSON resume and stale mapping suites also pass. Full check: 46 files / 394 tests, typecheck/lint and production build pass; 42 inherited lint warnings and zero errors. GitNexus rebuilt after review fixes: 3,534 nodes / 11,328 edges / 113 clusters / 305 flows. CodeGraph rebuilt: 191 files / 1,798 nodes / 7,768 edges. Global GitNexus process extraction still omits 106 entry-point candidates, 45 ranked entries, 62 flows and 776 callees; source/tests and CodeGraph supplement scoped assessment. Independent Standards/Spec review resolved one finding on each axis, with zero outstanding findings.

Structured staged detection reports 78 changed symbols across five files and six affected flows, HIGH risk, with no partial/truncated result flags. The reported paths reach `validZone`, `livingActors` and `markLastHandcards` through movement dispatch/build entry points; they were checked against the unchanged scheduler boundary, targeted CodeGraph impacts and public-dispatch tests. HIGH remains recorded. Whole-repository process extraction is still incomplete, and this checkpoint does not establish production E2E coverage.

## Next seam

Finish native packet merge/classification and package modifiers, then card/phase/damage/dying/death/reveal/winner operations over the scheduler. Validate operation cleanup and authoritative command routing before registering a playable catalog or migrating consumers.

All later pipelines, skills/content manifests, UI/AI/transport migration and Standard 2013 retirement remain outstanding.
