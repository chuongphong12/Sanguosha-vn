# Complete Quốc Chiến release — approved destination and M0

Approved through Q23/Q24 on 2026-10-22. Current requirements live in [Quốc Chiến release: complete desktop game, fair competitive bots and free hosting](https://github.com/chuongphong12/Sanguosha-vn/issues/25); the [M0 decision map](https://github.com/chuongphong12/Sanguosha-vn/issues/26) tracks investigations and blocking relationships. This page is a durable navigation/constraint record, not a duplicate mutable ticket store.

## Fixed release constraints

- Keep TypeScript/PixiJS/boardgame.io and native authority `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. Replace Standard 2013 at the accepted playable-replacement gate; no dual-mode product or reinterpretation of old saves.
- Complete all agreed ordinary Quốc Chiến packages, including applicable Tam Quốc expansions/mods, before the first small-group release. Exclude treasures, Moesen outside the setting, Test/Removed/placeholders and separate scenarios. Q29 excludes optional Joy, Disaster and jile_card. Q30 confirms ordinary Quốc Chiến without a Vương Triều Chiến/treasure flow: LordEXCard remains disabled and its independent four-trick variant is not introduced; the separate LordEX general package remains a candidate. Exact package/ID/dependency classification is M0 work, not a blanket approval of every dynamic Lua file.
- First release includes desktop/laptop play for every size 2–10, online and solo, competitive actor-view-only bots and complete art/audio. A partial engineering prototype is not the first release.
- No accounts; anyone reaching the website may create a room, joined by link, with protected same-browser seat return. Rooms are unlisted. Small-group testing describes audience/promotion, not an access-code gate. Cap five rooms; transfer host management when other humans remain.
- Free infrastructure and no paid inference API; accept cold start. Target five simultaneous rooms of up to ten seats with actual bot participation. Measure before claiming capacity. The user can organize three to five experienced testers; no hard calendar deadline was selected.

## Room lifetime and recovery

Q26 clarifies that explicit Leave by the **last online human** deletes the room and match immediately, even when another participant still has reconnect grace; deletion revokes those return rights. A passive last-human transient disconnect/refresh allows sixty seconds to return, then deletion; bots do not preserve abandoned rooms. Server downtime does not consume the grace period and is not explicit Leave; recovery starts the return window after service readiness.

When other humans remain, an absent actor gets sixty seconds before bot takeover and may reclaim control at a safe decision boundary. A still-online unanswered prompt gets sixty seconds, then a bot handles one decision. Persist accepted state/RNG/continuation/authority/version before success publication; restart must neither lose acknowledged moves nor resurrect deleted rooms. The [M0.2 contract](https://github.com/chuongphong12/Sanguosha-vn/issues/28) was accepted at Q31; runtime enforcement remains prototype/implementation work.

Q25–Q28 also freeze fresh join eligibility when paired setup starts; an explicitly departed human's game character becomes bot-controlled without a kill/removal rules effect. Existing participants can still reconnect under their rights. Decision and disconnect clocks remain independent. One tab controls a seat; same-actor secondary tabs are read-only with explicit control claim, and closing one secondary connection does not make the actor offline.

## Milestones and gate

| Milestone                               | Observable exit                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 — Manifest and feasibility           | Exact reviewed scope; session/bot/storage proofs, measured constraints and explicit choices for the next implementation slices.                                   |
| M1 — Actual playable session            | Setup through terminal result with real startup, phase/turn, interruption cleanup and existing rule operations; limited internal development content is labelled. |
| M2 — Desktop rooms, online and recovery | Private-view UI, link join, credentials, 2–10 seats, reconnect/restart/timeouts/handoff/deletion end-to-end.                                                      |
| M3 — Entire manifest                    | All target content has handlers/legality/prompts/UI/bot support and conformance evidence, not selectable no-ops.                                                  |
| M4 — Competitive bot strength           | Versioned tactical/tournament measurement and experienced-human acceptance with actor-only information.                                                           |
| M5 — Complete release media/UI          | Every required art/audio mapping, provenance/attribution and actual private/public usage is checked.                                                              |
| M6 — Small-group release acceptance     | Full-match/conformance/privacy/recovery/E2E plus real five-by-ten load and complete content/media/bot gates.                                                      |
| M7 — Cutover, beta and stable           | Reviewed replacement/retirement, deployment recovery/rollback rehearsal, then wider promotion and stability evidence.                                             |

These are milestones, not eight short coding sessions. M3/M4/M5 evolve through complete vertical slices after their prerequisites; shared kernel/registry changes integrate serially. Remaining phase work from the [port plan](hegemony-port.md) is retained inside this route, not restarted or treated as already complete.

M0 has six approved tickets: [manifest](https://github.com/chuongphong12/Sanguosha-vn/issues/27) and [session contract](https://github.com/chuongphong12/Sanguosha-vn/issues/28) are the initial frontier; [bot prototype](https://github.com/chuongphong12/Sanguosha-vn/issues/29) and [online/storage prototype](https://github.com/chuongphong12/Sanguosha-vn/issues/30) depend on the contract; [representative load](https://github.com/chuongphong12/Sanguosha-vn/issues/31) depends on manifest and both proofs; [M0 decision closure](https://github.com/chuongphong12/Sanguosha-vn/issues/32) depends on that evidence. Q31 accepted the session contract and authorized the bot/storage prototypes; M0.2 is closed as a delivered research/design ticket. M0.1 remains open. The [first local executable tracer](../reviews/2026-10-23-hegemony-m0-prototype-tracer.md) and subsequent [pending Slash/Jink tracer](../reviews/2026-10-23-hegemony-m0-pending-jink.md) keep M0.3/M0.4 open: they are evidence for limited local slices, not completed feasibility or release acceptance. The [service-clock checkpoint](../reviews/2026-10-26-hegemony-m0-service-clocks.md) adds local independent deadline recovery, offline takeover and automatic pending Jink/cancel decisions. The [local PostgreSQL checkpoint](../reviews/2026-10-26-hegemony-m0-postgres.md) adds separate SQL commit/recovery and writer fencing. Other requests, permanent explicit-leave replacement, full autonomous bot turns, timing SLOs, hosted-provider recovery and full acceptance remain unproven.

## Verification and policy

Keep every existing source-research/knowledge/public-test/impact/typecheck/regression/build/dual-graph/Standards-and-Spec gate. Use the session command→durable state→actor view seam and browser→real transport/store E2E; fixture operation tests alone do not certify the release.

The eighteen full-core scenarios remain required, alongside content and 2–10-seat coverage, deterministic replay/conservation, stale/duplicate/controller/deletion races and bot noninterference. Full manifest load/strength thresholds and a forecast are selected after M0 measurement, before acceptance; no 100% claim or native runtime differential claim without corresponding evidence.

If free tier cannot meet the selected workload, keep the gate open and present measured options. Do not silently reduce scope/strength/recovery, incur charges or promote a partial prototype. Deployment upgrades drain/finish active matches under the reviewed maintenance policy; rollback uses a compatible Quốc Chiến release or maintenance/recovery, without silently reopening Standard.

Accepted trade-offs are recorded in [full-manifest release](../adr/0003-full-manifest-first-release.md), [actor-view bots](../adr/0004-actor-view-bot-strategy.md) and [bounded guest-room lifetime](../adr/0005-guest-room-lifetime.md). Research and checkpoints remain revision-labelled; publication state is tracked by the issues, not inferred from this plan.
