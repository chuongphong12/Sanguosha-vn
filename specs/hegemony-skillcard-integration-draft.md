# Part 4y — SkillCard integration proposal

Status: **approach A approved by the user on 2026-10-15**, tracked in [ticket #16](https://github.com/chuongphong12/Sanguosha-vn/issues/16). The filename retains the original review link. This design does not authorize production content or change the approved rules baseline; current implementation boundaries are in [the contract](../engine/skill-card-on-use.md).

## Resumption point

The main engine track completed normalized reward-token methods in Part 4x, game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Documentation delivery has since merged into `codex/hegemony-engine` at `ad36b5a8212275b0fa8b3d2128b3daeaa52f4527`. Its complete tree equals the reviewed documentation PR head `b75b603d4e14e523605126cf7acc3e318608a139`; this preparatory audit ran against that identical tree. No gameplay source changed during documentation delivery.

The existing [port plan](../plans/hegemony-port.md) names generic SkillCard integration as the next dependency. The accepted public seam remains scheduler operation dispatch, actor-specific prompt retrieval and continuation resume, including JSON save/reload. No new network command or UI seam is proposed.

## Problem

Reward tokens expose independent enabled, target, extra-cost and use methods. Those methods are insufficient to execute a legal SkillCard lifecycle. The current common CardUse reader rejects the skill type; the shared CardUsed, resource, CardFinished and effect paths depend on that reader. Consequently, merely calling token cost then token use would omit native event, reveal and cleanup boundaries.

The native [SkillCard::onUse](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L1134-L1137) delegates to Card::onUse. Native [GameRule CardUsed](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L537-L620) also processes SkillCards. Token overrides replace extraCost and use, not that surrounding lifecycle. Detailed facts and caller distinctions belong in [the source investigation](../research/skillcard-integration.md).

## Approaches

| Approach                                  | Deliverable                                                                                                                                                                                                                   | Tradeoff                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Isolated SkillCard onUse checkpoint    | A new normalized operation owns the native event/cost/reveal sequence and normal material cleanup; actual token cost is composed, while CardUsed execution and CardFinished resource cleanup are explicitly supplied adapters | Smallest independently verifiable step; token effects through a fixture CardUsed adapter establish that adapter's composition only. Shared generic execution and legality remain subsequent gates |
| B. Shared SkillCard execution integration | Explicitly expand the common execution domain and its readers/resources/effects, retain the non-Skill onUse entry contract, then compose token cost/use through actual GameRule handlers                                      | Establishes a more complete path in one phase, but affects many existing pipelines and needs several dependent tickets and broader regression evidence                                            |
| C. Full command-to-battle integration     | Include native use validation, response entry points, content authority, phase/history, production moves and controls                                                                                                         | Crosses several unfinished dependency groups; too broad for one checkpoint                                                                                                                        |

Recommendation: **A first**, followed by B and then admission/response integration in distinct reviewed slices. This preserves the project's requirement to validate each part before advancing. A must be reported as an onUse checkpoint, never as completed generic SkillCard integration.

## Proposed Part 4y scope — approach A

Build one normalized private SkillCard onUse operation and its registered children. Source authority remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.

1. Keep distinct original-use, post-PreCardUsed local-use and later shared event-use snapshots. Sort initial targets by current action order and capture original material identity before PreCardUsed. Preserve original event recipient versus rewritten source/target distinctions.
2. Preserve native PreCardUsed, extraCost, showSkill, TargetSelected, CardUsed, CardFinished and normal fallback cleanup ordering. Event consumption follows the native caller; consuming PreCardUsed must not be invented as whole-use cancellation.
3. Model HuanshenSkillChecking, skill-position bookkeeping and the post-show Huashen callback with explicit private authority/adapters and the native ordering. Do not infer actual hidden generals from displayed portraits or expose actual names in logs/results.
4. Compose token extraCost using the existing operation. Default SkillCard extraCost and physical-material movement require their own source-derived branch and reason metadata; overrides must not accidentally discard materials twice.
5. Treat showSkill, GameRule CardUsed execution, CardFinished resources, package-specific post-show handling and transport notifications as named adapters. A fixture adapter must be labelled in every integration claim. Do not register the current non-Skill GameRule readers against skill payloads and hope they work.
6. Explicitly handle the supported rewritten-card branches; any excluded native branch or malformed JSON normalization must be documented and rejected at its actual boundary. A rewrite must never be silently coerced into a basic card to satisfy an old parser.
7. Keep callbacks outside serialized frames. Resume must not repeat a completed cost, reveal, child effect or cleanup. Preserve committed child changes after interruption; full native exception unwind remains a later gate.

The exact normalized descriptor fields and callback contracts must be derived from the source investigation before implementation. They are not invented client inputs. The current common non-Skill reader need not be broadened merely to land this isolated checkpoint.

## Acceptance and testing

Use existing public dispatch/resume APIs, with independently source-derived expected traces and actual registered child operations where claimed.

- Dispatch succeeds before asserting a behavior failure; missing imports/handlers do not count as red-test evidence.
- Verify event/cost/reveal order, initial target order, event consumption and original versus rewritten snapshots.
- Exercise token extraCost with actual marks and physical material costs with actual movement; separate actual effects from fixture children.
- Test normal fallback cleanup only for original materials still on the table, including children claiming materials first and empty material sets.
- Pause/reload at cost, reveal, CardUsed and cleanup child boundaries. Reject wrong actor, stale prompt, malformed choices, duplicate replies and registry-version mismatch without paying twice.
- Exercise nested use, rewritten recipient/targets/cards, malformed late callback results, and all three scheduler interruptions. State precisely which interrupted cleanup remains absent.
- Verify callback arguments are isolated and hidden general/material authority does not appear in public notices, returned values or other players' prompts.
- Preserve rejection of SkillCards at the existing non-Skill onUse entry. Run its current regression cases unchanged.
- Update the canonical contract and one checkpoint, verify the imported snapshot, run focused cases, lint/typecheck/full regression/build, rebuild both graphs and inspect changes, then obtain independent Standards and Spec reviews.

## Pre-edit evidence and risk

At the inspected tree, `npm run docs:verify` passes against canonical `27134851bdbc140fabbeb5b1959c9d8574da3d6a`. A fresh `npm run check` passes: 70 files / 1,587 tests, typecheck and lint with 42 inherited warnings and zero errors. These are baseline results, not tests of this proposed feature.

GitNexus queried SkillCard, CardUsed and reward-token concepts before source exploration. `readCardUse` upstream impact is **CRITICAL**, 67 dependents and 21 affected flows. CodeGraph independently reports a 57-node/83-edge impact at depth two. Counts are tool-specific observations, not complete proofs. `createCardUsedOperation` returned UNKNOWN; direct import/call inspection found nine existing Hegemony suites, so that result cannot justify treating it as unused. No existing function was edited during this audit.

CodeGraph reports complete extraction, zero pending changes and no worktree mismatch. GitNexus's index matches the inspected documentation PR head. Known inference limitations remain; terminal output truncation is not an all-clear. Pre-edit checks must be refreshed for the actual implementation base and every existing function selected for modification.

## Explicit later gates

This proposal does not complete shared SkillCard GameRule/resource/effect execution, Room::useCard validation/history, view-as ownership/availability, target legality, response versus response-use handling, network authentication, phase orchestration, timeout policy, exception unwind, concrete enabled content, native runtime differential testing or complete-match E2E. The Standard runtime is retired only at the already-approved playable-replacement cutover.

The user selected approach A: isolated onUse, with each part independently validated. Shared execution (B) and admission/response remain subsequent checkpoints. Existing rules authority, dispatch/resume seam and production cutover decisions remain settled.
