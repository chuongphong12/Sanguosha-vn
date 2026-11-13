# M1.3.5c — shared scheduler recovery contract

On 2026-11-13 the user selected B: extend shared scheduler save-validation contracts, rather than keep all validation in match-v3. The accepted [M1.3 B scope](hegemony-turn-unwind.md) and [release destination](../plans/hegemony-release.md) remain unchanged. No automatic main merge or production enablement is authorized by this internal checkpoint.

## Ordered checkpoints

1. C1 shared opt-in scheduler decoder and explicit operation/skill/event/result hooks. Validate envelope before profile codecs, require coverage, return detached state without running the interpreter; preserve existing profiles. The [implemented contract](../engine/scheduler-save.md) and [checkpoint](../reviews/2026-11-13-hegemony-m135c1-scheduler-save.md) record this bounded part.
2. Supply complete codecs for the actual enabled startup/battle registries and application Room/configuration/root decoding. Missing/unknown handlers or continuations fail closed before execution. Bind schema/rules/content/registry/startup globals/settings/battle budget/catalogue/profile identity; no v1/v2/M0 migration by inference.
3. Public v3 create/apply/view/restore plus trusted continueWork. Transfer setup to one Room once, then consume startup completion with the [handoff](../engine/match-handoff.md). Restore pauses actor prompts and resumes only validated bounded internal work. Candidate clones preserve caller input on rejection. Keep turn-root completion consumption separate from starting the next root.
4. Route Play/Discard and other specialized prompts through actual admissions, never raw-resume fallback after rejection. Route nested prompts by their current responder. Rebuild detached public/owner-private projections from Room and admission views; no frames/caught data/RNG/tags/other hands/hidden identities. Trusted continue/unwind is not a player command.

## Acceptance and limits

Each part follows RED/GREEN, focused/full tests/typecheck/build, impact/change graphs, exact-byte checks, independent Standards/Spec reviews and canonical knowledge import/pin before the next. Tests distinguish real scheduler/engine behavior from synthetic package/metadata hooks and injected corrupt-save conditions. Registry hook presence alone cannot certify semantic completeness; tests and review must establish it for each enabled profile.

After application integration, M1.3.5 still requires actual minimal-profile setup-to-terminal scenarios 2–10 seats and real card-play interruption/recovery. First release retains all previously agreed content, competitive bot, full art/audio, desktop online/single-player, room/session recovery and measured free-tier/load gates. C1 is neither a playable match nor a cutover.

## M1.3.5c.2a progress

The [actual pile save subset](../engine/pile-save.md) completes four handler codecs and shared queued-child context. Whole enabled profiles/Room decoding and the public v3/full-match/release gates remain open.
