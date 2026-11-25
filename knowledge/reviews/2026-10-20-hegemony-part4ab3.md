# Part 4ab.3: None/Discard and normalized retrial

Source/test commit `31386093782099772db6be363b53f45a9226974f`, reviewed against fixed base `cc219dfd4a1df9290d5400fb558fc60a1ddedc96`. The user selected expanded retrial scope; [specification #20](https://github.com/chuongphong12/Sanguosha-vn/issues/20) and the [accepted design](../specs/hegemony-part4ab3-retrial.md) define the three dependent layers. The native authority remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. See [None/Discard research](../research/2026-10-20-method-none-discard.md), [retrial research](../research/2026-10-20-retrial-pipeline.md), [current selection/retrial contract](../engine/retrial.md) and the historical [4ab.2 checkpoint](2026-10-20-hegemony-part4ab2.md).

## Implemented boundaries

| Concern       | Real implementation exercised                                                                                                                                                                                       | Remaining adapters / exclusions                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Acquisition   | Shared provider/continuing/retry, None/Discard factories, unknown reason, retrial suppression and ChoiceMade                                                                                                        | Authenticated request/pattern/catalogue/ownership admission, human/AI parse and wrapped/log notice delivery                            |
| Selection     | None returns without automatic payment; Discard directly moves current materials with THROW(actor), independent of provision/retrial                                                                                | Request-skill discard log/notice belongs to accepted-notification delivery; no Jushou package implementation claim                     |
| Judge result  | Stable private judge IDs, ready-state validation, good/bad cache comparison, negative effect inversion                                                                                                              | Matcher supplies expression grammar; no outer draw/start/actor iteration/finish/disposal                                               |
| Replacement   | Eager canonical judge assignment, actual atomic two-record exchange/discard movement, captured owner/hand gate and current recipient                                                                                | Private metadata/canonical lookup, changed-judge notification; unsafe native null/assert paths normalized to validation                |
| Guicai/Guidao | Actual priority-3 AskForRetrial TriggerSkill cost → scheduler reveal → effect, actual retrial response acquisition, all-material payment, response event, LIFO/pop-before-parse, core replacement and result update | Enabled skill eligibility/slot authority, codec, catalogue, matcher, notices and generic reveal delivery use explicit fixture adapters |
| Persistence   | Actual operation/event/movement suspension, JSON restore, prompt validation, nested stacks and eager interruption state                                                                                             | Native exception unwind, production reconnect/network/UI/bots and complete-match certification                                         |

Core replacement moves only the incoming effective physical ID and old effective ID. Package cost moves all current incoming materials; hand provenance uses the effective ID. These are intentionally distinct snapshots. Core CardResponded has isRetrial=true only under its captured ownership gate; the package response has isRetrial=false. Retrial acquisition emits neither ordinary response nor its reveal/after-hook. Scheduler generic successful-cost reveal still runs between cost and effect.

Package movement uses forceVisible=false and normalized open=true for public table visibility. Native server-side open is uninitialized on this constructor path; per-recipient notifyMoveCards copies make table movement open. This records deterministic JSON behavior rather than claiming parity with an uninitialized native event scalar. Core replacement forces visibility true. Replacement leaves cached result untouched; package effect explicitly updates it after replacement completes.

## Executed validation

- Focused validation advanced from acquisition to core replacement/result and then skill composition at the agreed public dispatch/resume seam. Acquisition regressions assert selection without ordinary execution and exact direct THROW payment. Core regressions assert eager canonical replacement, exchange/discard, conditional response and explicit later result update. Skill regressions exercise actual scheduler cost/reveal/effect rather than simulating the whole pipeline in a callback.
- A concrete regression exposed stale metadata flags when serializing after CardResponded. Shared `resolveResponse` now refreshes flags from the resource ledger while retaining registered reference identity; the public pipeline test passes. A visibility regression distinguishes normalized public-table open from the native force flag.
- Focused tests: **152 passed**: 105 shared direct-request cases (all 87 prior cases plus 18 new selection/retrial cases), and 47 judgment/retrial cases. The Spec reviewer independently ran this focused suite, exit 0.
- Core cases include nullable input, physical/virtual multi-material identity, first-effective-ID payment, canonical identity, owner/hand/recipient mutation timing, no implicit result update, malformed inputs before eager changes and all three interruption reasons after eager assignment/payment.
- Skill cases include both exact patterns/prompts, null/raw SkillCard conversion, validated identity, false-retrial package response, actual movement reason/visibility, serialization after consumed/rewritten events, current flags, parse-null consumption, current effect judge ID, nested LIFO, generic reveal and an ownership-changing child that enables the core's extra response. Operation/event and real movement JSON pauses cover repeated resume and wrong actor/stale/replayed/registry-mismatched replies.
- Final `npm run check`: exit 0, **77 files / 1,935 tests**, typecheck passed, **42 inherited lint warnings / zero errors**. `npm run build`: exit 0. The only subsequent test edit corrected two spaces using Prettier; the final full check ran after that edit and runtime build inputs were unchanged.
- Staged whitespace check passed. Knowledge links, canonical publication, subtree offline/upstream verification and fresh-clone/old-checkout/return verification accompany delivery. The game lock identifies the published knowledge commit/tree.

## Independent reviews

Standards: **0 actionable findings**, including the baseline smell review. Spec: **0 actionable findings** against the expanded design. Both reviewers confirmed the final hashes below and independently reconstructed the prior test hash to establish that the post-review formatting change was whitespace only. Neither axis certifies unported production authorities.

The subsequent canonical knowledge review covered all 14 changed/new files: Standards **0 findings**, Spec **0 findings**. Internal-link validation passed for 66 Markdown files / 245 relative links. Publication and game checkout checks are delivery checks in addition to this source/content review.

| File                                  | SHA256                                                             |
| ------------------------------------- | ------------------------------------------------------------------ |
| `src/game/hegemony/ask-card-use.ts`   | `6a93d621428268a5c4bd1ddb6689292252894da3144ad3e5ec945356a7ef88ec` |
| `src/game/hegemony/retrial.ts`        | `18a773cabedb5c29e908298ef8c80d38db3f06a54a26705190f3aef0c241319e` |
| `src/game/hegemony/retrial-skill.ts`  | `06135b7ddb4f7ef2695f49d27f98418de0eade5c58e8c15864cd99bb54ef8673` |
| `tests/hegemony/ask-card-use.test.ts` | `c6b8b3e0a8cc76f3fe8a8c8755007d44b764b32ab29850546baeec2561ab7c4f` |
| `tests/hegemony/retrial.test.ts`      | `330580a0a0ba0d706b1ab2427e3bb13638bea7bc912ef1bbc6a45d5edcb429b8` |

## Graph evidence

Pre-edit exact impacts of the existing shared owner/readers/setup were LOW, with test consumers included. New factory/helper and CodeGraph consumer impacts were also inspected before subsequent edits. UNKNOWN native incoming-call gaps were investigated against pinned source bodies rather than treated as absence of behavior. Scheduler and movement implementations were not edited.

GitNexus **1.6.12 full rebuild**: **302 files / 9,279 nodes / 23,863 edges / 230 clusters / 530 processes**. All five file hashes above match GitNexus fileHashes and independent CodeGraph file hashes. Exact factory impacts with tests included are LOW: None/Discard two direct callers each, core retrial one, judge-result two, retrial-skill two. The newly shared resolveResponse is HIGH (three direct callers / three selected processes); readResponse is CRITICAL (six / five). These raw post-change risks are retained; graph aggregation is not reclassified from passing tests.

Staged detect_changes before source commit: **271 symbols / five files / 12 selected processes / HIGH**, no partial/truncated response. Cumulative comparison from Part 4aa base `21d693e4c9c046b30085fc11a6a434d4d8bb3e31`: **1,026 symbols / 35 files / 44 processes / CRITICAL**. The raw cumulative symbol listing was truncated by the installed tool's hard 1,000-entry listing cap; it was not treated as clean. Bounded exact-path Cypher queries over all diff paths, using GitNexus's own exported diff parser and hunk-overlap algorithm, recovered all **1,026 unique IDs**, contained every listed ID and matched the raw count. Separate bounded process-edge queries recovered the same **44 process IDs**. The receipt preserves raw truncation and complete supplemental results rather than hiding the limitation.

All 12 selected process IDs were inspected through STEP_IN_PROCESS: direct request/skill cost/effect → shared response decoder, core preparation → canonical lookup, and result → judgeIsEffected → judgeIsGood. These are selected heuristic traces, not exhaustive registered operation/event dispatch. Global extraction still drops **372 entry candidates / 1,270 callees**, cuts **18 walks**, leaves **25 cross-language property sites** unresolved and skips one oversized font.

An incremental reindex after the final whitespace edit produced empty symbol IDs and inconsistent affected-process counts. That result was rejected. A fresh full rebuild restored the 1,026-symbol/44-process result; final validation and byte checks use that rebuilt index. No game code was changed to accommodate this tooling anomaly.

CodeGraph **1.6.0** independently reports **260 files / 3,272 nodes / 16,659 edges**, complete state, no pending changes/refs, worktree mismatch or reindex recommendation. Its affected-test/consumer queries resolve shared direct-request and retrial tests, and factory → skillSetup → suite. Exact source hashes bind this checkpoint even when later documentation-only imports change index commit labels/counts.

Local receipts: Temp `tqs4ab3-check-final.log`, `tqs4ab3-build-final.log`, `tqs4ab3-gitnexus-repair.log`, `tqs4ab3-codegraph.log`, `tqs4ab3-graphs.json` and native graph receipts named in the investigations. Durable source pins, tests and hashes above provide reproducible attribution; temporary logs are not repository assets.

## Delivery and next dependency

Source is committed locally on codex/hegemony-card-admission; canonical knowledge is reviewed/published and imported by a full pinned SHA. No game push, PR/main merge, remote game CI, deployment or native runtime differential is asserted. Production still registers Standard2013.

Next scope SinglePeach → actual Room use(false). Outer judge orchestration and other retrial packages remain separate, along with phase/turn composition, native unwind, enabled package/catalogue/dealing, production authentication/network/private projection/UI/bots and complete-match conformance. This completes the approved normalized 4ab.3 scope, not all packages or a playable Quốc Chiến match.
