# M1.3 B — Normal turns and resumable native unwind

Status: accepted B design. On 2026-10-28 the user selected the broader B scope, then explicitly approved scheduler-owned opt-in unwind and the five checkpoints. This supersedes the preceding phase-only proposal. Only M1.3.1 is now implemented; see the [compiled scheduler contract](../engine/scheduler-unwind.md) and [checkpoint](../reviews/2026-10-28-hegemony-m131-scheduler-unwind.md). M1.3.2–5 remain required and unimplemented at this input. Business-owner identity is not established by the conversation.

Input game: 37c3d178766e23e4a497e67c9088ff1fc3376b45. Knowledge verified offline: 551bc994d5092b33f135996eef04dd484ab3bc60. Native authority: QSanguosha 2.3.43-beta2, ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f. Production remains Standard2013. Preserve the existing dirty primary checkout and unrelated worktree artifacts.

## 1. Problem and intended result

M1.2 consumes setup and completes initial-winner/global/player startup, then stops at prepared. The generic scheduler freezes eager effects and frames when interrupted. There is no native normal-turn owner, complete phase lifecycle or resumable exception cleanup. Starting the next actor by clearing interruption/frames would skip native catch blocks and corrupt resources or ordering.

B will provide one Room authority from startup into a resumable normal-turn loop, including phase lifecycle, normal/extra turns, GameRule phase cleanup and explicit native unwind for the represented core operations. A limited internal content profile must exercise real draw, card use, damage, cleanup and terminal result through this composition. Full native packages, competitive bot policy, UI/online/storage deployment and release acceptance remain later gates.

The implementation is split into five dependent checkpoints. Each completes its tests/build, graph checks, two reviews and canonical knowledge import before the next begins. The later checkpoints must not bypass a failed earlier one.

## 2. Native evidence inspected

All links use the same pinned native commit. These are definitions read from Git objects, not a native executable run.

| Source | Owning semantics |
| --- | --- |
| [RoomThread 112–220](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L112-L220) | Normal/extra turns, round boundary, TurnBroken recovery, GameFinished startup/outer terminal boundary |
| [RoomThread 652–667](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L652-L667) | Event stack departure on an exception; native AI filter observation is distinct from web actor policy |
| [ServerPlayer 1051–1210](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/serverplayer.cpp#L1051-L1210) | Direct changePhase versus play, executePhaseEvent, skip/insert/query |
| [GameRule 159–262](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L159-L262) | RoundStart/Judge/Draw/Play/Discard bodies |
| [GameRule 332–521](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L332-L521) | FirstRound, turn counters, face-up, optional BattleRoyal, phase/history/mark/temporary-skill cleanup and ImperialOrder |
| [GameRule 562–611](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L562-L611) | Protected CardUsed section and Jink-key removal on TurnBroken/StageChange |
| [Room 4269–4303](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4269-L4303) | useCard catch: material movement, flagged CardFinished, temporary state and physical sweep, then rethrow |
| [Room 4490–4573](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4490-L4573) | damage protected section and damage-stack/tag cleanup |
| [Room 678–760](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L678-L760) | Batch acquire/detach mutation versus deferred lose/acquire events |
| [Room 2362–2415](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L2362-L2415) | Numeric/list/string mark cleanup and single-turn card limitations |
| [Room 6155–6228](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L6155-L6228) | Play activation, termination flag, PlayCard, card-use reason and ChoiceMade |
| [Engine 961–999](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/engine.cpp#L961-L999) | getRandomCards resets flags before package/conversion filtering and shuffles; cleanup consumes RNG |
| [Player 2294–2305](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L2294-L2305) | getNextAlive and removed-seat argument |

A literal search found twelve matching TriggerEvent catch sites under native src/. Additional read sites were AmazingGrace cleanup, Dimeng flag cleanup, the native exchange-AI flag and the animation package's nested turn. That search is an inventory aid, not proof that all C++ exception constructs or packages were exhaustively audited. Those package/AI-specific handlers are not enabled by adding a core unwind interface; each needs its own port and evidence before its content is enabled.

## 3. Architectural decision to approve

### Recommended: scheduler-owned, opt-in unwind with per-operation hooks

Keep one scheduler and one Room. Add an explicit internal unwind entry point, optional operation cleanup handlers and a persisted interpreter mode. The scheduler owns traversal of its own frames; native cleanup remains owned by the operation whose native try/catch applies. Existing registry profiles default to freeze and retain their present behavior. The new match profile opts in with a new version.

Dispatch still freezes at the interruption initially. The trusted application owner explicitly requests unwind for the matching interruption identity. This separates observation/persistence from recovery and prevents public answers from clearing interruptions. Cleanup is resumable through the same event/operation/prompt machinery and ID sequence.

### Alternative: application-owned cleanup stack and second scheduler

Copy/translate abandoned frames into an application cleanup queue and execute it in a separate scheduler. This avoids extending the interpreter's operation interface but makes the application understand private operation cursors, table identities, frame ordering and cross-scheduler prompt IDs. Nested cleanup interruption would duplicate native exception ownership in another layer. It has weaker locality and is not recommended.

The user approved the first interface and five-checkpoint scope on 2026-10-28. Existing approval remains effective for those dependent checkpoints; each must complete its validation/review/knowledge gate before proceeding.

## 4. Unwind interface and state contract

Names below describe intended interfaces; final TypeScript names follow existing conventions.

- Registry: opt-in unwind policy plus a finite interpreter step budget. The version identifies callback/policy semantics. Old profiles omit these options and keep freeze/unbounded behavior; no old test/prototype silently starts unwinding.
- OperationHandler: an optional unwind handler receives the operation, immutable saved normal continuation, interruption reason and a separate cleanup continuation/child/answer context. It returns the existing operation/event/prompt/return steps. It decides whether its native protected region was entered; this is not a global finally callback.
- Scheduler: private JSON unwind mode records the current reason/origin, active cleanup owner and traversal progress. Preserve the original normal continuation separately from the cleanup continuation. Prompt IDs and nextId remain monotonic; stale completion fields cannot stand in for an unwind completion.
- Internal unwind entry: require registry identity and the exact pending interruption identity; reject no-interruption, mismatched or duplicate starts before mutation. Never expose it as an actor move. It drives until a prompt, cooperative yield, fresh interruption or completion.
- Normal dispatch is rejected while unwind is active. Prompt resume is permitted only for the current cleanup child under the same actor/frame/offered-choice checks. On completion, return a distinct unwind completion to the application owner, not a successful normal operation result. Never resume an abandoned use/phase continuation after cleanup.

### Traversal and nested exceptions

Unwind is innermost-to-outermost. Frames without an applicable native catch are abandoned; applicable operation cleanup runs once before that frame departs. Child operations/events created by a cleanup run normally above that cleanup owner and may request private choices. Completed cleanup children cannot be rerun after JSON restore.

Protected-region eligibility must be mapped from actual native try boundaries to each operation's saved stage before code changes. A child that threw did not return: do not apply its usual post-return assignment when preparing a catch. Preserve native local-versus-shared data reload points. In recursive conversion, each Room-use frame cleans its own post-validation local card/use, distinct from its converted child; do not replace every enclosing identity with the last child event payload.

If a cleanup child interrupts again, use the new reason and unwind that child. When this reaches a cleanup handler already in progress, abandon its remaining body; do not re-enter the same catch. Continue to the next enclosing native catch. This matches an exception thrown inside a C++ catch block, including any native flag unset that was never reached. Earlier eager effects survive. A later NotActive cleanup may clear remaining flags in its own source order; no unconditional finally is invented.

TurnBroken and StageChange run only the native catches whose reason condition matches. GameFinished does not run TurnBroken-only card/damage cleanup. After frame departure, the application handles terminal/fault/recovery according to its owning boundary.

## 5. Core native catch matrix

| Owner | Eligibility | Required cleanup and rethrow behavior |
| --- | --- | --- |
| damage | TurnBroken/StageChange after entry into the native try; ConfirmDamage/Predamage are outside it | Remove is_chained and CurrentDamageStruct; clear the entire damage stack. Do not restore HP or synthesize DamageComplete |
| GameRule CardUsed | TurnBroken/StageChange only inside the protected Jink/target/effect section; pre-action and earlier target collection are outside | Remove the current native Jink key using this owner's captured/mutable use semantics. Do not restore the normal-path backup or execute the rest of use |
| Room useCard | TurnBroken/StageChange inside onUse/validateAfter/recursive conversion protected scope; parsing/validate/history before try are outside | Move relevant current table materials with native UNKNOWN reason; set Global_ProcessBroken; emit actual CardFinished; unset that flag only if control returns; clean alive-player Qinggang/temporary flags; execute native-equivalent physical sweep; rethrow |
| RoomThread normal owner | TurnBroken after enclosed core catches complete | Emit actual TurnBroken; then compute next actor; if phase is active, call GameRule's phase-end effect directly, then actual direct changePhase to NotActive; set next and restart normal-loop ownership |
| RoomThread recovery catch | A fresh TurnBroken during recovery | Re-enter recovery from current Room facts, preserving already committed changes; no replay of abandoned recovery children |
| Ordinary root | GameFinished | Finish once; no next turn. Keep Room result; complete stack departure without inventing turn/card cleanup |
| Ordinary root | StageChange or TurnBroken during startup | Preserve/unwind applicable inner catches, then retain an explicit unsupported-boundary fault. Native ordinary RoomThread does not turn these into a normal next turn. Do not silently recover as TurnBroken-in-battle |

Room useCard's native sweep is broader than normal onUse fallback: table and judgment-place cards from the eligible physical enumeration may move, rather than only this card's original materials. It is not a sweep of every delayed-trick area. Use explicit physical/place identities and actual movement operations. The getRandomCards reset/filter/shuffle step occurs before that sweep and consumes the one saved RNG authority. Persist the resulting order before a movement can suspend so restore does not reset flags/shuffle twice. Package bans/conversions and current wrapper/reference storage are versioned content authorities, not inferred from numeric IDs. Use the project's portable RNG contract; this is deterministic web behavior, not a claim to reproduce C++ qrand byte sequences.

## 6. Phase lifecycle and GameRule cleanup

Retain the phase-lifecycle semantics from the A draft: normal/custom sequence; none sentinel; play's rewritten destination after Changing/free-chain; live skip/finished state and EventPhaseSkipping; direct changePhase's separate fixed destination/skip behavior; NotActive Start-only; Start consumption gates Proceeding; alive gates End; skip/insert/query over repeated phases. All current phase facts use Room.playerPhases; queued/skip/index state is additional native state, not another current-phase authority.

Implement GameRule's priority-zero phase bridge with its real SkipGameRule behavior. The recovery owner's direct call is the GameRule effect only, with that effect's guard; it is not a full EventPhaseEnd trigger and cannot run all package End listeners again.

- Changing resets positive numeric -PhaseClear marks and broadcasts pushPile history. Entering NotActive resets positive numeric -Clear marks and consumes the current ImperialOrder branch; entering Play clears that actor's history; entering Start clears Analeptic history. Do not conflate these explicit numeric loops with clearPlayerMarks.
- End clears Play history; Finish clears Analeptic and the native alive-player multi_kill_count set; clear -phase marks for the captured all-player list.
- NotActive Start processes the captured all-player list in order: clear flags, drank, -turn marks, single-turn card limitations, removed state and temporary TurnSkillsFor entries. Remove the turn-skill tag before the detach child; preserve batch mutation then deferred EventLoseSkill ordering from native handleAcquireDetachSkills.
- clearPlayerMarks for -phase/-turn/-round covers numeric, integer-list and string-list mark stores with their native positive/nonempty gates. Introduce explicit normalized typed ledgers where absent. Do not erase list/string values merely because the separate -PhaseClear/-Clear numeric loops run.
- Card limitations and acquired/owned skills must be actual Room authorities shared with legality/eligibility. Package metadata and pattern matching stay explicit adapters. A missing required detach/effect operation is a composition error, not a successful no-op.

ImperialOrder's pending tag is currently written by movement. B must consume it through real null-source hidden-player effects before claiming the phase cleanup branch complete. The approved no-treasure policy remains: block the native ImperialEdict creation/reinsertion route and keep LordEXCard disabled; do not introduce Vương Triều Chiến. Native treasure-spawn behavior versus this approved product policy is recorded explicitly. Porting this core caller does not enable every StrategicAdvantage card/package.

## 7. TurnStart and normal/extra turns

TurnStart uses currentPlayer, FirstRound → Global_FirstRound and Global_TurnCount in source order, including native public notices. A face-down actor clears its first-round flag, turns face-up, emits TurnedOver and drains free-chain without playing a normal turn. A face-up living actor gains Global_RoundCount and enters the phase sequence. Debug-only playNormally/cheat code is not a production rule. If optional BattleRoyal is configured, implement its source guard and tag/mark transition with declared presentation adapters; configuration is versioned and covered, not silently ignored.

The normal-loop cursor captures the original regular actor before TurnStart. Consume ExtraTurnList from the live room tag: remove one item before its TurnStart; an unknown actor is skipped. Preserve empty-list versus absent-tag behavior. When extra turns finish, choose the next normal actor relative to the original regular actor, using native getNextAlive(1,false), including the correct removed-seat policy. Clear -round marks on the native seat-wrap comparison. Do not derive next normal actor from the most recent extra-turn actor.

TurnBroken recovery instead starts from currentPlayer and computes next after the TurnBroken event, before direct phase cleanup/changePhase, exactly as native. Later children changing life/seat facts do not retroactively change that captured next. A new interruption abandons the current recovery continuation and enters the appropriate outer recovery/fault path.

## 8. Real phase bodies and existing admission

To make the loop meaningful, B's integration includes source-derived core bodies with explicit package authorities:

| Phase | Composition |
| --- | --- |
| RoundStart | Real general-show request/reveal using current first-round/change eligibility; package discovery is supplied |
| Judge | Capture judging-area trick list, take last, move to table, real card-effect with null source, invoke onNullified only for the caller's false result, then real free-chain; honor the living loop gate |
| Draw | Reuse existing real DrawNCards/draw/AfterDrawNCards/free-chain composition; do not duplicate its internal free-chain boundaries |
| Play | Compose native activation guards with existing createCardCommandAdmission/card-use-request. That admission already emits PlayCard/ChoiceMade and invokes room-use-card; never emit/use twice. After a successful used result run free-chain and iterate; map decline/unavailable/invalidated behavior deliberately and test it |
| Discard | Recompute native hand/max-card conditions around optional halfmaxhp/careerist choices; spend real tokens/marks; real rule-discard movement and ChoiceMade under current card limitations. Exact candidates/skill-modified hand limit remain trusted package authorities, not constants |
| Start/Finish/NotActive Proceeding | Preserve the source's empty bodies; the lifecycle events and their cleanup remain real |

Card prompts must go through the existing admission submit seam so live offer/material/target checks run; a generic raw resume must not bypass them. Other nested prompts retain their own current-responder path. Human/bot selection shares actor-only offers; this does not implement a competitive bot policy. Network credentials, durable publication, clocks and UI are still separate consumers.

## 9. Cooperative work bound and persistence

A normal-loop while(true) is unsuitable inside one server transaction. Add a versioned opt-in interpreter step budget and a private continue-work interface. On budget exhaustion, persist a cooperative-yield marker with the already advanced frame/cursor and schedule more trusted work; it is neither an actor choice nor an interruption. Bound completed TurnStart roots per application pump to one by default. A saved partially drained ExtraTurnList/regular anchor remains intact across pumps.

Budgeting applies during normal interpretation and unwind/cleanup. Existing profiles stay unchanged unless opted in. A budget counts interpreter work, not elapsed CPU; synchronous package callbacks must still return. Do not claim a timing SLO or safe execution of arbitrary untrusted code from that counter. Prompt/departure clocks are not reset by cooperative yields or recovery; actual M0/server timer wiring remains outside this slice.

Match schema becomes a new explicitly incompatible v3 profile, sealing rules/content/registry, startup classification/settings and turn/unwind/work configuration. Keep create/apply/view/restore as the small application interface; add a trusted continuation entry for cooperative work. Reject v1/v2 rather than infer a phase/catch location. Persist phase queues, turn cursor/regular anchor, unwind mode, RNG and monotonic identities. Startup completion hands the same Room/scheduler to the turn owner once. Validate startup and battle roots with their respective owner; the existing M1.2 complete-cursor validation cannot simply be reused over active battle frames.

Restore validates before driving any candidate. A pending actor prompt remains paused. An internal yield/idle completed-root checkpoint can continue under the configured bound. Completed operations, catches, draws, shuffle, token spends, notifications and turn-count increments cannot replay. Projection derives public phase/current actor and owner-private prompt choices from Room; no frame, caught payload, RNG state, other hand, hidden identity or cleanup metadata is exposed. No server route may accept raw unwind/continue parameters from a player.

## 10. Five dependent implementation checkpoints

| Checkpoint | Work and acceptance | Dependency |
| --- | --- | --- |
| M1.3.1 | Opt-in scheduler unwind/cleanup continuation, distinct completion and cooperative yield. Old freeze tests pass. New nested/re-interrupted cleanup traces and JSON restore prove traversal/IDs/at-most-once at the interface; trace handlers are fixtures | Approved B scheduler interface |
| M1.3.2 | Actual protected damage/CardUsed/Room-use cleanup. Source-derived early/late interruption matrix, conversion recursion, CardFinished/movement prompts, physical sweep/RNG and re-interruption tests; eager damage/resources retained | 1 |
| M1.3.3 | Phase sequence/change/execute/skip/insert plus actual GameRule phase/history/typed-mark/limitation/temporary-skill/ImperialOrder cleanup, with no-treasure policy | 2 |
| M1.3.4 | Real TurnStart, face-up, normal/extra/round progression, recovery owner and core phase-body composition; actual Draw/admission/Room/damage/rescue/winner where applicable. Missing package authority fails explicitly | 3 |
| M1.3.5 | v3 match handoff, answer routing, cooperative continuation, filtered projection/restore; internally enabled minimal-profile setup-to-terminal scenarios for 2–10 seats and interruption/recovery during real card play | 4 |

For each: get current graph impact before edits, collect behavioral RED first, run focused tests/typecheck while iterating, then approved full check/build and graph/byte checks, Standards and Spec reviews, fix findings, publish canonical knowledge and import/pin before proceeding. Reuse the existing branch/draft PR; do not merge main automatically. Tests that inject a serialized condition remain distinguished from normal create-to-result runs. New native runtime differential evidence requires actually running the reference; no such result is assumed here.

Required matrix across checkpoints: interruptions before/inside/after every protected core region; TurnBroken/StageChange/GameFinished; cleanup prompt then stale/wrong/duplicate answer; nested converted uses; CardFinished interrupts; damage before and after HP change; state/RNG/table identity conservation; dead/removed actors; consumed phase events; rewritten/inserted/repeated/skipped phases; empty/unknown/nested extra turns; regular-anchor wrap; repeated recovery; terminal before next turn; cooperative budget one/many; JSON at normal, paused, yielded, unwinding and completed-root boundaries; actor/spectator information leakage. Representative fixtures do not establish every native package interaction.

## 11. Graph evidence and current verification

GitNexus at current37c3d17 identifies scheduler dispatch/resume callers and flows. Traversal reports LOW for scheduler entries and core factories in this query, but that does not clear a shared-interpreter change. Independent CodeGraph dispatchTriggerOperation upstream depth2 reaches **72 nodes/134 edges/46 paths**. This is a broad/high-risk engineering surface under the project's review thresholds. Existing GitNexus extraction limits remain: 471 excluded entry candidates,1,233 skipped callees,26 budget-cut walks and unresolved cross-language/callable links. UNKNOWN results for several factories/new names remain unresolved; source/context/CodeGraph identify the bounded consumers rather than treating an empty walk as unused.

The pre-M1.3 baseline match/draw/operations execution passed53/53 tests in three files. This is a baseline, not validation of the proposed B behavior. Current PR33 head37c3d17 has passed GitHub CI and a completed Vercel frontend preview. None of that enables the proposed normal-turn path or certifies a playable release. Those were pre-implementation observations. Later M1.3.1 source checks are recorded separately in the linked checkpoint; no execution for M1.3.2–5 is claimed.

Spec self-review completed: checked source boundaries, interruption reason/owner distinctions, normal versus cleanup continuations, old-profile compatibility, single RNG/Room/ID authority, cooperative-yield scope and dependency order. Mechanical check resolved all thirteen pinned native citation paths/ranges and found no TODO/TBD placeholders. This is author review of the design, not independent code review or implementation validation.

## 12. Completion and remaining release gates

B is complete only when all five checkpoints have real implementation/evidence and reviewed/pinned knowledge. An internal minimal-profile full match is a required integration proof, not the complete product. M0 manifest/bot/provider/load/decision work, all agreed content with package-specific catches, competitive actor-only bots and experienced-human testing, complete art/audio/provenance, desktop private rooms2–10, real session/store/UI and hosted recovery/load, production retirement/cutover/rollback remain required. No main merge/deploy is authorized by this design decision alone.
