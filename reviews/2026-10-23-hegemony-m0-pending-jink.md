# M0.3/M0.4 — Pending Slash/Jink, commit and restart tracer

Date: 2026-10-23. Status: reviewed **partial local prototype evidence**. The user approved continuing the proposed real Slash → Jink slice after Q31. Both [bot prototype](https://github.com/chuongphong12/Sanguosha-vn/issues/29) and [online/storage prototype](https://github.com/chuongphong12/Sanguosha-vn/issues/30) remain open.

## Source identity and scope

- Game base: `df512421f110ca478d3b26eb451dd391a5267cfe`. Source commit: `bc3ceb996054cf6fc42f0204f553bf279e13899b`, branch `codex/hegemony-m0-prototypes`. Knowledge input: `c26396c63321edf4cf00f3c5a7abc9c293da01e1`, verified before relying on its contracts.
- Native authority remains QSanguosha 2.3.43-beta2, `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. Installed boardgame.io remains 0.50.2. The [accepted session contract](../research/2026-10-22-m0-session-contract.md), [Slash/Jink contract](../engine/nullification-and-slash.md), [direct MethodUse contract](../engine/direct-card-use.md) and [Room/admission contract](../engine/room-use-and-admission.md) supply the boundaries.
- Eight synthetic physical cards, two fixture seats with 4 HP each, fixed seat-0 Play context and one plain Slash allowance. No turn advancement, paired setup, skills, equipment, conversions, multi-Jink, elemental/lethal/rescue flow or content-manifest claim. The fixture is labelled in code, UI and README.
- No existing `src/` kernel, production registration, `server/server.ts`, dependency or lockfile change. The ordinary production build still registers Standard2013. This is evidence captured outside main.

## Actual operation chain and bounded authorities

| Boundary | Actual execution | Fixture authority / remaining work |
| --- | --- | --- |
| Human Play command | Socket-bound session → staged Master → existing `createCardCommandAdmission` operation and submit | Synthetic physical Slash offers; two living adjacent seats, no prohibitions/skills/equipment; one Slash availability. Not a full package legality implementation. |
| Accepted Slash | Existing Room use/history → slash-on-use → card-on-use/movement → CardUsed/GameRule/resources → card-use/effect/SlashProceed | Original physical metadata; no conversion; reveal/notification/after hooks are no-skill fixture operations. |
| Pending Jink | Existing ask-card-use/CardAsked → bounded physical-Jink request operation → actual scheduler prompt | Only the authenticated expected actor sees opaque choices. Client supplies prompt ID/choice, never a card descriptor, materials, operation or actor authority. |
| Reply | Same session command for a human or explicitly invoked actor-only policy → authenticated revision/generation checks → scheduler resume → existing MethodUse/material lifecycle/JinkEffect/SlashResult | Request adapter rechecks owned fixture Jink; generic package conversion/discovery and other request families remain absent. Bot uses the human acquisition path; no server worker/timer job is implemented. |
| Consequence | Jink moves hand → table → discard; existing SlashMissed or SlashHit and normal damage/HP pipeline; original Slash finish cleanup | Decline reaches 3 HP from 4. One-Slash fixture prevents entering unintegrated lethal flow. No complete match result is implied. |
| Commit/publication | Pending frames, prompt, game resources/RNG, metadata, controller generation and payload-bound receipt serialize together in the existing fsync/rename document | Same-machine process-crash experiment. No external SQL transaction, power-loss, distributed lease, durable event outbox or provider proof. No RNG shuffle progression case was executed. |

`battle.ts` composes existing operations; `engine.ts` owns the registry/version and Master move. `session.ts` normalizes draw/play/answer intent, passes it through staged Master, and binds deduplication to the answer payload as well as the action. Reusing an accepted ID with another prompt/choice yields `Intent collision`; an identical retry returns the original receipt/current actor view without rerunning the engine. Current controller authorization is still required before receipt lookup.

The projection allowlist is own hand/counts, owner-only prompt and policy offers, plus public HP/discard/Slash outcome names. Scheduler frames, private request data, tags, RNG and opposing hand identities are absent. Same-actor read-only tabs can view their actor's choices but cannot submit. Another actor receives no pending choices and no drawing offers while the scheduler is occupied.

Save identity changes to `PROTOTYPE-ce4e62b-prompt-v2`; prior draw-only scratch saves are rejected rather than reinterpreted. This does not change any production save format.

## Executed validation

1. Baseline: **87 files / 2,138 tests** passed. First new public Socket.IO case failed at the missing Play command (`Invalid command`) before implementation. During composition, the discard-order expectation was corrected against movement's prepend-to-discard behavior; no engine change was made to force an incorrect expectation.
2. Final `npm run check`: lint/typecheck plus **88 files / 2,143 tests passed**. Lint: zero errors, 42 existing warnings. Dedicated prototype TypeScript compilation passed, covering runners/browser/benchmark files omitted by the root compiler configuration.
3. Focused prototype suite: **18 tests passed**, including five new public-seam cases. Both independent reviewers also ran the five new tests successfully.
4. `npm run prototype:m0:browser`: passed with two actual Chromium contexts and a same-seat secondary tab. It executes Play card/target/confirm, owner-only Jink, refresh while waiting, MethodUse response, SlashMissed with unchanged HP, plus the previous drawing/privacy/control/refresh checks.
5. New faults/races: wrong actor, wrong prompt, unoffered Jink, read-only tab, prior controller and draw-while-pending are rejected. Competing human/bot response intents accept one effect; same-ID retry deduplicates and changed payload collides. Real disk-write failure emits no speculative view, retains the exact pending view/materials and accepts the same intent after storage recovers.
6. A real child server is killed while waiting for Jink. Restart returns the same prompt and hand. Its Jink answer commits with ACK withheld; a second actual SIGKILL/restart returns the saved receipt, empty hand, one SlashMissed, unchanged HP and two discarded materials without re-execution.
7. `npm run build` passed; no prototype markers were found in built production JavaScript. The existing benchmark runner also passed with its explicitly draw-only measurement scope; it does not measure Slash/Jink latency or bot strength.

## Graph evidence and limits

Graph-first impact preceded source edits. GitNexus reported LOW for `createPrototype` (four consumers), `actorObservation` (four) and `initialEngine` (one). Its `proofGame` constant was UNKNOWN; CodeGraph found the session dependency and source references confirmed actual InitializeGame/Master consumers. UNKNOWN was not treated as unused. The HTML demo is outside CodeGraph's parsed file inventory; its real transport loader and browser consumer were inspected directly.

Both indexes were refreshed before commit. GitNexus 1.6.12: **10,768 nodes / 26,460 edges / 504 extracted flows**. CodeGraph 1.6.0: **3,686 nodes / 18,616 edges**, complete, no pending changes or references. Ten exact file hashes (new battle/engine/session/test plus existing scheduler/admission/ask-card/Slash/damage/server) matched both graphs and current disk bytes.

The CLI display abbreviates rows. Its full LocalBackend `detect_changes(scope=staged, limit=1000)` result returned **140 symbols / 22 affected flows / eight files**, with no result-level partial/truncated flag. **Raw risk remains CRITICAL**; it is retained as a broad change warning, not downgraded by the LOW scoped impacts. The 22 rows cover the actual new move/answer/projection/fixture callbacks and shared admission/scheduler paths. Source checks show no production/kernel diff or import of the prototype from production entrypoints. These checks and targeted tests bound the experimental change; they do not establish production clearance.

Index extraction still caps process discovery: 443 entry candidates dropped, 1,183 callees skipped and 19 walks cut by budget. Missing flows remain unresolved; refresh does not turn absence into proof of no effect. Full machine-local receipts: `tqs-m0-prompt-graph-full.json` and `tqs-m0-prompt-graph-receipt.json` in the task's Temp evidence directory. Their relevant results are recorded here without importing generated index databases into the repo.

## Independent review axes

**Standards:** zero actionable findings. Review covered all eight source/test/README/UI files against AGENTS, lifecycle, Karpathy, TDD and the code-smell baseline. Changes stay in the prototype and tests use actual public transport/storage rather than mocked internal operations.

**Spec:** zero actionable findings within the accepted bounded slice. Review confirmed actual admission/MethodUse execution, private projection, saved continuation/receipt and fault/race coverage. Both reviewers explicitly retained the pending timers, automatic bot jobs, provider and full-match limits. Their new-symbol graph lookup was initially unresolved; the later refresh and exact hashes above resolve that specific index freshness issue while retaining extraction limits.

The subsequent five-file knowledge update also received independent Standards and Spec review: zero actionable findings on each axis. The relative-link/source-blob validator passed independently for both reviewers.

Exact reviewed Git blobs:

| File | Blob |
| --- | --- |
| `server/prototypes/hegemony-m0/battle.ts` | `8b4cb311b628362a0131cecd618eeeff84192e58` |
| `server/prototypes/hegemony-m0/engine.ts` | `b587a91df2128a7ef744b79aa4de7ead81a506a4` |
| `server/prototypes/hegemony-m0/session.ts` | `88e58f70603614d1e6a5e348edd81c31bb85cc3d` |
| `tests/prototypes/m0-prompt.test.ts` | `5b84a4c8452719a8d193f903249ad10e7aa87352` |

## Next slice

Implement durable service-time prompt and disconnect deadlines: independent 60-second clocks, no reset on disconnect, exclude server downtime, and preserve controller/prompt fencing when scheduling bot work. Automatic bot ownership/execution, other request families, external-store/provider recovery, manifest completeness, competitive strength and five-by-ten load remain separate unresolved acceptance work. No M0.3/M0.4 closure, main merge or deployment follows from this checkpoint.
