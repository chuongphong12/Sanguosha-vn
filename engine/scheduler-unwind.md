# Opt-in scheduler unwind and cooperative yield

Inspected game [32d3e5f68b9d07af9ab6e1cb3f1291939094edd8](https://github.com/chuongphong12/Sanguosha-vn/blob/32d3e5f68b9d07af9ab6e1cb3f1291939094edd8/src/game/hegemony/scheduler.ts). Scope: checkpoint M1.3.1 of the accepted [turn/unwind design](../specs/hegemony-turn-unwind.md). [Executions and reviews](../reviews/2026-10-28-hegemony-m131-scheduler-unwind.md) are distinct from this contract. Native authority remains ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f; this page pins the interpreter infrastructure. The later [M1.3.2 core contract](core-interruption-cleanup.md) adds actual catch bodies at its separate source revision; neither is a normal-turn game.

## Interface and compatibility

Existing scheduler profiles default to freeze and unbounded interpretation. Their interruption shape/normal operation receiver and context remain compatible. Registry.unwind=true opts into the trusted unwind entry; stepBudget is an independent optional positive safe integer. An invalid budget rejects before frame allocation or accepted continuation mutation. Callback/policy semantics remain the version owner's responsibility; equal version strings cannot detect arbitrary changed callback behavior.

- unwindTriggerInterruption requires the same registry version, enabled policy and exact pending interruption identity. Opt-in throws receive a separate monotonic interruption ID, fencing repeated throws from the same frame. EventId still identifies the originating frame, which may be an operation.
- An operation's optional unwind handler owns native protected-region eligibility and reason checks. It receives a cloned saved normalContinuation, current interruption and a separate cleanup continuation/children/answer. This checkpoint's test handlers are trace fixtures. Actual library catch handlers arrive in [M1.3.2](core-interruption-cleanup.md); existing application profiles still do not opt in.
- Normal dispatch remains blocked during active unwind. Current cleanup prompts resume through the existing actor/frame/offered-choice/registry checks. Validate saved cleanup ownership and required handlers before accepting work. Missing/empty/incorrect boundaries, absent handlers and malformed saved normal continuation reject without advancing the candidate.
- Complete unwind reports unwindCompletion, never normal operation success. A new dispatch clears the previous unwind receipt. Abandoned normal continuations and their completion paths are not resumed.

## Traversal and JSON continuation

Traverse abandoned frames inside out. Events/operations without an applicable cleanup body depart; an operation with a body retains its frozen normal continuation and starts a separate cleanup step. Cleanup may run actual interpreter children/events/prompts. A handler can decline cleanup for an unmatched reason by returning. It owns that native distinction; the scheduler does not impose a universal TurnBroken cleanup.

When a cleanup child throws, freeze again with a new interruption ID. The trusted owner must explicitly start the new unwind. A catch already in progress is abandoned when reached; it is not re-entered. Outer catches see the latest reason. Eager game effects remain. JSON retains traversal, active owner, both continuation roles, prompt IDs and distinct completion; restoring the plain data does not itself drive the scheduler.

The private state is not authentication or a durable transaction. An outer match/session must validate its aggregate, bind real actors, persist before delivery and dispatch only accepted owner work. Arbitrary hostile scheduler documents are not certified by these bounded metadata guards. Registry IDs must version handler meanings; guard checks cannot certify an omitted native catch in a handler still registered with changed code.

## Cooperative work

stepBudget counts interpreter loop steps, including unwind traversal. At exhaustion the scheduler records yielded=true and pauses. continueTriggerWork accepts only a saved yield with matching registry, valid budget/mode and no prompt or pending interruption. It clears the marker and continues under that call's bound. A prompt, a frozen throw and an idle completed root are not interchangeable with a yield.

The bound does not preempt synchronous package callbacks or promise wall-clock latency. It adds no player prompt, deadline, bot policy, timer reset or automatic server scheduling. The application turn-root bound and trusted pump belong to later M1.3 integration. Existing [M0 clocks/session](prototype-session.md) and [M1.2 startup owner](startup-owner.md) do not opt into this new profile.

## Evidence and next dependency

[New test source](https://github.com/chuongphong12/Sanguosha-vn/blob/32d3e5f68b9d07af9ab6e1cb3f1291939094edd8/tests/hegemony/scheduler-unwind.test.ts) contains 17 cases: default freeze and receiver compatibility, independent normal/cleanup continuations, actor-private prompt/JSON continuation, stale receipt fencing, nested re-interruption, distinct completion, budgets1/5/unbounded, and rejected malformed cursor/handler configuration. Tests cross public dispatch/unwind/continue/resume seams with trace handlers. The [checkpoint](../reviews/2026-10-28-hegemony-m131-scheduler-unwind.md) records actual executions, findings, byte checks and graph limits.

M1.3.2 now implements [actual protected damage, CardUsed and Room-use cleanup](core-interruption-cleanup.md), including movement/CardFinished/RNG and native catch scopes at its own checkpoint. Phase cleanup, complete bodies, normal/extra turns, recovery owner and match v3 remain M1.3.3–5. Production still registers Standard2013; this library capability does not enable Quốc Chiến or retire legacy saves.

## Later phase lifecycle slice

[M1.3.3a phase lifecycle](phase-lifecycle.md) adds native sequence/change/execute/skip/insert/query as a separate library slice. It reuses current Room.playerPhases and the existing scheduler. Actual GameRule cleanup is still required within M1.3.3; turns/recovery/bodies and match v3 remain M1.3.4–5. Current application profiles and production registration are unchanged. Historical evidence above retains its named revision.
