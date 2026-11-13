# Shared opt-in scheduler save decoding

Game [9adedb305a364b00eb0e49564dc693058039e21e](https://github.com/chuongphong12/Sanguosha-vn/blob/9adedb305a364b00eb0e49564dc693058039e21e/src/game/hegemony/scheduler-save.ts), base c2d4e7eb5069bfcd3143ee736f6b88da9548adbd; native authority remains ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/2.3.43-beta2. M1.3.5c.1 adds shared opt-in scheduler save validation under the user-selected B design. Core profile codecs, aggregate Room validation, public match-v3 and full-match/release gates remain pending. See [approved mechanism](../specs/hegemony-match-v3-save.md) and [executed checkpoint](../reviews/2026-11-13-hegemony-m135c1-scheduler-save.md).

## Contract and compatibility

createTriggerSaveCodec(registry).read(unknown, validatedGame) is a separate shared scheduler decoder. It returns a detached scheduler; it never dispatches/resumes/continues/unwinds work. Old profiles still use their existing execution entries without opting in. Existing interpreter output is byte-equivalent after removing only the new export of the unchanged pure actorChoices helper; optional type hooks erase at compilation.

The [shared handler contracts](https://github.com/chuongphong12/Sanguosha-vn/blob/9adedb305a364b00eb0e49564dc693058039e21e/src/game/hegemony/scheduler.ts) add optional OperationHandler.validateSave/validateResult, TriggerSkill.validateSave and TriggerRegistry.validateEvent. The codec requires complete coverage for every registered handler plus the event contract at construction, captures registry configuration, and binds saved registryVersion. Callback semantics must be versioned by the profile owner. Merely supplying a function does not establish that it is a correct validator.

Operation save hooks receive detached game, full frame (input/continuation/answer/children/optional cleanup.normalContinuation), active unwind interruption and top pending prompt. Skill save hooks receive detached game, event frame and its top prompt. Handler codecs must check their own payload/cursor/cleanup and step-prompt actor/choices/cancel semantics; an operation may legitimately ask a different seat from its current actor. Result hooks validate retained child/root operation payloads. validateEvent covers retained events, including child/root completions. These validators are distinct from live operation preflight, whose assumptions may no longer hold after eager state changes.

## Envelope checks and progress

The decoder checks finite acyclic JSON, table identity, seats, safe monotonic allocation identities across prefixes, registered operation/event tables, cyclic actor order, descending priority bands and stable registration order within ties, event cursors/candidates/selected/consumed state, prompt ownership and actor-order choices, nested parent/child actor inheritance and cleared parent results, mutually exclusive completions, paused/yield/interruption/unwind/cleanup composition and opt-in unwind completion. It reuses the live pure actorChoices derivation to compare order prompts without invoking skill callbacks.

Dynamic priority functions are not executed during decoding; the skill's explicit save codec must validate its recorded priority semantics. Package data, generated step choices and allowed occurrence semantics also remain the profile validator's contract. Copies prevent a validator from mutating candidate/caller state through its arguments. Purity outside those arguments and resource limits are not enforced; this is not an untrusted-code sandbox, storage authentication, historical authenticity proof or CPU/time bound.

The application must validate Room, inventory/RNG/content/settings, seat binding and startup/turn roots before publishing/resuming the decoded scheduler. No complete core/startup/battle profile codec or application v3 controller is registered by this slice. Existing match-v2, M0, server and production registration are unchanged. The decoder does not expose a player command or replace Play/Discard/response admissions.

## Evidence and remaining work

[77 new tests](https://github.com/chuongphong12/Sanguosha-vn/blob/9adedb305a364b00eb0e49564dc693058039e21e/tests/hegemony/scheduler-save.test.ts) exercise real dispatch/resume/continue/unwind using explicit synthetic handlers. JSON checkpoints preserve a paid prompt without replay, trigger order/skill prompt/completion, and cleanup prompt/unwind completion at budgets 1/2/7/10000. Negative cases mutate saved envelope/cursor/result/prompt/order/stack/reason/policy state. Validator input isolation and profile capture are tested. They do not certify all native packages, actual Room persistence, network privacy or a full match.

Next: actual enabled profile codecs and aggregate decoder; v3 create/apply/view/restore/trusted continuation and admission routing; actual setup-to-terminal for 2–10 seats; then the unchanged content/session/bot/media/provider/load/cutover gates. PR #33 stays draft.
