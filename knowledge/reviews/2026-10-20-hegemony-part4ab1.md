# Part 4ab.1: MethodUse CardAsked/provide/retry and direct lifecycle

Source/test commit `416bc11380eb1b7c21b864efb4964b8e5c510251`, reviewed against `9ce463b37807d127f2689c35085ada1f95a171f3`. The user approved expanding the original executor-only proposal to include CardAsked, shared provide, acquisition and validation-null retry. See the [research/approved scope](../research/2026-10-20-part4ab-response-matrix.md), [native evidence](../research/2026-10-20-direct-response-native.md) and [current contract](../engine/direct-card-use.md). Native pin remains `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.

## Result and authority table

New `ask-card-use.ts` owns normalized MethodUse acquisition and its direct lifecycle. Existing engine functions and production registration are unchanged. `provideCard` exposes a private room-wide slot, not an actor-scoped public move. Exact original/local/event/validated identity and initial versus current cleanup materials remain separate.

| Concern             | Actual implementation exercised                                                                                                | Remaining adapter / limitation                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request state       | Real scheduler operation, CardAsked, shared provided slot, continuing flag, native retry option reset, nil/accepted ChoiceMade | Trusted request adapter supplies catalogue/auth/pattern/ownership admission, human parse, AI DummyCard normalization, delay/timeouts                                                         |
| Conversion          | Real original/validated/reference persistence and null retry control, eager child effects retained                             | Package validateInResponse is a fixture; no complete package conversion catalogue enabled                                                                                                    |
| Execution           | Real PreCardUsed/CardUsed/finish branching, atomic table/discard movement and shared GameRule/resources                        | Current metadata/subcards, skill/general movement metadata and package use dispatcher are fixture authorities                                                                                |
| Presentation/reveal | Real ordering of resumable accepted/skill/reveal/bypass-notification children                                                  | Wrapped update/reset delivery, logs/emotion/broadcast, showSkill/Huashen and client notifications are named fixture adapters; normal CardFinished delivery retains its prior external status |
| Caller composition  | Actual SlashProceed, JinkEffect and SlashResult use the new acquisition/lifecycle module                                       | Concrete card ancestry predicate and package inputs remain fixtures; no UI/transport command registered                                                                                      |
| Persistence         | Actual scheduler and movement event/operation JSON reload, prompt checks and interruption freeze                               | No native exception unwind, complete-match reconnect or native differential certification                                                                                                    |

Two intentional native normalizations are explicit: omit uninitialized CardUseStruct members while retaining its defined defaults, and avoid native limitation(null) dereference by consuming explicit-null/dead-empty provision into nil ChoiceMade. A real provided card can still be used after its actor dies. No history increment follows from local m_addHistory=true. MethodResponse, None/Discard, retrial and rescue Room composition remain excluded.

## Executed checks

- Unchanged focused baseline: 253 tests / four files passed (`slash-response`, `dying`, `nullification`, `room-use-card`). `npm run docs:verify` passed before relying on the pinned contracts.
- Registered public-seam behavioral red/green loops reproduced provided/dead acquisition incorrectly calling the request adapter, then passed after shared-slot selection; validation-null retry first failed the expected second request/default resets, then passed after retry implementation. Initial fixture observation and test-table expectation mistakes were corrected; no missing-export failure is counted as behavioral evidence.
- Final new suite: **44 tests**, exit 0. Covers provider null/card/dead combinations, duplicate null provision, nested shared-slot consumption and room pattern retention, human/AI/provider limitation distinctions, conversion retry, raw SkillCard metadata, event versus local identity, current-material cleanup, finish suppression and real Slash caller composition.
- Spec review added physical wrapped modified/unmodified cases, malformed descriptor/reference/ambiguous material-location checks, and repeated JSON pauses inside actual BeforeCardsMove/CardsMoveOneTime for both table payment and discard cleanup. Direct event and request/validation/reveal/after-child pauses also restore JSON. Wrong actor/stale/duplicate/registry-mismatched replies preserve state and cannot repeat effects. All three scheduler interruption reasons freeze paid table movement without synthetic finish/discard.
- Final `npm run check`: exit 0, **76 files / 1,827 tests**, typecheck passed, **42 inherited lint warnings / zero errors**. Final `npm run build`: exit 0. Source bytes stayed identical after review; staged whitespace check passed.

## Independent reviews and byte identity

Standards: zero actionable documented-standard breaches or Fowler smells. Spec: two initial P2 evidence gaps (physical/invalid-input cases and movement suspension), fixed with seven additional cases; re-review has zero remaining findings. Both reviewers confirmed the final hashes below. Main-agent full validation and graph results are independently executed gates, not inferred from review approval.

| File                                  | Final tested/reviewed SHA256                                       |
| ------------------------------------- | ------------------------------------------------------------------ |
| `src/game/hegemony/ask-card-use.ts`   | `dae319f849b6e9d2b4485d5c99bebfb7d28a1f8731485b2e27c09ea7e1929152` |
| `tests/hegemony/ask-card-use.test.ts` | `5a5d1228093811fb8c84518f0df32d24bff5a1d64427fbf0b46c26b947f37b01` |

## Graph evidence and limits

Pre-edit impact of the shared readSlashCard reader was CRITICAL: eight direct callers, eleven affected entry groups. It and other shared readers/scheduler were left unchanged. The new module's private response decoder preserves rich raw metadata without broadening an existing entry domain or adding SlashGame-only marks as a dependency.

Final GitNexus 1.6.12 force rebuild plus incremental reconciliation succeeded: **293 files / 8,907 nodes / 22,999 edges / 220 clusters / 528 processes**. Both file hashes match the tested/reviewed bytes and independent CodeGraph SQLite hashes. Exact factory/provide contexts resolve the new module and its fixture callers.

Default impact excludes tests and reported UNKNOWN for both new exports. This was investigated, not waived: context found test callers; explicit `include-tests` impact then resolved LOW, one direct factory caller and three provider references. CodeGraph independently resolves factory → setup → new suite and provider → suite; restricted import/reference search across src/tests/server confirms no production consumer. Those lower bounds do not certify future dynamic consumers.

Staged detect_changes: **134 indexed symbols / two files / three selected processes / MEDIUM**. Full comparison from Part 4aa base `21d693e4c9c046b30085fc11a6a434d4d8bb3e31`: **672 symbols / 26 files / 32 selected processes / CRITICAL**. No response partial/truncated flags. The three delta traces end at reference callbacks; process extraction is not a recording or exhaustive coverage of the new request lifecycle. Retain raw aggregate warnings alongside the actual public-seam test evidence.

Extraction still omits **353 entry candidates / 1,257 callees**, cuts **19 walks**, leaves **13 cross-language property sites** unresolved and skips one oversized font. Nonpartial responses do not mean complete graph construction. CodeGraph 1.6.0 reports complete extraction for its model: **257 files / 3,167 nodes / 16,056 edges**, zero pending changes/refs and no worktree mismatch or reindex recommendation. Its affected-tests query resolves the new suite; the final full regression also exercised all existing suites.

Local receipts are Temp `tqs4ab1-check-final.log`, `tqs4ab1-build-final.log`, `tqs4ab1-graphs.json`, `tqs4ab1-gitnexus-final.log`, `tqs4ab1-codegraph.log`, plus `tqs4ab-expanded-audit.md`. Permanent tests, source commit and hashes above are durable evidence; temporary logs are not repository runtime assets.

## Delivery and next dependency

The source/test commit is local. Canonical contracts, both research notes, roadmap and baseline accompany the source through the game knowledge pin; its lock records the actual canonical SHA/tree. No game branch push, PR/main merge, remote game CI or deployment is asserted by this checkpoint. Production still uses Standard2013.

Next is the separate MethodResponse/CardResponded executor and its request composition, then explicitly scoped remaining methods/retrial and rescue Room-use integration. Phase/turn/unwind, live packages/catalogue/dealing, production authentication/network/projection/UI/bots and full-match conformance remain gates. This is completed normalized MethodUse library scope, not the whole native askForCard family or playable Quốc Chiến certification.
