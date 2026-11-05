# Trigger and operation scheduler

Baseline: game `32d3e5f68b9d07af9ab6e1cb3f1291939094edd8`. Owning web source: `src/game/hegemony/scheduler.ts`; public cases: `tests/hegemony/scheduler.test.ts` and `operations.test.ts`. Native source: `src/server/roomthread.cpp` trigger processing (224–666) and `src/server/room.cpp` action order (192) at the [selected pin](../rules/source-authority.md).

## Entry points and persisted state

`createTriggerScheduler`, `dispatchTriggerEvent`, `dispatchTriggerOperation`, `resumeTriggerPrompt` and `getTriggerPrompt` are the public boundary. Event and operation frames have distinct discriminants. An event child returns through `child`; an operation child through `operationChild`; a root operation completes through `operationCompletion` without inventing an event. Operations can yield events, operations or responder-only prompts.

State retains JSON payloads, cursors, stable IDs, parent frames, pending prompt and registry version. Functions and registries remain external. Pure operation preflight runs before frame allocation. Recursive data validation rejects cyclic values and nonfinite numbers. Rewritten payloads are validated before the next yield/completion; invalid handler payload replacement is restored on programming error, but arbitrary game mutations by faulty handlers are not transactional.

## Trigger ordering and eligibility

Event-specific priority bands visit actors in current-player-first order including deceased seats. Game/scenario rules run after player actors in their band. Ordinary record hooks precede their triggerable hooks. Record, cost, reveal and effect may retain continuations under children/prompts. GameRule record behavior is not interchangeable with an ordinary skill record callback.

Package `triggerable` callbacks must be pure and supply stable occurrence IDs and ordered-target indices. Identity includes actor, owner, general slot, target and occurrence copy. Ordered-target group consumption includes the selected prefix. Shown/global/equipment Compulsory and Wake occurrences prevent cancellation; hidden nonglobal/nonequipment occurrences remain optional. Only global Compulsory is selected automatically. Non-card triggers precede card triggers.

Initial offers reconcile to surviving collected keys after record hooks and on order resume. A later record cannot introduce an earlier skill before an attempt. Full eligibility discovery runs again after each cost/effect attempt, without rerunning records. Refused cost consumes that occurrence without revealing or running effect; successful cost completes reveal children before effect. Native package-specific encoded-string cases still need conformance review when translated.

## Prompt and interruption contract

The [local session experiment](prototype-session.md) is a later application consumer of these JSON continuations, with owner-only Slash/Jink prompts, persist-before-projection and actual process restart tests. This does not add deadline policy or native unwind to the scheduler.

A prompt has a monotonic ID, parent frame, responder, allowed choices and cancellation policy. `getTriggerPrompt` gives only the responder a copy. Malformed, stale, duplicate, wrong-player or wrong-registry responses cannot execute a stage. A production command router must exclude unrelated state-changing commands while a prompt is pending; the scheduler's valid reply alone does not authorize arbitrary game commands.

Event consumption returns a child result to its caller; each caller decides whether that consumption affects its own flow. Do not generalize “consumed means cancel everything”: movement Before, CardUsed, CardEffected and many terminal notifications have different owning rules.

Default profiles freeze stage-change, turn-broken and game-over with frames/eager state intact. M1.3.1 adds the separate [opt-in unwind/cooperative-yield interface](scheduler-unwind.md): handlers can own resumable cleanup, but actual native core catches are the next checkpoint. No automatic CardFinished/material cleanup/phase finish is enabled in the existing application profiles. Complete production command transport and native exception parity remain open.
