# Part 4aa — Room wrapper and authoritative requests (#19)

The user approved approach B: normalized `Room::useCard` plus Play and targetful response-use command admission. [Issue #19](https://github.com/chuongphong12/Sanguosha-vn/issues/19), the [approved design](../specs/hegemony-room-use-card-draft.md) and [current contract](../engine/room-use-and-admission.md) define this slice. Internal execution, authoritative web policy and remaining production authorities are separate.

## Revision identities

- Implementation/review base: game `21d693e4c9c046b30085fc11a6a434d4d8bb3e31`.
- Source/test commit: `0ac2aabf98645d48208d8609696d0be4e2c9ff62`, local branch `codex/hegemony-card-admission`. No game branch publication, PR, main merge or deployment is asserted.
- Native authority: QSanguosha-QuocChien 2.3.43-beta2 `ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`. Native source was not changed or executed. Native request/client evidence is in [the request investigation](../research/targetful-command-admission.md), wrapper evidence in [the Room investigation](../research/room-use-card-entry.md).

Only two new game modules and three new public-seam suites are added. Existing scheduler/readers/onUse factories and production registration are unchanged. Preexisting unrelated untracked audit/review files were preserved and excluded.

## Implemented behavior and fixture boundaries

| Boundary            | Actual exercised behavior                                                                                                                                                                    | Supplied or pending authority                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Wrapper             | Parse/copy flags and tags, provenance, limitation/recast, eager null, validation, explicit real identity, signed history, normal and converted after snapshots                               | Package parser, ancestry/identity, limitation, validation and after methods are registered private adapters                                                        |
| Card execution      | Real non-Skill onUse, GameRule, resources, movement/cleanup; actual nested use and late event rewrites                                                                                       | Test cards are fixtures; they do not enable native package content                                                                                                 |
| Wrapped state       | Actual material wrapper face/modified state; preserved flags/tags; update before showSkill; physical update/reset                                                                            | Notification transport is supplied; no native mutable pointer runtime                                                                                              |
| Command admission   | Authenticated separate context, strict opaque replies, current actor/phase/request epoch, versioned offers, enabled/skill/pattern/material policies, ordered targets/prohibition/feasibility | Session provider, live catalogue/ViewAs/skill ownership and network binding remain external; mandatory supplied policies are not a complete package implementation |
| Response-use        | Child request outside responder Play, actual Room false retaining eager effects, fresh retry prompt and native cancellation ChoiceMade string                                                | Direct MethodUse/MethodResponse, rescue and generic askForCard remain separate paths                                                                               |
| SkillCard/token     | Gateway through actual Room and SkillCard envelope, real reward-token cost/use and physical draw movement; JSON reload after actual payment does not repeat payment or draw                  | Reward-card construction, show/notification and fixed draw-pile adapter are explicit fixtures                                                                      |
| Persistence/privacy | Saved request bindings/ordered prefix/generation, wrapper pause at validation/notice/onUse/after, JSON reload, wrong actor/stale/forged/replayed/registry rejection                          | Raw state/frames/completions remain private; no production battle projection or network reconnect certification                                                    |
| Interruption        | All three scheduler reasons retain eager state/history and freeze remaining work                                                                                                             | Native exception unwind remains unimplemented                                                                                                                      |

## Executed validation

- Fresh unchanged baseline `npm run check`: 72 files / 1,704 tests, exit 0; lint had 42 inherited warnings and zero errors; typecheck passed.
- Behavioral red/green loops ran through registered public operations for the initial real wrapper use, null validation, pre/post-validation history identity, recursive false, parse/limitation, delayed wrapping, repeated Slash/physical reset, staged command entry, forged/current-state rejection, ordered targets and PlayCard/ChoiceMade handling. Failures were assertion/behavior failures, not missing import/handler failures.
- Review regressions reproduced stale material/target selections blocking back/cancel, then passed after the discard-only repair. A richer structurally valid wrapped face reproduced flags/tags/showSkill overwrite; explicit five-field copying made it green.
- Final focused suites: 49 new public-seam cases across three files. They include recursive history default true despite outer false, inner actor changes isolated from outer after arguments, actual nested use and late CardUsed rewrite, empty/hand/mixed/foreign provenance, equal-looking descriptors with different identity, and paid-token JSON resume.
- Final `npm run check`: exit 0, 75 files / 1,753 tests; typecheck passed; same 42 inherited lint warnings, zero errors. Final `npm run build`: exit 0. Source/test bytes remained unchanged afterward.
- Staged whitespace validation passed. All five staged blobs and SHA256 values matched both GitNexus indexed file hashes and the independent CodeGraph SQLite file hashes.

| Game file                                   | Git blob                                   | SHA256                                                             |
| ------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `src/game/hegemony/card-command.ts`         | `d704f123cd0a76f304a567f2a5585d3b38681e77` | `5152a5d21f73de3309cebd4357405b8595c5e1d0e2ffb2e2c07827847908a194` |
| `src/game/hegemony/room-use-card.ts`        | `cc9923f04d84247f2850d9b4d9c854ce9ccb61f7` | `8b8b74119421642f538d2e8453e901e5e3b303081754492356ab794eada40eb1` |
| `tests/hegemony/card-command-token.test.ts` | `15005987204ee4a9968275a897ba874987638ba5` | `b0584904e122454b70f8e7566da9d8a78a95a3dcedf76075e747a9ecb62917a1` |
| `tests/hegemony/card-command.test.ts`       | `a57e66d359c1be448b38da530bda33507c65ce10` | `083a53e3ec590148979922aef6033c29d2ae5ea7f1f99aef8f62f636fac1c5dc` |
| `tests/hegemony/room-use-card.test.ts`      | `6734992097c9b14bb558e4f8ee19beb7e86a8d2e` | `509e189390154deede426d763027906bce1b4999f5317f9f3ada72f6880e929e` |

## Independent review axes

- **Standards:** one initial P2 stale-selection recovery finding; fixed with red/green regressions. Re-review: zero remaining documented violations or actionable Fowler smells.
- **Spec:** three initial P2 findings: rich-face storage overwrite, stale-selection recovery and incomplete explicit acceptance cases. All fixed/covered; re-review: zero remaining findings and no scope creep. Final test execution is root verification, not an independent reviewer run.
- Canonical documentation review: Standards zero actionable findings; Spec zero actionable content findings. Commit/hash/graph/delivery placeholders were explicitly excluded until independently executed and finalized.

## Graph evidence and limits

Pre-edit graph evidence resolved the shared execution reader and both onUse factories. Shared reader impact was CRITICAL (12 direct / 21 flows); it was reused unchanged. UNKNOWN factory impacts were supplemented by CodeGraph and explicit regression imports rather than treated as unused. No existing base function was changed.

Before review repairs, fresh CodeGraph impacts resolved command admission to four nodes/five edges and Room use to six nodes/nine edges, including the new fixture suites. Final CodeGraph sync/status: 255 files / 3,112 nodes / 15,746 edges, complete extraction, zero pending changes/refs, no worktree mismatch or reindex recommendation.

Final GitNexus 1.6.12 forced index-only rebuild succeeded: 283 files / 8,702 nodes / 22,500 edges / 220 clusters / 530 flows. All five indexed SHA256 values match staged bytes and the committed blobs above. Exact factory contexts resolve the intended files and test callers. Full detect_changes scope=all reports 455 changed symbols in five files, 28 affected flows and CRITICAL risk, with no partial/truncated result flags. The 28 flows were inspected: command context/phase/offers/material/ordered-target policies and scheduler submit/read paths. The CRITICAL classification is retained; passing tests and private library scope do not establish production enablement.

An earlier incremental index produced implausible old-setup access edges and 432 affected flows. Its relationship evidence was discarded after comparison with actual imports and CodeGraph. A forced graph/FTS rebuild corrected those factory callers and relationships; it reused unchanged parser output. CodeGraph affected-tests independently resolves exactly the three new suites (four dependents traversed), and all five SQLite content hashes match the same source/test SHA256 values. Only the new admission module imports the Room types in src; runtime consumers of the factories are the fixture suites. No existing production registration was edited.

Global extraction still omits 347 entry candidates / 1,210 callees, cuts 19 walks, leaves 13 cross-language property sites unlinked and skips one font over 512 KiB. A graph's absent caller or flow is not proof of absence; targeted definitions, independent graph and executed behavior supplement extraction limits. Native CodeGraph was not independently certified for the reference checkout.

## Knowledge delivery and remaining work

Canonical contracts, research, design, roadmap and source baseline were updated together. Prepared relative-link validation passed (52 Markdown files / 186 relative links), as did whitespace checks. Publication/import, offline/upstream tree checks and ordinary clone/branch-switch validation remain pending for this prepared snapshot; their executed results will be added in the sealing record before final delivery. The game lock records the containing canonical full SHA/tree; no self-referential commit is embedded here.

This is a completed normalized library slice, not production Quốc Chiến playability. Direct response/rescue entries, phase progression, live package/catalog/identity/authentication/transport authorities, exception unwind, enabled content, application projection/UI/bots, full-match conformance and native runtime differential remain gates. Issue #19 stays open while the game branch is local.
