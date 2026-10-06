# Standard 2013 engine repair and validation

Date: 2026-10-06. Base: `101c730642cea7b086c60075f234b18f25b34a97`.
Branch: `codex/fix-standard-rules-engine`.

## Scope and rule policy

This repair follows the [engine audit](2026-10-06-standard-rules-audit.md),
[card/flow findings](2026-10-06-spec-audit.md), and
[hero findings](2026-10-06-standards-audit.md). The original reports retain their
observations against the base commit. They describe the earlier audit, rather
than the repaired tree.

The game remains Standard 2013 with its existing 108-card deck and 27 generals.
Edition-specific RenDe, JiZhi and QiCai changes use the publisher's 2013 release.
Classic flow and equipment rules use the official rules author's 2014 Rules 3.0
mirror. See [source provenance](2026-10-06-rules-primary-sources.md).
The edition-qualified defaults are: phases advance without Discard-to-Play;
delayed tricks offer Wuxie at deferred resolution; an operation requiring more
cards than deck plus discard ends the match in a draw before dealing partially.
Expansion cards and generals have not been added.

## Repairs and regression evidence

Public boundaries under test are exported `cardEngine` operations, shared rules,
and authoritative `TqsGame` moves. New cases live in
`tests/rules/standard-rules-regressions.test.ts`; existing rule, skill, AI, UI and
match-client tests exercise the changed callers.

| Audit finding   | Repaired behavior and evidence                                                                                                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01, S04–S06    | AOE resolves each target in seat order with ordinary response and Wuxie chains. Out-of-order answers are rejected atomically; armor eligibility, Spear, protection of another player and counter-Wuxie are covered. Lord death stops later targets immediately. |
| S02, S10, SK06  | Snatch completes once; Dismantle and TuXi emit hand/equipment loss events. XiaoJi/LianYing interruptions survive. TuXi uses supplied shuffle instead of ambient randomness.                                                                                     |
| S03, S07–S09    | Red Bagua satisfies one Dodge; Wushuang still requires two. Declining TieJi continues Dodge. Ice Sword decline retains LuoYi bonus. Retained Lightning is judged only once per turn.                                                                            |
| S11             | Delayed trick placement is direct; Wuxie remains at delayed resolution. Existing deferred-judgment tests remain enabled.                                                                                                                                        |
| SK01, SK08      | Invalid YiJi recipients and invalid virtual Slashes return false without mutation or exceptions.                                                                                                                                                                |
| SK02–SK05       | RenDe has a valid second-activation rejection; JiZhi reveals and handles basic discard/exchange and non-basic gain; QiCai protects weapon/armor against others' discard; QiXi offers only Dismantle.                                                            |
| SK07, SK09–SK10 | KeJi records Slash responses during its owner's Play phase. YingZi and TianDu offer activation/decline. Bagua, ordinary judgments, TieJi and GangLie retain their continuation around TianDu.                                                                   |
| SK11            | Catalogue descriptions now match implemented GuoSe, QianXun, YiJi, YaoWu and TongJi rules.                                                                                                                                                                      |

Additional cases cover rescue order, repeated Peaches from negative HP, Lord's
Loyalist-kill penalty preserving judgment cards, post-cost weapon range,
WuSheng/LongDan forced Slashes, and ally response loss triggers. Ice Sword now
discards sequentially, allowing LianYing between discards. Wushuang's Dodge
counter resets per Halberd target. Green Dragon follow-up ignores distance.
Forced Spear rechecks target legality after a Wuxie chain creates KongCheng.

Draw exhaustion clears pending resolution and preserves terminal state. A
separate AOE scenario asserts that every one of the 108 physical IDs occupies
exactly one zone after each move and nested interruption.

## Verification

Baseline: 39 test files, 234 tests passing. After review repairs,
`npm run check` passed: **40 test files, 287 tests**, including **53 new regression
cases**. Typecheck passed. ESLint reported **0 errors and 42 warnings**;
warnings remain and are not described as a warning-free result. `npm run build`
passed with production assets and client bundles generated.

`git diff --cached --check` passed. Checks ran locally on Windows with Node 22.19.0
and installed dependencies; the CI workflow runs on Ubuntu with pnpm 11. This
does not claim that a new hosted CI run or Vercel deployment has occurred.

Review found and repaired further caller defects: FanKui and GangLie popped newly
queued LianYing instead of their completed parent; skipped Play with KeJi repeated
the Draw phase; FanKui offered an impossible selection against a source with only
judgment cards; forced Spear skipped KongCheng validation. Each repair has a
regression that failed before its implementation change and passed afterward.

## Standards

Public-boundary regressions and atomic invalid-answer assertions are present.
The two concrete loss-event caller findings were repaired; follow-up review has
zero unresolved actionable correctness findings. The review's possible
Duplicated Code concern about repeated parent removal is a heuristic; this patch
keeps the established stack representation and limits changes to affected flows.
The unsupported all-skills “Conforms” certification in `SKILL_CONFORMANCE.md` is
replaced with named test coverage.

## Spec

The review's repeated-draw and impossible FanKui-selection findings were repaired.
The final forced-Spear finding was repaired before spending materials. No scope
creep was reported. Follow-up review verifies the repaired cases and reports
zero unresolved actionable findings.

## Graph evidence and limits

GitNexus 1.6.12 and CodeGraph 1.6.0 were used for impact analysis before modifying
existing engine functions. Core draw, response and loss-event functions have
HIGH/CRITICAL caller reach; validation includes their rule, skill, AI, UI,
privacy and client integration tests. CodeGraph was synced after the final code
changes. GitNexus was reindexed and its full structured
`detect_changes(scope=all)` result inspected before the local commit.

The final index contains 2,634 nodes, 9,379 edges and 225 reported flows. The
structured change analysis lists 150 changed symbols across 30 files and 73
affected indexed processes, with CRITICAL risk. This reflects the shared engine
callers and is not presented as a low-risk change or an empty-impact result.

GitNexus's flow index reports truncation: its default entry-point, branching and
process caps omit some execution paths. Cross-language field anchors are also
incomplete. The full structured change result is inspected rather than relying
on the CLI's shortened display. Missing flows are not considered unaffected;
CodeGraph callers, source inspection, regression tests and both reviews provide
additional evidence. This remains a known limit of graph-based certification.

All 43 advertised skills have named tests, but this does not prove every legal
combination of cards, skills, deaths, judgments and interrupts. No exhaustive
coverage percentage is claimed. The work is a local repair branch; merging and
deployment are separate operations.
